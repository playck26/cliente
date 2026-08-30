import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
const AULA: MyClass = {
  ocupacaoId: "oc1",
  turmaId: "t1",
  data: "2026-09-01",
  horaInicio: "08:00",
  horaFim: "09:00",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  turmaNome: "Turma A",
  naoRealizada: false,
};

describe("HomeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aluno: busca as aulas e mostra a próxima", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([AULA]);

    render(<HomeView />);

    expect(await screen.findByText("Turma A")).toBeInTheDocument();
    expect(listMyClassesMock).toHaveBeenCalledTimes(1);
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
  it("a aula NÃO REALIZADA não vira `Próxima aula`, mesmo vindo primeiro", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([
      { ...AULA, turmaNome: "Turma Chuva", naoRealizada: true },
      { ...AULA, ocupacaoId: "oc2", turmaNome: "Turma B" },
    ]);

    render(<HomeView />);

    expect(await screen.findByText("Turma B")).toBeInTheDocument();
    expect(screen.queryByText("Turma Chuva")).not.toBeInTheDocument();
  });

  // O par: a aula normal em primeiro continua sendo a destacada. Sem ele, um
  // `find` invertido — que escolhesse justamente a não realizada — passaria
  // na prova acima.
  it("a aula normal em primeiro continua sendo a destacada", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([
      { ...AULA, turmaNome: "Turma B" },
      { ...AULA, ocupacaoId: "oc2", turmaNome: "Turma Chuva", naoRealizada: true },
    ]);

    render(<HomeView />);

    expect(await screen.findByText("Turma B")).toBeInTheDocument();
    expect(screen.getByText("Próxima aula")).toBeInTheDocument();
  });

  // Julgamento pedido na 3ª rodada e aceito como coerente: com TODAS as aulas
  // não realizadas, a home não inventa um destaque. Fica registrado em prova
  // porque "defensável" sem prova é só opinião — e o próximo a mexer aqui
  // precisa saber que o vazio é decisão, não descuido.
  it("com TODAS não realizadas, não há destaque — e a home não quebra", async () => {
    getMeMock.mockResolvedValue(ALUNO);
    listMyClassesMock.mockResolvedValue([
      { ...AULA, turmaNome: "Turma Chuva", naoRealizada: true },
    ]);

    render(<HomeView />);

    expect(await screen.findByText("Sua agenda")).toBeInTheDocument();
    expect(screen.getByText("Pronto para jogar?")).toBeInTheDocument();
    expect(screen.queryByText("Turma Chuva")).not.toBeInTheDocument();
    expect(screen.queryByText("Próxima aula")).not.toBeInTheDocument();
  });

  it("se o próprio `/auth/me` falhar com 403, a mensagem é humana", async () => {
    getMeMock.mockRejectedValue(new ApiErrorFalso(403, "Forbidden"));

    render(<HomeView />);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/sua conta não tem acesso/i);
    expect(alerta).not.toHaveTextContent(/forbidden/i);
  });
});
