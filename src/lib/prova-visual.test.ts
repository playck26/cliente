/**
 * SPEC-072/AC-005 — **o gate da própria ferramenta de prova visual.**
 *
 * ## Por que um gate de texto, e por que ele não é ridículo
 *
 * A `AC-005` diz que o Cliente *"tem Playwright, rodando no CI, com ao menos
 * uma prova verde"*, e a sabotagem que a spec declara para ela é **remover o
 * job**. Sem um detector, essa sabotagem **passa**: apagar o job do
 * `ci.yml` deixa a suíte inteira verde, e a `AC-006` — que depende dele —
 * vira desejo de novo, em silêncio.
 *
 * A suíte de `vitest` é o único lugar deste repositório que roda **sempre**,
 * em toda PR, e que pode ler arquivo. O precedente é da casa: `cores.test.ts`
 * e `fuso.test.ts` já são gates que leem o repositório em vez de exercitar
 * um módulo.
 *
 * ## O que ele NÃO prova, declarado
 *
 * - **que o job está VERDE.** Ele prova que existe e que chama o comando
 *   certo; quem julga o resultado é o próprio CI;
 * - **que o job é obrigatório.** O ruleset do `main` exige hoje `build` e
 *   `contrato`, e **não** `navegador` — conferido pela API em 2026-09-24.
 *   Enquanto isso não mudar, um `navegador` vermelho não bloqueia merge, e
 *   essa lacuna fica declarada aqui em vez de suposta resolvida;
 * - **nada sobre a tela.** Geometria é a `AC-006`, e mora em `e2e/`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const configuracao = readFileSync("playwright.config.ts", "utf8");
const pacote = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("AC-005 — a infraestrutura de prova visual não pode sumir em silêncio", () => {
  it("o Playwright é dependência de desenvolvimento deste repositório", () => {
    expect(pacote.devDependencies["@playwright/test"]).toBeDefined();
  });

  it("os dois scripts existem, e o de teste chama o Playwright", () => {
    expect(pacote.scripts["test:navegador"]).toContain("playwright test");
    expect(pacote.scripts["test:navegador:instalar"]).toContain(
      "playwright install",
    );
  });

  /** **A sabotagem declarada na spec é esta**: apagar o job. */
  it("o job `navegador` existe no CI e roda a suíte de navegador", () => {
    expect(ci).toMatch(/^ {2}navegador:$/m);
    expect(ci).toContain("pnpm run test:navegador:instalar");
    expect(ci).toContain("pnpm run test:navegador");
  });

  it("existe ao menos uma prova em `e2e/`", () => {
    const provas = readdirSync("e2e").filter((n) => n.endsWith(".spec.ts"));
    expect(provas.length).toBeGreaterThan(0);
  });

  /**
   * **320 é normativo, não preferência** (`AC-006`). Subir a viewport é a
   * maneira mais fácil de fazer uma prova de layout passar sem consertar o
   * layout — e seria uma sabotagem invisível sem este caso.
   */
  it("a viewport é de 320px, a largura que a AC-006 exige", () => {
    expect(configuracao).toContain("width: 320");
  });

  /**
   * **A fronteira entre as duas suítes.** Se o `include` do vitest voltar ao
   * padrão, ele varre `e2e/` e tenta rodar Playwright dentro do jsdom — o
   * erro aparece como falha de teste, mas a causa fica escondida. Melhor
   * dizer aqui o que se espera.
   */
  it("o vitest não varre `e2e/`, e não perde o resto pelo caminho", () => {
    const vitest = readFileSync("vitest.config.mts", "utf8");
    expect(vitest).toContain('"e2e/**"');
    // **Sem os defaults, `node_modules` voltaria a ser varrido** — e a
    // primeira versão desta fronteira, escrita como `include`, calou 44
    // testes de `scripts/` sem um único vermelho.
    expect(vitest).toContain("...configDefaults.exclude");
    expect(vitest).not.toContain("include:");
  });
});
