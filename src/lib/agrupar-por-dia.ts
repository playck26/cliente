/**
 * SPEC-066/TASK-004 — **agrupar aulas por dia, num módulo próprio.**
 *
 * ## Por que módulo, e não uma função exportada do componente
 *
 * A **AC-007** exige que o teste conte quantas vezes o agrupamento roda. A v2
 * desta spec mandava *"extrair e exportar a função para o teste poder
 * espioná-la"* — e isso **não funciona**. Em ES module, uma chamada lexical
 * dentro do mesmo arquivo não passa pelo *binding* exportado: o `vi.spyOn` do
 * módulo troca a referência que os outros importam, e o componente continua
 * chamando a original.
 *
 * A validação independente não deduziu isso, mediu. O probe dela:
 *
 * ```text
 * AssertionError: expected "agrupar" to be called 1 times, but got 0 times
 * ```
 *
 * Com o agrupamento **aqui**, o componente o *importa*, e `vi.mock` deste
 * caminho intercepta de verdade. **Foi a diferença entre uma prova e a
 * descrição de uma prova.**
 *
 * ## `push`, e não *spread* no laço
 *
 * A versão da `semana-do-aluno` fazia:
 *
 * ```ts
 * porDia.set(aula.data, [...(porDia.get(aula.data) ?? []), aula]);
 * ```
 *
 * Isso copia o array inteiro a cada aula do mesmo dia — quadrático **no
 * número de aulas por dia**, não no total da lista. A v2 chamou de
 * "quadrático" sem essa qualificação e a validação corrigiu: no pior caso
 * ensaiado havia **três aulas por dia**, ou seja seis cópias em vez de três
 * inserções. **Pequeno.**
 *
 * ## Generico, porque os dois calendarios nao falam do mesmo tipo
 *
 * A semana agrupa `MyClass`; a home agrupa `Compromisso`, que tem aula **e**
 * reserva. O que os dois tem em comum e o campo `data` — e e so isso que este
 * modulo precisa saber. Tipar por `MyClass` obrigaria a home a mentir sobre o
 * proprio dado para reusar quatro linhas.
 *
 * Fica assim mesmo por higiene, e porque `push` é o que se lê como "acrescenta
 * neste dia". **Mas o ganho medido desta linha é perto de zero, e a spec
 * registra isso em vez de declarar vitória** — o que a TASK-003 resolve com
 * certeza é outra coisa: a lista parou de carregar o futuro inteiro.
 */
export function agruparPorDia<T extends { data: string }>(
  itens: T[],
): Map<string, T[]> {
  const porDia = new Map<string, T[]>();
  for (const item of itens) {
    const doDia = porDia.get(item.data);
    if (doDia) doDia.push(item);
    else porDia.set(item.data, [item]);
  }
  return porDia;
}
