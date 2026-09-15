import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adicionaisDisponiveis,
  createBooking,
  marcarAulaParticular,
} from "./api-client";

/**
 * SPEC-054 — **o que o app do aluno manda e lê sobre adicionais.**
 *
 * Três garantias de fio, que nenhum teste de tela pega porque as telas mockam
 * estas funções:
 *
 * - sem adicional escolhido, o corpo **não leva o campo** — nem `[]`. A
 *   impressão digital do pedido (D9) só é idêntica à de antes sem ele;
 * - a aula particular continua **sem `valor`** mesmo com adicional (DEF-029);
 * - o `404` do `back` anterior à SPEC-054 vira lista vazia, e o passo some.
 */

function resposta(status: number, corpo: unknown): Response {
  const fazer = (): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.setItem("playck_cliente_access_token", "token-de-teste");
  fetchMock = vi.fn().mockResolvedValue(resposta(201, { reservas: [] }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function corpoDaChamada(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

const PEDIDO = {
  quadraId: "q-1",
  data: "2035-06-07",
  slots: [{ horaInicio: "09:00", horaFim: "10:00" }],
};

describe("createBooking — SPEC-054/D7", () => {
  it("com adicional, manda os itens", async () => {
    await createBooking({
      ...PEDIDO,
      adicionais: [{ adicionalId: "ad-1", quantidade: 2 }],
    });
    expect(corpoDaChamada().adicionais).toEqual([
      { adicionalId: "ad-1", quantidade: 2 },
    ]);
  });

  it("lista vazia NÃO vira campo — o corpo é o de antes da SPEC-054", async () => {
    await createBooking({ ...PEDIDO, adicionais: [] });
    expect("adicionais" in corpoDaChamada()).toBe(false);
  });
});

describe("marcarAulaParticular — SPEC-054 sem abrir o DEF-029", () => {
  it("manda os adicionais e continua sem `valor`", async () => {
    await marcarAulaParticular({
      quadraId: "q-1",
      data: "2035-06-07",
      horaInicio: "09:00",
      horaFim: "10:00",
      professorId: "p-1",
      adicionais: [{ adicionalId: "ad-1", quantidade: 1 }],
    });
    const corpo = corpoDaChamada();
    expect(corpo.adicionais).toEqual([{ adicionalId: "ad-1", quantidade: 1 }]);
    expect("valor" in corpo).toBe(false);
  });

  it("sem adicional, o corpo não leva o campo", async () => {
    await marcarAulaParticular({
      quadraId: "q-1",
      data: "2035-06-07",
      horaInicio: "09:00",
      horaFim: "10:00",
      professorId: "p-1",
    });
    expect("adicionais" in corpoDaChamada()).toBe(false);
  });
});

describe("adicionaisDisponiveis — SPEC-054/D8", () => {
  it("pede com os horários ordenados, separados por vírgula", async () => {
    fetchMock.mockResolvedValue(resposta(200, []));
    await adicionaisDisponiveis("2035-06-07", ["15:00-16:00", "09:00-10:00"]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/adicionais/disponiveis?");
    const params = new URL(url).searchParams;
    expect(params.get("data")).toBe("2035-06-07");
    expect(params.get("slots")).toBe("09:00-10:00,15:00-16:00");
  });

  it("o `404` do back anterior vira lista vazia — o passo some, sem erro", async () => {
    fetchMock.mockResolvedValue(resposta(404, { message: "Cannot GET" }));
    await expect(
      adicionaisDisponiveis("2035-06-07", ["09:00-10:00"]),
    ).resolves.toEqual([]);
  });

  it("outro erro NÃO é ausência — sobe", async () => {
    fetchMock.mockResolvedValue(resposta(500, { message: "falhou" }));
    await expect(
      adicionaisDisponiveis("2035-06-07", ["09:00-10:00"]),
    ).rejects.toMatchObject({ status: 500 });
  });
});
