import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./bottom-nav";

/**
 * DEF-011 (2026-08-26) — **as provas da barra que prendia o professor.**
 *
 * O que aconteceu em produção: o professor entrou em `/perfil` para trocar
 * a própria foto, recebeu a barra do **aluno**, e ficou preso. Os cinco
 * itens dela são `@Roles('aluno')` no servidor, e `/minhas-turmas` — a tela
 * dele — não estava na barra. Cada toque levava a "Sua conta não tem acesso
 * a esta área", e não havia caminho de volta.
 *
 * O que estes testes guardam é que a barra **nunca ofereça o que o servidor
 * recusa**. É a regra que já estava escrita num comentário de
 * `minhas-turmas-view` e que este componente não conhecia.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/perfil",
}));

/** As rotas que o servidor recusa para `professor` — todas `@Roles('aluno')`. */
const PROIBIDAS_AO_PROFESSOR = [
  "/home",
  "/minhas-aulas",
  "/quadras",
  "/reservas",
];

const hrefs = () =>
  screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => h !== null);

describe("DEF-011 — a barra do professor", () => {
  it("NÃO oferece nenhuma rota que o servidor recusa", () => {
    render(<BottomNav papel="professor" />);

    for (const proibida of PROIBIDAS_AO_PROFESSOR) {
      expect(hrefs()).not.toContain(proibida);
    }
  });

  it("oferece o caminho de volta para as turmas — o que faltava", () => {
    // Era esta ausência que fazia "ficar preso": a tela do professor não
    // estava na barra que a própria tela dele vizinha renderizava.
    render(<BottomNav papel="professor" />);
    expect(hrefs()).toContain("/minhas-turmas");
  });

  it("oferece o perfil, que é a outra coisa que ele alcança", () => {
    render(<BottomNav papel="professor" />);
    expect(hrefs()).toContain("/perfil");
  });

  it("NÃO tem o botão de reservar", () => {
    // Botão grande no meio que leva a 403 é pior que botão nenhum: convida.
    render(<BottomNav papel="professor" />);
    expect(
      screen.queryByLabelText("Reservar quadra"),
    ).not.toBeInTheDocument();
  });

  it("todo item que ela mostra é alcançável pelo professor", () => {
    // O outro lado da primeira asserção, e o mais durável: em vez de listar
    // o que não pode, exige que TUDO que aparece esteja na lista do que
    // pode. Um item novo errado cai aqui sem ninguém atualizar nada.
    const ALCANCAVEIS = ["/minhas-turmas", "/perfil"];
    render(<BottomNav papel="professor" />);

    expect(hrefs().length).toBeGreaterThan(0);
    for (const href of hrefs()) {
      expect(ALCANCAVEIS).toContain(href);
    }
  });
});

describe("a barra do aluno não mudou", () => {
  it("mantém os cinco destinos", () => {
    render(<BottomNav papel="aluno" />);

    for (const destino of PROIBIDAS_AO_PROFESSOR) {
      expect(hrefs()).toContain(destino);
    }
    expect(screen.getByLabelText("Reservar quadra")).toBeInTheDocument();
  });

  it("sem papel, desenha a do aluno", () => {
    // O estado de carregamento: `getMe()` ainda não voltou. Aluno é a
    // maioria, e trocar cinco itens por dois depois que a tela desenhou
    // pisca mais do que o contrário.
    render(<BottomNav />);
    expect(hrefs()).toContain("/quadras");
  });

  it("company_admin e super_admin também caem na do aluno", () => {
    // Declarado, não esquecido: eles não usam este app. Se um dia usarem, é
    // aqui que a decisão precisa ser tomada — e este teste vai estar errado,
    // que é o jeito certo de uma decisão pendente se anunciar.
    render(<BottomNav papel="company_admin" />);
    expect(hrefs()).toContain("/quadras");
  });
});
