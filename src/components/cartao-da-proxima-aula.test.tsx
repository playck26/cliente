import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CartaoDaProximaAula,
  contagem,
  proximaAula,
} from "./cartao-da-proxima-aula";
import type { MyClass } from "@/lib/api-client";

/**
 * TEST — SPEC-058/D3, **o cartão que voltou**.
 *
 * A parte que erra fácil é a contagem, e ela erra de um jeito específico: a
 * aula das 8h de amanhã, vista às 22h de hoje, está a 10 horas — mas a
 * palavra que a pessoa espera é "amanhã". Por isso as horas saem da
 * diferença de INSTANTES e os dias da diferença de DATAS, e por isso estes
 * testes fixam as duas na fronteira.
 */
const aula = (over: Partial<MyClass> = {}): MyClass =>
  ({
    ocupacaoId: "o1",
    turmaId: "t1",
    turmaNome: "Turma Intermediário",
    quadraId: "q1",
    quadraNome: "Quadra 1",
    data: "2026-09-18",
    horaInicio: "19:00:00",
    horaFim: "20:00:00",
    naoRealizada: false,
    faltaAvisada: false,
    ...over,
  }) as MyClass;

describe("contagem", () => {
  it("aula de hoje daqui a três horas", () => {
    expect(
      contagem(aula(), Date.parse("2026-09-18T19:00:00.000Z"), "2026-09-18"),
    ).toBe("em 3 horas");
  });

  it("uma hora fica no singular", () => {
    expect(
      contagem(aula(), Date.parse("2026-09-18T21:00:00.000Z"), "2026-09-18"),
    ).toBe("em 1 hora");
  });

  it("aula que já começou não vira número negativo", () => {
    expect(
      contagem(aula(), Date.parse("2026-09-18T22:30:00.000Z"), "2026-09-18"),
    ).toBe("agora");
  });

  // A fronteira: 10 horas de distância, mas outro DIA.
  it("às 22h de hoje, a aula das 8h de amanhã é 'amanhã', não 'em 10 horas'", () => {
    expect(
      contagem(
        aula({ data: "2026-09-19", horaInicio: "08:00:00" }),
        Date.parse("2026-09-19T01:00:00.000Z"), // 22h de 18/09 em São Paulo
        "2026-09-18",
      ),
    ).toBe("amanhã às 08:00");
  });

  it("dois dias ou mais conta em dias", () => {
    expect(
      contagem(
        aula({ data: "2026-09-22" }),
        Date.parse("2026-09-18T12:00:00.000Z"),
        "2026-09-18",
      ),
    ).toBe("em 4 dias");
  });
});

describe("proximaAula", () => {
  it("pega a mais cedo do dia mais próximo, e ignora o passado", () => {
    const escolhida = proximaAula(
      [
        aula({ ocupacaoId: "tarde", data: "2026-09-20", horaInicio: "20:00:00" }),
        aula({ ocupacaoId: "passado", data: "2026-09-10" }),
        aula({ ocupacaoId: "cedo", data: "2026-09-20", horaInicio: "08:00:00" }),
      ],
      "2026-09-18",
    );
    expect(escolhida?.ocupacaoId).toBe("cedo");
  });

  it("aula que não aconteceu não é próxima aula", () => {
    const escolhida = proximaAula(
      [aula({ ocupacaoId: "cancelada", naoRealizada: true })],
      "2026-09-18",
    );
    expect(escolhida).toBeNull();
  });
});

describe("CartaoDaProximaAula", () => {
  it("mostra turma e horário — e NÃO a quadra", () => {
    render(<CartaoDaProximaAula aulas={[aula({ data: "2099-01-01" })]} />);

    expect(screen.getByText("Turma Intermediário")).toBeInTheDocument();
    expect(screen.getByText(/19:00–20:00/)).toBeInTheDocument();
    // SPEC-053/AC-001 — a home não escreve "quadra". O cartão mora nela.
    expect(screen.queryByText(/[Qq]uadra/)).not.toBeInTheDocument();
  });

  // AC-007 — sem aula ele NÃO some: a home não pode pular de altura, e quem
  // não tem turma é quem mais precisa do convite.
  it("sem aula futura, convida em vez de sumir", () => {
    render(<CartaoDaProximaAula aulas={[]} />);

    expect(screen.getByText("Nenhuma aula marcada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver turmas do clube" }),
    ).toHaveAttribute("href", "/minhas-aulas/turmas");
  });

  it("quem avisou que vai faltar lê isso no cartão", () => {
    render(
      <CartaoDaProximaAula
        aulas={[aula({ data: "2099-01-01", faltaAvisada: true })]}
      />,
    );

    expect(
      screen.getByText("Você avisou que vai faltar nesta aula."),
    ).toBeInTheDocument();
  });
});
