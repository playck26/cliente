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
describe("SPEC-057/TASK-004 — nível nas oportunidades (AC-026)", () => {
  const A = "nivel-a";
  const B = "nivel-b";

  const abrirEscolha = async () => {
    render(<MinhasReposicoes />);
    fireEvent.click(await screen.findByText("Repor"));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMeuCadastro.mockResolvedValue({ nivelId: A });
    getMeuCreditoDeReposicao.mockResolvedValue(credito());
  });

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
  });

  it("`Todas` revela a vaga, e ela continua marcável", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: B, nivelNome: "Avançado" },
    ]);
    marcarReposicao.mockResolvedValue(undefined);

    await abrirEscolha();
    fireEvent.click(await screen.findByRole("button", { name: "Todas" }));

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Marcar"));
    await waitFor(() => {
      expect(marcarReposicao).toHaveBeenCalledWith("f-1", "oc-9");
    });
  });

  it("do meu nível: aparece sem precisar do escape", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: A, nivelNome: "Iniciante" },
    ]);

    await abrirEscolha();

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
  });

  it("sem nível nenhum nas opções, o filtro não aparece", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([
      { ...oportunidade, nivelId: null, nivelNome: null },
    ]);

    await abrirEscolha();

    expect(await screen.findByText("Iniciante Quinta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Todas" })).toBeNull();
  });
});
