import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listMyClasses } from "./api-client";

/**
 * DEF-007 (2026-08-24) — o texto que chegou ao usuário em produção.
 *
 * `ForbiddenException()` sem argumento devolve `{"message":"Forbidden"}`, e
 * o app mostrava essa palavra sozinha no meio da tela. Ninguém consegue agir
 * sobre "Forbidden": não diz o que aconteceu, de quem é a culpa, nem o que
 * fazer a seguir.
 *
 * A tradução mora no `parseError`, num lugar só, porque o mesmo 403 aparece
 * em toda tela que chama uma rota de outro papel.
 */
function respostaDe(status: number, corpo: unknown): Response {
  // `clone()` porque o `authFetch` inspeciona o corpo antes de decidir (ele
  // procura códigos como SENHA_TEMPORARIA), e um `Response` só pode ser lido
  // uma vez.
  const fazer = (): Response =>
    ({
      ok: false,
      status,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

describe("parseError (pelo authFetch)", () => {
  beforeEach(() => {
    window.localStorage.setItem("playck_cliente_access_token", "token-de-teste");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("403 sem mensagem própria vira uma frase que a pessoa entende", async () => {
    // Todas as chamadas devolvem 403 — inclusive a renovação, que falha e
    // deixa o erro original subir.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaDe(403, { message: "Forbidden", statusCode: 403 }),
      ),
    );

    const erro = await listMyClasses().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(403);
    expect((erro as ApiError).message).toBe(
      "Sua conta não tem acesso a esta área.",
    );
    expect((erro as ApiError).message).not.toMatch(/forbidden/i);
  });

  it("DEF-008: 403 puro tenta RENOVAR a sessão e repete o pedido", async () => {
    // O servidor autoriza pelo TOKEN; o app navega pelo `/auth/me`, que lê do
    // BANCO. Quando papel ou empresa mudam, os dois discordam — e sem esta
    // renovação a divergência não tinha como se resolver sozinha.
    const fetchMock = vi
      .fn()
      // 1ª tentativa: 403 com o token velho
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }))
      // a renovação
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ accessToken: "token-novo" }),
        clone() {
          return this;
        },
      } as unknown as Response)
      // 2ª tentativa: já com o token novo
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
        clone() {
          return this;
        },
      } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(listMyClasses()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(window.localStorage.getItem("playck_cliente_access_token")).toBe(
      "token-novo",
    );
  });

  it("403 que PERSISTE depois da renovação é permissão de verdade", async () => {
    // Aluno pedindo rota de gestor continua sendo recusado — a renovação não
    // pode virar uma forma de insistir até passar.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ accessToken: "token-novo" }),
        clone() {
          return this;
        },
      } as unknown as Response)
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const erro = await listMyClasses().catch((e: unknown) => e);

    expect((erro as ApiError).status).toBe(403);
    expect((erro as ApiError).message).toBe("Sua conta não tem acesso a esta área.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("403 COM mensagem própria passa intacto", async () => {
    // A troca alcança só o texto padrão do framework. Erro de domínio que se
    // deu ao trabalho de explicar é mais útil que qualquer frase genérica.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaDe(403, {
          message: "Seu vínculo com a empresa ainda não foi aprovado.",
          code: "VINCULO_PENDENTE",
          statusCode: 403,
        }),
      ),
    );

    const erro = await listMyClasses().catch((e: unknown) => e);

    expect((erro as ApiError).message).toBe(
      "Seu vínculo com a empresa ainda não foi aprovado.",
    );
  });

  it("outros status continuam trazendo a mensagem do servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaDe(422, { message: "Data inválida", statusCode: 422 }),
      ),
    );

    const erro = await listMyClasses().catch((e: unknown) => e);

    expect((erro as ApiError).status).toBe(422);
    expect((erro as ApiError).message).toBe("Data inválida");
  });
});
