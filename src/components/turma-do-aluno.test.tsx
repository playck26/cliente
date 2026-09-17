import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { TurmaDoAlunoView } from "./turma-do-aluno";

/**
 * SPEC-057/TASK-002 (card 5352) — **a ficha da turma, do lado do aluno.**
 *
 * > *"gostaria de ver o que tem na minha turma: professor, outros alunos,
 * > nível da turma"*
 *
 * **Esta tela mostra o nome de outras pessoas**, e é a primeira do app do
 * aluno a fazer isso. O recorte foi autorizado pelo Israel (nome e nível), e
 * o servidor não devolve mais que isso — mas a tela também não pode inventar
 * afordância sobre gente: não há link, não há contato, não há ação sobre
 * colega.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/minhas-aulas/turma/t1",
}));

const getMinhaTurmaDoAluno = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMinhaTurmaDoAluno };
});

const TURMA = {
  id: "t1",
  nome: "Infantil A",
  status: "ativa" as const,
  capacidade: 6,
  quadraNome: "Quadra 1",
  nivelNome: "Iniciante",
  professorNome: "Ana Coach",
  encontros: [{ diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" }],
  colegas: [
    { nome: "Eu Mesmo", nivelNome: "Iniciante", souEu: true },
    { nome: "Colega Silva", nivelNome: null, souEu: false },
  ],
};

describe("TurmaDoAlunoView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMinhaTurmaDoAluno.mockResolvedValue(TURMA);
  });

  it("mostra o professor, o nível e a quadra — as três coisas do card", async () => {
    render(<TurmaDoAlunoView id="t1" />);

    expect(await screen.findByText("Infantil A")).toBeInTheDocument();
    expect(screen.getByText("Ana Coach")).toBeInTheDocument();
    expect(screen.getByText("Quadra 1")).toBeInTheDocument();
    // "Iniciante" é o nível da TURMA e também o de um colega — a asserção
    // solta acharia os dois e passaria sem o chip existir.
    expect(screen.getAllByText("Iniciante").length).toBe(2);
  });

  it("lista os colegas, e marca qual é você", async () => {
    render(<TurmaDoAlunoView id="t1" />);

    expect(await screen.findByText("Colega Silva")).toBeInTheDocument();
    const minhaLinha = screen.getByText("Eu Mesmo").closest("li");
    expect(minhaLinha).toHaveTextContent("você");
  });

  /**
   * **A tela não inventa afordância sobre gente.** Um nome que parece
   * clicável promete um perfil que não existe — e não deve existir.
   */
  it("colega não é link nem botão", async () => {
    render(<TurmaDoAlunoView id="t1" />);

    const colega = await screen.findByText("Colega Silva");
    expect(colega.closest("a")).toBeNull();
    expect(colega.closest("button")).toBeNull();
  });

  it("turma sem professor não escreve `null` na tela", async () => {
    getMinhaTurmaDoAluno.mockResolvedValue({
      ...TURMA,
      professorNome: null,
      nivelNome: null,
    });

    render(<TurmaDoAlunoView id="t1" />);

    await screen.findByText("Infantil A");
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.getByText(/Sem professor definido/)).toBeInTheDocument();
  });

  it("turma inativa diz que é inativa", async () => {
    getMinhaTurmaDoAluno.mockResolvedValue({ ...TURMA, status: "inativa" });

    render(<TurmaDoAlunoView id="t1" />);

    expect(await screen.findByText("Turma inativa")).toBeInTheDocument();
  });

  /**
   * **404 tem texto próprio.** É a resposta para turma de que ele não
   * participa — e a tela não pode sugerir que houve falha de rede, nem que a
   * turma existe.
   */
  it("404 diz `turma não encontrada`, e não `erro ao carregar`", async () => {
    // **O `ApiError` real**, e não um dublê: o componente decide por
    // `instanceof`, e um dublê cairia no ramo genérico — a prova passaria a
    // medir o mock.
    getMinhaTurmaDoAluno.mockRejectedValue(new ApiError(404, "nao"));

    render(<TurmaDoAlunoView id="t1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não encontrada/i,
    );
  });

  it("falha de verdade aparece como falha", async () => {
    getMinhaTurmaDoAluno.mockRejectedValue(new Error("rede"));

    render(<TurmaDoAlunoView id="t1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar/i,
    );
  });
});
