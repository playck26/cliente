import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAVE_DE_ATIVACAO,
  LOGIN_APOS_ATIVACAO,
  VALOR_DE_ATIVACAO,
  chegouDaAtivacao,
} from "./ativacao-navigation";

/**
 * SPEC-084 (AC-008, TEST-005) — **o protocolo da ativação mora num lugar só.**
 *
 * A SPEC-083 emite, a SPEC-084 lê, e as duas importam a mesma constante. O
 * defeito que isto impede é o da DOR-084-R1-01: alguém escreve o endereço à
 * mão num lado, troca o nome do parâmetro, e os testes de cada lado continuam
 * verdes enquanto o aviso nunca aparece.
 *
 * A varredura pega **cópia** do literal. Ela não pega um emissor que mande
 * para `/login` sem parâmetro nenhum — esse é o teste de navegação cruzada da
 * SPEC-083, e está dito na spec.
 */

const SRC = join(__dirname, "..");
const ESTE_ARQUIVO = "lib/ativacao-navigation.ts";

function arquivosDeProducao(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeProducao(caminho));
      continue;
    }
    if (!/\.(tsx?|css|m?js)$/.test(nome)) continue;
    if (/\.test\.(tsx?|m?js)$/.test(nome)) continue;
    if (relative(SRC, caminho).replace(/\\/g, "/") === ESTE_ARQUIVO) continue;
    saida.push(caminho);
  }
  return saida;
}

/** A regra da varredura, separada para ser testada contra fixture. */
function citaAChaveDaAtivacao(conteudo: string): boolean {
  return conteudo.includes(CHAVE_DE_ATIVACAO);
}

describe("SPEC-084 — o endereço do login depois da ativação", () => {
  it("é /login?ativado=1, o valor combinado com a SPEC-083", () => {
    expect(LOGIN_APOS_ATIVACAO).toBe("/login?ativado=1");
    expect(chegouDaAtivacao(new URL(LOGIN_APOS_ATIVACAO, "https://x").search)).toBe(true);
  });

  it.each([
    ["?ativado=1", true],
    ["?ativado=1&utm=email", true],
    ["?outro=2&ativado=1", true],
    ["", false],
    ["?ativado=0", false],
    ["?ativado=sim", false],
    ["?ativado=", false],
    ["?ativacao=1", false],
  ])("%s → aviso? %s", (busca, esperado) => {
    expect(chegouDaAtivacao(busca)).toBe(esperado);
  });

  it("chave e valor são os que a constante monta", () => {
    expect(LOGIN_APOS_ATIVACAO).toBe(`/login?${CHAVE_DE_ATIVACAO}=${VALOR_DE_ATIVACAO}`);
  });
});

describe("SPEC-084 — a chave da ativação só existe na constante", () => {
  it("a regra acha a chave escrita à mão, e não acha quem importa a constante", () => {
    expect(citaAChaveDaAtivacao('router.push("/login?ativado=1")')).toBe(true);
    expect(citaAChaveDaAtivacao('const p = new URLSearchParams({ ativado: "1" })')).toBe(true);
    expect(citaAChaveDaAtivacao("router.push(LOGIN_APOS_ATIVACAO)")).toBe(false);
  });

  it("nenhum arquivo de produção fora da constante escreve a chave", () => {
    const arquivos = arquivosDeProducao(SRC);
    // Contra a vacuidade: a varredura viu o código de verdade.
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos.some((a) => a.replace(/\\/g, "/").endsWith("app/login/page.tsx"))).toBe(true);

    const copias = arquivos
      .filter((a) => citaAChaveDaAtivacao(readFileSync(a, "utf8")))
      .map((a) => relative(SRC, a).replace(/\\/g, "/"));
    expect(copias).toEqual([]);
  });
});
