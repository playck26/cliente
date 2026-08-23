import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChamadaView } from "./chamada-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/top-app-bar", () => ({
  TopAppBar: () => null,
}));

const getChamadaMock = vi.fn();
const salvarChamadaMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getChamada: (...args: unknown[]) => getChamadaMock(...args),
    salvarChamada: (...args: unknown[]) => salvarChamadaMock(...args),
  };
});

function chamadaCom(alunos: string[], extras: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: "2026-08-23",
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: false,
    versao: "0",
    alunos: alunos.map((nome, i) => ({
      alunoId: `a${i}`,
      nome,
      status: null,
      naTurmaHoje: true,
    })),
    ...extras,
  };
}

// SPEC-015/DEF-002 (TASK-000a): a tela deixava salvar chamada pela metade e
// mandava só os marcados. Estes testes fixam a regra nova antes de o
// servidor passar a cobrá-la — a tela é publicada primeiro, de propósito.
describe("ChamadaView — completude (DEF-002)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
  });

  it("não deixa salvar com aluno sem marcar, e diz quantos faltam", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana", "Bruno"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(screen.getByText("Faltam 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar chamada" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);

    expect(screen.getByText("Faltam 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar chamada" })).toBeDisabled();
    expect(salvarChamadaMock).not.toHaveBeenCalled();
  });

  it("libera salvar quando todos estão marcados, e manda a chamada inteira", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana", "Bruno"]));
    salvarChamadaMock.mockResolvedValue({ ocupacaoId: "oc1", versao: "2:1", total: 2 });
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Faltou" })[1]);

    expect(screen.getByText("2 de 2 marcados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));

    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalled());
    const itens = salvarChamadaMock.mock.calls[0][2] as unknown[];
    expect(itens).toHaveLength(2);
  });

  it('"Todos vieram" fecha a chamada de uma vez', async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana", "Bruno", "Carol"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Todos vieram" }));

    expect(screen.getByText("3 de 3 marcados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar chamada" }),
    ).not.toBeDisabled();
    // O atalho some quando não há mais o que atalhar.
    expect(
      screen.queryByRole("button", { name: "Todos vieram" }),
    ).not.toBeInTheDocument();
  });

  it("avisa quando a chamada é legada, de completude desconhecida", async () => {
    getChamadaMock.mockResolvedValue(
      chamadaCom(["Ana"], { completude: "desconhecida" }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    expect(
      await screen.findByText(/pode estar pela metade/i),
    ).toBeInTheDocument();
  });

  it("backend antigo (sem o campo) não dispara o aviso de legado", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(screen.queryByText(/pode estar pela metade/i)).not.toBeInTheDocument();
  });
});
