import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChamadaView } from "./chamada-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/top-app-bar", () => ({
  TopAppBar: () => null,
}));

const getChamadaMock = vi.fn();
const salvarChamadaMock = vi.fn();
const naoHouveMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getChamada: (...args: unknown[]) => getChamadaMock(...args),
    salvarChamada: (...args: unknown[]) => salvarChamadaMock(...args),
    registrarNaoHouveAula: (...args: unknown[]) => naoHouveMock(...args),
  };
});

function chamadaCancelada(alunos: string[]) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: "2026-08-23",
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: true,
    completude: null,
    versao: "0",
    alunos: alunos.map((nome, i) => ({
      alunoId: `a${i}`,
      nome,
      status: null,
      naTurmaHoje: true,
    })),
  };
}

/**
 * SPEC-031/AC-019b — **a aula cancelada é alcançável, e é somente leitura.**
 *
 * ## Por que este arquivo mede rede, e não aparência
 *
 * A v6 da spec exigia só a ausência do botão *Salvar*. A 6ª rodada de
 * validação mostrou que isso não provava nada: o professor continuava podendo
 * tocar `Veio`/`Faltou`/`Justificou`, *Todos vieram* e *A aula não aconteceu*,
 * criando rascunho ou disparando `PUT` numa tela declarada somente leitura.
 *
 * O critério virou **a ausência de toda ação mutadora**, e a prova é
 * observável: a suíte **interage** com cada controle e afere **zero**
 * requisições. Descrever a tela é prova de forma; a spec já registrou, em
 * `LEARNINGS.md` (2026-09-02), que prova de forma não é prova de
 * comportamento.
 *
 * O espião é duplo de propósito: os mutadores do `api-client` **e** o `fetch`
 * global. Os primeiros são a costura por onde a tela fala com a rede; o
 * segundo pega qualquer caminho que não passe por eles.
 */
describe("ChamadaView — modo histórico da aula cancelada (AC-019b)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getChamadaMock.mockReset();
    salvarChamadaMock.mockReset();
    naoHouveMock.mockReset();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const semNenhumaMutacao = () => {
    expect(salvarChamadaMock).not.toHaveBeenCalled();
    expect(naoHouveMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  };

  it("mostra o rótulo que diz o que a tela é, não só o que houve", async () => {
    getChamadaMock.mockResolvedValue(chamadaCancelada(["Ana"]));
    render(<ChamadaView ocupacaoId="oc1" />);

    await screen.findByText(/Aula cancelada — histórico somente leitura/);
  });

  it("não oferece NENHUMA das três ações mutadoras", async () => {
    getChamadaMock.mockResolvedValue(chamadaCancelada(["Ana", "Bruno"]));
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(screen.queryByRole("button", { name: /Salvar chamada/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Todos vieram/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /A aula não aconteceu/ }),
    ).toBeNull();
  });

  /**
   * **A linha que importa.** As duas de cima descrevem a tela; esta interage
   * com ela. Tocar `Veio` num modo somente leitura não pode nem criar
   * rascunho: rascunho é a metade do caminho para o `PUT`, e uma tela que
   * aceita a marcação está prometendo um salvamento que nunca virá.
   */
  it("tocar Veio/Faltou/Justificou não marca nada e não chama a rede", async () => {
    getChamadaMock.mockResolvedValue(chamadaCancelada(["Ana"]));
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    for (const rotulo of [/Veio/, /Faltou/, /Justificou/]) {
      const botao = screen.getByRole("button", { name: rotulo });
      fireEvent.click(botao);
      // Continua sem marca: o toque não virou rascunho.
      expect(botao.getAttribute("aria-pressed")).toBe("false");
    }

    await waitFor(semNenhumaMutacao);
  });

  /**
   * **Achado de auditoria adversarial, 2026-09-05.** A tela dizia "somente
   * leitura — nada mais pode ser alterado" e, logo abaixo, mandava *"marque os
   * alunos abaixo e salve"*. A segunda instrução é impossível: os botões estão
   * `disabled` e a barra de Salvar não existe.
   *
   * Os dois blocos são pré-existentes, mas só ficaram alcançáveis por
   * navegação normal porque este PR criou o link para a aula cancelada — o
   * link expôs uma contradição que já morava no arquivo.
   */
  describe("nenhuma instrução impossível sobra na tela", () => {
    it("aula cancelada E não realizada: não manda marcar e salvar", async () => {
      getChamadaMock.mockResolvedValue({
        ...chamadaCancelada(["Ana"]),
        completude: "nao_houve",
      });
      render(<ChamadaView ocupacaoId="oc1" />);
      await screen.findByText("Ana");

      expect(screen.queryByText(/marque os alunos abaixo e salve/)).toBeNull();
      // E o rótulo do histórico ainda diz o que aconteceu com a aula.
      expect(
        screen.getByText(/não aconteceu/, { exact: false }),
      ).toBeInTheDocument();
      await waitFor(semNenhumaMutacao);
    });

    it("aula cancelada com chamada legada: não manda salvar de novo", async () => {
      getChamadaMock.mockResolvedValue({
        ...chamadaCancelada(["Ana"]),
        completude: "desconhecida",
      });
      render(<ChamadaView ocupacaoId="oc1" />);
      await screen.findByText("Ana");

      expect(screen.queryByText(/salve de novo/)).toBeNull();
      await waitFor(semNenhumaMutacao);
    });

    /**
     * Os contrapositivos: **fora** do modo histórico as duas instruções
     * continuam lá, porque fora dele elas são possíveis e úteis.
     */
    it("na aula NÃO cancelada, as duas instruções continuam", async () => {
      getChamadaMock.mockResolvedValue({
        ...chamadaCancelada(["Ana"]),
        cancelada: false,
        completude: "nao_houve",
      });
      const naoHouve = render(<ChamadaView ocupacaoId="oc1" />);
      await screen.findByText(/marque os alunos abaixo e salve/);
      naoHouve.unmount();

      getChamadaMock.mockResolvedValue({
        ...chamadaCancelada(["Ana"]),
        cancelada: false,
        completude: "desconhecida",
      });
      render(<ChamadaView ocupacaoId="oc1" />);
      await screen.findByText(/salve de novo/);
    });
  });

  /**
   * O contrapositivo, e ele é obrigatório: sem ele os testes acima passariam
   * numa tela que não oferece nada **nunca** — inclusive nas aulas normais.
   * "Ausente quando cancelada" só é informação se estiver "presente quando
   * não cancelada".
   */
  it("na aula NÃO cancelada, as mesmas ações continuam lá e o toque marca", async () => {
    getChamadaMock.mockResolvedValue({
      ...chamadaCancelada(["Ana"]),
      cancelada: false,
    });
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText("Ana");

    expect(
      screen.getByRole("button", { name: /Salvar chamada/ }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Todos vieram/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /A aula não aconteceu/ }),
    ).toBeTruthy();

    const veio = screen.getByRole("button", { name: /Veio/ });
    fireEvent.click(veio);
    await waitFor(() =>
      expect(veio.getAttribute("aria-pressed")).toBe("true"),
    );
  });
});
