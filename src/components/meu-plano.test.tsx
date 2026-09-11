import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { MeuPlano } from "./meu-plano";

/**
 * SPEC-037/TASK-006 — o plano do aluno no perfil.
 *
 * **O caso que mais vale é o do `null`.** A tabela de matrículas nasceu vazia:
 * a maioria dos alunos de hoje não tem plano, e mostrar "você não tem plano"
 * seria cobrar de quem talvez nem deva ter — quem matricula é o clube. Sumir
 * é a resposta certa, e é o mesmo comportamento da carteira sem saldo.
 *
 * O segundo é o link: **sem link não há botão**. Um botão morto é pior que
 * nenhum, porque o aluno clica, nada acontece, e ele conclui que o app está
 * quebrado.
 */
const getMinhaMatricula = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMinhaMatricula };
});

function matricula(extra: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    alunoId: "a-1",
    planoId: "p-1",
    planoNome: "Mensal",
    valorCentavos: 25000,
    valorDeTabelaCentavos: 30000,
    descontoCentavos: 5000,
    prazoMeses: 1,
    inicio: "2026-09-10",
    fim: "2026-10-10",
    contratoVersao: 3,
    // SPEC-045 — 20 dias: **fora da janela de aviso**, para que os casos
    // antigos deste arquivo continuem medindo o que mediam. Um padrão dentro
    // da janela poria o aviso em todos eles.
    diasRestantes: 20,
    linkPagamentoUrl: "https://clube.example/pagar",
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMinhaMatricula.mockResolvedValue(matricula());
});

describe("MeuPlano", () => {
  it("mostra o plano, o valor CONTRATADO e até quando vale", async () => {
    render(<MeuPlano />);

    expect(await screen.findByText("Seu plano")).toBeInTheDocument();
    // **R$ 250,00, não R$ 300,00.** É o valor congelado no dia: o clube pode
    // ter reajustado o plano, e a matrícula dele não muda (D1).
    expect(screen.getByText(/R\$\s*250,00/)).toBeInTheDocument();
    expect(screen.getByText(/Mensal · até 10\/10\/2026/)).toBeInTheDocument();
  });

  // =====================================================================
  // SPEC-045/AC-010 — o aviso de vencimento
  // =====================================================================

  it("**a 7 dias, avisa**", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ diasRestantes: 7 }));
    render(<MeuPlano />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Seu plano vence em 7 dias.",
    );
  });

  it("**a 8 dias, NÃO avisa** — aviso permanente vira paisagem", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ diasRestantes: 8 }));
    render(<MeuPlano />);

    // Sem este caso, um aviso que aparecesse o mês inteiro passaria: o de 7
    // dias sozinho fica verde com a condição `diasRestantes <= 999`.
    await screen.findByText(/Mensal/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("no dia, diz HOJE — e não 'em 0 dias'", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ diasRestantes: 0 }));
    render(<MeuPlano />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Seu plano vence hoje.",
    );
  });

  it("já vencido, diz 'venceu há' — e não 'vence em -3'", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ diasRestantes: -3 }));
    render(<MeuPlano />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Seu plano venceu há 3 dias.",
    );
  });

  it("singular no dia único", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ diasRestantes: 1 }));
    render(<MeuPlano />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Seu plano vence em 1 dia.",
    );
  });

  it("sem matrícula, SOME — não diz 'você não tem plano'", async () => {
    getMinhaMatricula.mockResolvedValue(null);
    const { container } = render(<MeuPlano />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("`403` (professor, gestor) some em silêncio", async () => {
    getMinhaMatricula.mockRejectedValue(new ApiError(403, "Forbidden"));
    const { container } = render(<MeuPlano />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("o link vira botão, com `noopener noreferrer`", async () => {
    render(<MeuPlano />);

    const link = await screen.findByRole("link", { name: "Pagar" });
    expect(link).toHaveAttribute("href", "https://clube.example/pagar");
    // O destino é de terceiro: sem `noopener`, a página de pagamento recebe
    // `window.opener` e pode navegar esta aba para onde quiser.
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("**sem link não há botão** — e a tela diz o que fazer", async () => {
    getMinhaMatricula.mockResolvedValue(matricula({ linkPagamentoUrl: null }));
    render(<MeuPlano />);

    expect(await screen.findByText("Seu plano")).toBeInTheDocument();
    // Botão morto é pior que nenhum: o aluno clica, nada acontece, e conclui
    // que o app quebrou.
    expect(
      screen.queryByRole("link", { name: "Pagar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Fale com a recepção/)).toBeInTheDocument();
  });
});
