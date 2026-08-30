/**
 * **DEF-020 — que dia é hoje, no fuso do clube.**
 *
 * O espelho do `date-time.util.ts` do back, e existe pelo mesmo motivo: o
 * relógio de quem chama não decide o dia do clube. No back o risco é o
 * servidor rodar em UTC; aqui é o navegador poder estar em qualquer fuso —
 * e, mesmo no Brasil, `new Date().toISOString()` **já é o dia seguinte das
 * 21h à meia-noite**, porque `toISOString()` converte para UTC.
 *
 * Foi assim que a tela de reserva errava: ela montava os 30 dias com
 * `new Date().toISOString().slice(0, 10)`, então quem abria o app às 21h30
 * via a lista começando **amanhã** e não conseguia mais reservar os
 * horários que ainda restavam hoje.
 *
 * Pior ainda era o `isoDeOffset`, que somava dias em horário **local**
 * (`getDate()`) e lia o resultado em **UTC** (`toISOString()`) — as duas
 * convenções na mesma função de três linhas.
 *
 * Se um dia houver clube em outro fuso, isto vira dado da empresa vindo da
 * API. O lugar de mudar é aqui, um só.
 */
export const FUSO_DO_CLUBE = "America/Sao_Paulo";

/** O dia de hoje no clube, como `AAAA-MM-DD`. */
export function hojeNoClubeIso(agora: Date = new Date()): string {
  // `en-CA` formata como `AAAA-MM-DD`, que é exatamente o formato que a API
  // espera. Não é curiosidade: é a forma de pedir a data local sem montar
  // string à mão a partir de partes.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DO_CLUBE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Hoje no clube, decomposto — para quem precisa comparar ano/mês/dia. */
export function hojeNoClube(agora: Date = new Date()): {
  ano: number;
  mes: number;
  dia: number;
} {
  const [ano, mes, dia] = hojeNoClubeIso(agora).split("-").map(Number);
  return { ano, mes, dia };
}

/**
 * A data N dias à frente de hoje, no fuso do clube.
 *
 * A aritmética acontece **em UTC sobre a data já resolvida**, nunca sobre o
 * instante: somar dias a um `Date` de "agora" e depois formatar mistura as
 * duas convenções e erra na virada. Como o Brasil não tem mais horário de
 * verão, somar 24h é seguro; se voltasse a ter, este é o ponto único onde a
 * correção entraria.
 */
export function isoDeOffsetNoClube(dias: number, agora: Date = new Date()): string {
  const base = new Date(`${hojeNoClubeIso(agora)}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}
