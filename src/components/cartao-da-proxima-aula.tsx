"use client";

import Link from "next/link";
import { ArrowRight, CalendarPlus, Clock } from "lucide-react";
import { hojeNoClubeIso } from "@/lib/fuso";
import type { MyClass } from "@/lib/api-client";

/**
 * SPEC-058/D3 — **o cartão que voltou, e por que ele é outro.**
 *
 * A SPEC-057/D13 tirou o hero da home com um argumento que continua correto:
 * ele repetia, em letra grande, a primeira aula da lista logo abaixo. O
 * Israel pediu o cartão de volta — *"ele dá um tchã no app"* — e pediu mais:
 * *"trazendo os insights mais importantes para o aluno"*.
 *
 * **O insight que ele escolheu foi um só: a próxima aula, com contagem.**
 * Então o cartão não repete a data que o calendário já mostra; ele responde
 * a pergunta que a grade não responde — *quanto falta*. "em 3 horas" é o que
 * muda o comportamento de quem lê; "quinta, 19:00" a pessoa já viu.
 *
 * **Sem aula futura ele não some** (AC-007). Cartão que aparece e desaparece
 * faz a home pular de altura entre duas visitas, e quem não tem aula é
 * exatamente quem precisa do convite para entrar numa turma.
 */

/** `19:00:00` → `19:00`. */
const hora = (h: string) => h.slice(0, 5);

/**
 * SPEC-058/AC-006 — a contagem, em palavra.
 *
 * **Tudo em cima do fuso do clube, e nada de `setInterval`** (LIM-058c): a
 * contagem é do instante do desenho. Uma home que o aluno abre por dez
 * segundos não precisa de relógio correndo, e um `setInterval` num componente
 * de home é vazamento fácil de criar e difícil de ver.
 *
 * As horas saem da diferença real de instantes; os dias, da diferença de
 * DATAS — "amanhã" é uma propriedade do calendário, não de 24 horas. Sem essa
 * separação, uma aula às 8h de amanhã vista às 22h de hoje viraria "em 10
 * horas", quando a palavra que a pessoa espera é "amanhã".
 */
export function contagem(
  aula: Pick<MyClass, "data" | "horaInicio">,
  // **`Date.now()`, e não `new Date().toISOString()`.** O gate de `fuso.ts`
  // recusa o segundo, e com razão: ele é "o dia de hoje lido em UTC", que às
  // 21h já virou amanhã. O que se quer aqui é o INSTANTE, e instante não tem
  // fuso — a data de hoje continua vindo de `hojeNoClubeIso()`, logo abaixo.
  agora: number = Date.now(),
  hojeIso: string = hojeNoClubeIso(),
): string {
  const inicio = Date.parse(`${aula.data}T${aula.horaInicio}-03:00`);
  const horas = Math.floor((inicio - agora) / 3_600_000);
  const dias = Math.round(
    (Date.parse(`${aula.data}T00:00:00.000Z`) -
      Date.parse(`${hojeIso}T00:00:00.000Z`)) /
      86_400_000,
  );

  if (dias === 0) {
    if (horas <= 0) return "agora";
    return horas === 1 ? "em 1 hora" : `em ${horas} horas`;
  }
  if (dias === 1) return `amanhã às ${hora(aula.horaInicio)}`;
  return `em ${dias} dias`;
}

/** A primeira aula que ainda não começou, no fuso do clube. */
export function proximaAula(
  aulas: MyClass[],
  hojeIso: string = hojeNoClubeIso(),
): MyClass | null {
  const futuras = aulas
    .filter((a) => a.data >= hojeIso && !a.naoRealizada)
    .sort((x, y) =>
      x.data === y.data
        ? x.horaInicio.localeCompare(y.horaInicio)
        : x.data.localeCompare(y.data),
    );
  return futuras[0] ?? null;
}

export function CartaoDaProximaAula({ aulas }: { aulas: MyClass[] }) {
  const aula = proximaAula(aulas);

  if (!aula) {
    return (
      <section
        aria-label="Sua próxima aula"
        className="relative overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">
              Sua próxima aula
            </p>
            <h2 className="mt-1 text-xl font-extrabold">Nenhuma aula marcada</h2>
            <p className="mt-1 text-sm font-medium text-white/65">
              Entre numa turma e ela aparece aqui.
            </p>
          </div>
          <Link
            href="/minhas-aulas/turmas"
            aria-label="Ver turmas do clube"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-court-dark)]"
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Sua próxima aula"
      className="relative overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]"
    >
      {/*
        O brilho é decoração pura, e por isso é `aria-hidden` e não bloqueia
        toque (`pointer-events-none`). Sem isso, um enfeite come o clique do
        link que está por baixo — defeito clássico de cartão com overlay.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-[var(--color-secondary)]/20 blur-2xl"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">
            Sua próxima aula
          </p>

          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-extrabold text-white">
            <Clock className="size-3.5" aria-hidden="true" />
            {contagem(aula)}
          </p>

          <h2 className="mt-2 truncate text-xl font-extrabold">{aula.turmaNome}</h2>
          {/*
            **Sem o nome da quadra, e isto é regra da home**: SPEC-053/AC-001,
            decisão 6 do Israel — a home não escreve a palavra "quadra". A
            primeira versão deste cartão escrevia, e quem pegou foi o teste
            que a SPEC-057 deixou plantado. O nome da quadra está na ficha da
            turma, a um toque daqui.
          */}
          <p className="mt-1 text-sm font-medium text-white/65">
            {hora(aula.horaInicio)}–{hora(aula.horaFim)}
          </p>

          {/*
            SPEC-046 — quem já avisou que vai faltar não pode ler "sua próxima
            aula" como se nada tivesse acontecido. O cartão diz o que ele
            mesmo marcou.
          */}
          {aula.faltaAvisada && (
            <p className="mt-2 text-[13px] font-bold text-[var(--color-secondary)]">
              Você avisou que vai faltar nesta aula.
            </p>
          )}
        </div>

        <Link
          href={`/minhas-aulas/turma/${aula.turmaId}`}
          aria-label={`Abrir ${aula.turmaNome}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-court-dark)]"
        >
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
