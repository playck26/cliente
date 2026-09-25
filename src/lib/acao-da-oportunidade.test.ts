/**
 * SPEC-064/TASK-007 — **um caso por ramo da regra, e os casos que discriminam.**
 *
 * O que separa este desenho de um mais ingênuo são dois casos: a linha de fila
 * de TURMA não pode contar como fila desta AULA, e uma aula que ganhou vaga
 * volta a "Marcar" mesmo com o aluno ainda na fila dela.
 */
import { describe, expect, it } from "vitest";
import { acaoDaOportunidade } from "./acao-da-oportunidade";

const OC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUTRA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("acaoDaOportunidade — qual botão cada aula ganha", () => {
  it("com vaga: Marcar", () => {
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 2 }, [])).toEqual({
      tipo: "marcar",
    });
  });

  it("sem vaga e fora da fila: entrar na fila", () => {
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 0 }, [])).toEqual({
      tipo: "entrar-na-fila",
    });
  });

  it("sem vaga e já na fila DESTA aula: sair, com o id da LINHA", () => {
    const fila = [{ id: "linha-7", fila: "aula", ocupacaoId: OC }];
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 0 }, fila)).toEqual({
      tipo: "sair-da-fila",
      linhaId: "linha-7",
    });
  });

  /**
   * **O casamento é por `ocupacaoId`**: estar na fila de OUTRA aula não diz
   * nada sobre esta.
   */
  it("na fila de OUTRA aula: continua oferecendo entrar nesta", () => {
    const fila = [{ id: "linha-7", fila: "aula", ocupacaoId: OUTRA }];
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 0 }, fila)).toEqual({
      tipo: "entrar-na-fila",
    });
  });

  /**
   * **RN2 do card: "Turma é aula fixa; Aula é reposição"** — são duas filas.
   * Uma linha de fila de TURMA, mesmo que por acaso carregasse o mesmo
   * `ocupacaoId`, não é a fila desta ocorrência.
   */
  it("linha de fila de TURMA não conta como fila desta AULA", () => {
    const fila = [{ id: "linha-t", fila: "turma", ocupacaoId: OC }];
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 0 }, fila)).toEqual({
      tipo: "entrar-na-fila",
    });
  });

  /**
   * **Abriu vaga, ele marca.** Oferecer "sair da fila" numa aula que já tem
   * vaga seria a tela escondendo o caminho mais curto — o que a fila existe
   * para alcançar.
   */
  it("aula que GANHOU vaga volta a Marcar, mesmo com ele ainda na fila", () => {
    const fila = [{ id: "linha-7", fila: "aula", ocupacaoId: OC }];
    expect(acaoDaOportunidade({ ocupacaoId: OC, vagas: 1 }, fila)).toEqual({
      tipo: "marcar",
    });
  });
});
