/**
 * SPEC-018/TASK-002 — as provas da compressão no navegador.
 *
 * **O que dá para provar aqui e o que não dá.** `jsdom` não tem canvas nem
 * encoder de WebP, então nenhum teste deste arquivo comprime uma imagem de
 * verdade. O que ele prova é o que decide o resultado: a conta de dimensão,
 * a inspeção de chunk, e **os argumentos exatos com que o canvas é chamado**
 * — que é onde a INV-050 vive.
 *
 * O que fica sem cobertura, declarado em vez de disfarçado: que o Chrome
 * num aparelho Display P3 realmente não grava `ICCP` quando o contexto é
 * `srgb`. Isso é comportamento de navegador; a defesa contra ele estar
 * errado é a inspeção do resultado, e essa **está** coberta.
 *
 * Este arquivo é duplicado em `Admin` e `Cliente` (ADR-001).
 */
import { describe, expect, it, vi } from "vitest";
import {
  ALVO_BYTES,
  calcularDimensaoAlvo,
  comprimirImagem,
  dependenciasPadrao,
  ErroDeCompressao,
  inspecionarWebp,
  LADO_MAXIMO_PX,
  QUALIDADE_WEBP,
  type CanvasLike,
  type DependenciasDoNavegador,
  type ImageBitmapLike,
} from "./comprimir-imagem";

describe("calcularDimensaoAlvo — REQ-001, no máximo 2000px no maior lado", () => {
  it("encolhe paisagem pelo lado maior", () => {
    expect(calcularDimensaoAlvo(4000, 3000)).toEqual({
      largura: 2000,
      altura: 1500,
      redimensionou: true,
    });
  });

  it("encolhe retrato pelo lado maior", () => {
    expect(calcularDimensaoAlvo(3000, 4000)).toEqual({
      largura: 1500,
      altura: 2000,
      redimensionou: true,
    });
  });

  it("nenhuma dimensão de entrada produz lado maior acima do limite", () => {
    // Varredura, e não um caso escolhido a dedo: a garantia do REQ-001 é
    // sobre QUALQUER foto, e um `expect` numa dimensão só provaria aquela.
    for (let lado = 1; lado <= 12000; lado += 7) {
      for (const [l, a] of [
        [lado, 3024],
        [4032, lado],
        [lado, lado],
      ]) {
        const r = calcularDimensaoAlvo(l, a);
        expect(Math.max(r.largura, r.altura)).toBeLessThanOrEqual(
          LADO_MAXIMO_PX,
        );
        expect(Math.min(r.largura, r.altura)).toBeGreaterThanOrEqual(1);
      }
    }
    // E a proporção não se perde no caminho: 4:3 continua 4:3.
    expect(calcularDimensaoAlvo(4032, 3024)).toEqual({
      largura: 2000,
      altura: 1500,
      redimensionou: true,
    });
  });

  it("NÃO amplia imagem que já cabia", () => {
    // Ampliar inventaria pixel e engordaria o arquivo pelo motivo errado.
    expect(calcularDimensaoAlvo(800, 600)).toEqual({
      largura: 800,
      altura: 600,
      redimensionou: false,
    });
  });

  it("a fronteira é inclusiva: 2000 passa intacta, 2001 encolhe", () => {
    expect(calcularDimensaoAlvo(2000, 1000).redimensionou).toBe(false);
    expect(calcularDimensaoAlvo(2001, 1000)).toEqual({
      largura: 2000,
      altura: 1000,
      redimensionou: true,
    });
  });

  it("nunca devolve lado zero, mesmo em imagem absurdamente estreita", () => {
    // 20000x3 tem escala 0.1: o lado menor arredondaria para 0, e um canvas
    // de altura 0 gera blob vazio — falha muda, lá na frente.
    const { altura } = calcularDimensaoAlvo(20000, 3);
    expect(altura).toBeGreaterThanOrEqual(1);
  });

  it("recusa dimensão inválida em vez de produzir canvas quebrado", () => {
    expect(() => calcularDimensaoAlvo(0, 100)).toThrow(/inválida/);
    expect(() => calcularDimensaoAlvo(100, Number.NaN)).toThrow(/inválida/);
  });
});

/** Monta um WebP mínimo com os chunks pedidos, para a inspeção morder. */
function montarWebp(
  chunks: { fourcc: string; payload: number[] }[],
  cabecalho = "RIFF",
  formato = "WEBP",
): ArrayBuffer {
  const corpo: number[] = [];
  for (const { fourcc, payload } of chunks) {
    for (const c of fourcc) corpo.push(c.charCodeAt(0));
    const n = payload.length;
    corpo.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
    corpo.push(...payload);
    if (n % 2 === 1) corpo.push(0); // padding do RIFF
  }

  const bytes: number[] = [];
  for (const c of cabecalho) bytes.push(c.charCodeAt(0));
  const total = 4 + corpo.length;
  bytes.push(
    total & 0xff,
    (total >> 8) & 0xff,
    (total >> 16) & 0xff,
    (total >> 24) & 0xff,
  );
  for (const c of formato) bytes.push(c.charCodeAt(0));
  bytes.push(...corpo);

  return new Uint8Array(bytes).buffer;
}

describe("inspecionarWebp — o pré-voo contra a allowlist do servidor", () => {
  it("aceita o WebP simples que o canvas produz", () => {
    const r = inspecionarWebp(montarWebp([{ fourcc: "VP8 ", payload: [1, 2] }]));
    expect(r).toEqual({ ok: true, chunks: ["VP8 "] });
  });

  it("aceita o estendido com alfa", () => {
    const r = inspecionarWebp(
      montarWebp([
        { fourcc: "VP8X", payload: new Array<number>(10).fill(0) },
        { fourcc: "ALPH", payload: [9] },
        { fourcc: "VP8L", payload: [1, 2, 3] },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it("REPROVA ICCP, e a mensagem fala do navegador, não do arquivo", () => {
    // A INV-050 inteira em um teste. Quem tirou a foto não fez nada errado:
    // o aparelho é que tem tela Display P3.
    const r = inspecionarWebp(
      montarWebp([
        { fourcc: "VP8X", payload: new Array<number>(10).fill(0) },
        { fourcc: "ICCP", payload: [1, 2, 3, 4, 5] },
        { fourcc: "VP8 ", payload: [1] },
      ]),
    );
    expect(r).toEqual({
      ok: false,
      motivo: "o navegador gravou o perfil de cor (ICCP) na imagem",
    });
  });

  it("REPROVA EXIF — é por onde GPS entraria", () => {
    const r = inspecionarWebp(
      montarWebp([
        { fourcc: "VP8 ", payload: [1] },
        { fourcc: "EXIF", payload: [7, 7] },
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/EXIF/);
  });

  it("anda certo por cima do padding de payload ímpar", () => {
    // Payload de 3 bytes leva 1 byte de padding. Errar isso desalinha o
    // cursor e faz a inspeção ler lixo como FourCC — reprovando um arquivo
    // perfeitamente bom.
    const r = inspecionarWebp(
      montarWebp([
        { fourcc: "VP8X", payload: new Array<number>(10).fill(0) },
        { fourcc: "ALPH", payload: [1, 2, 3] },
        { fourcc: "VP8L", payload: [4] },
      ]),
    );
    expect(r).toEqual({ ok: true, chunks: ["VP8X", "ALPH", "VP8L"] });
  });

  it("é total: entrada corrompida devolve motivo, nunca lança", () => {
    expect(inspecionarWebp(new ArrayBuffer(4)).ok).toBe(false);
    expect(inspecionarWebp(new ArrayBuffer(0)).ok).toBe(false);
    expect(
      inspecionarWebp(montarWebp([{ fourcc: "VP8 ", payload: [] }], "RIFX")).ok,
    ).toBe(false);
    expect(
      inspecionarWebp(
        montarWebp([{ fourcc: "VP8 ", payload: [] }], "RIFF", "WEBX"),
      ).ok,
    ).toBe(false);
  });
});

interface Espiao {
  deps: DependenciasDoNavegador;
  opcoesDoContexto: { colorSpace?: "srgb" } | undefined;
  chamadaDoToBlob: [string | undefined, number | undefined] | undefined;
  desenho: number[] | undefined;
}

function espiar(
  origem: { largura: number; altura: number },
  saida: ArrayBuffer | null,
): Espiao {
  const espiao: Espiao = {
    deps: {} as DependenciasDoNavegador,
    opcoesDoContexto: undefined,
    chamadaDoToBlob: undefined,
    desenho: undefined,
  };

  const bitmap: ImageBitmapLike = {
    width: origem.largura,
    height: origem.altura,
    close: vi.fn(),
  };

  const canvas: CanvasLike = {
    getContext: (_tipo, opcoes) => {
      espiao.opcoesDoContexto = opcoes;
      return {
        drawImage: (_fonte, x, y, largura, altura) => {
          espiao.desenho = [x, y, largura, altura];
        },
      };
    },
    toBlob: (retorno, tipo, qualidade) => {
      espiao.chamadaDoToBlob = [tipo, qualidade];
      retorno(saida === null ? null : new Blob([saida], { type: "image/webp" }));
    },
  };

  espiao.deps = {
    criarBitmap: () => Promise.resolve(bitmap),
    criarCanvas: () => canvas,
  };
  return espiao;
}

const FOTO = new File([new Uint8Array(4 * 1024 * 1024)], "foto.JPG", {
  type: "image/jpeg",
});

describe("comprimirImagem — o encanamento, e a INV-050 no argumento", () => {
  it("pede o contexto 2D com colorSpace srgb EXPLÍCITO", async () => {
    // Este é o teste da INV-050. Trocar `srgb` por `display-p3` compila,
    // roda e só falha quando o servidor recusa o upload de alguém.
    const espiao = espiar({ largura: 4032, altura: 3024 }, montarWebp([
      { fourcc: "VP8 ", payload: [1] },
    ]));
    await comprimirImagem(FOTO, espiao.deps);
    expect(espiao.opcoesDoContexto).toEqual({ colorSpace: "srgb" });
  });

  it("decodifica com colorSpaceConversion default, nunca none", async () => {
    // `'none'` preserva o perfil de origem — é o outro caminho pelo qual o
    // `ICCP` chega ao arquivo, e não adianta o canvas ser sRGB se o bitmap
    // entrou com perfil.
    //
    // Este teste morde `dependenciasPadrao()`, o código de produção, e não um
    // objeto montado aqui: `jsdom` não tem `createImageBitmap`, então ele é
    // instalado no global só para capturar o argumento. Um teste que montasse
    // as próprias opções provaria a si mesmo.
    const original = (globalThis as Record<string, unknown>).createImageBitmap;
    let opcoes: ImageBitmapOptions | undefined;
    (globalThis as Record<string, unknown>).createImageBitmap = (
      _fonte: unknown,
      recebidas: ImageBitmapOptions,
    ) => {
      opcoes = recebidas;
      return Promise.resolve({ width: 10, height: 10, close: () => {} });
    };

    try {
      await dependenciasPadrao().criarBitmap(FOTO);
    } finally {
      (globalThis as Record<string, unknown>).createImageBitmap = original;
    }

    expect(opcoes).toEqual({ colorSpaceConversion: "default" });
    expect(opcoes?.colorSpaceConversion).not.toBe("none");
  });

  it("o canvas real nasce já na dimensão alvo", () => {
    // A outra metade de `dependenciasPadrao()`. `jsdom` cria o elemento
    // `canvas` (só não dá contexto 2D), então dá para provar as dimensões.
    const canvas = dependenciasPadrao().criarCanvas(2000, 1500);
    expect((canvas as HTMLCanvasElement).width).toBe(2000);
    expect((canvas as HTMLCanvasElement).height).toBe(1500);
  });

  it("codifica em image/webp com qualidade 90", async () => {
    const espiao = espiar({ largura: 4032, altura: 3024 }, montarWebp([
      { fourcc: "VP8 ", payload: [1] },
    ]));
    await comprimirImagem(FOTO, espiao.deps);
    expect(espiao.chamadaDoToBlob).toEqual(["image/webp", QUALIDADE_WEBP]);
  });

  it("desenha já na dimensão alvo, e devolve o File .webp", async () => {
    const espiao = espiar({ largura: 4032, altura: 3024 }, montarWebp([
      { fourcc: "VP8 ", payload: [1, 2, 3] },
    ]));
    const r = await comprimirImagem(FOTO, espiao.deps);

    expect(espiao.desenho).toEqual([0, 0, 2000, 1500]);
    expect(r.largura).toBe(2000);
    expect(r.arquivo.type).toBe("image/webp");
    // O nome não vai para o storage (a chave é do conteúdo, INV-035), mas
    // anunciar `.JPG` num corpo WebP confundiria quem lesse o log.
    expect(r.arquivo.name).toBe("foto.webp");
    expect(r.bytesOriginais).toBe(4 * 1024 * 1024);
    expect(r.bytesFinais).toBeGreaterThan(0);
  });

  it("AC-001 — a foto de 12 MP sai com ≤ 2000px e dentro do alvo de rede", async () => {
    // O tamanho final aqui é fabricado (não há encoder no jsdom); o que este
    // teste guarda é o CONTRATO: dimensão pela conta real, e a constante de
    // rede sendo a do NFR-001. O tamanho de verdade é prova de aparelho, e
    // está declarado como lacuna no cabeçalho do arquivo.
    const espiao = espiar({ largura: 4032, altura: 3024 }, montarWebp([
      { fourcc: "VP8 ", payload: new Array<number>(500).fill(1) },
    ]));
    const r = await comprimirImagem(FOTO, espiao.deps);
    expect(Math.max(r.largura, r.altura)).toBeLessThanOrEqual(LADO_MAXIMO_PX);
    expect(r.bytesFinais).toBeLessThanOrEqual(ALVO_BYTES);
  });

  it("REPROVA localmente quando o navegador gravou ICCP mesmo assim", async () => {
    // A defesa 2: se o canvas sRGB não bastou, a falha é local e explicada,
    // em vez de um 422 sem explicação no aparelho de quem está usando.
    const espiao = espiar({ largura: 100, altura: 100 }, montarWebp([
      { fourcc: "VP8X", payload: new Array<number>(10).fill(0) },
      { fourcc: "ICCP", payload: [1, 2] },
      { fourcc: "VP8 ", payload: [1] },
    ]));
    await expect(comprimirImagem(FOTO, espiao.deps)).rejects.toThrow(
      ErroDeCompressao,
    );
    await expect(comprimirImagem(FOTO, espiao.deps)).rejects.toThrow(
      /perfil de cor \(ICCP\)/,
    );
  });

  it("diz que o navegador não tem encoder quando o blob vem nulo", async () => {
    const espiao = espiar({ largura: 100, altura: 100 }, null);
    await expect(comprimirImagem(FOTO, espiao.deps)).rejects.toThrow(
      /não consegue gerar WebP/,
    );
  });

  it("diz que não conseguiu ler a imagem quando a decodificação falha", async () => {
    const deps: DependenciasDoNavegador = {
      criarBitmap: () => Promise.reject(new Error("decode failed")),
      criarCanvas: () => {
        throw new Error("não deveria chegar aqui");
      },
    };
    await expect(comprimirImagem(FOTO, deps)).rejects.toThrow(
      /Não foi possível ler esta imagem/,
    );
  });
});
