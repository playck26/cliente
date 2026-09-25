import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ABA_PADRAO,
  ReservasTabs,
  normalizarAbaDeReservas,
} from "./reservas-tabs";

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

// A lista e a moldura são mockadas de propósito: o que está sob teste aqui é
// a aba, não o que ela mostra. A lista tem as provas dela.
// SPEC-053: `aba` vira atributo para as provas saberem QUAL aba montou a lista.
vi.mock("@/components/my-bookings-list", () => ({
  MyBookingsList: ({ aba }: { aba?: string }) => (
    <div data-testid="lista-de-reservas" data-aba={aba} />
  ),
}));
// SPEC-074: os avisos de horário também são mockados — o que está em teste aqui
// é EM QUAL aba eles aparecem, não o que mostram (a lista tem as provas dela).
vi.mock("@/components/avisos-de-horario", () => ({
  AvisosDeHorario: () => <div data-testid="avisos-de-horario" />,
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

  it("SPEC-053: ?aba=quadras cai na aba padrão — o redirecionamento acontece antes, no servidor", () => {
    // A página `/reservas` manda `?aba=quadras` para `/reservas/nova?tipo=quadra`
    // com 308 (`app/reservas/redirecionamentos.test.tsx`). Se o componente
    // chegar a ver o parâmetro, não pode montar uma aba que não existe mais.
    params.valor = "aba=quadras";
    render(<ReservasTabs />);

    expect(screen.getByTestId("lista-de-reservas")).toHaveAttribute(
      "data-aba",
      "reservas",
    );
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
  it("ir para Anteriores empurra a URL com o parâmetro", () => {
    // `push` e não `replace`: é o que dá ao botão "voltar" o que desfazer.
    render(<ReservasTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Anteriores" }));

    expect(push).toHaveBeenCalledWith("/reservas?aba=anteriores", {
      scroll: false,
    });
  });

  it("voltar para Reservas usa a URL limpa, sem parâmetro", () => {
    params.valor = "aba=anteriores";
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
    expect(screen.getByRole("tab", { name: "Anteriores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("SPEC-053/AC-006: exatamente as abas Reservas e Anteriores, e o rótulo da barra é \"Suas reservas\"", () => {
    // O nome e o corte da primeira aba são da SPEC-041/D-I4 e NÃO mudam: a
    // reserva em andamento fica em "Reservas" até terminar (a lista pede
    // `quando=futuras`, cortado pelo FIM — `my-bookings-list.test.tsx`).
    render(<ReservasTabs />);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Reservas",
      "Anteriores",
    ]);
    expect(screen.getByRole("tablist", { name: "Suas reservas" })).toBeInTheDocument();
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
    expect(normalizarAbaDeReservas("anteriores")).toBe("anteriores");
    expect(normalizarAbaDeReservas("reservas")).toBe("reservas");
    // SPEC-053: as abas de contratar saíram — viraram `/reservas/nova`.
    expect(normalizarAbaDeReservas("quadras")).toBe(ABA_PADRAO);
    expect(normalizarAbaDeReservas("aula")).toBe(ABA_PADRAO);
    expect(normalizarAbaDeReservas(null)).toBe(ABA_PADRAO);
    expect(normalizarAbaDeReservas("")).toBe(ABA_PADRAO);
    expect(normalizarAbaDeReservas("ANTERIORES")).toBe(ABA_PADRAO);
    expect(normalizarAbaDeReservas("anteriores ")).toBe(ABA_PADRAO);
  });
});

describe("SPEC-074/D10 — os avisos de horário moram na aba Reservas", () => {
  it("aparecem em Reservas", () => {
    render(<ReservasTabs />);
    expect(screen.getByTestId("avisos-de-horario")).toBeInTheDocument();
  });

  it("NÃO aparecem em Anteriores, que é histórico", () => {
    params.valor = "aba=anteriores";
    render(<ReservasTabs />);
    expect(screen.queryByTestId("avisos-de-horario")).not.toBeInTheDocument();
  });
});
