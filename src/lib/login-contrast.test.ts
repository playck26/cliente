import { describe, expect, it } from "vitest";
import {
  type Cor,
  compor,
  limiteDoTexto,
  menorRazao,
  razao,
  razaoDaFaixa,
} from "../../e2e/helpers/login-contrast";

/**
 * SPEC-084 (TEST-002) — **autoteste da matemática do medidor de contraste.**
 *
 * Um medidor que aprova tudo é pior que nenhum: dá um número com cara de
 * prova. Cada caso aqui é um par em que a resposta certa é conhecida de fora
 * (a fórmula WCAG, ou a composição feita à mão), e o da FRONTEIRA é o que
 * mais importa: 4,48 tem de reprovar e 4,54 tem de passar.
 *
 * O "esconder glifos antes de capturar" é do navegador, e o autoteste dele
 * está em `e2e/login-visual.spec.ts`.
 */

const BRANCO: Cor = [255, 255, 255];
const PRETO: Cor = [0, 0, 0];

describe("razão WCAG — os pares de fronteira", () => {
  it("branco sobre #777777 dá 4,48 e REPROVA texto comum", () => {
    const r = razao(BRANCO, [0x77, 0x77, 0x77]);
    expect(r).toBeCloseTo(4.48, 2);
    expect(r).toBeLessThan(limiteDoTexto(16, false));
  });

  it("branco sobre #767676 dá 4,54 e PASSA texto comum", () => {
    const r = razao(BRANCO, [0x76, 0x76, 0x76]);
    expect(r).toBeCloseTo(4.54, 2);
    expect(r).toBeGreaterThanOrEqual(limiteDoTexto(16, false));
  });

  it("branco sobre preto é 21:1, e a ordem dos argumentos não importa", () => {
    expect(razao(BRANCO, PRETO)).toBeCloseTo(21, 5);
    expect(razao(PRETO, BRANCO)).toBeCloseTo(21, 5);
  });

  it("as cores que a R1 mediu: #ED0040 e #00763A sobre #080D10 ficam abaixo de 4,5", () => {
    const fundo: Cor = [0x08, 0x0d, 0x10];
    expect(razao([0xed, 0x00, 0x40], fundo)).toBeCloseTo(4.35, 1);
    expect(razao([0x00, 0x76, 0x3a], fundo)).toBeCloseTo(3.4, 1);
  });
});

describe("cor com alfa — composta em sRGB antes da luminância", () => {
  it("branco a 50% sobre preto vira (127,5) e não 'meia luminância'", () => {
    expect(compor([255, 255, 255, 0.5], PRETO)).toEqual([127.5, 127.5, 127.5]);
    // Compor LUMINÂNCIAS daria (1 + 0) / 2 = 0,5 e razão 11:1 contra o preto;
    // o certo, compondo a cor, é ≈ 5,3:1.
    expect(menorRazao([255, 255, 255, 0.5], [PRETO])).toBeCloseTo(5.28, 1);
  });

  it("alfa 1 é a própria cor; alfa 0 é o próprio fundo (razão 1)", () => {
    expect(menorRazao([255, 255, 255, 1], [PRETO])).toBeCloseTo(21, 5);
    expect(menorRazao([255, 255, 255, 0], [PRETO])).toBeCloseTo(1, 5);
  });
});

describe("o pior pixel decide", () => {
  it("degradê escuro com UM pixel claro conhecido: a razão é a desse pixel", () => {
    const degrade: Cor[] = Array.from({ length: 50 }, (_, i): Cor => [i, i, i]);
    const claro: Cor = [240, 240, 240];
    const r = menorRazao([255, 255, 255, 1], [...degrade, claro]);
    expect(r).toBeCloseTo(razao(BRANCO, claro), 5);
    expect(r).toBeLessThan(3);
  });

  it("glifos que não foram escondidos contaminam a amostra e derrubam a medida", () => {
    // Texto branco sobre fundo preto: com os glifos escondidos, a amostra é
    // só preto (21:1). Sem esconder, os pixels brancos DAS LETRAS entram como
    // se fossem fundo, e a medida cai para 1:1 — o medidor que não esconde
    // reprova um texto perfeito, ou, pior, aprova um ruim por acaso.
    const fundoLimpo: Cor[] = Array.from({ length: 100 }, (): Cor => PRETO);
    const comGlifos: Cor[] = [...fundoLimpo.slice(0, 80), ...Array.from({ length: 20 }, (): Cor => BRANCO)];
    expect(menorRazao([255, 255, 255, 1], fundoLimpo)).toBeCloseTo(21, 5);
    expect(menorRazao([255, 255, 255, 1], comGlifos)).toBeCloseTo(1, 5);
  });
});

describe("limite por tamanho", () => {
  it.each([
    [16, false, 4.5],
    [18, true, 4.5],
    [18.66, true, 3],
    [24, false, 3],
    [36, true, 3],
  ])("%spx negrito=%s → %s:1", (px, negrito, limite) => {
    expect(limiteDoTexto(px, negrito)).toBe(limite);
  });
});

describe("faixa (borda ou anel de foco) contra os vizinhos", () => {
  it("borda clara entre dois escuros: a razão é a do pior vizinho", () => {
    const fora: Cor = [20, 20, 20];
    const borda: Cor = [150, 150, 150];
    const dentro: Cor = [40, 40, 40];
    const linha = [fora, fora, fora, borda, dentro, dentro];
    expect(razaoDaFaixa(linha)).toBeCloseTo(Math.min(razao(borda, fora), razao(borda, dentro)), 5);
  });

  it("anel com afastamento: o vizinho de dentro é o afastamento, não o botão", () => {
    const fundo: Cor = [10, 13, 16];
    const anel: Cor = [255, 255, 255];
    const botao: Cor = [185, 229, 43];
    const linha = [fundo, fundo, anel, anel, anel, fundo, fundo, botao, botao];
    expect(razaoDaFaixa(linha)).toBeCloseTo(razao(anel, fundo), 5);
  });

  it("borda que some no fundo reprova", () => {
    const fundo: Cor = [30, 30, 30];
    const borda: Cor = [45, 45, 45];
    const r = razaoDaFaixa([fundo, fundo, borda, fundo, fundo]);
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(3);
  });

  it("sem vizinho dos dois lados: inconclusivo (null), nunca aprovado", () => {
    expect(razaoDaFaixa([[0, 0, 0], [255, 255, 255]])).toBeNull();
    expect(razaoDaFaixa([[0, 0, 0], [0, 0, 0], [255, 255, 255]])).toBeNull();
  });
});
