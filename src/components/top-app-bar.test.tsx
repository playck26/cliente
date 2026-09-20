import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopAppBar } from "./top-app-bar";

/**
 * **O cabeçalho depois da revisão de 2026-08-29.**
 *
 * Ele tinha três coisas à direita ao longo da história: o sino (inerte desde
 * a SPEC-007), o ícone de perfil (SPEC-018/TASK-003) e nada mais. Hoje tem
 * **um botão**, e as duas remoções têm motivos diferentes — o sino porque
 * não existe notificação no backend, e o perfil porque desceu para a barra
 * de baixo.
 *
 * O que estas provas guardam é o **atrito deliberado** do logout. Ele aparece
 * em toda tela e fica na altura do polegar: um toque acidental derrubaria a
 * sessão, e quem não lembra a senha depende do clube para voltar — não há
 * recuperação por e-mail (ADR-013).
 */

const logout = vi.hoisted(() => vi.fn());
const getMinhaEmpresa = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, logout, getMinhaEmpresa };
});

beforeEach(() => {
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
  getMinhaEmpresa.mockResolvedValue({
    id: "e1",
    nome: "Smart Tennis",
    slug: "smart-tennis",
    status: "ativa",
    permiteAutoCadastro: true,
    limiteTurmasPorAluno: null,
    logoUrl: null,
  });
});

describe("o sino, que saiu e voltou", () => {
  /**
   * **Este teste afirmava o contrário, e a troca é parte do escopo da
   * SPEC-065 — não efeito colateral.**
   *
   * Ele dizia *"não tem mais o sino de notificações"*, e a razão era boa: o
   * ícone estava aqui desde a SPEC-007 sem ação nenhuma, e **ícone que ignora
   * o toque ensina a pessoa a não tocar nos outros**. O Israel mandou tirá-lo
   * *"até haver o que notificar"*.
   *
   * **A regra não mudou; a premissa caiu.** Desde 2026-09-20 os treze gestos
   * da SPEC-063 avisam de verdade, e existe `/avisos` para onde ir. O teste
   * velho encodava um estado do mundo, não um princípio — e um teste assim
   * tem de mudar quando o mundo muda, em vez de congelá-lo.
   *
   * O precedente é a engrenagem do `admin-top-bar`, que deixou de ser inerte
   * na SPEC-010 pelo mesmo caminho.
   */
  it("tem o sino, e ele LEVA a algum lugar", () => {
    render(<TopAppBar />);

    const sino = screen.getByLabelText("Avisos");
    expect(sino).toBeInTheDocument();
    expect(sino).toHaveAttribute("href", "/avisos");
  });

  it("não tem mais o atalho de perfil — ele desceu para a barra", () => {
    render(<TopAppBar />);

    expect(screen.queryByLabelText("Seu perfil")).not.toBeInTheDocument();
  });
});

describe("o que ficou", () => {
  it("a marca do clube continua no cabeçalho (SPEC-018/TASK-006)", async () => {
    // "O aluno abre o app da escola dele; mostrar a marca do fornecedor
    // dizia a coisa errada todos os dias."
    render(<TopAppBar />);

    expect(await screen.findByText("Smart Tennis")).toBeInTheDocument();
  });
});

describe("sair pergunta antes", () => {
  it("o primeiro toque NÃO encerra a sessão", () => {
    render(<TopAppBar />);

    fireEvent.click(screen.getByLabelText("Sair da conta"));

    expect(logout).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    // E o botão diz o que vai acontecer se ela tocar de novo.
    expect(screen.getByText("Sair da conta?")).toBeInTheDocument();
  });

  it("o segundo toque sai e vai para o login", async () => {
    render(<TopAppBar />);

    fireEvent.click(screen.getByLabelText("Sair da conta"));
    fireEvent.click(screen.getByLabelText("Confirmar saída"));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("se a rede cair, ela sai assim mesmo", async () => {
    // O padrão do `perfil-view`, e ele é uma decisão: botão "Sair" que não
    // sai porque a rede caiu é pior que não ter botão.
    logout.mockRejectedValue(new Error("rede"));
    render(<TopAppBar />);

    fireEvent.click(screen.getByLabelText("Sair da conta"));
    fireEvent.click(screen.getByLabelText("Confirmar saída"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
