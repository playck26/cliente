import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChamadaView } from "./chamada-view";
import { ApiError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/top-app-bar", () => ({
  TopAppBar: () => null,
}));

const getChamadaMock = vi.fn();
const salvarChamadaMock = vi.fn();
const naoHouveMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getChamada: (...args: unknown[]) => getChamadaMock(...args),
    salvarChamada: (...args: unknown[]) => salvarChamadaMock(...args),
    registrarNaoHouveAula: (...args: unknown[]) => naoHouveMock(...args),
  };
});

type Aluno = [id: string, nome: string, status: string | null];

function chamada(alunos: Aluno[], extras: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: "2026-09-16",
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: false,
    completude: null,
    origem: null,
    origemInicial: null,
    corrigivelAte: null,
    versao: "v1",
    alunos: alunos.map(([alunoId, nome, status]) => ({
      alunoId,
      nome,
      status,
      naTurmaHoje: true,
      reposicao: false,
      faltaAvisada: false,
    })),
    ...extras,
  };
}

const EM_TRES_DIAS = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

function automatica(alunos: Aluno[], extras: Record<string, unknown> = {}) {
  return chamada(alunos, {
    completude: "completa",
    origem: "automatica",
    origemInicial: "automatica",
    corrigivelAte: EM_TRES_DIAS,
    ...extras,
  });
}

function conflito(fechamentoAutomatico: boolean) {
  return new ApiError(409, "mudou", "CHAMADA_DESATUALIZADA", {
    code: "CHAMADA_DESATUALIZADA",
    fechamentoAutomatico,
  });
}

// TEST (SPEC-057/TASK-001/D2) — abrir às 13:30, o job fecha às 14:00, salvar
// às 14:10. O 409 é o servidor protegendo o fechamento; o que esta tela
// precisa provar é que o professor não perde o que marcou e não salva sem ver.
describe("ChamadaView — o 409 do fechamento automático (D2)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function abrirMarcarESalvarComConflito(fechamentoAutomatico: boolean) {
    getChamadaMock.mockResolvedValueOnce(
      chamada([
        ["a1", "Ana", null],
        ["a2", "Bruno", null],
        ["a3", "Carla", null],
      ]),
    );
    salvarChamadaMock.mockRejectedValueOnce(conflito(fechamentoAutomatico));
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Faltou" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await screen.findByRole("button", { name: "Revisar versão atual" });
  }

  it("com o sinal, diz que a aula foi fechada automaticamente — e não recarrega a página", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    await abrirMarcarESalvarComConflito(true);

    expect(
      screen.getByText(/Esta aula foi fechada automaticamente e a chamada mudou desde sua leitura/),
    ).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("sem o sinal, a frase não atribui a mudança a ninguém", async () => {
    await abrirMarcarESalvarComConflito(false);

    expect(screen.getByText(/Esta chamada mudou desde sua leitura/)).toBeInTheDocument();
    expect(screen.queryByText(/fechada automaticamente/)).toBeNull();
    expect(screen.queryByText(/outro aparelho/)).toBeNull();
  });

  it("revisar: relê, mantém o rascunho de quem ficou, lista quem saiu, quem entrou e o que diverge — e não salva sozinho", async () => {
    await abrirMarcarESalvarComConflito(true);
    // Versão atual: o job fechou com todos presentes, Carla saiu, Davi entrou.
    getChamadaMock.mockResolvedValueOnce(
      automatica(
        [
          ["a1", "Ana", "presente"],
          ["a2", "Bruno", "presente"],
          ["a4", "Davi", "presente"],
        ],
        { versao: "v2" },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revisar versão atual" }));

    await screen.findByText(/Versão atual carregada/);
    expect(getChamadaMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Bruno: salvo “Veio”, seu rascunho “Faltou”/)).toBeInTheDocument();
    expect(screen.getByText(/Entraram e precisam ser marcados: Davi/)).toBeInTheDocument();
    expect(screen.getByText(/Não estão mais nesta chamada: Carla/)).toBeInTheDocument();
    // Davi não foi marcado por ninguém: salvar fica bloqueado até marcar.
    expect(screen.getByText("Faltam 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar chamada" })).toBeDisabled();
    expect(salvarChamadaMock).toHaveBeenCalledTimes(1);

    // O professor marca o novo e salva — contra a versão ATUAL.
    salvarChamadaMock.mockResolvedValueOnce({ ocupacaoId: "oc1", versao: "v3", total: 3 });
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));

    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalledTimes(2));
    expect(salvarChamadaMock).toHaveBeenLastCalledWith(
      "oc1",
      "v2",
      expect.arrayContaining([
        { alunoId: "a1", status: "presente" },
        { alunoId: "a2", status: "ausente" },
        { alunoId: "a4", status: "presente" },
      ]),
    );
    const enviados = salvarChamadaMock.mock.calls[1][2] as { alunoId: string }[];
    expect(enviados.map((i) => i.alunoId)).not.toContain("a3");
  });

  it("GET da revisão falhando conserva o rascunho e o aviso", async () => {
    await abrirMarcarESalvarComConflito(true);
    getChamadaMock.mockRejectedValueOnce(new Error("rede"));

    fireEvent.click(screen.getByRole("button", { name: "Revisar versão atual" }));

    await screen.findByText(/Não foi possível carregar a versão atual. Suas marcações continuam/);
    expect(screen.getByRole("button", { name: "Revisar versão atual" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Faltou" })[1].getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("ChamadaView — Justificou (D7) e proveniência (D1/D5)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não oferece Justificou; o legado aparece e é mantido ao salvar sem tocar", async () => {
    getChamadaMock.mockResolvedValue(
      chamada(
        [
          ["a1", "Ana", "justificado"],
          ["a2", "Bruno", "presente"],
        ],
        { completude: "completa", origem: "legada_humana", origemInicial: "legada_humana" },
      ),
    );
    salvarChamadaMock.mockResolvedValue({ ocupacaoId: "oc1", versao: "v2", total: 2 });
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(screen.queryByRole("button", { name: /Justificou/ })).toBeNull();
    expect(screen.getByText("Justificou (registro antigo)")).toBeInTheDocument();
    expect(screen.getByText("Registro humano anterior à automação.")).toBeInTheDocument();

    // Uma alteração em Bruno libera o salvar; Ana continua justificada.
    fireEvent.click(screen.getAllByRole("button", { name: "Faltou" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalled());
    expect(salvarChamadaMock.mock.calls[0][2]).toContainEqual({
      alunoId: "a1",
      status: "justificado",
    });
  });

  it("automática não revisada: diz que é presumida, dá o prazo e oferece 'a aula não aconteceu' mesmo com presenças salvas", async () => {
    getChamadaMock.mockResolvedValue(automatica([["a1", "Ana", "presente"]]));
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(screen.getByText(/Fechada automaticamente\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Presenças automáticas são presumidas; faltas devem ser corrigidas pelo professor/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A aula não aconteceu/ })).toBeInTheDocument();
  });

  it("confirmar 'não aconteceu' sobre a automática avisa que as presunções serão apagadas", async () => {
    getChamadaMock.mockResolvedValue(automatica([["a1", "Ana", "presente"]]));
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    fireEvent.click(screen.getByRole("button", { name: /A aula não aconteceu/ }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("presenças do fechamento automático serão apagadas"),
    );
    expect(naoHouveMock).not.toHaveBeenCalled();
  });

  it("automática JÁ revisada: some a exceção, fica o prazo de correção", async () => {
    getChamadaMock.mockResolvedValue(
      automatica([["a1", "Ana", "presente"]], { origem: "professor" }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(screen.queryByRole("button", { name: /A aula não aconteceu/ })).toBeNull();
    expect(screen.getByText(/Fechada automaticamente e revisada/)).toBeInTheDocument();
  });

  it("prazo de correção vencido: histórico somente leitura, sem ações", async () => {
    getChamadaMock.mockResolvedValue(
      automatica([["a1", "Ana", "presente"]], {
        corrigivelAte: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(screen.getByText(/Prazo de correção encerrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar chamada/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /A aula não aconteceu/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Faltou" })).toBeDisabled();
  });
});
