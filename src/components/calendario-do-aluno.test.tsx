import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  CalendarioDoAluno,
  janelaDoMes,
  rotuloDoDia,
} from "./calendario-do-aluno";
import type { MyClass } from "@/lib/api-client";

/**
 * **O relógio é fixado, e isto não é zelo excessivo.** O componente abre no
 * mês de hoje; sem fixar, todo teste que clica no dia 17 vira verde em
 * setembro e vermelho em outubro — a suíte passaria a mentir sozinha, sem
 * ninguém ter tocado no código.
 */
vi.mock("@/lib/fuso", async () => {
  const real = await vi.importActual<typeof import("@/lib/fuso")>("@/lib/fuso");
  return {
    ...real,
    hojeNoClube: () => ({ ano: 2026, mes: 9, dia: 18 }),
    hojeNoClubeIso: () => "2026-09-18",
  };
});

/**
 * TEST — SPEC-058/D1 e D2, **o calendário do aluno**.
 *
 * O que se prova aqui é o que a grade promete: dia com aula tem marca, dia
 * clicado abre a lista, trocar de mês avisa a janela, e mês vazio é
 * informação — não erro. O `aria-label` entra em quase todos os testes de
 * propósito: a cor sozinha não pode carregar a informação, e o jeito de
 * garantir isso é ler o rótulo.
 */
const aula = (over: Partial<MyClass> = {}): MyClass =>
  ({
    ocupacaoId: "o1",
    turmaId: "t1",
    turmaNome: "Turma Intermediário",
    quadraId: "q1",
    quadraNome: "Quadra 1",
    data: "2026-09-17",
    horaInicio: "19:00:00",
    horaFim: "20:00:00",
    naoRealizada: false,
    faltaAvisada: false,
    ...over,
  }) as MyClass;

describe("janelaDoMes", () => {
  it("cobre do dia 1 ao último, inclusive em fevereiro bissexto", () => {
    expect(janelaDoMes(2026, 9)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    expect(janelaDoMes(2028, 2)).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
  });
});

describe("rotuloDoDia", () => {
  it("diz sem aula, quantas aulas, e quantas com falta avisada", () => {
    expect(rotuloDoDia(3, [])).toBe("3, sem aula");
    expect(rotuloDoDia(17, [aula()])).toBe("17: 1 aula");
    expect(rotuloDoDia(17, [aula(), aula({ ocupacaoId: "o2" })])).toBe(
      "17: 2 aulas",
    );
    expect(rotuloDoDia(17, [aula({ faltaAvisada: true })])).toBe(
      "17: 1 aula, 1 com falta avisada",
    );
  });
});

describe("CalendarioDoAluno", () => {
  it("marca o dia com aula e deixa o dia vazio sem marca", () => {
    render(<CalendarioDoAluno aulas={[aula({ data: "2026-09-17" })]} />);

    const comAula = screen.getByRole("button", { name: /^17: 1 aula$/ });
    expect(within(comAula).queryByText("17")).toBeInTheDocument();
    expect(comAula.querySelector("[data-marca-de-aula]")).not.toBeNull();

    const semAula = screen.getByRole("button", { name: "16, sem aula" });
    expect(semAula.querySelector("[data-marca-de-aula]")).toBeNull();
  });

  it("o dia com falta avisada ganha o segundo marcador", () => {
    render(<CalendarioDoAluno aulas={[aula({ faltaAvisada: true })]} />);

    const dia = screen.getByRole("button", { name: /17: 1 aula, 1 com falta/ });
    expect(dia.querySelector("[data-falta-avisada]")).not.toBeNull();
  });

  it("clicar no dia lista as aulas dele", () => {
    render(
      <CalendarioDoAluno
        aulas={[
          aula({ data: "2026-09-17", turmaNome: "Intermediário" }),
          aula({ ocupacaoId: "o2", data: "2026-09-21", turmaNome: "Beach" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^17: 1 aula$/ }));

    expect(screen.getByText("Intermediário")).toBeInTheDocument();
    expect(screen.queryByText("Beach")).not.toBeInTheDocument();
  });

  // AC-002 — o segundo toque no mesmo dia não pode fechar a lista: seria
  // esvaziar justamente o que a pessoa foi ler.
  it("clicar duas vezes no mesmo dia mantém a lista aberta", () => {
    render(<CalendarioDoAluno aulas={[aula({ turmaNome: "Intermediário" })]} />);
    const dia = screen.getByRole("button", { name: /^17: 1 aula$/ });

    fireEvent.click(dia);
    fireEvent.click(dia);

    expect(screen.getByText("Intermediário")).toBeInTheDocument();
    expect(dia).toHaveAttribute("aria-pressed", "true");
  });

  it("trocar de mês avisa a janela nova", () => {
    const onJanela = vi.fn();
    render(<CalendarioDoAluno aulas={[aula()]} onJanela={onJanela} />);

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(onJanela).toHaveBeenCalledTimes(1);
    const { de, ate } = onJanela.mock.calls[0][0];
    expect(de.slice(-2)).toBe("01");
    expect(ate > de).toBe(true);
  });

  // AC-004 — mês sem aula nenhuma é informação, e a grade continua de pé.
  it("mês vazio mostra a grade e diz que não há aula", () => {
    render(<CalendarioDoAluno aulas={[]} />);

    expect(screen.getByText("Nenhuma aula neste mês.")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("na home a aula não vira link; em /minhas-aulas vira", () => {
    const { rerender } = render(
      <CalendarioDoAluno aulas={[aula()]} mostrarLinkDaTurma={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 aula$/ }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<CalendarioDoAluno aulas={[aula()]} mostrarLinkDaTurma />);
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 aula$/ }));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/minhas-aulas/turma/t1",
    );
  });
});
