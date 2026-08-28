import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ABA_PADRAO, ReservasTabs, normalizarAba } from "./reservas-tabs";

/**
 * SPEC-022 — **as provas da aba única de Reservas.**
 *
 * O que estas provas guardam é o contrato da URL, não o desenho: qual aba
 * abre, o que acontece com valor estranho, e que trocar de aba deixa
 * rastro no histórico. O desenho ("bacana com um layout bonito") é a
 * LIM-022b, e está declarado na spec como **não** coberto por teste — é
 * revisão visual do Israel, e dizer isso é mais honesto que fingir que uma
 * asserção de classe CSS prova beleza.
 */

const push = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ valor: null as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(params.valor ?? ""),
  usePathname: () => "/reservas",
}));

// As duas listas e a moldura são mockadas de propósito: o que está sob teste
// aqui é a aba, não o que ela mostra. As listas têm as provas delas.
vi.mock("@/components/courts-list", () => ({
  CourtsList: () => <div data-testid="lista-de-quadras" />,
}));
vi.mock("@/components/my-bookings-list", () => ({
  MyBookingsList: () => <div data-testid="lista-de-reservas" />,
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));
vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  params.valor = null;
});

describe("REQ-003 — qual aba abre", () => {
  it("sem parâmetro, abre as minhas reservas", () => {
    render(<ReservasTabs />);

    expect(screen.getByTestId("lista-de-reservas")).toBeInTheDocument();
    expect(screen.queryByTestId("lista-de-quadras")).not.toBeInTheDocument();
  });

  it("com ?aba=quadras, abre as quadras", () => {
    params.valor = "aba=quadras";
    render(<ReservasTabs />);

    expect(screen.getByTestId("lista-de-quadras")).toBeInTheDocument();
    expect(screen.queryByTestId("lista-de-reservas")).not.toBeInTheDocument();
  });

  it("valor desconhecido cai na aba padrão, e SEM mensagem de erro", () => {
    // URL editada à mão ou link velho. Punir a pessoa com um erro por um
    // endereço que NÓS mudamos seria o pior dos dois mundos.
    params.valor = "aba=lixo";
    render(<ReservasTabs />);

    expect(screen.getByTestId("lista-de-reservas")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("REQ-005 — trocar de aba é navegar", () => {
  it("ir para Quadras empurra a URL com o parâmetro", () => {
    // `push` e não `replace`: é o que dá ao botão "voltar" o que desfazer.
    render(<ReservasTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Quadras" }));

    expect(push).toHaveBeenCalledWith("/reservas?aba=quadras", {
      scroll: false,
    });
  });

  it("voltar para Reservas usa a URL limpa, sem parâmetro", () => {
    params.valor = "aba=quadras";
    render(<ReservasTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Reservas" }));

    expect(push).toHaveBeenCalledWith("/reservas", { scroll: false });
  });

  it("tocar na aba que já está aberta não empilha histórico", () => {
    render(<ReservasTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Reservas" }));

    expect(push).not.toHaveBeenCalled();
  });
});

describe("acessibilidade das abas", () => {
  it("marca qual está selecionada", () => {
    render(<ReservasTabs />);

    expect(screen.getByRole("tab", { name: "Reservas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Quadras" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});

/**
 * **A prova de sabotagem (item 7 das provas exigidas da spec).**
 *
 * Não basta a prova passar; ela precisa quebrar quando a coisa quebra. Se
 * `ABA_PADRAO` deixar de ser `"reservas"`, a primeira prova deste arquivo
 * tem de cair junto. Esta asserção existe para que essa dependência seja
 * explícita em vez de implícita.
 */
describe("a prova olha para o que diz olhar", () => {
  it("a aba padrão é a de reservas, e é dela que a primeira prova depende", () => {
    expect(ABA_PADRAO).toBe("reservas");
  });

  it("normalizarAba só aceita os dois valores conhecidos", () => {
    expect(normalizarAba("quadras")).toBe("quadras");
    expect(normalizarAba("reservas")).toBe("reservas");
    expect(normalizarAba(null)).toBe(ABA_PADRAO);
    expect(normalizarAba("")).toBe(ABA_PADRAO);
    expect(normalizarAba("QUADRAS")).toBe(ABA_PADRAO);
    expect(normalizarAba("quadras ")).toBe(ABA_PADRAO);
  });
});
