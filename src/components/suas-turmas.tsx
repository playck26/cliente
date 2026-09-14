"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import {
  ApiError,
  listMinhasTurmas,
  type MinhaTurma,
} from "@/lib/api-client";
import { formatarEncontro } from "@/lib/encontros";

/**
 * SPEC-052/D2 — **o índice "Suas turmas", abaixo da agenda.**
 *
 * **Não é a aba de volta.** A lista de turmas saiu; o que ela levava de
 * insubstituível era o CAMINHO para a ficha da turma (alunos, encontros e o
 * histórico de 30 dias com as aulas canceladas). A agenda exclui aula
 * cancelada, então uma turma cuja única aula do mês foi cancelada não oferece
 * nada de onde partir — e a SPEC-031/AC-019b exige que a aula cancelada seja
 * alcançável. Este índice não depende de existir aula no mês.
 *
 * **Mesma rota da lista antiga** (`GET /me/teacher/classes`), sem filtro novo:
 * preserva exatamente o alcance de hoje — turma inativada já não aparecia
 * (LIM-052a, GAP-015) e continua não aparecendo.
 *
 * Sem nota de avaliação (SPEC-052/D6), sem capacidade, sem cartão grande: o que
 * a lista tinha além do caminho continua na ficha.
 */
export function SuasTurmas() {
  const [turmas, setTurmas] = useState<MinhaTurma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    listMinhasTurmas()
      .then((t) => {
        if (atual) setTurmas(t);
      })
      .catch((e: unknown) => {
        if (atual)
          setErro(
            e instanceof ApiError
              ? e.message
              : "Não foi possível carregar suas turmas.",
          );
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, []);

  return (
    <section aria-labelledby="suas-turmas-titulo" className="space-y-3 px-5">
      <h2 id="suas-turmas-titulo" className="text-lg font-extrabold">
        Suas turmas
      </h2>

      {carregando ? (
        <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
          Carregando…
        </p>
      ) : erro ? (
        <p
          role="alert"
          className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
        >
          {erro}
        </p>
      ) : turmas.length === 0 ? (
        // Estado vazio que diz o que fazer: sem isso, o professor fica sem
        // saber se o app quebrou ou se o gestor ainda não o vinculou.
        <div className="rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
          <p className="font-extrabold">Nenhuma turma atribuída a você</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Quando o gestor colocar você como professor de uma turma, ela
            aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {turmas.map((turma) => (
            <li key={turma.id}>
              <Link
                href={`/minhas-turmas/${turma.id}`}
                className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold">
                    {turma.nome}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-bold text-[var(--color-text-secondary)]">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                    {turma.encontros.map(formatarEncontro).join(" · ")}
                  </p>
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-[var(--color-primary-strong)]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
