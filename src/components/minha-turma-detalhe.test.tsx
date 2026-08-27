import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhaTurmaDetalheView } from "./minha-turma-detalhe";

/**
 * SPEC-019/TASK-005 — o detalhe da turma no app do professor.
 *
 * **Esta tela foi o BLOQUEADOR 1 da validação cruzada da SPEC-019**, e este
 * arquivo é a prova que faltava para ele.
 *
 * A 1ª versão da spec listava só `GET /me/teacher/classes` no contrato e
 * esquecia `GET /me/teacher/classes/:id`. A lista do professor seria
 * atualizada e o detalhe continuaria esperando
 * `diaSemana`/`horaInicio`/`horaFim` — **tela branca no app do professor**,
 * exatamente o DEF-012 de 2026-08-26.
 *
 * E a tela não tinha teste nenhum: até esta task, `minha-turma-detalhe` e
 * `minhas-turmas-view` eram os dois únicos componentes de turma do app sem
 * cobertura.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/minhas-turmas/t1",
}));

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const getMinhaTurmaMock = vi.fn();
const listarOcorrenciasMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getMinhaTurma: (...a: unknown[]) => getMinhaTurmaMock(...a),
    listarOcorrenciasDaTurma: (...a: unknown[]) => listarOcorrenciasMock(...a),
  };
});

const TERCA = { diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" };
const SABADO = { diaSemana: 6, horaInicio: "07:00", horaFim: "08:30" };

function responder(encontros: typeof TERCA[]) {
  getMinhaTurmaMock.mockResolvedValue({
    id: "t1",
    nome: "Infantil A",
    encontros,
    quadraNome: "Quadra 1",
    nivelNome: "Iniciante",
    capacidade: 6,
    alunos: [],
  });
  listarOcorrenciasMock.mockResolvedValue([]);
}

beforeEach(() => {
  getMinhaTurmaMock.mockReset();
  listarOcorrenciasMock.mockReset().mockResolvedValue([]);
});

describe("MinhaTurmaDetalheView — SPEC-019", () => {
  it("mostra o encontro único, com dia e horário juntos", async () => {
    responder([TERCA]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await waitFor(() => {
      expect(screen.getByText("Infantil A")).toBeInTheDocument();
    });
    expect(screen.getByText("Terça, 18:00–19:00")).toBeInTheDocument();
  });

  it("mostra os DOIS quando a turma tem dois dias", async () => {
    // É o pedido que originou a spec. Sem isto, o professor de uma turma de
    // terça e sábado veria só a terça — e não teria como saber que falta algo.
    responder([TERCA, SABADO]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await waitFor(() => {
      expect(screen.getByText("Terça, 18:00–19:00")).toBeInTheDocument();
    });
    expect(screen.getByText("Sábado, 07:00–08:30")).toBeInTheDocument();
  });

  it("dia e horário andam JUNTOS no mesmo chip", async () => {
    // Antes eram dois chips fixos: um com o dia, outro com o horário. Numa
    // turma de dois dias isso produziria "Terça, Sábado" de um lado e dois
    // horários do outro, e ninguém saberia qual hora é de qual dia.
    responder([TERCA, SABADO]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await waitFor(() => {
      expect(screen.getByText("Terça, 18:00–19:00")).toBeInTheDocument();
    });
    // Nenhum elemento contém só o dia, ou só o horário.
    expect(screen.queryByText("Terça")).not.toBeInTheDocument();
    expect(screen.queryByText("18:00–19:00")).not.toBeInTheDocument();
  });

  it("turma SEM encontro não quebra a tela", async () => {
    // A INV-051 proíbe, e o servidor recusa. A tela ainda assim aguenta: uma
    // tela que estoura com dado improvável esconde o dado improvável.
    responder([]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await waitFor(() => {
      expect(screen.getByText("Infantil A")).toBeInTheDocument();
    });
  });
});
