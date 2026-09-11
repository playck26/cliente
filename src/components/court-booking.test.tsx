import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { CourtBooking } from "./court-booking";

/**
 * A confirmação de reserva, e o defeito que este arquivo nasceu para
 * reproduzir.
 *
 * **Visto em produção em 2026-09-09.** O aluno reservava a quadra, o crédito
 * era debitado da carteira (SPEC-033), a reserva nascia `pago` — e a tela de
 * "Reserva confirmada!" mostrava assim mesmo **"Para pagar — Abrir link de
 * pagamento / Falar no WhatsApp"**.
 *
 * A causa era de uma linha: `await createBooking(...)` **descartava a
 * resposta**, então a tela nunca sabia que a reserva já estava paga; o bloco
 * de pagamento dependia só de o clube ter link ou WhatsApp configurado.
 *
 * **Por que isso é pior que um texto errado:** pedir pagamento depois de
 * debitar o crédito da pessoa faz duvidar de que o dinheiro entrou. O saldo
 * caiu e a tela pede para pagar de novo.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/quadras",
}));

const listar = vi.hoisted(() => vi.fn());
const disponibilidade = vi.hoisted(() => vi.fn());
const reservar = vi.hoisted(() => vi.fn());
const configDePagamento = vi.hoisted(() => vi.fn());
const carteira = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listCourts: listar,
    getAvailability: disponibilidade,
    createBooking: reservar,
    getPublicPaymentConfig: configDePagamento,
    getMinhaCarteira: carteira,
  };
});

const QUADRA = "q-1";

/**
 * A forma REAL do slot, conferida em `court-booking.tsx` depois de a primeira
 * versao deste arquivo inventar `{ horaInicio, horaFim, disponivel }`. O
 * contrato e `{ slot: "10:00-11:00", status: "livre" }`, e a disponibilidade
 * traz `estado` junto (SPEC-010/AC-008 distingue "fechado" de "sem nada
 * livre").
 */
const DISPONIVEL = {
  estado: "aberto",
  slots: [{ slot: "10:00-11:00", status: "livre" }],
};

function reservaComStatus(statusPagamento: string) {
  return { reservas: [{ id: "r-1", statusPagamento }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  listar.mockResolvedValue({
    data: [
      {
        id: QUADRA,
        nome: "Quadra 2",
        precoHora: 120,
        esporte: { id: "e-1", nome: "Tennis" },
        status: "ativa",
      },
    ],
  });
  disponibilidade.mockResolvedValue(DISPONIVEL);
  // O clube TEM link e WhatsApp configurados — é o cenário do defeito. Sem
  // eles o bloco de pagamento não apareceria por outro motivo, e o teste
  // passaria sem provar nada.
  configDePagamento.mockResolvedValue({
    linkPagamentoUrl: "https://pagar.example/x",
    whatsappNumero: "5511999999999",
  });
  reservar.mockResolvedValue(reservaComStatus("pago"));
  // R$ 500,00. A quadra custa R$ 120/h, entao um horario cabe com folga --
  // quem testa o caso sem saldo sobrescreve.
  carteira.mockResolvedValue({ saldoCentavos: 50_000, movimentos: [] });
});

/** Seleciona o horário e confirma — o caminho que todo caso percorre. */
async function reservarNaTela() {
  render(<CourtBooking id={QUADRA} />);
  fireEvent.click(await screen.findByRole("button", { name: /10:00/ }));
  fireEvent.click(await screen.findByText("Confirmar reserva"));
  await screen.findByText("Reserva confirmada!");
}

describe("CourtBooking — a confirmação", () => {
  it("reserva PAGA com crédito NÃO pede pagamento", async () => {
    await reservarNaTela();

    // O defeito em uma asserção: isto aparecia mesmo com a reserva paga.
    expect(screen.queryByText("Para pagar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Abrir link de pagamento"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Falar no WhatsApp")).not.toBeInTheDocument();
  });

  it("e DIZ que foi paga com o saldo", async () => {
    await reservarNaTela();

    // Sumir não basta: sem esta frase o aluno fica sem saber se deve algo.
    expect(await screen.findByText("Pago com seu saldo")).toBeInTheDocument();
    expect(screen.getByText(/debitado da sua carteira/)).toBeInTheDocument();
  });

  it("reserva PENDENTE continua pedindo pagamento, como sempre", async () => {
    reservar.mockResolvedValue(reservaComStatus("pendente_pagamento"));
    await reservarNaTela();

    // A metade que não pode quebrar: quem não tem saldo paga como antes.
    expect(await screen.findByText("Para pagar")).toBeInTheDocument();
    expect(screen.getByText("Abrir link de pagamento")).toBeInTheDocument();
    expect(screen.queryByText("Pago com seu saldo")).not.toBeInTheDocument();
  });

  it("vários horários: UM pendente já manda pagar", async () => {
    // `every` e não `some`, e este caso é o porquê. Um pedido de vários
    // blocos pode esgotar o saldo no meio; se qualquer um ficou pendente, o
    // caminho de pagamento continua sendo o certo.
    reservar.mockResolvedValue({
      reservas: [
        { id: "r-1", statusPagamento: "pago" },
        { id: "r-2", statusPagamento: "pendente_pagamento" },
      ],
    });
    await reservarNaTela();

    expect(await screen.findByText("Para pagar")).toBeInTheDocument();
    expect(screen.queryByText("Pago com seu saldo")).not.toBeInTheDocument();
  });

  it("resposta sem reserva nenhuma não vira 'pago' por vazio", async () => {
    // `[].every(...)` é `true` em JavaScript. Sem o `reservas.length > 0`, uma
    // resposta vazia — que não deveria acontecer, e por isso ninguém olharia —
    // diria "pago com seu saldo" sobre nada.
    reservar.mockResolvedValue({ reservas: [] });
    await reservarNaTela();

    expect(screen.queryByText("Pago com seu saldo")).not.toBeInTheDocument();
  });

  it("o erro de reserva NAO sobrevive a troca de data", async () => {
    // Achado da revisao adversarial: `bookingError` so era limpo ao tentar
    // reservar de novo. Trocar de dia mantinha na tela um erro sobre um dia
    // em que nada foi tentado.
    reservar.mockRejectedValue(new ApiError(409, "Horario ja ocupado."));
    render(<CourtBooking id={QUADRA} />);
    fireEvent.click(await screen.findByRole("button", { name: /10:00/ }));
    fireEvent.click(await screen.findByText("Confirmar reserva"));
    expect(await screen.findByText("Horario ja ocupado.")).toBeInTheDocument();

    // A data e uma FILA DE BOTOES de dia, nao um `input[type=date]` -- a
    // primeira versao deste caso supos o input e morreu procurando. Os botoes
    // de dia e os de horario compartilham `aria-pressed`, entao o que separa
    // os dois e o texto: horario casa /\d{2}:\d{2}/, dia nao.
    const botoes = Array.from(
      document.querySelectorAll("button[aria-pressed]"),
    ).filter((b) => !/\d{2}:\d{2}/.test(b.textContent || ""));
    if (botoes.length < 2) throw new Error("fila de dias nao encontrada");
    fireEvent.click(botoes[1]);

    await waitFor(() =>
      expect(screen.queryByText("Horario ja ocupado.")).not.toBeInTheDocument(),
    );
  });

  it("clube sem link nem WhatsApp: nenhum bloco, e nada quebra", async () => {
    configDePagamento.mockResolvedValue({
      linkPagamentoUrl: null,
      whatsappNumero: null,
    });
    reservar.mockResolvedValue(reservaComStatus("pendente_pagamento"));
    await reservarNaTela();

    await waitFor(() =>
      expect(screen.queryByText("Para pagar")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Pago com seu saldo")).not.toBeInTheDocument();
  });
});

/**
 * SPEC-048/REQ-001 — **o saldo, porque reservar GASTA ele.**
 *
 * Esta tela dizia *"Pago com seu saldo"* **depois** de confirmar e nada antes.
 * Aviso depois do fato é recibo, não clareza — e este é o fluxo mais usado do
 * app. O que estes casos guardam é o "antes".
 */
describe("SPEC-048 — o saldo aparece ANTES", () => {
  it("AC-001: mostra o saldo assim que a tela abre", async () => {
    render(<CourtBooking id={QUADRA} />);
    expect(await screen.findByText(/Seu saldo: R\$\s*500,00/)).toBeInTheDocument();
  });

  it("AC-002: escolhido o horário, diz quanto SAI da carteira", async () => {
    render(<CourtBooking id={QUADRA} />);
    fireEvent.click(await screen.findByRole("button", { name: /10:00/ }));
    expect(screen.getByText("Sai do seu saldo")).toBeInTheDocument();
    // R$ 120/h x 1 horário. A tela não recalcula preço: usa o da quadra.
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getByText(/Ficam R\$\s*380,00/)).toBeInTheDocument();
  });

  it("**AC-003: sem saldo, diz quanto falta — e NÃO trava o botão**", async () => {
    carteira.mockResolvedValue({ saldoCentavos: 4_000, movimentos: [] });
    render(<CourtBooking id={QUADRA} />);
    fireEvent.click(await screen.findByRole("button", { name: /10:00/ }));

    expect(await screen.findByText(/faltam/i)).toHaveTextContent("R$ 80,00");
    // Travar prenderia quem acabou de receber crédito: o saldo foi lido na
    // montagem, e quem julga é o servidor. É a D2, e a LIM-047f antes dela.
    expect(screen.getByText("Confirmar reserva").closest("button")).toBeEnabled();
  });

  it("AC-004: carteira indisponível NÃO derruba a tela", async () => {
    carteira.mockRejectedValue(new Error("rede"));
    render(<CourtBooking id={QUADRA} />);
    fireEvent.click(await screen.findByRole("button", { name: /10:00/ }));
    // Sem o saldo a pessoa perde o AVISO, não a possibilidade de reservar.
    expect(screen.queryByText(/Seu saldo/)).not.toBeInTheDocument();
    expect(screen.getByText("Confirmar reserva")).toBeInTheDocument();
  });

  it("AC-005: depois de confirmar, o saldo mostrado é o NOVO", async () => {
    carteira
      .mockResolvedValueOnce({ saldoCentavos: 50_000, movimentos: [] })
      .mockResolvedValueOnce({ saldoCentavos: 38_000, movimentos: [] });
    await reservarNaTela();
    // Repetir o saldo antigo aqui seria a tela afirmar um número que ela mesma
    // acabou de tornar falso.
    expect(screen.getByText(/Seu saldo agora é R\$\s*380,00/)).toBeInTheDocument();
  });
});
