import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChamadaView } from "./chamada-view";

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

function chamadaCom(alunos: string[], extras: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: "2026-08-23",
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: false,
    completude: null,
    versao: "0",
    alunos: alunos.map((nome, i) => ({
      alunoId: `a${i}`,
      nome,
      // `string | null` e não `null`: uma prova precisa gravar "presente"
      // aqui, e inferir `null` faria o `tsc` recusar — foi ele que pegou.
      status: null as string | null,
      naTurmaHoje: true,
    })),
    ...extras,
  };
}

// TEST (SPEC-030:TASK-006) — "a aula não aconteceu", na tela do professor.
//
// O problema que a tela resolve: choveu, e o único jeito de tirar o dia do
// vermelho era mentir que a aula foi dada. A ação precisa existir, precisa
// ser difícil de tocar por engano, e precisa dizer como desfazer.
describe("ChamadaView — a aula não aconteceu (SPEC-030)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("oferece a ação numa chamada ainda não lançada", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana", "Bruno"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    ).toBeEnabled();
  });

  // A ação responde por todos os alunos de uma vez e grava direto, sem passar
  // pelo "Salvar". Sem confirmação, um toque errado em quadra apagaria a aula.
  it("pede confirmação, e desistir não chama a API", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "A aula não aconteceu" }));

    expect(naoHouveMock).not.toHaveBeenCalled();
  });

  it("confirmando, registra e relê o estado do servidor", async () => {
    getChamadaMock
      .mockResolvedValueOnce(chamadaCom(["Ana"]))
      .mockResolvedValueOnce(chamadaCom(["Ana"], { completude: "nao_houve" }));
    naoHouveMock.mockResolvedValue({
      ocupacaoId: "oc1",
      completude: "nao_houve",
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "A aula não aconteceu" }));

    await waitFor(() => expect(naoHouveMock).toHaveBeenCalledWith("oc1"));
    // **Relê em vez de remendar o estado local:** a `versao` nova é do
    // servidor, e é ela que permite desfazer depois sem levar 409.
    await waitFor(() => expect(getChamadaMock).toHaveBeenCalledTimes(2));
  });

  it("com a aula já marcada, mostra o estado E o caminho de volta", async () => {
    getChamadaMock.mockResolvedValue(
      chamadaCom(["Ana"], { completude: "nao_houve" }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(
      screen.getByText(/registrada como não realizada/i),
    ).toBeInTheDocument();
    // Dizer "não aconteceu" sem dizer como desfazer transformaria um engano
    // de toque num dia perdido.
    expect(screen.getByText(/marque os alunos abaixo e salve/i)).toBeInTheDocument();
  });

  it("some o botão quando a aula já está marcada — repetir não faria nada", async () => {
    getChamadaMock.mockResolvedValue(
      chamadaCom(["Ana"], { completude: "nao_houve" }),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(
      screen.queryByRole("button", { name: "A aula não aconteceu" }),
    ).not.toBeInTheDocument();
  });

  // **ACHADO 3 DA VALIDAÇÃO CRUZADA (MÉDIA).** A condição era `marcados === 0`
  // — as marcas LOCAIS. Um toque errado em "Veio", sem salvar nada, fazia o
  // botão sumir; e como `marcar()` só adiciona, não havia como desmarcar. O
  // caminho ficava perdido até recarregar, em quadra, com sinal ruim.
  it("um toque local por engano NÃO faz o botão sumir", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana", "Bruno"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);

    expect(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    ).toBeInTheDocument();
  });

  // O servidor recusaria com `CHAMADA_COM_PRESENCA` (LIM-030d). A tela não
  // oferece o que seria recusado — mas quem decide é o estado SALVO, não o
  // rascunho local.
  it("some quando há presença SALVA — que é o que o servidor recusa", async () => {
    const comPresenca = chamadaCom(["Ana", "Bruno"]);
    comPresenca.alunos[0].status = "presente";
    getChamadaMock.mockResolvedValue(comPresenca);
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(
      screen.queryByRole("button", { name: "A aula não aconteceu" }),
    ).not.toBeInTheDocument();
  });

  it("erro da API vira aviso na tela, sem derrubar as marcações", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    naoHouveMock.mockRejectedValue(new Error("rede"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "A aula não aconteceu" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível registrar/i,
    );
  });
});
