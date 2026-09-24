/**
 * SPEC-072/AC-007 — **um caso por motivo, e são CINCO.**
 *
 * A AC nomeia os cinco de propósito: a v1 listava três, e os dois que
 * faltavam deixavam passar aluno que via o botão e levava `409`. O quinto — o
 * teto do mês — foi o achado `B06`, e o serviço o recusa **desde sempre**.
 *
 * **O caso do casamento por id é o que sustenta a `INV-072c`:** duas faltas
 * de turmas homônimas, no mesmo dia e hora, não podem confundir a escolha.
 */
import { describe, expect, it } from "vitest";
import type { CreditoDeReposicao } from "@/lib/api-client";
import {
  creditoUtilizavel,
  faltaDaOcupacao,
  EXPLICACAO,
  type MotivoDeRecusa,
} from "./credito-utilizavel";

const OC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OC_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function falta(patch: Record<string, unknown> = {}) {
  return {
    faltaId: "f-de-A",
    ocupacaoId: OC_A,
    turmaNome: "Iniciantes",
    data: "2026-10-01",
    horaInicio: "19:00",
    horaFim: "20:00",
    expiraEm: "2026-10-31",
    expirada: false,
    aulaCancelada: false,
    reposicao: null,
    ...patch,
  };
}

function credito(patch: Record<string, unknown> = {}): CreditoDeReposicao {
  return {
    creditos: 1,
    porMes: 2,
    validadeDias: 30,
    usadasNoMes: 0,
    faltas: [falta()],
    ...patch,
  } as CreditoDeReposicao;
}

describe("creditoUtilizavel — os CINCO motivos, um caso cada", () => {
  it("crédito válido: utilizável, e nomeia o faltaId", () => {
    const v = creditoUtilizavel(credito(), OC_A);
    expect(v).toEqual({ utilizavel: true, faltaId: "f-de-A" });
  });

  it("1. nenhuma falta casada naquela ocorrência", () => {
    const v = creditoUtilizavel(credito(), OC_B);
    expect(v).toEqual({ utilizavel: false, motivo: "sem-falta" });
  });

  it("2. já reposta", () => {
    const c = credito({
      faltas: [falta({ reposicao: { id: "r-1", turmaNome: "X", data: "2026-10-10", horaInicio: "19:00" } })],
    });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "ja-reposta",
    });
  });

  it("3. o CLUBE cancelou a aula — ele não perdeu nada", () => {
    const c = credito({ faltas: [falta({ aulaCancelada: true })] });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "aula-cancelada",
    });
  });

  it("4. expirada", () => {
    const c = credito({ faltas: [falta({ expirada: true })] });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "expirada",
    });
  });

  /**
   * **O quinto, que a v2 não tinha.** Falta perfeitamente válida, e o teto do
   * mês estourado: sem este caso a tela oferece "Remarcar" e o `POST`
   * responde `409 TETO_DE_REPOSICAO`.
   */
  it("5. teto do mês estourado, com a falta VÁLIDA", () => {
    const c = credito({ usadasNoMes: 2, porMes: 2 });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "teto-do-mes",
    });
  });

  it("sem crédito nenhum carregado, não oferece", () => {
    expect(creditoUtilizavel(null, OC_A)).toEqual({
      utilizavel: false,
      motivo: "sem-falta",
    });
  });
});

describe("a ordem é a do servidor, e ela decide a MENSAGEM", () => {
  /**
   * Quando mais de um motivo vale, quem vence tem de ser o mesmo que o `POST`
   * responderia — tela e servidor discordando sobre o motivo é pior que a
   * tela não dizer motivo nenhum.
   */
  it("reposta E expirada: vence `ja-reposta`, como no serviço", () => {
    const c = credito({
      faltas: [
        falta({
          expirada: true,
          reposicao: { id: "r-1", turmaNome: "X", data: "2026-10-10", horaInicio: "19:00" },
        }),
      ],
    });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "ja-reposta",
    });
  });

  it("falta inválida E teto estourado: vence o motivo da FALTA", () => {
    const c = credito({ usadasNoMes: 9, faltas: [falta({ expirada: true })] });
    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: false,
      motivo: "expirada",
    });
  });
});

describe("INV-072c — o casamento é por ID, nunca por texto", () => {
  /**
   * **Duas turmas de mesmo nome, mesma data e mesma hora.** É o cenário que
   * derruba a junção por texto de exibição — e o schema não impede que ele
   * exista.
   */
  it("duas faltas indistinguíveis por texto não confundem a escolha", () => {
    const c = credito({
      faltas: [
        falta({ faltaId: "f-de-A", ocupacaoId: OC_A }),
        falta({ faltaId: "f-de-B", ocupacaoId: OC_B }),
      ],
    });

    expect(creditoUtilizavel(c, OC_A)).toEqual({
      utilizavel: true,
      faltaId: "f-de-A",
    });
    expect(creditoUtilizavel(c, OC_B)).toEqual({
      utilizavel: true,
      faltaId: "f-de-B",
    });
    expect(faltaDaOcupacao(c, OC_B)?.faltaId).toBe("f-de-B");
  });
});

describe("nenhum motivo fica mudo", () => {
  it("os cinco têm frase, e nenhuma está vazia", () => {
    const motivos: MotivoDeRecusa[] = [
      "sem-falta",
      "ja-reposta",
      "aula-cancelada",
      "expirada",
      "teto-do-mes",
    ];
    expect(Object.keys(EXPLICACAO).sort()).toEqual([...motivos].sort());
    for (const m of motivos) expect(EXPLICACAO[m].length).toBeGreaterThan(10);
  });
});
