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
/**
 * SPEC-033 — a carteira entra no perfil, e este arquivo é sobre o **logout**.
 *
 * Dublê e não mock da API: substituir `MinhaCarteira` por `null` mantém o
 * assunto deste arquivo intacto, e é o mesmo tratamento que a foto e a barra
 * já recebem aqui. Trocar o mock de `api-client` para incluir mais um export
 * acoplaria estes cinco testes a toda função nova do cliente — e a carteira
 * tem provas próprias em `minha-carteira.test.tsx`.
 */
vi.mock("@/components/minha-carteira", () => ({
  // **Marcador, e nao `null`.** Com `null` o dublê tornava o gate do
  // perfil INOBSERVÁVEL: a revisão desta PR mostrou que a suíte ficava
  // verde com a guarda removida. Um `data-testid` custa nada e devolve
  // a pergunta "a carteira foi montada?" para dentro deste arquivo,
  // sem acoplar os cinco testes de logout ao cliente de API.
  MinhaCarteira: () => <div data-testid="carteira" />,
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

const PROFESSOR = {
  id: "u2",
  nome: "Joao",
  email: "prof@teste.com",
  role: "professor" as const,
};

/**
 * SPEC-033 + a correcao de 2026-09-09 — quem VE a carteira no perfil.
 *
 * O defeito de producao: o professor recebia `403` da rota (ela tem
 * `@Roles('aluno')`), nao o `404` que o componente previa, e via "nao foi
 * possivel carregar sua carteira" em vermelho.
 *
 * A guarda daqui e a metade de CIMA da correcao — e a que a revisao mostrou
 * nao ter prova nenhuma.
 */
describe("quem ve a carteira no perfil", () => {
  it("aluno: a carteira e montada", async () => {
    render(<PerfilView />);
    expect(await screen.findByTestId("carteira")).toBeInTheDocument();
  });

  it("professor: a carteira NAO e montada -- nem a requisicao acontece", async () => {
    getMe.mockResolvedValue(PROFESSOR);
    render(<PerfilView />);
    await screen.findByText(/prof@teste.com/);
    expect(screen.queryByTestId("carteira")).not.toBeInTheDocument();
  });

  it("getMe FALHOU: a carteira e montada assim mesmo", async () => {
    // **A regressao que a revisao achou.** A primeira versao da guarda era
    // `usuario?.role === "aluno" ? <MinhaCarteira /> : null`, e `getMe()`
    // falha em SILENCIO de proposito (o nome e enfeite). Amarrar a carteira
    // ao sucesso dele faria um ALUNO real perder a carteira numa falha
    // transitoria, sem erro e sem aviso.
    //
    // A guarda esconde so quando SABE que nao e aluno. O resto e do
    // componente, que trata `403` e `404`.
    getMe.mockRejectedValue(new Error("rede caiu"));
    render(<PerfilView />);
    expect(await screen.findByTestId("carteira")).toBeInTheDocument();
  });
});

describe("sair da conta", () => {
  it("o botão existe, e diz o que vai acontecer", async () => {
    render(<PerfilView />);
    await screen.findByText(/ana@teste.com/);

    expect(botaoSair()).toBeInTheDocument();
    expect(screen.getByText(/precisará entrar de novo/)).toBeInTheDocument();
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
