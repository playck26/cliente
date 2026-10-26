import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { LOGIN_APOS_ATIVACAO, LOGIN_APOS_REDEFINICAO } from "../src/lib/ativacao-navigation";

/**
 * SPEC-084/TEST-005 — **o lado do login do protocolo de ativação (AC-008).**
 *
 * A página de ativação ainda não existe (é da SPEC-083, que integra depois,
 * I4). Este arquivo prova o que a SPEC-084 entrega sozinha: quem chega por
 * `LOGIN_APOS_ATIVACAO` lê o aviso; quem chega por qualquer outro endereço,
 * não. A navegação cruzada `/ativar/[token]` → login é do teste da SPEC-083
 * (`COORDENACAO-083-084.md`).
 *
 * Tudo navega pela CONSTANTE importada, nunca pelo literal: se alguém trocar o
 * valor dela e esquecer a leitura, este arquivo fica vermelho.
 */

const TEXTO = "Conta ativada. Entre com seu e-mail e senha.";
const TEXTO_DA_REDEFINICAO = "Senha redefinida. Entre com a senha nova.";
const EVIDENCIAS = join(__dirname, "..", "test-results", "spec-084");
mkdirSync(join(EVIDENCIAS, "capturas"), { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });

async function esperarHidratacao(page: Page) {
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByRole("button", { name: "Ocultar senha" })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar senha" }).click();
}

test.describe("AC-008 — o HTML do servidor, antes da hidratação", () => {
  test.use({ javaScriptEnabled: false });

  test("a região do aviso existe VAZIA no HTML, e o texto não está em lugar nenhum da página", async ({ page }) => {
    const resposta = await page.goto(LOGIN_APOS_ATIVACAO);
    expect(resposta?.status()).toBe(200);

    // Sem JavaScript, o DOM é o que o servidor mandou: nada hidratou.
    const regiao = page.locator("main").getByRole("status");
    await expect(regiao).toHaveCount(1);
    await expect(regiao).toBeEmpty();
    // `getByText` não olha dentro de <script>: o que conta é o texto PINTADO,
    // não strings serializadas no payload do Next.
    await expect(page.getByText(TEXTO)).toHaveCount(0);
  });

  // SPEC-090 (AC-024, DOR-090-R2-01): o segundo protocolo, pela constante
  // importada, tem a mesma prova — região única e vazia no HTML do servidor.
  test("SPEC-090: por LOGIN_APOS_REDEFINICAO, a região também existe VAZIA no HTML, sem o texto", async ({ page }) => {
    const resposta = await page.goto(LOGIN_APOS_REDEFINICAO);
    expect(resposta?.status()).toBe(200);

    const regiao = page.locator("main").getByRole("status");
    await expect(regiao).toHaveCount(1);
    await expect(regiao).toBeEmpty();
    await expect(page.getByText(TEXTO_DA_REDEFINICAO)).toHaveCount(0);
    await expect(page.getByText(TEXTO)).toHaveCount(0);
  });
});

test.describe("SPEC-090 — o aviso da redefinição, depois da hidratação", () => {
  test("pela constante: o texto da redefinição na MESMA região, uma só, sem pedir nada", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
    await page.goto(LOGIN_APOS_REDEFINICAO);

    await expect(page.locator("main").getByRole("status")).toHaveText(TEXTO_DA_REDEFINICAO);
    await expect(page.locator("main [role=status]")).toHaveCount(1);
    await expect(page.locator("main [data-aviso-de-ativacao]")).toHaveText(TEXTO_DA_REDEFINICAO);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(pedidos.filter((p) => p.startsWith("/api/"))).toEqual([]);

    await page.screenshot({ path: join(EVIDENCIAS, "capturas", "390x844-aviso-redefinicao.png"), fullPage: true });
  });

  for (const endereco of ["/login?senha=", "/login?senha=1", "/login?senha=Redefinida"]) {
    test(`${endereco}: a região existe e continua vazia depois de hidratar`, async ({ page }) => {
      await page.goto(endereco);
      await esperarHidratacao(page);
      await page.waitForTimeout(600);
      await expect(page.locator("main").getByRole("status")).toHaveCount(1);
      await expect(page.locator("main").getByRole("status")).toBeEmpty();
    });
  }
});

test.describe("AC-008 — depois da hidratação", () => {
  test("pela constante: o aviso aparece em role=status, sem pedir nada, sem gravar nada e sem tirar o foco", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
    await page.goto(LOGIN_APOS_ATIVACAO);

    await expect(page.locator("main").getByRole("status")).toHaveText(TEXTO);
    await expect(page.locator("main").getByRole("status")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual([]);
    // Nenhum pedido à API: só documento, scripts, estilos, fontes e imagens.
    expect(pedidos.filter((p) => p.startsWith("/api/"))).toEqual([]);

    await page.screenshot({ path: join(EVIDENCIAS, "capturas", "390x844-aviso-ativacao.png"), fullPage: true });
  });

  for (const endereco of ["/login", "/login?ativado=0", "/login?ativado=sim", "/login?ativacao=1"]) {
    test(`${endereco}: a região existe e continua vazia depois de hidratar`, async ({ page }) => {
      await page.goto(endereco);
      await esperarHidratacao(page);
      // Mais que o atraso do anúncio (150 ms): se fosse aparecer, já teria.
      await page.waitForTimeout(600);
      await expect(page.locator("main").getByRole("status")).toHaveCount(1);
      await expect(page.locator("main").getByRole("status")).toBeEmpty();
    });
  }

  test("o aviso fica fora do formulário e acima dele", async ({ page }) => {
    await page.goto(LOGIN_APOS_ATIVACAO);
    await expect(page.locator("main").getByRole("status")).toHaveText(TEXTO);
    const dentro = await page.evaluate(() => {
      const regiao = document.querySelector("[role=status]")!;
      const form = document.querySelector("form")!;
      return {
        dentroDoForm: form.contains(regiao),
        antes: !!(regiao.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(dentro).toEqual({ dentroDoForm: false, antes: true });
  });
});
