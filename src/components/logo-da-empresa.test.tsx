import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoDaEmpresa } from "./logo-da-empresa";

/**
 * SPEC-018/TASK-006 — as provas da marca do clube.
 *
 * A decisão que este arquivo guarda não é visual: é **de quem é a marca**.
 * Sem logo, o componente mostra a inicial do clube, e **nunca** a marca do
 * PlayCK — o aluno abre o app da escola dele, e pôr a marca do fornecedor no
 * lugar diria a coisa errada todos os dias.
 */
describe("LogoDaEmpresa", () => {
  it("desenha a logo quando o servidor resolveu uma URL", () => {
    render(<LogoDaEmpresa url="https://cdn/x.webp" nome="Smart Tennis" />);
    const img = screen.getByAltText("Logo Smart Tennis");
    expect(img).toHaveAttribute("src", "https://cdn/x.webp");
  });

  it("sem logo, mostra a inicial do clube — não a marca do PlayCK", () => {
    render(<LogoDaEmpresa url={null} nome="Smart Tennis" />);
    expect(screen.getByRole("img", { name: "Logo Smart Tennis" })).toHaveTextContent(
      "S",
    );
    expect(screen.queryByAltText(/playck/i)).not.toBeInTheDocument();
  });

  it("sem logo e sem nome, não anuncia nada a leitor de tela", () => {
    // Um "•" lido em voz alta em toda tela seria ruído puro.
    const { container } = render(<LogoDaEmpresa url={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("quem chama decide o tamanho", () => {
    const { container } = render(
      <LogoDaEmpresa url="https://cdn/x.webp" nome="X" className="size-20" />,
    );
    expect(container.querySelector("img")?.className).toContain("size-20");
  });
});
