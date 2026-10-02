import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { LOGIN_APOS_ATIVACAO } from "../src/lib/ativacao-navigation";

/**
 * SPEC-084/TEST-006 — **o convite de instalação fora do login (I1, AC-009).**
 *
 * Cada modo é provado em PAR: nada no `/login`, e o convite aparecendo na
 * home logo depois de entrar, por navegação do cliente, no mesmo documento.
 * Só a ausência no login não provaria nada: um convite quebrado também estaria
 * ausente. É a presença na home que mostra que esconder não foi dispensar,
 * consumir o evento nem desligar o convite.
 *
 * Roda no Chromium (projeto padrão) e, com `PLAYCK_WEBKIT=1`, também no WebKit
 * com perfil de iPhone (projeto `webkit-iphone` do `playwright.config.ts`). O
 * CI só instala o Chromium; o WebKit é prova local, registrada na EVD-084-006.
 * Nenhum dos dois é aparelho real.
 */

const EVIDENCIAS = join(__dirname, "..", "test-results", "spec-084", "instalacao");
mkdirSync(EVIDENCIAS, { recursive: true });

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const CHAVE_DISPENSA = "playck_instalacao_dispensada_em";

/**
 * Sem service worker. A rede aqui é simulada por `page.route`, e no WebKit o
 * Playwright não intercepta o que passa pelo service worker: da segunda visita
 * em diante o `sw.js` já controla a página, o login vai ao servidor de verdade
 * e responde "Não foi possível entrar". Medido na primeira rodada em WebKit —
 * só os casos com duas visitas caíram. O convite não depende do service worker.
 */
test.use({ serviceWorkers: "block" });

type Modo = "botao" | "instrucao" | "instalado" | "dispensado";

async function prepararModo(page: Page, modo: Modo) {
  await page.addInitScript((m: Modo) => {
    const w = window as unknown as Record<string, unknown>;
    if (m === "botao") {
      // O evento que o script do layout guardaria antes da hidratação.
      const e = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(e, {
        prompt: () => {
          w.__promptChamado = true;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      w.__playckEventoDeInstalacao = e;
      w.__eventoOriginal = e;
    }
    if (m === "instalado") {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes("display-mode: standalone")
          ? ({
              matches: true,
              media: q,
              onchange: null,
              addEventListener() {},
              removeEventListener() {},
              addListener() {},
              removeListener() {},
              dispatchEvent: () => false,
            } as unknown as MediaQueryList)
          : original(q);
      Object.defineProperty(navigator, "standalone", { get: () => true, configurable: true });
    }
    if (m === "dispensado") {
      window.localStorage.setItem("playck_instalacao_dispensada_em", String(Date.now()));
    }
  }, modo);

  await page.route("**/api/v1/**", async (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho === "/api/v1/auth/login") {
      await rota.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "token-de-e2e",
          refreshToken: "refresh-de-e2e",
          usuario: { id: "u1", nome: "Aluno", email: "a@b.com", role: "aluno", companyId: "c1", senhaTemporaria: false },
        }),
      });
      return;
    }
    await rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

const convite = (page: Page) => page.getByRole("region", { name: "Instalar o PlayCK" });

async function esperarHidratacao(page: Page) {
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByRole("button", { name: "Ocultar senha" })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar senha" }).click();
}

/** No login: nada de convite em nenhum momento, e os controles livres. */
async function conferirLogin(page: Page, modo: Modo) {
  await esperarHidratacao(page);
  await page.waitForTimeout(500);
  await expect(convite(page)).toHaveCount(0);

  await page.getByLabel("E-mail", { exact: true }).focus();
  await expect(convite(page)).toHaveCount(0);
  await page.getByLabel("Senha", { exact: true }).focus();
  await expect(convite(page)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(convite(page)).toHaveCount(0);

  for (const alvo of [
    page.getByRole("button", { name: "Entrar" }),
    page.getByRole("button", { name: "Esqueceu a senha?" }),
    page.getByRole("link", { name: "Cadastre-se" }),
  ]) {
    await alvo.evaluate((el) => el.scrollIntoView({ block: "center" }));
    expect(
      await alvo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!topo && (topo === el || el.contains(topo));
      }),
    ).toBe(true);
  }

  const estado = await page.evaluate((chave) => {
    const w = window as unknown as Record<string, unknown>;
    return {
      dispensa: window.localStorage.getItem(chave),
      promptChamado: w.__promptChamado === true,
      mesmoEvento: w.__eventoOriginal === undefined || w.__playckEventoDeInstalacao === w.__eventoOriginal,
    };
  }, CHAVE_DISPENSA);
  expect(estado.promptChamado).toBe(false);
  expect(estado.mesmoEvento).toBe(true);
  if (modo !== "dispensado") expect(estado.dispensa).toBeNull();
}

/** Entra, e a home abre pelo roteador — no MESMO documento. */
async function entrarPelaHome(page: Page) {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__mesmoDocumento = true;
  });
  await page.getByLabel("E-mail", { exact: true }).fill("a@b.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-secreta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/home");
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__mesmoDocumento === true),
    "a home tem de abrir por navegação do cliente, não por carga inteira",
  ).toBe(true);
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  const nome = `${viewport.width}x${viewport.height}`;

  test.describe(`AC-009 — ${nome}`, () => {
    test.use({ viewport });

    test("Chromium com evento guardado (botão): nada no login; botão Instalar na home", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "beforeinstallprompt é do Chromium");
      await prepararModo(page, "botao");
      await page.goto(LOGIN_APOS_ATIVACAO);
      await conferirLogin(page, "botao");
      await page.goto("/login");
      await conferirLogin(page, "botao");
      await page.screenshot({ path: join(EVIDENCIAS, `${nome}-${browserName}-botao-login.png`) });
      await entrarPelaHome(page);
      await expect(page.getByRole("button", { name: "Instalar" })).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__promptChamado === true)).toBe(false);
      await page.screenshot({ path: join(EVIDENCIAS, `${nome}-${browserName}-botao-home.png`) });
    });

    test.describe("iPhone (instrução)", () => {
      test.use({ userAgent: IPHONE_UA });

      test("iPhone sem dispensa: nada no login; instrução na home", async ({ page, browserName }) => {
        await prepararModo(page, "instrucao");
        await page.goto(LOGIN_APOS_ATIVACAO);
        await conferirLogin(page, "instrucao");
        await page.goto("/login");
        await conferirLogin(page, "instrucao");
        await page.screenshot({ path: join(EVIDENCIAS, `${nome}-${browserName}-instrucao-login.png`) });
        await entrarPelaHome(page);
        await expect(convite(page)).toBeVisible();
        await expect(convite(page).getByText("Compartilhar")).toBeVisible();
        await page.screenshot({ path: join(EVIDENCIAS, `${nome}-${browserName}-instrucao-home.png`) });
      });

      for (const modo of ["instalado", "dispensado"] as const) {
        test(`${modo}: nada no login, e nada na home`, async ({ page }) => {
          await prepararModo(page, modo);
          await page.goto("/login");
          await conferirLogin(page, modo);
          await entrarPelaHome(page);
          await page.waitForTimeout(800);
          await expect(convite(page)).toHaveCount(0);
        });
      }
    });
  });
}
