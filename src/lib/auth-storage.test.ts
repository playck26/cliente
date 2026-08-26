import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  getPapel,
  saveAccessToken,
  savePapel,
} from "./auth-storage";

/**
 * A sessão guardada no navegador (2026-08-26).
 *
 * **O papel entrou aqui por causa do flash da barra de baixo**: sem ele o
 * `BottomNav` só descobre quem está logado quando o `getMe()` volta, e até
 * lá ou desenha a barra errada — o professor via a do aluno por um segundo —
 * ou não desenha nada.
 *
 * **E ele é navegação, nunca autorização.** Quem decide o que cada papel
 * pode ler é o servidor (INV-012). Adulterar este valor dá tela errada,
 * jamais dado — e é justamente por isso que o `getPapel()` valida: não para
 * impedir fraude, mas para não devolver lixo como se fosse papel.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe("o papel", () => {
  it("volta como foi guardado", () => {
    savePapel("professor");
    expect(getPapel()).toBe("professor");
  });

  it("sem nada guardado, é `null` — e `null` significa NÃO SEI", () => {
    // O contrato que o `BottomNav` consome. Se isto devolvesse `"aluno"`
    // por padrão, o flash voltaria pela porta dos fundos.
    expect(getPapel()).toBeNull();
  });

  it("valor estranho vira `null`, não um papel inventado", () => {
    // O `localStorage` é do navegador, não nosso: qualquer string pode
    // estar lá. Devolver `"banana" as Papel` faria o `BottomNav` cair no
    // ramo do aluno por acidente, em vez de admitir que não sabe.
    window.localStorage.setItem("playck_cliente_papel", "banana");
    expect(getPapel()).toBeNull();
  });

  it("string vazia também vira `null`", () => {
    window.localStorage.setItem("playck_cliente_papel", "");
    expect(getPapel()).toBeNull();
  });

  it("aceita os quatro papéis reais", () => {
    for (const papel of [
      "super_admin",
      "company_admin",
      "aluno",
      "professor",
    ] as const) {
      savePapel(papel);
      expect(getPapel()).toBe(papel);
    }
  });
});

describe("sair leva os DOIS", () => {
  it("`clearAccessToken` apaga o token E o papel", () => {
    // Token sem papel deixaria a barra adivinhando; papel sem token é uma
    // sobra que a próxima pessoa a usar este navegador herdaria.
    saveAccessToken("tok");
    savePapel("professor");

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(getPapel()).toBeNull();
  });
});
