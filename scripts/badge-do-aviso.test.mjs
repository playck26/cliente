import { readFileSync } from "node:fs";
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
 * O gate é o **tipo de cor do PNG**, que fica no byte 25 do arquivo. Tipo 4 é
 * *escala de cinza + alfa*, e um PNG colorido **não consegue** ser desse tipo.
 * A regra "o badge não tem cor" deixa de ser conselho e passa a ser estrutura.
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
   * **E os ícones de verdade continuam sendo coloridos** — o teste acima não
   * pode ter passado porque alguém trocou todos os PNGs por cinza.
   */
  it("o ícone do app, esse SIM tem cor", () => {
    const bytes = readFileSync(arquivo("icon-192.png"));
    expect(cabecalhoPng(bytes).tipoDeCor).not.toBe(4);
  });
});
