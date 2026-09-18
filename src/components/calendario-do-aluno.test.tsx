import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  CalendarioDoAluno,
  deAula,
  deReserva,
  janelaDoMes,
  listarMateriais,
  rotuloDoDia,
} from "./calendario-do-aluno";
import type { ItemDaListaDeReservas, MyClass } from "@/lib/api-client";

/**
 * **O relógio é fixado, e isto não é zelo excessivo.** O componente abre no
 * mês de hoje; sem fixar, todo teste que clica no dia 17 vira verde em
 * setembro e vermelho em outubro — a suíte passaria a mentir sozinha, sem
 * ninguém ter tocado no código.
 */
vi.mock("@/lib/fuso", async () => {
  const real = await vi.importActual<typeof import("@/lib/fuso")>("@/lib/fuso");
  return {
    ...real,
    hojeNoClube: () => ({ ano: 2026, mes: 9, dia: 18 }),
    hojeNoClubeIso: () => "2026-09-18",
  };
});

/**
 * TEST — SPEC-058/D1 e D2, **o calendário do aluno**.
 *
 * O que se prova aqui é o que a grade promete: dia com aula tem marca, dia
 * clicado abre a lista, trocar de mês avisa a janela, e mês vazio é
 * informação — não erro. O `aria-label` entra em quase todos os testes de
 * propósito: a cor sozinha não pode carregar a informação, e o jeito de
 * garantir isso é ler o rótulo.
 */
/**
 * **A fixture passa pelo mapeador de produção (`deAula`), e não monta o
 * `Compromisso` à mão.** Montar à mão provaria o desenho do teste; passar
 * pelo mapeador prova o caminho que a home usa.
 */
const aulaCrua = (over: Partial<MyClass> = {}): MyClass =>
  ({
    ocupacaoId: "o1",
    turmaId: "t1",
    turmaNome: "Turma Intermediário",
    quadraId: "q1",
    quadraNome: "Quadra 1",
    data: "2026-09-17",
    horaInicio: "19:00:00",
    horaFim: "20:00:00",
    naoRealizada: false,
    faltaAvisada: false,
    ...over,
  }) as MyClass;

const aula = (over: Partial<MyClass> = {}) => deAula(aulaCrua(over));

const reserva = (over: Partial<ItemDaListaDeReservas> = {}) =>
  deReserva({
    id: "r1",
    companyId: "c1",
    quadraId: "q1",
    quadraNome: "Quadra 1",
    data: "2026-09-17",
    horaInicio: "07:00",
    horaFim: "08:00",
    origemTipo: "AVULSO",
    alunoId: "a1",
    alunoNome: "Israel",
    statusPagamento: "pendente_pagamento",
    valor: 120,
    adicionais: [],
    canceladaPorMim: null,
    tipo: "quadra",
    professorNome: null,
    ...over,
  } as ItemDaListaDeReservas);

describe("janelaDoMes", () => {
  it("cobre do dia 1 ao último, inclusive em fevereiro bissexto", () => {
    expect(janelaDoMes(2026, 9)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    expect(janelaDoMes(2028, 2)).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
  });
});

describe("rotuloDoDia", () => {
  it("fala em COMPROMISSO, porque o dia já não é só de aula", () => {
    expect(rotuloDoDia(3, [])).toBe("3, sem compromisso");
    expect(rotuloDoDia(17, [aula()])).toBe("17: 1 compromisso");
    expect(rotuloDoDia(17, [aula(), reserva()])).toBe("17: 2 compromissos");
    expect(rotuloDoDia(17, [aula({ faltaAvisada: true })])).toBe(
      "17: 1 compromisso, 1 com atenção",
    );
    // Reserva cancelada também pede atenção, pelo mesmo motivo: vale abrir.
    expect(rotuloDoDia(17, [reserva({ statusPagamento: "cancelado" })])).toBe(
      "17: 1 compromisso, 1 com atenção",
    );
  });
});

describe("CalendarioDoAluno", () => {
  it("marca o dia com aula e deixa o dia vazio sem marca", () => {
    render(<CalendarioDoAluno compromissos={[aula({ data: "2026-09-17" })]} />);

    const comAula = screen.getByRole("button", { name: /^17: 1 compromisso$/ });
    expect(within(comAula).queryByText("17")).toBeInTheDocument();
    expect(comAula.querySelector("[data-marca-de-aula]")).not.toBeNull();

    const semAula = screen.getByRole("button", { name: "16, sem compromisso" });
    expect(semAula.querySelector("[data-marca-de-aula]")).toBeNull();
  });

  it("o dia com falta avisada ganha o segundo marcador", () => {
    render(<CalendarioDoAluno compromissos={[aula({ faltaAvisada: true })]} />);

    const dia = screen.getByRole("button", { name: /17: 1 compromisso, 1 com atenção/ });
    expect(dia.querySelector("[data-falta-avisada]")).not.toBeNull();
  });

  it("clicar no dia lista as aulas dele", () => {
    render(
      <CalendarioDoAluno
        compromissos={[
          aula({ data: "2026-09-17", turmaNome: "Intermediário" }),
          aula({ ocupacaoId: "o2", data: "2026-09-21", turmaNome: "Beach" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(screen.getByText(/Intermediário/)).toBeInTheDocument();
    expect(screen.queryByText(/Beach/)).not.toBeInTheDocument();
  });

  // AC-002 — o segundo toque no mesmo dia não pode fechar a lista: seria
  // esvaziar justamente o que a pessoa foi ler.
  it("clicar duas vezes no mesmo dia mantém a lista aberta", () => {
    render(<CalendarioDoAluno compromissos={[aula({ turmaNome: "Intermediário" })]} />);
    const dia = screen.getByRole("button", { name: /^17: 1 compromisso$/ });

    fireEvent.click(dia);
    fireEvent.click(dia);

    expect(screen.getByText(/Intermediário/)).toBeInTheDocument();
    expect(dia).toHaveAttribute("aria-pressed", "true");
  });

  it("trocar de mês avisa a janela nova", () => {
    const onJanela = vi.fn();
    render(<CalendarioDoAluno compromissos={[aula()]} onJanela={onJanela} />);

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(onJanela).toHaveBeenCalledTimes(1);
    const { de, ate } = onJanela.mock.calls[0][0];
    expect(de.slice(-2)).toBe("01");
    expect(ate > de).toBe(true);
  });

  // AC-004 — mês sem aula nenhuma é informação, e a grade continua de pé.
  it("mês vazio mostra a grade e diz que não há aula", () => {
    render(<CalendarioDoAluno compromissos={[]} />);

    expect(screen.getByText("Nenhum compromisso neste mês.")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("na home a aula não vira link; em /minhas-aulas vira", () => {
    const { rerender } = render(
      <CalendarioDoAluno compromissos={[aula()]} mostrarLinkDaTurma={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<CalendarioDoAluno compromissos={[aula()]} mostrarLinkDaTurma />);
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/minhas-aulas/turma/t1",
    );
  });
});

/**
 * SPEC-059 — **o calendário completo.** O pedido do Israel, literal: *"deve
 * trazer todos os tipos de reservas, de quadra, de aula particular, e os itens
 * devem mostrar os materiais alugados e informações importantes"*.
 */
describe("SPEC-059 — as três origens no mesmo dia", () => {
  it("cada linha diz o que é, em palavra", () => {
    render(
      <CalendarioDoAluno
        compromissos={[
          aula({ turmaNome: "Intermediário" }),
          reserva({ id: "r2", horaInicio: "08:00", horaFim: "09:00" }),
          reserva({
            id: "r3",
            horaInicio: "09:00",
            horaFim: "10:00",
            tipo: "aula_particular",
            professorNome: "Marcos Lima",
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 3 compromissos$/ }));

    expect(screen.getByText("Aula de turma")).toBeInTheDocument();
    expect(screen.getByText("Reserva · Quadra")).toBeInTheDocument();
    expect(screen.getByText("Aula particular")).toBeInTheDocument();
    expect(screen.getByText(/Marcos Lima/)).toBeInTheDocument();
  });

  it("a ordem é a do relógio, não a da origem", () => {
    render(
      <CalendarioDoAluno
        compromissos={[
          aula({ horaInicio: "19:00:00", turmaNome: "Tarde da noite" }),
          reserva({ horaInicio: "07:00", horaFim: "08:00" }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 2 compromissos$/ }));

    const linhas = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(linhas[0]).toContain("07:00");
    expect(linhas[1]).toContain("19:00");
  });

  // AC-002 — os materiais alugados, que foi metade do pedido.
  it("mostra os materiais alugados, com quantidade", () => {
    render(
      <CalendarioDoAluno
        compromissos={[
          reserva({
            adicionais: [
              { adicionalId: "a1", nome: "Raquete", quantidade: 2, valorUnitario: 10 },
              { adicionalId: "a2", nome: "Toalha", quantidade: 1, valorUnitario: 5 },
            ],
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(screen.getByText("2× Raquete · 1× Toalha")).toBeInTheDocument();
  });

  // AC-003 — cancelada aparece, riscada. Some seria pior: a pessoa reserva de
  // novo achando que esqueceu.
  it("reserva cancelada aparece, marcada", () => {
    render(
      <CalendarioDoAluno
        compromissos={[reserva({ statusPagamento: "cancelado" })]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^17: 1 compromisso, 1 com atenção$/ }),
    );

    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Reserva · Quadra")).toBeInTheDocument();
  });

  it("a situação de pagamento e o valor aparecem", () => {
    render(<CalendarioDoAluno compromissos={[reserva({ valor: 120 })]} />);
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(screen.getByText("A pagar")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?120,00/)).toBeInTheDocument();
  });

  // AC-006 — o Back antigo não manda `tipo`: cai em "Reserva de quadra", que
  // é o caso comum, e não inventa professor nenhum.
  it("sem `tipo` no payload, a reserva não vira aula particular", () => {
    const semTipo = { ...reserva() };
    render(
      <CalendarioDoAluno
        compromissos={[
          deReserva({
            id: "r9",
            companyId: "c1",
            quadraId: "q1",
            data: "2026-09-17",
            horaInicio: "07:00",
            horaFim: "08:00",
            origemTipo: "AVULSO",
            alunoId: "a1",
            alunoNome: "Israel",
            statusPagamento: "pago",
            valor: 100,
            adicionais: [],
            canceladaPorMim: null,
          } as unknown as ItemDaListaDeReservas),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(semTipo.tipo).toBe("quadra");
    expect(screen.getByText("Reserva · Quadra")).toBeInTheDocument();
    expect(screen.queryByText("Aula particular")).not.toBeInTheDocument();
  });
});

describe("listarMateriais", () => {
  it("junta com ponto, e devolve vazio quando não há", () => {
    expect(listarMateriais([])).toBe("");
    expect(listarMateriais([{ nome: "Raquete", quantidade: 2 }])).toBe("2× Raquete");
  });
});

describe("SPEC-059/D3b — o termo é o do clube", () => {
  it("clube que chama de `Espaço` lê `Reserva · Espaço` na agenda", () => {
    render(
      <CalendarioDoAluno
        compromissos={[reserva()]}
        nomes={{ quadra: "Espaço", aula: "Aula com professor" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(screen.getByText("Reserva · Espaço")).toBeInTheDocument();
    expect(screen.queryByText(/Reserva · Quadra/)).not.toBeInTheDocument();
  });

  it("aula particular também usa o nome do clube", () => {
    render(
      <CalendarioDoAluno
        compromissos={[reserva({ tipo: "aula_particular", professorNome: "Marcos" })]}
        nomes={{ quadra: "Espaço", aula: "Aula com professor" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^17: 1 compromisso$/ }));

    expect(screen.getByText("Aula com professor")).toBeInTheDocument();
  });
});
