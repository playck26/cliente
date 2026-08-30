import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaDoProfessor } from "./agenda-do-professor";

/**
 * SPEC-026 — as provas do calendário do professor.
 *
 * Duas coisas aqui não são detalhe de tela:
 *
 * 1. **a bolinha de chamada pendente**, que é a razão de a tela existir. Um
 *    calendário que só diz "tem aula terça" repete o que ele já sabe;
 * 2. **o mês em que a tela abre**, calculado no fuso do clube. Em UTC, no
 *    dia 30 de setembro às 21h de Brasília, ela abriria em outubro — e a
 *    pessoa acharia que perdeu as aulas do mês.
 */

const getAgendaDoProfessor = vi.hoisted(() => vi.fn());
const getAulasDoDia = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getAgendaDoProfessor, getAulasDoDia };
});

beforeEach(() => {
  vi.clearAllMocks();
  getAgendaDoProfessor.mockResolvedValue([]);
  getAulasDoDia.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * `shouldAdvanceTime` não é detalhe: sem ele, `useFakeTimers` congela o
 * relógio e o `waitFor` do testing-library espera para sempre um tempo que
 * nunca passa. A primeira versão deste arquivo travou as onze provas em 5
 * segundos cada, e o sintoma (timeout) não diz a causa (relógio parado).
 */

describe("o mês em que a tela abre", () => {
  it("usa o fuso do CLUBE, não o UTC", async () => {
    // 2026-10-01T00:30Z é 2026-09-30 às 21h30 em São Paulo. Em UTC a tela
    // abriria em outubro; no fuso do clube, setembro — que é o mês que a
    // pessoa ainda está vivendo.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-01T00:30:00.000Z"));

    render(<AgendaDoProfessor />);

    await waitFor(() =>
      expect(getAgendaDoProfessor).toHaveBeenCalledWith("2026-09"),
    );
    expect(getAgendaDoProfessor).not.toHaveBeenCalledWith("2026-10");
  });

  it("de manhã os dois concordam — é a hora em que o defeito não apareceria", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));

    render(<AgendaDoProfessor />);

    await waitFor(() =>
      expect(getAgendaDoProfessor).toHaveBeenCalledWith("2026-09"),
    );
  });
});

describe("navegar entre meses", () => {
  it("o mês anterior vira dezembro do ano passado em janeiro", async () => {
    // A virada de ano é onde a aritmética ingênua (`mes - 1`) produz mês 0.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    render(<AgendaDoProfessor />);
    await waitFor(() => expect(getAgendaDoProfessor).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText("Mês anterior"));

    await waitFor(() =>
      expect(getAgendaDoProfessor).toHaveBeenCalledWith("2025-12"),
    );
  });

  it("e o próximo vira janeiro do ano seguinte em dezembro", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-12-15T12:00:00.000Z"));
    render(<AgendaDoProfessor />);
    await waitFor(() => expect(getAgendaDoProfessor).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText("Próximo mês"));

    await waitFor(() =>
      expect(getAgendaDoProfessor).toHaveBeenCalledWith("2027-01"),
    );
  });
});

describe("a bolinha — a razão da tela", () => {
  it("o dia com chamada pendente é anunciado como tal", async () => {
    // Anunciado, e não só desenhado: um ponto vermelho de 6px não existe
    // para quem usa leitor de tela.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-01", aulas: 2, pendentes: 1 },
    ]);

    render(<AgendaDoProfessor />);

    expect(
      await screen.findByLabelText("1: 2 aulas, 1 sem chamada"),
    ).toBeInTheDocument();
  });

  it("dia com tudo registrado não fala de pendência", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-03", aulas: 1, pendentes: 0 },
    ]);

    render(<AgendaDoProfessor />);

    expect(await screen.findByLabelText("3: 1 aula")).toBeInTheDocument();
  });

  it("dia sem aula não é clicável", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([]);

    render(<AgendaDoProfessor />);

    expect(await screen.findByLabelText("10, sem aula")).toBeDisabled();
  });
});

describe("do dia à chamada", () => {
  it("tocar no dia busca as aulas dele", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-01", aulas: 1, pendentes: 1 },
    ]);

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula, 1 sem chamada"));

    await waitFor(() =>
      expect(getAulasDoDia).toHaveBeenCalledWith("2026-09-01"),
    );
  });

  it("a aula leva para a chamada que já existe", async () => {
    // REQ-003. O `ocupacaoId` é o mesmo que `/chamada/:id` aceita — se
    // divergirem, o caminho do pedido quebra no último passo.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-01", aulas: 1, pendentes: 1 },
    ]);
    getAulasDoDia.mockResolvedValue([
      {
        ocupacaoId: "ocup-1",
        turmaId: "t1",
        turmaNome: "Iniciantes",
        quadraNome: "Quadra 1",
        horaInicio: "18:00",
        horaFim: "19:00",
        chamada: "pendente",
      },
    ]);

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula, 1 sem chamada"));

    const link = await screen.findByRole("link", { name: /Iniciantes/ });
    expect(link).toHaveAttribute("href", "/chamada/ocup-1");
  });

  it("mostra o estado da chamada sem recalcular nada", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-01", aulas: 1, pendentes: 0 },
    ]);
    getAulasDoDia.mockResolvedValue([
      {
        ocupacaoId: "ocup-2",
        turmaId: "t1",
        turmaNome: "Avançados",
        quadraNome: "Quadra 2",
        horaInicio: "20:00",
        horaFim: "21:00",
        chamada: "feita",
      },
    ]);

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula"));

    expect(await screen.findByText("Chamada feita")).toBeInTheDocument();
  });
});

describe("mês sem aula", () => {
  it("diz que não há, em vez de mostrar calendário mudo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([]);

    render(<AgendaDoProfessor />);

    expect(
      await screen.findByText("Nenhuma aula sua neste mês."),
    ).toBeInTheDocument();
  });
});

/**
 * **DEF-021 — a corrida entre dois dias.**
 *
 * Achado 1 da validação cruzada da SPEC-026. É o tipo de defeito que nunca
 * aparece em teste manual, porque em rede boa a resposta chega na ordem em
 * que foi pedida: o professor toca no dia 1, toca no dia 2, e a resposta do
 * dia 1 chega **por último**.
 *
 * O dano não é visual. O cabeçalho diz "Aulas de 02/09", os cartões embaixo
 * são os do dia 1, e o link leva para a chamada do dia errado — o professor
 * lança presença numa aula que não é aquela, numa tela que parecia certa.
 */
describe("DEF-021 — a resposta atrasada do dia anterior", () => {
  const aula = (ocupacaoId: string, turmaNome: string) => ({
    ocupacaoId,
    turmaId: "t1",
    turmaNome,
    quadraNome: "Quadra 1",
    horaInicio: "18:00",
    horaFim: "19:00",
    chamada: "pendente",
  });

  const doisDiasComAula = [
    { data: "2026-09-01", aulas: 1, pendentes: 1 },
    { data: "2026-09-02", aulas: 1, pendentes: 1 },
  ];

  it("não pinta sobre o dia que está aberto", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue(doisDiasComAula);

    let entregarDia1: (v: unknown) => void = () => undefined;
    getAulasDoDia.mockImplementation((data: string) =>
      data === "2026-09-01"
        ? new Promise((resolve) => {
            entregarDia1 = resolve;
          })
        : Promise.resolve([aula("ocup-dia-2", "Turma do dia 2")]),
    );

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula, 1 sem chamada"));
    fireEvent.click(await screen.findByLabelText("2: 1 aula, 1 sem chamada"));
    expect(await screen.findByText("Turma do dia 2")).toBeInTheDocument();

    // A resposta do dia 1 chega agora — depois de o professor já ter aberto
    // o dia 2. É este instante que produzia a tela mentirosa.
    await act(async () => {
      entregarDia1([aula("ocup-dia-1", "Turma do dia 1")]);
    });

    expect(screen.queryByText("Turma do dia 1")).not.toBeInTheDocument();
    expect(screen.getByText("Turma do dia 2")).toBeInTheDocument();
  });

  it("e o link continua sendo o da chamada do dia aberto", async () => {
    // A prova acima olha o texto; esta olha o `href`, que é o que de fato
    // leva o professor para a chamada errada. Sem ela, um conserto que só
    // arrumasse o título passaria verde.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue(doisDiasComAula);

    let entregarDia1: (v: unknown) => void = () => undefined;
    getAulasDoDia.mockImplementation((data: string) =>
      data === "2026-09-01"
        ? new Promise((resolve) => {
            entregarDia1 = resolve;
          })
        : Promise.resolve([aula("ocup-dia-2", "Turma do dia 2")]),
    );

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula, 1 sem chamada"));
    fireEvent.click(await screen.findByLabelText("2: 1 aula, 1 sem chamada"));
    await screen.findByText("Turma do dia 2");

    await act(async () => {
      entregarDia1([aula("ocup-dia-1", "Turma do dia 1")]);
    });

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/chamada/ocup-dia-2",
    );
  });

  /**
   * **Esta prova NÃO cai quando a guarda é removida — e fica registrada
   * como o que é.**
   *
   * Rodei a sabotagem: tirando `pedidoDoDia.current !== meuPedido`, as duas
   * provas acima caem e esta continua verde. O motivo é que a seção inteira
   * é condicionada a `diaAberto`, então com o dia fechado a resposta atrasada
   * não tem onde aparecer.
   *
   * Ou seja: ela guarda a **condição de render**, não o contador. Mantida por
   * isso, e anotada para que ninguém a conte como prova da corrida — foi
   * exatamente esse tipo de contagem que deixou passar o achado 2 da
   * validação cruzada da SPEC-025.
   */
  it("fechar o dia também descarta o que estava em voo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([doisDiasComAula[0]]);

    let entregar: (v: unknown) => void = () => undefined;
    getAulasDoDia.mockImplementation(
      () =>
        new Promise((resolve) => {
          entregar = resolve;
        }),
    );

    render(<AgendaDoProfessor />);
    const dia1 = await screen.findByLabelText("1: 1 aula, 1 sem chamada");
    fireEvent.click(dia1);
    fireEvent.click(dia1); // fecha

    await act(async () => {
      entregar([aula("ocup-dia-1", "Turma do dia 1")]);
    });

    expect(screen.queryByText("Turma do dia 1")).not.toBeInTheDocument();
  });
});

/**
 * O vizinho que a correção do DEF-021 expôs: a tela decidia "carregando"
 * por `aulas.length === 0`, então uma falha na busca virava "Carregando
 * aulas…" **para sempre**. Espera eterna é a pior forma de mostrar erro,
 * porque a pessoa não sabe que pode tentar de novo.
 */
describe("quando a busca do dia falha", () => {
  it("diz que falhou, em vez de carregar para sempre", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    getAgendaDoProfessor.mockResolvedValue([
      { data: "2026-09-01", aulas: 1, pendentes: 1 },
    ]);
    getAulasDoDia.mockRejectedValue(new Error("rede"));

    render(<AgendaDoProfessor />);
    fireEvent.click(await screen.findByLabelText("1: 1 aula, 1 sem chamada"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as aulas deste dia.",
    );
    expect(screen.queryByText("Carregando aulas…")).not.toBeInTheDocument();
  });
});
