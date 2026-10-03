import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FUNDO_DO_LOGIN } from "./login-appearance";
import manifestoAtual from "./login-assets-manifest.json";

/**
 * SPEC-084/TASK-001 — **as guardas da foto do login (AC-003, AC-004, TEST-001).**
 *
 * A foto é substituível por desenho (REQ-003), e substituição é exatamente o
 * momento em que dá para errar sem que nada fique vermelho: o fundo escuro do
 * login esconde um 404, um PNG renomeado continua "abrindo", e um arquivo de
 * 2 MB só aparece na conta da Netlify. Cada `it` abaixo fecha um desses
 * caminhos, e cada um foi visto VERMELHO contra a sabotagem correspondente
 * antes de ser aceito (EVD-084-001).
 *
 * O que estas guardas **não** fazem, e está declarado na spec: não provam que
 * a foto nova não tem texto nem marca d'água (inspeção humana a cada troca), e
 * não impedem um bypass deliberado de revisão.
 */

const RAIZ = join(__dirname, "..", "..");
const PUBLIC = join(RAIZ, "public");
const SRC = join(RAIZ, "src");
const LIMITE_DE_BYTES = 358_400; // 350 KiB, NFR-002
const PREFIXO = "/images/login/";

type EntradaDoManifesto = {
  sha256: string;
  bytes: number;
  largura: number;
  altura: number;
};
type Manifesto = Record<string, EntradaDoManifesto>;

const manifesto = manifestoAtual as Manifesto;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Largura e altura lidas do **cabeçalho** do WebP, sem biblioteca: as três
 * variantes do formato (`VP8 ` com perdas, `VP8L` sem perdas, `VP8X`
 * estendido) guardam o tamanho em lugares diferentes. Devolve `null` se o
 * arquivo não for WebP — o chamador decide o que isso significa.
 */
export function dimensoesDoWebp(
  b: Buffer,
): { largura: number; altura: number } | null {
  if (b.length < 30) return null;
  if (b.toString("ascii", 0, 4) !== "RIFF") return null;
  if (b.toString("ascii", 8, 12) !== "WEBP") return null;
  const bloco = b.toString("ascii", 12, 16);
  if (bloco === "VP8 ") {
    // Quadro-chave: 3 bytes de tag, código de início 9d 01 2a, e então
    // largura e altura em 14 bits cada, little-endian.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return {
      largura: b.readUInt16LE(26) & 0x3fff,
      altura: b.readUInt16LE(28) & 0x3fff,
    };
  }
  if (bloco === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (bloco === "VP8X") {
    return {
      largura: (b.readUIntLE(24, 3) & 0xffffff) + 1,
      altura: (b.readUIntLE(27, 3) & 0xffffff) + 1,
    };
  }
  return null;
}

function nomeDoArquivo(src: string): string {
  return src.slice(PREFIXO.length);
}

/**
 * **Onde o caminho da foto não pode aparecer:** em todo arquivo de produção
 * de `src/` (TS, TSX, CSS, JS), menos a própria configuração. Testes e o
 * manifesto ficam de fora por definição: eles citam o caminho para conferi-lo.
 */
const EXTENSOES_DE_PRODUCAO = /\.(tsx?|css|m?js)$/;
const FORA_DA_VARREDURA = new Set([
  "lib/login-appearance.ts",
  "lib/login-assets-manifest.json",
]);

function arquivosDeProducao(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeProducao(caminho));
      continue;
    }
    if (!EXTENSOES_DE_PRODUCAO.test(nome)) continue;
    if (/\.test\.(tsx?|m?js)$/.test(nome)) continue;
    const rel = relative(SRC, caminho).replace(/\\/g, "/");
    if (FORA_DA_VARREDURA.has(rel)) continue;
    saida.push(caminho);
  }
  return saida;
}

/** A regra da varredura, separada para ser testada contra fixture. */
export function citaACaminhoDaFoto(conteudo: string): boolean {
  return conteudo.includes(PREFIXO);
}

/**
 * O manifesto como ele está nas **duas bases** que importam:
 *
 * - `HEAD` — o último commit. É a que pega a troca no momento em que ela
 *   acontece: quem sobrescreve a foto e atualiza o hash, e roda este teste
 *   antes de commitar (o passo do README), vê vermelho;
 * - `merge-base` com `origin/main` — o que já foi publicado. É a que pega a
 *   sobrescrita commitada de um nome que já está no ar.
 *
 * Devolve `{ indisponivel }` quando não há como perguntar ao Git — o CI faz
 * checkout raso, sem `origin/main`. Nesse caso o caso **pula com o motivo
 * escrito**, e não passa: um verde ali seria um verde sem ter olhado.
 */
type Base =
  | { nome: string; manifesto: Manifesto | null; ref: string }
  | { nome: string; indisponivel: string };

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: RAIZ,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function manifestoNaBase(nome: string, resolver: () => string): Base {
  let ref: string;
  try {
    ref = resolver();
  } catch {
    return { nome, indisponivel: "sem Git ou sem o ref neste checkout" };
  }
  try {
    const bruto = git("show", `${ref}:src/lib/login-assets-manifest.json`);
    return { nome, manifesto: JSON.parse(bruto) as Manifesto, ref };
  } catch {
    // A base existe e ainda não tem manifesto: é a entrega que o introduz.
    return { nome, manifesto: null, ref };
  }
}

const bases: Base[] = [
  manifestoNaBase("último commit", () => git("rev-parse", "--verify", "HEAD")),
  manifestoNaBase("publicado", () => git("merge-base", "HEAD", "origin/main")),
];

describe("SPEC-084 — a foto configurada (AC-003)", () => {
  const nome = nomeDoArquivo(FUNDO_DO_LOGIN.src);
  const caminho = join(PUBLIC, FUNDO_DO_LOGIN.src);

  it("o caminho tem prefixo e versão no nome", () => {
    expect(FUNDO_DO_LOGIN.src).toMatch(/^\/images\/login\/[a-z0-9-]+-v\d+\.webp$/);
  });

  it("o arquivo existe em public/", () => {
    expect(existsSync(caminho), `${caminho} não existe`).toBe(true);
  });

  it("é WebP de verdade (RIFF/WEBP), e não outro formato renomeado", () => {
    const b = readFileSync(caminho);
    expect(b.toString("ascii", 0, 4)).toBe("RIFF");
    expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  });

  it("tem no máximo 350 KiB", () => {
    expect(statSync(caminho).size).toBeLessThanOrEqual(LIMITE_DE_BYTES);
  });

  it("as dimensões do cabeçalho batem com a configuração e o manifesto, em retrato", () => {
    const dim = dimensoesDoWebp(readFileSync(caminho));
    expect(dim).toEqual({
      largura: FUNDO_DO_LOGIN.largura,
      altura: FUNDO_DO_LOGIN.altura,
    });
    expect(manifesto[nome]).toBeDefined();
    expect(dim).toEqual({
      largura: manifesto[nome].largura,
      altura: manifesto[nome].altura,
    });
    // A composição é vertical: a coluna central (I3) e o celular a recortam
    // com `cover`. Uma foto deitada aqui mudaria o recorte inteiro.
    expect(FUNDO_DO_LOGIN.altura).toBeGreaterThan(FUNDO_DO_LOGIN.largura);
  });

  it("o SHA-256 e o tamanho batem com o manifesto", () => {
    const b = readFileSync(caminho);
    expect(sha256(b)).toBe(manifesto[nome]?.sha256);
    expect(b.length).toBe(manifesto[nome]?.bytes);
  });
});

describe("SPEC-084 — o manifesto (AC-004)", () => {
  it("todo arquivo do manifesto continua publicado, com os bytes registrados", () => {
    // Fotos anteriores ficam em `public/` durante o rollback (D6).
    for (const [arquivo, entrada] of Object.entries(manifesto)) {
      const b = readFileSync(join(PUBLIC, PREFIXO, arquivo));
      expect(sha256(b), arquivo).toBe(entrada.sha256);
      expect(b.length, arquivo).toBe(entrada.bytes);
      expect(dimensoesDoWebp(b), arquivo).toEqual({
        largura: entrada.largura,
        altura: entrada.altura,
      });
    }
  });

  for (const base of bases) {
    it.skipIf("indisponivel" in base)(
      `nenhum nome da base “${base.nome}” mudou de bytes, nem saiu do manifesto (${
        "indisponivel" in base ? base.indisponivel : base.ref
      })`,
      () => {
        if ("indisponivel" in base) return;
        // Base sem manifesto = esta entrega o introduz; não há o que comparar.
        for (const [arquivo, entrada] of Object.entries(base.manifesto ?? {})) {
          expect(manifesto[arquivo], `${arquivo} saiu do manifesto`).toBeDefined();
          // Comparar com a BASE é o que pega a sobrescrita: quem troca os
          // bytes de um nome existente e atualiza o hash no manifesto passa
          // em todas as guardas acima, e só falha aqui.
          expect(manifesto[arquivo]?.sha256, `${arquivo} mudou de bytes`).toBe(
            entrada.sha256,
          );
        }
      },
    );
  }
});

describe("SPEC-084 — o caminho da foto mora num lugar só (AC-003)", () => {
  it("a regra acha o caminho em TSX e em CSS, e não acha onde ele não está", () => {
    expect(
      citaACaminhoDaFoto('<Image src="/images/login/outra-v2.webp" alt="" />'),
    ).toBe(true);
    expect(
      citaACaminhoDaFoto(".fundo { background: url(/images/login/outra-v2.webp); }"),
    ).toBe(true);
    expect(citaACaminhoDaFoto('<Image src={FUNDO_DO_LOGIN.src} alt="" />')).toBe(false);
  });

  it("nenhum arquivo de produção fora da configuração cita o caminho", () => {
    const arquivos = arquivosDeProducao(SRC);
    // Contra a vacuidade: a varredura viu código E CSS de verdade.
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos.some((a) => a.endsWith("globals.css"))).toBe(true);

    const duplicados = arquivos
      .filter((a) => citaACaminhoDaFoto(readFileSync(a, "utf8")))
      .map((a) => relative(SRC, a).replace(/\\/g, "/"));
    expect(duplicados).toEqual([]);
  });
});
