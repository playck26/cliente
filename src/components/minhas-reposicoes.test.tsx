import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { MinhasReposicoes } from "./minhas-reposicoes";

/**
 * SPEC-046 — a faixa de reposição do aluno.
 *
 * **O que este arquivo guarda:** que ela **suma** quando não há falta, que
 * falta expirada e falta de aula cancelada continuem visíveis **sem botão**, e
 * que o crédito venha do servidor — nunca recalculado aqui.
 *
 * Que o crédito seja derivado, que a vaga saia da falta e que a capacidade
 * resista à corrida está no `spec-046-reposicao.db-spec.ts` e no `fit-035`,
 * sobre dados reais.
 */
const getMeuCreditoDeReposicao = vi.hoisted(() => vi.fn());
const getMeuCadastro = vi.hoisted(() => vi.fn());
const listarOportunidadesDeReposicao = vi.hoisted(() => vi.fn());
const marcarReposicao = vi.hoisted(() => vi.fn());
const desmarcarReposicao = vi.hoisted(() => vi.fn());
// SPEC-064/TASK-007 — a tela passou a ler a propria fila e a entrar/sair dela.
// **Mocados de proposito:** sem isto o `listarMinhaFila` REAL rodava, falhava no
// jsdom e caia no `catch` — as provas ficavam verdes por acidente de rede.
const listarMinhaFila = vi.hoisted(() => vi.fn());
const entrarNaFilaDeAula = vi.hoisted(() => vi.fn());
const sairDaFila = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getMeuCreditoDeReposicao,
    getMeuCadastro,
    listarOportunidadesDeReposicao,
    marcarReposicao,
    desmarcarReposicao,
    listarMinhaFila,
    entrarNaFilaDeAula,
    sairDaFila,
  };
});

function falta(extra: Record<string, unknown> = {}) {
  return {
    faltaId: "f-1",
    turmaNome: "Iniciante Terça",
    data: "2026-09-08",
    horaInicio: "19:00",
    horaFim: "20:00",
    expiraEm: "2026-10-08",
    expirada: false,
    aulaCancelada: false,
    reposicao: null,
    ...extra,
  };
}

function credito(extra: Record<string, unknown> = {}) {
  return {
    creditos: 1,
    porMes: 2,
    validadeDias: 30,
    usadasNoMes: 0,
    faltas: [falta()],
    ...extra,
  };
}

const oportunidade = {
  ocupacaoId: "oc-9",
  turmaId: "t-9",
  turmaNome: "Iniciante Quinta",
  quadraNome: "Quadra 2",
  data: "2026-09-18",
  horaInicio: "20:00",
  horaFim: "21:00",
  vagas: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  // SPEC-057/TASK-004 — a tela passou a perguntar o nível do aluno. Padrão
  // SEM nível: nele o recorte não esconde nada, e as provas antigas
  // continuam medindo exatamente o que mediam.
  getMeuCadastro.mockResolvedValue({ nivelId: null });
  getMeuCreditoDeReposicao.mockResolvedValue(credito());
  listarOportunidadesDeReposicao.mockResolvedValue([oportunidade]);
  listarMinhaFila.mockResolvedValue([]);
  entrarNaFilaDeAula.mockResolvedValue(undefined);
  sairDaFila.mockResolvedValue(undefined);
});

describe("SPEC-046 — aulas para repor", () => {
  it("mostra a falta e quantos créditos ele tem", async () => {
    render(<MinhasReposicoes />);

    expect(await screen.findByText("Aulas para repor")).toBeInTheDocument();
    expect(screen.getByText("1 disponível")).toBeInTheDocument();
    expect(screen.getByText(/Iniciante Terça/)).toBeInTheDocument();
  });

  it("**sem falta nenhuma, SOME** — não diz '0 créditos'", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(credito({ faltas: [] }));
    const { container } = render(<MinhasReposicoes />);

    // Quem está em dia não precisa ver esta faixa todo dia. Mesma decisão do
    // `meu-plano`, pela mesma razão.
    await waitFor(() => expect(getMeuCreditoDeReposicao).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("`403` (professor, gestor) some em silêncio", async () => {
    getMeuCreditoDeReposicao.mockRejectedValue(new ApiError(403, "Forbidden"));
    const { container } = render(<MinhasReposicoes />);

    // Esta faixa é um extra: derrubar a tela de perfil por causa dela seria
    // pior que não mostrá-la.
    await waitFor(() => expect(getMeuCreditoDeReposicao).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  // =====================================================================
  // As faltas que NÃO dão para repor continuam visíveis
  // =====================================================================

  it("**falta EXPIRADA aparece, e sem botão**", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(
      credito({ creditos: 0, faltas: [falta({ expirada: true })] }),
    );
    render(<MinhasReposicoes />);

    // Sumir com ela faria o aluno achar que nunca avisou — a mesma decisão da
    // SPEC-031/D14 do outro lado.
    expect(await screen.findByText(/Iniciante Terça/)).toBeInTheDocument();
    expect(screen.getByText(/O prazo para repor/)).toBeInTheDocument();
    expect(screen.queryByText("Repor")).not.toBeInTheDocument();
  });

  it("**falta de aula que o CLUBE cancelou aparece, e sem botão**", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(
      credito({ creditos: 0, faltas: [falta({ aulaCancelada: true })] }),
    );
    render(<MinhasReposicoes />);

    expect(
      await screen.findByText(/O clube cancelou esta aula/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Repor")).not.toBeInTheDocument();
  });

  // =====================================================================
  // Marcar
  // =====================================================================

  it("escolher abre os horários com vaga", async () => {
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
    expect(screen.getByText(/1 vaga/)).toBeInTheDocument();
  });

  it("marcar manda os DOIS ids e recarrega", async () => {
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));
    fireEvent.click(await screen.findByText("Marcar"));

    await waitFor(() =>
      expect(marcarReposicao).toHaveBeenCalledWith("f-1", "oc-9"),
    );
    // **Recarrega em vez de mexer no estado local:** o crédito é derivado no
    // servidor, e espelhá-lo aqui criaria uma segunda contagem.
    await waitFor(() =>
      expect(getMeuCreditoDeReposicao).toHaveBeenCalledTimes(2),
    );
  });

  it("nenhuma vaga diz isso — zero é uma resposta", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([]);
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));

    // Sem esta frase o aluno acha que a tela quebrou.
    expect(
      await screen.findByText(/Nenhuma turma com vaga/),
    ).toBeInTheDocument();
  });

  it("**a recusa do servidor aparece INTEIRA**", async () => {
    marcarReposicao.mockRejectedValue(
      new ApiError(409, "Você já usou 2 de 2 reposições deste mês."),
    );
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));
    fireEvent.click(await screen.findByText("Marcar"));

    // "Não foi possível marcar" faria o aluno tentar de novo para sempre sem
    // entender o motivo.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você já usou 2 de 2 reposições deste mês.",
    );
  });

  // =====================================================================
  // Já reposta
  // =====================================================================

  it("falta já reposta mostra ONDE, e oferece desmarcar", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(
      credito({
        creditos: 0,
        faltas: [
          falta({
            reposicao: {
              id: "r-1",
              turmaNome: "Iniciante Quinta",
              data: "2026-09-18",
              horaInicio: "20:00",
            },
          }),
        ],
      }),
    );
    render(<MinhasReposicoes />);

    expect(
      await screen.findByText(/Reposta em Iniciante Quinta/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Desmarcar"));
    await waitFor(() => expect(desmarcarReposicao).toHaveBeenCalledWith("r-1"));
  });

  it("o teto do mês aparece ANTES da recusa", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(
      credito({ usadasNoMes: 2, porMes: 2 }),
    );
    render(<MinhasReposicoes />);

    // "Você tem 1 crédito" sem dizer que o mês acabou produz um `409` que o
    // aluno não entende — e ele culpa o app, não a regra.
    expect(
      await screen.findByText(/Você já usou 2 de 2 reposições deste mês/),
    ).toBeInTheDocument();
  });
});

/**
 * SPEC-057/TASK-004/AC-026 — **o filtro de nível não pode esconder um
 * direito pago.**
 *
 * O veredito independente da SPEC-057 levantou este caso e ele virou prova:
 * aluno de nível A, **um crédito na mão**, e a única vaga do clube numa turma
 * de nível B. Filtrar é exibição — o crédito continua lá, o escape revela a
 * vaga, e o `POST` nunca ganhou recusa por nível.
 */
describe("SPEC-072/TASK-002 — nível nas oportunidades, SEM escape", () => {
  const A = "nivel-a";
  const B = "nivel-b";

  const abrirEscolha = async () => {
    const resultado = render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));
    return resultado;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMeuCadastro.mockResolvedValue({ nivelId: A });
    getMeuCreditoDeReposicao.mockResolvedValue(credito());
  });

  /**
   * **A vaga existe e ele não a alcança — e a tela diz a verdade sobre
   * isso.** É a `LIM-072a`: medido em produção, 2 de 3 reposições reais foram
   * fora do nível, e **não há contorno** (nenhuma rota de gestor marca
   * reposição). A frase não inventa compensação; diz o que continua valendo,
   * que é o crédito.
   */
  it("a única vaga é de OUTRO nível: a tela diz isso, e não `sem vaga`", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: B, nivelNome: "Avançado" },
    ]);

    await abrirEscolha();

    expect(
      await screen.findByText(/Nenhum horário do seu nível/),
    ).toBeInTheDocument();
    // A frase antiga mentiria: há vaga, ela só não é do nível dele.
    expect(
      screen.queryByText(/Nenhuma turma com vaga nos próximos dias/),
    ).toBeNull();
    // E não pode mandar tocar em "Todas", que não existe mais.
    expect(screen.queryByText(/Toque em/)).toBeNull();
  });

  /**
   * **AC-003 — o seletor saiu do DOM**, e a asserção discrimina remover de
   * esconder: `container.textContent` enxerga nó com `display:none`, que
   * `queryByRole` não enxergaria.
   */
  it("AC-003: o seletor não está no DOM — nem escondido por CSS", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: B, nivelNome: "Avançado" },
    ]);

    const { container } = await abrirEscolha();
    await screen.findByText(/Nenhum horário do seu nível/);

    expect(
      container.querySelector('[aria-label="Filtrar horários por nível"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("Meu nível");
    expect(container.textContent).not.toContain("Todas");
  });

  it("do meu nível: aparece, e o botão de marcar continua lá", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: A, nivelNome: "Iniciante" },
    ]);
    marcarReposicao.mockResolvedValue(undefined);

    await abrirEscolha();

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Marcar"));
    await waitFor(() => {
      expect(marcarReposicao).toHaveBeenCalledWith("f-1", "oc-9");
    });
  });

  /** **AC-004, metade do Cliente** — nulo nunca esconde nada (`INV-072b`). */
  it("AC-004 (Cliente): aluno SEM nível vê TODAS as oportunidades", async () => {
    getMeuCadastro.mockResolvedValue({ nivelId: null });
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: B, nivelNome: "Avançado" },
    ]);

    await abrirEscolha();

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
  });

  it("INV-141: oportunidade SEM nível aparece para quem tem nível", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: null, nivelNome: null },
    ]);

    await abrirEscolha();

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
  });
});

/**
 * SPEC-064/TASK-007 — **a aula cheia oferece a fila de espera** (card 5331).
 *
 * *"Usuário quer repor aula, encontra aula para repor, mas não tem vaga. Deixa
 * o aviso de interesse."* Até esta task ele nunca encontrava: o Back descartava
 * a aula cheia, e `entrarNaFilaDeAula` existia sem nenhum componente que a
 * chamasse.
 */
describe("SPEC-064/TASK-007 — a fila de espera numa aula CHEIA", () => {
  const cheia = { ...oportunidade, ocupacaoId: "oc-cheia", vagas: 0 };

  const abrirEscolha = async () => {
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));
  };

  /**
   * **Sem este pedido, o Back nunca manda a cheia** — e todo o resto desta
   * task é inalcançável. Pedir sem o parâmetro é a regressão que este caso
   * pega.
   */
  it("a tela PEDE as aulas sem vaga", async () => {
    await abrirEscolha();

    await waitFor(() => {
      expect(listarOportunidadesDeReposicao).toHaveBeenCalledWith({
        incluirSemVaga: true,
      });
    });
  });

  it("aula cheia: diz 'sem vaga' e oferece ENTRAR na fila, não Marcar", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([cheia]);

    await abrirEscolha();

    expect(await screen.findByText(/sem vaga/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Entrar na fila de espera desta aula",
      }),
    ).toBeInTheDocument();
    // "Marcar" numa aula cheia levaria a `409 TURMA_SEM_VAGA`.
    expect(screen.queryByRole("button", { name: "Marcar" })).toBeNull();
  });

  it("entrar na fila chama a rota com o id da OCORRÊNCIA, e relê a fila", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([cheia]);

    await abrirEscolha();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Entrar na fila de espera desta aula",
      }),
    );

    await waitFor(() => {
      expect(entrarNaFilaDeAula).toHaveBeenCalledWith("oc-cheia");
    });
    // Relida depois do gesto: é o que faz o botão virar "Sair da fila".
    await waitFor(() => {
      expect(listarMinhaFila.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("já na fila DESTA aula: oferece SAIR, com o id da LINHA", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([cheia]);
    listarMinhaFila.mockResolvedValue([
      { id: "linha-3", fila: "aula", ocupacaoId: "oc-cheia" },
    ]);

    await abrirEscolha();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Você está na fila de espera desta aula — sair",
      }),
    );

    // A rota de saída pede o id da LINHA, não o da ocupação.
    await waitFor(() => {
      expect(sairDaFila).toHaveBeenCalledWith("linha-3");
    });
  });

  /** A recusa aparece — o mesmo princípio da AC-009 da SPEC-072. */
  it("a recusa ao entrar na fila aparece na tela", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([cheia]);
    entrarNaFilaDeAula.mockRejectedValue(
      new ApiError(409, "Você já está nesta fila.", "JA_NA_FILA"),
    );

    await abrirEscolha();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Entrar na fila de espera desta aula",
      }),
    );

    expect(
      await screen.findByText("Você já está nesta fila."),
    ).toBeInTheDocument();
  });

  it("aula COM vaga continua sendo Marcar — nada muda para ela", async () => {
    await abrirEscolha();

    expect(
      await screen.findByRole("button", { name: "Marcar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Entrar na fila de espera desta aula",
      }),
    ).toBeNull();
  });
});
