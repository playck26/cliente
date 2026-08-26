import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapaDaQuadra } from "./capa-da-quadra";

/**
 * SPEC-018/TASK-005 — **as provas da capa, e por que elas existem tarde.**
 *
 * A TASK-005 subiu em 2026-08-26 com o upload no Admin e a rota no `back`,
 * e **sem nada neste repositório**. O gestor subia a foto, o servidor
 * devolvia `imagemUrl`, e o app do aluno continuava desenhando as linhas
 * sintéticas — justamente para quem a spec dizia que ia ver.
 *
 * O que estes testes guardam é a única decisão que a capa toma: **foto
 * quando há, desenho quando não**, e o texto branco legível nos dois casos.
 */

const URL = "https://cdn.exemplo/empresas/x/quadra/y/abc.webp";

describe("a foto, quando existe", () => {
  it("desenha a imagem que o servidor mandou", () => {
    render(<CapaDaQuadra imagemUrl={URL} nome="Quadra 2" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", URL);
  });

  it("o alt nomeia a quadra — a foto é do produto, não decoração", () => {
    render(<CapaDaQuadra imagemUrl={URL} nome="Quadra 2" />);
    expect(screen.getByAltText("Foto da Quadra 2")).toBeInTheDocument();
  });

  it("vem com o degradê, senão o preço e o nome somem sobre foto clara", () => {
    // O preço e o nome são texto BRANCO por cima. Sobre as linhas
    // sintéticas o fundo é uma cor escolhida por nós; sobre a foto que o
    // clube subiu não há garantia nenhuma. Sem o degradê, uma quadra clara
    // ao meio-dia apaga os dois.
    const { container } = render(
      <CapaDaQuadra imagemUrl={URL} nome="Quadra 2" />,
    );
    const scrim = container.querySelector('[aria-hidden="true"]');
    expect(scrim).not.toBeNull();
    expect(scrim?.className).toContain("bg-gradient-to-t");
  });

  it("a foto cobre a área sem distorcer", () => {
    // `object-cover` e não `fill`: foto de celular é 4:3 e a capa é
    // panorâmica. Esticar deformaria a quadra.
    render(<CapaDaQuadra imagemUrl={URL} nome="Quadra 2" />);
    expect(screen.getByRole("img").className).toContain("object-cover");
  });
});

describe("o desenho, quando não há foto", () => {
  it("NÃO renderiza imagem nenhuma", () => {
    // `null` é o estado normal: a maioria dos clubes ainda não subiu nada.
    render(<CapaDaQuadra imagemUrl={null} nome="Quadra 1" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("NÃO escurece: o degradê só existe por causa da foto", () => {
    // Sobre o desenho, o fundo já é a cor que escolhemos e o contraste já
    // está resolvido. Escurecer seria pagar por um problema que não há.
    const { container } = render(
      <CapaDaQuadra imagemUrl={null} nome="Quadra 1" />,
    );
    expect(
      container.querySelector(".bg-gradient-to-t"),
    ).toBeNull();
  });
});
