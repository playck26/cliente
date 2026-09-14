"use client";

import { AgendaDoProfessor } from "@/components/agenda-do-professor";
import { BottomNav } from "@/components/bottom-nav";
import { SuasTurmas } from "@/components/suas-turmas";
import { TopAppBar } from "@/components/top-app-bar";

/**
 * SPEC-052/D2 — **a tela única do professor.**
 *
 * Substitui as duas abas da SPEC-026 ("Minhas turmas" e "Agenda"). A decisão
 * 8 do Israel foi *"a mesma agenda, só que com cores diferentes por tipo de
 * agendamento"*: a agenda é a tela, e o tipo aparece nela (D3).
 *
 * O índice "Suas turmas" embaixo **não é a aba de volta** — é o caminho para a
 * ficha que a SPEC-031/AC-019b exige, e que a agenda sozinha não garante (ver
 * `suas-turmas.tsx`). *Isto interpreta a decisão 8, e está declarado na D2.*
 *
 * **`papel="professor"` literal na barra**, como já faziam as abas: esta área
 * é dele por definição, o servidor não deixa mais ninguém chegar aqui, e
 * esperar o `getMe()` para descobrir o que a rota já garante era o que fazia a
 * barra do aluno piscar no painel dele (DEF-011).
 */
export function TelaDoProfessor() {
  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      {/* `pb-28` abre espaço para a barra fixa não cobrir a última turma. */}
      <main className="flex flex-1 flex-col gap-6 pt-2 pb-28">
        <h1 className="px-5 text-2xl font-extrabold">Agenda</h1>
        <AgendaDoProfessor />
        <SuasTurmas />
      </main>

      <BottomNav papel="professor" />
    </div>
  );
}
