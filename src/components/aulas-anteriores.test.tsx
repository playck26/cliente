import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AulasAnteriores } from "./aulas-anteriores";
import { ApiError, type AulaAnterior } from "@/lib/api-client";

/**
 * SPEC-027 — `listAulasAnteriores` passou a devolver `{ data, page, pageSize,
 * total }`.
 *
 * As provas continuam escrevendo **a lista de aulas**, e este helper embrulha
 * no envelope. Reescrever 13 chamadas para falar de paginação faria cada
 * prova carregar um detalhe que ela não está julgando.
 */
const responderCom = (aulas: AulaAnterior[]) =>
  listAulasAnteriores.mockResolvedValue({
    data: aulas,
    page: 1,
    pageSize: 20,
    total: aulas.length,
  });


/**
 * SPEC-025 — as provas da tela em que o aluno avalia a aula.
 *
 * Duas delas guardam decisões que a tela poderia trair em silêncio: o
 * **aviso de que a avaliação não é anônima** (REQ-008, decisão do Israel) e
 * a ausência de média por aula — ele foi explícito, "as aulas não têm
 * média", e uma média aqui seria o produto contradizendo a decisão.
 */

const listAulasAnteriores = vi.hoisted(() => vi.fn());
const avaliarAula = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listAulasAnteriores, avaliarAula };
});

/**
 * **ACHADO 3 DA 3ª VALIDAÇÃO CRUZADA (ALTA) — a fixture agora carrega o
 * contrato.**
 *
 * Era `Record<string, unknown>` entrando e `unknown[]` saindo, e o `tsc`
 * não tinha como cobrar `naoRealizada` — o campo que decide se esta tela
 * oferece ou não o formulário de avaliação. Apagar os dois ramos da produção
 * deixava as 13 provas daqui verdes, e a tela voltava a oferecer
 * "Avaliar/Mudar minha nota" numa aula que o servidor recusa com
 * `409 AULA_NAO_REALIZADA`.
 *
 * `Partial<AulaAnterior>` no `patch`: o retorno continua sendo uma
 * `AulaAnterior` completa, e agora é o compilador que garante isso — nenhum
 * campo novo do contrato pode entrar sem passar por aqui.
 */
function aula(patch: Partial<AulaAnterior> = {}): AulaAnterior {
  return {
    ocupacaoId: "o1",
    turmaId: "t1",
    turmaNome: "Iniciantes",
    quadraNome: "Quadra 1",
    data: "2026-08-25",
    horaInicio: "18:00",
    horaFim: "19:00",
    minhaNota: null,
    meuComentario: null,
    naoRealizada: false,
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  avaliarAula.mockResolvedValue({ nota: 5, comentario: null, updatedAt: null });
});

describe("a lista", () => {
  it("mostra a aula com data, horário e quadra", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    expect(await screen.findByText("Iniciantes")).toBeInTheDocument();
    expect(
      screen.getByText(/Terça, 25\/08 · 18:00–19:00 · Quadra 1/),
    ).toBeInTheDocument();
  });

  it("sem aulas, explica em vez de mostrar lista vazia", async () => {
    responderCom([]);
    render(<AulasAnteriores />);

    expect(await screen.findByText("Nenhuma aula ainda")).toBeInTheDocument();
  });

  it("aula já avaliada mostra a própria nota, e o botão muda de texto", async () => {
    responderCom([aula({ minhaNota: 4 })]);
    render(<AulasAnteriores />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mudar minha nota" }),
    ).toBeInTheDocument();
  });

  it("aula não avaliada convida a avaliar", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    expect(
      await screen.findByRole("button", { name: "Avaliar esta aula" }),
    ).toBeInTheDocument();
  });
});

/**
 * **SPEC-030 / achado 3 da 3ª validação cruzada (ALTA) — os dois ramos de
 * `naoRealizada` não tinham prova nenhuma.**
 *
 * A produção ganhou dois `if` nesta tela — o selo "Não realizada" e a
 * ausência do formulário — e a suíte inteira ficava verde se os dois
 * sumissem. O aluno voltaria a receber "Avaliar esta aula" numa aula que
 * não aconteceu, tocaria, e levaria `409 AULA_NAO_REALIZADA` do servidor:
 * a armadilha do DEF-011, lista que oferece o que o servidor recusa.
 *
 * Cada prova daqui vem em par — o caso não realizado e o caso normal —
 * porque um ramo só provado de um lado passa igual se ele recusar sempre.
 */
describe("a aula que não aconteceu (SPEC-030)", () => {
  it("fica na lista, marcada, e NÃO oferece avaliar", async () => {
    responderCom([aula({ naoRealizada: true })]);
    render(<AulasAnteriores />);

    // Fica: `GET /me/classes` só devolve o futuro, então excluí-la daqui a
    // faria sumir das duas listas do aluno — que pode ter ido até o clube.
    expect(await screen.findByText("Iniciantes")).toBeInTheDocument();
    expect(screen.getByText("Não realizada")).toBeInTheDocument();
    expect(
      screen.getByText("Esta aula não aconteceu, então não há o que avaliar."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Avaliar esta aula" }),
    ).not.toBeInTheDocument();
  });

  it("a aula normal continua oferecendo avaliar, e sem o selo", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    expect(
      await screen.findByRole("button", { name: "Avaliar esta aula" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não realizada")).not.toBeInTheDocument();
  });

  /**
   * **Julgamento pedido na 3ª rodada, e aceito: a nota antiga fica
   * invisível enquanto a aula está `nao_houve`, e volta se alguém
   * reverter.**
   *
   * O dado não é apagado — o servidor continua com ele. O que muda é o que
   * a tela afirma: uma nota exibida ao lado de "não aconteceu" seria a tela
   * dizendo que o aluno avaliou uma aula que não existiu.
   */
  it("aula não realizada esconde a nota antiga em vez de apagá-la", async () => {
    responderCom([aula({ naoRealizada: true, minhaNota: 4 })]);
    render(<AulasAnteriores />);

    await screen.findByText("Iniciantes");
    expect(screen.getByText("Não realizada")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mudar minha nota" }),
    ).not.toBeInTheDocument();
  });

  it("revertida, a MESMA nota volta a aparecer", async () => {
    // O par do julgamento acima: reverter o estado factual torna a
    // avaliação pertinente de novo, e ela está lá inteira.
    responderCom([aula({ naoRealizada: false, minhaNota: 4 })]);
    render(<AulasAnteriores />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mudar minha nota" }),
    ).toBeInTheDocument();
  });

  it("uma não realizada no meio não afeta as vizinhas", async () => {
    // A lista mistura os dois casos no uso real. Sem esta, um ramo que
    // apagasse o formulário da lista INTEIRA passaria nas provas acima.
    responderCom([
      aula({ ocupacaoId: "o1", turmaNome: "Chuva", naoRealizada: true }),
      aula({ ocupacaoId: "o2", turmaNome: "Normal" }),
    ]);
    render(<AulasAnteriores />);

    await screen.findByText("Chuva");
    expect(screen.getByText("Não realizada")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Avaliar esta aula" }),
    ).toHaveLength(1);
  });
});

describe("a aula NÃO tem média — decisão do Israel", () => {
  it("nada na tela mostra média de aula", async () => {
    // "As aulas não têm média, mas as avaliações das aulas influenciam a
    // média da turma." Uma média aqui seria o produto contradizendo isso.
    responderCom([aula({ minhaNota: 4 })]);
    const { container } = render(<AulasAnteriores />);

    await screen.findByText("Iniciantes");
    expect(container.textContent).not.toMatch(/média/i);
    expect(container.textContent).not.toMatch(/avaliações/i);
  });
});

describe("avaliar", () => {
  it("exige escolher uma estrela antes de habilitar o envio", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("manda a nota escolhida", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrelas" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(avaliarAula).toHaveBeenCalledWith("o1", {
        nota: 4,
        comentario: undefined,
      }),
    );
  });

  it("comentário em branco não vira string vazia", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 estrelas" }));
    fireEvent.change(screen.getByLabelText("Comentário sobre a aula"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(avaliarAula).toHaveBeenCalledWith("o1", {
        nota: 5,
        comentario: undefined,
      }),
    );
  });

  it("abre preenchida quando já havia nota", async () => {
    responderCom([
      aula({ minhaNota: 3, meuComentario: "Foi ok" }),
    ]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Mudar minha nota" }));

    expect(screen.getByLabelText("Comentário sobre a aula")).toHaveValue(
      "Foi ok",
    );
    expect(screen.getByRole("radio", { name: "3 estrelas" })).toBeChecked();
  });

  it("erro do servidor aparece com a mensagem dele", async () => {
    responderCom([aula()]);
    avaliarAula.mockRejectedValue(
      new ApiError(409, "Você pode avaliar esta aula a partir do dia seguinte.", "AULA_NAO_TERMINOU"),
    );
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));
    fireEvent.click(screen.getByRole("radio", { name: "1 estrela" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a partir do dia seguinte",
    );
  });
});

describe("REQ-008 — o aviso de que não é anônima", () => {
  /**
   * **Esta prova foi reescrita depois da validação cruzada, e o motivo vale
   * mais que a correção.**
   *
   * A primeira versão só verificava que o aviso *existia na tela* — e passou
   * com ele **abaixo** do campo de texto, ou seja, com a pessoa já tendo
   * escrito quando lia que o clube veria o nome dela. A prova cumpria a
   * letra do requisito e ignorava a intenção dele.
   *
   * Agora ela exige a **ordem no DOM**. É o que o REQ-008 sempre quis dizer
   * com "antes de escrever".
   */
  it("vem ANTES do campo de texto, não depois", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));

    const aviso = screen.getByText(
      "O clube vê sua nota, seu comentário e seu nome.",
    );
    const campo = screen.getByLabelText("Comentário sobre a aula");

    // `DOCUMENT_POSITION_FOLLOWING` = o campo vem DEPOIS do aviso.
    expect(
      aviso.compareDocumentPosition(campo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("e também antes do botão de enviar", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    fireEvent.click(await screen.findByRole("button", { name: "Avaliar esta aula" }));

    const aviso = screen.getByText(
      "O clube vê sua nota, seu comentário e seu nome.",
    );
    const enviar = screen.getByRole("button", { name: "Enviar" });

    expect(
      aviso.compareDocumentPosition(enviar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("e some junto com o formulário, porque só vale ali", async () => {
    responderCom([aula()]);
    render(<AulasAnteriores />);

    expect(
      screen.queryByText("O clube vê sua nota, seu comentário e seu nome."),
    ).not.toBeInTheDocument();
  });
});
