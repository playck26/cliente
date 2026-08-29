import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **O gate das cores, e ele nasceu de um defeito que foi para produção.**
 *
 * Em 2026-08-29 o Israel mandou prints: o calendário do professor e as
 * informações das turmas estavam **quase invisíveis**. Duas causas, e as
 * duas do mesmo tipo — eu usei um nome de cor sem conferir se ele existia e
 * o que valia:
 *
 * | O que escrevi | O que era |
 * |---|---|
 * | `text-muted` | `--muted` neste projeto é `--color-surface-container`, **uma cor de FUNDO** (`#f3f5f2`). Texto quase branco sobre fundo quase branco |
 * | `var(--color-danger)` | **não existe.** O token do projeto é `--color-error` (`#ed0040`) |
 *
 * Foram **18 + 15 ocorrências**, todas em telas que eu escrevi entre as
 * SPEC-023 e 026. As telas antigas usavam os tokens certos o tempo todo —
 * eu é que não olhei.
 *
 * **Nenhuma das duas o `tsc` pega, e nenhuma o lint pega**: são strings de
 * classe. A única barreira possível é esta, e por isso ela existe — a lição
 * do DEF-016, pela enésima vez: aviso não é mecanismo.
 */

const RAIZ = join(__dirname, "..");
const GLOBALS = join(RAIZ, "app", "globals.css");

/**
 * Classes que pintam **texto** com um token de **fundo**.
 *
 * A lista é curta porque o dano é específico: `bg-muted` está certo, é para
 * isso que o token existe. O que não pode é `text-`.
 */
const TEXTO_COM_COR_DE_FUNDO = [
  "text-muted",
  "text-background",
  "text-surface",
  "text-card",
];

function arquivosDeCodigo(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeCodigo(caminho));
      continue;
    }
    if (!/\.tsx?$/.test(nome) || /\.test\.tsx?$/.test(nome)) continue;
    saida.push(caminho);
  }
  return saida;
}

const arquivos = arquivosDeCodigo(RAIZ);
const css = readFileSync(GLOBALS, "utf8");

describe("as cores existem", () => {
  it("varreu o código e o CSS de verdade — senão o teste passa por vacuidade", () => {
    expect(arquivos.length).toBeGreaterThan(20);
    expect(css).toContain("--color-text-secondary");
  });

  it("todo `var(--...)` usado nas telas está definido no globals.css", () => {
    const inexistentes = new Set<string>();

    for (const caminho of arquivos) {
      const conteudo = readFileSync(caminho, "utf8");
      for (const achado of conteudo.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const nome = achado[1];
        // `var(--x, fallback)` com fallback é legítimo mesmo sem o token —
        // mas aqui nenhum precisa disso, e exigir a definição é o que faz o
        // gate valer.
        if (!css.includes(`${nome}:`)) {
          inexistentes.add(
            `${caminho.replace(/\\/g, "/").split("/src/")[1]} → ${nome}`,
          );
        }
      }
    }

    // A mensagem nomeia arquivo e token: sem isso, o próximo a ver vermelho
    // gasta a primeira meia hora procurando onde.
    expect([...inexistentes]).toEqual([]);
  });

  it("nenhuma tela pinta TEXTO com um token de FUNDO", () => {
    const errados: string[] = [];

    for (const caminho of arquivos) {
      const conteudo = readFileSync(caminho, "utf8");
      for (const classe of TEXTO_COM_COR_DE_FUNDO) {
        // `\b` no fim para não pegar `text-muted-foreground`, que é o token
        // CERTO para texto secundário no vocabulário do Tailwind.
        if (new RegExp(`\\b${classe}\\b(?!-)`).test(conteudo)) {
          errados.push(
            `${caminho.replace(/\\/g, "/").split("/src/")[1]} → ${classe}`,
          );
        }
      }
    }

    expect(errados).toEqual([]);
  });
});

describe("o token que causou o defeito continua sendo o que era", () => {
  it("`--muted` é uma cor de fundo, não de texto", () => {
    // Se um dia alguém trocar `--muted` para um cinza de texto, esta prova
    // cai — e aí o gate acima passa a ser rigor desnecessário, o que é uma
    // informação útil, não um estorvo.
    expect(css).toMatch(/--muted:\s*var\(--color-surface-container\)/);
  });

  it("e o texto secundário tem contraste de verdade", () => {
    // `#4e5951` sobre fundo claro. O `#f3f5f2` do `--muted` é o que sumia.
    expect(css).toMatch(/--color-text-secondary:\s*#4e5951/i);
  });
});
