import type { EncontroDaTurma } from "@/lib/api-client";

/**
 * SPEC-019/TASK-005 — como um encontro de turma aparece no app.
 *
 * ## Por que este módulo existe
 *
 * `DIAS_SEMANA` estava **copiado** em `minhas-turmas-view.tsx` e
 * `minha-turma-detalhe.tsx`. Com os três campos soltos isso era duplicação
 * pequena; com uma lista de encontros seria duplicação de formatação também,
 * e a segunda cópia divergiria no primeiro ajuste — a lista diria "Terça" e o
 * detalhe "Ter", sem ninguém ter decidido isso.
 *
 * ## A convenção do índice
 *
 * `0 = domingo`, igual a `Date.getDay()` em JS, a `turmas.dia_semana` e a
 * `horarios_funcionamento.dia_semana` no banco. **Não há tradução de índice
 * em lugar nenhum deste produto**, e é deliberado: tradução de índice de dia
 * é erro que só aparece no domingo, quando ninguém está olhando.
 */
export const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** "Terça" — ou `—` se o dia vier fora do intervalo. */
export function nomeDoDia(diaSemana: number): string {
  return DIAS_SEMANA[diaSemana] ?? "—";
}

/** "Terça, 18:00–19:00". */
export function formatarEncontro(encontro: EncontroDaTurma): string {
  return `${nomeDoDia(encontro.diaSemana)}, ${encontro.horaInicio}–${encontro.horaFim}`;
}

/**
 * O encontro que representa a turma num espaço apertado — o quadradinho do
 * card, que cabe um só.
 *
 * **É o primeiro da lista, e a lista vem ordenada do servidor** (por dia e
 * depois por hora). Escolher aqui por conta própria faria a ordem do card
 * discordar da ordem do texto ao lado dele.
 *
 * `null` quando não há encontro — estado que a INV-051 proíbe, mas que a tela
 * precisa aguentar sem quebrar.
 */
export function encontroPrincipal(
  encontros: EncontroDaTurma[],
): EncontroDaTurma | null {
  return encontros[0] ?? null;
}
