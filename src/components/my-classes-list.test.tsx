import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyClassesList } from "./my-classes-list";

/**
 * SPEC-029 — **as provas do botão que o Israel pediu**, e do contrato da URL
 * por trás dele.
 *
 * O desenho da semana tem provas próprias em `semana-do-aluno.test.tsx`.
 * Aqui o que está sob teste é o alternador: quando ele aparece, o que ele
 * escreve no endereço, e que a vista padrão **não** suja a URL.
 */

const push = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ valor: null as string | null }));
const listMyClasses = vi.hoisted(() => vi.fn());
const avisarFalta = vi.hoisted(() => vi.fn());
const retirarAvisoDeFalta = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(params.valor ?? ""),
  usePathname: () => "/minhas-aulas",
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listMyClasses, avisarFalta, retirarAvisoDeFalta };
});

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

beforeEach(() => {
  push.mockReset();
  params.valor = null;
  listMyClasses.mockReset().mockResolvedValue([aula]);
});

describe("quando o alternador aparece", () => {
  it("com aulas, os dois botões estão na tela", async () => {
    render(<MyClassesList />);

    expect(
      await screen.findByRole("button", { name: "Lista" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
  });

  it("sem aula nenhuma, não aparece", async () => {
    // Alternar entre duas telas vazias não é escolha — é um controle que
    // ocupa espaço e não faz nada.
    listMyClasses.mockResolvedValue([]);
    render(<MyClassesList />);

    expect(
      await screen.findByText("Nenhuma aula agendada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Semana" }),
    ).not.toBeInTheDocument();
  });
});

describe("o que o botão escreve na URL", () => {
  it("ir para a semana põe `?vista=semana`", async () => {
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas?vista=semana", {
      scroll: false,
    });
  });

  it("voltar para a lista LIMPA o parâmetro", async () => {
    // A vista padrão fora do endereço: é o que a pessoa copia. Mesma decisão
    // de `abas-na-url.tsx`.
    params.valor = "vista=semana";
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Lista" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas", { scroll: false });
  });

  it("preserva o resto da query em vez de reescrever o endereço", async () => {
    // Se um dia a aba e a vista coexistirem na URL, trocar uma não pode
    // apagar a outra.
    params.valor = "aba=minhas";
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(push).toHaveBeenCalledWith("/minhas-aulas?aba=minhas&vista=semana", {
      scroll: false,
    });
  });

  it("tocar na vista que já está ativa não navega", async () => {
    render(<MyClassesList />);

    fireEvent.click(await screen.findByRole("button", { name: "Lista" }));

    expect(push).not.toHaveBeenCalled();
  });
});

describe("qual vista é mostrada", () => {
  it("sem parâmetro, a LISTA", async () => {
    render(<MyClassesList />);

    expect(await screen.findByLabelText("Próximas aulas")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Minhas aulas por semana"),
    ).not.toBeInTheDocument();
  });

  it("com `?vista=semana`, o calendário", async () => {
    params.valor = "vista=semana";
    render(<MyClassesList />);

    expect(
      await screen.findByLabelText("Minhas aulas por semana"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Próximas aulas")).not.toBeInTheDocument();
  });

  it("valor estranho cai na lista, em silêncio", async () => {
    // `?vista=lixo` vem de URL editada à mão ou link velho. Punir a pessoa
    // por um endereço que nós mudamos seria o pior dos dois mundos.
    params.valor = "vista=lixo";
    render(<MyClassesList />);

    expect(await screen.findByLabelText("Próximas aulas")).toBeInTheDocument();
  });
});

// TEST (SPEC-030 / achado 2 da validação cruzada, ALTA) — o aluno vê que a
// aula não aconteceu.
//
// A dúvida 2 da spec decidiu isso e o campo nunca foi criado: em "Próximas" a
// aula seguia como "Agendada", e no dia seguinte sumia das "Anteriores"
// (`aulasAnteriores` filtra `nao_houve` para não oferecer avaliação). O aluno
// pode ter ido até o clube, e o produto nunca lhe dizia o que houve.
describe("SPEC-030 — a aula não realizada, na vista do aluno", () => {
  it("mostra 'Não realizada' no lugar de 'Agendada'", async () => {
    listMyClasses.mockResolvedValue([{ ...aula, naoRealizada: true }]);

    render(<MyClassesList />);

    expect(await screen.findByText("Não realizada")).toBeInTheDocument();
    expect(screen.queryByText("Agendada")).not.toBeInTheDocument();
  });

  it("a aula normal continua dizendo 'Agendada'", async () => {
    // O par negativo: sem ele, um selo que dissesse "Não realizada" sempre
    // passaria na prova acima.
    listMyClasses.mockResolvedValue([aula]);

    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(screen.queryByText("Não realizada")).not.toBeInTheDocument();
  });
});

/**
 * SPEC-031/REQ-006 — **o aluno avisa que vai faltar.**
 *
 * O que este bloco guarda é o par que mais custa quando quebra: o botão diz a
 * verdade sobre o estado, e a tela **recarrega mesmo quando dá erro**.
 *
 * A segunda metade é a lição do `turmas-do-clube.tsx`, e ela vale aqui pelo
 * mesmo motivo: o prazo envelhece entre a pintura e o toque. Receber
 * `PRAZO_DE_CANCELAMENTO` e continuar mostrando o botão como antes seria a
 * tela insistindo numa informação que o servidor acabou de desmentir.
 */
describe("MyClassesList — avisar falta (REQ-006)", () => {
  const comAulas = (...as: (typeof aula)[]) => {
    listMyClasses.mockResolvedValue(as);
  };
  const botao = () => screen.getByRole("button", { name: /falta/i });

  beforeEach(() => {
    avisarFalta.mockReset().mockResolvedValue(undefined);
    retirarAvisoDeFalta.mockReset().mockResolvedValue(undefined);
  });

  it("sem aviso: mostra Agendada e oferece Vou faltar", async () => {
    comAulas(aula);
    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avisar que vou faltar" }),
    ).toBeTruthy();
    expect(screen.queryByText("Falta avisada")).toBeNull();
  });

  it("com aviso: mostra Falta avisada e oferece Desfazer", async () => {
    comAulas({ ...aula, faltaAvisada: true });
    render(<MyClassesList />);

    expect(await screen.findByText("Falta avisada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desfazer aviso de falta" }),
    ).toBeTruthy();
    // "Agendada" some: dizer as duas coisas sobre o mesmo estado seria a tela
    // se contradizendo.
    expect(screen.queryByText("Agendada")).toBeNull();
  });

  it("tocar Vou faltar chama o POST com turma e ocorrência", async () => {
    comAulas(aula);
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    await vi.waitFor(() =>
      expect(avisarFalta).toHaveBeenCalledWith("t1", "o1"),
    );
    expect(retirarAvisoDeFalta).not.toHaveBeenCalled();
  });

  it("tocar Desfazer chama o DELETE, não o POST", async () => {
    comAulas({ ...aula, faltaAvisada: true });
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Desfazer aviso de falta" }),
    );

    await vi.waitFor(() =>
      expect(retirarAvisoDeFalta).toHaveBeenCalledWith("t1", "o1"),
    );
    expect(avisarFalta).not.toHaveBeenCalled();
  });

  /**
   * **A prova que justifica o bloco.** A mensagem vem do servidor porque só
   * ele sabe quantas horas o clube exige — e a tela recarrega, para não ficar
   * mostrando um botão que o servidor acabou de recusar.
   */
  it("recusa dentro do prazo: mostra a mensagem DO SERVIDOR e recarrega", async () => {
    comAulas(aula);
    const { ApiError } =
      await vi.importActual<typeof import("@/lib/api-client")>(
        "@/lib/api-client",
      );
    avisarFalta.mockRejectedValue(
      new ApiError(
        409,
        "Avisar ou retirar o aviso exige 2h de antecedência.",
        "PRAZO_DE_CANCELAMENTO",
      ),
    );
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "exige 2h de antecedência",
    );
    // duas: a carga inicial e a releitura depois do erro.
    await vi.waitFor(() => expect(listMyClasses).toHaveBeenCalledTimes(2));
  });

  /**
   * Compatibilidade de rollout: um back anterior à TASK-009a responde `200`
   * **sem** o campo. Ausência tem de ser lida como "não avisou" — nunca como
   * erro, nunca como avisado.
   */
  it("back antigo (sem o campo) é lido como não avisado, sem quebrar", async () => {
    // O campo é **omitido**, não posto como `false`: é assim que um back
    // anterior à TASK-009a responde.
    const semCampo = { ...aula };
    delete (semCampo as { faltaAvisada?: boolean }).faltaAvisada;
    comAulas(semCampo);
    render(<MyClassesList />);

    expect(await screen.findByText("Agendada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avisar que vou faltar" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /**
   * A aula que não aconteceu não oferece nada: avisar falta de aula que não
   * houve não tem sentido, e o servidor recusaria. Mesma regra da chamada —
   * a tela só não oferece o que seria recusado.
   */
  it("aula não realizada não oferece o botão", async () => {
    comAulas({ ...aula, naoRealizada: true });
    render(<MyClassesList />);

    expect(await screen.findByText("Não realizada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /falta/i })).toBeNull();
  });

  it("enquanto a ação está em voo o botão fica desabilitado", async () => {
    comAulas(aula);
    let liberar!: () => void;
    avisarFalta.mockImplementation(
      () => new Promise<void>((r) => (liberar = r)),
    );
    render(<MyClassesList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Avisar que vou faltar" }),
    );

    await vi.waitFor(() => expect(botao()).toBeDisabled());
    liberar();
  });
});
