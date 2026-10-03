import type { BrowserContext, Locator, Page } from "@playwright/test";

/**
 * SPEC-084 (NFR-001, TEST-002) — **o medidor de contraste do login.**
 *
 * ## Por que existe
 *
 * O texto do login fica sobre uma fotografia. A regra `color-contrast` do
 * axe marca texto sobre `background-image` como *incomplete*, e o Lighthouse
 * só reprova *violations*: a ferramenta comum dá 100 com o título ilegível em
 * cima do sol (DOR-084-R1-03). Daqui o medidor próprio, que olha os PIXELS.
 *
 * ## Como mede
 *
 * 1. Para cada texto, guarda a cor computada, a opacidade acumulada e as
 *    caixas das LINHAS de texto (`Range.getClientRects`), não a caixa do
 *    elemento — um `<h1>` em bloco ocupa a largura toda, e o sol à direita da
 *    última letra não está atrás de texto nenhum.
 * 2. Esconde só glifos e ícones (`-webkit-text-fill-color`, `svg`), sem
 *    mexer em superfície nem borda — `color` não muda, porque no Tailwind 4 a
 *    borda padrão é `currentColor` e sumiria junto.
 * 3. Captura a página e lê, pixel a pixel, o fundo que estava atrás de cada
 *    linha.
 * 4. Compõe a cor do texto (com o alfa dele) sobre cada pixel, em sRGB — que é
 *    como o navegador compõe —, e só então calcula a luminância WCAG. Fica o
 *    MENOR resultado: basta um pixel claro para reprovar.
 *
 * Texto com `filter`, `mix-blend-mode`, `text-shadow`, contorno ou
 * `background-clip: text` (no próprio elemento ou num ancestral) dá
 * **inconclusivo**, nunca aprovado: o medidor não sabe compor esses casos.
 *
 * Bordas e foco são medidos por linhas de varredura perpendiculares a cada
 * lado: o trecho da borda (ou do anel) contra o que está imediatamente fora e
 * imediatamente dentro dele.
 *
 * A matemática (abaixo, funções puras) tem autoteste em
 * `src/lib/login-contrast.test.ts`; o esconder-glifos tem autoteste de
 * navegador em `e2e/login-visual.spec.ts`.
 */

export type Cor = [number, number, number];
export type CorComAlfa = [number, number, number, number];

function canalLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminancia([r, g, b]: Cor): number {
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

export function razao(a: Cor, b: Cor): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Cor com alfa sobre um fundo opaco, composta em sRGB (como o navegador). */
export function compor([r, g, b, a]: CorComAlfa, [fr, fg, fb]: Cor): Cor {
  return [r * a + fr * (1 - a), g * a + fg * (1 - a), b * a + fb * (1 - a)];
}

/** A menor razão do texto contra cada pixel de fundo — basta um claro para cair. */
export function menorRazao(texto: CorComAlfa, fundos: Cor[]): number {
  let menor = Infinity;
  for (const fundo of fundos) {
    const r = razao(compor(texto, fundo), fundo);
    if (r < menor) menor = r;
  }
  return menor;
}

/** 4,5:1, ou 3:1 para texto grande (≥ 24 px, ou ≥ 18,66 px em negrito). */
export function limiteDoTexto(fontePx: number, negrito: boolean): number {
  return fontePx >= 24 || (negrito && fontePx >= 18.66) ? 3 : 4.5;
}

/**
 * Uma linha de varredura, de FORA para DENTRO de um lado do elemento. Acha o
 * trecho que mais contrasta com o fundo de fora (a borda ou o anel de foco) e
 * devolve a menor razão dele contra o vizinho de fora e o de dentro. `null` se
 * a janela não tem vizinho dos dois lados.
 */
export function razaoDaFaixa(linha: Cor[]): number | null {
  if (linha.length < 3) return null;
  const fora = linha[0];
  let nucleo = 0;
  let maior = -1;
  linha.forEach((px, i) => {
    const r = razao(px, fora);
    if (r > maior) {
      maior = r;
      nucleo = i;
    }
  });
  // Um pixel é da faixa se estiver mais perto do núcleo do que do fundo de
  // fora. Limiar fixo não serve: numa borda fraca tudo parece "igual", a faixa
  // engoliria a linha inteira e a medida viraria inconclusiva em vez de
  // reprovada. Assim, o meio-tom do antisserrilhado entra na faixa, e o
  // afastamento escuro de um anel com offset fica fora dela.
  const daFaixa = (px: Cor) => razao(px, linha[nucleo]) < razao(px, fora);
  let inicio = nucleo;
  let fim = nucleo;
  while (inicio - 1 >= 0 && daFaixa(linha[inicio - 1])) inicio--;
  while (fim + 1 < linha.length && daFaixa(linha[fim + 1])) fim++;
  if (inicio - 1 < 0 || fim + 1 >= linha.length) return null;
  return Math.min(
    razao(linha[nucleo], linha[inicio - 1]),
    razao(linha[nucleo], linha[fim + 1]),
  );
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

type Caixa = { x: number; y: number; w: number; h: number };

type Segmento = {
  texto: string;
  cor: CorComAlfa;
  fontePx: number;
  negrito: boolean;
  caixas: Caixa[];
  inconclusivo?: string;
};

export type ResultadoDeTexto = {
  rotulo: string;
  texto: string;
  razao: number;
  limite: number;
  pixels: number;
  passou: boolean;
  inconclusivo?: string;
};

export type ResultadoDeFaixa = {
  rotulo: string;
  razao: number;
  linhas: number;
  passou: boolean;
  inconclusivo?: string;
};

/**
 * Os textos de um elemento, um segmento por nó de texto (e um para o valor ou
 * o placeholder de um `<input>`), com caixas em coordenadas da PÁGINA.
 */
async function coletarTextos(alvo: Locator): Promise<Segmento[]> {
  return alvo.evaluate((raiz: Element) => {
    /**
     * A cor computada, convertida para sRGB de 8 bits pelo PRÓPRIO navegador
     * (canvas). Não dá para ler com expressão regular: o Tailwind 4 escreve
     * `text-white/60` como `color-mix(in oklab, …)`, e a cor computada volta
     * em `oklab(…)`. A primeira versão deste medidor lia só `rgb()`, caía em
     * preto em silêncio e "media" um texto que não existia. Cor que o canvas
     * não entende devolve `null`, e o segmento fica INCONCLUSIVO.
     */
    const tela = document.createElement("canvas");
    tela.width = 1;
    tela.height = 1;
    const ctx = tela.getContext("2d", { willReadFrequently: true })!;
    function rgba(texto: string): [number, number, number, number] | null {
      const sentinela = "#010203";
      ctx.fillStyle = sentinela;
      ctx.fillStyle = texto;
      if (ctx.fillStyle === sentinela && texto.replace(/\s/g, "") !== "rgb(1,2,3)") return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    }
    function problema(el: Element): string | undefined {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.filter !== "none") return `filter em ${n.tagName}`;
        if (s.mixBlendMode !== "normal") return `mix-blend-mode em ${n.tagName}`;
        if (n === el) {
          if (s.textShadow !== "none") return "text-shadow";
          if (s.webkitTextStrokeWidth && parseFloat(s.webkitTextStrokeWidth) > 0) return "contorno";
          if (s.backgroundClip === "text") return "background-clip: text";
        }
      }
      return undefined;
    }
    function opacidade(el: Element): number {
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) {
        o *= parseFloat(getComputedStyle(n).opacity);
      }
      return o;
    }
    const dx = window.scrollX;
    const dy = window.scrollY;
    const caixa = (r: DOMRect) => ({ x: r.left + dx, y: r.top + dy, w: r.width, h: r.height });
    const segmentos: {
      texto: string;
      cor: [number, number, number, number];
      fontePx: number;
      negrito: boolean;
      caixas: { x: number; y: number; w: number; h: number }[];
      inconclusivo?: string;
    }[] = [];

    function adicionar(el: Element, texto: string, caixas: DOMRect[], cor?: string) {
      const s = getComputedStyle(el);
      const bruta = cor ?? s.color;
      const c = rgba(bruta);
      const validas = caixas.filter((r) => r.width > 0 && r.height > 0).map(caixa);
      segmentos.push({
        texto: texto.trim().slice(0, 60),
        cor: c ? [c[0], c[1], c[2], c[3] * opacidade(el)] : [0, 0, 0, 0],
        fontePx: parseFloat(s.fontSize),
        negrito: parseInt(s.fontWeight, 10) >= 700,
        caixas: validas,
        inconclusivo:
          problema(el) ??
          (c ? undefined : `cor que o medidor não lê: ${bruta}`) ??
          (validas.length === 0 ? "sem caixa visível" : undefined),
      });
    }

    if (raiz instanceof HTMLInputElement) {
      const r = raiz.getBoundingClientRect();
      const s = getComputedStyle(raiz);
      const conteudo = new DOMRect(
        r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft),
        r.top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop),
        r.width - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth) - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
        r.height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth) - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom),
      );
      if (raiz.value) adicionar(raiz, raiz.value, [conteudo]);
      else if (raiz.placeholder)
        adicionar(raiz, raiz.placeholder, [conteudo], getComputedStyle(raiz, "::placeholder").color);
      return segmentos;
    }

    const andarilho = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
      if (!no.textContent || !no.textContent.trim()) continue;
      const pai = no.parentElement!;
      const faixa = document.createRange();
      faixa.selectNodeContents(no);
      adicionar(pai, no.textContent, [...faixa.getClientRects()]);
    }
    return segmentos;
  });
}

const ESTILO_ID = "medidor-de-contraste-spec-084";

async function esconderGlifos(page: Page, esconder: boolean) {
  await page.evaluate(
    ([id, ligar]) => {
      document.getElementById(id as string)?.remove();
      if (!ligar) return;
      const estilo = document.createElement("style");
      estilo.id = id as string;
      estilo.textContent = `
        *, *::placeholder { -webkit-text-fill-color: transparent !important;
          text-shadow: none !important; caret-color: transparent !important;
          text-decoration-color: transparent !important; }
        svg { visibility: hidden !important; }`;
      document.head.appendChild(estilo);
    },
    [ESTILO_ID, esconder] as const,
  );
  // Dois quadros: o estilo precisa ter sido aplicado E pintado.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/**
 * Uma página leitora por contexto, reaproveitada: decodifica a captura num
 * canvas (sem dependência nova) e devolve SÓ os pixels pedidos. Mandar a
 * imagem inteira para o Node custava segundos por medida.
 */
const leitores = new WeakMap<BrowserContext, Page>();

async function leitorDe(page: Page): Promise<Page> {
  const contexto = page.context();
  let leitor = leitores.get(contexto);
  if (!leitor || leitor.isClosed()) {
    leitor = await contexto.newPage();
    await leitor.setContent("<canvas></canvas>");
    leitores.set(contexto, leitor);
  }
  return leitor;
}

type LerPontos = (pontos: [number, number][]) => Promise<(Cor | null)[]>;

async function capturar(page: Page, esconder: boolean): Promise<LerPontos> {
  await page.bringToFront();
  await esconderGlifos(page, esconder);
  let png: Buffer;
  try {
    png = await page.screenshot({ fullPage: true, scale: "css", animations: "disabled" });
  } finally {
    await esconderGlifos(page, false);
  }
  const leitor = await leitorDe(page);
  await leitor.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.querySelector("canvas")!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    (window as unknown as { __captura: unknown }).__captura = { w: canvas.width, h: canvas.height, data };
  }, png.toString("base64"));
  await page.bringToFront();
  return async (pontos) => {
    const plano = pontos.flatMap(([x, y]) => [Math.round(x), Math.round(y)]);
    const cru = await leitor.evaluate((xy: number[]) => {
      const c = (window as unknown as { __captura: { w: number; h: number; data: Uint8ClampedArray } }).__captura;
      const saida: number[] = [];
      for (let i = 0; i < xy.length; i += 2) {
        const x = xy[i];
        const y = xy[i + 1];
        if (x < 0 || y < 0 || x >= c.w || y >= c.h) {
          saida.push(-1, -1, -1);
          continue;
        }
        const k = (y * c.w + x) * 4;
        saida.push(c.data[k], c.data[k + 1], c.data[k + 2]);
      }
      return saida;
    }, plano);
    const cores: (Cor | null)[] = [];
    for (let i = 0; i < cru.length; i += 3) {
      cores.push(cru[i] < 0 ? null : [cru[i], cru[i + 1], cru[i + 2]]);
    }
    return cores;
  };
}

/**
 * Mede todos os textos dos alvos numa captura só. `ocultarGlifos: false`
 * existe para o autoteste provar que esconder importa — nunca para medir.
 */
export async function medirTextos(
  page: Page,
  alvos: { rotulo: string; alvo: Locator }[],
  opcoes: { ocultarGlifos?: boolean } = {},
): Promise<ResultadoDeTexto[]> {
  const coletados: { rotulo: string; segmentos: Segmento[] }[] = [];
  for (const { rotulo, alvo } of alvos) {
    coletados.push({ rotulo, segmentos: await coletarTextos(alvo) });
  }
  const ler = await capturar(page, opcoes.ocultarGlifos ?? true);
  const saida: ResultadoDeTexto[] = [];
  for (const { rotulo, segmentos } of coletados) {
    for (const seg of segmentos) {
      const pontos: [number, number][] = [];
      for (const c of seg.caixas) {
        for (let y = Math.floor(c.y); y < Math.ceil(c.y + c.h); y++) {
          for (let x = Math.floor(c.x); x < Math.ceil(c.x + c.w); x++) pontos.push([x, y]);
        }
      }
      const fundos = (await ler(pontos)).filter((px): px is Cor => px !== null);
      const limite = limiteDoTexto(seg.fontePx, seg.negrito);
      const inconclusivo = seg.inconclusivo ?? (fundos.length === 0 ? "nenhum pixel lido" : undefined);
      const r = inconclusivo ? 0 : menorRazao(seg.cor, fundos);
      saida.push({
        rotulo,
        texto: seg.texto,
        razao: Math.round(r * 100) / 100,
        limite,
        pixels: fundos.length,
        passou: !inconclusivo && r >= limite,
        inconclusivo,
      });
    }
  }
  return saida;
}

/**
 * Mede a borda (ou o anel de foco, se o elemento estiver focado) de cada alvo:
 * três linhas de varredura por lado, de `alcance` px fora até 6 px dentro.
 */
export async function medirFaixas(
  page: Page,
  alvos: { rotulo: string; alvo: Locator }[],
  alcance = 12,
): Promise<ResultadoDeFaixa[]> {
  const caixas: { rotulo: string; c: Caixa & { raio: number } }[] = [];
  for (const { rotulo, alvo } of alvos) {
    const c = await alvo.evaluate((el: Element) => {
      const r = el.getBoundingClientRect();
      const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height, raio };
    });
    caixas.push({ rotulo, c });
  }
  const ler = await capturar(page, true);
  const saida: ResultadoDeFaixa[] = [];
  for (const { rotulo, c } of caixas) {
    const razoes: number[] = [];
    let semVizinho = 0;
    // Fora das curvas dos cantos: uma linha que cruza o arredondado mede a
    // diagonal, e não a borda.
    const longeDoCanto = (pos: number, comprimento: number) =>
      pos > c.raio + 2 && comprimento - pos > c.raio + 2;
    for (const f of [0.25, 0.5, 0.75]) {
      const xm = c.x + c.w * f;
      const ym = c.y + c.h * f;
      const lados: [number, number, number, number][] = [];
      if (longeDoCanto(c.w * f, c.w)) {
        lados.push([xm, c.y, 0, 1]); // topo: de cima para baixo
        lados.push([xm, c.y + c.h - 1, 0, -1]); // base
      }
      if (longeDoCanto(c.h * f, c.h)) {
        lados.push([c.x, ym, 1, 0]); // esquerda
        lados.push([c.x + c.w - 1, ym, -1, 0]); // direita
      }
      for (const [x0, y0, dx, dy] of lados) {
        const pontos: [number, number][] = [];
        for (let k = -alcance; k <= 6; k++) pontos.push([x0 + dx * k, y0 + dy * k]);
        const linha = (await ler(pontos)).filter((px): px is Cor => px !== null);
        const r = razaoDaFaixa(linha);
        if (r === null) semVizinho++;
        else razoes.push(r);
      }
    }
    const menor = razoes.length ? Math.min(...razoes) : 0;
    const inconclusivo = razoes.length === 0 ? "nenhuma linha com vizinhos" : undefined;
    saida.push({
      rotulo,
      razao: Math.round(menor * 100) / 100,
      linhas: razoes.length + semVizinho,
      passou: !inconclusivo && menor >= 3,
      inconclusivo,
    });
  }
  return saida;
}
