import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MinhaTurma } from "@/lib/api-client";
import { TelaDoProfessor } from "./tela-do-professor";

/**
 * SPEC-052 — **a tela única do professor.**
 *
 * Três coisas em julgamento aqui, e nenhuma é visual:
 *
 * 1. **não há mais barra de abas** (AC-004) — a agenda É a tela;
 * 2. **o índice "Suas turmas"** (AC-012, AC-013) — o caminho para a ficha que
 *    NÃO depende de existir aula não cancelada no mês. É ele que mantém a
 *    SPEC-031/AC-019b: turma com a única aula cancelada não aparece na agenda,
 *    e sem o índice o professor ficaria sem chegar ao histórico;
 * 3. **nenhuma nota de avaliação** (AC-009) — a busca da média não acontece.
 */

const getAgendaDoProfessor = vi.hoisted(() => vi.fn());
const getAulasDoDia = vi.hoisted(() => vi.fn());
const listMinhasTurmas = vi.hoisted(() => vi.fn());
const getMediaDaTurma = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getAgendaDoProfessor,
    getAulasDoDia,
    listMinhasTurmas,
    getMediaDaTurma,
  };
});

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const TURMA: MinhaTurma = {
  id: "t-1",
  nome: "Infantil A",
  encontros: [{ diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" }],
  quadraNome: "Quadra 1",
  nivelNome: null,
  capacidade: 6,
  totalAlunos: 4,
};

const OUTRA: MinhaTurma = { ...TURMA, id: "t-2", nome: "Adulto B" };

beforeEach(() => {
  vi.clearAllMocks();
  getAulasDoDia.mockResolvedValue([]);
  getMediaDaTurma.mockResolvedValue({ media: 4, avaliacoes: 3 });
});

describe("TelaDoProfessor — SPEC-052", () => {
  it("AC-012: agenda do mês VAZIA, e ainda assim a turma é alcançável pelo índice", async () => {
    // O cenário da AC-012: a única aula do período está cancelada, então o
    // resumo do mês não traz nada.
    getAgendaDoProfessor.mockResolvedValue([]);
    listMinhasTurmas.mockResolvedValue([TURMA]);

    render(<TelaDoProfessor />);

    expect(
      await screen.findByText("Nenhuma aula sua neste mês."),
    ).toBeInTheDocument();
    const indice = await screen.findByRole("region", { name: "Suas turmas" });
    expect(
      within(indice).getByRole("link", { name: /Infantil A/ }),
    ).toHaveAttribute("href", "/minhas-turmas/t-1");
  });

  it("AC-013: o índice lista exatamente as turmas que a API devolve, cada uma com a sua ficha", async () => {
    getAgendaDoProfessor.mockResolvedValue([]);
    listMinhasTurmas.mockResolvedValue([TURMA, OUTRA]);

    render(<TelaDoProfessor />);

    const indice = await screen.findByRole("region", { name: "Suas turmas" });
    await waitFor(() =>
      expect(within(indice).getAllByRole("link")).toHaveLength(2),
    );
    expect(
      within(indice)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/minhas-turmas/t-1", "/minhas-turmas/t-2"]);
  });

  it("AC-004: não há barra de abas", async () => {
    getAgendaDoProfessor.mockResolvedValue([]);
    listMinhasTurmas.mockResolvedValue([TURMA]);

    render(<TelaDoProfessor />);

    // Espera a AGENDA, não o índice: esta prova é sobre abas, e não pode
    // depender de outra peça da tela existir.
    await screen.findByText("Nenhuma aula sua neste mês.");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("AC-009: a tela do professor não busca nem mostra nota de avaliação", async () => {
    getAgendaDoProfessor.mockResolvedValue([]);
    listMinhasTurmas.mockResolvedValue([TURMA, OUTRA]);

    render(<TelaDoProfessor />);

    await screen.findByText("Nenhuma aula sua neste mês.");
    await waitFor(() => expect(listMinhasTurmas).toHaveBeenCalled());
    expect(getMediaDaTurma).not.toHaveBeenCalled();
  });

  it("professor sem turma: o índice diz o que fazer, em vez de sumir", async () => {
    getAgendaDoProfessor.mockResolvedValue([]);
    listMinhasTurmas.mockResolvedValue([]);

    render(<TelaDoProfessor />);

    expect(
      await screen.findByText("Nenhuma turma atribuída a você"),
    ).toBeInTheDocument();
  });
});
