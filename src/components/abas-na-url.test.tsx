import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BarraDeAbas, useAbaAtiva, type AbaDaTela } from "./abas-na-url";

/**
 * **SPEC-041/B3 — as provas do helper de abas, que ele nunca teve.**
 *
 * Ele governa três telas (`/reservas`, `/minhas-aulas`, a do professor) e só
 * era exercitado de lado, pelas provas dessas telas. Nenhuma delas punha um
 * segundo parâmetro na URL — e foi por isso que **ele apagava a query inteira
 * em produção sem ninguém notar**: `/minhas-aulas?aba=minhas&vista=semana`
 * perdia o `vista` ao trocar de aba.
 *
 * O ramo do padrão era o pior dos dois, e é o que a segunda prova cobre:
 * voltar para a aba inicial empurrava o caminho **pelado**.
 */

const push = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ valor: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(params.valor),
  usePathname: () => "/tela",
}));

const ABAS = [
  { id: "primeira", rotulo: "Primeira" },
  { id: "segunda", rotulo: "Segunda" },
] as const satisfies readonly AbaDaTela<"primeira" | "segunda">[];

function Tela() {
  const { ativa, irPara } = useAbaAtiva(ABAS, "primeira", "/tela");
  return (
    <BarraDeAbas abas={ABAS} ativa={ativa} onTrocar={irPara} rotulo="Abas" />
  );
}

function trocarPara(rotulo: string) {
  render(<Tela />);
  fireEvent.click(screen.getByRole("tab", { name: rotulo }));
}

describe("useAbaAtiva — a aba mora na URL", () => {
  beforeEach(() => {
    push.mockReset();
    params.valor = "";
  });

  it("sem parâmetro, a aba padrão está ativa", () => {
    render(<Tela />);
    expect(screen.getByRole("tab", { name: "Primeira" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("valor desconhecido cai no padrão, em silêncio", () => {
    // URL editada à mão ou link velho. Punir a pessoa por um endereço que nós
    // mudamos seria o pior dos dois mundos.
    params.valor = "aba=inexistente";
    render(<Tela />);
    expect(screen.getByRole("tab", { name: "Primeira" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("a aba padrão sai do endereço, em vez de virar ?aba=padrao", () => {
    params.valor = "aba=segunda";
    trocarPara("Primeira");
    expect(push).toHaveBeenCalledWith("/tela", { scroll: false });
  });

  it("clicar na aba já ativa não empurra nada", () => {
    trocarPara("Primeira");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("useAbaAtiva — o resto da query sobrevive (SPEC-041/B3)", () => {
  beforeEach(() => {
    push.mockReset();
    params.valor = "";
  });

  /**
   * **O defeito, e ele estava em produção.** O helper reconstruía a URL só
   * com `aba`, então qualquer outro parâmetro sumia na troca.
   */
  it("trocar de aba preserva os outros parâmetros", () => {
    params.valor = "vista=semana&status=cancelado";
    trocarPara("Segunda");

    const [url] = push.mock.calls[0] as [string];
    const query = new URLSearchParams(url.split("?")[1]);
    expect(query.get("aba")).toBe("segunda");
    expect(query.get("vista")).toBe("semana");
    expect(query.get("status")).toBe("cancelado");
  });

  /**
   * **O ramo do padrão era o pior dos dois**, e é o que ninguém testava:
   * voltar para a aba inicial empurrava `/tela` pelado, levando tudo junto.
   */
  it("voltar para a aba padrão tira só o `aba`, não a query inteira", () => {
    params.valor = "aba=segunda&vista=semana";
    trocarPara("Primeira");

    const [url] = push.mock.calls[0] as [string];
    expect(url).toBe("/tela?vista=semana");
  });

  it("sem outros parâmetros, o endereço da aba padrão continua limpo", () => {
    // O contraponto: preservar não pode virar `?` sobrando no endereço que a
    // pessoa copia.
    params.valor = "aba=segunda";
    trocarPara("Primeira");
    expect(push).toHaveBeenCalledWith("/tela", { scroll: false });
  });
});
