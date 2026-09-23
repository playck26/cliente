import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **O badge da notificação não é o ícone, e confundir os dois já custou um
 * defeito em produção.**
 *
 * No Android o `badge` é renderizado como **silhueta**: só o canal alfa
 * sobrevive, e cor nenhuma. O `sw.js` apontava para `icon-maskable-192.png`,
 * que é opaco de ponta a ponta — como todo ícone *maskable* tem de ser —, e o
 * resultado na bandeja foi um **círculo vazio**. Apareceu no primeiro push
 * real, em 2026-09-20.
 *
 * No iPhone nada disso acontecia: o WebKit ignora `badge` e usa o ícone do app
 * instalado. **O defeito existia num dos dois aparelhos**, que é o pior tipo:
 * quem testa só num deles conclui que está tudo certo.
 *
 * ## Por que isto é teste e não comentário
 *
 * Um comentário pedindo "use um PNG monocromático" não impede ninguém de
 * apontar o `badge` para um logo colorido — e a falha é **silenciosa**: o
 * build passa, o deploy passa, e só quem tem Android vê.
 *
 * ## O que este arquivo passou a conferir, e por quê
 *
 * A primeira versão parava no **tipo de cor** do PNG (byte 25; tipo 4 é
 * *escala de cinza + alfa*, e um PNG colorido não consegue ser desse tipo) e
 * no tamanho. Isso é necessário e **não é suficiente**: um **disco 100%
 * opaco** é tipo 4, é 96×96, e passa — sendo exatamente o defeito que a
 * SPEC-062 viu na bandeja.
 *
 * Então o teste passou a **decodificar o alfa** e a julgar a FORMA. Os três
 * critérios abaixo vieram de medição, não de gosto — os números medidos estão
 * ao lado de cada um.
 */

/**
 * Caminhos resolvidos a partir da RAIZ do pacote, e não de `import.meta.url`:
 * sob o vitest o módulo não é servido como `file:`, e o `readFileSync` recusa
 * a URL com *"The URL must be of scheme file"*. O `root` do vitest é o
 * diretório do pacote, que é o que `process.cwd()` devolve aqui.
 */
const PUBLICO = path.resolve(process.cwd(), "public");
const arquivo = (relativo) => path.join(PUBLICO, relativo);

/** O caminho que o `sw.js` realmente usa, lido dele e não repetido aqui. */
function badgeDeclaradoNoServiceWorker() {
  const fonte = readFileSync(arquivo("sw.js"), "utf8");
  const achado = /badge:\s*"([^"]+)"/.exec(fonte);
  expect(achado, "o sw.js não declara `badge:`").not.toBeNull();
  return achado[1];
}

/** Os campos do IHDR de um PNG. Sem dependência: são deslocamentos fixos. */
function cabecalhoPng(bytes) {
  const assinatura = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < assinatura.length; i++) {
    expect(bytes[i], `byte ${i} não é de um PNG`).toBe(assinatura[i]);
  }
  return {
    largura: bytes.readUInt32BE(16),
    altura: bytes.readUInt32BE(20),
    profundidade: bytes[24],
    tipoDeCor: bytes[25],
  };
}

/** Lê o PNG que o `sw.js` aponta como badge. */
function bytesDoBadge() {
  const caminho = badgeDeclaradoNoServiceWorker();
  expect(caminho.startsWith("/")).toBe(true);
  return readFileSync(arquivo(caminho.slice(1)));
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * O canal ALFA do badge, decodificado.
 *
 * **Sem dependência nova**, e isso é de propósito: um teste que precisa de
 * biblioteca de imagem para rodar é um teste que alguém desativa no dia em que
 * a biblioteca quebra o build. PNG tipo 4 com 8 bits são dois bytes por pixel
 * (cinza, alfa), mais um byte de filtro por linha; o `zlib` já vem no Node.
 */
function alfaDoBadge() {
  const bytes = bytesDoBadge();
  const { largura, altura, profundidade, tipoDeCor } = cabecalhoPng(bytes);
  expect([profundidade, tipoDeCor]).toEqual([8, 4]);

  const pedacos = [];
  let i = 8;
  while (i < bytes.length) {
    const tamanho = bytes.readUInt32BE(i);
    if (bytes.toString("ascii", i + 4, i + 8) === "IDAT") {
      pedacos.push(bytes.subarray(i + 8, i + 8 + tamanho));
    }
    i += 12 + tamanho;
  }
  const cru = inflateSync(Buffer.concat(pedacos));

  const bpp = 2;
  const linha = largura * bpp;
  const saida = Buffer.alloc(altura * linha);
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)];
    const entrada = cru.subarray(y * (linha + 1) + 1, (y + 1) * (linha + 1));
    for (let x = 0; x < linha; x++) {
      const a = x >= bpp ? saida[y * linha + x - bpp] : 0;
      const b = y > 0 ? saida[(y - 1) * linha + x] : 0;
      const c = x >= bpp && y > 0 ? saida[(y - 1) * linha + x - bpp] : 0;
      let v = entrada[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) v += paeth(a, b, c);
      saida[y * linha + x] = v & 0xff;
    }
  }

  const alfa = new Uint8Array(largura * altura);
  for (let p = 0; p < largura * altura; p++) alfa[p] = saida[p * 2 + 1];
  return { largura, altura, alfa };
}

/** O que o Android acende. Meio-tom conta como marca. */
const OPACO = 128;

/** Cobertura, caixa da marca, margens e traços por linha — tudo de uma vez. */
function formaDaMarca() {
  const { largura, altura, alfa } = alfaDoBadge();
  let opacos = 0;
  let minX = largura;
  let maxX = -1;
  let minY = altura;
  let maxY = -1;
  let linhasComDoisTracos = 0;

  for (let y = 0; y < altura; y++) {
    let tracos = 0;
    let dentro = false;
    for (let x = 0; x < largura; x++) {
      const aceso = alfa[y * largura + x] >= OPACO;
      if (aceso) {
        opacos++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (aceso && !dentro) tracos++;
      dentro = aceso;
    }
    if (tracos >= 2) linhasComDoisTracos++;
  }

  const caixa = { largura: maxX - minX + 1, altura: maxY - minY + 1 };
  return {
    cobertura: opacos / (largura * altura),
    preenchimentoDaCaixa: opacos / (caixa.largura * caixa.altura),
    margem: Math.min(minX, largura - 1 - maxX, minY, altura - 1 - maxY),
    linhasComDoisTracos,
  };
}

describe("o badge da notificação", () => {
  it("é declarado no sw.js e o arquivo existe", () => {
    expect(bytesDoBadge().length).toBeGreaterThan(0);
  });

  /**
   * **O caso que reprova a regressão.** Apontar o `badge` para `icon-192.png`
   * ou `icon-maskable-192.png` — os dois RGBA, tipo 6 — deixa este teste
   * vermelho.
   */
  it("não tem cor: PNG tipo 4 (cinza + alfa)", () => {
    expect(cabecalhoPng(bytesDoBadge()).tipoDeCor).toBe(4);
  });

  /**
   * 96×96 é o tamanho que o Android espera para `badge` (ele renderiza a
   * ~24dp). Maior desperdiça bytes na primeira notificação; menor chega
   * borrado.
   */
  it("tem 96×96", () => {
    const { largura, altura } = cabecalhoPng(bytesDoBadge());
    expect([largura, altura]).toEqual([96, 96]);
  });

  /**
   * **A marca tem de OCUPAR o quadro, sem encostar nele.** Medido no badge
   * atual: **24,0%** de cobertura e margem de **10px**. Abaixo de 20% o ícone
   * some na bandeja; acima de 45% vira borrão no tamanho em que ele aparece.
   */
  it("cobre entre 20% e 45% do quadro, com margem de pelo menos 8px", () => {
    const { cobertura, margem } = formaDaMarca();
    expect(cobertura).toBeGreaterThanOrEqual(0.2);
    expect(cobertura).toBeLessThanOrEqual(0.45);
    expect(margem).toBeGreaterThanOrEqual(8);
  });

  /**
   * **O caso que existe para reprovar um DISCO, e é o motivo deste arquivo ter
   * crescido.**
   *
   * Um disco — ou qualquer mancha convexa — tem **exatamente um traço aceso
   * por linha**, sempre. A marca CK tem duas letras separadas, então muitas
   * linhas têm dois ou três. Medido no badge atual: **47 linhas** com dois ou
   * mais traços, e um máximo de três.
   *
   * O limiar é 10 porque 47 é o medido e zero é o de um disco: qualquer valor
   * no meio separa os dois casos com folga, sem fingir precisão que a medição
   * não tem.
   *
   * O preenchimento da caixa é o segundo discriminador, independente do
   * primeiro: um disco inscrito enche **π/4 ≈ 78,5%** da própria caixa; o CK
   * enche **61,1%**.
   */
  it("NÃO é um disco: a marca tem traços separados", () => {
    const { linhasComDoisTracos, preenchimentoDaCaixa } = formaDaMarca();
    expect(linhasComDoisTracos).toBeGreaterThanOrEqual(10);
    expect(preenchimentoDaCaixa).toBeLessThan(0.7);
  });

  /**
   * **E os ícones de verdade continuam sendo coloridos** — o teste acima não
   * pode ter passado porque alguém trocou todos os PNGs por cinza.
   */
  it("o ícone do app, esse SIM tem cor", () => {
    const bytes = readFileSync(arquivo("icon-192.png"));
    expect(cabecalhoPng(bytes).tipoDeCor).not.toBe(4);
  });
});
