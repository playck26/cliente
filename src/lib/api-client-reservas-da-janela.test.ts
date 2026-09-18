import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMyBookings } from "./api-client";

/**
 * SPEC-059 — **a busca de reservas por janela, e o teste que faltava.**
 *
 * A primeira versão desta função pedia `pageSize=200`. O DTO da rota tem
 * `@Max(100)`: a resposta foi **400**, e a agenda subiu em produção **sem
 * reserva nenhuma** — calada, porque a tela trata falha de reserva como
 * "mostro as aulas e aviso".
 *
 * **Nenhum teste pegou, e a razão importa:** os testes de tela dublam esta
 * função, e dublê não valida query string. O limite mora no contrato do
 * servidor, e só um teste que olha a URL o alcança daqui.
 */
function resposta(corpo: unknown): Response {
  const fazer = (): Response =>
    ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

const reserva = (id: string) => ({ id, data: "2026-09-17" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.setItem("playck_cliente_access_token", "token-de-teste");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const urlDaChamada = (n: number) =>
  new URL(fetchMock.mock.calls[n][0] as string);

describe("listMyBookings — a janela do calendário", () => {
  it("nunca pede mais que o teto do servidor (@Max(100))", async () => {
    fetchMock.mockResolvedValue(resposta({ data: [], total: 0 }));

    await listMyBookings({ de: "2026-09-01", ate: "2026-11-17" });

    const url = urlDaChamada(0);
    expect(Number(url.searchParams.get("pageSize"))).toBeLessThanOrEqual(100);
    expect(url.searchParams.get("de")).toBe("2026-09-01");
    expect(url.searchParams.get("ate")).toBe("2026-11-17");
  });

  it("uma página incompleta encerra a busca", async () => {
    fetchMock.mockResolvedValue(
      resposta({ data: [reserva("r1"), reserva("r2")], total: 2 }),
    );

    const itens = await listMyBookings({ de: "2026-09-01", ate: "2026-09-30" });

    expect(itens).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("janela cheia: pagina até trazer tudo o que o servidor diz existir", async () => {
    const cheia = Array.from({ length: 100 }, (_, i) => reserva(`p1-${i}`));
    fetchMock
      .mockResolvedValueOnce(resposta({ data: cheia, total: 130 }))
      .mockResolvedValueOnce(
        resposta({ data: [reserva("p2-1"), reserva("p2-2")], total: 130 }),
      );

    const itens = await listMyBookings({ de: "2026-09-01", ate: "2026-10-31" });

    expect(itens).toHaveLength(102);
    expect(urlDaChamada(1).searchParams.get("page")).toBe("2");
  });

  // O laço não pode ficar presto se o servidor responder sempre cheio: sem
  // teto, uma resposta inesperada viraria requisição infinita no celular de
  // alguém.
  it("para no teto de páginas mesmo se o servidor nunca disser que acabou", async () => {
    const cheia = Array.from({ length: 100 }, (_, i) => reserva(`x-${i}`));
    fetchMock.mockResolvedValue(resposta({ data: cheia, total: 99999 }));

    await listMyBookings({ de: "2026-09-01", ate: "2026-10-31" });

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
