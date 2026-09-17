import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TelaDeAulas } from "./tela-de-aulas";

/**
 * SPEC-057/TASK-002/D11 (card 5352) — **as abas saíram, e nada se perdeu.**
 *
 * O veredito independente derrubou a primeira versão desta decisão com um
 * achado concreto (B02): aquelas três abas **não eram três vistas do mesmo
 * dado**. "Turmas" era o único lugar do produto onde o aluno entra e sai de
 * turma; "Anteriores", o único de onde ele avalia uma aula passada.
 *
 * O Israel decidiu *"refazer os caminhos antes de tirar"*. Estas provas são
 * disso: **a barra de abas não existe mais, e os dois destinos continuam
 * alcançáveis**.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/minhas-aulas",
  useSearchParams: () => new URLSearchParams(),
}));

const listMyClasses = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listMyClasses,
    getMinhaEmpresa: () =>
      Promise.resolve({
        nome: "Smart Tennis",
        slug: "smart-tennis",
        logoUrl: null,
        status: "ativa",
        permiteAutoCadastro: true,
      }),
  };
});

describe("TelaDeAulas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyClasses.mockResolvedValue([]);
  });

  it("não tem mais a barra de abas", async () => {
    render(<TelaDeAulas />);

    await screen.findByText("Turmas do clube");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  /** **O que a remoção das abas não pode ter apagado.** */
  it("o catálogo de turmas continua alcançável", async () => {
    render(<TelaDeAulas />);

    const link = await screen.findByRole("link", { name: /Turmas do clube/ });
    expect(link).toHaveAttribute("href", "/minhas-aulas/turmas");
  });

  it("a avaliação de aula passada continua alcançável", async () => {
    render(<TelaDeAulas />);

    const link = await screen.findByRole("link", {
      name: /Aulas que já passaram/,
    });
    expect(link).toHaveAttribute("href", "/minhas-aulas/anteriores");
  });

  it("e os dois dizem para que servem, não só para onde vão", async () => {
    render(<TelaDeAulas />);

    expect(
      await screen.findByText(/entre numa nova/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/avalie suas aulas/i)).toBeInTheDocument();
  });
});
