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

/**
 * SPEC-059 — **o nome do clube fica guardado, e o defeito que isso conserta.**
 *
 * O Israel viu em produção: *"o termo ainda aparece como quadra quando eu vou
 * fazer uma reserva, e rapidamente aparece o termo atualizado"*. A tela abria
 * com `NOMES_PADRAO` e trocava a palavra quando a resposta chegava — troca de
 * texto na cara de quem está lendo.
 *
 * **Guardar não é cache de dado, é memória de rótulo.** O nome do tipo muda
 * uma vez por ano, se tanto; o custo de mostrá-lo do armazenamento local e
 * conferir depois é zero, e o ganho é a palavra certa desde o primeiro quadro.
 *
 * `localStorage` pode lançar (aba anônima, cookies bloqueados) e pode voltar
 * vazio. Toda leitura e toda escrita estão em `try`, e a ausência cai nos
 * padrões — o mesmo contrato que `lerNomesDeTipo` já tinha.
 */
const CHAVE = "playck_cliente_nomes_de_tipo";

export function nomesGuardados(): NomesDeTipo | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const lido: unknown = JSON.parse(cru);
    if (typeof lido !== "object" || lido === null) return null;
    const { quadra, aula } = lido as Partial<NomesDeTipo>;
    if (typeof quadra !== "string" || typeof aula !== "string") return null;
    return { quadra, aula };
  } catch {
    return null;
  }
}

export function guardarNomes(nomes: NomesDeTipo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(nomes));
  } catch {
    // Sem armazenamento, a tela só volta a piscar uma vez por visita. Não é
    // motivo para falhar nada.
  }
}

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
    const nomes = {
      quadra: nome(corpo, "nomeTipoQuadra", NOMES_PADRAO.quadra),
      aula: nome(corpo, "nomeTipoAula", NOMES_PADRAO.aula),
    };
    guardarNomes(nomes);
    return nomes;
  } catch {
    return { ...NOMES_PADRAO };
  }
}
