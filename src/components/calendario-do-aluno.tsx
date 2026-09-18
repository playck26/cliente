"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Circle, Users } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { hojeNoClube, hojeNoClubeIso } from "@/lib/fuso";
import { NOMES_PADRAO, type NomesDeTipo } from "@/lib/nomes-de-tipo";
import type { ItemDaListaDeReservas, MyClass } from "@/lib/api-client";

/**
 * SPEC-058/D1 — **o calendário do aluno.**
 *
 * O Israel usou a home em produção e disse a frase que originou esta tela:
 * *"achei esse calendário muito feio… um calendário mesmo, parecido com o do
 * professor, só que mais atrativo."* A semana que estava aqui (SPEC-029) não
 * era feia por acaso — ela nasceu como faixa de sete dias dentro de outra
 * tela, e continua servindo em `/minhas-aulas`, onde é **uma das duas abas**
 * e o aluno escolhe. Na home ela era imposição.
 *
 * **Nasce do molde de `agenda-do-professor.tsx`, e não da abstração dele.**
 * Os dois desenham uma grade de mês e divergem no que marcam: lá o ponto é
 * *"faltou registrar presença"*, aqui é *"você avisou que vai faltar"*. Uma
 * base comum agora amarraria duas telas que ainda vão andar para lados
 * diferentes — é o mesmo argumento que a SPEC-026 usou para não importar o
 * `agenda-view` do Admin.
 *
 * **Quem busca é o pai.** Este componente recebe as aulas e avisa a janela que
 * está olhando (`onJanela`), como a `SemanaDoAluno` já fazia. Assim a home
 * continua fazendo uma requisição no primeiro desenho.
 */

const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const doisDigitos = (n: number) => String(n).padStart(2, "0");

const chaveDoDia = (ano: number, mes: number, dia: number) =>
  `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

/** `19:00:00` → `19:00`. A API manda segundos; a tela nunca os mostrou. */
const hora = (h: string) => h.slice(0, 5);

/**
 * O primeiro e o último dia do mês, em ISO. **Aritmética em UTC sobre a data
 * já resolvida** — misturar `getDate()` local com `toISOString()` foi
 * exatamente o DEF-020, e este arquivo não vai repeti-lo.
 */
export function janelaDoMes(ano: number, mes: number): { de: string; ate: string } {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { de: chaveDoDia(ano, mes, 1), ate: chaveDoDia(ano, mes, ultimo) };
}

/**
 * SPEC-059/D1 — **o compromisso, seja ele qual for.**
 *
 * O calendário nasceu (SPEC-058) só com aula de turma, e o Israel viu o
 * buraco em produção: quem reservou quadra na sexta abria o calendário e via
 * sexta vazia. **Calendário que esconde compromisso é pior que calendário
 * nenhum**, porque a pessoa confia nele para se organizar.
 *
 * As três origens viram uma lista só aqui, e cada linha **diz o que é**. O
 * rótulo é palavra, não cor: quem não distingue cores tem de conseguir ler
 * (mesma regra da SPEC-052/D3).
 */
export type Compromisso = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: "turma" | "aula_particular" | "quadra";
  titulo: string;
  local: string | null;
  professorNome: string | null;
  materiais: { nome: string; quantidade: number }[];
  valor: number | null;
  pagamento: "pendente_pagamento" | "pago" | "cancelado" | null;
  /** Só aula de turma: o aluno avisou que vai faltar (SPEC-031). */
  faltaAvisada: boolean;
  /** Só aula de turma: declarada como não realizada (SPEC-030). */
  naoRealizada: boolean;
  turmaId: string | null;
};

/**
 * SPEC-059/D3b — **o rótulo usa o termo que o CLUBE deu ao tipo.**
 *
 * A primeira versão escrevia "Reserva de quadra" fixo, e duas coisas
 * apareceram de uma vez: o gate de redação da SPEC-053 recusou a expressão, e
 * o Israel disse o que ele queria de verdade — *"não importa o termo, se é
 * quadra ou se é outro, ele tem que aparecer na agenda"*.
 *
 * Os dois apontam para o mesmo lugar: o nome vem de `nomes-de-tipo` (SPEC-054/
 * D1), que é o que o clube configurou. Clube que chama de "Espaço" lê
 * "Reserva · Espaço" na agenda, sem ninguém tocar em código.
 */
function rotuloDoTipo(tipo: Compromisso["tipo"], nomes: NomesDeTipo): string {
  if (tipo === "turma") return "Aula de turma";
  if (tipo === "aula_particular") return nomes.aula;
  return `Reserva · ${nomes.quadra}`;
}

export function deAula(a: MyClass): Compromisso {
  return {
    id: a.ocupacaoId,
    data: a.data,
    horaInicio: a.horaInicio,
    horaFim: a.horaFim,
    tipo: "turma",
    // `turmaNome` é anulável no contrato; sem turma, a linha ainda precisa
    // dizer o que é.
    titulo: a.turmaNome ?? "Aula",
    local: a.quadraNome ?? null,
    professorNome: null,
    materiais: [],
    valor: null,
    // Aula de turma não tem cobrança por ocorrência (SPEC-011): mostrar
    // "a pagar" nela seria inventar dívida.
    pagamento: null,
    faltaAvisada: a.faltaAvisada,
    naoRealizada: a.naoRealizada,
    turmaId: a.turmaId,
  };
}

/**
 * SPEC-059/AC-006 — **o Back antigo não manda `tipo` nem `professorNome`.**
 *
 * Durante o rollout o Cliente novo conversa com o Back velho, e a ausência
 * cai em "Reserva de quadra" — o caso mais comum, e o que não inventa um
 * professor que ninguém atribuiu. Mesma regra que a SPEC-052 aplicou em
 * `turmas`/`particulares`.
 */
export function deReserva(r: ItemDaListaDeReservas): Compromisso {
  const { tipo, professorNome, quadraNome } = r as Partial<
    Pick<ItemDaListaDeReservas, "tipo" | "professorNome" | "quadraNome">
  >;
  const ehAula = tipo === "aula_particular";
  return {
    id: r.id,
    data: r.data,
    horaInicio: r.horaInicio,
    horaFim: r.horaFim,
    tipo: ehAula ? "aula_particular" : "quadra",
    titulo: ehAula
      ? (professorNome ?? "Aula particular")
      : (quadraNome ?? "Reserva"),
    local: quadraNome ?? null,
    professorNome: professorNome ?? null,
    materiais: (r.adicionais ?? []).map((i) => ({
      nome: i.nome,
      quantidade: i.quantidade,
    })),
    valor: r.valor ?? null,
    pagamento: r.statusPagamento,
    faltaAvisada: false,
    naoRealizada: false,
    turmaId: null,
  };
}

/** "2× Raquete · 1× Toalha" — o que o Israel chamou de materiais alugados. */
export function listarMateriais(
  materiais: Compromisso["materiais"],
): string {
  return materiais.map((m) => `${m.quantidade}× ${m.nome}`).join(" · ");
}

/**
 * SPEC-058/D2 — o que o leitor de tela ouve. **Cor e forma nunca carregam a
 * informação sozinhas** (mesma regra da SPEC-052/D3): o que se vê no dia tem
 * de ser dito por extenso.
 */
export function rotuloDoDia(dia: number, itens: Compromisso[]): string {
  if (itens.length === 0) return `${dia}, sem compromisso`;
  const quantas = `${itens.length} ${itens.length === 1 ? "compromisso" : "compromissos"}`;
  const atencao = itens.filter(
    (i) => i.faltaAvisada || i.pagamento === "cancelado",
  ).length;
  return atencao > 0 ? `${dia}: ${quantas}, ${atencao} com atenção` : `${dia}: ${quantas}`;
}

export function CalendarioDoAluno({
  compromissos,
  nomes = NOMES_PADRAO,
  mostrarLinkDaTurma = true,
  onJanela,
}: {
  compromissos: Compromisso[];
  /** Os nomes que o clube deu aos tipos de reserva (SPEC-054/D1). */
  nomes?: NomesDeTipo;
  /** A home não liga a turma (o cartão já leva); `/minhas-aulas` liga. */
  mostrarLinkDaTurma?: boolean;
  /** Avisado ao trocar de mês, para o pai pedir a janela nova. */
  onJanela?: (janela: { de: string; ate: string }) => void;
}) {
  const hoje = hojeNoClube();
  const [ano, setAno] = useState(hoje.ano);
  const [mes, setMes] = useState(hoje.mes);
  const [diaAberto, setDiaAberto] = useState<string | null>(hojeNoClubeIso());

  /**
   * **Avisa no evento, não em `useEffect`.** Quem muda o mês é o toque no
   * botão; efeito que dispara a cada desenho vira requisição repetida e
   * laço com o `setState` do pai — a `SemanaDoAluno` já aprendeu isso.
   */
  function mudarMes(passo: number) {
    const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
    const novoAno = d.getUTCFullYear();
    const novoMes = d.getUTCMonth() + 1;
    setAno(novoAno);
    setMes(novoMes);
    onJanela?.(janelaDoMes(novoAno, novoMes));
  }

  const porDia = new Map<string, Compromisso[]>();
  for (const a of compromissos) {
    const lista = porDia.get(a.data);
    if (lista) lista.push(a);
    else porDia.set(a.data, [a]);
  }
  for (const lista of porDia.values()) {
    lista.sort((x, y) => x.horaInicio.localeCompare(y.horaInicio));
  }

  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const totalDeDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const doMes = compromissos.filter((a) =>
    a.data.startsWith(`${ano}-${doisDigitos(mes)}`),
  );
  const aulasDoDiaAberto = diaAberto ? (porDia.get(diaAberto) ?? []) : [];

  return (
    <section className="space-y-4" aria-label="Minha agenda por mês">
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => mudarMes(-1)}
          className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-colors active:bg-[var(--color-secondary-container)]"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <h2 className="text-[17px] font-extrabold capitalize">
          {MESES[mes - 1]} de {ano}
        </h2>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => mudarMes(1)}
          className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-colors active:bg-[var(--color-secondary-container)]"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div
        className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-low)] ring-1 ring-border"
        role="grid"
        aria-label={`Calendário de ${MESES[mes - 1]}`}
      >
        <div className="grid grid-cols-7 gap-1">
          {DIAS_DA_SEMANA.map((d, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="py-1 text-center text-[11px] font-extrabold text-[var(--color-text-secondary)]"
            >
              {d}
            </div>
          ))}

          {Array.from({ length: primeiroDiaSemana }, (_, i) => (
            <div key={`vazio-${i}`} aria-hidden="true" />
          ))}

          {Array.from({ length: totalDeDias }, (_, i) => {
            const dia = i + 1;
            const data = chaveDoDia(ano, mes, dia);
            const doDia = porDia.get(data) ?? [];
            const temAula = doDia.length > 0;
            // SPEC-059/D6 — o segundo marcador passa a significar "atenção":
            // falta avisada (aula) **ou** reserva cancelada. São coisas
            // diferentes com a mesma consequência para quem lê a grade — vale
            // a pena abrir o dia.
            const avisou = doDia.some(
              (a) => a.faltaAvisada || a.pagamento === "cancelado",
            );
            const ehHoje = hoje.ano === ano && hoje.mes === mes && hoje.dia === dia;
            const selecionado = diaAberto === data;

            return (
              <button
                key={data}
                type="button"
                // AC-002 — clicar de novo no mesmo dia NÃO fecha. Alternar
                // aqui faria o segundo toque esvaziar a lista logo abaixo,
                // que é justamente o que a pessoa foi ler.
                onClick={() => setDiaAberto(data)}
                aria-label={rotuloDoDia(dia, doDia)}
                aria-pressed={selecionado}
                className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-2xl text-[13px] font-extrabold transition-colors ${
                  selecionado
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : temAula
                      ? "bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]"
                      : // Dia sem aula continua LEGÍVEL: 80% do texto
                        // secundário passa AA. A lição é do calendário do
                        // professor, onde a coluna vazia sumiu na tela.
                        "text-[var(--color-text-secondary)]/80"
                } ${ehHoje && !selecionado ? "ring-2 ring-[var(--color-primary-strong)]" : ""}`}
              >
                {dia}
                {temAula && (
                  <span
                    data-marca-de-aula=""
                    aria-hidden="true"
                    className={`absolute bottom-1.5 size-1.5 rounded-full ${
                      selecionado ? "bg-white" : "bg-[var(--color-primary-strong)]"
                    }`}
                  />
                )}
                {avisou && (
                  <Circle
                    data-falta-avisada=""
                    aria-hidden="true"
                    className={`absolute top-1 size-1.5 fill-current ${
                      selecionado ? "text-white" : "text-[var(--color-error)]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* AC-004 — mês vazio é informação, não erro. */}
      {doMes.length === 0 ? (
        <p className="px-1 text-[13px] font-semibold text-[var(--color-text-secondary)]">
          Nenhum compromisso neste mês.
        </p>
      ) : (
        <div className="space-y-2">
          <h3 className="px-1 text-[12px] font-extrabold tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
            {diaAberto ? diaAberto.split("-").reverse().slice(0, 2).join("/") : ""}
          </h3>
          {aulasDoDiaAberto.length === 0 ? (
            <p className="px-1 text-[13px] font-semibold text-[var(--color-text-secondary)]">
              Sem compromisso neste dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {aulasDoDiaAberto.map((a) => {
                const cancelada = a.pagamento === "cancelado";
                const materiais = listarMateriais(a.materiais);
                const corpo = (
                  <div className="flex items-start gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-low)] ring-1 ring-border">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
                      {a.tipo === "quadra" ? (
                        <TennisCourtIcon className="size-5" aria-hidden="true" />
                      ) : (
                        <Users className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={`text-[15px] font-extrabold ${cancelada ? "line-through" : ""}`}
                        >
                          {hora(a.horaInicio)}–{hora(a.horaFim)}
                        </span>
                        {/*
                          SPEC-059/D1 — **o tipo, em palavra.** Era o pedido
                          literal do Israel: *"nas reservas tem que estar
                          especificado o que é aula, o que é reserva de
                          quadra"*. Cor sozinha não responde isso.
                        */}
                        <span className="rounded-full bg-[var(--color-secondary-container)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
                          {rotuloDoTipo(a.tipo, nomes)}
                        </span>
                      </span>

                      <span
                        className={`block truncate text-[13px] font-semibold text-[var(--color-text-secondary)] ${cancelada ? "line-through" : ""}`}
                      >
                        {a.titulo}
                        {a.local && a.local !== a.titulo ? ` · ${a.local}` : ""}
                      </span>

                      {/* Materiais alugados — o segundo pedido literal. */}
                      {materiais ? (
                        <span className="mt-0.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                          {materiais}
                        </span>
                      ) : null}

                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold">
                        {a.valor != null && (
                          <span className="text-[var(--color-text-secondary)]">
                            {a.valor.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        )}
                        {/*
                          SPEC-041/SPEC-056 — cancelada APARECE, riscada. Quem
                          cancelou precisa ver que cancelou, senão reserva de
                          novo achando que esqueceu.
                        */}
                        {cancelada && (
                          <span className="text-[var(--color-error)]">Cancelada</span>
                        )}
                        {a.pagamento === "pendente_pagamento" && (
                          <span className="text-[var(--color-error)]">A pagar</span>
                        )}
                        {a.pagamento === "pago" && (
                          <span className="text-[var(--color-primary-strong)]">Pago</span>
                        )}
                        {a.faltaAvisada && (
                          <span className="text-[var(--color-text-secondary)]">
                            Você avisou que vai faltar
                          </span>
                        )}
                        {/*
                          SPEC-030 — a aula que não aconteceu não pode parecer
                          aula normal. Achado ALTA da 3ª validação cruzada da
                          SPEC-057; a regra mudou de lugar com o desenho e
                          continua valendo.
                        */}
                        {a.naoRealizada && (
                          <span className="text-[var(--color-error)]">
                            Aula não realizada
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                );
                return (
                  <li key={a.id}>
                    {mostrarLinkDaTurma && a.turmaId ? (
                      <Link href={`/minhas-aulas/turma/${a.turmaId}`}>{corpo}</Link>
                    ) : (
                      corpo
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
