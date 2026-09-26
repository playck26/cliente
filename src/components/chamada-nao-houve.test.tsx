import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isoDeOffsetNoClube } from "@/lib/fuso";
import { ChamadaView } from "./chamada-view";

/**
 * SPEC-030 → SPEC-076/AC-018 — **"A aula não aconteceu" e o "Desfazer".**
 *
 * - O botão de registrar aparece **só onde o servidor aceitaria**: as guardas
 *   do portão (cancelada, aula que não começou, janela, presença humana).
 * - O "Desfazer (até …)" aparece **só** com `desfazerNaoHouveAte` não nulo,
 *   mostra a data e chama a rota `DELETE`. Resposta sem o campo (o Back
 *   anterior à SPEC-076, D12) → não aparece.
 *
 * Os casos antigos deste arquivo que provavam o rascunho durante o `PUT` da
 * chamada e o "desfazer lançando a chamada por cima" saíram com a rota (D7,
 * tabela no CLI_AUDIT).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const getChamadaMock = vi.fn();
const naoHouveMock = vi.fn();
const desfazerMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getChamada: (...a: unknown[]) => getChamadaMock(...a),
    registrarNaoHouveAula: (...a: unknown[]) => naoHouveMock(...a),
    desfazerNaoHouveAula: (...a: unknown[]) => desfazerMock(...a),
  };
});

const emHoras = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

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

const comPresenca = (status: string) => [
  {
    alunoId: "a1",
    nome: "Ana",
    status,
    naTurmaHoje: true,
    reposicao: false,
    faltaAvisada: false,
  },
];

const BOTAO = "A aula não aconteceu";

async function abrir(dados: unknown) {
  getChamadaMock.mockResolvedValue(dados);
  render(<ChamadaView ocupacaoId="oc1" />);
  await screen.findByText("Ana");
}

beforeEach(() => {
  getChamadaMock.mockReset();
  naoHouveMock.mockReset();
  desfazerMock.mockReset();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AC-018 — 'A aula não aconteceu' só onde o servidor aceitaria", () => {
  it.each([
    ["aula de ontem sem registro (pendente)", chamada()],
    [
      "automática dentro do prazo, mesmo com presença",
      chamada({
        completude: "completa",
        origem: "automatica",
        origemInicial: "automatica",
        corrigivelAte: emHoras(24),
        estado: "feita",
        alunos: comPresenca("presente"),
      }),
    ],
    ["aula de hoje em andamento", chamada({ data: isoDeOffsetNoClube(0), estado: "em_andamento" })],
  ])("aparece: %s", async (_nome, dados) => {
    await abrir(dados);
    expect(screen.getByRole("button", { name: BOTAO })).toBeInTheDocument();
  });

  it.each([
    ["aula cancelada", chamada({ cancelada: true, estado: "cancelada" })],
    ["aula que não começou", chamada({ data: isoDeOffsetNoClube(1), estado: "futura" })],
    [
      "sem registro fora da janela de 7 dias",
      chamada({ data: isoDeOffsetNoClube(-8), estado: "sem_registro" }),
    ],
    [
      "automática com o prazo vencido",
      chamada({
        completude: "completa",
        origem: "automatica",
        origemInicial: "automatica",
        corrigivelAte: emHoras(-1),
        estado: "feita",
        alunos: comPresenca("presente"),
      }),
    ],
    [
      "registro humano com presença (CHAMADA_COM_PRESENCA)",
      chamada({
        completude: "desconhecida",
        origem: "legada_humana",
        origemInicial: "legada_humana",
        estado: "legada",
        alunos: comPresenca("presente"),
      }),
    ],
    [
      "já registrada como não realizada",
      chamada({ completude: "nao_houve", origem: "professor", estado: "nao_houve" }),
    ],
  ])("não aparece: %s", async (_nome, dados) => {
    await abrir(dados);
    expect(screen.queryByRole("button", { name: BOTAO })).toBeNull();
  });

  it("pede confirmação, e desistir não chama a API", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await abrir(chamada());
    fireEvent.click(screen.getByRole("button", { name: BOTAO }));
    expect(naoHouveMock).not.toHaveBeenCalled();
  });

  it("confirmando, registra e relê o estado do servidor", async () => {
    getChamadaMock
      .mockResolvedValueOnce(chamada())
      .mockResolvedValueOnce(
        chamada({
          completude: "nao_houve",
          origem: "professor",
          estado: "nao_houve",
          desfazerNaoHouveAte: emHoras(24),
        }),
      );
    naoHouveMock.mockResolvedValue({ ocupacaoId: "oc1", completude: "nao_houve" });
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    fireEvent.click(screen.getByRole("button", { name: BOTAO }));

    await waitFor(() => expect(naoHouveMock).toHaveBeenCalledWith("oc1"));
    expect(await screen.findByText(/Aula não realizada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: BOTAO })).toBeNull();
    expect(screen.getByRole("button", { name: /^Desfazer \(até / })).toBeInTheDocument();
  });

  it("o PUT grava e o GET cai: diz que registrou, e não oferece de novo", async () => {
    getChamadaMock
      .mockResolvedValueOnce(chamada())
      .mockRejectedValueOnce(new Error("rede"));
    naoHouveMock.mockResolvedValue({ ocupacaoId: "oc1", completude: "nao_houve" });
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    fireEvent.click(screen.getByRole("button", { name: BOTAO }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Registrado\./);
    expect(screen.queryByRole("button", { name: BOTAO })).toBeNull();
  });

  it("quando o PUT é que falha, a mensagem é a de falha", async () => {
    await abrir(chamada());
    naoHouveMock.mockRejectedValue(new Error("rede"));

    fireEvent.click(screen.getByRole("button", { name: BOTAO }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível registrar. Tente de novo.",
    );
  });
});

describe("AC-018 — o 'Desfazer (até …)'", () => {
  const naoHouve = (extra: Record<string, unknown> = {}) =>
    chamada({
      completude: "nao_houve",
      origem: "professor",
      origemInicial: "automatica",
      estado: "nao_houve",
      ...extra,
    });

  it("com o campo: mostra a data, confirma, chama o DELETE e relê", async () => {
    // Um instante fixo, formatado no relógio de quem lê: é o que a tela promete.
    const ate = new Date(2026, 9, 3, 14, 30).toISOString();
    getChamadaMock
      .mockResolvedValueOnce(naoHouve({ desfazerNaoHouveAte: ate }))
      .mockResolvedValueOnce(
        chamada({
          completude: "completa",
          origem: "automatica",
          origemInicial: "automatica",
          estado: "feita",
          alunos: comPresenca("presente"),
        }),
      );
    desfazerMock.mockResolvedValue({ ocupacaoId: "oc1", estado: "feita" });
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    fireEvent.click(
      screen.getByRole("button", { name: "Desfazer (até 03/10 às 14:30)" }),
    );

    await waitFor(() => expect(desfazerMock).toHaveBeenCalledWith("oc1"));
    expect(await screen.findByText("Veio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Desfazer/ })).toBeNull();
  });

  it("desistir da confirmação não chama o DELETE", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await abrir(naoHouve({ desfazerNaoHouveAte: emHoras(24) }));
    fireEvent.click(screen.getByRole("button", { name: /^Desfazer/ }));
    expect(desfazerMock).not.toHaveBeenCalled();
  });

  it("campo nulo (fora do prazo): não aparece", async () => {
    await abrir(naoHouve({ desfazerNaoHouveAte: null }));
    expect(screen.queryByRole("button", { name: /^Desfazer/ })).toBeNull();
  });

  it("Back anterior à SPEC-076 (sem o campo): não aparece", async () => {
    const antiga: Record<string, unknown> = naoHouve();
    delete antiga.desfazerNaoHouveAte;
    delete antiga.estado;
    await abrir(antiga);
    expect(screen.queryByRole("button", { name: /^Desfazer/ })).toBeNull();
    expect(screen.getByText(/Aula não realizada/)).toBeInTheDocument();
  });
});
