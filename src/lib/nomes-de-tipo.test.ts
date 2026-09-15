import { describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { NOMES_PADRAO, lerNomesDeTipo } from "./nomes-de-tipo";

/**
 * SPEC-054/D1 e D12 — **o nome que o clube deu a cada tipo de reserva.**
 *
 * Nome é apresentação. Diferente dos prazos (`capacidade-operacao`), aqui
 * qualquer falha tem a mesma resposta certa: mostrar o nome padrão — os
 * cartões de `/reservas/nova` são o caminho que a pessoa veio buscar, e um nome
 * que não carregou não pode fechar essa porta.
 */
describe("lerNomesDeTipo", () => {
  it("usa os nomes que o servidor resolveu", async () => {
    const nomes = await lerNomesDeTipo(() =>
      Promise.resolve({
        prazoCancelamentoAulaHoras: null,
        nomeTipoQuadra: "Espaço",
        nomeTipoAula: "Aula com professor",
      }),
    );
    expect(nomes).toEqual({ quadra: "Espaço", aula: "Aula com professor" });
  });

  it("back anterior à SPEC-054 (200 sem os campos): os padrões", async () => {
    const nomes = await lerNomesDeTipo(() =>
      Promise.resolve({ prazoCancelamentoAulaHoras: 24 }),
    );
    expect(nomes).toEqual(NOMES_PADRAO);
  });

  it("404 e falha de rede: os padrões, sem lançar", async () => {
    await expect(
      lerNomesDeTipo(() => Promise.reject(new ApiError(404, "não achou"))),
    ).resolves.toEqual(NOMES_PADRAO);
    await expect(
      lerNomesDeTipo(() => Promise.reject(new Error("rede"))),
    ).resolves.toEqual(NOMES_PADRAO);
  });

  it("campo vazio ou de outro tipo não vira nome", async () => {
    const nomes = await lerNomesDeTipo(() =>
      Promise.resolve({ nomeTipoQuadra: "", nomeTipoAula: 42 }),
    );
    expect(nomes).toEqual(NOMES_PADRAO);
  });

  it("os padrões são os da spec", () => {
    expect(NOMES_PADRAO).toEqual({ quadra: "Quadra", aula: "Aula particular" });
  });
});
