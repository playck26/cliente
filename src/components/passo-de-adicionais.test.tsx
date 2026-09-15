import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PassoDeAdicionais, contarBlocos } from "./passo-de-adicionais";

/**
 * SPEC-054/D12 — **o passo "Adicionais" do app do aluno.**
 *
 * `+`/`−` limitados ao `disponivel`; clube sem adicional ativo **pula o
 * passo** (o componente não desenha nada); a soma informada é a de UMA reserva.
 */

const disponiveis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, adicionaisDisponiveis: disponiveis };
});

const RAQUETE = {
  id: "ad-1",
  tipoId: "t-1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  disponivel: 2,
};
const BOLA = { ...RAQUETE, id: "ad-2", nome: "Bola", preco: 5, disponivel: 0 };

beforeEach(() => {
  disponiveis.mockReset();
});

describe("contarBlocos", () => {
  it("horários seguidos são UMA reserva; separados, uma cada", () => {
    expect(contarBlocos(["09:00-10:00", "10:00-11:00"])).toBe(1);
    expect(contarBlocos(["15:00-16:00", "09:00-10:00"])).toBe(2);
    expect(contarBlocos(["09:00-10:00", "11:00-12:00", "10:00-11:00"])).toBe(1);
    expect(contarBlocos([])).toBe(0);
  });
});

describe("PassoDeAdicionais", () => {
  it("clube sem adicional ativo: não desenha nada (o passo é pulado)", async () => {
    disponiveis.mockResolvedValue([]);
    const { container } = render(
      <PassoDeAdicionais data="2035-06-07" slots={["09:00-10:00"]} onChange={vi.fn()} />,
    );
    await waitFor(() => expect(disponiveis).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("o `+` para no disponível, e o esgotado diz que esgotou", async () => {
    disponiveis.mockResolvedValue([RAQUETE, BOLA]);
    const onChange = vi.fn();
    render(
      <PassoDeAdicionais data="2035-06-07" slots={["09:00-10:00"]} onChange={onChange} />,
    );
    const mais = await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(mais);
    fireEvent.click(mais);
    expect(mais).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mais Bola" })).toBeDisabled();
    expect(screen.getByText(/esgotado neste horário/)).toBeInTheDocument();

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        [{ adicionalId: "ad-1", quantidade: 2 }],
        30,
      ),
    );
  });

  it("o `−` volta a zero e tira o item da escolha", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    const onChange = vi.fn();
    render(
      <PassoDeAdicionais data="2035-06-07" slots={["09:00-10:00"]} onChange={onChange} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    fireEvent.click(screen.getByRole("button", { name: "Menos Raquete" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([], 0));
  });

  it("trocar a `chave` relê e recorta a escolha ao que sobrou (LIM-054j)", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    const onChange = vi.fn();
    const { rerender } = render(
      <PassoDeAdicionais
        data="2035-06-07"
        slots={["09:00-10:00"]}
        onChange={onChange}
        chave={0}
      />,
    );
    const mais = await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(mais);
    fireEvent.click(mais);

    disponiveis.mockResolvedValue([{ ...RAQUETE, disponivel: 1 }]);
    rerender(
      <PassoDeAdicionais
        data="2035-06-07"
        slots={["09:00-10:00"]}
        onChange={onChange}
        chave={1}
      />,
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        [{ adicionalId: "ad-1", quantidade: 1 }],
        15,
      ),
    );
    expect(disponiveis).toHaveBeenCalledTimes(2);
  });
});
