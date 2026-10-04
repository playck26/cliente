import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ativarConta, getAtivacao } from "@/lib/api-client";
import { AtivarContaForm, TEXTO_LINK_INVALIDO } from "./ativar-conta-form";

/**
 * SPEC-083 (D11, AC-025) — a página do link de ativação, no unitário.
 *
 * O destino depois do `204` é provado com um **sentinela**: o módulo do
 * protocolo é trocado por um que exporta outro endereço, e o roteador tem de
 * receber o sentinela. Um componente que escrevesse o endereço à mão — com ou
 * sem o parâmetro — mandaria para o endereço dele, e não para o sentinela. A
 * ida até o login REAL, com o aviso na tela, é do `e2e/ativacao-login.spec.ts`.
 */

const { SENTINELA, replace, push } = vi.hoisted(() => ({
  SENTINELA: "/destino-do-protocolo?sentinela=1",
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/ativacao-navigation", () => ({ LOGIN_APOS_ATIVACAO: SENTINELA }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...real, getAtivacao: vi.fn(), ativarConta: vi.fn() };
});

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd";
const GONE = () => new ApiError(410, TEXTO_LINK_INVALIDO, "LINK_INVALIDO");

const getAtivacaoMock = vi.mocked(getAtivacao);
const ativarContaMock = vi.mocked(ativarConta);

function preencher(senha: string, confirmacao: string) {
  fireEvent.change(screen.getByLabelText("Crie uma senha"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: confirmacao } });
}

async function abrirComLinkValido(primeiroNome = "Maria", clube = "Smart Tennis") {
  getAtivacaoMock.mockResolvedValue({ primeiroNome, empresa: { nome: clube } });
  render(<AtivarContaForm token={TOKEN} />);
  await screen.findByLabelText("Crie uma senha");
}

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  getAtivacaoMock.mockReset();
  ativarContaMock.mockReset();
});

describe("AC-025 — o link válido mostra o formulário com o primeiro nome", () => {
  it("cumprimenta pelo primeiro nome e nomeia o clube, com senha e confirmação", async () => {
    await abrirComLinkValido();

    expect(getAtivacaoMock).toHaveBeenCalledWith(TOKEN);
    expect(
      screen.getByText("Olá, Maria. Crie sua senha para entrar no Smart Tennis."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Repita a senha")).toBeInTheDocument();
    // Abrir a página não gasta o link (AC-020): nada foi enviado.
    expect(ativarContaMock).not.toHaveBeenCalled();
  });

  it("nome e clube com marcação aparecem como TEXTO, nunca como HTML", async () => {
    getAtivacaoMock.mockResolvedValue({
      primeiroNome: '"><b>x</b>',
      empresa: { nome: "<img src=x>" },
    });
    const { container } = render(<AtivarContaForm token={TOKEN} />);
    await screen.findByLabelText("Crie uma senha");

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('Olá, "><b>x</b>. Crie sua senha para entrar no <img src=x>.');
  });
});

describe("AC-025 — o 410 mostra o texto da D11", () => {
  it("link morto ao abrir: o texto, e nenhum campo de senha", async () => {
    getAtivacaoMock.mockRejectedValue(GONE());
    render(<AtivarContaForm token={TOKEN} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este link não vale mais. Peça um novo convite ao seu clube.",
    );
    expect(screen.queryByLabelText("Crie uma senha")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falha de rede ao abrir NÃO diz que o link morreu, e deixa tentar de novo", async () => {
    getAtivacaoMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AtivarContaForm token={TOKEN} />);

    const alerta = await screen.findByRole("alert");
    expect(alerta).not.toHaveTextContent(TEXTO_LINK_INVALIDO);

    getAtivacaoMock.mockResolvedValueOnce({ primeiroNome: "Maria", empresa: { nome: "Smart Tennis" } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Crie uma senha")).toBeInTheDocument();
    expect(getAtivacaoMock).toHaveBeenCalledTimes(2);
  });
});

describe("AC-025 — o sucesso vai para o endereço IMPORTADO do protocolo", () => {
  it("204: envia token e senha e chama router.replace com LOGIN_APOS_ATIVACAO (o sentinela)", async () => {
    ativarContaMock.mockResolvedValue(undefined);
    await abrirComLinkValido();

    preencher("senha-nova-123", "senha-nova-123");
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(ativarContaMock).toHaveBeenCalledWith({ token: TOKEN, senha: "senha-nova-123" });
    expect(replace).toHaveBeenCalledWith(SENTINELA);
    expect(push).not.toHaveBeenCalled();
    // Até a navegação o botão fica travado: um segundo toque gastaria o
    // token de novo e mostraria o 410 a quem acabou de dar certo.
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  });

  it("o componente importa a constante do protocolo e não escreve endereço de login", () => {
    const fonte = readFileSync(join(__dirname, "ativar-conta-form.tsx"), "utf8");
    expect(fonte).toMatch(
      /import\s*\{\s*LOGIN_APOS_ATIVACAO\s*\}\s*from\s*"@\/lib\/ativacao-navigation"/,
    );
    expect(fonte).toContain("router.replace(LOGIN_APOS_ATIVACAO)");
    expect(fonte).not.toMatch(/["'`]\/login/);
  });
});

describe("AC-025 — erro não navega para o login com o aviso", () => {
  it("410 no envio: o texto da D11, o formulário sai, e o roteador não é chamado", async () => {
    ativarContaMock.mockRejectedValue(GONE());
    await abrirComLinkValido();

    preencher("senha-nova-123", "senha-nova-123");
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTO_LINK_INVALIDO);
    expect(screen.queryByLabelText("Crie uma senha")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("400 no envio: a mensagem do servidor, o formulário fica, e o roteador não é chamado", async () => {
    ativarContaMock.mockRejectedValue(new ApiError(400, "Senha fraca demais."));
    await abrirComLinkValido();

    preencher("senha-nova-123", "senha-nova-123");
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha fraca demais.");
    expect(screen.getByRole("button", { name: "Criar minha senha" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falha de rede no envio: o texto de erro, o formulário fica, e o roteador não é chamado", async () => {
    ativarContaMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await abrirComLinkValido();

    preencher("senha-nova-123", "senha-nova-123");
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar sua senha. Tente de novo.",
    );
    expect(screen.getByLabelText("Crie uma senha")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["senha curta", "1234567", "1234567", "A senha precisa ter pelo menos 8 caracteres."],
    ["confirmação diferente", "senha-nova-123", "senha-outra-123", "As duas senhas não são iguais."],
  ])("%s: não chama a API", async (_caso, senha, confirmacao, mensagem) => {
    await abrirComLinkValido();

    preencher(senha, confirmacao);
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
    expect(ativarContaMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("AC-025 — a página declara no-referrer", () => {
  it("o metadata da rota pede no-referrer", async () => {
    const pagina = await import("@/app/ativar/[token]/page");
    expect(pagina.metadata).toEqual({ referrer: "no-referrer" });
  });
});
