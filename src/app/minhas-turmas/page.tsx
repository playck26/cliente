import { Suspense } from "react";
import { ProfessorTabs } from "@/components/professor-tabs";

/**
 * SPEC-026 — a área do professor passou a ter duas abas: **Agenda** (padrão)
 * e Minhas turmas.
 *
 * `Suspense` com `fallback` porque as abas leem `useSearchParams`, e barreira
 * sem fallback pisca branco sobre fundo escuro.
 */
export default function MinhasTurmasPage() {
  return (
    <Suspense
      fallback={<div className="app-screen min-h-screen bg-background" />}
    >
      <ProfessorTabs />
    </Suspense>
  );
}
