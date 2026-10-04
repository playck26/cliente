import { expect, test, type Page, type Route } from "@playwright/test";
import { LOGIN_APOS_ATIVACAO } from "../src/lib/ativacao-navigation";

/**
 * SPEC-083 (AC-054, AC-025, AC-055) — **da ativação até o aviso no login REAL.**
 *
 * A SPEC-084 provou o lado do login sozinha (`login-aviso-ativacao.spec.ts`):
 * quem chega por `LOGIN_APOS_ATIVACAO` lê o aviso. A varredura dela pega um
 * emissor que ESCREVA o literal do protocolo. O que nenhuma das duas pega é um
 * emissor que mande para `/login` puro — o aviso não aparece, e todos os
 * testes de cada lado continuam verdes. Este arquivo é a prova cruzada que a
 * coordenação deixou para a 083 (`COORDENACAO-083-084.md`): a pessoa cria a
 * senha em `/ativar/<token>` e cai na página de login de verdade, com o aviso.
 *
 * **O vermelho da S17 é a ausência do aviso**, e não a URL: o caso espera a
 * página de login pronta (o botão "Entrar") e só então confere o aviso. Um
 * destino `/login` sem o parâmetro chega ao login e reprova no aviso.
 *
 * Os service workers ficam bloqueados: com o `sw.js` controlando a página, o
 * `page.route` pode não ver as chamadas (medido no WebKit pela SPEC-084), e a
 * rede aqui é toda simulada.
 */

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd";
const ENDERECO = `/ativar/${TOKEN}`;
const AVISO = "Conta ativada. Entre com seu e-mail e senha.";
const LINK_INVALIDO = "Este link não vale mais. Peça um novo convite ao seu clube.";
const SENHA = "senha-nova-123";

const GONE = {
  status: 410,
  contentType: "application/json",
  body: JSON.stringify({
    statusCode: 410,
    code: "LINK_INVALIDO",
    message: LINK_INVALIDO,
  }),
};

type Envio = "204" | "410" | "rede";

type Registro = { consultas: string[]; envios: unknown[]; outros: string[] };

/**
 * Simula as duas rotas públicas da ativação. Qualquer outra chamada à API
 * responde 404 e fica registrada: o login real não deve pedir nada sozinho.
 */
async function simularApi(page: Page, envio: Envio, consulta: "200" | "410" = "200") {
  const registro: Registro = { consultas: [], envios: [], outros: [] };

  await page.route("**/api/v1/**", async (rota: Route) => {
    const pedido = rota.request();
    const caminho = new URL(pedido.url()).pathname;

    if (pedido.method() === "GET" && caminho === `/api/v1/public/ativacao/${TOKEN}`) {
      registro.consultas.push(caminho);
      if (consulta === "410") {
        await rota.fulfill(GONE);
        return;
      }
      await rota.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ primeiroNome: "Maria", empresa: { nome: "Smart Tennis" } }),
      });
      return;
    }

    if (pedido.method() === "POST" && caminho === "/api/v1/public/ativacao") {
      registro.envios.push(pedido.postDataJSON());
      if (envio === "rede") {
        await rota.abort("failed");
        return;
      }
      if (envio === "410") {
        await rota.fulfill(GONE);
        return;
      }
      await rota.fulfill({ status: 204, body: "" });
      return;
    }

    registro.outros.push(`${pedido.method()} ${caminho}`);
    await rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  return registro;
}

async function criarSenha(page: Page) {
  await expect(
    page.getByText("Olá, Maria. Crie sua senha para entrar no Smart Tennis."),
    // A primeira carga depois do `next start` hidrata devagar nesta máquina.
  ).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Crie uma senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Repita a senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Criar minha senha" }).click();
}

test.describe("AC-054 — da ativação até o aviso no login real", () => {
  test("204: a pessoa cria a senha e cai no login real, com o aviso em role=status", async ({ page }) => {
    const registro = await simularApi(page, "204");
    await page.goto(ENDERECO);

    await criarSenha(page);

    // A página de login de verdade, pronta: o formulário dela, e não um texto
    // qualquer com a mesma frase.
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();

    // O vermelho da S17 é aqui.
    const aviso = page.locator("main").getByRole("status");
    await expect(aviso).toHaveText(AVISO);
    await expect(aviso).toBeVisible();

    // E foi pelo endereço do protocolo, e não por outro que por acaso o mostre.
    const url = new URL(page.url());
    expect(`${url.pathname}${url.search}`).toBe(LOGIN_APOS_ATIVACAO);

    expect(registro.envios).toEqual([{ token: TOKEN, senha: SENHA }]);
    expect(registro.consultas).toHaveLength(1);
    expect(registro.outros).toEqual([]);
  });

  for (const envio of ["410", "rede"] as const) {
    test(`${envio} no envio: a página fica, o texto de erro aparece, e o aviso de sucesso não`, async ({ page }) => {
      const registro = await simularApi(page, envio);
      await page.goto(ENDERECO);

      await criarSenha(page);

      const textoDoErro =
        envio === "410" ? LINK_INVALIDO : "Não foi possível criar sua senha. Tente de novo.";
      await expect(page.locator("main").getByRole("alert")).toHaveText(textoDoErro);

      // Tempo de sobra para uma navegação que não deveria acontecer.
      await page.waitForTimeout(600);
      await expect(page).toHaveURL((url) => url.pathname === ENDERECO);
      await expect(page.getByText(AVISO)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
      expect(registro.envios).toHaveLength(1);
    });
  }
});

test.describe("AC-025 — a página do link, no navegador", () => {
  test("410 ao abrir: o texto da D11 e nenhum campo de senha", async ({ page }) => {
    const registro = await simularApi(page, "204", "410");
    await page.goto(ENDERECO);

    await expect(page.locator("main").getByRole("alert")).toHaveText(LINK_INVALIDO, { timeout: 15_000 });
    await expect(page.getByLabel("Crie uma senha", { exact: true })).toHaveCount(0);
    expect(registro.envios).toEqual([]);
  });

  test("o HTML do servidor declara no-referrer", async ({ request }) => {
    const resposta = await request.get(ENDERECO);
    expect(resposta.status()).toBe(200);
    const html = await resposta.text();
    const meta = html.match(/<meta name="referrer" content="no-referrer"\s*\/?>/);
    expect(meta).not.toBeNull();
    // No <head>, antes de qualquer pedido que a página faça.
    expect(meta!.index!).toBeLessThan(html.indexOf("</head>"));
  });

  test("os pedidos da API saem sem Referer", async ({ page }) => {
    await simularApi(page, "204");
    const referers: (string | undefined)[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/v1/public/ativacao")) {
        referers.push(r.headers()["referer"]);
      }
    });
    await page.goto(ENDERECO);
    await criarSenha(page);
    await expect(page).toHaveURL((url) => url.pathname === "/login");

    expect(referers).toHaveLength(2);
    expect(referers).toEqual([undefined, undefined]);
  });
});

test.describe("AC-055 — o convite de instalação não aparece na tela do link", () => {
  test("com o evento de instalação guardado, a tela do link fica sem convite", async ({ page }) => {
    // O evento que o script do layout guardaria antes da hidratação: sem ele o
    // convite também estaria ausente, e a ausência não provaria nada.
    await page.addInitScript(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(e, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      (window as unknown as Record<string, unknown>).__playckEventoDeInstalacao = e;
    });
    await simularApi(page, "204");
    await page.goto(ENDERECO);

    await expect(page.getByLabel("Crie uma senha", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(page.getByRole("region", { name: "Instalar o PlayCK" })).toHaveCount(0);
    // O evento continua lá: esconder não é consumir.
    expect(
      await page.evaluate(
        () => !!(window as unknown as Record<string, unknown>).__playckEventoDeInstalacao,
      ),
    ).toBe(true);

    // O controle: com o mesmo preparo, numa tela sem barra que não está nas
    // listas, o convite aparece. Sem isto, um convite quebrado também passaria.
    await page.goto("/primeiro-acesso");
    await expect(page.getByRole("region", { name: "Instalar o PlayCK" })).toBeVisible();
  });
});
