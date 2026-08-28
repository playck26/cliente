import { Suspense } from "react";
import { AulasTabs } from "@/components/aulas-tabs";

/**
 * SPEC-023 — a tela de aulas passou a ter duas abas: as minhas, e as turmas
 * do clube em que dá para entrar (ver `aulas-tabs.tsx`).
 *
 * `Suspense` com `fallback` pela mesma razão de `/reservas`:
 * `useSearchParams` obriga a barreira, e barreira sem fallback pisca branco
 * sobre fundo escuro.
 */
export default function MinhasAulasPage() {
  return (
    <Suspense
      fallback={<div className="app-screen min-h-screen bg-background" />}
    >
      <AulasTabs />
    </Suspense>
  );
}
