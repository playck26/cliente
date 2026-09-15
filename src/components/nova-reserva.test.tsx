import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NovaReserva } from "./nova-reserva";

/**
 * SPEC-053/D3 — **`/reservas/nova`: escolher o tipo antes do horário.**
 *
 * As abas "Quadras" e "Aula particular" saíram de `/reservas` — que passa a ser
 * o lugar de ACOMPANHAR — e viraram os dois cartões desta página, o lugar de
 * CONTRATAR. Os painéis são reusados como estão; muda onde moram.
 *
 * Os painéis são mockados de propósito: o que está em julgamento é qual deles
 * a página monta para cada `tipo`, não o que eles mostram — têm provas próprias.
 */

vi.mock("@/components/courts-list", () => ({
  CourtsList: () => <div data-testid="lista-de-quadras" />,
}));
vi.mock("@/components/aula-particular", () => ({
  AulaParticular: () => <div data-testid="aula-particular" />,
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));
vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

const lerNomesDeTipo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/nomes-de-tipo", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/nomes-de-tipo")>("@/lib/nomes-de-tipo");
  return { ...real, lerNomesDeTipo };
});

beforeEach(() => {
  lerNomesDeTipo.mockReset();
  lerNomesDeTipo.mockResolvedValue({ quadra: "Quadra", aula: "Aula particular" });
});

describe("NovaReserva — SPEC-053/D3", () => {
  it("AC-004: sem tipo, mostra os dois cartões, cada um com o seu endereço", () => {
    render(<NovaReserva tipo={null} />);

    expect(screen.getByRole("link", { name: /Quadra/ })).toHaveAttribute(
      "href",
      "/reservas/nova?tipo=quadra",
    );
    expect(
      screen.getByRole("link", { name: /Aula particular/ }),
    ).toHaveAttribute("href", "/reservas/nova?tipo=aula");
    expect(screen.queryByTestId("lista-de-quadras")).not.toBeInTheDocument();
    expect(screen.queryByTestId("aula-particular")).not.toBeInTheDocument();
  });

  it("AC-005: ?tipo=quadra monta a lista de quadras, e só ela", () => {
    render(<NovaReserva tipo="quadra" />);

    expect(screen.getByTestId("lista-de-quadras")).toBeInTheDocument();
    expect(screen.queryByTestId("aula-particular")).not.toBeInTheDocument();
  });

  it("AC-005: ?tipo=aula monta a escolha de professor, e só ela", () => {
    render(<NovaReserva tipo="aula" />);

    expect(screen.getByTestId("aula-particular")).toBeInTheDocument();
    expect(screen.queryByTestId("lista-de-quadras")).not.toBeInTheDocument();
  });

  it("AC-005: tipo desconhecido mostra os cartões, e SEM mensagem de erro", () => {
    // Endereço editado à mão ou link velho: punir com erro um endereço que
    // NÓS mudamos seria o pior dos dois mundos (a regra da SPEC-022).
    render(<NovaReserva tipo="outro" />);

    expect(screen.getByRole("link", { name: /Quadra/ })).toBeInTheDocument();
    expect(screen.queryByTestId("lista-de-quadras")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("com um tipo escolhido, dá o caminho de volta para os cartões", () => {
    render(<NovaReserva tipo="quadra" />);

    expect(
      screen.getByRole("link", { name: /Trocar o tipo/ }),
    ).toHaveAttribute("href", "/reservas/nova");
  });
});

/**
 * SPEC-054/D1 e D12 — **o nome que o clube deu a cada tipo.**
 *
 * O gestor dá nome; não inventa regra. O endereço (`?tipo=quadra`) não muda —
 * é o comportamento, que é código —, só o texto que o aluno lê.
 */
describe("NovaReserva — SPEC-054: os nomes do clube", () => {
  it("os cartões usam os nomes configurados, com os mesmos endereços", async () => {
    lerNomesDeTipo.mockResolvedValue({ quadra: "Espaço", aula: "Aula com professor" });
    render(<NovaReserva tipo={null} />);

    expect(await screen.findByRole("link", { name: /Espaço/ })).toHaveAttribute(
      "href",
      "/reservas/nova?tipo=quadra",
    );
    expect(
      screen.getByRole("link", { name: /Aula com professor/ }),
    ).toHaveAttribute("href", "/reservas/nova?tipo=aula");
    expect(screen.queryByText("Aula particular")).not.toBeInTheDocument();
  });

  it("enquanto os nomes não chegam, os cartões já estão lá com os padrões", () => {
    lerNomesDeTipo.mockReturnValue(new Promise(() => undefined));
    render(<NovaReserva tipo={null} />);
    // O nome é apresentação: o caminho que a pessoa veio buscar não espera por ele.
    expect(screen.getByRole("link", { name: /Quadra/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aula particular/ })).toBeInTheDocument();
  });
});
