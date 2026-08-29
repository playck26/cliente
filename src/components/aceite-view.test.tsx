import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AceiteView } from "./aceite-view";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-024 — as provas da tela que resolve o portão.
 *
 * **Esta tela é a resposta à LIM-024d.** Sem ela, ligar o portão em produção
 * bloquearia toda a base de alunos sem caminho de saída — o servidor barra
 * tudo e a pessoa vê um erro seco. É por isso que as provas aqui olham menos
 * o desenho e mais os caminhos de saída: aceitar, sobrar pendência, e o
 * texto ter mudado no meio da leitura.
 */

const getAceitesPendentes = vi.hoisted(() => vi.fn());
const registrarAceite = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const getPapel = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-storage", () => ({ getPapel }));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getAceitesPendentes, registrarAceite };
});

const TERMO = { versao: 1, texto: "Termo da plataforma, versão 1." };
const CONTRATO = { versao: 3, texto: "Contrato do clube, versão 3." };

beforeEach(() => {
  vi.clearAllMocks();
  getPapel.mockReturnValue("aluno");
  registrarAceite.mockResolvedValue({
    termoVersaoAceita: 1,
    contratoVersaoAceita: 3,
    aindaPendente: false,
  });
});

describe("os dois textos são independentes", () => {
  it("mostra os dois quando os dois estão pendentes", async () => {
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: CONTRATO });
    render(<AceiteView />);

    expect(await screen.findByText("Termo de uso da plataforma")).toBeInTheDocument();
    expect(screen.getByText("Contrato do clube")).toBeInTheDocument();
    expect(screen.getByText("Antes de continuar")).toBeInTheDocument();
  });

  it("mostra só um quando só um está pendente", async () => {
    // Caminho real: o clube publica contrato novo para quem já aceitou o
    // termo há meses.
    getAceitesPendentes.mockResolvedValue({ termo: null, contrato: CONTRATO });
    render(<AceiteView />);

    expect(await screen.findByText("Contrato do clube")).toBeInTheDocument();
    expect(
      screen.queryByText("Termo de uso da plataforma"),
    ).not.toBeInTheDocument();
  });

  it("a versão de cada texto fica à vista", async () => {
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: CONTRATO });
    render(<AceiteView />);

    expect(await screen.findByText("versão 1")).toBeInTheDocument();
    expect(screen.getByText("versão 3")).toBeInTheDocument();
  });
});

describe("aceitar", () => {
  it("exige marcar a caixa antes de habilitar o botão", async () => {
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: null });
    render(<AceiteView />);

    const botao = await screen.findByRole("button", { name: "Continuar" });
    expect(botao).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao).toBeEnabled();
  });

  it("manda as VERSÕES lidas, não um 'aceito' vazio", async () => {
    // Sem a versão, um cliente velho aceitaria "o que estiver valendo" — a
    // pessoa concordaria com um texto que não viu.
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: CONTRATO });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(registrarAceite).toHaveBeenCalledWith({ termo: 1, contrato: 3 }),
    );
  });

  it("aceito tudo, sai da tela", async () => {
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: null });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("se o servidor disser que AINDA sobrou, NÃO navega", async () => {
    // Confiar num "deu certo" e navegar assim mesmo faria a pessoa bater no
    // portão de novo, e parecer que o app está quebrado.
    getAceitesPendentes
      .mockResolvedValueOnce({ termo: TERMO, contrato: CONTRATO })
      .mockResolvedValueOnce({ termo: null, contrato: CONTRATO });
    registrarAceite.mockResolvedValue({
      termoVersaoAceita: 1,
      contratoVersaoAceita: null,
      aindaPendente: true,
    });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(getAceitesPendentes).toHaveBeenCalledTimes(2));
    expect(replace).not.toHaveBeenCalledWith("/home");
  });
});

describe("o texto mudou enquanto ela lia", () => {
  it("VERSAO_DESATUALIZADA recarrega o texto e desmarca a caixa", async () => {
    // Aceitar a versão nova sem mostrá-la seria exatamente o que o servidor
    // recusou — e o motivo de a caixa voltar a ficar desmarcada.
    getAceitesPendentes
      .mockResolvedValueOnce({ termo: null, contrato: CONTRATO })
      .mockResolvedValueOnce({
        termo: null,
        contrato: { versao: 4, texto: "Contrato do clube, versão 4." },
      });
    registrarAceite.mockRejectedValue(
      new ApiError(409, "O contrato do clube foi atualizado enquanto você lia.", "VERSAO_DESATUALIZADA"),
    );
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("versão 4")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("chegar aqui sem nada pendente", () => {
  it("manda de volta em vez de mostrar tela vazia", async () => {
    // Acontece de verdade: aceitou noutra aba, ou voltou pelo histórico.
    getAceitesPendentes.mockResolvedValue({ termo: null, contrato: null });
    render(<AceiteView />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });
});

/**
 * **DEF-018 — o professor não pode cair no painel do jogador.**
 *
 * Foi o que aconteceu em produção: esta tela mandava todo mundo para
 * `/home`, que é a home do aluno. O professor aceitava o termo e via o app
 * de outra pessoa.
 *
 * É a **terceira vez** que este projeto entrega a tela do aluno ao professor
 * (antes: `perfil-view`, depois a `BottomNav` no DEF-011). Por isso além
 * destas provas de comportamento existe um **gate** em
 * `lib/rota-inicial.test.ts`, que varre o código: aviso não impediu as três
 * vezes anteriores.
 */
describe("DEF-018 — para onde cada papel volta", () => {
  it("o professor volta para a grade DELE, não para a home do aluno", async () => {
    getPapel.mockReturnValue("professor");
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: null });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/minhas-turmas"));
    expect(replace).not.toHaveBeenCalledWith("/home");
  });

  it("o aluno volta para a home dele", async () => {
    getPapel.mockReturnValue("aluno");
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: null });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("e o mesmo vale para quem chega aqui sem nada pendente", async () => {
    // O outro caminho de saída da tela, e ele errava igual.
    getPapel.mockReturnValue("professor");
    getAceitesPendentes.mockResolvedValue({ termo: null, contrato: null });
    render(<AceiteView />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/minhas-turmas"));
  });

  it("papel desconhecido cai no destino do aluno, como as outras portas", async () => {
    // Sessão antiga, de antes de o papel ser guardado. É o comportamento que
    // login e primeiro-acesso já tinham — esta tela só passou a segui-lo.
    getPapel.mockReturnValue(null);
    getAceitesPendentes.mockResolvedValue({ termo: TERMO, contrato: null });
    render(<AceiteView />);

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });
});
