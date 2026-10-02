import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import LoginPage from "@/app/login/page";
import { FUNDO_DO_LOGIN } from "@/lib/login-appearance";

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

  it("AC-002: a mensagem ao aluno, o botão e o cadastro, com o texto aprovado", () => {
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
    expect(screen.getByRole("link", { name: "Cadastre-se" }).closest("p")).toHaveTextContent(
      "Ainda não tem conta? Cadastre-se",
    );
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
