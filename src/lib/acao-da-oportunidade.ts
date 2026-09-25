/**
 * SPEC-064/TASK-007 — **qual botão cada oportunidade de reposição ganha.**
 *
 * O card 5331: *"usuário quer repor aula, encontra aula para repor, mas não
 * tem vaga. Deixa o aviso de interesse. Caso surja a vaga, é notificado no app
 * e pode entrar e agendar."*
 *
 * Até esta task a aula cheia **nem chegava à tela** — o Back a descartava — e
 * `entrarNaFilaDeAula` existia no `api-client` sem nenhum componente que a
 * chamasse. Agora a tela pede as cheias (`incluirSemVaga`), e cada uma precisa
 * de UM botão, decidido por uma regra só.
 *
 * ## Por que função pura, e não `if` no JSX
 *
 * Duas telas mostram oportunidades — "Aulas para repor", no Perfil, e o painel
 * de remarcar da tela de Aulas (SPEC-072/TASK-005). Duas cópias de uma regra
 * divergem, e é sempre a segunda que fica velha. É o mesmo motivo do
 * `filtro-de-nivel.ts` e do `credito-utilizavel.ts`.
 *
 * ## A regra, e a ordem é ela
 *
 * 1. **tem vaga → "Marcar"** — como sempre foi. Uma aula com vaga nunca oferece
 *    fila, mesmo que o aluno esteja nela: se abriu vaga, ele marca;
 * 2. **sem vaga e ele já está na fila dela → "sair"**, com o id da LINHA — é o
 *    que a rota de saída pede, não o da ocupação;
 * 3. **sem vaga e fora da fila → "entrar na fila"**.
 *
 * **O casamento é por `ocupacaoId`, e só com linha de fila de AULA.** Uma linha
 * de fila de TURMA com a mesma turma não diz nada sobre esta ocorrência — é
 * outra fila, com outro alvo (RN2 do card: *"Turma é aula fixa; Aula é
 * reposição"*).
 */
import type { LinhaDaFila, OportunidadeDeReposicao } from "@/lib/api-client";

export type AcaoDaOportunidade =
  | { tipo: "marcar" }
  | { tipo: "entrar-na-fila" }
  | { tipo: "sair-da-fila"; linhaId: string };

export function acaoDaOportunidade(
  oportunidade: Pick<OportunidadeDeReposicao, "ocupacaoId" | "vagas">,
  minhaFila: readonly Pick<LinhaDaFila, "id" | "fila" | "ocupacaoId">[],
): AcaoDaOportunidade {
  if (oportunidade.vagas > 0) return { tipo: "marcar" };
  const linha = minhaFila.find(
    (l) => l.fila === "aula" && l.ocupacaoId === oportunidade.ocupacaoId,
  );
  return linha
    ? { tipo: "sair-da-fila", linhaId: linha.id }
    : { tipo: "entrar-na-fila" };
}
