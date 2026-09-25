import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { AvisosDeHorario } from "./avisos-de-horario";

/**
 * SPEC-074/AC-020 — **a lista de avisos de horário, em `/reservas`.**
 *
 * Existe por causa do teto de 10 (D9): sem ela, quem bate no limite não tem
 * onde ver quais são os dez. As funções do `api-client` são mocadas de
 * propósito — uma real rodando no jsdom falharia e cairia no `catch`, e a
 * prova de "some quando vazia" passaria por acidente.
 */
const meusAvisos = vi.hoisted(() => vi.fn());
const cancelar = vi.hoisted(() => vi.fn());
const quadras = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listarMinhasPreReservas: meusAvisos,
    cancelarPreReserva: cancelar,
    listCourts: quadras,
  };
});

const AVISO = {
  id: "av-1",
  quadraId: "q-1",
  data: "2026-10-02",
  horaInicio: "19:00",
  horaFim: "20:00",
  estado: "aguardando",
  criadaEm: "2026-09-25T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  quadras.mockResolvedValue({ data: [{ id: "q-1", nome: "Quadra Central" }] });
  cancelar.mockResolvedValue(undefined);
});

describe("SPEC-074/AC-020 — Avisos de horário", () => {
  it("lista o aviso com a quadra, o dia e a hora, e leva à quadra NAQUELE dia", async () => {
    meusAvisos.mockResolvedValue([AVISO]);
    render(<AvisosDeHorario />);

    expect(
      await screen.findByRole("heading", { name: "Avisos de horário" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Quadra Central")).toBeInTheDocument();
    // 02/10/2026 é uma sexta.
    expect(screen.getByText("SEX, 02/10 às 19:00")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/quadras/q-1?data=2026-10-02",
    );
  });

  it("cancelar chama a rota com o id, e o aviso sai da lista", async () => {
    meusAvisos.mockResolvedValue([
      AVISO,
      { ...AVISO, id: "av-2", horaInicio: "20:00", horaFim: "21:00" },
    ]);
    render(<AvisosDeHorario />);

    const botoes = await screen.findAllByRole("button", { name: "Cancelar" });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[0]);

    await waitFor(() => expect(cancelar).toHaveBeenCalledWith("av-1"));
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Cancelar" }),
      ).toHaveLength(1),
    );
  });

  it("a recusa do cancelamento aparece, e o aviso FICA", async () => {
    meusAvisos.mockResolvedValue([AVISO]);
    cancelar.mockRejectedValue(new ApiError(404, "Aviso não encontrado."));
    render(<AvisosDeHorario />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Aviso não encontrado.",
    );
    expect(screen.getByText("Quadra Central")).toBeInTheDocument();
  });

  it("sem avisos, não desenha NADA — e a lista vazia foi de fato carregada", async () => {
    meusAvisos.mockResolvedValue([]);
    const { container } = render(<AvisosDeHorario />);

    await waitFor(() => expect(meusAvisos).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("a falha ao carregar também não desenha nada", async () => {
    meusAvisos.mockRejectedValue(new ApiError(500, "falhou"));
    const { container } = render(<AvisosDeHorario />);

    await waitFor(() => expect(meusAvisos).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
