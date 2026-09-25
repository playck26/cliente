import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { EXPLICACAO } from "@/lib/credito-utilizavel";
import { MyClassesList } from "./my-classes-list";

/**
 * SPEC-029 — **as provas do botão que o Israel pediu**, e do contrato da URL
 * por trás dele.
 *
 * O desenho da semana tem provas próprias em `semana-do-aluno.test.tsx`.
 * Aqui o que está sob teste é o alternador: quando ele aparece, o que ele
 * escreve no endereço, e que a vista padrão **não** suja a URL.
 */

const push = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ valor: null as string | null }));
const listMyClasses = vi.hoisted(() => vi.fn());
/**
 * SPEC-066/TASK-002 — **a lista trocou de rota.**
 *
 * Ela pedia `listMyClasses()` sem janela, que devolvia o futuro inteiro — a
 * origem das 40+ aulas que o usuario relatou. Agora pede
 * `listProximasAulas({page, pageSize: 10})`, que devolve
 * `{data, page, pageSize, total}`.
 *
 * `listMyClasses` continua mockada porque a vista de SEMANA a usa: ela busca
 * a propria janela desde a TASK-003.
 */
const listProximasAulas = vi.hoisted(() => vi.fn());
const avisarFalta = vi.hoisted(() => vi.fn());
const retirarAvisoDeFalta = vi.hoisted(() => vi.fn());
// SPEC-072/TASK-005 — a tela de Aulas passou a ler o credito e a marcar.
const getMeuCreditoDeReposicao = vi.hoisted(() => vi.fn());
const listarOportunidadesDeReposicao = vi.hoisted(() => vi.fn());
const marcarReposicao = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(params.valor ?? ""),
  usePathname: () => "/minhas-aulas",
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listMyClasses,
    listProximasAulas,
    avisarFalta,
    retirarAvisoDeFalta,
    getMeuCreditoDeReposicao,
    listarOportunidadesDeReposicao,
    marcarReposicao,
  };
});

const aula = {
  ocupacaoId: "o1",
  turmaId: "t1",
  turmaNome: "Iniciantes",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  naoRealizada: false,
  faltaAvisada: false,
};

/** A lista le uma pagina. Este auxiliar evita repetir a forma em cada caso. */
const pagina = (data: unknown[]) => ({
  data,
  page: 1,
  pageSize: 10,
  total: data.length,
});

beforeEach(() => {
  push.mockReset();
  params.valor = null;
  // **Sem credito por padrao**: as provas antigas nao sabem de reposicao, e
  // um botao novo aparecendo nelas mudaria o que elas medem.
  getMeuCreditoDeReposicao.mockReset().mockResolvedValue({
    creditos: 0,
    porMes: 2,
    validadeDias: 30,
    usadasNoMes: 0,
    faltas: [],
  });
  listarOportunidadesDeReposicao.mockReset().mockResolvedValue([]);
  marcarReposicao.mockReset().mockResolvedValue(undefined);
  listMyClasses.mockReset().mockResolvedValue([aula]);
  listProximasAulas.mockReset().mockResolvedValue({
    data: [aula],
    page: 1,
    pageSize: 10,
    total: 1,
  });
});

describe("quando o alternador aparece", () => {
  it("com aulas, os dois botões estão na tela", async () => {
    render(<MyClassesList />);

    expect(
      await screen.findByRole("button", { name: "Lista" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
  });

  it("sem aula nenhuma, não aparece", async () => {
    // Alternar entre duas telas vazias não é escolha — é um controle que
    // ocupa espaço e não faz nada.
    listProximasAulas.mockResolvedValue(pagina([]));
    render(<MyClassesList />);

    expect(
      await screen.findByText("Nenhuma aula agendada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Semana" }),
    ).not.toBeInTheDocument();
  });
});

describe("o que o botão escreve na URL", () => {
  it("ir para a semana põe `?vista=semana`", async () => {
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas?vista=semana", {
      scroll: false,
    });
  });

  it("voltar para a lista LIMPA o parâmetro", async () => {
    // A vista padrão fora do endereço: é o que a pessoa copia. Mesma decisão
    // de `abas-na-url.tsx`.
    params.valor = "vista=semana";
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Lista" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas", { scroll: false });
  });

  it("preserva o resto da query em vez de reescrever o endereço", async () => {
    // Se um dia a aba e a vista coexistirem na URL, trocar uma não pode
    // apagar a outra.
    params.valor = "aba=minhas";
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas?aba=minhas&vista=semana", {
      scroll: false,
    });
  });

  it("tocar na vista que já está ativa não navega", async () => {
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Lista" }));

    expect(push).not.toHaveBeenCalled();
  });
});

describe("qual vista é mostrada", () => {
  it("sem parâmetro, a LISTA", async () => {
    render(<MyClassesList />);

    expect(await screen.findByLabelText("Próximas aulas")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Minhas aulas por semana"),
    ).not.toBeInTheDocument();
  });

  it("com `?vista=semana`, o calendário", async () => {
    params.valor = "vista=semana";
    render(<MyClassesList />);

    expect(
      await screen.findByLabelText("Minhas aulas por semana"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Próximas aulas")).not.toBeInTheDocument();
  });

  it("valor estranho cai na lista, em silêncio", async () => {
    // `?vista=lixo` vem de URL editada à mão ou link velho. Punir a pessoa
    // por um endereço que nós mudamos seria o pior dos dois mundos.
    params.valor = "vista=lixo";
    render(<MyClassesList />);

    expect(await screen.findByLabelText("Próximas aulas")).toBeInTheDocument();
  });
});

// TEST (SPEC-030 / achado 2 da validação cruzada, ALTA) — o aluno vê que a
// aula não aconteceu.
//
// A dúvida 2 da spec decidiu isso e o campo nunca foi criado: em "Próximas" a
// aula seguia como "Agendada", e no dia seguinte sumia das "Anteriores"
// (`aulasAnteriores` filtra `nao_houve` para não oferecer avaliação). O aluno
// pode ter ido até o clube, e o produto nunca lhe dizia o que houve.
describe("SPEC-030 — a aula não realizada, na vista do aluno", () => {
  it("mostra 'Não realizada' no lugar de 'Agendada'", async () => {
    listProximasAulas.mockResolvedValue(
      pagina([{ ...aula, naoRealizada: true }]),
    );

    render(<MyClassesList />);

    expect(await screen.findByText("Não realizada")).toBeInTheDocument();
    expect(screen.queryByText("Agendada")).not.toBeInTheDocument();
  });

  it("a aula normal continua dizendo 'Agendada'", async () => {
    // O par negativo: sem ele, um selo que dissesse "Não realizada" sempre
    // passaria na prova acima.
    listProximasAulas.mockResolvedValue(pagina([aula]));

    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(screen.queryByText("Não realizada")).not.toBeInTheDocument();
  });
});

/**
 * SPEC-031/REQ-006 — **o aluno avisa que vai faltar.**
 *
 * O que este bloco guarda é o par que mais custa quando quebra: o botão diz a
 * verdade sobre o estado, e a tela **recarrega mesmo quando dá erro**.
 *
 * A segunda metade é a lição do `turmas-do-clube.tsx`, e ela vale aqui pelo
 * mesmo motivo: o prazo envelhece entre a pintura e o toque. Receber
 * `PRAZO_DE_CANCELAMENTO` e continuar mostrando o botão como antes seria a
 * tela insistindo numa informação que o servidor acabou de desmentir.
 */
describe("MyClassesList — avisar falta (REQ-006)", () => {
  const comAulas = (...as: (typeof aula)[]) => {
    listProximasAulas.mockResolvedValue(pagina(as));
  };
  const botao = () => screen.getByRole("button", { name: /falta/i });

  beforeEach(() => {
    avisarFalta.mockReset().mockResolvedValue(undefined);
    retirarAvisoDeFalta.mockReset().mockResolvedValue(undefined);
  });

  it("sem aviso: mostra Agendada e oferece Vou faltar", async () => {
    comAulas(aula);
    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avisar que vou faltar" }),
    ).toBeTruthy();
    expect(screen.queryByText("Falta avisada")).toBeNull();
  });

  it("com aviso: mostra Falta avisada e oferece Desfazer", async () => {
    comAulas({ ...aula, faltaAvisada: true });
    render(<MyClassesList />);

    expect(await screen.findByText("Falta avisada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desfazer aviso de falta" }),
    ).toBeTruthy();
    // "Agendada" some: dizer as duas coisas sobre o mesmo estado seria a tela
    // se contradizendo.
    expect(screen.queryByText("Agendada")).toBeNull();
  });

  it("tocar Vou faltar chama o POST com turma e ocorrência", async () => {
    comAulas(aula);
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    await vi.waitFor(() =>
      expect(avisarFalta).toHaveBeenCalledWith("t1", "o1"),
    );
    expect(retirarAvisoDeFalta).not.toHaveBeenCalled();
  });

  it("tocar Desfazer chama o DELETE, não o POST", async () => {
    comAulas({ ...aula, faltaAvisada: true });
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Desfazer aviso de falta" }),
    );

    await vi.waitFor(() =>
      expect(retirarAvisoDeFalta).toHaveBeenCalledWith("t1", "o1"),
    );
    expect(avisarFalta).not.toHaveBeenCalled();
  });

  /**
   * **A prova que justifica o bloco.** A mensagem vem do servidor porque só
   * ele sabe quantas horas o clube exige — e a tela recarrega, para não ficar
   * mostrando um botão que o servidor acabou de recusar.
   */
  it("recusa dentro do prazo: mostra a mensagem DO SERVIDOR e recarrega", async () => {
    comAulas(aula);
    const { ApiError } =
      await vi.importActual<typeof import("@/lib/api-client")>(
        "@/lib/api-client",
      );
    avisarFalta.mockRejectedValue(
      new ApiError(
        409,
        "Avisar ou retirar o aviso exige 2h de antecedência.",
        "PRAZO_DE_CANCELAMENTO",
      ),
    );
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "exige 2h de antecedência",
    );
    // duas: a carga inicial e a releitura depois do erro.
    //
    // **A rota mudou na SPEC-066/TASK-002**, e com ela o dublê que conta: a
    // lista le `listProximasAulas`. O que esta prova guarda continua sendo o
    // mesmo, e e o que importa — **recarregar mesmo quando da erro**, porque o
    // prazo envelhece entre a pintura e o toque.
    await vi.waitFor(() => expect(listProximasAulas).toHaveBeenCalledTimes(2));
  });

  /**
   * Compatibilidade de rollout: um back anterior à TASK-009a responde `200`
   * **sem** o campo. Ausência tem de ser lida como "não avisou" — nunca como
   * erro, nunca como avisado.
   */
  it("back antigo (sem o campo) é lido como não avisado, sem quebrar", async () => {
    // O campo é **omitido**, não posto como `false`: é assim que um back
    // anterior à TASK-009a responde.
    const semCampo = { ...aula };
    delete (semCampo as { faltaAvisada?: boolean }).faltaAvisada;
    comAulas(semCampo);
    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avisar que vou faltar" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /**
   * A aula que não aconteceu não oferece nada: avisar falta de aula que não
   * houve não tem sentido, e o servidor recusaria. Mesma regra da chamada —
   * a tela só não oferece o que seria recusado.
   */
  it("aula não realizada não oferece o botão", async () => {
    comAulas({ ...aula, naoRealizada: true });
    render(<MyClassesList />);

    expect(await screen.findByText("Não realizada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /falta/i })).toBeNull();
  });

  it("enquanto a ação está em voo o botão fica desabilitado", async () => {
    comAulas(aula);
    let liberar!: () => void;
    avisarFalta.mockImplementation(
      () => new Promise<void>((r) => (liberar = r)),
    );
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    await vi.waitFor(() => expect(botao()).toBeDisabled());
    liberar();
  });
});

/**
 * **SPEC-066/AC-003 — dez cartões, o paginador, e a tela que NÃO remonta.**
 *
 * A sentinela pedida pela AC é a **identidade do nó do DOM**: um valor posto
 * na montagem que só some se a montagem recomeçar. Se a página virasse
 * parâmetro de URL, ou se o `loading` voltasse a `true` a cada clique, a
 * `<section>` seria recriada e o `isConnected` do nó antigo cairia.
 *
 * É a razão de a página morar em `useState` e não no endereço — ao contrário
 * da `vista`, que mora na URL de propósito.
 */
describe("SPEC-066/AC-003 — a paginação da lista", () => {
  const dez = Array.from({ length: 10 }, (_, i) => ({
    ...aula,
    ocupacaoId: `o${i + 1}`,
  }));

  it("mostra dez cartões e o paginador quando há mais de uma página", async () => {
    listProximasAulas.mockResolvedValue({
      data: dez,
      page: 1,
      pageSize: 10,
      total: 43,
    });
    render(<MyClassesList />);

    await screen.findByLabelText("Próximas aulas");
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(
      screen.getByLabelText("Paginação de próximas aulas"),
    ).toBeInTheDocument();
  });

  it("com uma página só, o paginador não aparece", async () => {
    listProximasAulas.mockResolvedValue(pagina([aula]));
    render(<MyClassesList />);

    await screen.findByLabelText("Próximas aulas");
    // `Paginacao` se esconde sozinho desde a SPEC-027: aluno com poucas aulas
    // não vê nada de novo na tela.
    expect(
      screen.queryByLabelText("Paginação de próximas aulas"),
    ).not.toBeInTheDocument();
  });

  it("trocar de página pede a página NOVA ao servidor", async () => {
    listProximasAulas.mockResolvedValue({
      data: dez,
      page: 1,
      pageSize: 10,
      total: 43,
    });
    render(<MyClassesList />);
    await screen.findByLabelText("Próximas aulas");

    fireEvent.click(screen.getByLabelText("Próxima página de próximas aulas"));

    await vi.waitFor(() =>
      expect(listProximasAulas).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 10,
      }),
    );
  });

  it("e NÃO remonta a tela: a sentinela sobrevive", async () => {
    listProximasAulas.mockResolvedValue({
      data: dez,
      page: 1,
      pageSize: 10,
      total: 43,
    });
    render(<MyClassesList />);

    const sentinela = await screen.findByLabelText("Próximas aulas");

    fireEvent.click(screen.getByLabelText("Próxima página de próximas aulas"));
    await vi.waitFor(() => expect(listProximasAulas).toHaveBeenCalledTimes(2));

    // O MESMO nó, ainda no documento. Remontar criaria outro.
    expect(sentinela.isConnected).toBe(true);
    expect(screen.getByLabelText("Próximas aulas")).toBe(sentinela);
    // E o esqueleto não volta: ele é da primeira pintura, não da troca.
    expect(screen.queryByLabelText("Carregando aulas")).not.toBeInTheDocument();
  });
});

/**
 * SPEC-072/REQ-004 — **remarcar começa na tela de Aulas.**
 *
 * O terceiro pedido do Matheus. O que sustenta estes casos é a `TASK-001`: o
 * crédito passou a publicar `ocupacaoId`, e sem ele o casamento aula ↔ crédito
 * só daria por `turmaNome + data + horaInicio` — junção por texto de exibição,
 * que passa no teste e casa o crédito errado em produção (`INV-072c`).
 */
describe("SPEC-072/AC-007 — o botão só aparece com crédito UTILIZÁVEL", () => {
  const faltou = { ...aula, faltaAvisada: true };

  const falta = (patch: Record<string, unknown> = {}) => ({
    faltaId: "f1",
    ocupacaoId: "o1",
    turmaNome: "Iniciantes",
    data: "2026-09-02",
    horaInicio: "18:00",
    horaFim: "19:00",
    expiraEm: "2026-10-02",
    expirada: false,
    aulaCancelada: false,
    reposicao: null,
    ...patch,
  });

  const credito = (patch: Record<string, unknown> = {}) => ({
    creditos: 1,
    porMes: 2,
    validadeDias: 30,
    usadasNoMes: 0,
    faltas: [falta()],
    ...patch,
  });

  beforeEach(() => {
    listProximasAulas.mockResolvedValue(pagina([faltou]));
  });

  it("crédito válido: o botão aparece", async () => {
    getMeuCreditoDeReposicao.mockResolvedValue(credito());
    render(<MyClassesList />);

    expect(
      await screen.findByRole("button", { name: "Remarcar" }),
    ).toBeInTheDocument();
  });

  /**
   * **Um caso por motivo, e são CINCO.** A v1 listava três; os dois que
   * faltavam deixavam o aluno ver o botão e levar `409`. O quinto — o teto do
   * mês — é o achado B06, e o serviço o recusa desde sempre.
   */
  const MOTIVOS = [
    ["sem-falta", credito({ faltas: [] })],
    ["ja-reposta", credito({
      faltas: [
        falta({
          reposicao: {
            id: "r1",
            turmaNome: "Outra",
            data: "2026-09-10",
            horaInicio: "19:00",
          },
        }),
      ],
    })],
    ["aula-cancelada", credito({ faltas: [falta({ aulaCancelada: true })] })],
    ["expirada", credito({ faltas: [falta({ expirada: true })] })],
    ["teto-do-mes", credito({ usadasNoMes: 2, porMes: 2 })],
  ] as const;

  for (const [motivo, dados] of MOTIVOS) {
    it(`${motivo}: sem botão, e o MOTIVO aparece`, async () => {
      getMeuCreditoDeReposicao.mockResolvedValue(dados);
      render(<MyClassesList />);

      await screen.findByText("Iniciantes");
      expect(screen.queryByRole("button", { name: "Remarcar" })).toBeNull();
      // Aviso de falta sem caminho e sem explicação faz o aluno adivinhar por
      // que o direito dele não está ali.
      expect(
        await screen.findByText(EXPLICACAO[motivo]),
      ).toBeInTheDocument();
    });
  }

  it("sem ter avisado falta, não há botão nem explicação", async () => {
    listProximasAulas.mockResolvedValue(pagina([aula]));
    getMeuCreditoDeReposicao.mockResolvedValue(credito({ faltas: [] }));
    render(<MyClassesList />);

    await screen.findByText("Iniciantes");
    expect(screen.queryByRole("button", { name: "Remarcar" })).toBeNull();
    expect(screen.queryByText(EXPLICACAO["sem-falta"])).toBeNull();
  });

  /** O crédito é informação de OFERTA: se cair, a lista continua inteira. */
  it("a leitura do crédito falhar não derruba a lista — só fecha a oferta", async () => {
    getMeuCreditoDeReposicao.mockRejectedValue(new Error("rede"));
    render(<MyClassesList />);

    expect(await screen.findByText("Iniciantes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remarcar" })).toBeNull();
  });
});

describe("SPEC-072/AC-008 — sobe o faltaId DAQUELA ocupação", () => {
  /**
   * **Duas aulas indistinguíveis por texto**: mesma turma, mesma data, mesma
   * hora — e `ocupacaoId` diferentes. É o cenário que derruba a junção por
   * texto de exibição, e o schema não impede que ele exista.
   */
  const aulaA = { ...aula, ocupacaoId: "oc-A", faltaAvisada: true };
  const aulaB = { ...aula, ocupacaoId: "oc-B", faltaAvisada: true };

  beforeEach(() => {
    listProximasAulas.mockResolvedValue(pagina([aulaA, aulaB]));
    getMeuCreditoDeReposicao.mockResolvedValue({
      creditos: 2,
      porMes: 5,
      validadeDias: 30,
      usadasNoMes: 0,
      faltas: [
        {
          faltaId: "falta-de-A",
          ocupacaoId: "oc-A",
          turmaNome: "Iniciantes",
          data: "2026-09-02",
          horaInicio: "18:00",
          horaFim: "19:00",
          expiraEm: "2026-10-02",
          expirada: false,
          aulaCancelada: false,
          reposicao: null,
        },
        {
          faltaId: "falta-de-B",
          ocupacaoId: "oc-B",
          turmaNome: "Iniciantes",
          data: "2026-09-02",
          horaInicio: "18:00",
          horaFim: "19:00",
          expiraEm: "2026-10-02",
          expirada: false,
          aulaCancelada: false,
          reposicao: null,
        },
      ],
    });
    listarOportunidadesDeReposicao.mockResolvedValue([
      {
        ocupacaoId: "destino-1",
        turmaId: "t9",
        turmaNome: "Turma de Destino",
        nivelId: null,
        nivelNome: null,
        quadraNome: "Quadra 9",
        data: "2026-09-20",
        horaInicio: "20:00",
        horaFim: "21:00",
        vagas: 3,
      },
    ]);
  });

  it("a SEGUNDA aula manda a falta da SEGUNDA, e a asserção nomeia o id", async () => {
    render(<MyClassesList />);

    const botoes = await screen.findAllByRole("button", { name: "Remarcar" });
    expect(botoes).toHaveLength(2);

    fireEvent.click(botoes[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar" }));

    await waitFor(() => {
      expect(marcarReposicao).toHaveBeenCalledWith("falta-de-B", "destino-1");
    });
    // E não a da primeira, que um casamento por texto teria escolhido.
    expect(marcarReposicao).not.toHaveBeenCalledWith(
      "falta-de-A",
      "destino-1",
    );
  });
});

describe("SPEC-072/AC-009 — toda recusa do servidor APARECE", () => {
  const faltou = { ...aula, faltaAvisada: true };

  beforeEach(() => {
    listProximasAulas.mockResolvedValue(pagina([faltou]));
    getMeuCreditoDeReposicao.mockResolvedValue({
      creditos: 1,
      porMes: 2,
      validadeDias: 30,
      usadasNoMes: 0,
      faltas: [
        {
          faltaId: "f1",
          ocupacaoId: "o1",
          turmaNome: "Iniciantes",
          data: "2026-09-02",
          horaInicio: "18:00",
          horaFim: "19:00",
          expiraEm: "2026-10-02",
          expirada: false,
          aulaCancelada: false,
          reposicao: null,
        },
      ],
    });
    listarOportunidadesDeReposicao.mockResolvedValue([
      {
        ocupacaoId: "destino-1",
        turmaId: "t9",
        turmaNome: "Turma de Destino",
        nivelId: null,
        nivelNome: null,
        quadraNome: "Quadra 9",
        data: "2026-09-20",
        horaInicio: "20:00",
        horaFim: "21:00",
        vagas: 3,
      },
    ]);
  });

  const tentarMarcar = async () => {
    render(<MyClassesList />);
    fireEvent.click(await screen.findByRole("button", { name: "Remarcar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar" }));
  };

  /**
   * **O caso GENÉRICO é o mecanismo, e a lista é o extra.**
   *
   * Uma tela feita só de lista de códigos não alcança resposta sem `code`,
   * sem corpo, com código desconhecido, nem o que o back acrescentar depois —
   * são seis cenários em cinco códigos, mais as `NotFoundException` sem
   * código (`LIM-072f`).
   */
  it("código DESCONHECIDO: a mensagem do servidor aparece", async () => {
    marcarReposicao.mockRejectedValue(
      new ApiError(409, "Alguma regra nova recusou.", "CODIGO_QUE_NAO_EXISTE"),
    );

    await tentarMarcar();

    expect(
      await screen.findByText("Alguma regra nova recusou."),
    ).toBeInTheDocument();
  });

  it("SEM código: a mensagem do servidor aparece igual", async () => {
    marcarReposicao.mockRejectedValue(new ApiError(404, "Não encontrado."));

    await tentarMarcar();

    expect(await screen.findByText("Não encontrado.")).toBeInTheDocument();
  });

  it("erro que NÃO é do servidor: o padrão aparece, e não o silêncio", async () => {
    marcarReposicao.mockRejectedValue(new Error("rede caiu"));

    await tentarMarcar();

    expect(
      await screen.findByText("Não foi possível marcar a reposição."),
    ).toBeInTheDocument();
  });

  /** **E a tela não deixa o aluno achar que marcou.** */
  it("na recusa, o painel de escolha CONTINUA aberto", async () => {
    marcarReposicao.mockRejectedValue(new ApiError(409, "Esta aula já está cheia."));

    await tentarMarcar();

    expect(await screen.findByText("Esta aula já está cheia.")).toBeInTheDocument();
    // O "Marcar" ainda está lá: ninguém foi levado a achar que terminou.
    expect(screen.getByRole("button", { name: "Marcar" })).toBeInTheDocument();
    expect(
      screen.getByText("Escolha o horário da reposição"),
    ).toBeInTheDocument();
  });

  /** Os cinco nomeados, cujas mensagens precisam ser PRESERVADAS. */
  const NOMEADOS = [
    ["TURMA_INATIVA", "Esta turma está fora de operação."],
    ["OCUPACAO_CANCELADA", "Esta aula foi cancelada pelo clube."],
    ["PRAZO_DE_CANCELAMENTO", "Marcar reposição exige 24h de antecedência."],
    [
      "JA_MATRICULADO_NA_TURMA",
      "Você já faz parte desta turma — não precisa repor nela.",
    ],
    ["TURMA_SEM_VAGA", "Esta aula já está cheia. Escolha outro horário."],
  ] as const;

  for (const [codigo, mensagem] of NOMEADOS) {
    it(`${codigo}: a mensagem do servidor aparece INTEIRA`, async () => {
      marcarReposicao.mockRejectedValue(new ApiError(409, mensagem, codigo));

      await tentarMarcar();

      expect(await screen.findByText(mensagem)).toBeInTheDocument();
    });
  }

  it("marcando com sucesso, o painel fecha e a tela recarrega", async () => {
    await tentarMarcar();

    await waitFor(() => {
      expect(marcarReposicao).toHaveBeenCalledWith("f1", "destino-1");
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Escolha o horário da reposição"),
      ).toBeNull();
    });
  });

  it("zero horário com vaga é uma RESPOSTA, e ela é dita", async () => {
    listarOportunidadesDeReposicao.mockResolvedValue([]);
    render(<MyClassesList />);
    fireEvent.click(await screen.findByRole("button", { name: "Remarcar" }));

    expect(
      await screen.findByText("Nenhuma turma com vaga nos próximos dias."),
    ).toBeInTheDocument();
  });

  it("a recusa ao ABRIR a escolha também aparece", async () => {
    listarOportunidadesDeReposicao.mockRejectedValue(
      new ApiError(403, "Seu papel não pode isso."),
    );
    render(<MyClassesList />);
    fireEvent.click(await screen.findByRole("button", { name: "Remarcar" }));

    expect(
      await screen.findByText("Seu papel não pode isso."),
    ).toBeInTheDocument();
  });
});
