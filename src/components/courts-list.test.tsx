import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Court } from "@/lib/api-client";
import { CourtsList } from "./courts-list";

/**
 * A lista de quadras do aluno (SPEC-020/TASK-006), e o defeito que este
 * arquivo nasceu para reproduzir.
 *
 * **DEF-012 — o app do aluno quebrou em produção.** A TASK-003 trocou
 * `quadra.esporte` de `string` para `{ id, nome } | null`, e três telas do
 * Cliente renderizavam a string direto. Objeto como filho de JSX faz o React
 * estourar *"Objects are not valid as a React child"* — tela em branco, não
 * texto errado.
 *
 * **Por que o typecheck não pegou:** a interface `Court` é escrita à mão em
 * `api-client.ts`. Ela dizia `esporte: string` e continuou dizendo depois que
 * o contrato mudou — um tipo local não é um contrato, é uma afirmação sobre
 * ele. O Admin pegou o mesmo tipo de erro no mesmo dia porque lá os tipos são
 * **gerados** do `openapi.json`.
 *
 * **E por que o teste que existia não pegou:** `my-bookings-list.test.tsx`
 * mocka `listCourts` com `data: []`. Lista vazia nunca chega ao ponto que
 * renderiza o esporte.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/quadras",
}));

vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const listCourtsMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listCourts: (...a: unknown[]) => listCourtsMock(...a) };
});

/**
 * O formato REAL que o `back` devolve desde a TASK-003 — e desde a
 * SPEC-021/INV-059 isso não é mais uma afirmação deste arquivo: o
 * `satisfies Court` amarra a fixture ao schema publicado.
 *
 * **Por que amarrar a FIXTURE, e não só o tipo.** `Court` já era apelido do
 * contrato desde o DEF-012, e mesmo assim uma mudança de forma passava calada
 * aqui: um literal solto não é confrontado com nada. Provado por sabotagem no
 * SAdmin em 2026-08-27 — trocar `string[]` por objetos no schema deixou o
 * typecheck verde, porque a tela chamava `.join()`, que existe em qualquer
 * array.
 *
 * Com `satisfies`, **a fixture é que fica vermelha** quando o `back` muda a
 * forma. E é o lugar certo para o vermelho aparecer: este arquivo é a
 * descrição do que a tela espera receber.
 */
function quadra(
  nome: string,
  esporte: Court["esporte"],
  categoria: Court["categoria"] = null,
): Court {
  return {
    id: `q-${nome}`,
    companyId: "c1",
    nome,
    esporte,
    categoria,
    precoHora: 100,
    status: "ativa" as const,
    createdAt: "2026-08-26T00:00:00.000Z",
    imagemUrl: null,
  } satisfies Court;
}

const TENIS = { id: "e1", nome: "Tênis" };
const PADEL = { id: "e2", nome: "Padel" };
const SAIBRO = { id: "c1", nome: "Saibro" };
const SINTETICO = { id: "c2", nome: "Sintético" };

function responder(quadras: ReturnType<typeof quadra>[]) {
  listCourtsMock.mockResolvedValue({
    data: quadras,
    page: 1,
    pageSize: 20,
    total: quadras.length,
  });
}

beforeEach(() => {
  listCourtsMock.mockReset();
});

describe("CourtsList — DEF-012, o esporte virou objeto", () => {
  it("renderiza o NOME do esporte, não o objeto", async () => {
    // Este é o teste que reproduz o defeito. Antes do conserto ele não
    // falha por texto errado: o `render` estoura.
    responder([quadra("Quadra 1", TENIS)]);

    render(<CourtsList />);

    await waitFor(() => {
      expect(screen.getByText("Quadra 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Tênis")).toBeInTheDocument();
  });

  it("quadra sem esporte não quebra a tela", async () => {
    // `esporte: null` acontece de verdade: quadra cujo texto estava em
    // branco quando o backfill da TASK-001 rodou. A TASK-004 vai cobrar,
    // mas até lá a tela precisa aguentar.
    responder([quadra("Sem esporte", null)]);

    render(<CourtsList />);

    await waitFor(() => {
      expect(screen.getByText("Sem esporte")).toBeInTheDocument();
    });
  });
});

describe("CourtsList — o filtro (SPEC-020/TASK-006)", () => {
  it("AC-008: só vira filtro o que tem quadra", async () => {
    // O catálogo do clube pode ter seis esportes. A barra mostra os que
    // aparecem nas quadras carregadas — porque ela é DERIVADA delas, e é
    // assim que a AC-008 sai de graça sem uma segunda requisição (NFR-001).
    responder([quadra("Q1", TENIS), quadra("Q2", TENIS)]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    // Um só esporte não é escolha: a barra inteira some.
    expect(
      screen.queryByRole("group", { name: /esporte/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Padel" })).not.toBeInTheDocument();
  });

  it("o mesmo esporte em duas quadras vira UM filtro", async () => {
    responder([
      quadra("Q1", TENIS),
      quadra("Q2", TENIS),
      quadra("Q3", PADEL),
    ]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    expect(screen.getAllByRole("button", { name: "Tênis" })).toHaveLength(1);
  });

  it("filtra por esporte", async () => {
    responder([quadra("Q1", TENIS), quadra("Q2", PADEL)]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Padel" }));

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });

  it("filtra por categoria", async () => {
    responder([
      quadra("Q1", TENIS, SAIBRO),
      quadra("Q2", TENIS, SINTETICO),
    ]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Saibro" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("Q2")).not.toBeInTheDocument();
  });

  it("AC-009: os dois filtros se combinam por INTERSEÇÃO", async () => {
    // A quadra que sobrevive é a que atende aos dois ao mesmo tempo.
    // Se o código usasse OU em vez de E, Q2 e Q3 também apareceriam.
    responder([
      quadra("Q1", TENIS, SAIBRO),
      quadra("Q2", TENIS, SINTETICO),
      quadra("Q3", PADEL, SAIBRO),
    ]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Tênis" }));
    fireEvent.click(screen.getByRole("button", { name: "Saibro" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("Q2")).not.toBeInTheDocument();
    expect(screen.queryByText("Q3")).not.toBeInTheDocument();
  });

  it("a interseção pode ser vazia, e a tela diz isso", async () => {
    responder([quadra("Q1", TENIS, SAIBRO), quadra("Q2", PADEL, SINTETICO)]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Q1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Tênis" }));
    fireEvent.click(screen.getByRole("button", { name: "Sintético" }));

    expect(screen.getByText(/Nenhuma quadra encontrada/i)).toBeInTheDocument();
  });

  it("quadra sem categoria some ao filtrar por categoria, e volta em Todas", async () => {
    // Categoria é opcional (AC-006). Uma quadra sem categoria não pertence a
    // nenhuma — então ela não pode aparecer num filtro de categoria, mas
    // precisa voltar quando o filtro é limpo.
    responder([quadra("Com", TENIS, SAIBRO), quadra("Sem", TENIS, null)]);

    render(<CourtsList />);
    await waitFor(() => expect(screen.getByText("Com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Saibro" }));
    expect(screen.queryByText("Sem")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Todas as categorias" }),
    );
    expect(screen.getByText("Sem")).toBeInTheDocument();
  });
});
