import { describe, expect, it } from "vitest";
import {
  apareceParaMim,
  escondidosPeloFiltro,
  filtroFazSentido,
} from "./filtro-de-nivel";

/**
 * SPEC-057/TASK-004 — **as provas do recorte por nível.**
 *
 * O veredito independente da SPEC-057 derrubou a primeira versão da D15 por
 * causa exatamente disto: ela mandava copiar o molde do filtro de quadras
 * (`courts-list.tsx`), que **exclui o nulo quando filtrado**. Aqui o nulo
 * aparece — nos dois lados —, e cada escape tem caso próprio.
 */

const A = "nivel-a";
const B = "nivel-b";
const daA = { nivelId: A };
const daB = { nivelId: B };
const semNivel = { nivelId: null };

describe("apareceParaMim — a ordem dos escapes é a regra", () => {
  it("do meu nível: aparece", () => {
    expect(apareceParaMim(daA, A, false)).toBe(true);
  });

  it("de outro nível: não aparece", () => {
    expect(apareceParaMim(daB, A, false)).toBe(false);
  });

  /**
   * **INV-141, primeira metade.** É o caso da maioria dos alunos hoje: o
   * clube nunca os classificou. Esconder tudo deles seria trocar uma
   * melhoria por um apagão.
   */
  it("ALUNO sem nível vê tudo — inclusive turma de nível", () => {
    expect(apareceParaMim(daA, null, false)).toBe(true);
    expect(apareceParaMim(daB, null, false)).toBe(true);
    expect(apareceParaMim(semNivel, null, false)).toBe(true);
  });

  /** **INV-141, segunda metade.** Turma sem nível é de todos. */
  it("TURMA sem nível aparece para qualquer aluno", () => {
    expect(apareceParaMim(semNivel, A, false)).toBe(true);
    expect(apareceParaMim(semNivel, B, false)).toBe(true);
  });

  it("`ver todas` desliga o recorte, sem apagar o resto", () => {
    expect(apareceParaMim(daB, A, true)).toBe(true);
    expect(apareceParaMim(daA, A, true)).toBe(true);
    expect(apareceParaMim(semNivel, A, true)).toBe(true);
  });
});

describe("filtroFazSentido — não oferecer interruptor que não acende", () => {
  it("nenhuma turma tem nível: o filtro não aparece", () => {
    expect(filtroFazSentido([semNivel, semNivel], A)).toBe(false);
  });

  it("alguma turma tem nível: aparece", () => {
    expect(filtroFazSentido([semNivel, daB], A)).toBe(true);
  });

  it("aluno sem nível: não aparece, porque não há o que recortar", () => {
    expect(filtroFazSentido([daA, daB], null)).toBe(false);
  });

  it("lista vazia: não aparece", () => {
    expect(filtroFazSentido([], A)).toBe(false);
  });
});

describe("escondidosPeloFiltro — para o vazio dizer a verdade", () => {
  /**
   * *"nenhuma turma do seu nível"* e *"o clube não tem turma"* são frases
   * diferentes, e a tela só sabe qual escrever contando o que escondeu.
   */
  it("conta o que o recorte tirou da tela", () => {
    expect(escondidosPeloFiltro([daA, daB, semNivel], A, false)).toBe(1);
  });

  it("com `ver todas`, não esconde nada", () => {
    expect(escondidosPeloFiltro([daA, daB, semNivel], A, true)).toBe(0);
  });

  it("aluno sem nível: não esconde nada", () => {
    expect(escondidosPeloFiltro([daA, daB], null, false)).toBe(0);
  });
});
