import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { AulaParticular } from "./aula-particular";

/**
 * SPEC-047/TASK-004 — a tela de marcar aula particular.
 *
 * **O que este arquivo guarda** é o que só existe aqui: que a tela **não
 * mande `valor`** (D3/DEF-029), que ela distinga *"não atende neste dia"* de
 * *"está cheio"* (AC-018), que mostre o aviso de saldo **sem travar o botão**
 * (LIM-047f), e que não recalcule preço nem escolha quadra.
 *
 * O que a rota oferece, e se a criação aceita, está no
 * `spec-047-horarios-do-professor.db-spec.ts`, sobre dados reais — testar isso
 * aqui seria medir o mock.
 */
const listarProfessoresParaAula = vi.hoisted(() => vi.fn());
const horariosDeAula = vi.hoisted(() => vi.fn());
const marcarAulaParticular = vi.hoisted(() => vi.fn());
const getMinhaCarteira = vi.hoisted(() => vi.fn());
const adicionaisDisponiveis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listarProfessoresParaAula,
    horariosDeAula,
    marcarAulaParticular,
    getMinhaCarteira,
    adicionaisDisponiveis,
  };
});

const PROF = {
  id: "p-1",
  nome: "Ana Coach",
  fotoUrl: null,
  precoAula: 150,
};

function grade(extra: Record<string, unknown> = {}) {
  return {
    data: "2026-09-11",
    atende: true,
    janela: { horaInicio: "08:00", horaFim: "12:00" },
    precoAula: 150,
    slots: [
      {
        horaInicio: "09:00",
        horaFim: "10:00",
        quadraId: "q-1",
        quadraNome: "Quadra A",
      },
      {
        horaInicio: "10:00",
        horaFim: "11:00",
        quadraId: "q-2",
        quadraNome: "Quadra B",
      },
    ],
    ...extra,
  };
}

/** Escolhe o professor e espera a grade chegar. */
async function abrirGrade() {
  render(<AulaParticular />);
  fireEvent.click(await screen.findByText("Ana Coach"));
  await screen.findByRole("button", { name: /09:00/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  listarProfessoresParaAula.mockResolvedValue([PROF]);
  horariosDeAula.mockResolvedValue(grade());
  marcarAulaParticular.mockResolvedValue({ reservas: [{ id: "r-1" }] });
  getMinhaCarteira.mockResolvedValue({ saldoCentavos: 50_000, movimentos: [] });
  // SPEC-054: clube sem adicional ativo é o caso dos testes anteriores.
  adicionaisDisponiveis.mockResolvedValue([]);
});

describe("SPEC-047 — escolher o professor", () => {
  it("lista quem dá aula, com o preço que veio do servidor", async () => {
    render(<AulaParticular />);
    expect(await screen.findByText("Ana Coach")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*150,00 por aula/)).toBeInTheDocument();
  });

  it("**lista vazia manda falar com a recepção, e não promete nada**", async () => {
    // Duas causas reais (clube sem preço, clube sem professor ativo) e a tela
    // não sabe qual é. "Em breve" seria invenção.
    listarProfessoresParaAula.mockResolvedValue([]);
    render(<AulaParticular />);
    expect(
      await screen.findByText(/ainda não tem aula particular/i),
    ).toBeInTheDocument();
  });

  it("mostra o saldo da carteira antes da escolha", async () => {
    render(<AulaParticular />);
    expect(await screen.findByText(/Seu saldo: R\$\s*500,00/)).toBeInTheDocument();
  });

  it("a carteira indisponível NÃO derruba a tela", async () => {
    // Sem o saldo a pessoa perde o aviso, não a possibilidade de marcar —
    // quem decide de verdade é o servidor, na criação.
    getMinhaCarteira.mockRejectedValue(new Error("rede"));
    render(<AulaParticular />);
    expect(await screen.findByText("Ana Coach")).toBeInTheDocument();
    expect(screen.queryByText(/Seu saldo/)).not.toBeInTheDocument();
  });
});

describe("SPEC-047 — a grade de horários", () => {
  it("desenha o que o servidor mandou, com a QUADRA que ele escolheu", async () => {
    await abrirGrade();
    // Sem a flag `/s`: o alvo de TS deste projeto não a aceita, e o
    // **runner passou verde com ela** — quinta vez neste ciclo que verde no
    // vitest não significa que compila (`isolatedModules`).
    expect(screen.getByRole("button", { name: /09:00/ })).toHaveTextContent(
      "Quadra A",
    );
    expect(screen.getByRole("button", { name: /10:00/ })).toHaveTextContent(
      "Quadra B",
    );
    // A tela não escolhe quadra (LIM-047e): ela mostra a que veio.
  });

  it('**"não atende neste dia" é diferente de "está cheio"** (AC-018)', async () => {
    horariosDeAula.mockResolvedValue(
      grade({ atende: false, janela: null, slots: [] }),
    );
    render(<AulaParticular />);
    fireEvent.click(await screen.findByText("Ana Coach"));
    expect(
      await screen.findByText(/não dá aula neste dia/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum horário livre/i)).not.toBeInTheDocument();
  });

  it("cheio diz que está cheio, e informa a janela dele", async () => {
    horariosDeAula.mockResolvedValue(grade({ slots: [] }));
    render(<AulaParticular />);
    fireEvent.click(await screen.findByText("Ana Coach"));
    const vazio = await screen.findByText(/Nenhum horário livre/i);
    expect(vazio).toHaveTextContent("das 08:00 às 12:00");
    expect(screen.queryByText(/não dá aula neste dia/i)).not.toBeInTheDocument();
  });

  it("erro ao carregar a grade aparece como alerta", async () => {
    horariosDeAula.mockRejectedValue(
      new ApiError(422, "Este professor ainda não tem preço de aula definido."),
    );
    render(<AulaParticular />);
    fireEvent.click(await screen.findByText("Ana Coach"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não tem preço de aula/i,
    );
  });
});

describe("SPEC-047 — confirmar", () => {
  it("**manda quadra, dia, hora e professor — e NENHUM `valor`** (D3)", async () => {
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));

    await waitFor(() => expect(marcarAulaParticular).toHaveBeenCalled());
    const enviado = marcarAulaParticular.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    // **O caso que o DEF-029 deixou.** Ele esteve em produção permitindo ao
    // aluno marcar a própria aula por R$ 0,01. O servidor recusa com
    // `VALOR_NAO_E_DO_ALUNO`; aqui a trava é o formato, e este `not` é o que
    // a mantém.
    expect(enviado).not.toHaveProperty("valor");
    expect(enviado).toEqual({
      quadraId: "q-1",
      data: expect.any(String),
      horaInicio: "09:00",
      horaFim: "10:00",
      professorId: "p-1",
    });
  });

  it("o resumo mostra o preço do PROFESSOR, sem somar quadra (D5)", async () => {
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText(/quadra incluída/i)).toBeInTheDocument();
  });

  it("depois de marcar, confirma e oferece ver as reservas", async () => {
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));
    expect(await screen.findByText("Aula marcada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver minhas reservas" }),
    ).toHaveAttribute("href", "/reservas");
  });

  it("a recusa do servidor aparece com a mensagem DELE", async () => {
    marcarAulaParticular.mockRejectedValue(
      new ApiError(409, "O professor já tem compromisso em 09:00–10:00."),
    );
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /já tem compromisso/i,
    );
    expect(screen.queryByText("Aula marcada")).not.toBeInTheDocument();
  });
});

describe("SPEC-047/LIM-047f — a carteira", () => {
  it("**avisa quanto falta, e NÃO trava o botão**", async () => {
    getMinhaCarteira.mockResolvedValue({
      saldoCentavos: 4_000,
      movimentos: [],
    });
    await abrirGrade();
    const aviso = await screen.findByText(/Faltam/);
    expect(aviso).toHaveTextContent("R$ 110,00");

    // Travar aqui prenderia quem acabou de receber crédito: o saldo desta
    // tela foi lido há um minuto, e quem decide é o servidor.
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    expect(
      screen.getByRole("button", { name: "Confirmar aula" }),
    ).toBeEnabled();
  });

  it("com saldo suficiente, nenhum aviso aparece", async () => {
    await abrirGrade();
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument();
  });
});

/**
 * SPEC-054/D12 e AC-008 — **adicional na aula particular do aluno.**
 *
 * O `valor` gravado é o preço da aula + os adicionais, e quem soma é o
 * servidor. A tela mostra o total antes de confirmar, e o aviso de saldo usa
 * esse total — senão diria "cabe" sobre uma aula que a carteira recusa.
 */
describe("SPEC-054 — adicionais na aula particular", () => {
  const RAQUETE = {
    id: "ad-1",
    tipoId: "t-1",
    tipoNome: "Raquetes",
    nome: "Raquete",
    preco: 15,
    disponivel: 3,
  };

  it("depois do horário, pede a disponibilidade para ele", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    await abrirGrade();
    expect(adicionaisDisponiveis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    await waitFor(() =>
      expect(adicionaisDisponiveis).toHaveBeenCalledWith(expect.any(String), [
        "09:00-10:00",
      ]),
    );
  });

  it("AC-008: 2 raquetes somam ao preço, e vão no pedido — ainda sem `valor`", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    const mais = await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(mais);
    fireEvent.click(mais);

    expect(await screen.findByText("R$ 180,00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));
    await waitFor(() => expect(marcarAulaParticular).toHaveBeenCalled());
    const enviado = marcarAulaParticular.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado.adicionais).toEqual([{ adicionalId: "ad-1", quantidade: 2 }]);
    expect(enviado).not.toHaveProperty("valor");
  });

  it("o aviso de saldo usa aula + adicionais", async () => {
    // R$ 160: cabe a aula de R$ 150, não cabe com uma raquete de R$ 15.
    getMinhaCarteira.mockResolvedValue({ saldoCentavos: 16_000, movimentos: [] });
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    expect(await screen.findByText(/Faltam/)).toHaveTextContent("R$ 5,00");
  });

  it("sem escolha, o pedido não leva o campo", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));
    await waitFor(() => expect(marcarAulaParticular).toHaveBeenCalled());
    const enviado = marcarAulaParticular.mock.calls[0][0] as Record<string, unknown>;
    expect("adicionais" in enviado).toBe(false);
  });

  it("LIM-054j: `409 ESTOQUE_ESGOTADO` mostra a mensagem e relê", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    marcarAulaParticular.mockRejectedValue(
      new ApiError(409, "Raquete esgotou neste horário.", "ESTOQUE_ESGOTADO"),
    );
    await abrirGrade();
    fireEvent.click(screen.getByRole("button", { name: /09:00/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    const antes = adicionaisDisponiveis.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aula" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/esgotou/);
    await waitFor(() =>
      expect(adicionaisDisponiveis.mock.calls.length).toBeGreaterThan(antes),
    );
  });
});
