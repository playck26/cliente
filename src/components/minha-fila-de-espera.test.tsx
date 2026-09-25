import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhaFilaDeEspera } from "./minha-fila-de-espera";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-064/TASK-005 — as provas da tela da fila.
 *
 * **A que discrimina é a segunda.** `vezAberta` não é `estado === "chamado"`:
 * quem expira a vez é um agendador com interruptor (D8), então uma linha pode
 * estar `chamado` no banco com o prazo vencido. Se a tela decidir pelo estado,
 * ela oferece um "Confirmar" que o servidor recusa com `VEZ_EXPIRADA` — e essa
 * é a armadilha do DEF-011, que este projeto já pagou uma vez.
 */

const listarMinhaFila = vi.hoisted(() => vi.fn());
const confirmarVezNaFila = vi.hoisted(() => vi.fn());
const sairDaFila = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listarMinhaFila, confirmarVezNaFila, sairDaFila };
});

function linha(patch: Record<string, unknown> = {}) {
  return {
    id: "f1",
    fila: "turma",
    estado: "aguardando",
    vezAberta: false,
    chamadoAte: null,
    turmaId: "t1",
    turmaNome: "Iniciantes",
    ocupacaoId: null,
    data: null,
    horaInicio: null,
    horaFim: null,
    quadraNome: null,
    criadaEm: "2026-09-20T12:00:00.000Z",
    ...patch,
  };
}

/** Uma vez viva: `chamado` e com prazo no futuro. */
const vezViva = linha({
  id: "f-viva",
  estado: "chamado",
  vezAberta: true,
  chamadoAte: "2030-01-03T22:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  confirmarVezNaFila.mockResolvedValue(undefined);
  sairDaFila.mockResolvedValue(undefined);
});

describe("sem fila, a tela não ocupa espaço", () => {
  it("não desenha nada quando a lista vem vazia", async () => {
    listarMinhaFila.mockResolvedValue([]);

    const { container } = render(<MinhaFilaDeEspera />);

    await waitFor(() => expect(listarMinhaFila).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("some também quando a chamada FALHA — a agenda não some junto", async () => {
    listarMinhaFila.mockRejectedValue(new Error("rede"));

    const { container } = render(<MinhaFilaDeEspera />);

    await waitFor(() => expect(listarMinhaFila).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("a vez, e o prazo dela", () => {
  it("vez ABERTA mostra Confirmar, o prazo e o aviso de que a vaga não é reservada", async () => {
    listarMinhaFila.mockResolvedValue([vezViva]);

    render(<MinhaFilaDeEspera />);

    expect(await screen.findByText("É a sua vez")).toBeInTheDocument();
    expect(screen.getByText("Iniciantes")).toBeInTheDocument();
    expect(screen.getByText(/Confirme até/)).toBeInTheDocument();
    // LIM-064a — o texto não promete a vaga.
    expect(screen.getByText(/não está reservada/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar" }),
    ).toBeInTheDocument();
  });

  it("CHAMADO com prazo VENCIDO não oferece Confirmar", async () => {
    // **O caso que separa esta tela de uma que olha o estado.** A linha está
    // `chamado` no banco; só `vezAberta` sabe que o prazo passou.
    listarMinhaFila.mockResolvedValue([
      linha({
        id: "f-vencida",
        estado: "chamado",
        vezAberta: false,
        chamadoAte: "2020-01-01T10:00:00.000Z",
      }),
    ]);

    render(<MinhaFilaDeEspera />);

    expect(await screen.findByText("Na fila de espera")).toBeInTheDocument();
    expect(screen.queryByText("É a sua vez")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar" }),
    ).not.toBeInTheDocument();
  });
});

describe("confirmar, e a recusa que é normal", () => {
  it("confirma e recarrega a lista", async () => {
    listarMinhaFila.mockResolvedValue([vezViva]);

    render(<MinhaFilaDeEspera />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(confirmarVezNaFila).toHaveBeenCalledWith("f-viva"),
    );
    // Recarrega: a linha mudou de estado no servidor, e a tela não pode
    // continuar mostrando o mundo de antes do toque.
    await waitFor(() => expect(listarMinhaFila).toHaveBeenCalledTimes(2));
  });

  it("a recusa é lida pelo CÓDIGO, não pela mensagem do servidor", async () => {
    listarMinhaFila.mockResolvedValue([vezViva]);
    confirmarVezNaFila.mockRejectedValue(
      // Mensagem propositalmente diferente do texto da tela: se o componente
      // decidisse por ela, este teste passaria por acidente.
      new ApiError(409, "texto que muda numa revisão de copy", "VEZ_EXPIRADA"),
    );

    render(<MinhaFilaDeEspera />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O prazo desta vez venceu.",
    );
  });
});

describe("sair da fila", () => {
  it("sai de uma linha em espera", async () => {
    listarMinhaFila.mockResolvedValue([linha({ id: "f-espera" })]);

    render(<MinhaFilaDeEspera />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));

    await waitFor(() => expect(sairDaFila).toHaveBeenCalledWith("f-espera"));
  });

  it("desistir da VEZ também é sair — e é legítimo", async () => {
    listarMinhaFila.mockResolvedValue([vezViva]);

    render(<MinhaFilaDeEspera />);
    fireEvent.click(await screen.findByRole("button", { name: "Desistir" }));

    await waitFor(() => expect(sairDaFila).toHaveBeenCalledWith("f-viva"));
  });
});

describe("a fila de aula diz QUANDO é a aula", () => {
  it("mostra dia e hora ao lado do nome da turma", async () => {
    listarMinhaFila.mockResolvedValue([
      linha({
        id: "f-aula",
        fila: "aula",
        turmaId: null,
        ocupacaoId: "o1",
        data: "2026-09-24",
        horaInicio: "19:00",
        horaFim: "20:00",
        quadraNome: "Quadra 1",
      }),
    ]);

    render(<MinhaFilaDeEspera />);

    expect(await screen.findByText(/Iniciantes/)).toHaveTextContent("19h");
  });
});
