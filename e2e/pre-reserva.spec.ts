/**
 * SPEC-074/TASK-005 — **o pedido de aviso de horário, num navegador de
 * verdade.**
 *
 * As provas de componente cobrem a lógica da grade; esta cobre o que só o
 * navegador alcança: a data chegando **pela URL do aviso** até a requisição
 * da grade (AC-019), o slot ocupado respondendo ao toque (AC-018), o `POST`
 * saindo com o corpo certo, e a confirmação cabendo em 320px **sem rolagem
 * horizontal** — o mesmo critério geométrico da SPEC-072.
 *
 * O servidor não existe aqui: `page.route()` responde as chamadas da tela, e a
 * rota não prevista vira `404` alto, pelo mesmo motivo do
 * `oportunidade-legivel.spec.ts`.
 */
import { expect, test, type Page, type Request } from "@playwright/test";

const QUADRA = "88888888-8888-4888-8888-888888888888";

/** Um dia futuro qualquer, no formato da URL. */
function emDias(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const DIA = emDias(5);

const RESPOSTAS: Record<string, Record<string, unknown> | unknown[] | null> = {
  "/api/v1/auth/me": {
    id: "55555555-5555-4555-8555-555555555555",
    nome: "Aluna de Teste",
    email: "aluna@teste.local",
    role: "aluno",
  },
  "/api/v1/me/company": {
    id: "66666666-6666-4666-8666-666666666666",
    nome: "PlayCK Club",
    slug: "playck-club",
    status: "ativa",
    permiteAutoCadastro: true,
    limiteTurmasPorAluno: 3,
    logoUrl: null,
  },
  "/api/v1/me/avisos/nao-lidos": { total: 0 },
  "/api/v1/me/creditos": { saldoCentavos: 0, movimentos: [] },
  "/api/v1/payment-config/public": {
    linkPagamentoUrl: null,
    whatsappNumero: null,
  },
  "/api/v1/courts": {
    data: [
      {
        id: QUADRA,
        nome: "Quadra Central",
        precoHora: 120,
        esporte: { id: "e-1", nome: "Tênis" },
        status: "ativa",
        imagemUrl: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 100,
  },
  [`/api/v1/courts/${QUADRA}/availability`]: {
    quadraId: QUADRA,
    data: DIA,
    estado: "aberto",
    slots: [
      { slot: "10:00-11:00", status: "livre" },
      { slot: "11:00-12:00", status: "ocupado_avulso" },
    ],
  },
  "/api/v1/me/pre-reservas": [],
};

interface Captura {
  grade: string[];
  pedidos: unknown[];
}

async function comServidorDeMentira(page: Page): Promise<Captura> {
  const captura: Captura = { grade: [], pedidos: [] };
  await page.addInitScript(() => {
    window.localStorage.setItem("playck_cliente_access_token", "token-de-e2e");
    window.localStorage.setItem("playck_cliente_papel", "aluno");
  });

  await page.route("**/api/v1/**", async (rota) => {
    const requisicao: Request = rota.request();
    const url = new URL(requisicao.url());
    const caminho = url.pathname;

    if (caminho.endsWith("/availability")) {
      captura.grade.push(url.searchParams.get("data") ?? "");
    }
    if (caminho === "/api/v1/me/pre-reservas" && requisicao.method() === "POST") {
      const corpo = requisicao.postDataJSON() as Record<string, unknown>;
      captura.pedidos.push(corpo);
      await rota.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "99999999-9999-4999-8999-999999999999",
          quadraId: corpo.quadraId,
          data: corpo.data,
          horaInicio: corpo.horaInicio,
          horaFim: "12:00",
          estado: "aguardando",
          criadaEm: new Date().toISOString(),
        }),
      });
      return;
    }
    if (!(caminho in RESPOSTAS)) {
      await rota.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: `rota nao prevista no e2e: ${caminho}` }),
      });
      return;
    }
    await rota.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(RESPOSTAS[caminho]),
    });
  });
  return captura;
}

test.describe("SPEC-074 — pedir aviso de um horário ocupado", () => {
  test("AC-019 + AC-018 — a data da URL abre a grade naquele dia, e tocar o ocupado pede o aviso", async ({
    page,
  }) => {
    const captura = await comServidorDeMentira(page);

    await page.goto(`/quadras/${QUADRA}?data=${DIA}`);
    const ocupado = page.getByRole("button", { name: /11:00/ });
    await expect(ocupado).toBeVisible();
    // A grade foi pedida PARA O DIA DA URL, e não para hoje.
    expect(captura.grade[0]).toBe(DIA);

    await ocupado.click();
    await expect(
      page.getByText("Este horário está ocupado. Quer ser avisado se ele vagar?"),
    ).toBeVisible();
    // O ocupado não entrou na seleção de reserva.
    await expect(page.getByText("Confirmar reserva")).toHaveCount(0);

    await page.getByRole("button", { name: "Me avise" }).click();
    await expect(page.getByText(/se este horário vagar, você recebe um aviso/)).toBeVisible();
    expect(captura.pedidos).toEqual([
      { quadraId: QUADRA, data: DIA, horaInicio: "11:00" },
    ]);
    // E o slot passou a dizer que o aviso está ativo.
    await expect(page.getByText("Aviso ativo")).toBeVisible();
  });

  test("a confirmação cabe em 320px: a página não ganha rolagem horizontal", async ({
    page,
  }) => {
    await comServidorDeMentira(page);
    await page.goto(`/quadras/${QUADRA}?data=${DIA}`);
    await page.getByRole("button", { name: /11:00/ }).click();
    await expect(page.getByRole("button", { name: "Me avise" })).toBeVisible();

    const larguras = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      tela: document.documentElement.clientWidth,
    }));
    expect(larguras.rolagem).toBeLessThanOrEqual(larguras.tela);
  });

  test("AC-019 — data de ONTEM na URL cai em hoje, sem erro", async ({ page }) => {
    const captura = await comServidorDeMentira(page);

    await page.goto(`/quadras/${QUADRA}?data=${emDias(-1)}`);
    await expect(page.getByRole("button", { name: /11:00/ })).toBeVisible();

    expect(captura.grade[0]).not.toBe(emDias(-1));
    expect(captura.grade[0] >= emDias(-1)).toBe(true);
  });
});
