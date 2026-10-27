import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMinhaEmpresa,
  identidadeDoToken,
  limparCacheDaEmpresa,
  logout,
} from "./api-client";

/**
 * O que a PR #70 não cobria (VEREDITO-2026-10-27-PRODUCAO, PRD-090-01 e 02):
 * a troca de conta feita em OUTRA aba, que muda o token desta sem passar pelo
 * "Sair" nem pelo login daqui; e a resposta atrasada de uma conta anterior
 * derrubando o cache da conta nova.
 */

const CHAVE = "playck_cliente_access_token";

/** Um JWT só no formato: o cliente lê o payload e nunca confere assinatura. */
function token(sub: string, companyId: string, rodada = 0): string {
  const corpo = btoa(JSON.stringify({ sub, companyId, iat: rodada }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `cabecalho.${corpo}.assinatura`;
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

const CLUBE_A = { id: "a", nome: "Clube A", logoUrl: "https://cdn/a.png" };
const CLUBE_B = { id: "b", nome: "Clube B", logoUrl: "https://cdn/b.png" };

let clubeDaVez: unknown;
let fetchMock: ReturnType<typeof vi.fn>;
const recarregar = vi.fn();

const chamadasDaEmpresa = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/me/company"))
    .length;

/** O que o navegador faz nesta aba quando outra grava no `localStorage`. */
function outraAbaGrava(valor: string) {
  const antigo = window.localStorage.getItem(CHAVE);
  window.localStorage.setItem(CHAVE, valor);
  window.dispatchEvent(
    new StorageEvent("storage", { key: CHAVE, oldValue: antigo, newValue: valor }),
  );
}

beforeEach(() => {
  limparCacheDaEmpresa();
  recarregar.mockClear();
  vi.stubGlobal("location", { ...window.location, reload: recarregar });
  clubeDaVez = CLUBE_A;
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      resposta(String(url).endsWith("/me/company") ? clubeDaVez : {}),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.setItem(CHAVE, token("u-a", "a"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  limparCacheDaEmpresa();
});

describe("a empresa quando a conta muda em outra aba", () => {
  it("lê sub e empresa do payload, e devolve null para o que não é JWT", () => {
    expect(identidadeDoToken(token("u-a", "a"))).toBe("u-a|a");
    expect(identidadeDoToken("token-de-teste")).toBeNull();
    expect(identidadeDoToken("a.%%%.b")).toBeNull();
    expect(identidadeDoToken(null)).toBeNull();
  });

  it("outra aba entra em conta de outro clube: esta recarrega e a empresa vira B", async () => {
    expect((await getMinhaEmpresa()).nome).toBe("Clube A");

    clubeDaVez = CLUBE_B;
    outraAbaGrava(token("u-b", "b"));

    expect(recarregar).toHaveBeenCalledTimes(1);
    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
  });

  it("sem o evento (aba em segundo plano), a próxima leitura já não usa o cache de A", async () => {
    expect((await getMinhaEmpresa()).nome).toBe("Clube A");

    clubeDaVez = CLUBE_B;
    window.localStorage.setItem(CHAVE, token("u-b", "b"));

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
  });

  it("refresh da MESMA conta em outra aba: não recarrega nem pede a empresa de novo", async () => {
    await getMinhaEmpresa();

    outraAbaGrava(token("u-a", "a", 1));
    await getMinhaEmpresa();

    expect(recarregar).not.toHaveBeenCalled();
    expect(chamadasDaEmpresa()).toBe(1);
  });

  it("outra aba sai (token apagado): não recarrega — quem trata é o 401 da próxima chamada", async () => {
    await getMinhaEmpresa();

    window.localStorage.removeItem(CHAVE);
    window.dispatchEvent(new StorageEvent("storage", { key: CHAVE, newValue: null }));

    expect(recarregar).not.toHaveBeenCalled();
  });
});

describe("a resposta atrasada de uma conta anterior", () => {
  it("a falha tardia de A não derruba o cache de B nem custa outra chamada", async () => {
    let falharA!: (e: Error) => void;
    let n = 0;
    fetchMock = vi.fn((url: string) => {
      if (!String(url).endsWith("/me/company")) return Promise.resolve(resposta({}));
      n += 1;
      return n === 1
        ? new Promise<Response>((_, rejeitar) => (falharA = rejeitar))
        : Promise.resolve(resposta(CLUBE_B));
    });
    vi.stubGlobal("fetch", fetchMock);

    const pendenteDeA = getMinhaEmpresa().catch(() => null);
    await logout();
    window.localStorage.setItem(CHAVE, token("u-b", "b"));
    limparCacheDaEmpresa();

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
    falharA(new Error("rede da conta anterior"));
    await pendenteDeA;

    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
    expect(chamadasDaEmpresa()).toBe(2);
  });

  it("refresh por cookie, sem access token local: a empresa da mesma conta não é pedida de novo", async () => {
    window.localStorage.removeItem(CHAVE);
    let n = 0;
    fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/auth/refresh")) {
        return Promise.resolve(resposta({ accessToken: token("u-a", "a") }));
      }
      if (!String(url).endsWith("/me/company")) return Promise.resolve(resposta({}));
      n += 1;
      return Promise.resolve(
        n === 1
          ? ({ ok: false, status: 401, json: () => Promise.resolve({}), clone() { return this; } } as unknown as Response)
          : resposta(CLUBE_A),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getMinhaEmpresa();
    await getMinhaEmpresa();

    expect(chamadasDaEmpresa()).toBe(2); // o 401 e o retry; nenhum terceiro
    expect(recarregar).not.toHaveBeenCalled();
  });
});
