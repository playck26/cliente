import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrimeiroAcessoForm } from "./primeiro-acesso-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function preencher(atual: string, nova: string, confirma: string) {
  fireEvent.change(screen.getByLabelText("Senha temporária"), { target: { value: atual } });
  fireEvent.change(screen.getByLabelText("Sua nova senha"), { target: { value: nova } });
  fireEvent.change(screen.getByLabelText("Repita a nova senha"), { target: { value: confirma } });
}

describe("PrimeiroAcessoForm (SPEC-009/REQ-004)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    window.localStorage.clear();
  });

  it("não chama a API quando a confirmação não bate", async () => {
    render(<PrimeiroAcessoForm />);
    preencher("pck-ABC123", "senha-nova-123", "senha-diferente");

    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "As duas senhas não são iguais.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  // AC-009: o backend revoga as sessões antigas e devolve um par novo. Se o
  // app não guardasse esse token, a pessoa cairia no login logo depois de
  // fazer exatamente o que o sistema exigiu.
  it("guarda o token novo devolvido pela troca e leva para a Home", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "token-novo" }),
    });

    render(<PrimeiroAcessoForm />);
    preencher("pck-ABC123", "senha-nova-123", "senha-nova-123");
    fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    expect(
      window.localStorage.getItem("playck_cliente_access_token"),
    ).toBe("token-novo");
  });
});
