"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * SPEC-027 — **a paginação das listas do app**, a pedido do Israel.
 *
 * Um componente só para as três telas que crescem sem teto: minhas reservas,
 * aulas anteriores e o histórico de chamadas da turma. Três controles
 * separados divergiriam — e num app de celular a diferença aparece rápido,
 * porque cada tela tem pouco espaço e cada uma resolveria à sua maneira.
 *
 * **Anterior/próxima, e não lista de números.** Numa tela estreita, 8 botões
 * de página viram alvos de 20px; e o que a pessoa faz aqui é percorrer, não
 * saltar para a página 6. O texto no meio diz onde ela está, que é a
 * informação que o salto daria.
 *
 * **Some sozinha quando cabe numa página.** Um controle de paginação abaixo
 * de 3 itens é ruído que ocupa a altura de mais um item.
 */
export function Paginacao({
  page,
  pageSize,
  total,
  onMudar,
  ocupado = false,
  rotulo,
}: {
  page: number;
  pageSize: number;
  total: number;
  onMudar: (novaPagina: number) => void;
  ocupado?: boolean;
  /** Ex.: "aulas anteriores" — entra no `aria-label` dos botões. */
  rotulo: string;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(total / pageSize));
  if (totalDePaginas <= 1) return null;

  const primeiro = (page - 1) * pageSize + 1;
  // `Math.min` porque a última página quase nunca está cheia — sem ele, a
  // tela anunciaria "mostrando 41–60 de 47".
  const ultimo = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-1"
      aria-label={`Paginação de ${rotulo}`}
    >
      <button
        type="button"
        onClick={() => onMudar(page - 1)}
        disabled={page <= 1 || ocupado}
        aria-label={`Página anterior de ${rotulo}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      {/*
        `aria-live="polite"`: quem usa leitor de tela precisa ouvir que a
        lista mudou. Sem isso, o botão é acionado e nada é anunciado — a
        pessoa fica sem saber se funcionou.
      */}
      <p
        aria-live="polite"
        className="min-w-0 text-center text-[12px] font-bold text-[var(--color-text-secondary)]"
      >
        {primeiro}–{ultimo} de {total}
      </p>

      <button
        type="button"
        onClick={() => onMudar(page + 1)}
        disabled={page >= totalDePaginas || ocupado}
        aria-label={`Próxima página de ${rotulo}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
