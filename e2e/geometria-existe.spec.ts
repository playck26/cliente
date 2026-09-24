/**
 * SPEC-072/AC-005 — **o Cliente CONSEGUE provar geometria.**
 *
 * *"Sem esta AC, a AC-006 é um desejo."*
 *
 * Esta prova não é sobre a tela de login: é sobre a **ferramenta**. Ela
 * afirma a única coisa que a suíte de `vitest` + `jsdom` deste repositório
 * **não consegue** afirmar — que existe layout calculado, com pixel de
 * verdade.
 *
 * **O caso do meio é o que dá sentido ao arquivo.** No jsdom,
 * `getBoundingClientRect()` devolve `width: 0, height: 0` para **qualquer**
 * elemento, visível ou não, e `scrollWidth` devolve `0` para o documento
 * inteiro. Ou seja: os três casos abaixo, rodados lá, ficariam **vermelhos
 * sem que nada estivesse errado com a tela** — e é exatamente por isso que
 * eles provam que a ferramenta existe e funciona.
 *
 * A largura é **320px**, a normativa da `AC-006`: provar a 390 e quebrar a
 * 320 seria provar a tela errada.
 */
import { expect, test } from "@playwright/test";

test.describe("AC-005 — a ferramenta de prova visual existe", () => {
  test("a página sobe, e é a do build de produção", async ({ page }) => {
    const resposta = await page.goto("/login");

    expect(resposta?.status()).toBe(200);
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  });

  /**
   * **O caso que o jsdom reprovaria.** Nada aqui é sobre o login em si: é a
   * afirmação de que o número medido é um número de verdade.
   */
  test("os campos têm CAIXA — largura e altura maiores que zero", async ({
    page,
  }) => {
    await page.goto("/login");

    const email = await page.getByLabel("E-mail", { exact: true }).boundingBox();
    const senha = await page.getByLabel("Senha", { exact: true }).boundingBox();

    expect(email).not.toBeNull();
    expect(senha).not.toBeNull();
    expect(email!.width).toBeGreaterThan(0);
    expect(email!.height).toBeGreaterThan(0);
    expect(senha!.width).toBeGreaterThan(0);

    // **E as duas caixas não se sobrepõem.** É a mesma família de asserção
    // que a AC-006 vai usar contra o botão "Marcar": interseção é o defeito
    // que a asserção de texto não enxerga.
    expect(email!.y + email!.height).toBeLessThanOrEqual(senha!.y + 0.5);
  });

  /**
   * **Sem rolagem horizontal a 320px.** O `documentElement.scrollWidth` é
   * zero no jsdom — aqui ele é o número real, e é o que denuncia conteúdo
   * que estoura a largura da tela.
   */
  test("a 320px não há rolagem horizontal", async ({ page }) => {
    await page.goto("/login");

    const medida = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));

    expect(medida.janela).toBe(320);
    expect(medida.scroll).toBeGreaterThan(0);
    // Um pixel de folga: arredondamento de sub-pixel é ruído, não defeito.
    expect(medida.scroll).toBeLessThanOrEqual(medida.janela + 1);
  });
});
