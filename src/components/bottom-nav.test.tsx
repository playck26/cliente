import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./bottom-nav";

/**
 * DEF-011 (2026-08-26) — **as provas da barra que prendia o professor.**
 *
 * O que aconteceu em produção: o professor entrou em `/perfil` para trocar
 * a própria foto, recebeu a barra do **aluno**, e ficou preso. Os cinco
 * itens dela são `@Roles('aluno')` no servidor, e `/minhas-turmas` — a tela
 * dele — não estava na barra. Cada toque levava a "Sua conta não tem acesso
 * a esta área", e não havia caminho de volta.
 *
 * O que estes testes guardam é que a barra **nunca ofereça o que o servidor
 * recusa**. É a regra que já estava escrita num comentário de
 * `minhas-turmas-view` e que este componente não conhecia.
 */

const getPapel = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/perfil",
}));
vi.mock("@/lib/auth-storage", () => ({ getPapel }));

beforeEach(() => {
  vi.clearAllMocks();
  getPapel.mockReturnValue(null);
});

/**
 * As rotas que o servidor recusa para `professor` — todas `@Roles('aluno')`.
 *
 * **`/quadras` saiu daqui na SPEC-022, e a razão importa mais que a
 * remoção.** Depois que ela deixou de estar na barra de qualquer papel,
 * mantê-la nesta lista faria este teste passar **por acidente**: ele
 * afirmaria que a barra do professor não oferece uma rota que ninguém
 * oferece mais. É o vão que o `TEST_PLAN.md` registrou em 2026-08-27 —
 * prova que continua verde depois de a coisa mudar não está aprovando nada.
 *
 * O que se guarda continua sendo a regra, não a lista: a barra do professor
 * não pode oferecer rota de aluno. `/reservas` ainda é uma delas.
 */
const PROIBIDAS_AO_PROFESSOR = ["/home", "/minhas-aulas", "/reservas"];

/**
 * Os destinos do aluno, em ordem de tela.
 *
 * **Eram três até 2026-08-29**, mais o botão central de reservar. A revisão
 * em produção derrubou o botão — com `/quadras` virando aba dentro de
 * `/reservas`, ele deixou de ser atalho e virou uma segunda porta para a
 * tela vizinha — e `/perfil` desceu do cabeçalho para a vaga que sobrou.
 */
const ABAS_DO_ALUNO = ["/home", "/minhas-aulas", "/reservas", "/perfil"];

const hrefs = () =>
  screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => h !== null);

describe("DEF-011 — a barra do professor", () => {
  it("NÃO oferece nenhuma rota que o servidor recusa", () => {
    render(<BottomNav papel="professor" />);

    for (const proibida of PROIBIDAS_AO_PROFESSOR) {
      expect(hrefs()).not.toContain(proibida);
    }
  });

  it("oferece o caminho de volta para as turmas — o que faltava", () => {
    // Era esta ausência que fazia "ficar preso": a tela do professor não
    // estava na barra que a própria tela dele vizinha renderizava.
    render(<BottomNav papel="professor" />);
    expect(hrefs()).toContain("/minhas-turmas");
  });

  it("oferece o perfil, que é a outra coisa que ele alcança", () => {
    render(<BottomNav papel="professor" />);
    expect(hrefs()).toContain("/perfil");
  });

  // A prova "NÃO tem o botão de reservar" foi REMOVIDA em 2026-08-29, e o
  // motivo importa mais que a remoção: o botão deixou de existir para
  // QUALQUER papel. Mantê-la faria este arquivo afirmar que a barra do
  // professor não oferece uma coisa que ninguém oferece — verde por
  // acidente, exatamente o vão que o `TEST_PLAN.md` registrou em
  // 2026-08-27. O que continua guardado é a regra, logo acima: a barra dele
  // não oferece rota de aluno.

  it("todo item que ela mostra é alcançável pelo professor", () => {
    // O outro lado da primeira asserção, e o mais durável: em vez de listar
    // o que não pode, exige que TUDO que aparece esteja na lista do que
    // pode. Um item novo errado cai aqui sem ninguém atualizar nada.
    const ALCANCAVEIS = ["/minhas-turmas", "/perfil"];
    render(<BottomNav papel="professor" />);

    expect(hrefs().length).toBeGreaterThan(0);
    for (const href of hrefs()) {
      expect(ALCANCAVEIS).toContain(href);
    }
  });
});

describe("a barra do aluno, quatro destinos (revisão de 2026-08-29)", () => {
  it("oferece exatamente Home, Aulas, Reservas e Perfil — e mais nada", () => {
    // O outro lado da asserção do professor, e o mais durável: em vez de
    // listar o que não pode aparecer, exige a lista inteira. Item novo
    // entra por aqui, não por acidente.
    render(<BottomNav papel="aluno" />);

    expect(hrefs()).toEqual(ABAS_DO_ALUNO);
  });

  it("NÃO tem mais o botão de reservar", () => {
    // Ele existiu entre a SPEC-022 e 2026-08-29. Esta prova guarda a
    // remoção: se alguém o trouxer de volta sem decidir isso, cai aqui.
    render(<BottomNav papel="aluno" />);

    expect(screen.queryByLabelText("Reservar quadra")).not.toBeInTheDocument();
    for (const href of hrefs()) {
      expect(href).not.toContain("?aba=");
    }
  });

  it("o perfil desceu do cabeçalho para a barra", () => {
    render(<BottomNav papel="aluno" />);

    expect(hrefs()).toContain("/perfil");
  });

  it("NÃO oferece mais /quadras — ela virou aba dentro de /reservas", () => {
    render(<BottomNav papel="aluno" />);

    for (const href of hrefs()) {
      expect(href.startsWith("/quadras")).toBe(false);
    }
  });

  it("sem prop, usa o papel guardado no login", () => {
    // É o que faz `/perfil` — a única tela que os dois dividem — acertar já
    // na primeira pintura, sem esperar o `getMe()`.
    getPapel.mockReturnValue("aluno");
    render(<BottomNav />);
    expect(hrefs()).toContain("/reservas");
  });

  it("company_admin e super_admin também caem na do aluno", () => {
    // Declarado, não esquecido: eles não usam este app. Se um dia usarem, é
    // aqui que a decisão precisa ser tomada — e este teste vai estar errado,
    // que é o jeito certo de uma decisão pendente se anunciar.
    render(<BottomNav papel="company_admin" />);
    expect(hrefs()).toContain("/reservas");
  });
});

describe("a barra NUNCA adivinha (correção de 2026-08-26, à noite)", () => {
  it("papel desconhecido: NÃO mostra a barra do aluno", () => {
    // A primeira versão do DEF-011 mostrava a do aluno enquanto não sabia,
    // com o argumento de que aluno é a maioria. O Israel viu o resultado:
    // no painel do professor, a barra do aluno piscava antes de virar a
    // certa. Menu que pisca e some é pior que menu nenhum — a pessoa toca
    // no que viu, e o alvo já mudou.
    getPapel.mockReturnValue(null);
    render(<BottomNav />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("papel desconhecido: ocupa o mesmo espaço, para a tela não pular", () => {
    getPapel.mockReturnValue(null);
    const { container } = render(<BottomNav />);

    const barra = container.querySelector('[aria-hidden="true"]');
    expect(barra).not.toBeNull();
    expect(barra?.className).toContain("h-[78px]");
  });

  it("o papel guardado do professor dá a barra dele, sem passar pela do aluno", () => {
    getPapel.mockReturnValue("professor");
    render(<BottomNav />);

    expect(hrefs()).toContain("/minhas-turmas");
    // `/reservas` e não `/quadras`: depois da SPEC-022, `/quadras` não está
    // na barra de ninguém, e afirmar a ausência dela não provaria nada.
    expect(hrefs()).not.toContain("/reservas");
  });

  it("a PROP ganha do armazenamento", () => {
    // `/minhas-turmas` passa `"professor"` literal porque a rota é dele por
    // definição. Se o armazenamento estivesse velho — outra pessoa usou o
    // navegador antes —, quem manda é a tela.
    getPapel.mockReturnValue("aluno");
    render(<BottomNav papel="professor" />);

    expect(hrefs()).toContain("/minhas-turmas");
    // `/reservas` e não `/quadras`: depois da SPEC-022, `/quadras` não está
    // na barra de ninguém, e afirmar a ausência dela não provaria nada.
    expect(hrefs()).not.toContain("/reservas");
  });

  it("valor estranho no armazenamento não vira barra de aluno por acidente", () => {
    // `getPapel()` valida antes de devolver, então lixo chega como `null`.
    // Este teste guarda o CONTRATO: quem consome trata `null` como "não
    // sei", nunca como "aluno".
    getPapel.mockReturnValue(null);
    render(<BottomNav />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
