import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  CartaoDoProfessor,
  avisos,
  frase,
  proximaDoDia,
} from "./cartao-do-professor";
import type { AulaDoDiaDoProfessor } from "@/lib/api-client";

vi.mock("@/lib/api-client", async () => {
  const real = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return { ...real, getAulasDoDia: vi.fn() };
});

const { getAulasDoDia } = await import("@/lib/api-client");

/**
 * TEST — SPEC-058/D4, **o cartão do professor**.
 *
 * Duas coisas aqui não são detalhe. A primeira é a **próxima** aula do dia:
 * às 20h, a aula das 8h já acabou, e apontar para ela mandaria o professor
 * para o passado. A segunda é `quemAvisou` **ausente** — Cliente novo com
 * Back antigo durante o rollout; ler `.length` de `undefined` derrubaria a
 * tela inteira por causa de um enfeite.
 */
const aula = (over: Partial<AulaDoDiaDoProfessor> = {}): AulaDoDiaDoProfessor =>
  ({
    ocupacaoId: "o1",
    tipo: "turma",
    turmaId: "t1",
    turmaNome: "Intermediário",
    quadraNome: "Quadra 1",
    horaInicio: "19:00",
    horaFim: "20:00",
    chamada: "futura",
    faltasAvisadas: 0,
    quemAvisou: [],
    ...over,
  }) as AulaDoDiaDoProfessor;

beforeEach(() => {
  vi.mocked(getAulasDoDia).mockReset();
});

describe("proximaDoDia", () => {
  it("às 20h, a aula das 8h já passou", () => {
    const escolhida = proximaDoDia(
      [
        aula({ ocupacaoId: "cedo", horaInicio: "08:00", horaFim: "09:00" }),
        aula({ ocupacaoId: "noite", horaInicio: "21:00", horaFim: "22:00" }),
      ],
      "20:00",
    );
    expect(escolhida?.ocupacaoId).toBe("noite");
  });

  it("aula em andamento ainda é a próxima", () => {
    const escolhida = proximaDoDia(
      [aula({ ocupacaoId: "agora", horaInicio: "19:00", horaFim: "20:00" })],
      "19:30",
    );
    expect(escolhida?.ocupacaoId).toBe("agora");
  });

  it("depois da última, não há próxima", () => {
    expect(proximaDoDia([aula({ horaFim: "20:00" })], "23:00")).toBeNull();
  });
});

describe("avisos", () => {
  // Rollout: Back antigo não manda o campo. Zero, e a tela de pé.
  it("campo ausente vira lista vazia", () => {
    const semCampo = { ...aula() } as Record<string, unknown>;
    delete semCampo.quemAvisou;
    expect(avisos(semCampo as AulaDoDiaDoProfessor)).toEqual([]);
  });
});

describe("frase", () => {
  it("resume pelo primeiro nome, e some com a lista longa", () => {
    expect(frase(["Ana Lima"])).toBe("Ana");
    expect(frase(["Ana Lima", "Bruno Sá"])).toBe("Ana e Bruno");
    expect(frase(["Ana Lima", "Bruno Sá", "Caio Dias", "Dora Melo"])).toBe(
      "Ana, Bruno e mais 2",
    );
  });
});

describe("CartaoDoProfessor", () => {
  it("conta as aulas de hoje e mostra quem avisou", async () => {
    vi.mocked(getAulasDoDia).mockResolvedValue([
      aula({ horaInicio: "08:00", horaFim: "09:00" }),
      aula({
        ocupacaoId: "o2",
        horaInicio: "23:30",
        horaFim: "23:59",
        quemAvisou: ["Ana Lima", "Bruno Sá"],
        faltasAvisadas: 2,
      }),
    ]);

    render(<CartaoDoProfessor />);

    expect(await screen.findByText("2 aulas")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/2 alunos avisaram que vão faltar/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Ana e Bruno/)).toBeInTheDocument();
  });

  it("sem aviso nenhum, a linha não aparece — 0 é ruído", async () => {
    vi.mocked(getAulasDoDia).mockResolvedValue([aula({ horaFim: "23:59" })]);

    render(<CartaoDoProfessor />);

    expect(await screen.findByText("1 aula")).toBeInTheDocument();
    expect(screen.queryByText(/avisaram que vão faltar/)).not.toBeInTheDocument();
  });

  it("dia sem aula diz isso", async () => {
    vi.mocked(getAulasDoDia).mockResolvedValue([]);

    render(<CartaoDoProfessor />);

    expect(await screen.findByText("Nenhuma aula hoje")).toBeInTheDocument();
  });

  it("falha de rede não apaga a tela do professor", async () => {
    vi.mocked(getAulasDoDia).mockRejectedValue(new Error("rede"));

    render(<CartaoDoProfessor />);

    expect(
      await screen.findByText("Não foi possível carregar o resumo de hoje."),
    ).toBeInTheDocument();
  });
});
