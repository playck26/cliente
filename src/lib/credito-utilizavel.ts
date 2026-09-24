/**
 * SPEC-072/AC-007 — **o crédito só é oferecido quando dá para usar.**
 *
 * ## Por que é um predicado, e não uma sequência de `if` na tela
 *
 * A v1 desta spec listava **três** casos de crédito inválido. O validador
 * independente achou dois que passavam (`B05`), depois um **quinto** que o
 * serviço recusa desde sempre — o teto do mês (`B06`) —, e só então a lista
 * fechou. Uma regra que errou duas vezes em duas rodadas não pode morar
 * espalhada no JSX: ela vira função pura, testada caso a caso.
 *
 * ## Os cinco motivos, e a ordem é a do SERVIDOR
 *
 * A ordem não é estética: ela decide **qual mensagem o aluno vê** quando mais
 * de um motivo vale. Espelhar `reposicao.service.ts` faz a tela dizer o mesmo
 * que o `POST` diria — tela e servidor discordando sobre o motivo é pior que
 * a tela não dizer motivo nenhum.
 *
 *   1. **nenhuma falta casada** por `ocupacaoId`;
 *   2. **já reposta** (`reposicao` preenchida);
 *   3. **aula cancelada pelo clube** — ele não perdeu nada;
 *   4. **expirada** — passou da validade;
 *   5. **teto do mês** — `usadasNoMes >= porMes`.
 *
 * ## A fronteira, declarada (LIM-072f)
 *
 * **Isto prova que existe crédito utilizável, NÃO que a vaga será aceita.** As
 * recusas que dependem da ocupação **escolhida** — seis cenários em cinco
 * códigos, mais as `NotFoundException` sem código — não existem quando o card
 * decide se oferece o botão. Quem as cobre é a `AC-009`, na tela, **por
 * classe** e não por lista.
 *
 * ## O casamento é por ID, nunca por texto (INV-072c / D3)
 *
 * `turmaNome + data + horaInicio` é junção por texto de **exibição**: o schema
 * não torna o nome da turma único, e duas turmas de mesmo nome em quadras
 * diferentes são plausíveis. Funcionaria no teste e casaria o crédito errado
 * em produção. Por isso a `TASK-001` publicou `ocupacaoId` no DTO.
 */
import type { CreditoDeReposicao, FaltaParaRepor } from "@/lib/api-client";

export type MotivoDeRecusa =
  | "sem-falta"
  | "ja-reposta"
  | "aula-cancelada"
  | "expirada"
  | "teto-do-mes";

export type VeredictoDoCredito =
  | { utilizavel: true; faltaId: string }
  | { utilizavel: false; motivo: MotivoDeRecusa };

/** As frases que o aluno lê. Uma por motivo — nenhum motivo fica mudo. */
export const EXPLICACAO: Record<MotivoDeRecusa, string> = {
  "sem-falta": "Avise que vai faltar para gerar o crédito de reposição.",
  "ja-reposta": "Você já marcou a reposição desta aula.",
  "aula-cancelada": "O clube cancelou esta aula — não há o que repor.",
  expirada: "O prazo para repor esta falta já passou.",
  "teto-do-mes": "Você já usou todas as reposições deste mês.",
};

/**
 * A falta que nasceu **daquela** ocorrência, ou `null`.
 *
 * Exportada porque a `AC-008` exige nomear o `faltaId` que sobe no
 * "Remarcar", e um teste que só olhasse o botão não provaria **qual** crédito
 * foi escolhido quando há dois candidatos plausíveis.
 */
export function faltaDaOcupacao(
  credito: CreditoDeReposicao | null,
  ocupacaoId: string,
): FaltaParaRepor | null {
  if (!credito) return null;
  return credito.faltas.find((f) => f.ocupacaoId === ocupacaoId) ?? null;
}

export function creditoUtilizavel(
  credito: CreditoDeReposicao | null,
  ocupacaoId: string,
): VeredictoDoCredito {
  const falta = faltaDaOcupacao(credito, ocupacaoId);
  if (!falta) return { utilizavel: false, motivo: "sem-falta" };
  if (falta.reposicao) return { utilizavel: false, motivo: "ja-reposta" };
  if (falta.aulaCancelada)
    return { utilizavel: false, motivo: "aula-cancelada" };
  if (falta.expirada) return { utilizavel: false, motivo: "expirada" };
  // O teto é do ALUNO no mês, não desta falta — por isso vem do topo do DTO e
  // não da linha. Ele é o quinto motivo, e era o que faltava na v2 (B06).
  if (credito!.usadasNoMes >= credito!.porMes)
    return { utilizavel: false, motivo: "teto-do-mes" };
  return { utilizavel: true, faltaId: falta.faltaId };
}
