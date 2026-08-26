import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PerfilView } from "./perfil-view";

/**
 * O botão de sair (2026-08-26).
 *
 * **O app não tinha logout.** Quem entrava só saía limpando o navegador — e
 * num celular emprestado ou compartilhado isso não é uma opção, é um
 * problema de segurança com cara de funcionalidade faltando.
 *
 * O que estes testes guardam é a ordem e o que acontece quando dá errado:
 * o servidor é avisado, mas o estado local sai **de qualquer jeito**. Um
 * botão "Sair" que não sai porque a rede caiu é pior que não ter botão.
 */

const getMe = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({ getMe, logout }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/perfil",
}));
vi.mock("@/components/foto-de-perfil", () => ({
  FotoDePerfil: () => null,
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));
vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

const ALUNA = {
  id: "u1",
  nome: "Ana",
  email: "ana@teste.com",
  role: "aluno" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(ALUNA);
  logout.mockResolvedValue(undefined);
});

const botaoSair = () => screen.getByRole("button", { name: /Sair da conta/ });

describe("sair da conta", () => {
  it("o botão existe, e diz o que vai acontecer", async () => {
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    expect(botaoSair()).toBeInTheDocument();
    expect(
      screen.getByText(/precisará entrar de novo/),
    ).toBeInTheDocument();
  });

  it("avisa o servidor e leva para o login", async () => {
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(botaoSair());

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("usa `replace`, não `push`: voltar não pode devolver a sessão", async () => {
    // Sem isto, o botão "voltar" do celular traz de volta a tela de quem
    // acabou de sair — e num aparelho emprestado é exatamente aí que o
    // logout precisava ter funcionado.
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(botaoSair());

    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it("LEVA PARA O LOGIN MESMO SE O SERVIDOR FALHAR", async () => {
    // O caso que decide se o botão presta. Rede fora, servidor com erro: a
    // pessoa pediu para sair, e tem de sair. O refresh token do servidor
    // expira sozinho; ficar preso numa sessão que ela encerrou, não.
    logout.mockRejectedValue(new Error("rede fora"));

    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(botaoSair());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("desabilita enquanto sai, para não disparar duas vezes", async () => {
    let liberar: () => void = () => {};
    logout.mockReturnValue(
      new Promise<void>((r) => {
        liberar = r;
      }),
    );

    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(botaoSair());

    // O rótulo muda para "Saindo...", então procurar por "Sair da conta"
    // não acha mais — é a própria mudança que o teste quer ver.
    const saindo = await screen.findByRole("button", { name: /Saindo/ });
    expect(saindo).toBeDisabled();
    liberar();
  });
});
