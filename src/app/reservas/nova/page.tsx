import { NovaReserva } from "@/components/nova-reserva";

/**
 * SPEC-053/D3 — `/reservas/nova`, com `?tipo=quadra` ou `?tipo=aula`.
 *
 * O parâmetro é lido AQUI, no servidor, e passado pronto: o componente não
 * precisa de `useSearchParams` nem de `Suspense`.
 *
 * **Esta página sobrevive a um rollback da SPEC-053** (ver o rollout da spec):
 * `/quadras` e `/reservas?aba=…` respondem `308` para cá, e o navegador guarda
 * `308`. Apagá-la num revert deixaria esses navegadores num 404.
 */
export default async function NovaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  const { tipo } = await searchParams;
  return <NovaReserva tipo={typeof tipo === "string" ? tipo : null} />;
}
