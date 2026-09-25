import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
const listMyBookingsMock = vi.fn();

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
  listMyBookings: (...a: unknown[]) => listMyBookingsMock(...a),
  // SPEC-059: a home lê o termo que o clube deu aos tipos de reserva
  // (`lerNomesDeTipo` → `getPrazosDoClube`). Sem o mock, o vitest levanta
  // "No export is defined" como erro NÃO TRATADO: local a suíte fica verde e
  // o CI cai. Foi assim que este ciclo descobriu — é a mesma família do
  // `SUITE_EXIT` que o CLAUDE.md registra, ao contrário.
  getPrazosDoClube: () => Promise.resolve({}),
  // SPEC-065: o `TopAppBar` ganhou o sino, e o sino conta os nao lidos. Mesma
  // familia do `getPrazosDoClube` acima -- sem o mock o vitest levanta "No
  // export is defined" e esta suite inteira cai por uma barra que nao e o
  // assunto dela. Zero: home sem aviso nenhum e o estado neutro.
  getAvisosNaoLidos: () => Promise.resolve(0),
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
  // 16:00, e não 08:00: o relógio do teste marca 12h, e desde a correção do
  // corte (validação independente de 2026-09-18) uma aula encerrada não é
  // "próxima aula". A fixture dizia 08:00 e passava por causa do defeito.
  horaInicio: "16:00",
  horaFim: "17:00",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  turmaNome: "Turma A",
  naoRealizada: false,
      faltaAvisada: false,
};

/** SPEC-059 — uma reserva de quadra do próprio aluno, no mesmo dia da aula. */
const RESERVA = {
  id: "r1",
  companyId: "c1",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "07:00",
  horaFim: "08:00",
  origemTipo: "AVULSO",
  alunoId: "al1",
  alunoNome: "Ana",
  statusPagamento: "pendente_pagamento",
  valor: 120,
  adicionais: [],
  canceladaPorMim: null,
  tipo: "quadra",
  professorNome: null,
} as unknown as import("@/lib/api-client").ItemDaListaDeReservas;

describe("HomeView", () => {
  beforeEach(() => {
    // SPEC-073 — o papel guardado muda o caminho da home (D1/D2), e o
    // `savePapel` da AC-018 vazava para os casos seguintes.
    localStorage.clear();
    vi.clearAllMocks();
    listMyBookingsMock.mockResolvedValue({ itens: [], truncou: false });
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
    const grade = await screen.findByRole("region", { name: "Minha agenda por mês" });
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

    const grade = await screen.findByRole("region", { name: "Minha agenda por mês" });
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

    expect(
      await screen.findByText("Nenhum compromisso neste mês."),
    ).toBeInTheDocument();
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
    // SPEC-073 — o papel guardado muda o caminho da home (D1/D2), e o
    // `savePapel` da AC-018 vazava para os casos seguintes.
    localStorage.clear();
    vi.clearAllMocks();
    listMyBookingsMock.mockResolvedValue({ itens: [], truncou: false });
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
  /**
   * **SPEC-059/D3b — esta regra mudou, e o registro fica aqui.**
   *
   * A SPEC-053/AC-001 (decisão 6 do Israel) tirou a palavra "quadra" da home,
   * e esta prova garantia isso. Em 2026-09-18 ele pediu o oposto, olhando a
   * agenda: *"nas reservas tem que estar especificado o que é aula, o que é
   * reserva de quadra"* — e depois, sobre o nome: *"não importa o termo, se é
   * quadra ou se é outro, ele tem que aparecer na agenda"*.
   *
   * O pedido novo vence. O que **continua** valendo é o resto da SPEC-053: a
   * home não vira uma tela de quadras, e nenhum link aponta para `/quadras`
   * (AC-009, provado logo acima).
   */
  it("SPEC-059/D3b: a agenda diz o que é reserva de quadra", async () => {
    listMyBookingsMock.mockResolvedValue({ itens: [RESERVA], truncou: false });

    render(<HomeView />);
    await screen.findByRole("region", { name: "Minha agenda por mês" });

    expect(await screen.findByText(/^Reserva · /)).toBeInTheDocument();
    // Aparece duas vezes: na linha da reserva e na da aula de turma, que
    // também acontece numa quadra. É o pedido dele — *"não importa o termo…
    // ele tem que aparecer na agenda"* — e não um desenho duplicado.
    expect(screen.getAllByText(/Quadra 1/).length).toBeGreaterThan(0);
  });

  it("AC-021: e o texto de reserva continua lá", async () => {
    render(<HomeView />);
    await screen.findByRole("region", { name: "Minha agenda por mês" });

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
    const grade = await screen.findByRole("region", { name: "Minha agenda por mês" });
    const naGrade = within(grade).getByText(/Turma A/);

    expect(naGrade.closest("a")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Abrir Turma A/ }),
    ).toHaveAttribute("href", "/minhas-aulas/turma/t1");
  });
});

/** Promessa que o teste resolve quando quiser — é o que separa "em fila" de "junto". */
function adiada<T>() {
  let resolve!: (valor: T) => void;
  let reject!: (erro: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
}

/**
 * SPEC-073 — **a home que esperava em fila.**
 *
 * Eram três idas uma depois da outra: `me`, depois as aulas, depois as
 * reservas. As provas aqui penduram uma das pontas e olham se a outra já
 * saiu — é a única forma de distinguir "junto" de "em série" sem relógio.
 */
describe("SPEC-073 — a home não espera em fila", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    listMyBookingsMock.mockResolvedValue({ itens: [], truncou: false });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(QUARTA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-001/AC-002: com papel de aluno guardado, aulas E reservas saem antes do `getMe()` voltar, com a janela de sempre", async () => {
    savePapel("aluno");
    getMeMock.mockReturnValue(new Promise(() => {}));
    listMyClassesMock.mockResolvedValue([]);

    render(<HomeView />);

    await waitFor(() => expect(listMyClassesMock).toHaveBeenCalledTimes(1));
    expect(listMyBookingsMock).toHaveBeenCalledTimes(1);
    // 02/09 + 60 dias = 01/11. Adiantar não pode encurtar a janela do cartão.
    const janela = { de: "2026-09-01", ate: "2026-11-01" };
    expect(listMyClassesMock).toHaveBeenCalledWith(janela);
    expect(listMyBookingsMock).toHaveBeenCalledWith(janela);
  });

  it("AC-003: papel guardado de aluno, mas o `getMe()` diz gestor — nada da resposta adiantada aparece", async () => {
    savePapel("aluno");
    getMeMock.mockResolvedValue({ ...ALUNO, role: "company_admin" });
    listMyClassesMock.mockResolvedValue([AULA]);

    render(<HomeView />);

    await waitFor(() => {
      expect(screen.getAllByText(/Olá, Ana/).length).toBeGreaterThan(0);
    });
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    // O custo declarado (LIM-073a): a chamada aconteceu, o resultado não.
    expect(listMyClassesMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Turma A/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Sua próxima aula" })).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC-004: papel guardado de aluno e `getMe()` com 403 — a mensagem humana, e nenhuma aula adiantada", async () => {
    savePapel("aluno");
    getMeMock.mockRejectedValue(new ApiErrorFalso(403, "Forbidden"));
    listMyClassesMock.mockResolvedValue([AULA]);

    render(<HomeView />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /sua conta não tem acesso/i,
    );
    expect(screen.queryByText(/Turma A/)).toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("AC-005: sem papel guardado, as reservas saem sem esperar as aulas", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockReturnValue(new Promise(() => {}));

    render(<HomeView />);

    await waitFor(() => expect(listMyBookingsMock).toHaveBeenCalledTimes(1));
    expect(listMyClassesMock).toHaveBeenCalledTimes(1);
  });

  it("AC-006: a grade aparece antes do dado, e não diz vazio enquanto carrega", async () => {
    savePapel("aluno");
    const me = adiada<typeof ALUNO>();
    const aulas = adiada<MyClass[]>();
    getMeMock.mockReturnValue(me.promise);
    listMyClassesMock.mockReturnValue(aulas.promise);

    render(<HomeView />);

    expect(
      await screen.findByRole("grid", { name: /Calendário de setembro/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Carregando sua agenda…")).toBeInTheDocument();
    expect(screen.getByLabelText("Carregando sua próxima aula")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum compromisso neste mês.")).toBeNull();
    expect(screen.queryByText("Nenhuma aula marcada")).toBeNull();

    // Controle positivo: resolvida vazia, o vazio aparece. Sem este par,
    // apagar a frase de vez passaria na metade de cima.
    me.resolve(ALUNO);
    aulas.resolve([]);
    expect(
      await screen.findByText("Nenhum compromisso neste mês."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Carregando sua agenda…")).toBeNull();
  });

  /**
   * **AC-007 — a fixture tem de distinguir.** A aula é de OUTUBRO: uma aula de
   * setembro nunca apareceria na grade de outubro, com ou sem a guarda, e a
   * prova passaria sobre o defeito. Outubro responde vazio primeiro; a carga
   * inicial chega depois trazendo a aula do dia 15. Sem a guarda, o dia 15
   * ganharia a marca.
   */
  it("AC-007: a carga inicial que chega depois da troca de mês não pinta a grade, e alimenta o cartão", async () => {
    savePapel("aluno");
    const me = adiada<typeof ALUNO>();
    const inicial = adiada<MyClass[]>();
    getMeMock.mockReturnValue(me.promise);
    listMyClassesMock
      .mockReturnValueOnce(inicial.promise)
      .mockResolvedValueOnce([]);

    render(<HomeView />);
    await screen.findByRole("grid", { name: /Calendário de setembro/i });

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await screen.findByRole("grid", { name: /Calendário de outubro/i });
    await waitFor(() => expect(listMyClassesMock).toHaveBeenCalledTimes(2));

    me.resolve(ALUNO);
    inicial.resolve([
      { ...AULA, ocupacaoId: "oc-out", data: "2026-10-15", turmaNome: "Turma Outubro" },
    ]);

    const cartao = await screen.findByRole("region", { name: "Sua próxima aula" });
    expect(within(cartao).getByText("Turma Outubro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15, sem compromisso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "15: 1 compromisso" })).toBeNull();
  });
});
