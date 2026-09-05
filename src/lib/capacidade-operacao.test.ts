import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { lerCapacidadeOperacao } from "@/lib/capacidade-operacao";

/**
 * SPEC-031 — **os quatro casos do rollout, que a spec exige provados.**
 *
 * Cinco repositórios, cinco deploys independentes, e nenhum CI sobe o outro
 * lado. O que este arquivo guarda é a diferença entre **concluir** que o back
 * é antigo e **falhar ao perguntar** — porque as duas produzem a mesma tela
 * vazia, e só uma delas está certa.
 *
 * O erro que ele existe para impedir tem nome e forma: `catch { return
 * ausente }`. Com ele, uma indisponibilidade de dez minutos se disfarça de
 * "versão antiga", a feature some, e ninguém recarrega porque nada pareceu
 * quebrado.
 */
const erro = (status: number) => () =>
  Promise.reject(new ApiError(status, "erro"));

describe("lerCapacidadeOperacao — os quatro casos do rollout", () => {
  it("200 COM o campo: disponível, e traz os prazos", async () => {
    const r = await lerCapacidadeOperacao(() =>
      Promise.resolve({
        prazoCancelamentoAulaHoras: 24,
        prazoCancelamentoReservaHoras: null,
      }),
    );

    expect(r.estado).toBe("disponivel");
    if (r.estado !== "disponivel") throw new Error("estreitamento");
    expect(r.prazos.prazoCancelamentoAulaHoras).toBe(24);
    // `null` chega como `null`: "sem prazo" é decisão do clube, não campo
    // faltando, e um `?? 0` no caminho viraria "prazo zero".
    expect(r.prazos.prazoCancelamentoReservaHoras).toBeNull();
  });

  it("404: ausente — o back é anterior à spec", async () => {
    expect(await lerCapacidadeOperacao(erro(404))).toEqual({
      estado: "ausente",
    });
  });

  /**
   * AC-005 — **o sinal de versão do rollout.** É por isso que o prazo não
   * entrou em `GET /me/company`: aquele `200` já existe e é cacheado, então
   * back antigo e back novo responderiam igual e o rollout ficaria cego.
   */
  it("200 SEM o campo: ausente, e sem erro", async () => {
    expect(await lerCapacidadeOperacao(() => Promise.resolve({}))).toEqual({
      estado: "ausente",
    });
  });

  it.each([401, 403])(
    "%i: negado — a tela MOSTRA erro, não esconde",
    async (status) => {
      expect(await lerCapacidadeOperacao(erro(status))).toEqual({
        estado: "negado",
      });
    },
  );

  /**
   * **A linha que justifica o arquivo.** Cada um destes é um jeito diferente
   * de a pergunta falhar, e nenhum deles autoriza concluir ausência.
   */
  it.each([
    ["500", erro(500)],
    ["429", erro(429)],
    ["502", erro(502)],
    ["rede", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["timeout", () => Promise.reject(new DOMException("abort", "AbortError"))],
    [
      "corpo ilegível",
      () => Promise.reject(new SyntaxError("Unexpected token")),
    ],
  ])("%s: falhou — recuperável, NUNCA ausente", async (_caso, buscar) => {
    const r = await lerCapacidadeOperacao(buscar);
    expect(r).toEqual({ estado: "falhou" });
    // Dito de novo, e de propósito: é este o par que o rollout confunde.
    expect(r.estado).not.toBe("ausente");
  });

  /**
   * Corpo que não é objeto não é "back novo com resposta esquisita": é
   * ausência do campo, e ausência do campo é back antigo. `null` merece
   * menção porque `typeof null === "object"`, e um teste só de `typeof`
   * estouraria aqui.
   */
  it.each([[null], [undefined], ["texto"], [42], [[]]])(
    "corpo %s: ausente, sem estourar",
    async (corpo) => {
      expect(await lerCapacidadeOperacao(() => Promise.resolve(corpo))).toEqual(
        { estado: "ausente" },
      );
    },
  );
});
