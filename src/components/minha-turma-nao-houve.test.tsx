import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhaTurmaDetalheView } from "./minha-turma-detalhe";

/**
 * TEST (SPEC-030:TASK-006) — a lista de ocorrências da turma, do professor.
 *
 * **Por que este arquivo existe em vez de linhas em
 * `minha-turma-detalhe.test.tsx`:** aquele arquivo mocka
 * `listarOcorrenciasDaTurma`, e a tela chama `listOcorrencias`. O mock não
 * intercepta nada — as provas de lá passam porque nenhuma delas afirma sobre
 * ocorrências. Corrigir o nome lá dentro faria as ocorrências passarem a
 * renderizar nas outras quatro provas, que não foram escritas contando com
 * isso. **Fica registrado como achado, e não remendado de passagem.**
 *
 * Aqui o mock aponta para o nome certo e devolve a forma certa: a resposta é
 * paginada (`{ data, page, pageSize, total }`), não um array.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/minhas-turmas/t1",
}));

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const getMinhaTurmaMock = vi.fn();
const listOcorrenciasMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getMinhaTurma: (...a: unknown[]) => getMinhaTurmaMock(...a),
    listOcorrencias: (...a: unknown[]) => listOcorrenciasMock(...a),
  };
});

function ocorrencia(over: Record<string, unknown>) {
  return {
    ocupacaoId: "oc1",
    data: "2026-08-25",
    horaInicio: "18:00",
    horaFim: "19:00",
    cancelada: false,
    chamadaFeita: true,
    marcados: 0,
    totalAlunos: 6,
    podeLancar: true,
    estado: "feita",
    ...over,
  };
}

function responder(ocorrencias: ReturnType<typeof ocorrencia>[]) {
  getMinhaTurmaMock.mockResolvedValue({
    id: "t1",
    nome: "Infantil A",
    encontros: [{ diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" }],
    quadraNome: "Quadra 1",
    nivelNome: "Iniciante",
    capacidade: 6,
    alunos: [],
  });
  listOcorrenciasMock.mockResolvedValue({
    data: ocorrencias,
    page: 1,
    pageSize: 20,
    total: ocorrencias.length,
  });
}

beforeEach(() => {
  getMinhaTurmaMock.mockReset();
  listOcorrenciasMock.mockReset();
});

describe("MinhaTurmaDetalheView — aula não realizada (SPEC-030)", () => {
  // `nao_houve` tem cabeçalho e ZERO presenças, então `chamadaFeita` vem
  // `true` e `marcados` vem 0. Sem tratar o estado ANTES de `chamadaFeita`, a
  // linha sairia "chamada feita · 0/6" — uma contagem que sugere chamada
  // vazia lançada pelo professor, que é o oposto do que aconteceu.
  it("diz 'aula não realizada', e não a contagem de presenças", async () => {
    responder([ocorrencia({ estado: "nao_houve", marcados: 0 })]);

    render(<MinhaTurmaDetalheView id="t1" />);

    expect(await screen.findByText("aula não realizada")).toBeInTheDocument();
    expect(screen.queryByText(/chamada feita/)).not.toBeInTheDocument();
  });

  it("a aula com chamada de verdade continua mostrando a contagem", async () => {
    responder([ocorrencia({ estado: "feita", marcados: 6 })]);

    render(<MinhaTurmaDetalheView id="t1" />);

    expect(await screen.findByText(/chamada feita · 6\/6/)).toBeInTheDocument();
  });

  // A precedência importa nos dois sentidos: cancelada continua ganhando de
  // tudo, como antes da SPEC-030.
  it("aula cancelada continua dizendo 'aula cancelada'", async () => {
    responder([
      ocorrencia({ cancelada: true, estado: "cancelada", podeLancar: false }),
    ]);

    render(<MinhaTurmaDetalheView id="t1" />);

    expect(await screen.findByText("aula cancelada")).toBeInTheDocument();
  });
});
