import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import LoginPage from "@/app/login/page";
import { FUNDO_DO_LOGIN } from "@/lib/login-appearance";
import { LOGIN_APOS_ATIVACAO, LOGIN_APOS_REDEFINICAO } from "@/lib/ativacao-navigation";
import { TEXTO_DO_AVISO_DE_ATIVACAO, TEXTO_DO_AVISO_DE_REDEFINICAO } from "./aviso-de-ativacao";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// AC-007 (SPEC-001): login funciona e redireciona para a home.
describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renderiza os campos de email e senha", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("redireciona para /home após login com sucesso", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "token-123",
        refreshToken: "refresh-123",
        usuario: { id: "u1", nome: "Aluno", role: "aluno", companyId: "c1" },
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "aluno@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });

  it("mostra mensagem de erro genérica em credenciais inválidas (AC-002)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, error: "Unauthorized", message: "Credenciais inválidas" }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "aluno@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

/**
 * SPEC-084 — **a página, e não só o formulário.** O comportamento do login
 * está congelado em `login-form.caracterizacao.test.tsx`; aqui fica o que
 * pode mudar com a copy e a composição: o texto aprovado pelo Israel (I2), o
 * que não pode aparecer, a foto como cenário e o aviso fora do formulário.
 */
describe("LoginPage — SPEC-084", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("AC-002: a mensagem ao aluno e o botão, com o texto aprovado", () => {
    render(<LoginPage />);
    expect(screen.getByText("SEU ESPORTE, SEU MOMENTO")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Mais esporte, mais conexões." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reserve sua quadra, acompanhe suas aulas e aproveite cada momento no seu clube.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("I5: o login não oferece cadastro — nem o texto, nem link para /cadastro", () => {
    const { container } = render(<LoginPage />);
    expect(screen.queryByRole("link", { name: /cadastr/i })).toBeNull();
    expect(container.querySelector('a[href^="/cadastro"]')).toBeNull();
    expect(container.textContent).not.toContain("Ainda não tem conta?");
    expect(container.textContent).not.toContain("Cadastre-se");
  });

  it("AC-002: não fala em gerir clube, e o texto antigo saiu", () => {
    const { container } = render(<LoginPage />);
    const texto = container.textContent ?? "";
    for (const proibido of [
      "Gerencie seu clube",
      "CLUBES DE TÊNIS",
      "Entre em quadra com tudo organizado.",
      "Bem-vindo de volta",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("AC-003/AC-007: a foto é cenário — decorativa, e vinda da configuração", () => {
    const { container } = render(<LoginPage />);
    const camada = container.querySelector("[data-camada-da-foto]");
    expect(camada).toHaveAttribute("aria-hidden", "true");
    const foto = camada!.querySelector("img");
    expect(foto).toHaveAttribute("alt", "");
    expect(foto!.getAttribute("src")).toBe(FUNDO_DO_LOGIN.src);
  });

  it("AC-008: a região do aviso existe, vazia, e fora do formulário", () => {
    const { container } = render(<LoginPage />);
    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();
    expect(container.querySelector("form")!.contains(regiao)).toBe(false);
  });
});

/**
 * SPEC-090 (D9) — **o login com a recuperação pelo e-mail.**
 *
 * AC-023: "Esqueceu a senha?" é link para `/esqueci-senha`, e o texto inerte
 * de antes não está em lugar nenhum da página. AC-024/S25: chegar por
 * `LOGIN_APOS_REDEFINICAO` põe a frase na MESMA região do aviso da ativação —
 * a página continua com uma região `role="status"` só, antes e depois do
 * efeito.
 */
describe("LoginPage — SPEC-090", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("AC-023: “Esqueceu a senha?” leva a /esqueci-senha, e o texto antigo saiu da página", () => {
    const { container } = render(<LoginPage />);
    const link = screen.getByRole("link", { name: "Esqueceu a senha?" });
    expect(link).toHaveAttribute("href", "/esqueci-senha");
    expect(container.querySelector("form")!.contains(link)).toBe(true);
    expect(screen.queryByRole("button", { name: "Esqueceu a senha?" })).toBeNull();
    expect(container.textContent).not.toContain("Ainda não enviamos e-mail de recuperação");
  });

  it.each([
    [LOGIN_APOS_ATIVACAO, TEXTO_DO_AVISO_DE_ATIVACAO],
    [LOGIN_APOS_REDEFINICAO, TEXTO_DO_AVISO_DE_REDEFINICAO],
  ])("AC-024/S25: %s — uma região de status na página, vazia antes e com o texto depois", async (endereco, texto) => {
    vi.useFakeTimers();
    try {
      window.history.replaceState(null, "", endereco);
      const { container } = render(<LoginPage />);
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(texto);
      expect(container.querySelectorAll("[role=status]")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      window.history.replaceState(null, "", "/");
    }
  });
});
