import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContaDaRedefinicao } from "@/lib/api-client";
import { EscolhaDeConta } from "./escolha-de-conta";

/**
 * SPEC-090 (AC-024, D9) — **a lista de contas do link de redefinição.**
 *
 * Componente próprio, e não o `EscolhaDeEmpresa` da SPEC-086: nenhum texto de
 * login aqui. O `aria-label` de cada cartão é "Redefinir a senha de …"; um
 * "Entrar em …" copiado do login (S15) fica vermelho no primeiro caso. E não
 * há botão de voltar: só os cartões são botões.
 */

const NOME_DE_40 = "Associação Esportiva de Tênis do Cerrado";

function conta(
  usuarioId: string,
  nome: string,
  papel: ContaDaRedefinicao["papel"],
  logoUrl: string | null = null,
): ContaDaRedefinicao {
  return { usuarioId, papel, empresa: { nome, logoUrl } };
}

const DUAS: ContaDaRedefinicao[] = [
  conta("11111111-1111-4111-8111-111111111111", "Clube A", "aluno", "https://cdn.exemplo/a.webp"),
  conta("22222222-2222-4222-8222-222222222222", "Clube B", "professor"),
];

const TRES: ContaDaRedefinicao[] = [
  ...DUAS,
  conta("33333333-3333-4333-8333-333333333333", NOME_DE_40, "aluno"),
];

describe("EscolhaDeConta", () => {
  it("duas contas: título, apoio e um botão por conta, com o aria-label da redefinição", () => {
    render(<EscolhaDeConta contas={DUAS} onEscolher={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Qual conta vai ter a senha redefinida?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu e-mail tem conta em mais de um clube.")).toBeInTheDocument();

    const botoes = screen.getAllByRole("button");
    expect(botoes.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Redefinir a senha de Clube A, como Aluno",
      "Redefinir a senha de Clube B, como Professor",
    ]);
    // S15: nada do texto do login.
    for (const b of botoes) {
      expect(b.getAttribute("aria-label")).not.toMatch(/^Entrar em/);
      expect(b).toHaveAttribute("type", "button");
    }
  });

  it("três contas, na ordem em que vieram, e o nome de 40 caracteres inteiro", () => {
    expect(NOME_DE_40).toHaveLength(40);
    render(<EscolhaDeConta contas={TRES} onEscolher={vi.fn()} />);

    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(itens.map((i) => within(i).getByRole("button").getAttribute("aria-label"))).toEqual([
      "Redefinir a senha de Clube A, como Aluno",
      "Redefinir a senha de Clube B, como Professor",
      `Redefinir a senha de ${NOME_DE_40}, como Aluno`,
    ]);
    expect(screen.getByText(NOME_DE_40)).toBeInTheDocument();
  });

  it("sem botão de voltar: os únicos botões são os cartões", () => {
    render(<EscolhaDeConta contas={TRES} onEscolher={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /voltar|outro e-mail/i })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Usar outro e-mail|Entrando|Em qual clube/)).toBeNull();
  });

  it("tocar num cartão escolhe aquela conta, e só ela", () => {
    const onEscolher = vi.fn();
    render(<EscolhaDeConta contas={TRES} onEscolher={onEscolher} />);

    fireEvent.click(screen.getByRole("button", { name: "Redefinir a senha de Clube B, como Professor" }));
    expect(onEscolher).toHaveBeenCalledTimes(1);
    expect(onEscolher).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
  });

  it("logo do servidor quando há, inicial quando não há; o papel de gestor tem nome", () => {
    const { container } = render(
      <EscolhaDeConta
        contas={[...DUAS, conta("44444444-4444-4444-8444-444444444444", "Clube G", "company_admin")]}
        onEscolher={vi.fn()}
      />,
    );

    const imagens = container.querySelectorAll("img");
    expect(imagens).toHaveLength(1);
    expect(imagens[0]).toHaveAttribute("src", "https://cdn.exemplo/a.webp");
    expect(
      screen.getByRole("button", { name: "Redefinir a senha de Clube G, como Gestor" }),
    ).toBeInTheDocument();
  });

  it("nome de clube com marcação aparece como texto, nunca como HTML", () => {
    const { container } = render(
      <EscolhaDeConta contas={[conta("55555555-5555-4555-8555-555555555555", '"><b>x</b>', "aluno"), DUAS[1]]} onEscolher={vi.fn()} />,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain('"><b>x</b>');
  });
});
