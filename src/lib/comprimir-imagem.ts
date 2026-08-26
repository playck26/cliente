/**
 * SPEC-018/TASK-002 — a compressão no navegador, antes de qualquer upload.
 *
 * **Por que existe.** REQ-001/AC-001: uma foto de celular tem 12 MP e uns
 * 4 MB. O teto do servidor é 2 MB (`TAMANHO_MAXIMO_BYTES`) e o de dimensão é
 * 2500px — subir o original seria 413 na cara de quem tirou a foto, e o
 * NFR-001 fala de gestor na quadra com sinal ruim. Sai daqui com no máximo
 * 2000px no maior lado e WebP q90.
 *
 * **Este arquivo é duplicado de propósito** entre `Admin` e `Cliente`
 * (ADR-001, poly-repo): não há pacote compartilhado, e criar um seria mudar
 * a arquitetura por causa de 150 linhas. As duas cópias precisam andar
 * juntas — mudança aqui é mudança lá.
 *
 * ## A parte que não é óbvia: o `ICCP` (INV-050, corrigida em 2026-08-26)
 *
 * `canvas.toBlob('image/webp')` **sempre** grava o chunk `ICCP` com um
 * perfil de cor sRGB de 456 bytes. O validador do servidor é **allowlist**
 * (`VP8 `, `VP8L`, `VP8X`, `ALPH`) e recusa qualquer chunk fora dela —
 * então, sem o tratamento abaixo, **nenhuma imagem sobe por nenhum
 * caminho**. Foi o DEF-007, e ele derrubou foto de perfil e logo em
 * produção.
 *
 * **A versão anterior desta nota dizia que era caso de aparelho Display P3.
 * Não é.** Medido em Chrome 151 headless, sem tela nenhuma: `colorSpace:
 * 'srgb'`, contexto sem `colorSpace`, `colorSpaceConversion: 'none'` e
 * `OffscreenCanvas` produzem o **mesmo arquivo, byte a byte**, todos com
 * `ICCP`. Nenhuma opção de canvas evita o chunk — a premissa de que dava
 * para preveni-lo na origem era falsa, e por isso as defesas antigas nunca
 * poderiam ter funcionado.
 *
 * As três camadas de hoje:
 *
 * 1. o contexto 2D é pedido com `colorSpace: 'srgb'` **explícito**, e o
 *    bitmap é decodificado com `colorSpaceConversion: 'default'`. Isto não
 *    evita o `ICCP`, mas garante que os **pixels** saiam em sRGB — o que
 *    é justamente o que torna o passo 2 seguro;
 * 2. `removerIccp()` tira o chunk do contêiner antes de subir. **É perda
 *    zero:** o perfil que o Chrome grava é o sRGB (`desc` = "sRGB",
 *    "Google Inc. 2016"), e imagem sem perfil já é lida como sRGB por todo
 *    navegador. Some o chunk, some o bit `ICC` do `VP8X`, e os pixels
 *    ficam exatamente onde estavam;
 * 3. o resultado é **inspecionado antes de sair** (`inspecionarWebp`). Se
 *    algum chunk fora da allowlist apareceu mesmo assim, a falha é local e
 *    diz o que houve, em vez de virar um 422 sem explicação.
 *
 * A ordem importa: **remover primeiro, inspecionar depois.** Invertida, o
 * pré-voo reprovaria o arquivo que o passo 2 consertaria em seguida — que
 * era, literalmente, o defeito.
 *
 * A defesa 3 **não substitui o validador do servidor** e não tenta imitá-lo:
 * a autoridade continua sendo `webp.validator.ts` no `back`, que confere
 * ordem, cardinalidade e dimensão. Aqui só se pergunta *"apareceu chunk que
 * eu sei que vai ser recusado?"* — é pré-voo, não portaria.
 */

/** REQ-001 — maior lado depois da compressão. */
export const LADO_MAXIMO_PX = 2000;

/** REQ-001 — qualidade do WebP. */
export const QUALIDADE_WEBP = 0.9;

/**
 * AC-001 — o alvo de tamanho no fio. Não é o teto do servidor (2 MB): é o
 * que o NFR-001 promete para quem está na quadra com sinal ruim.
 */
export const ALVO_BYTES = 600 * 1024;

/**
 * Os mesmos quatro FourCC da allowlist do servidor. **Cópia declarada**, não
 * fonte: se o servidor mudar a lista, esta cópia fica desatualizada e o pior
 * que acontece é o pré-voo deixar passar algo que o servidor recusa — que é
 * o comportamento de hoje sem pré-voo nenhum. O contrário (recusar aqui o
 * que o servidor aceitaria) seria pior, e é por isso que a lista é a mesma,
 * e não mais estrita.
 */
const CHUNKS_PERMITIDOS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);

/**
 * O bit `ICC` do byte de flags do `VP8X`, na posição que o container spec
 * define: `Rsv(2) | I(ICC) | L(Alpha) | E(Exif) | X(XMP) | A(Anim) | R`.
 *
 * Tirar o chunk `ICCP` e deixar o bit ligado faria o arquivo **mentir sobre
 * si mesmo** — e o servidor recusa pelo flag mesmo sem o chunk (AC-003),
 * então os dois andam juntos ou o conserto não conserta nada.
 */
const FLAG_ICC = 0x20;

export interface DimensaoAlvo {
  readonly largura: number;
  readonly altura: number;
  /** `false` quando a imagem já cabia — evita reamostrar à toa. */
  readonly redimensionou: boolean;
}

/**
 * A conta do redimensionamento. Pura, e separada do canvas de propósito: é a
 * única parte que dá para testar sem navegador de verdade.
 *
 * **Nunca aumenta.** Foto de 800px vira WebP de 800px, não de 2000px —
 * ampliar inventaria pixel e engordaria o arquivo pelo motivo errado.
 *
 * O lado maior é **fixado** no limite em vez de recalculado por
 * `round(maior * escala)`. Isso é exato por construção, e não conserto de
 * defeito observado: procurei um `w` entre 2001 e 200000 em que
 * `round(w * (2000/w)) !== 2000` e **não existe**. Fica assim porque é uma
 * linha mais simples e não depende de a busca ter sido exaustiva — não
 * porque o outro jeito estava errado. O lado menor usa `Math.round`.
 */
export function calcularDimensaoAlvo(
  largura: number,
  altura: number,
  ladoMaximo: number = LADO_MAXIMO_PX,
): DimensaoAlvo {
  if (
    !Number.isFinite(largura) ||
    !Number.isFinite(altura) ||
    largura <= 0 ||
    altura <= 0
  ) {
    throw new Error("Dimensão inválida: " + largura + "x" + altura);
  }

  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) {
    return { largura, altura, redimensionou: false };
  }

  const escala = ladoMaximo / maior;
  const menorLado = Math.max(1, Math.round(Math.min(largura, altura) * escala));

  return largura >= altura
    ? { largura: ladoMaximo, altura: menorLado, redimensionou: true }
    : { largura: menorLado, altura: ladoMaximo, redimensionou: true };
}

export type ResultadoDaInspecao =
  | { readonly ok: true; readonly chunks: readonly string[] }
  | { readonly ok: false; readonly motivo: string };

const TAMANHO_CABECALHO_RIFF = 12;
const TAMANHO_CABECALHO_CHUNK = 8;

/**
 * Lê os FourCC de um WebP e reprova o que o servidor reprovaria por
 * allowlist. Total: entrada corrompida devolve `ok: false`, nunca lança.
 *
 * Não confere ordem nem dimensão — isso é do servidor (ver o cabeçalho).
 */
export function inspecionarWebp(bytes: ArrayBuffer): ResultadoDaInspecao {
  if (bytes.byteLength < TAMANHO_CABECALHO_RIFF) {
    return { ok: false, motivo: "arquivo curto demais para ser um WebP" };
  }

  const view = new DataView(bytes);
  const texto = (inicio: number) =>
    String.fromCharCode(
      view.getUint8(inicio),
      view.getUint8(inicio + 1),
      view.getUint8(inicio + 2),
      view.getUint8(inicio + 3),
    );

  if (texto(0) !== "RIFF" || texto(8) !== "WEBP") {
    return { ok: false, motivo: "não é um contêiner RIFF/WEBP" };
  }

  const chunks: string[] = [];
  let cursor = TAMANHO_CABECALHO_RIFF;

  while (cursor + TAMANHO_CABECALHO_CHUNK <= bytes.byteLength) {
    const fourcc = texto(cursor);
    const tamanho = view.getUint32(cursor + 4, true);
    chunks.push(fourcc);

    if (!CHUNKS_PERMITIDOS.has(fourcc)) {
      // O caso que motivou tudo isto. `ICCP` ganha mensagem própria porque é
      // o único que aparece por causa do APARELHO de quem está usando, e não
      // por causa do arquivo — a pessoa não fez nada errado.
      return {
        ok: false,
        motivo:
          fourcc === "ICCP"
            ? "o navegador gravou o perfil de cor (ICCP) na imagem"
            : 'chunk fora da allowlist: "' + fourcc + '"',
      };
    }

    // Payload ímpar leva um byte de padding — parte do RIFF, não do chunk.
    cursor += TAMANHO_CABECALHO_CHUNK + tamanho + (tamanho % 2);
  }

  if (chunks.length === 0) {
    return { ok: false, motivo: "WebP sem nenhum chunk" };
  }

  return { ok: true, chunks };
}

/**
 * Tira o chunk `ICCP` do contêiner e apaga o bit `ICC` do `VP8X`.
 *
 * **Por que existe:** ver o cabeçalho — o Chrome grava o perfil sRGB em todo
 * WebP que produz, e o servidor recusa por allowlist. Sem isto, upload
 * nenhum funciona.
 *
 * **É cirurgia de bytes, não recodificação.** O bitstream da imagem
 * (`VP8 `/`VP8L`) é copiado intacto: nenhum pixel é lido, decodificado ou
 * reescrito. O que muda é o contêiner — um chunk a menos, um bit a menos, e
 * o tamanho do RIFF recalculado (o servidor confere que ele bate).
 *
 * **Total, como o resto do módulo:** entrada que não é WebP, truncada ou sem
 * `ICCP` volta **inalterada**. Devolver o original é o certo aqui — quem
 * julga é `inspecionarWebp` na sequência, e depois o servidor.
 */
export function removerIccp(bytes: ArrayBuffer): ArrayBuffer {
  if (bytes.byteLength < TAMANHO_CABECALHO_RIFF) return bytes;

  const view = new DataView(bytes);
  const texto = (inicio: number) =>
    String.fromCharCode(
      view.getUint8(inicio),
      view.getUint8(inicio + 1),
      view.getUint8(inicio + 2),
      view.getUint8(inicio + 3),
    );

  if (texto(0) !== "RIFF" || texto(8) !== "WEBP") return bytes;

  const origem = new Uint8Array(bytes);
  const mantidos: Uint8Array[] = [];
  let cursor = TAMANHO_CABECALHO_RIFF;
  let achouIccp = false;

  while (cursor + TAMANHO_CABECALHO_CHUNK <= bytes.byteLength) {
    const fourcc = texto(cursor);
    const tamanho = view.getUint32(cursor + 4, true);
    // Payload ímpar leva um byte de padding — parte do RIFF, não do chunk.
    const total = TAMANHO_CABECALHO_CHUNK + tamanho + (tamanho % 2);

    // Chunk que diz ser maior que o arquivo: para aqui e devolve o que tem.
    // Arquivo malformado é assunto do servidor, não deste módulo.
    if (cursor + total > bytes.byteLength) break;

    if (fourcc === "ICCP") {
      achouIccp = true;
    } else {
      const pedaco = origem.slice(cursor, cursor + total);
      if (fourcc === "VP8X") {
        // O byte de flags é o primeiro do payload do VP8X.
        pedaco[TAMANHO_CABECALHO_CHUNK] &= ~FLAG_ICC;
      }
      mantidos.push(pedaco);
    }

    cursor += total;
  }

  if (!achouIccp) return bytes;

  const corpo = mantidos.reduce((soma, p) => soma + p.byteLength, 0);
  const saida = new Uint8Array(TAMANHO_CABECALHO_RIFF + corpo);
  const escrita = new DataView(saida.buffer);

  saida[0] = 82; saida[1] = 73; saida[2] = 70; saida[3] = 70; // RIFF
  // O tamanho do RIFF conta a partir do "WEBP", não do início do arquivo.
  escrita.setUint32(4, 4 + corpo, true);
  saida[8] = 87; saida[9] = 69; saida[10] = 66; saida[11] = 80; // WEBP

  let destino = TAMANHO_CABECALHO_RIFF;
  for (const pedaco of mantidos) {
    saida.set(pedaco, destino);
    destino += pedaco.byteLength;
  }

  return saida.buffer;
}

export interface ImagemComprimida {
  readonly arquivo: File;
  readonly largura: number;
  readonly altura: number;
  readonly bytesOriginais: number;
  readonly bytesFinais: number;
}

/**
 * As três chamadas de navegador que este módulo faz. Existem como parâmetro
 * porque `jsdom` não tem canvas, e adicionar o pacote `canvas` seria trocar
 * uma dependência nativa por um teste — a planta do repositório declara que
 * não há bibliotecas além das que estão lá.
 *
 * Com a costura, a conta de dimensão e a inspeção de chunk são testadas de
 * verdade, e o que sobra sem cobertura é só o encanamento com o navegador.
 * Fica declarado em vez de disfarçado.
 */
export interface DependenciasDoNavegador {
  readonly criarBitmap: (arquivo: File) => Promise<ImageBitmapLike>;
  readonly criarCanvas: (largura: number, altura: number) => CanvasLike;
}

/**
 * `close` é **obrigatório** e não opcional: com ele opcional, o
 * `HTMLCanvasElement` real deixa de ser atribuível a `CanvasLike` — o
 * `drawImage` do DOM exige `CanvasImageSource`, e `{ close?: ... }` não
 * satisfaz `ImageBitmap`. Um tipo de teste que não aceita o objeto de
 * produção é um tipo errado.
 */
export interface ImageBitmapLike {
  readonly width: number;
  readonly height: number;
  close: () => void;
}

export interface CanvasLike {
  getContext: (
    tipo: "2d",
    opcoes?: { colorSpace?: "srgb" },
  ) => Contexto2DLike | null;
  toBlob: (
    retorno: (blob: Blob | null) => void,
    tipo?: string,
    qualidade?: number,
  ) => void;
}

export interface Contexto2DLike {
  drawImage: (
    fonte: ImageBitmapLike,
    x: number,
    y: number,
    largura: number,
    altura: number,
  ) => void;
}

/**
 * As dependências reais. **Exportada porque é o que os testes precisam
 * morder**: é aqui que mora `colorSpaceConversion: 'default'`, e um teste
 * que monta o próprio objeto de opções prova a si mesmo, não ao código.
 */
export function dependenciasPadrao(): DependenciasDoNavegador {
  return {
    // `colorSpaceConversion: 'default'` converte para o espaço do canvas.
    // `'none'` preservaria o perfil de origem — o caminho do `ICCP`.
    criarBitmap: (arquivo) =>
      createImageBitmap(arquivo, { colorSpaceConversion: "default" }),
    criarCanvas: (largura, altura) => {
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      return canvas;
    },
  };
}

export class ErroDeCompressao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeCompressao";
  }
}

/**
 * Comprime e devolve o `File` que vai no `multipart`, campo `arquivo`
 * (CON-017.1). Lança `ErroDeCompressao` com mensagem legível — quem chama
 * mostra na tela.
 */
export async function comprimirImagem(
  arquivo: File,
  deps: DependenciasDoNavegador = dependenciasPadrao(),
): Promise<ImagemComprimida> {
  let bitmap: ImageBitmapLike;
  try {
    bitmap = await deps.criarBitmap(arquivo);
  } catch {
    // Arquivo que o navegador não decodifica: HEIC sem suporte, PDF
    // renomeado, imagem truncada. A mensagem não chuta qual dos três.
    throw new ErroDeCompressao("Não foi possível ler esta imagem.");
  }

  const alvo = calcularDimensaoAlvo(bitmap.width, bitmap.height);
  const canvas = deps.criarCanvas(alvo.largura, alvo.altura);

  // INV-050: `srgb` explícito. É o padrão da especificação, mas escrever é o
  // que impede alguém de trocar por `display-p3` "para ficar mais bonito" —
  // e ficaria, até o servidor recusar o upload.
  const contexto = canvas.getContext("2d", { colorSpace: "srgb" });
  if (contexto === null) {
    throw new ErroDeCompressao("Este navegador não conseguiu preparar a imagem.");
  }

  contexto.drawImage(bitmap, 0, 0, alvo.largura, alvo.altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) => {
    canvas.toBlob(resolver, "image/webp", QUALIDADE_WEBP);
  });

  if (blob === null || blob.size === 0) {
    // Navegador sem encoder de WebP. Acontece em Safari antigo, e a
    // mensagem precisa dizer isso, porque não há nada que a pessoa possa
    // fazer com o arquivo dela.
    throw new ErroDeCompressao(
      "Este navegador não consegue gerar WebP. Tente por outro navegador.",
    );
  }

  // A ordem é a correção do DEF-007: remover primeiro, inspecionar o
  // resultado. Ao contrário, o pré-voo reprova o que a remoção consertaria.
  const limpo = removerIccp(await blob.arrayBuffer());

  const inspecao = inspecionarWebp(limpo);
  if (!inspecao.ok) {
    throw new ErroDeCompressao(
      "A imagem gerada não seria aceita pelo servidor (" +
        inspecao.motivo +
        ").",
    );
  }

  // O que sobe é o `limpo`, não o `blob`. Subir o blob depois de inspecionar
  // o limpo seria validar um arquivo e mandar outro.
  const arquivoFinal = new File([limpo], trocarParaWebp(arquivo.name), {
    type: "image/webp",
  });

  return {
    arquivo: arquivoFinal,
    largura: alvo.largura,
    altura: alvo.altura,
    bytesOriginais: arquivo.size,
    bytesFinais: arquivoFinal.size,
  };
}

/**
 * O nome não vai para o storage — a chave é derivada do conteúdo (INV-035).
 * Serve só para o `multipart` não anunciar `.jpg` num corpo WebP, o que
 * confundiria quem lesse o log.
 */
function trocarParaWebp(nome: string): string {
  const semExtensao = nome.replace(/\.[^./\\]+$/, "");
  return (semExtensao || "imagem") + ".webp";
}
