import { Suspense } from "react";
import { ReservasTabs } from "@/components/reservas-tabs";

/**
 * SPEC-022 — a tela de Reservas passa a ter duas abas (ver
 * `reservas-tabs.tsx`).
 *
 * O `Suspense` não é enfeite: `useSearchParams` obriga a barreira no App
 * Router, e sem ela o build falha em vez de avisar em runtime.
 *
 * **E o `fallback` também não é.** Sem ele a tela fica branca por um quadro
 * antes de pintar — em cima de fundo escuro, isso lê como piscada. É a mesma
 * lição da `NavVazia` do DEF-011: enquanto não se sabe o que mostrar, ocupe
 * o espaço em silêncio em vez de deixar a tela pular.
 */
export default function ReservasPage() {
  return (
    <Suspense
      fallback={<div className="app-screen min-h-screen bg-background" />}
    >
      <ReservasTabs />
    </Suspense>
  );
}
