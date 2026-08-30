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
    getPublicPaymentConfig: (...a: unknown[]) => getPublicPaymentConfigMock(...a),
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
    listMyBookingsMock.mockResolvedValue({ total: 1, data: [reserva("pendente_pagamento")] });
    getPublicPaymentConfigMock.mockResolvedValue({
      linkPagamentoUrl: null,
      whatsappNumero: null,
    });

    render(<MyBookingsList />);

    await waitFor(() =>
      expect(screen.getByText(/Combine o pagamento com o clube/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Pagamento ok")).not.toBeInTheDocument();
  });

  it("reserva pendente COM meio de pagamento oferece pagar", async () => {
    listMyBookingsMock.mockResolvedValue({ total: 1, data: [reserva("pendente_pagamento")] });
    getPublicPaymentConfigMock.mockResolvedValue({
      linkPagamentoUrl: "https://exemplo.com",
      whatsappNumero: null,
    });

    render(<MyBookingsList />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pagar agora/i })).toBeInTheDocument(),
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
    await screen.findByLabelText("Reservas ativas");

    fireEvent.click(
      await screen.findByLabelText("Próxima página de minhas reservas"),
    );
    await waitFor(() => expect(listMyBookingsMock).toHaveBeenCalledWith(2));

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Cancelar" }))[0],
    );

    // O que a pessoa NÃO pode ver: "não há nada" com 20 reservas vivas.
    await waitFor(() => expect(listMyBookingsMock).toHaveBeenCalledWith(1));
    expect(
      screen.queryByText("Nenhuma reserva ainda"),
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
      await screen.findByText("Nenhuma reserva ainda"),
    ).toBeInTheDocument();
  });
});
