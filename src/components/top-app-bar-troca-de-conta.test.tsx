import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopAppBar } from "./top-app-bar";
import { getMinhaEmpresa, limparCacheDaEmpresa, logout } from "@/lib/api-client";

/**
 * O cabeçalho JÁ MONTADO quando a conta muda (PRD-090-R2-01). Ele guarda a
 * empresa no estado e não volta a pedir: o que o tira da tela é a recarga da
 * aba. Ela tem de acontecer nas duas ordens possíveis entre a leitura da
 * empresa e o evento `storage`, porque o navegador não garante a ordem.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("./sino-de-avisos", () => ({ SinoDeAvisos: () => null }));

const CHAVE = "playck_cliente_access_token";

function token(sub: string, companyId: string, rodada = 0): string {
  return `h.${btoa(JSON.stringify({ sub, companyId, iat: rodada }))}.s`;
}

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

const CLUBE_A = { id: "a", nome: "Clube A", logoUrl: null };
const CLUBE_B = { id: "b", nome: "Clube B", logoUrl: null };

let clubeDaVez: unknown;
const recarregar = vi.fn();
const evento = () =>
  window.dispatchEvent(new StorageEvent("storage", { key: CHAVE }));

beforeEach(() => {
  limparCacheDaEmpresa();
  recarregar.mockClear();
  vi.stubGlobal("location", { ...window.location, reload: recarregar });
  clubeDaVez = CLUBE_A;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(resposta(clubeDaVez))),
  );
  window.localStorage.setItem(CHAVE, token("u-a", "a"));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  limparCacheDaEmpresa();
});

describe("o cabeçalho montado quando outra aba troca de conta", () => {
  it("evento antes da leitura: recarrega uma vez", async () => {
    render(<TopAppBar />);
    await screen.findByText("Clube A");

    clubeDaVez = CLUBE_B;
    window.localStorage.setItem(CHAVE, token("u-b", "b"));
    evento();
    await getMinhaEmpresa();

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("leitura ANTES do evento: recarrega uma vez do mesmo jeito", async () => {
    render(<TopAppBar />);
    await screen.findByText("Clube A");

    clubeDaVez = CLUBE_B;
    window.localStorage.setItem(CHAVE, token("u-b", "b"));
    const nova = getMinhaEmpresa();
    evento();

    expect((await nova).nome).toBe("Clube B");
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("o \"Sair\" e o login NESTA aba trocam de conta sem recarregar", async () => {
    render(<TopAppBar />);
    await screen.findByText("Clube A");

    await logout();
    clubeDaVez = CLUBE_B;
    window.localStorage.setItem(CHAVE, token("u-b", "b"));
    limparCacheDaEmpresa(); // o que o login-form faz depois de salvar o token

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
    expect(recarregar).not.toHaveBeenCalled();
  });
});
