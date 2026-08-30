import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Paginacao } from "./paginacao";

/**
 * SPEC-027 — as provas do controle de paginação.
 *
 * Ele parece trivial e tem três decisões dentro: some quando cabe numa
 * página, o "até" é limitado pelo total, e as pontas desabilitam. As três já
 * são erro clássico de paginação — a segunda produz "mostrando 41–60 de 47".
 */

const props = {
  page: 2,
  pageSize: 20,
  total: 47,
  onMudar: vi.fn(),
  rotulo: "aulas anteriores",
};

describe("some quando não há o que paginar", () => {
  it("uma página só não desenha nada", () => {
    // Controle de paginação abaixo de uma página é ruído que ocupa a altura
    // de mais um item — num celular isso é caro.
    const { container } = render(
      <Paginacao {...props} page={1} total={12} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("exatamente o tamanho da página também não desenha", () => {
    // A fronteira: 20 de 20 é uma página, não duas.
    const { container } = render(
      <Paginacao {...props} page={1} total={20} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("um a mais já desenha", () => {
    render(<Paginacao {...props} page={1} total={21} />);

    expect(screen.getByText("1–20 de 21")).toBeInTheDocument();
  });
});

describe("a faixa que ela anuncia", () => {
  it("mostra o intervalo da página atual", () => {
    render(<Paginacao {...props} />);

    expect(screen.getByText("21–40 de 47")).toBeInTheDocument();
  });

  it("a última página não passa do total", () => {
    // Sem o `Math.min`, esta diria "41–60 de 47" — o erro mais comum de
    // paginação, e o que mais faz a pessoa desconfiar do número.
    render(<Paginacao {...props} page={3} />);

    expect(screen.getByText("41–47 de 47")).toBeInTheDocument();
  });
});

describe("as pontas", () => {
  it("na primeira página, voltar está desabilitado", () => {
    render(<Paginacao {...props} page={1} />);

    expect(
      screen.getByLabelText("Página anterior de aulas anteriores"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Próxima página de aulas anteriores"),
    ).toBeEnabled();
  });

  it("na última, avançar está desabilitado", () => {
    render(<Paginacao {...props} page={3} />);

    expect(
      screen.getByLabelText("Próxima página de aulas anteriores"),
    ).toBeDisabled();
  });

  it("enquanto carrega, as duas param", () => {
    // Sem isto, dois toques rápidos disparam duas buscas e a segunda resposta
    // pode chegar primeiro — a mesma corrida do DEF-021, numa lista.
    render(<Paginacao {...props} ocupado />);

    expect(
      screen.getByLabelText("Página anterior de aulas anteriores"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Próxima página de aulas anteriores"),
    ).toBeDisabled();
  });
});

describe("avisa quem chamou", () => {
  it("pede a página seguinte", () => {
    const onMudar = vi.fn();
    render(<Paginacao {...props} onMudar={onMudar} />);

    fireEvent.click(
      screen.getByLabelText("Próxima página de aulas anteriores"),
    );

    expect(onMudar).toHaveBeenCalledWith(3);
  });

  it("e a anterior", () => {
    const onMudar = vi.fn();
    render(<Paginacao {...props} onMudar={onMudar} />);

    fireEvent.click(
      screen.getByLabelText("Página anterior de aulas anteriores"),
    );

    expect(onMudar).toHaveBeenCalledWith(1);
  });
});
