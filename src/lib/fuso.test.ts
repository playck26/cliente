import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hojeNoClube, hojeNoClubeIso, isoDeOffsetNoClube } from "./fuso";

/**
 * **DEF-020 — o gate do fuso no app, e ele nasceu do que o Israel viu.**
 *
 * O relato foi curto: *"o horário está incorreto, não está usando fuso
 * horário de Brasília"*. A causa não estava em nenhuma hora — todas as horas
 * chegam da API como string (`"18:00"`) e são renderizadas direto. Estava em
 * **que dia o app achava que era**.
 *
 * `new Date().toISOString()` converte para UTC. O Brasil é UTC-3, então
 * **das 21h à meia-noite a data já virou**. A tela de reserva montava os 30
 * dias assim: quem abria o app às 21h30 via a lista começando amanhã e não
 * conseguia mais reservar os horários que ainda restavam hoje.
 *
 * O calendário do professor já fazia certo — só que com uma cópia da regra
 * **dentro do componente**. Regra certa trancada num arquivo não protege a
 * tela ao lado, e é por isso que este gate varre o app inteiro.
 */

const SRC = join(__dirname, "..");
const DONO_DA_CONVENCAO = join(SRC, "lib", "fuso.ts");

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

/** Comentário citando o defeito é documentação. Só o código conta. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("que dia é hoje sai de um lugar só", () => {
  const arquivos = arquivosDeCodigo(SRC);

  it("varreu o código de verdade — senão o teste passa por vacuidade", () => {
    expect(arquivos.length).toBeGreaterThan(20);
    expect(arquivos).toContain(DONO_DA_CONVENCAO);
  });

  it("nenhuma tela tira a data de hoje de `new Date().toISOString()`", () => {
    const infratores: string[] = [];

    for (const caminho of arquivos) {
      if (caminho === DONO_DA_CONVENCAO) continue;
      const codigo = semComentarios(readFileSync(caminho, "utf8"));
      // `new Date().toISOString()` — o instante de agora lido em UTC. Ler
      // `toISOString()` de uma data JÁ resolvida é legítimo e não casa aqui.
      if (/new\s+Date\s*\(\s*\)\s*\.\s*toISOString/.test(codigo)) {
        infratores.push(
          `${caminho.replace(/\\/g, "/").split("/src/")[1]} → use hojeNoClubeIso()`,
        );
      }
    }

    expect(infratores).toEqual([]);
  });

  it("ninguém mistura aritmética local com leitura UTC", () => {
    // O `isoDeOffset` antigo somava dias com `setDate`/`getDate` (local) e
    // lia com `toISOString()` (UTC) — as duas convenções em três linhas.
    const infratores: string[] = [];

    for (const caminho of arquivos) {
      if (caminho === DONO_DA_CONVENCAO) continue;
      const codigo = semComentarios(readFileSync(caminho, "utf8"));
      if (/\.setDate\s*\(/.test(codigo) && /toISOString/.test(codigo)) {
        infratores.push(
          `${caminho.replace(/\\/g, "/").split("/src/")[1]} → setDate local + leitura UTC`,
        );
      }
    }

    expect(infratores).toEqual([]);
  });
});

describe("a virada das 21h — o horário de pico de um clube de tênis", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 22h30 de 29/08 em São Paulo. O UTC (-3) já está no dia 30.
  const noite = new Date("2026-08-30T01:30:00.000Z");

  it("às 22h30 do dia 29, hoje é 29 — e não 30", () => {
    expect(hojeNoClubeIso(noite)).toBe("2026-08-29");
  });

  it("a leitura ingênua daria o dia seguinte — é o defeito, provado", () => {
    // Sem esta, a de cima poderia passar por acaso num ambiente de teste
    // que já estivesse em UTC-3.
    expect(noite.toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("a lista de 30 dias começa HOJE, mesmo às 22h30", () => {
    // Era isto que a tela de reserva errava: começava amanhã, e os horários
    // que ainda restavam hoje ficavam inalcançáveis.
    expect(isoDeOffsetNoClube(0, noite)).toBe("2026-08-29");
    expect(isoDeOffsetNoClube(1, noite)).toBe("2026-08-30");
  });

  it("de manhã os dois concordam — por isso o defeito sobreviveu", () => {
    // Quem testa de manhã nunca vê. Foi o que aconteceu por uma semana.
    const manha = new Date("2026-08-29T13:00:00.000Z");
    expect(hojeNoClubeIso(manha)).toBe(manha.toISOString().slice(0, 10));
  });
});

describe("aritmética de dias atravessa mês e ano", () => {
  it("passa a virada do mês", () => {
    const trintaEUm = new Date("2026-08-31T15:00:00.000Z");
    expect(isoDeOffsetNoClube(1, trintaEUm)).toBe("2026-09-01");
  });

  it("passa a virada do ano", () => {
    const reveillon = new Date("2026-12-31T15:00:00.000Z");
    expect(isoDeOffsetNoClube(1, reveillon)).toBe("2027-01-01");
  });

  it("os 30 dias da grade são 30 datas distintas e crescentes", () => {
    const base = new Date("2026-08-29T15:00:00.000Z");
    const datas = Array.from({ length: 30 }, (_, i) =>
      isoDeOffsetNoClube(i, base),
    );

    expect(new Set(datas).size).toBe(30);
    expect([...datas].sort()).toEqual(datas);
    expect(datas[29]).toBe("2026-09-27");
  });
});

describe("hojeNoClube decompõe a mesma data", () => {
  it("ano, mês e dia batem com a string", () => {
    const noite = new Date("2026-08-30T01:30:00.000Z");
    expect(hojeNoClube(noite)).toEqual({ ano: 2026, mes: 8, dia: 29 });
  });
});
