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
const listOcorrenciasMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getMinhaTurma: (...a: unknown[]) => getMinhaTurmaMock(...a),
    listarOcorrenciasDaTurma: (...a: unknown[]) => listarOcorrenciasMock(...a),
    // SPEC-052: a tela chama `listOcorrencias`; sem este mock a lista caía no
    // `catch` em silêncio e nenhum caso aqui via ocorrência.
    listOcorrencias: (...a: unknown[]) => listOcorrenciasMock(...a),
  };
});

const TERCA = { diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" };
const SABADO = { diaSemana: 6, horaInicio: "07:00", horaFim: "08:30" };

function responder(
  encontros: typeof TERCA[],
  status: "ativa" | "inativa" = "ativa",
) {
  getMinhaTurmaMock.mockResolvedValue({
    id: "t1",
    nome: "Infantil A",
    encontros,
    quadraNome: "Quadra 1",
    nivelNome: "Iniciante",
    capacidade: 6,
    alunos: [],
    status,
  });
  listarOcorrenciasMock.mockResolvedValue([]);
  listOcorrenciasMock.mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 30,
    total: 0,
  });
}

beforeEach(() => {
  getMinhaTurmaMock.mockReset();
  listOcorrenciasMock.mockReset();
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

/**
 * SPEC-052/AC-012 — **o meio da cadeia índice → ficha → aula cancelada.**
 *
 * A agenda do professor exclui aula cancelada, e a SPEC-052 tirou a lista de
 * turmas; o caminho que a SPEC-031/AC-019b exige passa a ser o índice "Suas
 * turmas" (provado em `tela-do-professor.test.tsx`) e ESTE link. O fim da
 * cadeia — a chamada em modo histórico, sem mutação — já tem prova em
 * `chamada-historico.test.tsx`.
 */
describe("SPEC-052/AC-012 — a ficha leva à aula cancelada", () => {
  it("a ocorrência cancelada é link para a chamada", async () => {
    responder([TERCA]);
    listOcorrenciasMock.mockResolvedValue({
      data: [
        {
          ocupacaoId: "ocup-cancelada",
          data: "2026-09-01",
          horaInicio: "18:00",
          horaFim: "19:00",
          cancelada: true,
          chamadaFeita: false,
          marcados: 0,
          totalAlunos: 4,
          podeLancar: false,
          estado: "cancelada",
        },
      ],
      page: 1,
      pageSize: 30,
      total: 1,
    });

    render(<MinhaTurmaDetalheView id="t1" />);

    const link = await screen.findByRole("link", { name: /aula cancelada/ });
    expect(link).toHaveAttribute("href", "/chamada/ocup-cancelada");
  });
});

/**
 * SPEC-056 — **a ficha de turma inativa diz o que é, e alcança a aula.**
 *
 * O rótulo "Turma ativa" era fixo. E a janela de 30 dias não bastava: a inativa
 * entra no índice com aula nos últimos 90 dias, então a ficha dela pede 90 —
 * senão a aula de 60 dias atrás, que a trouxe ao índice, não estaria aqui.
 */
describe("SPEC-056 — a ficha da turma inativa", () => {
  it("AC-005: diz \"Turma inativa\", nunca \"Turma ativa\"", async () => {
    responder([TERCA], "inativa");
    render(<MinhaTurmaDetalheView id="t1" />);
    expect(await screen.findByText("Turma inativa")).toBeInTheDocument();
    expect(screen.queryByText("Turma ativa")).not.toBeInTheDocument();
  });

  it("a ativa continua dizendo \"Turma ativa\", e pede só 30 dias", async () => {
    responder([TERCA]);
    render(<MinhaTurmaDetalheView id="t1" />);
    expect(await screen.findByText("Turma ativa")).toBeInTheDocument();
    await waitFor(() => expect(listOcorrenciasMock).toHaveBeenCalled());
    expect(listOcorrenciasMock.mock.calls.every((c) => c[1] === 30)).toBe(true);
  });

  it("a inativa pede as aulas de 90 dias, e a cancelada leva à chamada (AC-004)", async () => {
    responder([TERCA], "inativa");
    listOcorrenciasMock.mockImplementation((_id: string, dias: number) =>
      Promise.resolve(
        dias === 90
          ? {
              data: [
                {
                  ocupacaoId: "ocup-60-dias",
                  data: "2026-07-17",
                  horaInicio: "18:00",
                  horaFim: "19:00",
                  cancelada: true,
                  chamadaFeita: false,
                  marcados: 0,
                  totalAlunos: 4,
                  podeLancar: false,
                  estado: "cancelada",
                },
              ],
              page: 1,
              pageSize: 20,
              total: 1,
            }
          : { data: [], page: 1, pageSize: 20, total: 0 },
      ),
    );
    render(<MinhaTurmaDetalheView id="t1" />);

    const link = await screen.findByRole("link", { name: /aula cancelada/ });
    expect(link).toHaveAttribute("href", "/chamada/ocup-60-dias");
    expect(listOcorrenciasMock).toHaveBeenCalledWith("t1", 90, 1);
  });

  it("a resposta de 30 dias que chega DEPOIS da de 90 não apaga a lista", async () => {
    responder([TERCA], "inativa");
    let soltar30: (v: unknown) => void = () => undefined;
    listOcorrenciasMock.mockImplementation((_id: string, dias: number) =>
      dias === 30
        ? new Promise((r) => {
            soltar30 = r;
          })
        : Promise.resolve({
            data: [
              {
                ocupacaoId: "ocup-60-dias",
                data: "2026-07-17",
                horaInicio: "18:00",
                horaFim: "19:00",
                cancelada: true,
                chamadaFeita: false,
                marcados: 0,
                totalAlunos: 4,
                podeLancar: false,
                estado: "cancelada",
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          }),
    );
    render(<MinhaTurmaDetalheView id="t1" />);
    await screen.findByRole("link", { name: /aula cancelada/ });

    soltar30({ data: [], page: 1, pageSize: 20, total: 0 });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("link", { name: /aula cancelada/ })).toBeInTheDocument();
  });
});
