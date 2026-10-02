import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { LOGIN_APOS_ATIVACAO } from "../src/lib/ativacao-navigation";
import { FUNDO_DO_LOGIN } from "../src/lib/login-appearance";
import {
  medirFaixas,
  medirTextos,
  type ResultadoDeFaixa,
  type ResultadoDeTexto,
} from "./helpers/login-contrast";

/**
 * SPEC-084/TEST-002 — **a composição, a geometria e o contraste do login.**
 *
 * Tudo aqui é medido no navegador, sobre o build de produção: o jsdom não tem
 * layout nem pixel (ver o cabeçalho do `playwright.config.ts`).
 *
 * As evidências (capturas e a tabela de contraste) vão para
 * `test-results/spec-084/`, e de lá para a pasta da spec (EVD-084-002).
 */

const EVIDENCIAS = join(__dirname, "..", "test-results", "spec-084");
mkdirSync(join(EVIDENCIAS, "capturas"), { recursive: true });

const MENSAGEM_LONGA =
  "Sua senha temporária venceu. Peça ao seu clube para gerar uma nova senha; ela chega por WhatsApp, e você troca no primeiro acesso.";

const VIEWPORTS = {
  "320x568": { width: 320, height: 568 },
  "390x844": { width: 390, height: 844 },
  "768x1024": { width: 768, height: 1024 },
  "1440x900": { width: 1440, height: 900 },
} as const;

type Fundo = "foto" | "branco" | "preto" | "ausente";
const FUNDOS: Fundo[] = ["foto", "branco", "preto", "ausente"];

/** PNGs sólidos do tamanho da foto, gerados por canvas: nada de arquivo novo. */
const solidos: Partial<Record<"branco" | "preto", Buffer>> = {};

async function gerarSolidos(browser: Browser) {
  if (solidos.branco && solidos.preto) return;
  const pagina = await browser.newPage();
  for (const [nome, cor] of [
    ["branco", "#ffffff"],
    ["preto", "#000000"],
  ] as const) {
    const b64 = await pagina.evaluate(
      ([c, w, h]) => {
        const canvas = document.createElement("canvas");
        canvas.width = w as number;
        canvas.height = h as number;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = c as string;
        ctx.fillRect(0, 0, w as number, h as number);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      [cor, FUNDO_DO_LOGIN.largura, FUNDO_DO_LOGIN.altura] as const,
    );
    solidos[nome] = Buffer.from(b64, "base64");
  }
  await pagina.close();
}

/** Troca a foto pelo fundo pedido, no caminho configurado. */
async function usarFundo(page: Page, fundo: Fundo) {
  if (fundo === "foto") return;
  await page.route(`**${FUNDO_DO_LOGIN.src}`, async (rota) => {
    if (fundo === "ausente") return rota.abort("failed");
    await rota.fulfill({ status: 200, contentType: "image/png", body: solidos[fundo] });
  });
}

/** A foto terminou (carregou ou falhou) e as fontes também. */
async function esperarPintura(page: Page) {
  await page
    .locator("[data-camada-da-foto] img")
    .evaluate((img: HTMLImageElement) =>
      img.complete
        ? null
        : new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
          }),
    );
  // `load` não basta: a imagem pode ter chegado e ainda não ter sido
  // decodificada e pintada — e aí a medida "sobre a foto" mediria o fundo
  // liso. Foi o que uma captura feita só com `load` mostrou em 2026-10-02.
  await page
    .locator("[data-camada-da-foto] img")
    .evaluate((img: HTMLImageElement) => (img.naturalWidth ? img.decode().catch(() => undefined) : undefined));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/** Espera a hidratação: o olho só alterna depois dela. */
async function esperarHidratacao(page: Page) {
  const olho = page.getByRole("button", { name: "Mostrar senha" });
  await olho.click();
  await expect(page.getByRole("button", { name: "Ocultar senha" })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
}

/** Rede simulada: só o login, com a resposta que o caso pedir. */
async function simularLogin(page: Page, resposta: "erro" | "pendente") {
  await page.route("**/api/v1/**", async (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho === "/api/v1/auth/login") {
      if (resposta === "pendente") return; // nunca responde: fica "Entrando..."
      await rota.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: MENSAGEM_LONGA, code: "SENHA_TEMPORARIA_EXPIRADA" }),
      });
      return;
    }
    await rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

type Estado = "normal" | "preenchido" | "ajuda" | "erro" | "carregando" | "aviso";
const ESTADOS: Estado[] = ["normal", "preenchido", "ajuda", "erro", "carregando", "aviso"];

async function prepararEstado(page: Page, estado: Estado) {
  if (estado === "erro") await simularLogin(page, "erro");
  if (estado === "carregando") await simularLogin(page, "pendente");
  await page.goto(estado === "aviso" ? LOGIN_APOS_ATIVACAO : "/login");
  await esperarPintura(page);
  await esperarHidratacao(page);

  const email = page.getByLabel("E-mail", { exact: true });
  const senha = page.getByLabel("Senha", { exact: true });
  if (estado === "preenchido" || estado === "erro" || estado === "carregando") {
    await email.fill("aluno.com.nome.comprido@clube-de-tenis.com.br");
    await senha.fill("senha-secreta");
  }
  if (estado === "ajuda") await page.getByRole("button", { name: "Esqueceu a senha?" }).click();
  if (estado === "erro") {
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(MENSAGEM_LONGA);
  }
  if (estado === "carregando") {
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("button", { name: "Entrando..." })).toBeDisabled();
  }
  if (estado === "aviso") {
    await expect(page.locator("main").getByRole("status")).toHaveText("Conta ativada. Entre com seu e-mail e senha.");
  }
  // Tira o foco de qualquer controle: o estado "foco" é medido à parte.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

function alvosDeTexto(page: Page, estado: Estado) {
  const main = page.locator("main");
  const alvos = [
    { rotulo: "marca", alvo: main.locator("p", { hasText: "Play" }).first() },
    { rotulo: "selo", alvo: page.getByText("SEU ESPORTE, SEU MOMENTO") },
    { rotulo: "título", alvo: page.getByRole("heading", { level: 1 }) },
    { rotulo: "apoio", alvo: page.getByText("Reserve sua quadra", { exact: false }) },
    { rotulo: "rótulo e-mail", alvo: main.locator("label[for=email]") },
    { rotulo: "rótulo senha", alvo: main.locator("label[for=senha]") },
    { rotulo: "campo e-mail", alvo: page.getByLabel("E-mail", { exact: true }) },
    { rotulo: "campo senha", alvo: page.getByLabel("Senha", { exact: true }) },
    { rotulo: "esqueceu a senha", alvo: page.getByRole("button", { name: "Esqueceu a senha?" }) },
    { rotulo: "botão", alvo: main.locator("button[type=submit]") },
  ];
  if (estado === "ajuda") alvos.push({ rotulo: "ajuda", alvo: page.getByText("Ainda não enviamos", { exact: false }) });
  if (estado === "erro") alvos.push({ rotulo: "erro", alvo: page.locator("main").getByRole("alert") });
  if (estado === "aviso") alvos.push({ rotulo: "aviso", alvo: page.locator("main").getByRole("status") });
  return alvos;
}

/**
 * Cada teste grava o PRÓPRIO arquivo de resultados. Uma tabela em memória
 * somada no fim se perde: o Playwright reinicia o worker a cada falha, e a
 * primeira rodada desta matriz terminou com 28 de centenas de medidas.
 * Um script junta os arquivos numa tabela só (EVD-084-002).
 */
const PASTA_DE_CONTRASTE = join(EVIDENCIAS, "contraste");
mkdirSync(PASTA_DE_CONTRASTE, { recursive: true });

function gravarMedidas(
  arquivo: string,
  dados: { textos?: ResultadoDeTexto[]; faixas?: ResultadoDeFaixa[]; viewport: string; fundo: Fundo; estado: string },
) {
  writeFileSync(join(PASTA_DE_CONTRASTE, `${arquivo}.json`), JSON.stringify(dados, null, 2));
}

// ---------------------------------------------------------------------------
// O medidor, provado no navegador antes de medir o login
// ---------------------------------------------------------------------------

test.describe("TEST-002 — autoteste do medidor no navegador", () => {
  test.use({ viewport: { width: 390, height: 300 } });

  test("esconder os glifos é o que separa um texto perfeito de um reprovado", async ({ page }) => {
    await page.setContent(
      `<body style="margin:0;background:#000"><p id="t" style="margin:40px;font:700 32px sans-serif;color:#fff">Texto branco sobre preto</p>
       <p id="u" style="margin:40px;font:16px sans-serif;color:#fff;background:#fff">Branco sobre branco</p></body>`,
    );
    const t = page.locator("#t");
    const [escondido] = await medirTextos(page, [{ rotulo: "t", alvo: t }]);
    const [semEsconder] = await medirTextos(page, [{ rotulo: "t", alvo: t }], { ocultarGlifos: false });
    expect(escondido.razao).toBeGreaterThan(20);
    expect(escondido.passou).toBe(true);
    // Sem esconder, as letras brancas entram como "fundo" e a medida desaba.
    expect(semEsconder.razao).toBeLessThan(4.5);
    expect(semEsconder.passou).toBe(false);

    const [branco] = await medirTextos(page, [{ rotulo: "u", alvo: page.locator("#u") }]);
    expect(branco.razao).toBeCloseTo(1, 1);
    expect(branco.passou).toBe(false);
  });

  test("texto com filtro é inconclusivo, nunca aprovado", async ({ page }) => {
    await page.setContent(
      `<body style="margin:0;background:#000"><p id="f" style="margin:40px;color:#fff;filter:blur(0.5px)">Com filtro</p></body>`,
    );
    const [r] = await medirTextos(page, [{ rotulo: "f", alvo: page.locator("#f") }]);
    expect(r.inconclusivo).toMatch(/filter/);
    expect(r.passou).toBe(false);
  });

  test("borda medida contra os dois vizinhos: visível passa, apagada reprova", async ({ page }) => {
    await page.setContent(
      `<body style="margin:0;background:#141414">
        <div id="boa" style="margin:40px;width:200px;height:52px;border:1px solid #9a9a9a;background:#282828"></div>
        <div id="ruim" style="margin:40px;width:200px;height:52px;border:1px solid #2a2a2a;background:#202020"></div></body>`,
    );
    const [boa, ruim] = await medirFaixas(page, [
      { rotulo: "boa", alvo: page.locator("#boa") },
      { rotulo: "ruim", alvo: page.locator("#ruim") },
    ]);
    expect(boa.passou).toBe(true);
    expect(ruim.passou).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-001, AC-002, AC-006 — composição e geometria nos quatro viewports
// ---------------------------------------------------------------------------

for (const [nome, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`AC-001/AC-006 — ${nome}`, () => {
    test.use({ viewport, deviceScaleFactor: 1 });

    test("composição: coluna, foto, sem rolagem lateral, campos de 16 px, alvos de 44 px", async ({ page }) => {
      await page.goto("/login");
      await esperarPintura(page);
      await esperarHidratacao(page);

      const medidas = await page.evaluate((natural) => {
        const coluna = document.querySelector("[data-coluna-do-login]")!.getBoundingClientRect();
        const camada = document.querySelector("[data-camada-da-foto]")!.getBoundingClientRect();
        const img = document.querySelector("[data-camada-da-foto] img") as HTMLImageElement;
        const caixa = img.getBoundingClientRect();
        const escala = Math.max(caixa.width / natural.largura, caixa.height / natural.altura);
        const sol = {
          x: caixa.left + (caixa.width - natural.largura * escala) / 2 + 624 * escala,
          y: caixa.top + (caixa.height - natural.altura * escala) / 2 + 411 * escala,
        };
        const cores: string[] = [];
        for (const el of document.querySelectorAll("main *")) {
          cores.push(getComputedStyle(el).backgroundColor);
        }
        return {
          janela: { w: window.innerWidth, h: window.innerHeight },
          rolagem: document.documentElement.scrollWidth,
          coluna: { x: coluna.left, w: coluna.width, h: coluna.height },
          camada: { x: camada.left, y: camada.top, w: camada.width, h: camada.height },
          imgCarregou: img.complete && img.naturalWidth === natural.largura,
          escala,
          sol,
          fundoDaPagina: getComputedStyle(document.querySelector("main")!).backgroundColor,
          appScreen: !!document.querySelector("main.app-screen, main .app-screen"),
          cores,
          fonteDosCampos: [...document.querySelectorAll("main input")].map(
            (i) => parseFloat(getComputedStyle(i).fontSize),
          ),
        };
      }, { largura: FUNDO_DO_LOGIN.largura, altura: FUNDO_DO_LOGIN.altura });

      // Sem rolagem lateral (AC-006).
      expect(medidas.rolagem).toBeLessThanOrEqual(medidas.janela.w + 1);
      // A coluna (I3): no máximo 480 px, centralizada.
      expect(medidas.coluna.w).toBeLessThanOrEqual(480.5);
      expect(Math.abs(medidas.coluna.x + medidas.coluna.w / 2 - medidas.janela.w / 2)).toBeLessThanOrEqual(1);
      // A foto ocupa a coluna inteira, carregou, e é a configurada.
      expect(medidas.imgCarregou).toBe(true);
      expect(medidas.camada.w).toBeCloseTo(medidas.coluna.w, 0);
      expect(medidas.camada.h).toBeGreaterThanOrEqual(medidas.janela.h - 1);
      // Fora da coluna: o fundo da configuração.
      expect(medidas.fundoDaPagina).toBe("rgb(8, 13, 16)");
      // Sem app-screen, sem hero verde e sem cartão branco.
      expect(medidas.appScreen).toBe(false);
      expect(medidas.cores).not.toContain("rgb(255, 255, 255)");
      expect(medidas.cores).not.toContain("rgb(0, 118, 58)");
      // Campos a 16 px ou mais: abaixo disso o iPhone dá zoom no foco.
      expect(medidas.fonteDosCampos).toHaveLength(2);
      for (const f of medidas.fonteDosCampos) expect(f).toBeGreaterThanOrEqual(16);

      if (viewport.width >= 768) {
        // I3: a foto vertical não amplia e o sol continua na tela.
        expect(medidas.escala).toBeLessThanOrEqual(1);
        expect(medidas.sol.x).toBeGreaterThanOrEqual(medidas.camada.x);
        expect(medidas.sol.x).toBeLessThanOrEqual(medidas.camada.x + medidas.camada.w);
        expect(medidas.sol.y).toBeGreaterThanOrEqual(0);
        expect(medidas.sol.y).toBeLessThanOrEqual(medidas.janela.h);
        // E o lado de fora da coluna é a cor da configuração, no pixel.
        const png = await page.screenshot();
        const lado = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return [...ctx.getImageData(5, Math.floor(c.height / 2), 1, 1).data].slice(0, 3);
        }, png.toString("base64"));
        expect(lado).toEqual([8, 13, 16]);
      }

      // Alvos interativos de 44×44 ou mais (NFR-001).
      for (const alvo of [
        page.getByLabel("E-mail", { exact: true }),
        page.getByLabel("Senha", { exact: true }),
        page.getByRole("button", { name: "Mostrar senha" }),
        page.getByRole("button", { name: "Esqueceu a senha?" }),
        page.getByRole("button", { name: "Entrar" }),
      ]) {
        const caixa = (await alvo.boundingBox())!;
        expect(caixa.width, await alvo.evaluate((e) => e.outerHTML.slice(0, 60))).toBeGreaterThanOrEqual(44);
        expect(caixa.height).toBeGreaterThanOrEqual(44);
      }

      // Rótulos visíveis, e não só placeholder.
      for (const rotulo of ["label[for=email]", "label[for=senha]"]) {
        await expect(page.locator(rotulo)).toBeVisible();
        expect((await page.locator(rotulo).boundingBox())!.height).toBeGreaterThan(10);
      }

      // Campos e botão alcançáveis por rolagem: no centro de cada um está ele mesmo.
      for (const alvo of [
        page.getByLabel("E-mail", { exact: true }),
        page.getByLabel("Senha", { exact: true }),
        page.getByRole("button", { name: "Entrar" }),
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

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(EVIDENCIAS, "capturas", `${nome}-normal-foto.png`), fullPage: true });
    });
  });
}

test.describe("AC-001 — 390×844: raquete e bolas fora dos campos e do botão", () => {
  test.use({ viewport: VIEWPORTS["390x844"], deviceScaleFactor: 1 });

  test("os pontos da raquete e das bolas não caem em input nem em button", async ({ page }) => {
    await page.goto("/login");
    await esperarPintura(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    // Raquete e bolas em coordenadas da FONTE (864×1821). Vêm dos pontos que a
    // R1 mediu em 390×844 — (290,371), (282,423), (334,431) — desfeita a
    // transformação que ela supôs (escala 844/1821, corte lateral de 5,2 px).
    // Aqui eles são levados à tela pela transformação REAL (LIM-084d): se a
    // coluna, o recorte ou a posição mudarem, os pontos mudam junto.
    const FONTE: [number, number][] = [
      [636.9, 800.5],
      [619.6, 912.7],
      [731.8, 929.9],
    ];
    const pontos = await page.evaluate((fonte) => {
      const img = document.querySelector("[data-camada-da-foto] img")!.getBoundingClientRect();
      const s = Math.max(img.width / 864, img.height / 1821);
      const ox = img.left + (img.width - 864 * s) / 2;
      const oy = img.top + (img.height - 1821 * s) / 2;
      return fonte.map(([fx, fy]) => {
        const x = ox + fx * s;
        const y = oy + fy * s;
        const el = document.elementFromPoint(x, y);
        return { x, y, em: el ? el.tagName : null, controle: !!el?.closest("input, button, a") };
      });
    }, FONTE);
    // A transformação real é a que a R1 supôs (±2 px)...
    const esperados = [
      [290, 371],
      [282, 423],
      [334, 431],
    ];
    pontos.forEach((p, i) => {
      expect(Math.abs(p.x - esperados[i][0])).toBeLessThanOrEqual(2);
      expect(Math.abs(p.y - esperados[i][1])).toBeLessThanOrEqual(2);
    });
    // ...e nenhum dos pontos está debaixo de campo, botão ou link.
    for (const p of pontos) expect(p.controle, JSON.stringify(p)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-002 — o texto aprovado na tela de verdade
// ---------------------------------------------------------------------------

test.describe("AC-002 — copy", () => {
  test.use({ viewport: VIEWPORTS["390x844"] });

  test("o texto aprovado está na tela, e o proibido não", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("SEU ESPORTE, SEU MOMENTO")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Mais esporte, mais conexões." })).toBeVisible();
    await expect(
      page.getByText("Reserve sua quadra, acompanhe suas aulas e aproveite cada momento no seu clube."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    // I5: o login não oferece cadastro.
    await expect(page.getByRole("link", { name: /cadastr/i })).toHaveCount(0);
    await expect(page.locator('main a[href^="/cadastro"]')).toHaveCount(0);
    const texto = await page.locator("main").innerText();
    expect(texto).not.toContain("Ainda não tem conta?");
    expect(texto).not.toContain("Gerencie seu clube");
    expect(texto).not.toContain("CLUBES DE TÊNIS");
  });
});

// ---------------------------------------------------------------------------
// NFR-001 — a matriz de contraste: estado × fundo × viewport
// ---------------------------------------------------------------------------

for (const nome of ["320x568", "390x844"] as const) {
  for (const fundo of FUNDOS) {
    test.describe(`NFR-001 — contraste, ${nome}, fundo ${fundo}`, () => {
      test.use({ viewport: VIEWPORTS[nome], deviceScaleFactor: 1 });

      test.beforeEach(async ({ browser, page }) => {
        await gerarSolidos(browser);
        await usarFundo(page, fundo);
      });

      for (const estado of ESTADOS) {
        test(`textos — ${estado}`, async ({ page }) => {
          await prepararEstado(page, estado);
          test.setTimeout(90_000);
          const resultados = await medirTextos(page, alvosDeTexto(page, estado));
          expect(resultados.length).toBeGreaterThan(10);
          gravarMedidas(`${nome}-${fundo}-${estado}`, { textos: resultados, viewport: nome, fundo, estado });
          if (fundo === "foto" && nome === "390x844") {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: join(EVIDENCIAS, "capturas", `${nome}-${estado}-foto.png`), fullPage: true });
          }
          const ruins = resultados.filter((r) => !r.passou);
          expect(ruins, JSON.stringify(ruins, null, 1)).toEqual([]);
        });
      }

      test("bordas dos campos e anéis de foco", async ({ page }) => {
        test.setTimeout(180_000);
        await prepararEstado(page, "preenchido");
        const bordas = await medirFaixas(page, [
          { rotulo: "borda e-mail", alvo: page.getByLabel("E-mail", { exact: true }) },
          { rotulo: "borda senha", alvo: page.getByLabel("Senha", { exact: true }) },
        ]);

        // Foco por TECLADO, na ordem natural (AC-007): é o que liga o
        // `:focus-visible` dos botões.
        const ordem = [
          { rotulo: "foco e-mail", alvo: page.getByLabel("E-mail", { exact: true }) },
          { rotulo: "foco senha", alvo: page.getByLabel("Senha", { exact: true }) },
          { rotulo: "foco olho", alvo: page.getByRole("button", { name: "Mostrar senha" }) },
          { rotulo: "foco esqueceu", alvo: page.getByRole("button", { name: "Esqueceu a senha?" }) },
          { rotulo: "foco botão", alvo: page.getByRole("button", { name: "Entrar" }) },
        ];
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("body").click({ position: { x: 1, y: 1 } });
        const aneis: ResultadoDeFaixa[] = [];
        for (const { rotulo, alvo } of ordem) {
          await page.keyboard.press("Tab");
          await expect(alvo).toBeFocused();
          await alvo.evaluate((el) => el.scrollIntoView({ block: "center" }));
          const [anel] = await medirFaixas(page, [{ rotulo, alvo }]);
          aneis.push(anel);
        }
        gravarMedidas(`${nome}-${fundo}-bordas-e-foco`, { faixas: [...bordas, ...aneis], viewport: nome, fundo, estado: "foco" });
        const ruins = [...bordas, ...aneis].filter((r) => !r.passou);
        expect(ruins, JSON.stringify(ruins, null, 1)).toEqual([]);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// AC-007 — a foto bloqueada não leva o formulário junto
// ---------------------------------------------------------------------------

test.describe("AC-007 — foto bloqueada, leitores de tela, ordem e anúncio", () => {
  test.use({ viewport: VIEWPORTS["390x844"] });

  test("sem a foto: fundo escuro, e o formulário entra de verdade", async ({ page }) => {
    await usarFundo(page, "ausente");
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
    await page.goto("/login");
    await esperarPintura(page);
    await esperarHidratacao(page);
    expect(
      await page.locator("[data-camada-da-foto] img").evaluate((i: HTMLImageElement) => i.naturalWidth),
    ).toBe(0);
    await page.screenshot({ path: join(EVIDENCIAS, "capturas", "390x844-normal-ausente.png"), fullPage: true });
    await page.getByLabel("E-mail", { exact: true }).fill("a@b.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-secreta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/home");
  });

  test("a foto não existe para o leitor de tela; campos e olho têm nome; erro é anunciado", async ({ page }) => {
    await simularLogin(page, "erro");
    await page.goto("/login");
    await esperarHidratacao(page);
    // A única imagem com nome é o logo.
    await expect(page.getByRole("img")).toHaveCount(1);
    await expect(page.getByRole("img", { name: "Logo PlayCK" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "E-mail" })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mostrar senha" })).toBeVisible();
    await page.getByLabel("E-mail", { exact: true }).fill("a@b.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-secreta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(MENSAGEM_LONGA);
  });

  test("a ordem de tabulação é a natural", async ({ page }) => {
    await page.goto("/login");
    await esperarHidratacao(page);
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    const nomes: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      nomes.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return el.getAttribute("aria-label") ?? el.id ?? "";
        }) || (await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim())),
      );
    }
    expect(nomes).toEqual(["email", "senha", "Mostrar senha", "Esqueceu a senha?", "Entrar"]);
  });
});

// ---------------------------------------------------------------------------
// AC-006 — zoom e fonte aumentada
// ---------------------------------------------------------------------------

async function nadaCortado(page: Page) {
  return page.evaluate(() => {
    const largura = window.innerWidth;
    const alvos = [
      "h1",
      "main p",
      "label",
      "main button",
      "main a",
      "main [role=alert]",
      "main [role=status]",
    ];
    const cortados: string[] = [];
    for (const sel of alvos) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (!el.offsetParent && sel !== "main [role=status]") continue;
        const r = el.getBoundingClientRect();
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
          cortados.push(`${sel}: rola por dentro`);
        if (r.right > largura + 1 || r.left < -1) cortados.push(`${sel}: sai da tela (${Math.round(r.left)}..${Math.round(r.right)})`);
      }
    }
    return { cortados, rolagem: document.documentElement.scrollWidth, largura };
  });
}

test.describe("AC-006 — zoom de 200% (simulado) e fonte aumentada", () => {
  test.describe("zoom: 1440×900 a 200% = 720×450 com DPR 2", () => {
    test.use({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });

    test("sem corte e sem rolagem lateral; botão alcançável", async ({ page }) => {
      await simularLogin(page, "erro");
      await page.goto("/login");
      await esperarHidratacao(page);
      await page.getByRole("button", { name: "Esqueceu a senha?" }).click();
      await page.getByLabel("E-mail", { exact: true }).fill("a@b.com");
      await page.getByLabel("Senha", { exact: true }).fill("senha-secreta");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      const m = await nadaCortado(page);
      expect(m.cortados).toEqual([]);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura + 1);
      await page.getByRole("button", { name: "Entrar" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Entrar" })).toBeInViewport();
      await page.screenshot({ path: join(EVIDENCIAS, "capturas", "zoom-720x450-dpr2.png"), fullPage: true });
    });
  });

  test.describe("fonte aumentada: html a 200% em 390×844", () => {
    test.use({ viewport: VIEWPORTS["390x844"] });

    test("ajuda, erro e botão continuam visíveis e inteiros", async ({ page }) => {
      await simularLogin(page, "erro");
      await page.goto("/login");
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await esperarHidratacao(page);
      await page.getByRole("button", { name: "Esqueceu a senha?" }).click();
      await page.getByLabel("E-mail", { exact: true }).fill("a@b.com");
      await page.getByLabel("Senha", { exact: true }).fill("senha-secreta");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();

      // O título e os campos cresceram de verdade (rem), não ficaram em px.
      const tamanhos = await page.evaluate(() => ({
        titulo: parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
        campo: parseFloat(getComputedStyle(document.querySelector("main input")!).fontSize),
      }));
      expect(tamanhos.titulo).toBeGreaterThanOrEqual(60);
      expect(tamanhos.campo).toBeGreaterThanOrEqual(32);

      const m = await nadaCortado(page);
      expect(m.cortados).toEqual([]);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura + 1);
      for (const alvo of [
        page.getByText("Ainda não enviamos", { exact: false }),
        page.locator("main").getByRole("alert"),
        page.getByRole("button", { name: "Entrar" }),
      ]) {
        await alvo.scrollIntoViewIfNeeded();
        await expect(alvo).toBeInViewport();
      }
      await page.screenshot({ path: join(EVIDENCIAS, "capturas", "390x844-fonte-200.png"), fullPage: true });
    });
  });
});

// ---------------------------------------------------------------------------
// LIM-084o — os textos do topo dentro da coluna e sob o véu, em 4 viewports
// × fonte 100% e 200%, sobre fundo TODO BRANCO
// ---------------------------------------------------------------------------

/**
 * A validação do delta I5/I6 achou o que esta suíte não olhava: a 320 px com
 * a fonte do sistema a 200%, “PlayCK” passava ~13 px da coluna e o “CK”
 * ficava fora do véu (1,38:1). A prova de fonte aumentada era só a 390. Aqui
 * ficam as oito combinações que o validador mediu por conta própria.
 */
const PASTA_DE_FONTE = join(EVIDENCIAS, "fonte");
mkdirSync(PASTA_DE_FONTE, { recursive: true });

for (const [nome, viewport] of Object.entries(VIEWPORTS)) {
  for (const fonte of [100, 200] as const) {
    test.describe(`LIM-084o — ${nome}, fonte ${fonte}%, fundo branco`, () => {
      test.use({ viewport, deviceScaleFactor: 1 });

      test("marca, selo, título e apoio dentro da coluna e legíveis", async ({ browser, page }) => {
        await gerarSolidos(browser);
        await usarFundo(page, "branco");
        await page.goto("/login");
        if (fonte === 200) await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
        await esperarPintura(page);

        const medida = await page.evaluate(() => {
          const coluna = document.querySelector("[data-coluna-do-login]")!.getBoundingClientRect();
          const fora: string[] = [];
          const andarilho = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
          for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
            if (!no.textContent || !no.textContent.trim()) continue;
            const faixa = document.createRange();
            faixa.selectNodeContents(no);
            for (const r of faixa.getClientRects()) {
              if (r.width > 0 && (r.right > coluna.right + 1 || r.left < coluna.left - 1)) {
                fora.push(`${no.textContent.trim().slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)}`);
              }
            }
          }
          // A palavra da marca inteira: “Play” e “CK” sem quebra no meio e na
          // MESMA linha. Sem isto, um `break-words` que partisse “PlayC/K”
          // passaria nas duas checagens de cima (achado pela sabotagem O1).
          const pecas = [...document.querySelectorAll("main p span")]
            .filter((s) => s.textContent === "Play" || s.textContent === "CK")
            .map((s) => {
              const faixa = document.createRange();
              faixa.selectNodeContents(s);
              const linhas = [...faixa.getClientRects()].filter((r) => r.width > 0);
              return { texto: s.textContent, linhas: linhas.length, topo: Math.round(linhas[0]?.top ?? -1) };
            });
          return { fora, pecas, rolagem: document.documentElement.scrollWidth, largura: window.innerWidth };
        });
        // Nenhum texto passa da coluna, e a página não rola para o lado.
        expect(medida.fora).toEqual([]);
        expect(medida.rolagem).toBeLessThanOrEqual(medida.largura + 1);
        // “PlayCK” é uma palavra só: cada pedaço numa linha, os dois na mesma.
        expect(medida.pecas.map((p) => p.texto)).toEqual(["Play", "CK"]);
        expect(medida.pecas.map((p) => p.linhas)).toEqual([1, 1]);
        expect(Math.abs(medida.pecas[0].topo - medida.pecas[1].topo)).toBeLessThanOrEqual(1);

        const main = page.locator("main");
        const resultados = await medirTextos(page, [
          { rotulo: "marca", alvo: main.locator("p", { hasText: "Play" }).first() },
          { rotulo: "selo", alvo: page.getByText("SEU ESPORTE, SEU MOMENTO") },
          { rotulo: "título", alvo: page.getByRole("heading", { level: 1 }) },
          { rotulo: "apoio", alvo: page.getByText("Reserve sua quadra", { exact: false }) },
        ]);
        expect(resultados.length).toBeGreaterThanOrEqual(6);
        writeFileSync(
          join(PASTA_DE_FONTE, `${nome}-fonte${fonte}.json`),
          JSON.stringify({ viewport: nome, fonte, textos: resultados }, null, 2),
        );
        if (fonte === 200) {
          await page.screenshot({ path: join(EVIDENCIAS, "capturas", `${nome}-fonte-200-branco.png`), fullPage: true });
        }
        const ruins = resultados.filter((r) => !r.passou);
        expect(ruins, JSON.stringify(ruins, null, 1)).toEqual([]);
      });
    });
  }
}
