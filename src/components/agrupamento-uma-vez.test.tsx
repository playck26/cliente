import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarioDoAluno, type Compromisso } from "./calendario-do-aluno";
import { SemanaDoAluno } from "./semana-do-aluno";

/**
 * **SPEC-066/AC-007 — o agrupamento por dia roda UMA vez, nos dois
 * calendários.**
 *
 * ## Por que este arquivo existe do jeito que existe
 *
 * A v2 desta spec dizia: *"a função de agrupamento é extraída e exportada
 * para o teste poder espioná-la"*. **A validação independente provou que isso
 * não funciona** — em ES module, uma chamada lexical dentro do mesmo arquivo
 * não passa pelo *binding* exportado. O probe dela:
 *
 * ```text
 * AssertionError: expected "agrupar" to be called 1 times, but got 0 times
 * ```
 *
 * Por isso o agrupamento mudou de endereço: mora em `@/lib/agrupar-por-dia`, o
 * componente o **importa**, e `vi.mock` daquele caminho intercepta de verdade.
 *
 * **A diferença entre uma prova e a descrição de uma prova era um `import`.**
 *
 * ## O experimento é fixo, porque a v2 também errava nisso
 *
 * *"N renders"* não fixava N nem o gatilho. Aqui: **montagem mais três
 * rerenders causados por algo que não mexe nas aulas**, e a contagem tem de
 * ser exatamente **1**.
 *
 * O contra-teste é o que dá valor ao número: **sem o `useMemo`, a contagem vai
 * a 4**. Sem ele, um `1` poderia significar só que o componente não
 * rerenderizou.
 */
const agruparPorDia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agrupar-por-dia", async () => {
  const real = await vi.importActual<typeof import("@/lib/agrupar-por-dia")>(
    "@/lib/agrupar-por-dia",
  );
  // Delega ao real: o teste conta as chamadas, **não substitui o
  // comportamento**. Um dublê que devolvesse `new Map()` faria as telas
  // ficarem vazias e as provas passariam medindo outra coisa.
  agruparPorDia.mockImplementation(real.agruparPorDia);
  return { agruparPorDia };
});

const listMyClasses = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listMyClasses };
});

/** 2026-09-02 é uma quarta; a semana dela vai de 30/08 a 05/09. */
const QUARTA = new Date("2026-09-02T15:00:00.000Z");

const aula = {
  ocupacaoId: "o1",
  turmaId: "t1",
  turmaNome: "Iniciantes",
  quadraId: "q1",
  quadraNome: "Quadra 1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  naoRealizada: false,
  faltaAvisada: false,
};

const compromisso: Compromisso = {
  id: "c1",
  data: "2026-09-02",
  horaInicio: "18:00",
  horaFim: "19:00",
  tipo: "turma",
  titulo: "Iniciantes",
  local: "Quadra 1",
  professorNome: null,
  materiais: [],
  valor: null,
  pagamento: null,
  faltaAvisada: false,
  naoRealizada: false,
  turmaId: "t1",
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(QUARTA);
  agruparPorDia.mockClear();
  listMyClasses.mockReset().mockResolvedValue([aula]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AC-007 — a semana agrupa uma vez", () => {
  it("montagem e três rerenders somam UMA execução", async () => {
    const { rerender } = render(<SemanaDoAluno />);
    await waitFor(() => expect(listMyClasses).toHaveBeenCalled());

    const depoisDaBusca = agruparPorDia.mock.calls.length;

    // Três renders que não mexem nas aulas. Um rerender com as mesmas props é
    // o equivalente testável de "o pai pintou de novo por outra razão" — que
    // é justamente o caso contra o qual o `useMemo` protege.
    rerender(<SemanaDoAluno />);
    rerender(<SemanaDoAluno />);
    rerender(<SemanaDoAluno />);

    expect(agruparPorDia.mock.calls.length).toBe(depoisDaBusca);
  });
});

describe("AC-007 — o calendário da home agrupa uma vez", () => {
  it("abrir e fechar um dia NÃO reagrupa", async () => {
    render(<CalendarioDoAluno compromissos={[compromisso]} />);

    const antes = agruparPorDia.mock.calls.length;
    expect(antes).toBeGreaterThan(0);

    // **Este é o "estado alheio às aulas" que a AC pede, e aqui ele é real:**
    // `diaAberto` muda com o toque no dia e não mexe em compromisso nenhum.
    // Antes desta task, cada toque refazia o mapa inteiro e reordenava todos
    // os dias do mês.
    const dia = screen.getByRole("button", { name: /^2: 1 compromisso$/ });
    fireEvent.click(dia);
    fireEvent.click(dia);
    fireEvent.click(dia);

    expect(agruparPorDia.mock.calls.length).toBe(antes);
  });
});
