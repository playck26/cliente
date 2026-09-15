import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SPEC-053/D5, INV-131 — **nenhum endereço antigo de reservar vira erro.**
 *
 * Esta é a metade que cabe num teste de unidade: QUAL destino cada página
 * manda. A outra metade — o status HTTP `308` de verdade, com `Location` — só
 * existe no servidor Next, e é provada por `next build` + `next start` + `curl`
 * (AC-010, `CLI_AUDIT.md`). Um teste que só olha a função não prova o status.
 *
 * `permanentRedirect` é mockado para LANÇAR, como o real: a função não pode
 * seguir renderizando depois de redirecionar.
 */

const permanentRedirect = vi.hoisted(() =>
  vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT ${destino}`);
  }),
);

vi.mock("next/navigation", () => ({ permanentRedirect }));
vi.mock("@/components/reservas-tabs", () => ({ ReservasTabs: () => null }));

const { default: ReservasPage } = await import("./page");
const { default: QuadrasPage } = await import("../quadras/page");

const comParametros = (p: { aba?: string }) => ({
  searchParams: Promise.resolve(p),
});

beforeEach(() => {
  permanentRedirect.mockClear();
});

describe("SPEC-053/D5 — os destinos", () => {
  it("/reservas?aba=quadras → /reservas/nova?tipo=quadra", async () => {
    await expect(ReservasPage(comParametros({ aba: "quadras" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(permanentRedirect).toHaveBeenCalledWith("/reservas/nova?tipo=quadra");
  });

  it("/reservas?aba=aula → /reservas/nova?tipo=aula", async () => {
    await expect(ReservasPage(comParametros({ aba: "aula" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(permanentRedirect).toHaveBeenCalledWith("/reservas/nova?tipo=aula");
  });

  it("/reservas, /reservas?aba=reservas e ?aba=anteriores NÃO redirecionam", async () => {
    const casos: { aba?: string }[] = [{}, { aba: "reservas" }, { aba: "anteriores" }];
    for (const p of casos) {
      await expect(ReservasPage(comParametros(p))).resolves.toBeTruthy();
    }
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("/quadras → /reservas/nova?tipo=quadra", () => {
    expect(() => QuadrasPage()).toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/reservas/nova?tipo=quadra");
  });
});
