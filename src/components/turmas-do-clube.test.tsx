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
const getMediaDaTurma = vi.hoisted(() => vi.fn());
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
    getMediaDaTurma,
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
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaDaTurma.mockResolvedValue({
    media: null,
    quantidade: 0,
    minimoParaMedia: 3,
  });
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

    fireEvent.click(await screen.findByRole("button", { name: "Entrar na turma" }));

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

  it("recusa de saída no dia da aula mostra a mensagem do servidor", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma({ jaEstouNela: true })]);
    sairDaTurma.mockRejectedValue(
      new ApiError(409, "Esta turma tem aula hoje.", "AULA_HOJE"),
    );
    render(<TurmasDoClube />);

    fireEvent.click(await screen.findByRole("button", { name: "Sair da turma" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta turma tem aula hoje.",
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
      new ApiError(409, "Esta turma já está com todas as vagas ocupadas.", "TURMA_CHEIA"),
    );

    render(<TurmasDoClube />);
    fireEvent.click(await screen.findByRole("button", { name: "Entrar na turma" }));

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
describe("a nota da turma", () => {
  it("mostra as estrelas e a média quando há nota", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockResolvedValue({
      media: 4.3,
      quantidade: 7,
      minimoParaMedia: 3,
    });
    render(<TurmasDoClube />);

    expect(
      await screen.findByLabelText("Nota 4,3 de 5, em 7 avaliações"),
    ).toBeInTheDocument();
    expect(screen.getByText("4,3")).toBeInTheDocument();
    expect(screen.getByText("(7)")).toBeInTheDocument();
  });

  it("turma sem nenhuma avaliação diz isso, em vez de sumir", async () => {
    // Ausência de estrela é dúvida; estrela vazia é informação.
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockResolvedValue({
      media: null,
      quantidade: 0,
      minimoParaMedia: 3,
    });
    render(<TurmasDoClube />);

    expect(await screen.findByText("Ainda sem avaliações")).toBeInTheDocument();
    expect(screen.getByLabelText("Ainda sem nota")).toBeInTheDocument();
  });

  /**
   * **SPEC-028 — estas duas provas foram INVERTIDAS, e o motivo fica junto.**
   *
   * Elas exigiam o contrário: que a média NÃO aparecesse com 2 avaliações, e
   * que a tela dissesse "2 de 3 avaliações". Era o mínimo de 3 (D4 da
   * SPEC-025), removido por decisão do Israel em 2026-08-30 — ele viu a tela e
   * perguntou *"o que seria 2 de 3 aval?"*.
   *
   * Invertidas em vez de apagadas: quem abrir o `git log` daqui a seis meses
   * vai encontrar uma prova que dizia o oposto, e precisa achar o porquê no
   * mesmo lugar.
   *
   * **O que se perdeu:** o mínimo era privacidade. Com uma nota, a média É
   * aquela nota. Sinalizado a ele antes; decisão dele.
   */
  it("com 2 avaliações, a média APARECE — antes era escondida", async () => {
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockResolvedValue({ media: 4.5, quantidade: 2 });
    render(<TurmasDoClube />);

    expect(await screen.findByText("4,5")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    // E a contagem some do lugar onde ela fingia ser nota.
    expect(screen.queryByText(/de 3 avaliações/)).not.toBeInTheDocument();
  });

  it("com UMA avaliação também — é o caso que custa a privacidade", async () => {
    // Explícito de propósito: numa turma de dois alunos, esta média é a nota
    // de um deles, e o professor sabe de quem. Está aqui para ninguém achar
    // que foi descuido.
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockResolvedValue({ media: 2, quantidade: 1 });
    render(<TurmasDoClube />);

    expect(await screen.findByText("2,0")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Nota 2,0 de 5, em 1 avaliação"),
    ).toBeInTheDocument();
  });

  it("as estrelas preenchem PROPORCIONALMENTE, não arredondado", async () => {
    // O defeito anterior: `n <= Math.round(nota)` desenhava a MESMA imagem
    // para 4,3 e 4,4. Agora a largura da fileira dourada é a nota / 5.
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockResolvedValue({ media: 3.5, quantidade: 4 });
    const { container } = render(<TurmasDoClube />);

    await screen.findByText("3,5");
    const dourada = container.querySelector<HTMLElement>("[style*='width']");
    expect(dourada?.style.width).toBe("70%");
  });

  it("enquanto a média não chega, não desenha meia estrela", async () => {
    // Meia estrela piscando é pior que esperar meio segundo.
    listTurmasDisponiveis.mockResolvedValue([turma()]);
    getMediaDaTurma.mockReturnValue(new Promise(() => undefined));
    render(<TurmasDoClube />);

    await screen.findByText("Iniciantes");
    expect(screen.queryByLabelText(/Nota/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ainda sem nota")).not.toBeInTheDocument();
  });
});
