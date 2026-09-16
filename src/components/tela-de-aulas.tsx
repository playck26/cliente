"use client";

import Link from "next/link";
import { ArrowRight, History, Users } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { MyClassesList } from "@/components/my-classes-list";
import { TopAppBar } from "@/components/top-app-bar";

/**
 * SPEC-057/TASK-002/D11 (card 5352) — **a agenda é a tela, e o submenu saiu.**
 *
 * > *"Não é necessário um submenu com próximas, anteriores e turmas; o
 * > usuário deve olhar sua agenda de aulas, clicar para ver sua turma e
 * > gerenciar esta info e, se quiser, clicar para semanas anteriores e ver as
 * > aulas que se passaram."*
 *
 * ## O que a ordem desta mudança evitou
 *
 * As três abas não eram vistas do mesmo dado: **"Turmas" era o único lugar do
 * produto onde o aluno entra e sai de turma**, e **"Anteriores" o único de
 * onde ele avalia uma aula que passou**. Tirá-las primeiro apagaria os dois
 * fluxos — foi o achado B02 do veredito independente, e o Israel decidiu
 * *"refazer os caminhos antes de tirar"*.
 *
 * Então: os dois ganharam **endereço próprio**, alcançável daqui, e só depois
 * a barra de abas saiu.
 *
 * ## Por que dois cartões, e não dois itens no menu de baixo
 *
 * A barra de baixo tem quatro destinos e é o recurso mais escasso desta
 * interface (SPEC-022). Entrar numa turma e avaliar uma aula são coisas que
 * se faz de vez em quando, a partir da agenda — não a cada abertura do app.
 */
export function TelaDeAulas() {
  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <MyClassesList />

      <div className="mt-6 space-y-3 px-5">
        <Link
          href="/minhas-aulas/turmas"
          className="flex items-center justify-between gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold text-foreground">
                Turmas do clube
              </span>
              <span className="block truncate text-[12px] font-semibold text-[var(--color-text-secondary)]">
                Veja as turmas e entre numa nova
              </span>
            </span>
          </span>
          <ArrowRight
            className="size-5 shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden="true"
          />
        </Link>

        <Link
          href="/minhas-aulas/anteriores"
          className="flex items-center justify-between gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-container)] text-[var(--color-primary-strong)]">
              <History className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold text-foreground">
                Aulas que já passaram
              </span>
              <span className="block truncate text-[12px] font-semibold text-[var(--color-text-secondary)]">
                Veja o histórico e avalie suas aulas
              </span>
            </span>
          </span>
          <ArrowRight
            className="size-5 shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden="true"
          />
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
