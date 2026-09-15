import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItensDaReserva } from "./itens-da-reserva";

/** SPEC-054/D12 — os adicionais de uma reserva, nas abas Reservas e Anteriores. */
describe("ItensDaReserva", () => {
  it("lista quantidade e nome", () => {
    render(
      <ItensDaReserva
        adicionais={[
          { adicionalId: "ad-1", nome: "Raquete", quantidade: 2, valorUnitario: 15 },
          { adicionalId: "ad-2", nome: "Bola", quantidade: 1, valorUnitario: 5 },
        ]}
      />,
    );
    expect(screen.getByText("2× Raquete, 1× Bola")).toBeInTheDocument();
  });

  it("sem item, ou com o back anterior (sem o campo), não desenha nada", () => {
    const { container, rerender } = render(<ItensDaReserva adicionais={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ItensDaReserva adicionais={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
