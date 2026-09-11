import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { CompleteSeuCadastro } from "./complete-seu-cadastro";

/**
 * SPEC-036/TASK-005 — a faixa de incentivo, e o que ela NÃO faz.
 *
 * **O item 14 do backlog diz "faixa de incentivo NÃO BLOQUEANTE"**, e o caso
 * mais importante deste arquivo é o que prova isso na tela: a faixa não tem
 * botão que negue nada, e some quando o cadastro fecha em vez de virar selo
 * de parabéns numa tela de 390px.
 *
 * O segundo é o silêncio: professor e gestor recebem `403` e a faixa
 * **desaparece**. Pintar "não foi possível carregar" no perfil de quem não
 * tem cadastro de aluno foi um defeito real da SPEC-033, visto em produção.
 */
const getMeuCadastro = vi.hoisted(() => vi.fn());
const salvarMeuCadastro = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMeuCadastro, salvarMeuCadastro };
});

function cadastro(percentual: number, faltam: string[]) {
  return {
    id: "a-1",
    nome: "Ana",
    email: "ana@clube.local",
    telefone: null,
    nivelId: null,
    status: "ativo",
    dataNascimento: null,
    emergenciaNome: null,
    emergenciaTelefone: null,
    endereco: null,
    cidade: null,
    uf: null,
    observacoesSaude: null,
    cadastro: { percentual, faltam },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMeuCadastro.mockResolvedValue(
    cadastro(29, [
      "telefone",
      "dataNascimento",
      "emergenciaNome",
      "emergenciaTelefone",
      "nivelId",
    ]),
  );
  salvarMeuCadastro.mockResolvedValue(cadastro(100, []));
});

describe("CompleteSeuCadastro", () => {
  it("mostra o percentual e O QUE FALTA, em português", async () => {
    render(<CompleteSeuCadastro />);

    expect(await screen.findByText("29%")).toBeInTheDocument();
    // `emergenciaTelefone` não é uma palavra que o aluno conheça.
    expect(screen.getByText(/telefone de emergência/)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Completude do seu cadastro" }),
    ).toHaveAttribute("aria-valuenow", "29");
  });

  it("**não bloqueia nada, e diz isso** (D4)", async () => {
    render(<CompleteSeuCadastro />);
    // A frase é o contrato com o aluno: o item 14 pediu incentivo, não
    // barreira. Sem ela, uma barra vermelha de 29% parece impedimento.
    expect(
      await screen.findByText(/Nada aqui impede você de reservar/),
    ).toBeInTheDocument();
  });

  it("cadastro completo SOME — não vira selo de parabéns", async () => {
    getMeuCadastro.mockResolvedValue(cadastro(100, []));
    const { container } = render(<CompleteSeuCadastro />);

    // Numa tela de 390px, uma faixa verde permanente ocuparia espaço para
    // dizer "não há nada a fazer".
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("`403` (professor, gestor) SOME em silêncio — sem erro na tela", async () => {
    getMeuCadastro.mockRejectedValue(new ApiError(403, "Forbidden"));
    const { container } = render(<CompleteSeuCadastro />);

    // Pintar "não foi possível carregar seu cadastro" no perfil de um
    // professor foi exatamente o defeito da carteira na SPEC-033.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("só oferece os campos que o ALUNO resolve — `nivelId` não vira input", async () => {
    render(<CompleteSeuCadastro />);
    fireEvent.click(await screen.findByText("Completar agora"));

    expect(screen.getByText("Telefone")).toBeInTheDocument();
    expect(screen.getByText("Data de nascimento")).toBeInTheDocument();
    // O nível é o clube que define. Um campo aqui prometeria ao aluno uma
    // coisa que a rota dele recusa (`400`, o DTO não tem `nivelId`).
    expect(screen.queryByText("Seu nível")).not.toBeInTheDocument();
  });

  it("quando só falta o que o CLUBE preenche, não oferece formulário", async () => {
    getMeuCadastro.mockResolvedValue(cadastro(86, ["nivelId"]));
    render(<CompleteSeuCadastro />);

    expect(
      await screen.findByText(/O clube preenche o que falta/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Completar agora")).not.toBeInTheDocument();
  });

  it("salvar manda `null` no que ficou vazio, nunca string vazia", async () => {
    render(<CompleteSeuCadastro />);
    fireEvent.click(await screen.findByText("Completar agora"));
    fireEvent.change(screen.getByLabelText("Contato de emergência"), {
      target: { value: "Beto" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => expect(salvarMeuCadastro).toHaveBeenCalled());
    const [dto] = salvarMeuCadastro.mock.calls[0] as [Record<string, unknown>];
    expect(dto.emergenciaNome).toBe("Beto");
    // O servidor recusa `""` com `400` (INV-108: ausência é NULL, e só).
    expect(dto.dataNascimento).toBeNull();
    expect(dto.emergenciaTelefone).toBeNull();
  });

  it("depois de salvar, a faixa some — a resposta manda, não o otimismo", async () => {
    render(<CompleteSeuCadastro />);
    fireEvent.click(await screen.findByText("Completar agora"));
    fireEvent.click(screen.getByText("Salvar"));

    // A completude é calculada no servidor (D2: não há coluna). Recalcular
    // aqui criaria uma segunda fonte para a mesma pergunta.
    await waitFor(() =>
      expect(
        screen.queryByText("Complete seu cadastro"),
      ).not.toBeInTheDocument(),
    );
  });

  it("`DATA_NASCIMENTO_INVALIDA` vira mensagem por CODE", async () => {
    salvarMeuCadastro.mockRejectedValue(
      new ApiError(422, "crua", "DATA_NASCIMENTO_INVALIDA"),
    );
    render(<CompleteSeuCadastro />);
    fireEvent.click(await screen.findByText("Completar agora"));
    fireEvent.click(screen.getByText("Salvar"));

    expect(
      await screen.findByText(/não pode estar no futuro/),
    ).toBeInTheDocument();
  });
});
