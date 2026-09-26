import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChamadaView } from "./chamada-view";

/**
 * SPEC-031/AC-019b → SPEC-076 — **a aula cancelada é alcançável, e é
 * leitura.**
 *
 * Era a única versão "somente leitura" desta tela, e o arquivo provava que os
 * botões de presença ficavam `disabled` nela e vivos nas outras. Desde a
 * SPEC-076 a tela inteira é leitura (D1): os casos que provavam "na aula NÃO
 * cancelada as ações continuam e o toque marca" saíram (D7). Fica o que é da
 * cancelada: o rótulo, quem avisou que ia faltar, e nenhuma ação.
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

function chamadaCancelada(extra: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: "2026-08-23",
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: true,
    completude: null,
    origem: null,
    origemInicial: null,
    corrigivelAte: null,
    desfazerNaoHouveAte: null,
    estado: "cancelada",
    versao: "0",
    alunos: [
      {
        alunoId: "a1",
        nome: "Ana",
        status: null,
        naTurmaHoje: true,
        reposicao: false,
        faltaAvisada: true,
      },
      {
        alunoId: "a2",
        nome: "Bruno",
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

describe("a aula cancelada — leitura", () => {
  it("diz que foi cancelada e mostra quem avisou que ia faltar", async () => {
    getChamadaMock.mockResolvedValue(chamadaCancelada());
    render(<ChamadaView ocupacaoId="oc1" />);

    expect(await screen.findByText("Aula cancelada.")).toBeInTheDocument();
    expect(screen.getAllByText("avisou que ia faltar")).toHaveLength(1);
  });

  it("não oferece ação nenhuma — só o Voltar", async () => {
    getChamadaMock.mockResolvedValue(chamadaCancelada());
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(
      screen.getAllByRole("button").map((b) => b.textContent?.trim()),
    ).toEqual(["Voltar"]);
  });

  it("cancelada E não realizada: diz as duas coisas, sem ação", async () => {
    getChamadaMock.mockResolvedValue(
      chamadaCancelada({ completude: "nao_houve", origem: "professor" }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    expect(
      await screen.findByText(/e o registro de que ela não aconteceu/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
