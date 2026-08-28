import { Suspense } from "react";
import { ReservasTabs } from "@/components/reservas-tabs";

/**
 * SPEC-022 — a tela de Reservas passa a ter duas abas (ver
 * `reservas-tabs.tsx`).
 *
 * O `Suspense` não é enfeite: `useSearchParams` obriga a barreira no App
 * Router, e sem ela o build falha em vez de avisar em runtime.
 */
export default function ReservasPage() {
  return (
    <Suspense>
      <ReservasTabs />
    </Suspense>
  );
}
