import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PerfilView } from "./perfil-view";

/**
 * O "Sair" do perfil quando outra sessão começou nesta aba no meio do gesto
 * (PRD-090-R5-01). O `logout` devolve `false` e o perfil não manda para o
 * login quem entrou depois do clique. A sequência inteira, com o `logout` de
 * verdade, está em `sessao-com-resposta-atrasada.test.tsx` pelo botão do
 * cabeçalho; aqui fica só o que este botão faz com o desfecho.
 *
 * Os dublês são os de `perfil-view.test.tsx`, pelos mesmos motivos que ele
 * explica.
 */

const getMe = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({ getMe, logout }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/perfil",
}));
vi.mock("@/components/foto-de-perfil", () => ({ FotoDePerfil: () => null }));
vi.mock("@/components/minha-carteira", () => ({ MinhaCarteira: () => null }));
vi.mock("@/components/complete-seu-cadastro", () => ({
  CompleteSeuCadastro: () => null,
}));
vi.mock("@/components/meu-plano", () => ({ MeuPlano: () => null }));
vi.mock("@/components/minhas-reposicoes", () => ({
  MinhasReposicoes: () => null,
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));
vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue({
    id: "u1",
    nome: "Ana",
    email: "ana@teste.com",
    role: "aluno",
  });
});

describe("o \"Sair\" do perfil e a sessão do clique", () => {
  it("a sessão já é outra (logout devolve false): não vai para o login", async () => {
    let terminou!: () => void;
    const fim = new Promise<void>((r) => (terminou = r));
    logout.mockImplementation(async () => {
      terminou();
      return false;
    });
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(screen.getByRole("button", { name: /Sair da conta/ }));
    await fim;
    await new Promise((r) => setTimeout(r, 0));

    expect(replace).not.toHaveBeenCalled();
  });

  it("a sessão do clique saiu (logout devolve true): vai para o login", async () => {
    logout.mockResolvedValue(true);
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    fireEvent.click(screen.getByRole("button", { name: /Sair da conta/ }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
