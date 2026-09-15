import { getPrazosDoClube } from "@/lib/api-client";

/**
 * SPEC-054/D1 — **os nomes que o clube deu aos dois tipos de reserva.**
 *
 * O servidor já os resolve (o nome do clube ou o padrão) em
 * `GET /me/company/operacao`. Aqui só se lê.
 *
 * **Diferente dos prazos, toda falha tem a mesma resposta: o nome padrão.** A
 * `capacidade-operacao` distingue quatro estados porque lá esconder a feature
 * por engano apaga uma regra de dinheiro. Aqui o que está em jogo é o texto de
 * um cartão, e o cartão é o caminho que a pessoa veio buscar: um nome que não
 * carregou não pode fechar essa porta, nem virar mensagem de erro.
 */
export const NOMES_PADRAO = { quadra: "Quadra", aula: "Aula particular" } as const;

export type NomesDeTipo = { quadra: string; aula: string };

function nome(corpo: object, campo: string, padrao: string): string {
  const valor = (corpo as Record<string, unknown>)[campo];
  return typeof valor === "string" && valor.trim() !== "" ? valor : padrao;
}

export async function lerNomesDeTipo(
  buscar: () => Promise<unknown> = getPrazosDoClube,
): Promise<NomesDeTipo> {
  try {
    const corpo = await buscar();
    if (typeof corpo !== "object" || corpo === null) return { ...NOMES_PADRAO };
    return {
      quadra: nome(corpo, "nomeTipoQuadra", NOMES_PADRAO.quadra),
      aula: nome(corpo, "nomeTipoAula", NOMES_PADRAO.aula),
    };
  } catch {
    return { ...NOMES_PADRAO };
  }
}
