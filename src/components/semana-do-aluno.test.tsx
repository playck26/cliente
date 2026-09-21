import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanaDoAluno } from "./semana-do-aluno";

/**
 * SPEC-066/TASK-003 — **a vista passou a buscar a propria janela**, e por
 * isso estas provas mockam a rede em vez de passar `aulas` por prop.
 *
 * A prop saiu de proposito (INV-066d): era ela que acoplava o calendario a
 * lista do pai, e com a lista paginada o pai nao tem mais o futuro inteiro
 * para emprestar.
 */
const listMyClasses = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listMyClasses };
});

/**
 * SPEC-029 — as provas da visão semanal das aulas do aluno.
 *
 * **O relógio é fixado em todas.** A tela decide qual semana abrir a partir de
 * "hoje", então sem `setSystemTime` estas provas mudariam de resultado
 * conforme o dia em que a suíte rodasse — o sorteio que o DEF-020 custou caro
 * duas vezes neste projeto, uma delas dentro da correção que o citava.
 *
 * **2026-09-02 é uma QUARTA.** A semana dela vai de domingo 30/08 a sábado
 * 05/09, e é isso que os números abaixo esperam.
 */

const QUARTA = new Date("2026-09-02T15:00:00.000Z"); // 12h em São Paulo

const aula = (patch: Record<string, unknown> = {}) => ({
  ocupacaoId: "o1",
  turmaId: "t1",
  turmaNome: "Iniciantes",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  // SPEC-030: campo obrigatório no contrato do aluno. O `tsc` cobrou esta
  // fixture, que é o comportamento desejado — contrato novo não pode entrar
  // sem que quem monta payload de teste seja obrigado a decidir o valor.
  naoRealizada: false,
  faltaAvisada: false,
  ...patch,
});

/**
 * Monta a vista com as aulas que o servidor devolveria, e **espera a busca**.
 *
 * A montagem e o proprio gatilho (AC-012): abrir a vista por link, `F5` ou
 * *voltar* nao tem clique nenhum, e mesmo assim a semana precisa aparecer.
 */
async function montar(
  aulas: ReturnType<typeof aula>[],
  props: { mostrarQuadra?: boolean; mostrarLinkDaTurma?: boolean } = {},
) {
  listMyClasses.mockResolvedValue(aulas);
  const resultado = render(<SemanaDoAluno {...props} />);
  await waitFor(() => expect(listMyClasses).toHaveBeenCalled());
  return resultado;
}

beforeEach(() => {
  listMyClasses.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(QUARTA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("abre na semana de hoje", () => {
  it("mostra o intervalo de domingo a sábado", async () => {
    await montar([aula()]);

    expect(screen.getByText("30/08 – 05/09")).toBeInTheDocument();
  });

  it("e diz que é esta semana, com a contagem", async () => {
    await montar([aula()]);

    expect(screen.getByText("1 aula · esta semana")).toBeInTheDocument();
  });

  it("os sete dias aparecem, inclusive os sem aula", async () => {
    // Mostrar só os dias com aula economizaria espaço e destruiria a
    // informação: o valor de ver a semana é enxergar os buracos.
    await montar([aula()]);

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});

describe("a aula cai no dia certo", () => {
  it("duas aulas no mesmo dia ficam juntas", async () => {
    await montar([
      aula(),
      aula({ ocupacaoId: "o2", horaInicio: "20:00", horaFim: "21:00" }),
    ]);

    expect(screen.getByText("2 aulas · esta semana")).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00/)).toBeInTheDocument();
    expect(screen.getByText(/20:00–21:00/)).toBeInTheDocument();
  });

  it("aula de outra semana NÃO aparece nesta", async () => {
    // Sem esta, um componente que ignorasse a semana e listasse tudo passaria
    // nas provas de cima.
    await montar([aula({ data: "2026-09-10" })]);

    expect(screen.getByText("Nenhuma aula · esta semana")).toBeInTheDocument();
    expect(screen.queryByText(/18:00–19:00/)).not.toBeInTheDocument();
  });
});

describe("dia vazio: o que a tela pode afirmar", () => {
  it("dia futuro sem aula diz 'Sem aula'", async () => {
    await montar([aula()]);

    // Quinta, sexta e sábado desta semana ainda não passaram.
    expect(screen.getAllByText("Sem aula").length).toBeGreaterThan(0);
  });

  it("dia JÁ PASSADO mostra '—', e não 'Sem aula'", async () => {
    // `GET /me/classes` só devolve o futuro, então a aula pode ter existido
    // no domingo. Dizer "sem aula" ali seria a tela afirmando o que não sabe.
    await montar([aula()]);

    // Domingo 30, segunda 31 e terça 01 já passaram na quarta 02.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  // A prova "e explica o traco" saiu na SPEC-066/TASK-003: o rodape que ela
  // exercitava deixou de existir. Ele so aparecia quando ninguem buscava a
  // semana passada, e agora esta vista sempre busca — travessao quer dizer
  // "nao houve aula", e nao "nao sei".
});

describe("navegar entre semanas", () => {
  it("a próxima semana muda o intervalo", async () => {
    await montar([aula({ data: "2026-09-10" })]);

    fireEvent.click(screen.getByLabelText("Próxima semana"));

    expect(screen.getByText("06/09 – 12/09")).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00/)).toBeInTheDocument();
  });

  it("a anterior também, e atravessa a virada de mês", async () => {
    // 30/08 é domingo; a semana antes dele começa em 23/08. É a aritmética
    // que quebra à mão na virada de mês.
    await montar([aula()]);

    fireEvent.click(screen.getByLabelText("Semana anterior"));

    expect(screen.getByText("23/08 – 29/08")).toBeInTheDocument();
  });

  it("fora da semana de hoje, aparece o atalho de volta", async () => {
    await montar([aula()]);
    expect(
      screen.queryByText("Voltar para esta semana"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Próxima semana"));
    fireEvent.click(screen.getByText("Voltar para esta semana"));

    expect(screen.getByText("30/08 – 05/09")).toBeInTheDocument();
  });
});

// **ACHADO 1 DA 2ª VALIDAÇÃO CRUZADA (ALTA)** — esta vista ignorava
// `naoRealizada`.
//
// O risco não é cosmético: o aluno se organiza pela semana. Uma aula que o
// gestor já marcou como não realizada aparecia como qualquer outra, e ele iria
// ao clube.
//
// A prova que faltava era exatamente esta — e é a que o validador escreveu e
// viu cair.
describe("SPEC-030 — a aula não realizada na Semana", () => {
  it("marca a aula, em vez de mostrá-la como normal", async () => {
    await montar([aula({ naoRealizada: true })]);

    expect(screen.getByText("Aula não realizada")).toBeInTheDocument();
  });

  it("a aula normal continua sem marca nenhuma", async () => {
    // O par negativo: sem ele, marcar TUDO passaria na prova acima.
    await montar([aula()]);

    expect(screen.queryByText("Aula não realizada")).not.toBeInTheDocument();
  });
});

/**
 * SPEC-057/TASK-002/D10 (card 5352) — **a semana leva à ficha da turma.**
 *
 * Antes desta task, cada aula aqui era um `<div>` sem clique: a vista
 * mostrava a semana e terminava ali. O card pede *"clicar para ver sua
 * turma"*.
 */
describe("SPEC-057/TASK-002 — o drill down", () => {
  it("o nome da turma vira link para a ficha", async () => {
    await montar([aula({ turmaId: "t-77" })]);

    const link = screen.getByRole("link", { name: "Iniciantes" });
    expect(link).toHaveAttribute("href", "/minhas-aulas/turma/t-77");
  });

  /**
   * **LIM-057h.** A home monta esta mesma vista, e lá o clique ainda não tem
   * destino: a ficha existe, mas a home não carrega o passado nem oferece a
   * navegação. Prometer o link ali seria a tela fingindo.
   */
  it("`mostrarLinkDaTurma={false}` mantém o nome como texto", async () => {
    await montar([aula({ turmaId: "t-77" })], { mostrarLinkDaTurma: false });

    expect(screen.queryByRole("link", { name: "Iniciantes" })).toBeNull();
    expect(screen.getByText(/Iniciantes/)).toBeInTheDocument();
  });
});

/**
 * SPEC-066/TASK-003 — **os dois gatilhos e a vida do cache.**
 *
 * A v3 desta spec dizia só *"repetir a entrada na mesma janela não busca de
 * novo"*, **sem dizer dentro de quê** — e um `F5` remonta o componente e mata
 * qualquer cache local. Lido ao pé da letra aquilo pedia persistência; lido
 * como o autor pretendia, pedia o contrário. A 3ª rodada de validação pegou, e
 * a v4 fixou a tabela que estas provas exercitam:
 *
 * | Gesto | O que acontece |
 * |---|---|
 * | montar, ou `F5` | **exatamente uma** busca da janela inicial |
 * | voltar a uma semana já vista, na mesma montagem | **não busca** |
 * | `F5` de novo | **busca de novo**, e isso é o correto |
 */
describe("SPEC-066/AC-012 — a entrada direta e o cache por montagem", () => {
  it("montar SEM clique nenhum já busca a semana corrente", async () => {
    await montar([aula()]);

    // Este é o caso do link, do `F5` e do *voltar* do navegador: não há
    // clique, e mesmo assim a semana tem de aparecer. Sem isto o aluno abria
    // `/minhas-aulas?vista=semana` e via uma semana vazia até clicar numa
    // seta.
    expect(listMyClasses).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 aula · esta semana")).toBeInTheDocument();
  });

  it("AC-005 — voltar a uma semana já vista não busca de novo", async () => {
    await montar([aula()]);
    expect(listMyClasses).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Semana anterior"));
    await waitFor(() => expect(listMyClasses).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByLabelText("Próxima semana"));
    await screen.findByText("30/08 – 05/09");

    // **A terceira busca não acontece**: a janela já está no cache da
    // montagem. Se acontecesse, cada vaivém do aluno seria uma ida à rede.
    expect(listMyClasses).toHaveBeenCalledTimes(2);
  });

  it("remontar (o `F5`) busca de novo — o cache NÃO atravessa", async () => {
    const { unmount } = await montar([aula()]);
    expect(listMyClasses).toHaveBeenCalledTimes(1);

    unmount();
    await montar([aula()]);

    // E isto é o comportamento correto, não um defeito: guardar cache através
    // de `F5` exigiria nomear armazenamento, invalidação e escopo — para
    // economizar uma busca que a pessoa pediu ao recarregar.
    expect(listMyClasses).toHaveBeenCalledTimes(2);
  });

  it("a janela pedida é a da semana que está na tela", async () => {
    await montar([aula()]);

    expect(listMyClasses).toHaveBeenCalledWith({
      de: "2026-08-30",
      ate: "2026-09-05",
    });
  });
});
