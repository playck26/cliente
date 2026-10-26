import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
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
  "360x800": { width: 360, height: 800 },
  "390x844": { width: 390, height: 844 },
  "412x915": { width: 412, height: 915 },
  "768x1024": { width: 768, height: 1024 },
  "1440x900": { width: 1440, height: 900 },
} as const;

/**
 * Os fundos da matriz de contraste (I10, 2026-10-02): a foto CONFIGURADA e a
 * foto ausente (a cor de fallback).
 *
 * Até a I10 a matriz incluía uma foto toda branca e uma toda preta, e cada véu
 * era o mínimo que passava sobre o BRANCO. Isso fazia a foto nunca decidir a
 * legibilidade — e deixava o topo e o pé da tela escuros sobre qualquer foto.
 * O Israel pediu, duas vezes (I6 e I10), menos preto. Sobre o branco o véu já
 * estava no piso: clarear exigia trocar o fundo de referência.
 *
 * A garantia que o branco dava (trocar a foto não estraga a leitura) continua,
 * por outro caminho: a matriz mede SEMPRE a foto de `FUNDO_DO_LOGIN`. Uma foto
 * nova mais clara reprova aqui até os véus serem refeitos.
 */
type Fundo = "foto" | "ausente";

/** Troca a foto pelo fundo pedido, no caminho configurado. */
async function usarFundo(page: Page, fundo: Fundo) {
  if (fundo === "foto") return;
  await page.route(`**${FUNDO_DO_LOGIN.src}`, (rota) => rota.abort("failed"));
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

type Estado = "normal" | "preenchido" | "erro" | "carregando" | "aviso";
// SPEC-090: saiu o estado "ajuda" — "Esqueceu a senha?" virou link para
// /esqueci-senha e não abre mais texto nenhum no login.
const ESTADOS: Estado[] = ["normal", "preenchido", "erro", "carregando", "aviso"];

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
    { rotulo: "esqueceu a senha", alvo: page.getByRole("link", { name: "Esqueceu a senha?" }) },
    { rotulo: "botão", alvo: main.locator("button[type=submit]") },
  ];
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
        page.getByRole("link", { name: "Esqueceu a senha?" }),
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

      // I10: o rótulo mora DENTRO da caixa do campo, acima de onde o texto
      // digitado começa — é o que economiza a linha que ele ocupava em cima.
      for (const [rotulo, campo] of [
        ["label[for=email]", "#email"],
        ["label[for=senha]", "#senha"],
      ]) {
        const r = (await page.locator(rotulo).boundingBox())!;
        const c = (await page.locator(campo).boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(c.x);
        expect(r.y).toBeGreaterThanOrEqual(c.y);
        expect(r.x + r.width).toBeLessThanOrEqual(c.x + c.width);
        const topoDoTexto = await page.locator(campo).evaluate((i) => {
          const s = getComputedStyle(i);
          return i.getBoundingClientRect().top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop);
        });
        expect(r.y + r.height).toBeLessThanOrEqual(topoDoTexto + 0.5);
      }

      // I10: o apoio em exatamente três linhas, em toda largura.
      const linhasDoApoio = await page.getByText("Reserve sua quadra", { exact: false }).evaluate((p) => {
        const faixa = document.createRange();
        faixa.selectNodeContents(p);
        return new Set([...faixa.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
      });
      expect(linhasDoApoio).toBe(3);

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

// ---------------------------------------------------------------------------
// SPEC-088 — a composição medida contra uma REFERÊNCIA, e não por propriedade
// ---------------------------------------------------------------------------
//
// As rodadas R1–R3 da validação e um ataque próprio (11 sabotagens) mostraram
// o mesmo padrão: cada teste que media UMA propriedade (a tag do controle, a
// caixa do texto, o `::before`) era enganado por outra (um `role="button"`, um
// `overflow`, um `::after`, um `filter`). Daqui em diante cada teste compara o
// que está pintado com uma referência construída na própria página:
//
// - equipamentos: a tela inteira contra a tela com SÓ a foto visível;
// - texto do topo: as linhas REAIS do texto (`Range`, que inclui deslocamento e
//   transform), e não a caixa do elemento;
// - marca: a marca na tela inteira contra a marca sozinha sobre a foto, mais o
//   estilo computado dela e dos ancestrais.

/** Esconde tudo o que é pintado na página, menos o que `manter` selecionar. */
async function soIsto(page: Page, manter: string) {
  await page.addStyleTag({
    content: `body * { visibility: hidden !important; } ${manter} { visibility: visible !important; }`,
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Média por canal de um PNG pequeno, decodificado no navegador. */
async function mediaDoRecorte(page: Page, png: Buffer): Promise<[number, number, number]> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k];
    const n = d.length / 4;
    return [s[0] / n, s[1] / n, s[2] / n] as [number, number, number];
  }, png.toString("base64"));
}

test.describe("AC-001 — 390×844: raquete e bolas fora dos campos e do botão", () => {
  test.use({ viewport: VIEWPORTS["390x844"], deviceScaleFactor: 1 });

  test("nada é pintado sobre a raquete e as bolas, além do véu aprovado", async ({ page }) => {
    await page.goto("/login");
    await esperarPintura(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    // Raquete e as duas bolas em coordenadas da FONTE da foto v2 (864×1821),
    // inspecionadas no bitmap (IMP-088-03). Valem para ESTA foto: o teste da
    // foto aprovada (login-appearance.test.ts, AC-088-04) reprova a troca do
    // arquivo sem revisão. Só o estado NORMAL: com o aviso de ajuda aberto o
    // campo de e-mail cobre os três (LIM-088-05, aceita pelo Israel).
    const FONTE: [number, number][] = [
      [408, 1024],
      [457, 1068],
      [549, 1068],
    ];
    const pontos = await page.evaluate(
      ({ fonte, largura, altura }) => {
        const img = document.querySelector("[data-camada-da-foto] img")!.getBoundingClientRect();
        const s = Math.max(img.width / largura, img.height / altura);
        const ox = img.left + (img.width - largura * s) / 2;
        const oy = img.top + (img.height - altura * s) / 2;
        return fonte.map(([fx, fy]) => {
          const x = ox + fx * s;
          const y = oy + fy * s;
          const el = document.elementFromPoint(x, y);
          return { x, y, em: el ? el.tagName : null, clicavel: !!el?.closest("input, button, a, label, select, textarea, [role], [tabindex], [onclick]") };
        });
      },
      { fonte: FONTE, largura: FUNDO_DO_LOGIN.largura, altura: FUNDO_DO_LOGIN.altura },
    );
    // A transformação real em 390×844 (escala 844/1821, corte lateral de 5,2 px).
    const esperados = [
      [183.9, 474.6],
      [206.6, 495.0],
      [249.2, 495.0],
    ];
    pontos.forEach((p, i) => {
      expect(Math.abs(p.x - esperados[i][0])).toBeLessThanOrEqual(2);
      expect(Math.abs(p.y - esperados[i][1])).toBeLessThanOrEqual(2);
      // Quem recebe o ponto não é nada clicável, de nenhuma tag.
      expect(p.clicavel, JSON.stringify(p)).toBe(false);
    });

    // A prova que não depende de tag, caixa ou camada: em volta de cada ponto
    // (5×5 px), a tela inteira contra a tela com SÓ a foto. A diferença
    // permitida é a do véu aprovado do formulário, que ali começa a aparecer
    // (no máximo ~11% de escurecimento, medido); qualquer outra coisa pintada
    // por cima — dentro ou fora do formulário, opaca, clara ou escura — passa
    // dela.
    const recortes = () =>
      Promise.all(
        pontos.map((p) =>
          page.screenshot({ clip: { x: Math.round(p.x) - 2, y: Math.round(p.y) - 2, width: 5, height: 5 } }),
        ),
      );
    const tela = await recortes();
    await soIsto(page, "[data-camada-da-foto] img");
    const foto = await recortes();
    for (let i = 0; i < pontos.length; i++) {
      const a = await mediaDoRecorte(page, tela[i]);
      const b = await mediaDoRecorte(page, foto[i]);
      const razao = (a[0] + a[1] + a[2] + 1) / (b[0] + b[1] + b[2] + 1);
      const desvioDeCor = Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - b[k] * razao)));
      const medida = { ponto: pontos[i], tela: a, foto: b, razao, desvioDeCor };
      expect(razao, JSON.stringify(medida)).toBeGreaterThanOrEqual(0.85);
      expect(razao, JSON.stringify(medida)).toBeLessThanOrEqual(1.02);
      // O véu escurece por igual: a cor da foto continua a mesma.
      expect(desvioDeCor, JSON.stringify(medida)).toBeLessThanOrEqual(6);
    }
  });
});

// ---------------------------------------------------------------------------
// SPEC-088 (AC-088-06) — a tipografia do topo e onde o texto acaba
// ---------------------------------------------------------------------------

/** O topo da abertura iluminada da foto v2, em linhas da fonte (medido no bitmap). */
const TOPO_DA_ABERTURA_NA_FONTE = 662;

function tituloEsperado(largura: number): number {
  if (largura < 360) return 28; // 1.75rem
  if (largura < 400) return 30; // 1.875rem
  return 36; // 2.25rem
}

for (const [nome, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`AC-088-06 — tipografia do topo, ${nome}`, () => {
    test.use({ viewport });

    test("título e apoio nos tamanhos do delta, e o TEXTO acaba antes da abertura", async ({ page }) => {
      await page.goto("/login");
      await esperarPintura(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      const m = await page.evaluate(
        ({ linha, largura, altura }) => {
          const achar = (f: (p: Element) => boolean) => [...document.querySelectorAll("p")].find(f)!;
          const marca = achar((p) => p.textContent === "PlayCK");
          const selo = achar((p) => !!p.textContent?.includes("SEU ESPORTE"));
          const apoio = achar((p) => !!p.textContent?.startsWith("Reserve sua quadra"));
          const h1 = document.querySelector("h1")!;
          // As linhas REAIS do texto: o Range inclui deslocamento relativo,
          // transform e transbordo, que a caixa do elemento não mostra.
          // Só os nós de TEXTO: o Range de um elemento inteiro traz também as
          // caixas dos filhos de bloco (as linhas do título são spans).
          const linhas = (el: Element) => {
            const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const q: DOMRect[] = [];
            for (let n = andar.nextNode(); n; n = andar.nextNode()) {
              if (!n.textContent?.trim()) continue;
              const r = document.createRange();
              r.selectNodeContents(n);
              q.push(...[...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0));
            }
            return q;
          };
          const tops = (q: DOMRect[]) => new Set(q.map((x) => Math.round(x.top))).size;
          const la = linhas(apoio);
          const lt = linhas(h1);
          const ls = linhas(selo);
          const lm = linhas(marca);
          const coluna = document.querySelector("[data-coluna-do-login]")!.getBoundingClientRect();
          const img = document.querySelector("[data-camada-da-foto] img")!.getBoundingClientRect();
          const s = Math.max(img.width / largura, img.height / altura);
          const oy = img.top + (img.height - altura * s) / 2;
          const todas = [...lm, ...ls, ...lt, ...la];
          return {
            titulo: parseFloat(getComputedStyle(h1).fontSize),
            apoio: parseFloat(getComputedStyle(apoio).fontSize),
            larguraMaxima: parseFloat(getComputedStyle(apoio).maxWidth),
            linhasDoApoio: tops(la),
            linhasDoTitulo: tops(lt),
            alturaDoTitulo: Math.max(...lt.map((q) => q.bottom)) - Math.min(...lt.map((q) => q.top)),
            fimDoApoio: Math.max(...la.map((q) => q.bottom)),
            fimDaMarca: Math.max(...lm.map((q) => q.bottom)),
            topoDoSelo: Math.min(...ls.map((q) => q.top)),
            fimDoSelo: Math.max(...ls.map((q) => q.bottom)),
            topoDoTitulo: Math.min(...lt.map((q) => q.top)),
            fimDoTitulo: Math.max(...lt.map((q) => q.bottom)),
            topoDoApoio: Math.min(...la.map((q) => q.top)),
            dentroDaColuna: todas.every((q) => q.left >= coluna.left - 0.5 && q.right <= coluna.right + 0.5),
            abertura: oy + linha * s,
          };
        },
        { linha: TOPO_DA_ABERTURA_NA_FONTE, largura: FUNDO_DO_LOGIN.largura, altura: FUNDO_DO_LOGIN.altura },
      );
      const t = JSON.stringify(m);
      const esperado = tituloEsperado(viewport.width);
      expect(m.titulo, t).toBe(esperado);
      expect(m.apoio, t).toBe(14); // 0.875rem
      expect(m.larguraMaxima, t).toBe(252); // 15.75rem
      // As três linhas do apoio (I10) e as duas do título, contadas no texto.
      expect(m.linhasDoApoio, t).toBe(3);
      expect(m.linhasDoTitulo, t).toBe(2);
      // O título PINTADO tem a altura do tamanho declarado (2 linhas a 1.08):
      // um scale, ou outra fonte por baixo, muda isto.
      expect(Math.abs(m.alturaDoTitulo - 2 * 1.08 * esperado), t).toBeLessThanOrEqual(esperado * 0.25);
      // Nenhuma linha de texto sai da coluna (um nowrap, um scale). O
      // scrollWidth não serve: os véus passam da caixa de propósito.
      expect(m.dentroDaColuna, t).toBe(true);
      // O texto acaba antes da abertura iluminada, em toda largura.
      expect(m.fimDoApoio, t).toBeLessThan(m.abertura);
      // E os textos do topo não se sobrepõem, medidos nas linhas reais.
      expect(m.topoDoSelo, t).toBeGreaterThanOrEqual(m.fimDaMarca);
      expect(m.topoDoTitulo, t).toBeGreaterThanOrEqual(m.fimDoSelo);
      expect(m.topoDoApoio, t).toBeGreaterThanOrEqual(m.fimDoTitulo);
    });
  });
}

// ---------------------------------------------------------------------------
// SPEC-088 (IMP-088-R3-02) — a marca não tem véu, nem emprestado
// ---------------------------------------------------------------------------

/**
 * O `DESIGN.md` diz "a marca não tem véu" (I10 da 084). Duas provas:
 *
 * 1. pixel: a marca na tela inteira é IGUAL à marca sozinha sobre a foto (tudo
 *    o mais escondido). Qualquer camada de outro elemento — véu, `::after`,
 *    sombra, overlay — que alcance a marca muda bytes;
 * 2. estilo: a própria marca e os ancestrais dela até a coluna não pintam nada
 *    por cima nem por baixo (fundo, filtro, sombra, opacidade, mistura,
 *    pseudo-elementos com fundo ou sombra) — a única coisa que a prova 1 não
 *    vê, porque a marca vai junto para a referência.
 */
const CASOS_DA_MARCA: { nome: string; viewport: { width: number; height: number }; fonte: 100 | 200 }[] = [
  ...Object.entries(VIEWPORTS).map(([nome, viewport]) => ({ nome, viewport, fonte: 100 as const })),
  { nome: "320x568", viewport: VIEWPORTS["320x568"], fonte: 200 },
  { nome: "390x844", viewport: VIEWPORTS["390x844"], fonte: 200 },
];

for (const caso of CASOS_DA_MARCA) {
  test.describe(`IMP-088-R3-02 — a marca sem véu, ${caso.nome}, fonte ${caso.fonte}%`, () => {
    test.use({ viewport: caso.viewport, deviceScaleFactor: 1 });

    test("a marca é a mesma da referência, e nada nela ou acima dela pinta", async ({ page }) => {
      await page.goto("/login");
      if (caso.fonte === 200) await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await esperarPintura(page);
      await page.evaluate(() => window.scrollTo(0, 0));

      const estilo = await page.evaluate(() => {
        const marca = [...document.querySelectorAll("p")].find((p) => p.textContent === "PlayCK")!;
        const coluna = document.querySelector("[data-coluna-do-login]")!;
        const problemas: string[] = [];
        const transparente = (c: string) => c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
        for (let el: Element | null = marca; el && el !== coluna.parentElement; el = el.parentElement) {
          const e = getComputedStyle(el);
          const nome = el === coluna ? "coluna" : el.tagName;
          // A coluna é o fundo da página: o fundo dela pode existir (é o
          // `#080D10` atrás da foto), o resto não.
          if (el !== coluna && (!transparente(e.backgroundColor) || e.backgroundImage !== "none"))
            problemas.push(`${nome}: fundo`);
          if (e.filter !== "none" || e.backdropFilter !== "none") problemas.push(`${nome}: filtro`);
          if (e.boxShadow !== "none" || e.textShadow !== "none") problemas.push(`${nome}: sombra`);
          if (parseFloat(e.opacity) < 1) problemas.push(`${nome}: opacidade`);
          if (e.mixBlendMode !== "normal") problemas.push(`${nome}: mistura`);
          for (const pseudo of ["::before", "::after"]) {
            const p = getComputedStyle(el, pseudo);
            if (p.content === "none" || p.content === "normal") continue;
            if (!transparente(p.backgroundColor) || p.backgroundImage !== "none" || p.boxShadow !== "none")
              problemas.push(`${nome}${pseudo}: pinta`);
          }
        }
        return problemas;
      });
      expect(estilo, "a marca ou um ancestral dela pinta").toEqual([]);

      const marca = page.locator("p", { hasText: /^PlayCK$/ });
      const caixa = (await marca.boundingBox())!;
      const clip = { x: Math.floor(caixa.x), y: Math.floor(caixa.y), width: Math.ceil(caixa.width), height: Math.ceil(caixa.height) };
      const tela = await page.screenshot({ clip });
      await soIsto(page, '[data-camada-da-foto] img, p:has(> span) , p:has(> span) *');
      const referencia = await page.screenshot({ clip });
      expect(tela.equals(referencia), "alguma camada alcança a marca").toBe(true);
    });
  });
}

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

/**
 * A foto em cinco larguras: cada uma põe os textos sobre um pedaço diferente
 * dela (a 412 px, o celular do Israel, o apoio cruza a luz das palmeiras; a
 * 1440, a coluna corta a foto por cima e por baixo). A foto ausente basta em
 * duas: o fundo é liso.
 */
const MATRIZ: [keyof typeof VIEWPORTS, Fundo][] = [
  ["320x568", "foto"],
  ["360x800", "foto"],
  ["390x844", "foto"],
  ["412x915", "foto"],
  ["1440x900", "foto"],
  ["320x568", "ausente"],
  ["390x844", "ausente"],
];

for (const [nome, fundo] of MATRIZ) {
  test.describe(`NFR-001 — contraste, ${nome}, fundo ${fundo}`, () => {
    test.use({ viewport: VIEWPORTS[nome], deviceScaleFactor: 1 });

    test.beforeEach(async ({ page }) => {
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
        { rotulo: "foco esqueceu", alvo: page.getByRole("link", { name: "Esqueceu a senha?" }) },
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

    test("link de recuperação, erro e botão continuam visíveis e inteiros", async ({ page }) => {
      await simularLogin(page, "erro");
      await page.goto("/login");
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await esperarHidratacao(page);
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
        page.getByRole("link", { name: "Esqueceu a senha?" }),
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
    test.describe(`LIM-084o — ${nome}, fonte ${fonte}%, sobre a foto`, () => {
      test.use({ viewport, deviceScaleFactor: 1 });

      test("marca, selo, título e apoio dentro da coluna e legíveis", async ({ page }) => {
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
          await page.screenshot({ path: join(EVIDENCIAS, "capturas", `${nome}-fonte-200-foto.png`), fullPage: true });
        }
        const ruins = resultados.filter((r) => !r.passou);
        expect(ruins, JSON.stringify(ruins, null, 1)).toEqual([]);
      });
    });
  }
}
