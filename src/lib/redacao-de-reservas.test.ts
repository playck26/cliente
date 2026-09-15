import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-053/D1, D2 — **a regra de redação, lida do código-fonte.**
 *
 * AC-001 diz que nenhum texto do Cliente contém "reservar quadra", "reserva de
 * quadra" ou "quadra foi reservada". Os testes de tela cobrem a Home, as abas,
 * a lista de reservas e a carteira; **metadata, manifest, o cadastro público e a
 * confirmação da reserva não têm teste de tela**, e é por eles que esta prova
 * existe. Mesmo molde de `cores.test.ts`: ler o fonte é a prova mais barata de
 * que uma frase não está em lugar nenhum.
 *
 * **O que isto NÃO prova, dito para não virar falso conforto (LIM-053a):** a
 * regra é editorial. "Reservar a quadra" passaria. O teste guarda as expressões
 * que a SPEC-053 removeu, não o bom senso de quem escrever texto novo.
 */

const SRC = path.resolve(import.meta.dirname, "..");

/**
 * **Comentário não é texto de tela.** A ADR-021 mantém "quadra" no código — e um
 * comentário que explica que `professorId` vazio é "reserva de quadra" está
 * certo. A primeira versão desta prova varria comentários e acusou quatro
 * falsos positivos no Admin. O `//` só conta como comentário fora de URL
 * (`https://`).
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function arquivosDeProducao(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeProducao(caminho);
    if (!/\.(ts|tsx)$/.test(nome)) return [];
    if (/\.test\.(ts|tsx)$/.test(nome) || nome === "api-types.ts") return [];
    return [caminho];
  });
}

const ler = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** `\s+` e não espaço: o JSX quebra frase em duas linhas (`cadastro-publico-form`). */
const PROIBIDAS = [
  /reservar\s+quadra/i,
  /reservas?\s+de\s+quadra/i,
  /quadra\s+foi\s+reservada/i,
];

describe("SPEC-053 — a regra de redação no código-fonte", () => {
  it("AC-001: nenhum arquivo de produção contém as expressões da categoria B", () => {
    const achados = arquivosDeProducao(SRC).flatMap((arquivo) => {
      const conteudo = semComentarios(readFileSync(arquivo, "utf8"));
      return PROIBIDAS.filter((re) => re.test(conteudo)).map(
        (re) => `${path.relative(SRC, arquivo)} ~ ${re}`,
      );
    });
    expect(achados).toEqual([]);
  });

  it("D2: os textos novos dos arquivos SEM teste de tela", () => {
    expect(ler("app/layout.tsx")).toContain(
      '"Suas aulas e reservas em um só lugar"',
    );
    expect(ler("app/manifest.ts")).toContain(
      '"Suas aulas e reservas em um só lugar"',
    );
    expect(ler("app/cadastro/[slug]/page.tsx")).toContain(
      "Cadastre-se para ver suas aulas e fazer reservas.",
    );
    const form = ler("components/cadastro-publico-form.tsx").replace(/\s+/g, " ");
    expect(form).toContain("só consegue fazer reservas depois que a escola aprovar.");
    expect(form).toContain("antes de você poder fazer reservas.");
    expect(ler("components/court-booking.tsx")).toContain(
      "Ela já aparece em Reservas.",
    );
  });

  it("AC-002: a categoria C fica — a frase sobre a quadra física continua", () => {
    // A prova NEGATIVA da regra: se alguém "consertar" tudo por substituição,
    // esta frase vira "A reserva não abre neste dia", que é errada.
    expect(ler("components/court-booking.tsx")).toContain(
      "A quadra não abre neste dia. Escolha outra data.",
    );
  });
});
