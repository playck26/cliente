import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EscolhaDeEmpresa } from "./escolha-de-empresa";
import type { OpcaoDeEmpresa } from "@/lib/api-client";

/**
 * SPEC-086/AC-014 e AC-016 (a parte que o DOM prova) — **o cartão de cada
 * clube.** A prova visual em navegador (360 px, foto, contraste) é o roteiro
 * manual do `CLI_AUDIT.md`; aqui fica o que não depende de layout: logo ou
 * inicial, nome inteiro (sem corte), papel, a vencida sem botão, e a ordem do
 * teclado.
 */

const NOME_LONGO = "Associação Esportiva de Tênis do Vale Verde"; // 43 caracteres

const OPCOES: OpcaoDeEmpresa[] = [
  {
    usuarioId: "u-a",
    empresaNome: "Smart Tennis",
    logoUrl: "https://cdn.exemplo/logo-a.webp",
    papel: "aluno",
    situacao: "disponivel",
  },
  {
    usuarioId: "u-b",
    empresaNome: NOME_LONGO,
    logoUrl: null,
    papel: "professor",
    situacao: "disponivel",
  },
  {
    usuarioId: "u-c",
    empresaNome: "Clube Antigo",
    logoUrl: null,
    papel: "aluno",
    situacao: "senha_expirada",
  },
];

function montar(entrando: string | null = null) {
  const onEscolher = vi.fn();
  const onVoltar = vi.fn();
  render(
    <EscolhaDeEmpresa
      empresas={OPCOES}
      entrando={entrando}
      onEscolher={onEscolher}
      onVoltar={onVoltar}
    />,
  );
  return { onEscolher, onVoltar };
}

describe("SPEC-086 — EscolhaDeEmpresa", () => {
  it("com logo, a imagem do servidor; sem logo, a inicial do clube", () => {
    montar();
    const comLogo = screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" });
    expect(comLogo.querySelector("img")).toHaveAttribute("src", "https://cdn.exemplo/logo-a.webp");

    const semLogo = screen.getByRole("button", { name: `Entrar em ${NOME_LONGO}, como Professor` });
    expect(semLogo.querySelector("img")).toBeNull();
    expect(within(semLogo).getByText("A")).toBeInTheDocument();
  });

  it("o nome longo aparece inteiro e quebra em linhas (nada de reticências)", () => {
    montar();
    const nome = screen.getByText(NOME_LONGO);
    expect(nome.textContent).toBe(NOME_LONGO);
    expect(nome.className).toContain("break-words");
    expect(nome.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("a vencida não é botão e não chama a escolha", () => {
    const { onEscolher } = montar();
    expect(screen.queryByRole("button", { name: /Clube Antigo/ })).toBeNull();
    expect(screen.getByText("Senha expirada — peça uma nova ao gestor.")).toBeInTheDocument();
    expect(onEscolher).not.toHaveBeenCalled();
  });

  it("teclado: os clubes disponíveis e 'Usar outro e-mail' são botões nativos, focáveis, nessa ordem", () => {
    // Sem `@testing-library/user-event` no projeto: o que o DOM garante é que
    // cada destino é um <button> de verdade (Tab e Enter/Espaço vêm do
    // navegador) e a ordem do DOM é a do foco. A navegação real por teclado é
    // conferida no roteiro manual do AC-016.
    const { onEscolher } = montar();
    const focaveis = Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], [tabindex]"),
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0);
    expect(focaveis.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim())).toEqual([
      "Entrar em Smart Tennis, como Aluno",
      `Entrar em ${NOME_LONGO}, como Professor`,
      "Usar outro e-mail",
    ]);
    for (const el of focaveis) {
      expect(el.tagName).toBe("BUTTON");
      expect(el).toHaveAttribute("type", "button");
    }
    focaveis[1].focus();
    expect(focaveis[1]).toHaveFocus();
    focaveis[1].click();
    expect(onEscolher).toHaveBeenCalledWith("u-b");
  });

  it("entrando: todos os botões desabilitados, e o escolhido diz 'Entrando...'", () => {
    montar("u-a");
    for (const botao of screen.getAllByRole("button")) expect(botao).toBeDisabled();
    expect(
      within(screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" })).getByText(
        "Entrando...",
      ),
    ).toBeInTheDocument();
  });
});
