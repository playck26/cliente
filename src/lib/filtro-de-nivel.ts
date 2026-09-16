/**
 * SPEC-057/TASK-004 (card 5350) — **o recorte por nível, num lugar só.**
 *
 * > *"gostaria que somente aparecesse para eu gerenciar minhas aulas e turmas
 * > que são do meu nível, para que eu não me confunda"*
 *
 * Duas telas usam esta regra — a lista de turmas do clube e as oportunidades
 * de reposição —, e **duas cópias dela seria uma cópia a mais**: é sempre a
 * segunda que fica velha. Por isso é função pura, testada direto, e as telas
 * só a chamam.
 *
 * ## As duas regras que a fazem inofensiva
 *
 * **D14 — é filtro de EXIBIÇÃO, nunca trava.** O servidor não recusa entrada
 * por nível (`POST /me/classes/:id` não compara nada), e esta função não sabe
 * nada sobre poder ou não entrar. Ela decide o que a tela mostra, e só.
 *
 * **D15/INV-141 — nulo nunca esconde nada.** As duas colunas (`alunos.nivel_id`
 * e `turmas.nivel_id`) são anuláveis, e **o nulo é o estado normal**: a maior
 * parte dos alunos em produção ainda não foi classificada. Um filtro que
 * escondesse tudo de quem não tem nível transformaria a melhoria em apagão —
 * a pessoa abriria o app e veria um clube sem turmas.
 *
 * Por isso o predicado tem três escapes antes de comparar, e a ordem deles é
 * a própria regra.
 */

/** O que o filtro precisa saber de uma turma — nada além disto. */
export type ComNivel = { nivelId: string | null };

/**
 * `true` quando a turma deve aparecer.
 *
 * @param meuNivelId  o nível do aluno; `null` é o estado normal.
 * @param verTodas    o escape explícito da tela ("Ver todas").
 */
export function apareceParaMim(
  turma: ComNivel,
  meuNivelId: string | null,
  verTodas: boolean,
): boolean {
  // 1. O aluno não foi classificado: filtrar por um nível que ele não tem
  //    esconderia o clube inteiro dele.
  if (meuNivelId === null) return true;
  // 2. Ele pediu para ver tudo.
  if (verTodas) return true;
  // 3. A turma não tem nível: ela é de todos, não de ninguém.
  if (turma.nivelId === null) return true;
  return turma.nivelId === meuNivelId;
}

/**
 * **O filtro só vale a pena quando ele muda alguma coisa.**
 *
 * Oferecer "Meu nível / Todas" num clube onde nenhuma turma tem nível é
 * oferecer um interruptor que não acende luz nenhuma — e ocupa espaço numa
 * tela de 390px. O mesmo vale para o aluno sem nível: para ele o filtro não
 * tem como recortar.
 */
export function filtroFazSentido(
  itens: readonly ComNivel[],
  meuNivelId: string | null,
): boolean {
  if (meuNivelId === null) return false;
  return itens.some((item) => item.nivelId !== null);
}

/**
 * Quantos itens o recorte esconde. A tela usa para escrever o vazio certo:
 * *"nenhuma turma do seu nível"* (e há outras) é diferente de *"o clube não
 * tem turma"*.
 */
export function escondidosPeloFiltro(
  itens: readonly ComNivel[],
  meuNivelId: string | null,
  verTodas: boolean,
): number {
  return itens.filter((item) => !apareceParaMim(item, meuNivelId, verTodas))
    .length;
}
