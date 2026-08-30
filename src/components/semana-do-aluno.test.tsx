import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanaDoAluno } from "./semana-do-aluno";

/**
 * SPEC-029 — as provas da visão semanal das aulas do aluno.
 *
 * **O relógio é fixado em todas.** A tela decide qual semana abrir a partir de
 * "hoje", então sem `setSystemTime` estas provas mudariam de resultado
 * conforme o dia em que a suíte rodasse — o sorteio que o DEF-020 custou caro
 * duas vezes neste projeto, uma delas dentro da correção que o citava.
 *
 * **2026-09-02 é uma QUARTA.** A semana dela vai de domingo 30/08 a sábado
 * 05/09, e é isso que os números abaixo esperam.
 */

const QUARTA = new Date("2026-09-02T15:00:00.000Z"); // 12h em São Paulo

const aula = (patch: Record<string, unknown> = {}) => ({
  ocupacaoId: "o1",
  turmaId: "t1",
  turmaNome: "Iniciantes",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  // SPEC-030: campo obrigatório no contrato do aluno. O `tsc` cobrou esta
  // fixture, que é o comportamento desejado — contrato novo não pode entrar
  // sem que quem monta payload de teste seja obrigado a decidir o valor.
  naoRealizada: false,
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(QUARTA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("abre na semana de hoje", () => {
  it("mostra o intervalo de domingo a sábado", () => {
    render(<SemanaDoAluno aulas={[aula()]} />);

    expect(screen.getByText("30/08 – 05/09")).toBeInTheDocument();
  });

  it("e diz que é esta semana, com a contagem", () => {
    render(<SemanaDoAluno aulas={[aula()]} />);

    expect(screen.getByText("1 aula · esta semana")).toBeInTheDocument();
  });

  it("os sete dias aparecem, inclusive os sem aula", () => {
    // Mostrar só os dias com aula economizaria espaço e destruiria a
    // informação: o valor de ver a semana é enxergar os buracos.
    render(<SemanaDoAluno aulas={[aula()]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});

describe("a aula cai no dia certo", () => {
  it("duas aulas no mesmo dia ficam juntas", () => {
    render(
      <SemanaDoAluno
        aulas={[
          aula(),
          aula({ ocupacaoId: "o2", horaInicio: "20:00", horaFim: "21:00" }),
        ]}
      />,
    );

    expect(screen.getByText("2 aulas · esta semana")).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00/)).toBeInTheDocument();
    expect(screen.getByText(/20:00–21:00/)).toBeInTheDocument();
  });

  it("aula de outra semana NÃO aparece nesta", () => {
    // Sem esta, um componente que ignorasse a semana e listasse tudo passaria
    // nas provas de cima.
    render(<SemanaDoAluno aulas={[aula({ data: "2026-09-10" })]} />);

    expect(screen.getByText("Nenhuma aula · esta semana")).toBeInTheDocument();
    expect(screen.queryByText(/18:00–19:00/)).not.toBeInTheDocument();
  });
});

describe("dia vazio: o que a tela pode afirmar", () => {
  it("dia futuro sem aula diz 'Sem aula'", () => {
    render(<SemanaDoAluno aulas={[aula()]} />);

    // Quinta, sexta e sábado desta semana ainda não passaram.
    expect(screen.getAllByText("Sem aula").length).toBeGreaterThan(0);
  });

  it("dia JÁ PASSADO mostra '—', e não 'Sem aula'", () => {
    // `GET /me/classes` só devolve o futuro, então a aula pode ter existido
    // no domingo. Dizer "sem aula" ali seria a tela afirmando o que não sabe.
    render(<SemanaDoAluno aulas={[aula()]} />);

    // Domingo 30, segunda 31 e terça 01 já passaram na quarta 02.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("e explica o traço, só quando ele está na tela", () => {
    render(<SemanaDoAluno aulas={[aula()]} />);

    expect(screen.getByText(/já passaram/)).toBeInTheDocument();
  });
});

describe("navegar entre semanas", () => {
  it("a próxima semana muda o intervalo", () => {
    render(<SemanaDoAluno aulas={[aula({ data: "2026-09-10" })]} />);

    fireEvent.click(screen.getByLabelText("Próxima semana"));

    expect(screen.getByText("06/09 – 12/09")).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00/)).toBeInTheDocument();
  });

  it("a anterior também, e atravessa a virada de mês", () => {
    // 30/08 é domingo; a semana antes dele começa em 23/08. É a aritmética
    // que quebra à mão na virada de mês.
    render(<SemanaDoAluno aulas={[aula()]} />);

    fireEvent.click(screen.getByLabelText("Semana anterior"));

    expect(screen.getByText("23/08 – 29/08")).toBeInTheDocument();
  });

  it("fora da semana de hoje, aparece o atalho de volta", () => {
    render(<SemanaDoAluno aulas={[aula()]} />);
    expect(
      screen.queryByText("Voltar para esta semana"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Próxima semana"));
    fireEvent.click(screen.getByText("Voltar para esta semana"));

    expect(screen.getByText("30/08 – 05/09")).toBeInTheDocument();
  });
});

// **ACHADO 1 DA 2ª VALIDAÇÃO CRUZADA (ALTA)** — esta vista ignorava
// `naoRealizada`.
//
// O risco não é cosmético: o aluno se organiza pela semana. Uma aula que o
// gestor já marcou como não realizada aparecia como qualquer outra, e ele iria
// ao clube.
//
// A prova que faltava era exatamente esta — e é a que o validador escreveu e
// viu cair.
describe("SPEC-030 — a aula não realizada na Semana", () => {
  it("marca a aula, em vez de mostrá-la como normal", () => {
    render(<SemanaDoAluno aulas={[aula({ naoRealizada: true })]} />);

    expect(screen.getByText("Aula não realizada")).toBeInTheDocument();
  });

  it("a aula normal continua sem marca nenhuma", () => {
    // O par negativo: sem ele, marcar TUDO passaria na prova acima.
    render(<SemanaDoAluno aulas={[aula()]} />);

    expect(screen.queryByText("Aula não realizada")).not.toBeInTheDocument();
  });
});
