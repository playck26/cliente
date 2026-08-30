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

// **ACHADO 3 DA 2ª VALIDAÇÃO CRUZADA (MÉDIA)** — o estado da tela depois do
// `salvar`. A prova anterior terminava conferindo que o mock foi chamado;
// não julgava o que a tela passava a mostrar.
describe("ChamadaView — a tela depois de salvar (SPEC-030)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("o botão SOME depois de salvar — o servidor já recusaria", async () => {
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    salvarChamadaMock.mockResolvedValue({ versao: "1:99", total: 1 });
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));

    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "A aula não aconteceu" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("DESFAZER `nao_houve` pelo PUT normal tira o aviso da tela", async () => {
    // Era o pior dos dois: o professor desfazia e a tela continuava dizendo
    // "registrada como não realizada" — a mensagem contrária ao que ele
    // acabara de fazer — até recarregar.
    getChamadaMock.mockResolvedValue(
      chamadaCom(["Ana"], { completude: "nao_houve" }),
    );
    salvarChamadaMock.mockResolvedValue({ versao: "1:99", total: 1 });
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    expect(screen.getByText(/registrada como não realizada/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Veio" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));

    await waitFor(() =>
      expect(
        screen.queryByText(/registrada como não realizada/i),
      ).not.toBeInTheDocument(),
    );
  });
});

/**
 * **ACHADO 2 DA 3ª VALIDAÇÃO CRUZADA (MÉDIA) — a janela em que o PUT está no
 * ar.**
 *
 * O diagnóstico da rodada foi de método, e esta suíte é a resposta a ele:
 * `mockResolvedValue` achata o tempo assíncrono. A promessa já nasce
 * resolvida, então **nunca existe um salvamento pendente durante a prova** —
 * e tudo o que só acontece nessa janela fica invisível para a suíte inteira.
 *
 * Aqui a promessa é controlada à mão: ela fica no ar até a prova mandar
 * resolver, e no meio do caminho a prova faz o que o professor faria.
 */
function promessaControlada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

describe("ChamadaView — o rascunho durante o salvamento (SPEC-030)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mudar de ideia com o PUT no ar NÃO faz a tela dizer `Salvo`", async () => {
    // 1. Ana marcada como presente; 2. o professor toca em Salvar;
    // 3. com o PUT ainda no ar, ele muda Ana para ausente; 4. o servidor
    // grava PRESENTE, que foi o que recebeu; 5. a resposta chega.
    //
    // Antes: a tela mostrava "Faltou" ao lado de "Salvo" — afirmando sobre o
    // servidor uma coisa que o servidor não tem.
    const { promessa, resolver } = promessaControlada<{
      versao: string;
      total: number;
    }>();
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    salvarChamadaMock.mockReturnValue(promessa);
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalledTimes(1));

    // O que saiu é o que estava marcado no envio, e só isso.
    expect(salvarChamadaMock).toHaveBeenCalledWith("oc1", "0", [
      { alunoId: "a0", status: "presente" },
    ]);

    // A mudança de ideia, com a requisição ainda no ar.
    fireEvent.click(screen.getByRole("button", { name: "Faltou" }));
    resolver({ versao: "1:99", total: 1 });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvar chamada" }),
      ).toBeInTheDocument(),
    );
    // O par que dá o julgamento: "Salvo" seria a tela mentindo.
    expect(
      screen.queryByRole("button", { name: "Salvo" }),
    ).not.toBeInTheDocument();
    // E o rascunho continua na tela — perder o toque de quem está segurando
    // uma raquete é o pior resultado possível.
    expect(screen.getByRole("button", { name: "Faltou" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // O par positivo. Sem ele, um `setSalvo(false)` seco passaria na prova
  // acima e o botão nunca mais diria "Salvo" — troca de um defeito por
  // outro, e o professor sem confirmação nenhuma de que gravou.
  it("sem mexer em nada durante o PUT, a tela diz `Salvo`", async () => {
    const { promessa, resolver } = promessaControlada<{
      versao: string;
      total: number;
    }>();
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    salvarChamadaMock.mockReturnValue(promessa);
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalledTimes(1));

    resolver({ versao: "1:99", total: 1 });

    expect(
      await screen.findByRole("button", { name: "Salvo" }),
    ).toBeInTheDocument();
  });

  // A mesma corrida do outro lado. `naoHouveAula` relê do servidor e
  // limpava as marcas — apagando, em silêncio, o que a pessoa tocou
  // enquanto a requisição estava no ar.
  it("marcar durante o `nao-houve` não apaga o rascunho", async () => {
    const { promessa, resolver } = promessaControlada<{
      ocupacaoId: string;
      completude: string;
    }>();
    getChamadaMock
      .mockResolvedValueOnce(chamadaCom(["Ana"]))
      .mockResolvedValueOnce(chamadaCom(["Ana"], { completude: "nao_houve" }));
    naoHouveMock.mockReturnValue(promessa);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    );
    await waitFor(() => expect(naoHouveMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    resolver({ ocupacaoId: "oc1", completude: "nao_houve" });

    await waitFor(() => expect(getChamadaMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Veio" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

/**
 * **ACHADOS 4 E 5 DA 4ª VALIDAÇÃO CRUZADA.** Os dois moram na mesma janela
 * assíncrona que a rodada anterior abriu, e nenhum estava coberto: a suíte
 * provava falha do PUT e sucesso de PUT+GET, e nada entre os dois.
 */
describe("ChamadaView — a fronteira entre o PUT e a releitura (SPEC-030)", () => {
  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ACHADO 4 (MÉDIA) — escrita confirmada apresentada como falha.
  it("PUT grava e o GET cai: a tela NÃO diz que falhou em registrar", async () => {
    getChamadaMock
      .mockResolvedValueOnce(chamadaCom(["Ana"]))
      .mockRejectedValueOnce(new Error("rede"));
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
    fireEvent.click(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    );

    const alerta = await screen.findByRole("alert");
    // O que ela dizia antes, e que mandava o professor refazer o que deu
    // certo.
    expect(alerta).not.toHaveTextContent(/não foi possível registrar/i);
    expect(alerta).toHaveTextContent(/registrado/i);
  });

  it("e não oferece a ação de novo sobre uma escrita que já aconteceu", async () => {
    // O par do achado 4: a mensagem certa sem tirar o botão ainda convidaria
    // ao segundo toque.
    getChamadaMock
      .mockResolvedValueOnce(chamadaCom(["Ana"]))
      .mockRejectedValueOnce(new Error("rede"));
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
    fireEvent.click(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    );

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "A aula não aconteceu" }),
    ).not.toBeInTheDocument();
  });

  it("quando o PUT é que falha, a mensagem continua sendo a de falha", async () => {
    // Sem esta, uma correção que trocasse a mensagem sempre passaria nas
    // duas acima e apagaria o caso em que registrar realmente não aconteceu.
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    naoHouveMock.mockRejectedValue(new Error("rede"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível registrar/i,
    );
    // E a ação continua disponível, porque desta vez não gravou nada.
    expect(
      screen.getByRole("button", { name: "A aula não aconteceu" }),
    ).toBeInTheDocument();
  });

  // ACHADO 5 (BAIXA) — o contador confundia interação com alteração.
  it("tocar de novo no MESMO estado durante o PUT não desfaz o `Salvo`", async () => {
    const { promessa, resolver } = promessaControlada<{
      versao: string;
      total: number;
    }>();
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    salvarChamadaMock.mockReturnValue(promessa);
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalledTimes(1));

    // O toque que NÃO muda nada — em quadra, conferir tocando é o normal.
    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    resolver({ versao: "1:99", total: 1 });

    expect(
      await screen.findByRole("button", { name: "Salvo" }),
    ).toBeInTheDocument();
  });

  it("mas tocar em OUTRO estado durante o PUT continua desfazendo", async () => {
    // O par: sem ele, um `marcar()` que ignorasse toda edição passaria na
    // prova acima e reabriria o achado 2 da 3ª rodada.
    const { promessa, resolver } = promessaControlada<{
      versao: string;
      total: number;
    }>();
    getChamadaMock.mockResolvedValue(chamadaCom(["Ana"]));
    salvarChamadaMock.mockReturnValue(promessa);
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Veio" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar chamada" }));
    await waitFor(() => expect(salvarChamadaMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Faltou" }));
    resolver({ versao: "1:99", total: 1 });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvar chamada" }),
      ).toBeInTheDocument(),
    );
  });
});
