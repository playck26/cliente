import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { ReservasTabs } from "@/components/reservas-tabs";

/**
 * SPEC-022 — a tela de Reservas tem abas (ver `reservas-tabs.tsx`).
 *
 * **SPEC-053/D5 — as abas de CONTRATAR saíram**, e os endereços delas não podem
 * virar erro: `?aba=quadras` e `?aba=aula` respondem `308` para
 * `/reservas/nova`, **no servidor, antes de renderizar**. Por isso a página é
 * assíncrona e lê `searchParams` — continua sendo componente de servidor, e o
 * `Suspense` segue protegendo o `useSearchParams` das abas.
 *
 * `permanentRedirect` (308) e não `redirect` (307): a mudança é definitiva, como
 * a do `/quadras` na SPEC-022. O HTTP de verdade é provado com `next start`
 * (AC-010) — a prova de unidade só vê o destino.
 *
 * O `fallback` também não é enfeite: sem ele a tela fica branca por um quadro
 * antes de pintar, e em cima de fundo escuro isso lê como piscada (DEF-011).
 */
const DESTINO_DA_ABA_ANTIGA: Record<string, string> = {
  quadras: "/reservas/nova?tipo=quadra",
  aula: "/reservas/nova?tipo=aula",
};

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>;
}) {
  const { aba } = await searchParams;
  const destino = typeof aba === "string" ? DESTINO_DA_ABA_ANTIGA[aba] : undefined;
  if (destino) permanentRedirect(destino);

  return (
    <Suspense
      fallback={<div className="app-screen min-h-screen bg-background" />}
    >
      <ReservasTabs />
    </Suspense>
  );
}
