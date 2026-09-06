import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhaTurmaDetalheView } from "./minha-turma-detalhe";

/**
 * SPEC-031/AC-019b — **a ocorrência cancelada precisa virar link.**
 *
 * Sem ele o AC-019 era promessa sobre uma tela inalcançável: o professor não
 * tinha por onde ver quem avisou que ia faltar na aula que o clube cancelou —
 * que é exatamente quando a pergunta aparece.
 *
 * Isto não contradiz a regra que governa o resto do arquivo (*"a tela só não
 * oferece o que seria recusado"*): o destino entra em modo somente leitura e
 * não oferece ação nenhuma. O que a regra proíbe é oferecer uma **ação** que
 * seria recusada, não oferecer a **leitura** de um registro que existe.
 *
 * ## Por que arquivo próprio, e não mais um `describe` no de sempre
 *
 * `minha-turma-detalhe.test.tsx` mocka `listarOcorrenciasDaTurma` e devolve
 * um array. **O nome real é `listOcorrencias` e a resposta é paginada**
 * (`{ data, page, pageSize, total }`) — o mock de lá nunca precisou estar
 * certo porque nenhum teste dele afere ocorrência. `minha-turma-nao-houve`
 * documenta essa mesma armadilha no cabeçalho, e caí nela.
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
    chamadaFeita: false,
    marcados: 0,
    totalAlunos: 6,
    podeLancar: false,
    estado: "futura",
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

const linkDaChamada = () =>
  screen
    .queryAllByRole("link")
    .find((a) => a.getAttribute("href") === "/chamada/oc1");

describe("MinhaTurmaDetalheView — a aula cancelada é alcançável (AC-019b)", () => {
  beforeEach(() => {
    getMinhaTurmaMock.mockReset();
    listOcorrenciasMock.mockReset();
  });

  it("cancelada vira link, mesmo com podeLancar false", async () => {
    responder([
      ocorrencia({ cancelada: true, estado: "cancelada", podeLancar: false }),
    ]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await screen.findByText("aula cancelada");
    expect(linkDaChamada()).toBeTruthy();
  });

  /**
   * O contrapositivo, e ele é obrigatório: sem ele "vira link quando
   * cancelada" passaria também numa tela que faz link de tudo — e aí o
   * professor voltaria a tocar em aula futura para levar `422`, que é o
   * defeito de origem.
   */
  it("a futura NÃO cancelada continua sem link", async () => {
    responder([
      ocorrencia({ cancelada: false, estado: "futura", podeLancar: false }),
    ]);

    render(<MinhaTurmaDetalheView id="t1" />);

    await screen.findByText("ainda não aconteceu");
    expect(linkDaChamada()).toBeUndefined();
  });
});
