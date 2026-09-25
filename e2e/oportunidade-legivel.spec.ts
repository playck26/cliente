/**
 * SPEC-072/AC-006 — **a informação da oportunidade aparece INTEIRA, por
 * geometria.**
 *
 * ## Por que esta prova não podia ser de texto
 *
 * A v1 desta spec ia fechar a queixa do Matheus — *"a informação da aula fica
 * cortada"* — com uma asserção de campo: *"o `horaFim` está no texto"*. O
 * validador independente mostrou o furo, e ele tem quatro formas:
 *
 *   1. `overflow:hidden` num **ancestral** corta sem que o elemento saiba;
 *   2. o texto passa **por baixo do botão** "Marcar";
 *   3. a largura não cabe e o `truncate` come o fim com reticências;
 *   4. nada disso acontece, e a **página inteira** ganha rolagem horizontal —
 *      trocar clipping por rolagem não é conserto.
 *
 * **As quatro deixam uma asserção de texto verde.** As quatro ficam vermelhas
 * aqui, porque aqui há layout calculado.
 *
 * ## O conteúdo é LONGO de propósito
 *
 * Nome de turma, quadra e nível grandes — é o caso em que a linha estoura. Uma
 * fixture curta caberia a 320px **mesmo com o `truncate` de volta**, e a prova
 * passaria sem medir nada.
 *
 * ## O servidor não existe aqui
 *
 * `page.route()` responde as quatro chamadas da tela. A `AC-006` é sobre
 * **layout**, não sobre o servidor — e o `NEXT_PUBLIC_API_URL` da configuração
 * aponta para porta morta justamente para que uma chamada não interceptada
 * falhe em vez de passar por acidente.
 */
import { expect, test, type Page } from "@playwright/test";

const LARGURA = 320;

/**
 * O que a API de verdade devolve (SPEC-070): origem explícita, credenciais
 * permitidas e o preflight cacheado. Aqui o `*` basta porque não há cookie em
 * jogo — o token vai no cabeçalho.
 */
const CABECALHOS_DE_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "600",
};

/** Longos de propósito: é o caso em que a linha estoura. */
const TURMA = "Iniciantes Avançados de Quinta-feira à Noite";
const QUADRA = "Quadra Poliesportiva Coberta 3";
const NIVEL = "Intermediário Superior";
const DATA = "2026-10-15";
const INICIO = "19:00";
const FIM = "20:30";

const FALTA = {
  faltaId: "11111111-1111-4111-8111-111111111111",
  ocupacaoId: "22222222-2222-4222-8222-222222222222",
  turmaNome: "Turma de Origem",
  data: "2026-10-01",
  horaInicio: "19:00",
  horaFim: "20:00",
  expiraEm: "2026-10-31",
  expirada: false,
  aulaCancelada: false,
  reposicao: null,
};

const OPORTUNIDADE = {
  ocupacaoId: "33333333-3333-4333-8333-333333333333",
  turmaId: "44444444-4444-4444-8444-444444444444",
  turmaNome: TURMA,
  nivelId: null,
  nivelNome: NIVEL,
  quadraNome: QUADRA,
  data: DATA,
  horaInicio: INICIO,
  horaFim: FIM,
  vagas: 2,
};

/**
 * **As rotas que a tela de perfil pede — levantadas instrumentando o
 * navegador, não supostas.**
 *
 * São oito, e sete delas nada têm a ver com reposição: a tela monta empresa,
 * foto, carteira, matrícula, cadastro e contagem de avisos. Faltar uma não dá
 * erro discreto — **derruba a seção inteira**, e foi assim que a primeira
 * versão desta prova ficou sem o bloco "Aulas para repor".
 */
const RESPOSTAS: Record<string, Record<string, unknown> | unknown[] | null> = {
  "/api/v1/auth/me": {
    id: "55555555-5555-4555-8555-555555555555",
    nome: "Aluna de Teste",
    email: "aluna@teste.local",
    role: "aluno",
  },
  "/api/v1/me/company": {
    id: "66666666-6666-4666-8666-666666666666",
    nome: "PlayCK Club",
    slug: "playck-club",
    status: "ativa",
    permiteAutoCadastro: true,
    limiteTurmasPorAluno: 3,
    logoUrl: null,
  },
  "/api/v1/me/foto": { url: null },
  "/api/v1/me/creditos": { saldoCentavos: 0, movimentos: [] },
  "/api/v1/me/matricula": null,
  // **O contrato inteiro, não o campo que eu queria.** `{ nivelId: null }`
  // derrubava a página com `Cannot destructure property 'percentual' of
  // 'e.cadastro'`: o `AlunoResponseDto` exige 14 campos, e `cadastro` é um
  // objeto. Fixture pela metade não dá erro de fixture — dá boundary de erro,
  // e eu perdi duas rodadas achando que era CORS.
  "/api/v1/me/cadastro": {
    id: "77777777-7777-4777-8777-777777777777",
    nome: "Aluna de Teste",
    email: "aluna@teste.local",
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
    cadastro: { percentual: 100, faltam: [] },
  },
  "/api/v1/me/avisos/nao-lidos": { naoLidos: 0 },
  "/api/v1/me/reposicoes": {
    creditos: 1,
    porMes: 2,
    validadeDias: 30,
    usadasNoMes: 0,
    faltas: [FALTA],
  },
  "/api/v1/me/reposicoes/oportunidades": [OPORTUNIDADE],
};

/**
 * **Um só lugar responde por toda a API, e o que não for previsto vira `404`
 * explícito.** Devolver `{}` para rota desconhecida esconderia uma chamada
 * nova atrás de um estado vazio plausível.
 *
 * ## O CORS aqui não é detalhe — foi o que derrubou a primeira versão
 *
 * A app é servida em `127.0.0.1:3101` e chama a API em outra origem. É a
 * forma REAL de produção (front na Netlify, API na DigitalOcean), e o
 * navegador a trata como tal: sem `Access-Control-Allow-Origin` na resposta,
 * e sem responder ao **preflight** que o cabeçalho `Authorization` obriga, o
 * `fetch` falha e a tela inteira vira o boundary de erro.
 *
 * A primeira versão deste arquivo não fazia nem uma coisa nem outra, e os
 * cinco casos morreram no `beforeEach` com *"This page couldn't load"*.
 * **O jsdom nunca teria mostrado isso** — ele não aplica CORS. É mais uma
 * coisa que só a prova de navegador alcança.
 */
async function comServidorDeMentira(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("playck_cliente_access_token", "token-de-e2e");
    window.localStorage.setItem("playck_cliente_papel", "aluno");
  });

  await page.route("**/api/v1/**", async (rota) => {
    const requisicao = rota.request();
    const caminho = new URL(requisicao.url()).pathname;

    // O `Authorization` do `authFetch` torna a requisição "não simples": o
    // navegador manda `OPTIONS` antes, e sem resposta a ele nada acontece.
    if (requisicao.method() === "OPTIONS") {
      await rota.fulfill({ status: 204, headers: CABECALHOS_DE_CORS });
      return;
    }
    const corpo = RESPOSTAS[caminho] ?? null;

    // **`null` é resposta válida para `/me/matricula`** (aluna sem matrícula),
    // e também é o que uma rota desconhecida produz. Quem distingue é a
    // PRESENÇA da chave — sem isto, mocar `null` viraria 404 em silêncio.
    if (!(caminho in RESPOSTAS)) {
      await rota.fulfill({
        status: 404,
        contentType: "application/json",
        headers: CABECALHOS_DE_CORS,
        body: JSON.stringify({ message: `rota nao prevista no e2e: ${caminho}` }),
      });
      return;
    }
    await rota.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CABECALHOS_DE_CORS,
      body: JSON.stringify(corpo),
    });
  });
}

/**
 * Percorre os ancestrais e devolve o primeiro que **corta** o elemento — o
 * furo nº 1, que nenhuma asserção de texto enxerga.
 */
const ANCESTRAL_QUE_CORTA = (el: Element): string | null => {
  const meu = el.getBoundingClientRect();
  let pai = el.parentElement;
  while (pai) {
    const estilo = getComputedStyle(pai);
    const esconde = (v: string) => v === "hidden" || v === "clip";
    if (esconde(estilo.overflowX) || esconde(estilo.overflowY)) {
      const dele = pai.getBoundingClientRect();
      const folga = 1;
      if (
        meu.left < dele.left - folga ||
        meu.right > dele.right + folga ||
        meu.top < dele.top - folga ||
        meu.bottom > dele.bottom + folga
      ) {
        return `${pai.tagName}.${pai.className}`;
      }
    }
    pai = pai.parentElement;
  }
  return null;
};

test.describe("AC-006 — a oportunidade cabe na tela de 320px", () => {
  test.beforeEach(async ({ page }) => {
    await comServidorDeMentira(page);
    await page.goto("/perfil");
    await page.getByRole("button", { name: "Repor" }).click();
    await expect(page.getByText(TURMA)).toBeVisible();
  });

  /** **REQ-003 — os seis campos estão lá, inclusive o `horaFim`.** */
  test("os seis campos aparecem, e a faixa de hora tem FIM", async ({
    page,
  }) => {
    const linha = page.getByText(new RegExp(QUADRA.slice(0, 12)));
    const texto = (await linha.textContent()) ?? "";

    expect(texto).toContain("15/10/2026");
    expect(texto).toContain(INICIO);
    // O `horaFim` é o campo que a tela DESCARTAVA, embora o DTO o publique.
    expect(texto).toContain(FIM);
    expect(texto).toContain(QUADRA);
    expect(texto).toContain("2 vagas");
    expect(texto).toContain(NIVEL);
    await expect(page.getByText(TURMA)).toBeVisible();
  });

  /**
   * **Furo nº 3 — o `truncate`.** Um elemento cortado por
   * `text-overflow: ellipsis` tem `scrollWidth` MAIOR que `clientWidth`: é a
   * assinatura geométrica exata do corte, e é o que a asserção de texto não vê.
   */
  test("nenhum campo é cortado dentro do próprio elemento", async ({
    page,
  }) => {
    for (const alvo of [TURMA, QUADRA.slice(0, 12)]) {
      const medida = await page
        .getByText(new RegExp(alvo.slice(0, 12)))
        .evaluate((el) => ({
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
        }));

      expect(medida.clientW).toBeGreaterThan(0);
      expect(medida.scrollW).toBeLessThanOrEqual(medida.clientW + 1);
      expect(medida.scrollH).toBeLessThanOrEqual(medida.clientH + 1);
    }
  });

  /** **Furo nº 1 — o ancestral que corta sem o elemento saber.** */
  test("nenhum ancestral com overflow escondido corta o texto", async ({
    page,
  }) => {
    for (const alvo of [TURMA, QUADRA.slice(0, 12)]) {
      const culpado = await page
        .getByText(new RegExp(alvo.slice(0, 12)))
        .evaluate(ANCESTRAL_QUE_CORTA);
      expect(culpado).toBeNull();
    }
  });

  /** **Furo nº 2 — o texto por baixo do botão.** */
  test('o texto não cruza com o botão "Marcar"', async ({ page }) => {
    const botao = await page
      .getByRole("button", { name: "Marcar" })
      .boundingBox();
    expect(botao).not.toBeNull();

    for (const alvo of [TURMA, QUADRA.slice(0, 12)]) {
      const caixa = await page
        .getByText(new RegExp(alvo.slice(0, 12)))
        .boundingBox();
      expect(caixa).not.toBeNull();

      const cruza =
        caixa!.x < botao!.x + botao!.width &&
        caixa!.x + caixa!.width > botao!.x &&
        caixa!.y < botao!.y + botao!.height &&
        caixa!.y + caixa!.height > botao!.y;
      expect(cruza).toBe(false);

      // E cabe na tela: nem começa fora, nem termina fora.
      expect(caixa!.x).toBeGreaterThanOrEqual(-1);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(LARGURA + 1);
    }
  });

  /** **Furo nº 4 — trocar corte por rolagem não é conserto.** */
  test("a página não ganha rolagem horizontal", async ({ page }) => {
    const medida = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));

    expect(medida.janela).toBe(LARGURA);
    expect(medida.scroll).toBeLessThanOrEqual(medida.janela + 1);
  });
});
