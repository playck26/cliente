import { Suspense } from "react";
import { TelaDeAulas } from "@/components/tela-de-aulas";

/**
 * SPEC-057/TASK-002/D11 — **a agenda é a tela.** As abas "Próximas /
 * Anteriores / Turmas" saíram; o catálogo e o histórico ganharam endereço
 * próprio, alcançável daqui.
 *
 * `Suspense` continua: `MyClassesList` usa `useSearchParams` para lembrar a
 * vista (lista ou semana), e barreira sem fallback pisca branco sobre fundo
 * escuro.
 */
export default function MinhasAulasPage() {
  return (
    <Suspense
      fallback={<div className="app-screen min-h-screen bg-background" />}
    >
      <TelaDeAulas />
    </Suspense>
  );
}
