import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMinhasTurmas } from "./api-client";

/**
 * SPEC-056/D1 — o índice do professor só traz turma inativa quando pede, e a URL
 * é a prova de que pediu: sem o parâmetro, o back devolve só as ativas.
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.setItem("playck_cliente_access_token", "token-de-teste");
  fetchMock = vi.fn().mockResolvedValue(resposta([]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const url = () => String((fetchMock.mock.calls[0] as [string])[0]);

describe("listMinhasTurmas — SPEC-056", () => {
  it("sem argumento, a URL de sempre — só ativas", async () => {
    await listMinhasTurmas();
    expect(url()).toMatch(/\/me\/teacher\/classes$/);
  });

  it("com `true`, pede as inativas", async () => {
    await listMinhasTurmas(true);
    expect(url()).toMatch(/\/me\/teacher\/classes\?incluirInativas=true$/);
  });
});
