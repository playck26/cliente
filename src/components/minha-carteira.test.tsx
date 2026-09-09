import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhaCarteira } from "./minha-carteira";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-033/TASK-006 — a carteira no app do aluno.
 *
 * **O caso que este arquivo existe para guardar é o `404`.** Ele não é falha:
 * é "você não tem carteira", e professor e gestor logados no app caem nele
 * legitimamente. Tratado como erro, a tela pintaria "não foi possível
 * carregar" para quem não deveria ver nada — e a pessoa recarregaria para
 * sempre.
 */
const pegarCarteira = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMinhaCarteira: pegarCarteira };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MinhaCarteira", () => {
  it("mostra o saldo em reais", async () => {
    pegarCarteira.mockResolvedValue({ saldoCentavos: 12_345, movimentos: [] });
    render(<MinhaCarteira />);

    expect(await screen.findByTestId("saldo")).toHaveTextContent("123,45");
  });

  it("404 é AUSÊNCIA de carteira: a seção some, sem erro", async () => {
    pegarCarteira.mockRejectedValue(new ApiError(404, "Not Found"));
    const { container } = render(<MinhaCarteira />);

    // Nada de "não foi possível carregar" — quem não tem carteira não tem
    // problema nenhum para resolver.
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("403 tambem e ausencia de carteira -- o defeito visto em producao", async () => {
    // **O caso que faltava.** A rota tem `@Roles('aluno')`, entao o professor
    // logado no app recebia `403`, nao `404`, e caia no ramo de erro: o perfil
    // dele mostrava "nao foi possivel carregar sua carteira" em vermelho.
    //
    // A primeira versao deste componente previu o usuario SEM linha de aluno
    // e esqueceu o caso mais comum: quem nao e aluno nem chega ao servico.
    pegarCarteira.mockRejectedValue(new ApiError(403, "Forbidden"));
    const { container } = render(<MinhaCarteira />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("falha de verdade DIZ que falhou", async () => {
    pegarCarteira.mockRejectedValue(new ApiError(500, "boom"));
    render(<MinhaCarteira />);

    expect(
      await screen.findByText(/Não foi possível carregar sua carteira/),
    ).toBeInTheDocument();
  });

  it("carteira VAZIA é uma carteira — mostra zero e diz o que fazer", async () => {
    pegarCarteira.mockResolvedValue({ saldoCentavos: 0, movimentos: [] });
    render(<MinhaCarteira />);

    expect(await screen.findByTestId("saldo")).toHaveTextContent("0,00");
    expect(screen.getByText(/Fale com o clube/)).toBeInTheDocument();
  });

  it("D3: o sinal vem do TIPO, e a reserva aparece pelo que é", async () => {
    pegarCarteira.mockResolvedValue({
      saldoCentavos: 4000,
      movimentos: [
        {
          id: "m1",
          tipo: "entrada",
          valorCentavos: 12_000,
          ocupacaoId: null,
          criadoEm: "2026-09-08T12:00:00.000Z",
        },
        {
          id: "m2",
          tipo: "consumo",
          valorCentavos: 8000,
          ocupacaoId: "o1",
          criadoEm: "2026-09-08T13:00:00.000Z",
        },
      ],
    });
    render(<MinhaCarteira />);

    const linhas = await screen.findAllByRole("listitem");
    expect(linhas[0]).toHaveTextContent("Crédito adicionado");
    expect(linhas[0]).toHaveTextContent("+");
    expect(linhas[1]).toHaveTextContent("Reserva de quadra");
    expect(linhas[1]).toHaveTextContent("−");
  });
});
