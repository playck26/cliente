import { ApiError, getPrazosDoClube } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

export type PrazosDaEmpresa =
  components["schemas"]["ConfigOperacaoResponseDto"];

/**
 * SPEC-031 — **o rollout em quatro passos, e a classificação que ele exige.**
 *
 * ## Por que quatro estados, e não `prazos | null`
 *
 * Cinco repositórios, cinco deploys independentes. **Nenhum CI sobe o outro
 * lado** — o cliente pode estar publicado contra um back que ainda não tem
 * `GET /me/company/operacao`. Então a tela precisa distinguir:
 *
 * | O que veio | Estado | O que a tela faz |
 * |---|---|---|
 * | `200` **com** o campo | `disponivel` | mostra a feature |
 * | `404`, ou `200` **sem** o campo | `ausente` | esconde, em silêncio |
 * | `401` / `403` | `negado` | **mostra erro** |
 * | `500`, `429`, timeout, rede, corpo inválido | `falhou` | falha **recuperável**, com retry |
 *
 * ## As duas linhas que existem porque alguém erraria
 *
 * **`403` não é "back antigo".** Engolir `403` faria a feature sumir em
 * produção sem ninguém saber: o clube configuraria o prazo, o aluno não veria
 * nada, e não haveria erro em lugar nenhum para investigar. Permissão negada
 * é defeito de configuração, e defeito silencioso é o pior tipo.
 *
 * **`500` também não é "back antigo", e esta é a mais fácil de errar.** O
 * atalho tentador é `catch { return ausente }` — e aí uma indisponibilidade de
 * dez minutos se disfarça de "versão antiga": a tela esconde a feature, e
 * quando o back volta ninguém recarrega, porque nada pareceu quebrado.
 *
 * **Ausência é uma conclusão**, e só duas coisas a autorizam: o `404` e o
 * corpo sem o campo. Todo o resto é falha.
 *
 * ## Por que a busca é parâmetro
 *
 * `authFetch` não é exportado — de propósito: no `api-client` todo caminho
 * passa por uma função nomeada. Injetar a busca deixa esta classificação
 * testável nos quatro casos sem tocar em rede nem em `fetch` global, e sem
 * abrir a costura do cliente HTTP só para o teste.
 */
export type CapacidadeOperacao =
  | { estado: "disponivel"; prazos: PrazosDaEmpresa }
  | { estado: "ausente" }
  | { estado: "negado" }
  | { estado: "falhou" };

/** O corpo é do servidor: `unknown` até ser conferido, nunca `as`. */
function temOsCampos(corpo: unknown): corpo is PrazosDaEmpresa {
  if (typeof corpo !== "object" || corpo === null) return false;
  // Basta UM dos dois: a resposta traz os dois campos sempre, e exigir os dois
  // faria a adição de um campo futuro derrubar a detecção.
  return "prazoCancelamentoAulaHoras" in corpo;
}

export async function lerCapacidadeOperacao(
  buscar: () => Promise<unknown> = getPrazosDoClube,
): Promise<CapacidadeOperacao> {
  let corpo: unknown;
  try {
    corpo = await buscar();
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 404) return { estado: "ausente" };
      if (e.status === 401 || e.status === 403) return { estado: "negado" };
    }
    // Rede, timeout, corpo ilegível, `500`, `429` — tudo recuperável, e
    // **nada disso é ausência**.
    return { estado: "falhou" };
  }

  // **`200` sem o campo é o sinal de versão do rollout** (AC-005), e é por
  // isso que o prazo NÃO entrou em `GET /me/company`: aquele 200 já existe e
  // é cacheado em módulo, então back antigo e back novo responderiam igual —
  // o rollout ficaria sem sinal nenhum.
  return temOsCampos(corpo)
    ? { estado: "disponivel", prazos: corpo }
    : { estado: "ausente" };
}
