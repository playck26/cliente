import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyBookingsList } from "./my-bookings-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

const listMyBookingsMock = vi.fn();
const getPublicPaymentConfigMock = vi.fn();
const listCourtsMock = vi.fn();
const cancelBookingMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listMyBookings: (...a: unknown[]) => listMyBookingsMock(...a),
    getPublicPaymentConfig: (...a: unknown[]) =>
      getPublicPaymentConfigMock(...a),
    listCourts: (...a: unknown[]) => listCourtsMock(...a),
    cancelBooking: (...a: unknown[]) => cancelBookingMock(...a),
  };
});

function reserva(statusPagamento: string) {
  return {
    id: "b1",
    quadraId: "q1",
    data: "2026-09-01",
    horaInicio: "09:00",
    horaFim: "10:00",
    statusPagamento,
    valor: 150,
  };
}

// DEF-005: o ternário tinha dois ramos para três casos, e o `else` dizia
// "Pagamento ok" para quem devia numa empresa sem meio de pagamento
// cadastrado. Era o estado real da produção quando isto foi escrito.
describe("MyBookingsList — o que a tela diz sobre pagamento (DEF-005)", () => {
  beforeEach(() => {
    listMyBookingsMock.mockReset();
    getPublicPaymentConfigMock.mockReset();
    listCourtsMock.mockReset().mockResolvedValue({ data: [], total: 0 });
  });

  it("reserva pendente SEM meio de pagamento não diz que está paga", async () => {
    listMyBookingsMock.mockResolvedValue({
      total: 1,
      data: [reserva("pendente_pagamento")],
    });
    getPublicPaymentConfigMock.mockResolvedValue({
      linkPagamentoUrl: null,
      whatsappNumero: null,
    });

    render(<MyBookingsList />);

    await waitFor(() =>
      expect(
        screen.getByText(/Combine o pagamento com o clube/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Pagamento ok")).not.toBeInTheDocument();
  });

  it("reserva pendente COM meio de pagamento oferece pagar", async () => {
    listMyBookingsMock.mockResolvedValue({
      total: 1,
      data: [reserva("pendente_pagamento")],
    });
    getPublicPaymentConfigMock.mockResolvedValue({
      linkPagamentoUrl: "https://exemplo.com",
      whatsappNumero: null,
    });

    render(<MyBookingsList />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Pagar agora/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Pagamento ok")).not.toBeInTheDocument();
  });

  it("reserva paga diz que está paga, mesmo sem meio de pagamento cadastrado", async () => {
    listMyBookingsMock.mockResolvedValue({ total: 1, data: [reserva("pago")] });
    getPublicPaymentConfigMock.mockResolvedValue({
      linkPagamentoUrl: null,
      whatsappNumero: null,
    });

    render(<MyBookingsList />);

    await waitFor(() =>
      expect(screen.getByText("Pagamento ok")).toBeInTheDocument(),
    );
  });
});

/**
 * **Validação cruzada da SPEC-027, achado 1 (MÉDIA).**
 *
 * O validador reproduziu e eu não tinha visto: 21 reservas ativas, a pessoa na
 * página 2 cancela a única que há ali. O servidor passa a responder
 * `page=2, total=20, data=[]` — e a tela, que decidia o estado vazio por
 * `bookings.length === 0`, dizia **"Nenhuma reserva ainda"** e escondia a
 * paginação. Com 20 reservas vivas na página 1.
 *
 * Cancelar é a única ação desta tela que **encolhe** a lista, e é por isso que
 * o defeito é só dela — em "aulas anteriores", avaliar não remove nada.
 */
describe("MyBookingsList — a página que deixou de existir", () => {
  const reservaCom = (id: string) => ({ ...reserva("pendente_pagamento"), id });

  beforeEach(() => {
    listMyBookingsMock.mockReset();
    getPublicPaymentConfigMock.mockReset().mockResolvedValue({});
    listCourtsMock.mockReset().mockResolvedValue({ data: [], total: 0 });
    cancelBookingMock.mockReset().mockResolvedValue(undefined);
  });

  it("volta para a última página válida em vez de dizer que não há nada", async () => {
    const cheia = Array.from({ length: 20 }, (_, i) => reservaCom(`b${i}`));

    listMyBookingsMock
      // 1ª carga: página 1, 21 no total (2 páginas).
      .mockResolvedValueOnce({ page: 1, pageSize: 20, total: 21, data: cheia })
      // a pessoa vai para a página 2, onde há uma só.
      .mockResolvedValueOnce({
        page: 2,
        pageSize: 20,
        total: 21,
        data: [reservaCom("sozinha")],
      })
      // cancela: a página 2 deixou de existir.
      .mockResolvedValueOnce({ page: 2, pageSize: 20, total: 20, data: [] })
      // e o conserto pede a página 1 de novo.
      .mockResolvedValueOnce({ page: 1, pageSize: 20, total: 20, data: cheia });

    render(<MyBookingsList />);
    // SPEC-041/AC-008: a seção deixou de se chamar "Reservas ativas" — com
    // canceladas visíveis, "ativa" virou mentira.
    await screen.findByLabelText("Reservas");

    fireEvent.click(
      await screen.findByLabelText("Próxima página de minhas reservas"),
    );
    await waitFor(() =>
      expect(listMyBookingsMock).toHaveBeenCalledWith(2, 20, "futuras"),
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Cancelar" }))[0],
    );

    // O que a pessoa NÃO pode ver: "não há nada" com 20 reservas vivas.
    await waitFor(() =>
      expect(listMyBookingsMock).toHaveBeenCalledWith(1, 20, "futuras"),
    );
    expect(
      screen.queryByText("Nenhuma reserva por vir"),
    ).not.toBeInTheDocument();
  });

  it("e quando realmente não há nada, continua dizendo isso", async () => {
    // O outro lado. Sem esta, um conserto que nunca mostrasse o estado vazio
    // passaria na de cima — e a tela ficaria em branco para quem nunca
    // reservou.
    listMyBookingsMock.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 0,
      data: [],
    });

    render(<MyBookingsList />);

    expect(
      await screen.findByText("Nenhuma reserva por vir"),
    ).toBeInTheDocument();
  });
});

/**
 * SPEC-041 — **os dois defeitos que o Israel achou em produção, e o terceiro
 * que a validação cruzada achou no caminho.**
 *
 * 1. reserva passada aparecendo como se ainda fosse acontecer;
 * 2. reserva cancelada sumindo por completo;
 * 3. o `.sort` do cliente desfazendo, dentro de cada página, a ordem que o
 *    servidor tinha acabado de dar.
 */
describe("MyBookingsList — passado e canceladas (SPEC-041)", () => {
  const canceladaFutura = {
    ...reserva("cancelado"),
    id: "cancelada",
    data: "2026-09-20",
  };

  beforeEach(() => {
    listMyBookingsMock.mockReset();
    getPublicPaymentConfigMock.mockReset().mockResolvedValue({
      linkPagamentoUrl: "https://pagar.example",
      whatsappNumero: "5511999999999",
    });
    listCourtsMock.mockReset().mockResolvedValue({ data: [], total: 0 });
    cancelBookingMock.mockReset().mockResolvedValue(undefined);
  });

  function responder(data: unknown[], total = data.length) {
    listMyBookingsMock.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total,
      data,
    });
  }

  it("AC-005: para de pedir para esconder as canceladas, e pede o recorte", async () => {
    responder([]);

    render(<MyBookingsList />);

    await waitFor(() => expect(listMyBookingsMock).toHaveBeenCalled());
    expect(listMyBookingsMock).toHaveBeenCalledWith(1, 20, "futuras");
  });

  it("AC-006: cancelada aparece marcada — e o grid de ações some INTEIRO", async () => {
    responder([canceladaFutura]);

    render(<MyBookingsList />);

    // Ela existe na tela: era o defeito 2.
    expect(await screen.findByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Esta reserva foi cancelada.")).toBeInTheDocument();

    // O "Cancelar" duplicado seria só feio. O grave é o outro lado do grid:
    // cancelada cai em `!pago`, e a tela ofereceria cobrança por uma reserva
    // que o clube desmarcou.
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pagar agora/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Combine o pagamento com o clube"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Pagamento ok")).not.toBeInTheDocument();
  });

  it("AC-007: cancelada com horário futuro fica em Reservas, não em Anteriores (D3)", async () => {
    responder([canceladaFutura]);

    render(<MyBookingsList aba="reservas" />);

    // O corte do servidor é só temporal; status é apresentação. Uma reserva de
    // sexta cancelada hoje continua sendo de sexta — mandá-la para o histórico
    // faria o aluno procurar no lugar errado.
    expect(await screen.findByLabelText("Reservas")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
  });

  it("AC-008: o cabeçalho conta o TOTAL, não o tamanho da página", async () => {
    // 20 na página, 47 no total: a frase antiga dizia "20 reservas ativas".
    responder(
      Array.from({ length: 20 }, (_, i) => ({
        ...reserva("pago"),
        id: `b${i}`,
      })),
      47,
    );

    render(<MyBookingsList />);

    expect(await screen.findByText("47 reservas")).toBeInTheDocument();
    expect(screen.queryByText(/reservas ativas/)).not.toBeInTheDocument();
  });

  it("AC-003: a tela pinta na ordem que o servidor mandou, sem reordenar", async () => {
    // O servidor manda decrescente (aba Anteriores). Com o `.sort` que morava
    // aqui, a tela repintava crescente e a lista virava um serrote por página.
    responder([
      { ...reserva("pago"), id: "c", data: "2026-09-20", horaInicio: "18:00" },
      { ...reserva("pago"), id: "b", data: "2026-09-15", horaInicio: "09:00" },
      { ...reserva("pago"), id: "a", data: "2026-09-10", horaInicio: "07:00" },
    ]);

    render(<MyBookingsList aba="anteriores" />);

    await screen.findByLabelText("Reservas anteriores");
    const horarios = screen
      .getAllByText(/^\d{2}:\d{2}–\d{2}:\d{2}$/)
      .map((el) => el.textContent);
    expect(horarios).toEqual(["18:00–10:00", "09:00–10:00", "07:00–10:00"]);
  });

  it("a aba Anteriores pede o outro recorte e fala a própria língua", async () => {
    responder([]);

    render(<MyBookingsList aba="anteriores" />);

    await waitFor(() =>
      expect(listMyBookingsMock).toHaveBeenCalledWith(1, 20, "anteriores"),
    );
    expect(await screen.findByText("O que já passou")).toBeInTheDocument();
    // O vazio de uma aba não serve à outra: "suas próximas reservas aparecerão
    // aqui" é a frase errada para quem abriu o histórico.
    expect(screen.getByText("Nada no histórico ainda")).toBeInTheDocument();
  });
});
