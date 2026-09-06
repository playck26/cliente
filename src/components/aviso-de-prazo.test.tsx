import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoDePrazo } from "./aviso-de-prazo";

/**
 * SPEC-031 — **os quatro casos do rollout, na TELA.**
 *
 * `capacidade-operacao.test.ts` prova a classificação; este arquivo prova o
 * que o aluno vê em cada uma. São coisas diferentes, e a que quebra em
 * produção é esta: uma classificação certa consumida por uma tela que trata
 * `falhou` e `ausente` igual reintroduz o defeito inteiro.
 *
 * O par que importa é `ausente` × `falhou`. Os dois desenham "nada de
 * feature" se ninguém prestar atenção — e é por isso que o caso `falhou` aqui
 * não afere só a mensagem: afere que existe **caminho de volta**.
 */
const lerCapacidadeOperacao = vi.hoisted(() => vi.fn());

vi.mock("@/lib/capacidade-operacao", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/capacidade-operacao")>(
      "@/lib/capacidade-operacao",
    );
  return { ...real, lerCapacidadeOperacao };
});

beforeEach(() => vi.clearAllMocks());

describe("AvisoDePrazo — os quatro casos do rollout", () => {
  it("disponível com prazo: mostra a feature", async () => {
    lerCapacidadeOperacao.mockResolvedValue({
      estado: "disponivel",
      prazos: {
        prazoCancelamentoAulaHoras: 24,
        prazoCancelamentoReservaHoras: 2,
      },
    });
    render(<AvisoDePrazo tipo="aula" />);

    expect(
      await screen.findByText("Saída até 24h antes da aula."),
    ).toBeInTheDocument();
  });

  it("o tipo escolhe o prazo — os dois são independentes", async () => {
    lerCapacidadeOperacao.mockResolvedValue({
      estado: "disponivel",
      prazos: {
        prazoCancelamentoAulaHoras: 24,
        prazoCancelamentoReservaHoras: 2,
      },
    });
    render(<AvisoDePrazo tipo="reserva" />);

    expect(
      await screen.findByText("Cancelamento até 2h antes da reserva."),
    ).toBeInTheDocument();
  });

  /**
   * `null` é "o clube não exige antecedência" — não há o que avisar. Inventar
   * um "sem prazo" na tela seria ruído sobre o estado padrão.
   */
  it("disponível com prazo null: não avisa nada, e não é erro", async () => {
    lerCapacidadeOperacao.mockResolvedValue({
      estado: "disponivel",
      prazos: {
        prazoCancelamentoAulaHoras: null,
        prazoCancelamentoReservaHoras: null,
      },
    });
    const { container } = render(<AvisoDePrazo tipo="aula" />);

    await waitFor(() => expect(lerCapacidadeOperacao).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("ausente: esconde em silêncio — back antigo não é erro do aluno", async () => {
    lerCapacidadeOperacao.mockResolvedValue({ estado: "ausente" });
    const { container } = render(<AvisoDePrazo tipo="aula" />);

    await waitFor(() => expect(lerCapacidadeOperacao).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.textContent).toBe("");
  });

  /**
   * **`403` mostra erro.** Engolir faria a feature sumir em produção sem
   * ninguém saber: o clube configuraria o prazo, o aluno não veria nada, e
   * não haveria sinal nenhum para investigar.
   */
  it("negado: MOSTRA erro", async () => {
    lerCapacidadeOperacao.mockResolvedValue({ estado: "negado" });
    render(<AvisoDePrazo tipo="aula" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /acesso foi recusado/,
    );
  });

  /**
   * **A prova que separa este arquivo de um teste de aparência.** `falhou`
   * não pode parecer `ausente`, e a diferença observável é o caminho de
   * volta: existe botão, ele refaz a pergunta, e a feature aparece.
   */
  it("falhou: mostra falha RECUPERÁVEL, e o retry funciona", async () => {
    lerCapacidadeOperacao.mockResolvedValueOnce({ estado: "falhou" });
    render(<AvisoDePrazo tipo="aula" />);

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/Não foi possível conferir o prazo/);

    // Não é "ausência de feature": tem caminho de volta, e ele funciona.
    lerCapacidadeOperacao.mockResolvedValueOnce({
      estado: "disponivel",
      prazos: {
        prazoCancelamentoAulaHoras: 12,
        prazoCancelamentoReservaHoras: null,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(
      await screen.findByText("Saída até 12h antes da aula."),
    ).toBeInTheDocument();
    expect(lerCapacidadeOperacao).toHaveBeenCalledTimes(2);
  });

  /**
   * O contraste explícito entre os dois estados que o rollout confunde.
   * Escrito num teste só porque a afirmação é sobre a **diferença**, e uma
   * afirmação sobre diferença fica frágil espalhada em dois arquivos.
   */
  it("ausente e falhou NÃO desenham a mesma tela", async () => {
    lerCapacidadeOperacao.mockResolvedValue({ estado: "ausente" });
    const ausente = render(<AvisoDePrazo tipo="aula" />);
    await waitFor(() => expect(lerCapacidadeOperacao).toHaveBeenCalled());
    const textoAusente = ausente.container.textContent;
    ausente.unmount();

    vi.clearAllMocks();
    lerCapacidadeOperacao.mockResolvedValue({ estado: "falhou" });
    const falhou = render(<AvisoDePrazo tipo="aula" />);
    await screen.findByRole("status");

    expect(falhou.container.textContent).not.toBe(textoAusente);
  });
});
