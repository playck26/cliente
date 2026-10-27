import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { getMinhaEmpresa, limparCacheDaEmpresa } from "@/lib/api-client";

/**
 * O mesmo e-mail em dois clubes (SPEC-086), pela metade do LOGIN: a aba ainda
 * tem a empresa da sessão anterior em memória — sem ter passado pelo "Sair",
 * como quando a sessão expira numa aba que já estava em /login —, e a conta
 * que entra é de outro clube. Depois de entrar, a empresa tem de ser a nova.
 */

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function resposta(corpo: unknown): Response {
  const fazer = (): Response =>
    ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

let clubeDaSessao: unknown;

beforeEach(() => {
  pushMock.mockClear();
  limparCacheDaEmpresa();
  clubeDaSessao = { id: "a", nome: "Clube A", logoUrl: "https://cdn/a.png" };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const u = String(url);
      if (u.endsWith("/auth/login")) {
        return Promise.resolve(
          resposta({
            accessToken: "token-da-conta-b",
            refreshToken: "refresh-b",
            usuario: { id: "u-b", nome: "Aluno", role: "aluno", companyId: "b" },
          }),
        );
      }
      if (u.endsWith("/me/company")) return Promise.resolve(resposta(clubeDaSessao));
      return Promise.resolve(resposta({}));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  limparCacheDaEmpresa();
});

describe("LoginForm — a empresa da sessão anterior não sobrevive ao login (SPEC-086)", () => {
  it("entrar numa conta de outro clube descarta a empresa guardada em memória", async () => {
    window.localStorage.setItem("playck_cliente_access_token", "token-da-conta-a");
    expect((await getMinhaEmpresa()).nome).toBe("Clube A");

    clubeDaSessao = { id: "b", nome: "Clube B", logoUrl: "https://cdn/b.png" };
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "aluno@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
  });
});
