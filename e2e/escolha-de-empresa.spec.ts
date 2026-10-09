import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * SPEC-086/AC-016 — **a tela de escolha do clube, no navegador.**
 *
 * O roteiro da spec, automatizado: em 360 px e em desktop, sobre o login
 * fotográfico de verdade (SPEC-084), três clubes — um com logo, um com nome de
 * 40 caracteres e sem logo, e um com a senha temporária vencida. Confere:
 * nenhum nome cortado e nenhuma rolagem lateral; o cartão vencido sem botão;
 * só o teclado (Tab/Enter) chegando à escolha, com foco visível; e os estados
 * de carregando e de erro. As capturas vão para o `CLI_AUDIT.md`.
 *
 * A rede é toda simulada, e os service workers ficam bloqueados (o
 * `page.route` não vê o que o `sw.js` intercepta — medido na SPEC-084).
 */

test.use({ serviceWorkers: "block" });

const NOME_LONGO = "Associação de Tênis do Vale Verde Clube"; // 40 caracteres
const LOGO = "https://cdn.exemplo.test/logo-smart.svg";

const ESCOLHA = {
  statusCode: 409,
  code: "ESCOLHA_DE_EMPRESA",
  message: "Este e-mail tem acesso a mais de uma empresa. Entre pelo app do aluno para escolher.",
  escolha: {
    token: "token-de-escolha",
    empresas: [
      { usuarioId: "00000000-0000-4000-8000-00000000000a", empresaNome: "Smart Tennis", logoUrl: LOGO, papel: "aluno", situacao: "disponivel" },
      { usuarioId: "00000000-0000-4000-8000-00000000000b", empresaNome: NOME_LONGO, logoUrl: null, papel: "professor", situacao: "disponivel" },
      { usuarioId: "00000000-0000-4000-8000-00000000000c", empresaNome: "Clube Antigo", logoUrl: null, papel: "aluno", situacao: "senha_expirada" },
    ],
  },
};

type Escolher = "segura" | "erro";

async function simular(page: Page, escolher: Escolher) {
  const pedidos: unknown[] = [];
  let soltar!: () => void;
  const solta = new Promise<void>((r) => (soltar = r));

  await page.route(LOGO, (rota) =>
    rota.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#0B6E4F"/><text x="20" y="26" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif">ST</text></svg>',
    }),
  );
  await page.route("**/api/v1/**", async (rota: Route) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho === "/api/v1/auth/login") {
      await rota.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify(ESCOLHA) });
      return;
    }
    if (caminho === "/api/v1/auth/login/escolher") {
      pedidos.push(rota.request().postDataJSON());
      if (escolher === "erro") {
        await rota.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ statusCode: 401, code: "ESCOLHA_EXPIRADA", message: "A escolha de empresa expirou. Entre de novo." }),
        });
        return;
      }
      await solta;
      await rota.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return;
    }
    await rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  return { pedidos, soltar };
}

async function chegarNaEscolha(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("mesmo@exemplo.test");
  await page.getByLabel("Senha", { exact: true }).fill("senha-valida-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Em qual clube você quer entrar?" })).toBeVisible();
}

async function semRolagemLateral(page: Page) {
  const { rolagem, janela } = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(rolagem).toBeLessThanOrEqual(janela);
}

for (const tela of [
  { nome: "360", viewport: { width: 360, height: 780 } },
  { nome: "desktop", viewport: { width: 1280, height: 860 } },
]) {
  test.describe(`AC-016 — ${tela.nome}`, () => {
    test.use({ viewport: tela.viewport });

    test("três clubes: nada cortado, nada de rolagem lateral, vencido sem botão", async ({ page }) => {
      await simular(page, "segura");
      await chegarNaEscolha(page);

      const longo = page.getByText(NOME_LONGO);
      await expect(longo).toBeVisible();
      // O nome inteiro cabe na caixa dele: quebra, não corta.
      const corte = await longo.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(corte).toBeLessThanOrEqual(0);
      await semRolagemLateral(page);

      // O logo é decorativo (o nome já está no rótulo do botão): mora num
      // `aria-hidden`, por isso a busca é pelo `src`, e não pelo papel `img`.
      const logo = page.locator(`img[src="${LOGO}"]`);
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(page.getByText("Senha expirada — peça uma nova ao gestor.")).toBeVisible();
      await expect(page.getByRole("button", { name: /Clube Antigo/ })).toHaveCount(0);

      await page.screenshot({ path: `test-results/spec086-escolha-${tela.nome}.png`, fullPage: true });
    });

    test("só teclado: Tab chega ao clube com foco visível; Enter escolhe; carregando", async ({ page }) => {
      const { pedidos, soltar } = await simular(page, "segura");
      await chegarNaEscolha(page);

      const primeiro = page.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" });
      for (let i = 0; i < 6; i++) {
        if (await primeiro.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(primeiro).toBeFocused();
      const anel = await primeiro.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(anel).not.toBe("none");
      await page.screenshot({ path: `test-results/spec086-foco-${tela.nome}.png` });

      await page.keyboard.press("Enter");
      await expect(primeiro).toBeDisabled();
      await expect(page.getByText("Entrando...")).toBeVisible();
      expect(pedidos).toEqual([{ token: "token-de-escolha", usuarioId: "00000000-0000-4000-8000-00000000000a" }]);
      await page.screenshot({ path: `test-results/spec086-carregando-${tela.nome}.png` });
      soltar();
    });

    test("erro na escolha: volta ao formulário com a mensagem e o e-mail", async ({ page }) => {
      await simular(page, "erro");
      await chegarNaEscolha(page);
      await page.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" }).click();

      // O Next tem um anunciador de rota com `role="alert"`; o do erro é o que
      // traz o texto.
      await expect(
        page.getByRole("alert").filter({ hasText: "A escolha de empresa expirou" }),
      ).toHaveText("A escolha de empresa expirou. Entre de novo.");
      await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("mesmo@exemplo.test");
      await semRolagemLateral(page);
      await page.screenshot({ path: `test-results/spec086-erro-${tela.nome}.png`, fullPage: true });
    });
  });
}
