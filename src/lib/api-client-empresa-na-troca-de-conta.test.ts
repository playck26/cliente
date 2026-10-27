import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMinhaEmpresa, limparCacheDaEmpresa, logout } from "./api-client";

/**
 * O mesmo e-mail em dois clubes (SPEC-086): sair de um e entrar no outro, na
 * mesma aba, não pode mostrar a logo e o nome do primeiro.
 *
 * `getMinhaEmpresa` guarda a empresa em memória, no módulo, e o "Sair" volta
 * ao login sem recarregar a aba. Quem garante a troca é o `logout()` limpar
 * esse cache — e o login limpar de novo, para quem chega a ele sem ter
 * passado pelo "Sair" (o teste do formulário cobre essa metade).
 */

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

const CLUBE_A = { id: "a", nome: "Clube A", logoUrl: "https://cdn/a.png" };
const CLUBE_B = { id: "b", nome: "Clube B", logoUrl: "https://cdn/b.png" };

let fetchMock: ReturnType<typeof vi.fn>;

/** Responde `/me/company` com o clube da vez, e o resto com corpo vazio. */
function servidorCom(clube: () => unknown) {
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      resposta(String(url).endsWith("/me/company") ? clube() : {}),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
}

const chamadasDaEmpresa = () =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/me/company"),
  ).length;

beforeEach(() => {
  limparCacheDaEmpresa();
  window.localStorage.setItem("playck_cliente_access_token", "token-de-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  limparCacheDaEmpresa();
});

describe("a empresa em memória na troca de conta (SPEC-086)", () => {
  it("dentro da mesma sessão, a empresa vem do cache: uma chamada só", async () => {
    servidorCom(() => CLUBE_A);
    await getMinhaEmpresa();
    await getMinhaEmpresa();
    expect(chamadasDaEmpresa()).toBe(1);
  });

  it("depois do logout, a próxima conta vê o PRÓPRIO clube, sem recarregar", async () => {
    let clubeDaSessao: unknown = CLUBE_A;
    servidorCom(() => clubeDaSessao);

    expect((await getMinhaEmpresa()).nome).toBe("Clube A");

    await logout();
    clubeDaSessao = CLUBE_B;
    window.localStorage.setItem("playck_cliente_access_token", "token-da-conta-b");

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
    expect(chamadasDaEmpresa()).toBe(2);
  });

  it("o logout limpa mesmo com a rede fora", async () => {
    let clubeDaSessao: unknown = CLUBE_A;
    fetchMock = vi.fn((url: string) =>
      String(url).endsWith("/auth/logout")
        ? Promise.reject(new TypeError("rede fora"))
        : Promise.resolve(
            resposta(String(url).endsWith("/me/company") ? clubeDaSessao : {}),
          ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getMinhaEmpresa();
    await logout();
    clubeDaSessao = CLUBE_B;
    window.localStorage.setItem("playck_cliente_access_token", "token-da-conta-b");

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
  });
});
