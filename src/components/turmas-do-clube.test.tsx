import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TurmasDoClube } from "./turmas-do-clube";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-023 — as provas da tela em que o aluno entra e sai de turma.
 *
 * O que elas guardam é o que a spec decidiu **contra** o caminho fácil:
 * turma cheia aparece em vez de sumir; o motivo fica à vista embaixo do
 * botão apagado; e a contagem se corrige quando o servidor desmente a tela.
 */

const listTurmasDisponiveis = vi.hoisted(() => vi.fn());
const getMeuCadastro = vi.hoisted(() => vi.fn());
const entrarNaTurma = vi.hoisted(() => vi.fn());
const sairDaTurma = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listTurmasDisponiveis,
    getMeuCadastro,
    entrarNaTurma,
    sairDaTurma,
  };
});

function turma(patch: Record<string, unknown> = {}) {
  return {
    id: "t1",
    nome: "Iniciantes",
    status: "ativa",
    capacidade: 8,
    matriculados: 6,
    jaEstouNela: false,
    podeEntrar: true,
    motivo: null,
    encontros: [{ diaSemana: 2, horaInicio: "18:00", horaFim: "19:00" }],
    nivelId: null,
    nivelNome: null,
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // SPEC-057/TASK-004 — a tela passou a perguntar o nível do aluno. O padrão
  // daqui é SEM nível porque nele o recorte não esconde nada, e as provas
  // antigas continuam medindo o que mediam.
  //
  // **Não porque seja o estado da maioria:** essa premissa caiu na medição de
  // 2026-09-24 (12 alunos ativos, 9 COM nível — 75%). Ver a supersessão na
  // SPEC-072.
  getMeuCadastro.mockResolvedValue({ nivelId: null });
  entrarNaTurma.mockResolvedValue(undefined);
  sairDaTurma.mockResolvedValue(undefined);
});

describe("a ocupação à vista (pedido do Israel)", () => {
  it("mostra quantos já estão e qual o limite", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("6 de 8")).toBeInTheDocument();
  });

  it("a barra de ocupação anuncia os mesmos números para leitor de tela", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    const barra = await screen.findByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "6");
    expect(barra).toHaveAttribute("aria-valuemax", "8");
  });
});

describe("turma cheia aparece, marcada", () => {
  it("não some da lista", async () => {
    // Some com ela e a pessoa pergunta no WhatsApp por que a turma das 18h
    // não está lá.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
    ]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("Iniciantes")).toBeInTheDocument();
    expect(screen.getByText("· sem vagas")).toBeInTheDocument();
  });

  it("o botão fica desabilitado COM o motivo à vista", async () => {
    // Botão apagado sem explicação é a pessoa tocando de novo achando que
    // falhou.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
    ]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByRole("button", { name: "Entrar na turma" }),
    ).toBeDisabled();
    expect(screen.getByText("Sem vagas")).toBeInTheDocument();
  });

  it("a explicação é escolhida pelo CÓDIGO, não pela mensagem do servidor", async () => {
    // O código é o contrato (schema publicado, LIM-004); a mensagem é copy e
    // muda sem aviso. Tela que decide por mensagem quebra calada.
    listTurmasDisponiveis.mockResolvedValue([
      turma({ podeEntrar: false, motivo: "LIMITE_DE_TURMAS" }),
    ]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByText("Você atingiu o limite de turmas deste clube"),
    ).toBeInTheDocument();
  });

  it("código desconhecido não quebra a tela", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ podeEntrar: false, motivo: "MOTIVO_QUE_AINDA_NAO_EXISTE" }),
    ]);
    render(<TurmasDoClube />);

    expect(await screen.findByText("Não disponível")).toBeInTheDocument();
  });
});

describe("entrar e sair", () => {
  it("entra e recarrega a lista", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    render(<TurmasDoClube />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Entrar na turma" }),
    );

    await waitFor(() => expect(entrarNaTurma).toHaveBeenCalledWith("t1"));
    expect(listTurmasDisponiveis).toHaveBeenCalledTimes(2);
  });

  it("quem já está na turma vê SAIR, não entrar", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByRole("button", { name: "Sair da turma" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar na turma" }),
    ).not.toBeInTheDocument();
  });

  /**
   * **SPEC-031/TASK-009d — o código mudou, e a tela não.**
   *
   * A fixture citava `AULA_HOJE`, que o back parou de emitir no passo 3 e
   * saiu do contrato no passo 4. Trocada por `PRAZO_DE_CANCELAMENTO`, que é o
   * que a rota devolve agora.
   *
   * **A tela não precisou mudar uma linha**, e é isso que o rollout de quatro
   * passos existe para conseguir: ela mostra a mensagem do servidor, sem
   * ramificar no código. Se ela ramificasse, este teste teria sido a primeira
   * coisa a quebrar — e o passo 3 teria quebrado clube em produção.
   */
  it("recusa por prazo mostra a mensagem do servidor, sem ramificar no código", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    sairDaTurma.mockRejectedValue(
      new ApiError(
        409,
        "Esta turma exige 2h de antecedência para sair.",
        "PRAZO_DE_CANCELAMENTO",
      ),
    );
    render(<TurmasDoClube />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Sair da turma" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta turma exige 2h de antecedência para sair.",
    );
  });

  /**
   * O contrapositivo do rollout: um código que a tela **nunca viu** também
   * mostra a mensagem. É a prova de que ela não tem lista de códigos
   * conhecidos — e portanto que o passo 3 podia trocar o código sem avisá-la.
   */
  it("código desconhecido também mostra a mensagem do servidor", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    sairDaTurma.mockRejectedValue(
      new ApiError(409, "Motivo que a tela nunca viu.", "CODIGO_INVENTADO"),
    );
    render(<TurmasDoClube />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Sair da turma" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Motivo que a tela nunca viu.",
    );
  });
});

describe("a contagem envelhece — e a tela não insiste nela", () => {
  it("depois de TURMA_CHEIA, a lista é recarregada", async () => {
    // Dúvida 2 da spec: entre pintar "7 de 8" e a pessoa tocar, alguém pode
    // entrar. A tela informa, o servidor decide sob trava. O que não é
    // aceitável é continuar mostrando 7 depois de o servidor desmentir.
    listTurmasDisponiveis
      .mockResolvedValueOnce([turma({ matriculados: 7 })])
      .mockResolvedValueOnce([
        turma({ matriculados: 8, podeEntrar: false, motivo: "TURMA_CHEIA" }),
      ]);
    entrarNaTurma.mockRejectedValue(
      new ApiError(
        409,
        "Esta turma já está com todas as vagas ocupadas.",
        "TURMA_CHEIA",
      ),
    );

    render(<TurmasDoClube />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Entrar na turma" }),
    );

    expect(await screen.findByText("8 de 8")).toBeInTheDocument();
    expect(screen.queryByText("7 de 8")).not.toBeInTheDocument();
  });
});

describe("estados vazios", () => {
  it("clube sem turmas diz isso, em vez de mostrar lista vazia", async () => {
    listTurmasDisponiveis.mockResolvedValue([]);
    render(<TurmasDoClube />);

    expect(
      await screen.findByText("Este clube ainda não tem turmas cadastradas."),
    ).toBeInTheDocument();
  });
});

/**
 * **A nota em estrelas — pedido do Israel ao ver a tela em produção.**
 *
 * A primeira versão mostrava um selo com o número **só quando havia média**,
 * e o mínimo de 3 avaliações (D4 da SPEC-025) fazia com que nenhuma turma
 * exibisse nada. A informação existia e a tela não a apresentava.
 *
 * O mínimo continua valendo — ele é de **privacidade** antes de estatística.
 * O que mudou é que a linha sempre aparece: sem média, ela diz o que falta.
 */
/**
 * SPEC-057/TASK-002/D12 (card 5352) — **a nota saiu desta tela.**
 *
 * Havia aqui um bloco de seis provas sobre as estrelas: a média proporcional,
 * o caso de uma avaliação só, a turma sem nota. Elas mediam comportamento que
 * a SPEC-025 e a SPEC-028 construíram, e que **este card manda remover** —
 * *"ocultar nota da turma do usuário final e do professor"*. A SPEC-052 já
 * tinha tirado do professor.
 *
 * Elas **não foram apagadas em silêncio**: viraram a prova do contrário. O
 * que estas duas guardam é que a nota não volta por descuido, e que a busca
 * saiu junto com o desenho — manter a chamada alimentando um estado que
 * ninguém lê seria uma ida à rede por turma, por nada.
 *
 * Depois que este Cliente foi ao ar, a contração terminou: a rota saiu do
 * Back, e `getMediaDaTurma` e `NotaDaTurma` saíram daqui. (Este comentário
 * citava um `nota-da-turma.test.tsx` que nunca existiu.)
 */
describe("SPEC-057/TASK-002 — a nota não aparece mais para o aluno", () => {
  beforeEach(() => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
  });

  it("nenhuma estrela, nenhuma média, nenhum `avaliações`", async () => {
    render(<TurmasDoClube />);
    await screen.findByText("Iniciantes");

    expect(screen.queryByText(/avaliaç/i)).toBeNull();
    expect(screen.queryByText(/^[0-5],[0-9]$/)).toBeNull();
  });

  it("e o cliente nem tem mais como pedir a média — a função saiu", async () => {
    const real =
      await vi.importActual<Record<string, unknown>>("@/lib/api-client");

    expect(real).not.toHaveProperty("getMediaDaTurma");
  });
});

describe("SPEC-072/TASK-002 — o recorte por nível, agora SEM escape", () => {
  const A = "nivel-a";
  const B = "nivel-b";

  beforeEach(() => {
    vi.clearAllMocks();
    getMeuCadastro.mockResolvedValue({ nivelId: A });
  });

  it("some a turma de outro nível — e não há mais como revelá-la", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t1", nome: "Do meu nível", nivelId: A, nivelNome: "A" }),
      turma({ id: "t2", nome: "De outro nível", nivelId: B, nivelNome: "B" }),
    ]);

    render(<TurmasDoClube />);

    expect(await screen.findByText("Do meu nível")).toBeInTheDocument();
    expect(screen.queryByText("De outro nível")).toBeNull();
  });

  it("e o nível da turma aparece no cartão", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ nivelId: A, nivelNome: "Iniciante" }),
    ]);

    render(<TurmasDoClube />);

    expect(await screen.findByText("Iniciante")).toBeInTheDocument();
  });

  /**
   * **AC-003 — o seletor NÃO EXISTE, e isso não é o mesmo que estar
   * escondido.**
   *
   * `queryByRole` devolveria `null` também para um botão com `display:none`
   * ou `aria-hidden`, porque ele sai da árvore de acessibilidade — a
   * asserção óbvia **não discrimina** remover de esconder, e a AC pede
   * exatamente essa distinção.
   *
   * `container.textContent` **inclui** o texto de nó escondido por CSS. É
   * por isso que a prova olha para ele: esconder por estilo deixa este caso
   * vermelho, que é o que a sabotagem da spec exige.
   */
  it("AC-003: o seletor não está no DOM — nem escondido por CSS", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t1", nome: "Do meu nível", nivelId: A, nivelNome: "A" }),
      turma({ id: "t2", nome: "De outro nível", nivelId: B, nivelNome: "B" }),
    ]);

    const { container } = render(<TurmasDoClube />);
    await screen.findByText("Do meu nível");

    expect(
      container.querySelector('[aria-label="Filtrar turmas por nível"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("Meu nível");
    expect(container.textContent).not.toContain("Todas");
  });

  /**
   * **AC-004, metade do Cliente.** Nulo nunca esconde nada (`INV-072b`): um
   * filtro que escondesse tudo de quem não foi classificado transformaria a
   * melhoria em apagão.
   *
   * A outra metade desta AC é do **Back**, com `POST` real — o servidor
   * continua aceitando reposição fora do nível. São duas porque este teste
   * usa o cliente mockado e não diz nada sobre o servidor (foi o B02).
   */
  it("AC-004 (Cliente): aluno SEM nível vê TODAS as turmas", async () => {
    getMeuCadastro.mockResolvedValue({ nivelId: null });
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t1", nome: "Do nível A", nivelId: A, nivelNome: "A" }),
      turma({ id: "t2", nome: "Do nível B", nivelId: B, nivelNome: "B" }),
    ]);

    render(<TurmasDoClube />);

    expect(await screen.findByText("Do nível A")).toBeInTheDocument();
    expect(screen.getByText("Do nível B")).toBeInTheDocument();
  });

  it("INV-141: turma SEM nível aparece para quem tem nível", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t1", nome: "Sem nivelamento", nivelId: null }),
      turma({ id: "t2", nome: "De outro nível", nivelId: B, nivelNome: "B" }),
    ]);

    render(<TurmasDoClube />);

    expect(await screen.findByText("Sem nivelamento")).toBeInTheDocument();
    expect(screen.queryByText("De outro nível")).toBeNull();
  });

  /**
   * **O vazio tem de dizer a verdade, e a verdade mudou.** "Nenhuma turma do
   * seu nível" e "o clube não tem turma" continuam sendo coisas diferentes —
   * mas a primeira **não tem mais saída**, e a frase não pode continuar
   * mandando tocar num botão que saiu do DOM.
   */
  it("vazio do recorte ≠ clube sem turma, e a frase não oferece o que não existe", async () => {
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t2", nome: "De outro nível", nivelId: B, nivelNome: "B" }),
    ]);

    render(<TurmasDoClube />);

    expect(
      await screen.findByText(/Nenhuma turma do seu nível/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ainda não tem turmas cadastradas/)).toBeNull();
    expect(screen.queryByText(/Toque em/)).toBeNull();
  });

  it("clube sem turma nenhuma continua com a mensagem de sempre", async () => {
    listTurmasDisponiveis.mockResolvedValue([]);

    render(<TurmasDoClube />);

    expect(
      await screen.findByText(/ainda não tem turmas cadastradas/),
    ).toBeInTheDocument();
  });

  /**
   * **O recorte não pode derrubar a tela.** O nível é informação secundária:
   * se `/me/cadastro` falhar, a lista continua inteira — mostrar demais é
   * recuperável, esconder faria o clube parecer vazio.
   */
  it("falha ao ler o cadastro: a lista aparece inteira, sem recorte", async () => {
    getMeuCadastro.mockRejectedValue(new Error("rede"));
    listTurmasDisponiveis.mockResolvedValue([
      turma({ id: "t1", nome: "Do nível A", nivelId: A, nivelNome: "A" }),
      turma({ id: "t2", nome: "Do nível B", nivelId: B, nivelNome: "B" }),
    ]);

    render(<TurmasDoClube />);

    expect(await screen.findByText("Do nível A")).toBeInTheDocument();
    expect(screen.getByText("Do nível B")).toBeInTheDocument();
  });
});
