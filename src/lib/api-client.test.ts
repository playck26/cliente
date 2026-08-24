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
