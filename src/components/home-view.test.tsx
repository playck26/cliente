import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyClass } from "@/lib/api-client";

/**
 * DEF-007 (2026-08-24) — o defeito que chegou a produção.
 *
 * `GET /me/classes` é `@Roles('aluno')` no servidor, mas `rotaInicial()`
 * manda para `/home` **todo papel que não é professor** — gestor e super
 * admin inclusive. Para eles a chamada sempre devolveu 403, e o
 * `Promise.all` fazia esse 403 derrubar o `getMe()` junto: a home inteira
 * virava a palavra "Forbidden", crua do servidor, sozinha no meio da tela.
 *
 * Três defeitos empilhados, e este arquivo prova os três separados.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/home",
}));

const getMeMock = vi.fn();
const listMyClassesMock = vi.fn();

class ApiErrorFalso extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

vi.mock("@/lib/api-client", () => ({
  ApiError: ApiErrorFalso,
  getMe: (...a: unknown[]) => getMeMock(...a),
  listMyClasses: (...a: unknown[]) => listMyClassesMock(...a),
  // SPEC-018/TASK-006: o `TopAppBar` passou a buscar a empresa para
  // desenhar a logo do clube. Não é o assunto desta suíte, mas sem o mock
  // ela quebra inteira — e o erro fala de módulo, não de home.
  getMinhaEmpresa: () =>
    Promise.resolve({
      nome: "Smart Tennis",
      slug: "smart-tennis",
      logoUrl: null,
      status: "ativa",
      permiteAutoCadastro: true,
    }),
}));

const { savePapel } = await import("@/lib/auth-storage");
const { HomeView } = await import("./home-view");

const ALUNO = {
  id: "u1",
  nome: "Ana Souza",
  email: "ana@exemplo.com",
  role: "aluno" as const,
  companyId: "c1",
};

/**
 * **ACHADO 3 DA 3ª VALIDAÇÃO CRUZADA (ALTA) — a fixture agora é `MyClass`.**
 *
 * Ela era um objeto literal solto, e por isso o `tsc` não cobrava
 * `naoRealizada` — o campo que decide o destaque desta tela. Nenhuma prova
 * daqui podia falhar por causa dele: apagar a regra de produção deixava a
 * suíte verde.
 *
 * Ao tipar, o `tsc` reprovou de imediato: a fixture tinha `id`, um campo que
 * `AulaDoAlunoResponseDto` nunca teve, e não tinha `ocupacaoId` nem
 * `turmaId`. Era um retrato de um contrato que não existe.
 */
/**
 * **SPEC-057/TASK-003 — o relogio e fixado, e a fixture mora na semana dele.**
 *
 * A home passou a mostrar a SEMANA. Sem `setSystemTime`, a aula da fixture
 * cairia dentro ou fora da semana corrente conforme o dia em que a suite
 * rodasse — o sorteio que o DEF-020 ja custou caro duas vezes neste projeto.
 *
 * **2026-09-02 e uma QUARTA**; a semana vai de domingo 30/08 a sabado 05/09.
 */
const QUARTA = new Date("2026-09-02T15:00:00.000Z"); // 12h em Sao Paulo

const AULA: MyClass = {
  ocupacaoId: "oc1",
  turmaId: "t1",
  data: "2026-09-02",
  horaInicio: "08:00",
  horaFim: "09:00",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  turmaNome: "Turma A",
  naoRealizada: false,
      faltaAvisada: false,
};

describe("HomeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(QUARTA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * SPEC-058 — **a semana virou calendário, e o cartão voltou.** A busca
   * continua sendo UMA: ela cobre do primeiro dia do mês até 60 dias à
   * frente, e alimenta a grade e o cartão. Duas requisições no primeiro
   * desenho seriam uma regressão do que a SPEC-057 tinha conquistado.
   */
  it("AC-001/REQ-003: a home mostra o calendário E o cartão, com uma busca só", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([AULA]);

    render(<HomeView />);

    expect(
      await screen.findByRole("grid", { name: /Calendário de setembro/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sua próxima aula")).toBeInTheDocument();
    expect(listMyClassesMock).toHaveBeenCalledTimes(1);
    // A janela pedida cobre o mês inteiro, não só o futuro: o calendário
    // mostra os dias que já passaram.
    expect(listMyClassesMock.mock.calls[0][0]).toMatchObject({
      de: "2026-09-01",
    });
  });

  it.each([["company_admin"], ["super_admin"], ["professor"]])(
    "%s: NÃO chama a rota de aluno, e a home continua de pé",
    async (role) => {
      // A correção principal: não pedir o que o servidor vai recusar.
      getMeMock.mockResolvedValue({ ...ALUNO, role });

      render(<HomeView />);

      // A saudação aparece no `TopAppBar` e no hero — o que importa é que
      // a tela renderizou, não em quantos lugares.
      await waitFor(() => {
        expect(screen.getAllByText(/Olá, Ana/).length).toBeGreaterThan(0);
      });
      expect(listMyClassesMock).not.toHaveBeenCalled();
      expect(screen.queryByText(/Forbidden/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("falha ao carregar a agenda NÃO apaga a home", async () => {
    // O segundo defeito, isolado: antes, qualquer erro na agenda levava o
    // `getMe()` junto e a tela inteira sumia.
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockRejectedValue(new ApiErrorFalso(500, "Erro"));

    render(<HomeView />);

    expect((await screen.findAllByText(/Olá, Ana/)).length).toBeGreaterThan(0);
    // **AC-019** — este aviso morava DENTRO do hero, que a TASK-003 remove.
    // Se ele sair junto, a falha de agenda volta a ser silenciosa.
    expect(await screen.findByRole("status")).toHaveTextContent(
      /não foi possível carregar sua agenda/i,
    );
    // O aviso ocupa o lugar da agenda, não o lugar da tela.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  /**
   * **SPEC-030 / achado 3 da 3ª validação cruzada (ALTA).**
   *
   * A produção passou de `aulas[0]` para `aulas.find((a) => !a.naoRealizada)`
   * e **nenhuma das 263 provas caía se voltasse.** A lista vem ordenada por
   * data, então uma aula já declarada como NÃO REALIZADA ocupava o destaque
   * "Próxima aula" na primeira tela do app, e o aluno se organizava por ela.
   *
   * A ordem aqui é o que dá o julgamento: a não realizada vem PRIMEIRO. Com
   * ela em segundo, `aulas[0]` acertaria por acidente e a prova voltaria a
   * não provar nada.
   */
  it("SPEC-030 na semana: a não realizada APARECE, e aparece marcada", async () => {
    // **A regra mudou de lugar, não sumiu.** Sem o destaque "Próxima aula",
    // o risco da SPEC-030 deixa de ser "a não realizada virar destaque" e
    // passa a ser "a não realizada parecer uma aula normal na semana".
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([
      { ...AULA, turmaNome: "Turma Chuva", naoRealizada: true },
      { ...AULA, ocupacaoId: "oc2", turmaNome: "Turma B" },
    ]);

    render(<HomeView />);

    // O dia 02/09 é o de hoje na fixture, e abre selecionado.
    const grade = await screen.findByRole("region", { name: "Minhas aulas por mês" });
    expect(within(grade).getByText(/Turma Chuva/)).toBeInTheDocument();
    expect(within(grade).getByText("Aula não realizada")).toBeInTheDocument();
    expect(within(grade).getByText(/Turma B/)).toBeInTheDocument();
    // E ela NÃO vira a próxima aula do cartão (SPEC-030, achado ALTA): o
    // cartão aponta para a aula normal.
    const cartao = screen.getByRole("region", { name: "Sua próxima aula" });
    expect(within(cartao).getByText("Turma B")).toBeInTheDocument();
    expect(within(cartao).queryByText("Turma Chuva")).not.toBeInTheDocument();
  });

  // O par: a aula NORMAL não pode sair marcada. Sem ele, marcar todas
  // passaria na prova acima.
  it("a aula normal NÃO é marcada como não realizada", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([{ ...AULA, turmaNome: "Turma B" }]);

    render(<HomeView />);

    const grade = await screen.findByRole("region", { name: "Minhas aulas por mês" });
    expect(within(grade).getByText(/Turma B/)).toBeInTheDocument();
    expect(screen.queryByText("Aula não realizada")).not.toBeInTheDocument();
  });

  // Julgamento pedido na 3ª rodada e aceito como coerente: com TODAS as aulas
  // não realizadas, a home não inventa um destaque. Fica registrado em prova
  // porque "defensável" sem prova é só opinião — e o próximo a mexer aqui
  // precisa saber que o vazio é decisão, não descuido.
  it("agenda vazia: a semana aparece assim mesmo, com os dias livres", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([]);

    render(<HomeView />);

    expect(await screen.findByText("Nenhuma aula neste mês.")).toBeInTheDocument();
    // AC-007 — o cartão não some; ele convida.
    expect(screen.getByText("Nenhuma aula marcada")).toBeInTheDocument();
  });

  it("se o próprio `/auth/me` falhar com 403, a mensagem é humana", async () => {
    getMeMock.mockRejectedValue(new ApiErrorFalso(403, "Forbidden"));

    render(<HomeView />);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/sua conta não tem acesso/i);
    expect(alerta).not.toHaveTextContent(/forbidden/i);
  });
});

/**
 * SPEC-053/D4 — **a Home sem Quadras.** O "mudar tudo" do Israel vale inteiro
 * aqui: o atalho "Quadras" era duplicado (ia ao mesmo lugar que "Reservar"),
 * e os textos passam a falar de reserva, não de quadra.
 */
describe("SPEC-057/TASK-003 — a home abre na agenda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(QUARTA);
    getMeMock.mockResolvedValue(ALUNO);
    // **Fixture PREENCHIDA, de propósito.** A prova antiga da AC-001 usava
    // agenda vazia, e por isso passava sem nunca exercitar a semana — que é
    // justamente onde o nome da quadra apareceria.
    listMyClassesMock.mockResolvedValue([AULA]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * **AC-018 — a faixa de atalhos sai inteira.**
   *
   * Dois dos três eram duplicata literal do menu inferior: mesmo rótulo,
   * mesmo destino e mesmo ícone (`Aulas`→`/minhas-aulas`,
   * `Reservas`→`/reservas`). Encolher para um item deixaria uma faixa de um
   * item, que é decoração — o precedente do Admin (SPEC-052/D7) removeu a
   * faixa, não a encolheu.
   */
  /**
   * **A faixa e o card "Sua agenda" continuam fora; o cartão VOLTOU.**
   *
   * A SPEC-057/D13 tirou os três, e o card 5353 só pedia os atalhos
   * duplicados. O Israel reparou usando (*"o cartão tem que voltar, ele dá um
   * tchã no app"*) e a SPEC-058 o devolve — **outro**: ele diz quanto falta,
   * que é o que a grade não diz. Os atalhos duplicados seguem removidos,
   * porque aquilo o card pedia mesmo.
   */
  it("SPEC-058: a faixa e o card `Sua agenda` seguem fora; o cartão voltou", async () => {
    render(<HomeView />);
    await screen.findByRole("grid", { name: /Calendário/i });

    expect(screen.queryByRole("region", { name: "Atalhos" })).toBeNull();
    expect(screen.queryByText("Abrir agenda")).toBeNull();
    expect(screen.queryByText("Pronto para jogar?")).toBeNull();
    expect(screen.getByText("Sua próxima aula")).toBeInTheDocument();
  });

  it("AC-018: o que os atalhos levavam continua a um toque, no menu inferior", async () => {
    // **A barra lê o papel do `localStorage`, gravado no login** — sem isso
    // ela desenha a versão que não sabe quem é, e a prova mediria o mock, não
    // o produto. `savePapel` é o mesmo caminho que o login usa.
    savePapel("aluno");

    render(<HomeView />);
    await screen.findByRole("grid", { name: /Calendário/i });

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/minhas-aulas");
    expect(hrefs).toContain("/reservas");
    expect(hrefs).toContain("/reservas/nova");
  });

  it("AC-009: nenhum link da Home aponta para /quadras", async () => {
    render(<HomeView />);
    await screen.findByRole("grid", { name: /Calendário/i });

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.filter((h) => h?.startsWith("/quadras"))).toEqual([]);
  });

  /**
   * **AC-021 — e agora COM aula na tela.** `SemanaDoAluno` mostra o nome da
   * quadra ("Quadra 1") em cada aula; na home isso reintroduziria a palavra
   * que a SPEC-053/AC-001 tirou daqui. A ocultação é por contexto, não por
   * edição destrutiva do componente — a TASK-002 também mexe nele.
   */
  it("AC-021: a palavra `quadra` continua ausente, COM aula na tela", async () => {
    render(<HomeView />);
    await screen.findByRole("region", { name: "Minhas aulas por mês" });

    expect(screen.queryByText(/quadra/i)).not.toBeInTheDocument();
  });

  it("AC-021: e o texto de reserva continua lá", async () => {
    render(<HomeView />);
    await screen.findByRole("region", { name: "Minhas aulas por mês" });

    expect(screen.getByText("Reservas PlayCK")).toBeInTheDocument();
    expect(
      screen.getByText("Veja o que o clube oferece, com valores e horários."),
    ).toBeInTheDocument();
  });

  /**
   * SPEC-058/D1 — **um caminho só para a turma, e é o cartão.**
   *
   * A lista do dia na home não liga (`mostrarLinkDaTurma={false}`); o cartão
   * liga. Dois caminhos para o mesmo lugar na mesma tela foi exatamente o que
   * a SPEC-057/D13 tirou daqui, e não vale reintroduzir com outro nome.
   */
  it("a lista do dia não vira link; o cartão sim", async () => {
    render(<HomeView />);
    const grade = await screen.findByRole("region", { name: "Minhas aulas por mês" });
    const naGrade = within(grade).getByText(/Turma A/);

    expect(naGrade.closest("a")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Abrir Turma A/ }),
    ).toHaveAttribute("href", "/minhas-aulas/turma/t1");
  });
});
