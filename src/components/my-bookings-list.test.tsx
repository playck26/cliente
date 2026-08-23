import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyBookingsList } from "./my-bookings-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

const listMyBookingsMock = vi.fn();
const getPublicPaymentConfigMock = vi.fn();
const listCourtsMock = vi.fn();

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
