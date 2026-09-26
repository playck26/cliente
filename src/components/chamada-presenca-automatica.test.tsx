import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isoDeOffsetNoClube } from "@/lib/fuso";
import { ChamadaView } from "./chamada-view";

/**
 * SPEC-057 → SPEC-076/D1 — **a tela diz de onde veio o registro.**
 *
 * Os casos antigos deste arquivo provavam a ratificação pelo `PUT` (o 409 com
 * `fechamentoAutomatico`, a revisão da versão atual, o rascunho mantido).
 * Tudo isso saiu com a rota (D7). O que fica é a frase: uma por situação, e
 * nenhuma manda "marcar e salvar" — a frase de hoje, "faltas devem ser
 * corrigidas pelo professor", mentiria (ninguém corrige presença à mão).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const getChamadaMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getChamada: (...a: unknown[]) => getChamadaMock(...a) };
});

function chamada(extra: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: isoDeOffsetNoClube(-1),
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: false,
    completude: null,
    origem: null,
    origemInicial: null,
    corrigivelAte: null,
    desfazerNaoHouveAte: null,
    estado: "pendente",
    versao: "0",
    alunos: [
      {
        alunoId: "a1",
        nome: "Ana",
        status: null,
        naTurmaHoje: true,
        reposicao: false,
        faltaAvisada: false,
      },
    ],
    ...extra,
  };
}

beforeEach(() => getChamadaMock.mockReset());

describe("SPEC-076/D1 — de onde veio o registro", () => {
  it.each([
    [
      "automática",
      chamada({
        completude: "completa",
        origem: "automatica",
        origemInicial: "automatica",
        estado: "feita",
      }),
      "Fechada automaticamente — quem avisou falta pelo app aparece como Faltou.",
    ],
    [
      "humana antiga",
      chamada({
        completude: "desconhecida",
        origem: "legada_humana",
        origemInicial: "legada_humana",
        estado: "legada",
      }),
      "Registro humano anterior à automação.",
    ],
    [
      "ratificada antes da SPEC-076",
      chamada({
        completude: "completa",
        origem: "professor",
        origemInicial: "automatica",
        estado: "feita",
      }),
      "Registro humano anterior à automação.",
    ],
    [
      "não realizada",
      chamada({ completude: "nao_houve", origem: "professor", estado: "nao_houve" }),
      "Aula não realizada.",
    ],
    ["pendente", chamada(), "Aguardando o fechamento automático."],
    [
      "sem registro",
      chamada({ data: isoDeOffsetNoClube(-20), estado: "sem_registro" }),
      "Sem registro de presença.",
    ],
    [
      "Back anterior à SPEC-076 (sem `estado`, sem cabeçalho)",
      (() => {
        const c: Record<string, unknown> = chamada();
        delete c.estado;
        return c;
      })(),
      "Aguardando o fechamento automático.",
    ],
  ])("%s", async (_nome, dados, frase) => {
    getChamadaMock.mockResolvedValue(dados);
    render(<ChamadaView ocupacaoId="oc1" />);

    expect(await screen.findByText(frase)).toBeInTheDocument();
    // Nenhuma frase manda lançar presença.
    expect(screen.queryByText(/marque|salve|corrigid/i)).toBeNull();
  });
});
