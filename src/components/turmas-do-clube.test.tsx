import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TurmasDoClube } from "./turmas-do-clube";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-023 — as provas da tela em que o aluno entra e sai de turma.
 *
 * O que elas guardam é o que a spec decidiu **contra** o caminho fácil:
 * turma cheia aparece em vez de sumir; o motivo fica à vista embaixo do
 * botão apagado; e a contagem se corrige quando o servidor desmente a tela.
 */

const listTurmasDisponiveis = vi.hoisted(() => vi.fn());
const entrarNaTurma = vi.hoisted(() => vi.fn());
const sairDaTurma = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listTurmasDisponiveis,
    entrarNaTurma,
    sairDaTurma,
  };
});

function turma(patch: Record<string, unknown> = {}) {
  return {
    id: "t1",
    nome: "Iniciantes",
    status: "ativa",
    capacidade: 8,
    matriculados: 6,
    jaEstouNela: false,
    podeEntrar: true,
    motivo: null,
    encontros: [{ diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" }],
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  entrarNaTurma.mockResolvedValue(undefined);
  sairDaTurma.mockResolvedValue(undefined);
});

describe("a ocupação à vista (pedido do Israel)", () => {
  it("mostra quantos já estão e qual o limite", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("6 de 8")).toBeInTheDocument();
  });

  it("a barra de ocupação anuncia os mesmos números para leitor de tela", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    const barra = await screen.findByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "6");
    expect(barra).toHaveAttribute("aria-valuemax", "8");
  });
});

describe("turma cheia aparece, marcada", () => {
  it("não some da lista", async () => {
    // Some com ela e a pessoa pergunta no WhatsApp por que a turma das 18h
    // não está lá.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
    ]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("Iniciantes")).toBeInTheDocument();
    expect(screen.getByText("· sem vagas")).toBeInTheDocument();
  });

  it("o botão fica desabilitado COM o motivo à vista", async () => {
    // Botão apagado sem explicação é a pessoa tocando de novo achando que
    // falhou.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
    ]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByRole("button", { name: "Entrar na turma" }),
    ).toBeDisabled();
    expect(screen.getByText("Sem vagas")).toBeInTheDocument();
  });

  it("a explicação é escolhida pelo CÓDIGO, não pela mensagem do servidor", async () => {
    // O código é o contrato (schema publicado, LIM-004); a mensagem é copy e
    // muda sem aviso. Tela que decide por mensagem quebra calada.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ podeEntrar: false, motivo: "LIMITE_DE_TURMAS" }),
    ]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByText("Você atingiu o limite de turmas deste clube"),
    ).toBeInTheDocument();
  });

  it("código desconhecido não quebra a tela", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ podeEntrar: false, motivo: "MOTIVO_QUE_AINDA_NAO_EXISTE" }),
    ]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("Não disponível")).toBeInTheDocument();
  });
});

describe("entrar e sair", () => {
  it("entra e recarrega a lista", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    fireEvent.click(await screen.findByRole("button", { name: "Entrar na turma" }));

    await waitFor(() => expect(entrarNaTurma).toHaveBeenCalledWith("t1"));
    expect(listTurmasDisponiveis).toHaveBeenCalledTimes(2);
  });

  it("quem já está na turma vê SAIR, não entrar", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByRole("button", { name: "Sair da turma" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar na turma" }),
    ).not.toBeInTheDocument();
  });

  it("recusa de saída no dia da aula mostra a mensagem do servidor", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    sairDaTurma.mockRejectedValue(
      new ApiError(409, "Esta turma tem aula hoje.", "AULA_HOJE"),
    );
    render(<TurmasDoClube />);

    fireEvent.click(await screen.findByRole("button", { name: "Sair da turma" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta turma tem aula hoje.",
    );
  });
});

describe("a contagem envelhece — e a tela não insiste nela", () => {
  it("depois de TURMA_CHEIA, a lista é recarregada", async () => {
    // Dúvida 2 da spec: entre pintar "7 de 8" e a pessoa tocar, alguém pode
    // entrar. A tela informa, o servidor decide sob trava. O que não é
    // aceitável é continuar mostrando 7 depois de o servidor desmentir.
    listTurmasDisponiveis
      .mockResolvedValueOnce([turma({ matriculados: 7 })])
      .mockResolvedValueOnce([
        turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
      ]);
    entrarNaTurma.mockRejectedValue(
      new ApiError(409, "Esta turma já está com todas as vagas ocupadas.", "TURMA_CHEIA"),
    );

    render(<TurmasDoClube />);
    fireEvent.click(await screen.findByRole("button", { name: "Entrar na turma" }));

    expect(await screen.findByText("8 de 8")).toBeInTheDocument();
    expect(screen.queryByText("7 de 8")).not.toBeInTheDocument();
  });
});

describe("estados vazios", () => {
  it("clube sem turmas diz isso, em vez de mostrar lista vazia", async () => {
    listTurmasDisponiveis.mockResolvedValue([]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByText("Este clube ainda não tem turmas cadastradas."),
    ).toBeInTheDocument();
  });
});
