import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PassoDeAdicionais } from "./passo-de-adicionais";

/**
 * **DEF-037 — a aula era marcada antes de a lista de adicionais aparecer.**
 *
 * Relatado pelo Israel: *"quando eu tento agendar uma aula avulsa, a aula é
 * marcada antes mesmo de eu poder escolher os itens adicionais, parece que vai
 * direto."*
 *
 * O passo tinha `disponiveis = []` antes da resposta da rede, e
 * `if (disponiveis.length === 0) return null`: **um mesmo nada** para "ainda
 * buscando" e para "o clube não tem adicional" — com o botão de confirmar
 * habilitado nos dois.
 *
 * **E a janela era o caminho normal**, não um canto raro: este componente só
 * monta depois do horário escolhido, então a busca começa exatamente no
 * instante em que a pessoa vai confirmar.
 *
 * O gêmeo deste arquivo está no Admin. **Os dois apps têm o mesmo defeito
 * porque têm o mesmo componente duplicado** — ADR-001, duplicação como custo
 * declarado. O que a ADR compra é independência; o que ela cobra é isto: um
 * defeito, dois consertos, e nenhum gate avisando que o segundo existe.
 */

const disponiveis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, adicionaisDisponiveis: disponiveis };
});

const RAQUETE = {
  id: "ad-1",
  tipoId: "t-1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  disponivel: 2,
};

beforeEach(() => {
  disponiveis.mockReset();
});

describe("DEF-037 — buscando e vazio deixaram de ser a mesma tela", () => {
  it("enquanto busca, DIZ que está buscando", async () => {
    disponiveis.mockReturnValue(new Promise(() => {}));

    render(
      <PassoDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /carregando adicionais/i,
    );
  });

  it("avisa quem usa: `true` ao começar, `false` ao terminar", async () => {
    let resolver: (v: unknown[]) => void = () => {};
    disponiveis.mockReturnValue(
      new Promise<unknown[]>((r) => {
        resolver = r;
      }),
    );
    const avisos: boolean[] = [];

    render(
      <PassoDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    // **Este é o aviso que faltava**: sem ele o botão de confirmar não tem como
    // saber que deve esperar.
    await waitFor(() => expect(avisos).toContain(true));

    resolver([RAQUETE]);
    await waitFor(() => expect(avisos).toContain(false));
    expect(avisos.indexOf(true)).toBeLessThan(avisos.lastIndexOf(false));
  });

  it("clube SEM adicional continua pulando o passo — e só depois de responder", async () => {
    disponiveis.mockResolvedValue([]);
    const avisos: boolean[] = [];

    const { container } = render(
      <PassoDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    await waitFor(() => expect(avisos).toContain(false));
    // O comportamento antigo, preservado: o passo some. A diferença é que agora
    // ele some **depois** de saber, e não antes.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("o erro da rede também encerra o carregando — o botão não trava", async () => {
    disponiveis.mockRejectedValue(new Error("rede"));
    const avisos: boolean[] = [];

    render(
      <PassoDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    // Sem o `finally`, um erro deixaria `carregando` para sempre e a pessoa
    // nunca conseguiria confirmar — o defeito trocado por outro pior.
    await waitFor(() => expect(avisos).toContain(false));
    expect(
      await screen.findByText(/não foi possível carregar/i),
    ).toBeInTheDocument();
  });
});
