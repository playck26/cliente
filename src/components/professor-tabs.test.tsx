import { describe, expect, it } from "vitest";
import {
  ABA_PADRAO_DO_PROFESSOR,
  normalizarAbaDoProfessor,
} from "./professor-tabs";

/**
 * SPEC-027 — **a ordem das abas do professor, e ela é um pedido do Israel.**
 *
 * *"No painel do professor, altere a ordem das abas, Minhas turmas deve
 * aparecer primeiro, à esquerda."*
 *
 * Com a ordem veio a aba padrão: a primeira à esquerda é o que a barra
 * comunica como início, e uma barra cuja primeira aba não é a que abre
 * confunde sem ganhar nada.
 *
 * O que **não** se perdeu: a Agenda continua a um toque, e `?aba=agenda` na
 * URL segue abrindo direto nela. A decisão da SPEC-026 — que o professor
 * pudesse começar pelo **dia**, e não pela turma — sobrevive como caminho,
 * deixando de ser o padrão.
 */
describe("a ordem das abas do professor", () => {
  it("a padrão é `turmas` — a primeira à esquerda", () => {
    expect(ABA_PADRAO_DO_PROFESSOR).toBe("turmas");
  });

  it("`?aba=agenda` continua abrindo a agenda", () => {
    // A metade que garante que mudar o padrão não fechou a porta: quem tem o
    // link da agenda salvo continua chegando nela.
    expect(normalizarAbaDoProfessor("agenda")).toBe("agenda");
  });

  it("`?aba=turmas` abre as turmas", () => {
    expect(normalizarAbaDoProfessor("turmas")).toBe("turmas");
  });

  it("valor desconhecido cai na padrão em vez de quebrar", () => {
    expect(normalizarAbaDoProfessor("agendaX")).toBe("turmas");
  });

  it("sem parâmetro nenhum, a padrão", () => {
    expect(normalizarAbaDoProfessor(null)).toBe("turmas");
  });
});
