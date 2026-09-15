import type { AdicionalDaReserva } from "@/lib/api-client";

/**
 * SPEC-054/D12 — os adicionais de uma reserva, numa linha: `2× Raquete, 1× Bola`.
 *
 * Aceita `undefined` de propósito: durante o rollout, o `back` anterior à
 * SPEC-054 não manda o campo, e a lista de reservas não pode quebrar por isso.
 */
export function ItensDaReserva({
  adicionais,
  className = "",
}: {
  adicionais: readonly AdicionalDaReserva[] | undefined;
  className?: string;
}) {
  if (!adicionais || adicionais.length === 0) return null;
  return (
    <p className={`text-[13px] font-semibold text-[var(--color-text-secondary)] ${className}`}>
      {adicionais.map((a) => `${a.quantidade}× ${a.nome}`).join(", ")}
    </p>
  );
}
