import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProximasAulas } from "./api-client";

/**
 * **SPEC-066/AC-011 — a sabotagem de DESSERIALIZAÇÃO, com o cliente REAL.**
 *
 * ## Por que esta prova é separada da AC-010
 *
 * São dois defeitos diferentes com o mesmo sintoma, e nenhuma das duas provas
 * pega o defeito da outra:
 *
 * | | O que quebra | O que pega |
 * |---|---|---|
 * | **AC-010** | a assinatura volta a `MyClass[]` | `pnpm run typecheck`, em `my-classes-list.tsx` |
 * | **AC-011** | a função passa a devolver o corpo como array, ou perde um campo | **este arquivo** |
 *
 * O `as` do `api-client.ts` **não muda valor nenhum em runtime** — então uma
 * prova de execução jamais ficaria vermelha por uma troca de assinatura, e uma
 * prova de tipo jamais ficaria vermelha por uma troca de forma.
 *
 * A 3ª rodada de validação reabriu a AC-011 exatamente por isto: a versão
 * anterior dizia só *"um teste de runtime entrega o objeto paginado"*, e um
 * teste assim **pode mockar `listProximasAulas`** e passar medindo o próprio
 * dublê — a função real continuaria devolvendo array e a tela receberia o
 * objeto certo do mock.
 *
 * **Aqui a função é a de verdade.** O que está dublado é o `fetch`.
 *
 * ## E há precedente de produção para isto
 *
 * `api-client-reservas-da-janela.test.ts` guarda um defeito da mesma família:
 * a função pedia `pageSize=200` contra um `@Max(100)` do servidor, a resposta
 * foi `400`, e **a agenda subiu sem reserva nenhuma** — calada. Nenhum teste
 * de tela pegou, porque *dublê não valida query string*.
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

const aula = {
  ocupacaoId: "o1",
  turmaId: "t1",
  turmaNome: "Iniciantes",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  naoRealizada: false,
  faltaAvisada: false,
};

const pagina = { data: [aula], page: 2, pageSize: 10, total: 43 };

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

describe("AC-011 — a forma do corpo atravessa o cliente inteira", () => {
  it("os QUATRO campos chegam a quem chamou", async () => {
    fetchMock.mockResolvedValue(resposta(pagina));

    const recebido = await listProximasAulas({ page: 2, pageSize: 10 });

    // Os quatro, um a um e de propósito. `toEqual(pagina)` passaria se a
    // função devolvesse o corpo inteiro sem olhar — o que é justamente um
    // dos comportamentos que esta AC aceita. O que ela NÃO aceita é perder
    // campo, e só nomeá-los pega isso.
    expect(recebido.data).toHaveLength(1);
    expect(recebido.data[0].ocupacaoId).toBe("o1");
    expect(recebido.page).toBe(2);
    expect(recebido.pageSize).toBe(10);
    expect(recebido.total).toBe(43);
  });

  it("um corpo em ARRAY não produz uma página válida", async () => {
    // **A sabotagem do enunciado da AC**: o servidor (ou a função) volta a
    // devolver a lista crua. Antes desta spec era exatamente esse o contrato,
    // então é o erro mais provável de alguém reintroduzir.
    fetchMock.mockResolvedValue(resposta([aula]));

    const recebido = await listProximasAulas();

    // `data` some, e com ele o `.map` da tela e o `total` do paginador. Um
    // teste que dublasse `listProximasAulas` nunca veria isto.
    expect(recebido.data).toBeUndefined();
    expect(recebido.total).toBeUndefined();
  });
});

describe("AC-011 — a URL leva a página, porque dublê não valida query string", () => {
  it("`page` e `pageSize` entram na query", async () => {
    fetchMock.mockResolvedValue(resposta(pagina));

    await listProximasAulas({ page: 3, pageSize: 10 });

    const url = urlDaChamada(0);
    expect(url.pathname).toMatch(/\/me\/classes\/proximas$/);
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("pageSize")).toBe("10");
  });

  it("sem argumento, não inventa query — o servidor tem os padrões", async () => {
    fetchMock.mockResolvedValue(resposta(pagina));

    await listProximasAulas();

    expect(urlDaChamada(0).search).toBe("");
  });

  it("o `pageSize` que a tela usa cabe no teto do servidor", async () => {
    fetchMock.mockResolvedValue(resposta(pagina));

    await listProximasAulas({ page: 1, pageSize: 10 });

    // **O defeito da SPEC-059 em miniatura**: lá a função pedia 200 contra um
    // `@Max(100)`, a rota respondeu `400` e a agenda subiu vazia. O DTO desta
    // rota tem `@Max(50)`.
    expect(
      Number(urlDaChamada(0).searchParams.get("pageSize")),
    ).toBeLessThanOrEqual(50);
  });
});
