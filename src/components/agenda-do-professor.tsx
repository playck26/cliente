"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Circle, Users } from "lucide-react";
import {
  ApiError,
  getAgendaDoProfessor,
  getAulasDoDia,
  type AulaDoDiaDoProfessor,
  type DiaDaAgendaDoProfessor,
} from "@/lib/api-client";
import { hojeNoClube } from "@/lib/fuso";

/**
 * SPEC-026 — **o calendário do professor.**
 *
 * O pedido do Israel era *"Calendário → Turma → Alunos → Presença"*, e as
 * três últimas já existiam. Esta tela é a primeira: a **entrada pelo dia**.
 *
 * **O que faz ela valer não é o calendário, é a bolinha.** Um calendário que
 * só diz "tem aula terça" repete o que o professor já sabe de cabeça. O que
 * ele não sabe é **em quais dias ficou faltando registrar presença** — e é
 * isso que o ponto vermelho responde de longe.
 *
 * **Escrito do zero, não importado.** O Admin tem um `agenda-view`, mas são
 * repositórios separados (ADR-001, poly-repo). E este é outro problema: o do
 * gestor é orientado a quadra e inclui reserva avulsa.
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

/**
 * **O mês de hoje sai de `@/lib/fuso`** — não é `new Date().toISOString()`:
 * o servidor e o navegador podem discordar do dia, e à noite o UTC já virou.
 * Aqui isso apareceria como o calendário abrindo em outubro no dia 30 de
 * setembro à noite.
 *
 * DEF-020: esta função nasceu **dentro** deste componente, e enquanto ela
 * morou aqui a tela de reserva continuou errando o mesmo dia com o mesmo
 * `toISOString()`. Regra certa trancada num componente não protege a tela
 * ao lado — por isso virou módulo.
 */
function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function chaveDoDia(ano: number, mes: number, dia: number): string {
  return `${chaveDoMes(ano, mes)}-${String(dia).padStart(2, "0")}`;
}

/**
 * SPEC-052/D1 — a partição do dia por tipo, **ou `null` se o `back` ainda não
 * a manda**.
 *
 * O tipo gerado declara `turmas` e `particulares` obrigatórios, mas durante o
 * rollout o Cliente novo pode conversar com o `back` antigo (SPEC-052,
 * "Rollout"): aí os dois chegam `undefined`, e a grade degrada para a de hoje
 * — sem marcador de tipo — em vez de pintar `undefined > 0`.
 */
function tiposDoDia(
  d: DiaDaAgendaDoProfessor,
): { turmas: number; particulares: number } | null {
  const { turmas, particulares } = d as Partial<
    Pick<DiaDaAgendaDoProfessor, "turmas" | "particulares">
  >;
  if (turmas === undefined || particulares === undefined) return null;
  return { turmas, particulares };
}

/**
 * O que o leitor de tela ouve do dia. SPEC-052/D3: **a cor e a forma nunca
 * carregam a informação sozinhas** — o marcador que se vê precisa ser dito.
 */
function rotuloDoDia(dia: number, d: DiaDaAgendaDoProfessor | undefined): string {
  if (!d) return `${dia}, sem aula`;
  const pendencia = d.pendentes > 0 ? `, ${d.pendentes} sem chamada` : "";
  const tipos = tiposDoDia(d);
  if (tipos === null) {
    return `${dia}: ${d.aulas} ${d.aulas === 1 ? "aula" : "aulas"}${pendencia}`;
  }
  const partes: string[] = [];
  if (tipos.turmas > 0) {
    partes.push(
      `${tipos.turmas} ${tipos.turmas === 1 ? "aula" : "aulas"} de turma`,
    );
  }
  if (tipos.particulares > 0) {
    partes.push(
      `${tipos.particulares} ${tipos.particulares === 1 ? "aula particular" : "aulas particulares"}`,
    );
  }
  return `${dia}: ${partes.join(", ")}${pendencia}`;
}

/**
 * SPEC-052/D3 — **o marcador de tipo: forma E cor.**
 *
 * | tipo       | forma    | token (contraste medido)                          |
 * |------------|----------|---------------------------------------------------|
 * | turma      | círculo  | `primary-strong` — 4,97:1 no dia, 5,75:1 no branco |
 * | particular | quadrado | `court-blue` — 5,39:1 no dia, 6,23:1 no branco     |
 *
 * **Não são os tokens da agenda do gestor** (`*-container`): aqueles medem
 * 1,04:1 entre si e servem de fundo de bloco, não de ponto. Tamanho (`size-2`)
 * e posição (topo) diferentes do ponto de pendência (`size-1.5`, embaixo) —
 * é isso, e não a cor, que separa os dois (azul × vermelho mede 1,39:1).
 *
 * `data-forma` existe para a prova afirmar a FORMA, e não só a classe de cor.
 */
function Marcador({ tipo }: { tipo: "turma" | "particular" }) {
  return tipo === "turma" ? (
    <span
      data-marcador="turma"
      data-forma="circulo"
      aria-hidden="true"
      className="block size-2 rounded-full bg-[var(--color-primary-strong)]"
    />
  ) : (
    <span
      data-marcador="particular"
      data-forma="quadrado"
      aria-hidden="true"
      className="block size-2 rounded-[1px] bg-[var(--color-court-blue)]"
    />
  );
}

export function AgendaDoProfessor() {
  const inicio = hojeNoClube();
  const [ano, setAno] = useState(inicio.ano);
  const [mes, setMes] = useState(inicio.mes);
  const [dias, setDias] = useState<DiaDaAgendaDoProfessor[]>([]);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [aulas, setAulas] = useState<AulaDoDiaDoProfessor[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aulasCarregando, setAulasCarregando] = useState(false);
  const [erroDoDia, setErroDoDia] = useState<string | null>(null);

  /**
   * DEF-021 — **qual pedido de dia ainda vale.**
   *
   * Achado 1 da validação cruzada da SPEC-026, e é o tipo de defeito que
   * nunca aparece em teste manual: o professor toca dia 1, toca dia 2, e a
   * resposta do dia 1 chega **por último**. O cabeçalho dizia "Aulas de
   * 02/09" e os cartões embaixo eram os do dia 1 — com links para
   * `/chamada/:id` das aulas do dia errado.
   *
   * O dano não é visual. É o professor **lançando presença na aula errada**,
   * numa tela que parecia certa. Um contador basta: só a resposta do último
   * pedido pinta.
   */
  const pedidoDoDia = useRef(0);

  useEffect(() => {
    // Mesma corrida do dia, uma escala acima: duas setas rápidas e a
    // resposta do mês anterior pode chegar depois, pintando o calendário
    // que não está mais na tela. `atual` é o padrão do próprio React para
    // isso — a limpeza roda antes do efeito seguinte.
    let atual = true;
    getAgendaDoProfessor(chaveDoMes(ano, mes))
      .then((d) => {
        if (atual) setDias(d);
      })
      .catch((e: unknown) => {
        if (atual)
          setErro(
            e instanceof ApiError ? e.message : "Não foi possível carregar.",
          );
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [ano, mes]);

  function abrirDia(data: string) {
    // Fechar também invalida o pedido em voo: sem isso, a resposta de um dia
    // que o professor acabou de fechar reabriria a lista.
    const meuPedido = ++pedidoDoDia.current;

    if (diaAberto === data) {
      setDiaAberto(null);
      setAulas([]);
      setAulasCarregando(false);
      setErroDoDia(null);
      return;
    }

    setDiaAberto(data);
    setAulas([]);
    setAulasCarregando(true);
    setErroDoDia(null);

    void getAulasDoDia(data)
      .then((r) => {
        if (pedidoDoDia.current !== meuPedido) return;
        setAulas(r);
        setAulasCarregando(false);
      })
      .catch(() => {
        if (pedidoDoDia.current !== meuPedido) return;
        // Antes isto era `setAulas([])`, e a tela mostrava "Carregando
        // aulas…" para sempre — falha silenciosa disfarçada de espera.
        setErroDoDia("Não foi possível carregar as aulas deste dia.");
        setAulasCarregando(false);
      });
  }

  function mudarMes(passo: number) {
    // `Date.UTC` com mês fora de 0..11 normaliza sozinho: mês -1 vira
    // dezembro do ano anterior, 12 vira janeiro do seguinte. É a aritmética
    // que a virada de ano quebraria à mão, e há prova para os dois lados.
    const novo = new Date(Date.UTC(ano, mes - 1 + passo, 1));
    setCarregando(true);
    // DEF-021: trocar de mês invalida o pedido de dia em voo. Sem isto, a
    // resposta de um dia de agosto chegaria depois da troca e abriria uma
    // lista de aulas embaixo do calendário de setembro.
    pedidoDoDia.current += 1;
    setDiaAberto(null);
    setAulas([]);
    setAulasCarregando(false);
    setErroDoDia(null);
    setAno(novo.getUTCFullYear());
    setMes(novo.getUTCMonth() + 1);
  }

  const porData = new Map(dias.map((d) => [d.data, d]));
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const totalDeDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const hoje = hojeNoClube();

  return (
    <div className="space-y-5 px-5">
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => mudarMes(-1)}
          className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border"
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
          className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
        >
          {erro}
        </p>
      )}

      <section
        className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-low)] ring-1 ring-border"
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
            const doDia = porData.get(data);
            const tipos = doDia ? tiposDoDia(doDia) : null;
            const ehHoje =
              hoje.ano === ano && hoje.mes === mes && hoje.dia === dia;
            const selecionado = diaAberto === data;

            return (
              <button
                key={data}
                type="button"
                disabled={!doDia}
                onClick={() => abrirDia(data)}
                aria-label={rotuloDoDia(dia, doDia)}
                aria-pressed={selecionado}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl text-[13px] font-extrabold transition-colors ${
                  selecionado
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : doDia
                      ? "bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]"
                      : // Dia sem aula: de-enfase legitima, mas LEGIVEL. A
                        // pessoa precisa enxergar o numero para saber que dia
                        // e — o print do Israel mostrava esta coluna quase
                        // invisivel, porque a cor era `--muted` (um FUNDO).
                        // 80% de #4e5951 sobre claro passa o contraste AA.
                        "text-[var(--color-text-secondary)]/80"
                } ${ehHoje && !selecionado ? "ring-2 ring-[var(--color-primary-strong)]" : ""}`}
              >
                {dia}
                {/*
                  SPEC-052/D3 — um marcador por tipo presente, no TOPO.

                  **No dia selecionado eles ficam sobre uma pastilha branca.**
                  O fundo do selecionado é `primary-strong`, a mesma cor do
                  círculo: sem a pastilha, o marcador estaria no DOM e sumiria
                  na tela (1,00:1). O ponto de pendência fica FORA dela, branco
                  sobre o fundo, como já era.
                */}
                {tipos && (tipos.turmas > 0 || tipos.particulares > 0) && (
                  <span
                    data-pastilha={selecionado ? "" : undefined}
                    className={`absolute top-1 flex items-center gap-0.5 ${selecionado ? "rounded-full bg-white px-1 py-0.5" : ""}`}
                  >
                    {tipos.turmas > 0 && <Marcador tipo="turma" />}
                    {tipos.particulares > 0 && <Marcador tipo="particular" />}
                  </span>
                )}
                {/*
                  A bolinha é o ponto inteiro da tela: dia com chamada
                  pendente. Sem ela, o calendário só repetiria a grade que o
                  professor já conhece.
                */}
                {doDia && doDia.pendentes > 0 && (
                  <Circle
                    data-pendencia=""
                    className={`absolute bottom-1.5 size-1.5 fill-current ${selecionado ? "text-white" : "text-[var(--color-error)]"}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/*
        SPEC-052/D3 — a legenda em TEXTO. A agenda do gestor pinta por tipo sem
        legenda (LIM-052c); esta não copia a lacuna. Só aparece quando o mês
        traz os tipos: sem eles (rollout), não há marcador a explicar.
      */}
      {dias.some((d) => tiposDoDia(d) !== null) && (
        <ul
          aria-label="Legenda"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12px] font-bold text-[var(--color-text-secondary)]"
        >
          <li className="flex items-center gap-1.5">
            <Marcador tipo="turma" />
            Turma
          </li>
          <li className="flex items-center gap-1.5">
            <Marcador tipo="particular" />
            Aula particular
          </li>
        </ul>
      )}

      {carregando ? (
        <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
          Carregando…
        </p>
      ) : dias.length === 0 ? (
        <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
          Nenhuma aula sua neste mês.
        </p>
      ) : null}

      {diaAberto && (
        <section className="space-y-3" aria-label={`Aulas de ${diaAberto}`}>
          {aulasCarregando ? (
            <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
              Carregando aulas…
            </p>
          ) : erroDoDia ? (
            <p
              role="alert"
              className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
            >
              {erroDoDia}
            </p>
          ) : aulas.length === 0 ? (
            // Não deveria acontecer — só dias com aula são clicáveis. Mas
            // "não deveria" já produziu tela em branco antes, e uma frase
            // custa menos que a dúvida.
            <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
              Nenhuma aula neste dia.
            </p>
          ) : (
            aulas.map((aula) => {
              /*
                SPEC-027 — **aula futura nao vira link.**

                O pedido do Israel foi "nem com possibilidade de realizar
                chamada". Deixar o cartao clicavel e barrar so no `PUT`
                cumpriria a regra e trairia a pessoa: ela abriria a chamada,
                marcaria os alunos e levaria 422 no fim, com o trabalho
                perdido. O caminho tem que nao existir.

                O servidor barra do mesmo jeito (INV-017 + `aulaJaComecou`) —
                isto aqui e a metade honesta, aquela e a metade segura.
              */
              const cartao = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-extrabold text-foreground">
                      {aula.turmaNome ?? "Aula"}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-text-secondary)]">
                      <Users className="size-3.5" aria-hidden="true" />
                      {aula.horaInicio}–{aula.horaFim} · {aula.quadraNome}
                    </p>
                  </div>
                  <EstadoDaChamada estado={aula.chamada} />
                </div>
              );

              /*
                SPEC-052/D3 — a faixa lateral na cor do TIPO, ao lado do selo em
                texto que já existia. SPEC-052/D4 — e a aula de turma leva à
                ficha: é o atalho a partir da aula; o caminho garantido é o
                índice "Suas turmas", que não depende de haver aula no mês.
              */
              const faixa =
                aula.tipo === "particular"
                  ? "border-l-4 border-l-[var(--color-court-blue)]"
                  : "border-l-4 border-l-[var(--color-primary-strong)]";
              const moldura = `block rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border ${faixa}`;
              const verTurma =
                aula.tipo === "turma" && aula.turmaId ? (
                  <Link
                    href={`/minhas-turmas/${aula.turmaId}`}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-extrabold text-[var(--color-primary-strong)]"
                  >
                    Ver turma
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : null;

              /**
               * **`chamada: null` é a aula PARTICULAR** (SPEC-039/LIM-039a), e
               * ela não vira link.
               *
               * *Este era um defeito em produção, e ele chegou aqui por um
               * caminho que vale registrar:* a SPEC-039 tornou `chamada`
               * anulável no contrato, mas o `api-types.ts` deste repositório
               * **não foi regenerado no mesmo ciclo**. O `tsc` continuou
               * verde contra um contrato velho, e o defeito ficou invisível
               * até a SPEC-036 regenerar os tipos por outro motivo.
               *
               * O que o professor via: o selo caía no fallback e dizia
               * **"Ainda não começou"** — numa aula particular do mês
               * passado —, e o cartão levava a `/chamada/:id`, uma tela que
               * não pode funcionar porque aula particular não tem chamada.
               */
              if (aula.chamada === null || aula.chamada === "futura") {
                return (
                  <div key={aula.ocupacaoId} className={moldura}>
                    {cartao}
                    {verTurma}
                  </div>
                );
              }

              /*
                REQ-003 — do dia à chamada em um toque. `/chamada/:id` já
                existe desde a SPEC-014; esta tela só precisava levar até lá.
              */
              // O cartão continua sendo o link da chamada; "Ver turma" fica
              // FORA dele, porque link dentro de link não é HTML válido.
              return (
                <div key={aula.ocupacaoId} className={moldura}>
                  <Link
                    href={`/chamada/${aula.ocupacaoId}`}
                    className="block transition-transform active:scale-[0.99]"
                  >
                    {cartao}
                  </Link>
                  {verTurma}
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}

/**
 * O estado vem **resolvido do servidor** em três valores. A tela não
 * interpreta `completude` nem conta presenças — se interpretasse, viraria uma
 * segunda cópia da regra da SPEC-014.
 */
function EstadoDaChamada({ estado }: { estado: string | null }) {
  const estilo: Record<string, { texto: string; classe: string }> = {
    /*
      SPEC-027 — os dois estados novos, e o pedido do Israel foi literal:
      "a aula que ainda não aconteceu não deve ficar com chamada pendente".
      Ele viu o app marcando pendência numa aula de 31/08 no dia 29.
    */
    futura: {
      texto: "Ainda não começou",
      classe:
        "bg-[var(--color-surface-container)] text-[var(--color-text-secondary)]",
    },
    em_andamento: {
      texto: "Aula em andamento",
      classe:
        "bg-[var(--color-secondary)]/25 text-[var(--color-primary-strong)]",
    },
    pendente: {
      texto: "Chamada pendente",
      classe: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
    },
    feita: {
      texto: "Chamada feita",
      classe:
        "bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]",
    },
    legada: {
      texto: "Chamada antiga",
      classe:
        "bg-[var(--color-court-dark)]/10 text-[var(--color-text-secondary)]",
    },
    /*
      SPEC-030 — a aula que não aconteceu. **Neutro, nunca vermelho:** o
      vermelho quer dizer "você esqueceu", e aqui o professor não esqueceu de
      nada — ele respondeu. Era exatamente este dia que ficava pendente para
      sempre, porque o produto não tinha como registrar chuva.

      Sem o estado aqui, o `nao_houve` cairia no fallback e a aula apareceria
      como "Ainda não começou" — errado, e do jeito mais confuso possível
      numa aula do mês passado.
    */
    nao_houve: {
      texto: "Aula não realizada",
      classe:
        "bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)]",
    },
    /*
      SPEC-057/TASK-001/D4 — terminou depois da ativação da presença
      automática, sem ninguém matriculado nem repondo. Neutro, como o
      `nao_houve`: não há chamada que o professor tenha deixado de fazer.
    */
    sem_participantes: {
      texto: "Sem participantes",
      classe:
        "bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)]",
    },
  };
  /**
   * **`null` é a aula particular** (SPEC-039/LIM-039a), e ela precisa de
   * rótulo próprio — não do fallback.
   *
   * Sem esta linha o selo dizia "Ainda não começou" numa aula do mês passado.
   * Dizer o que a aula **é** responde a pergunta que o professor faz ao ver
   * uma linha sem chamada; o fallback respondia outra, e errado.
   */
  if (estado === null) {
    return (
      <span className="shrink-0 rounded-full bg-[var(--color-surface-container-high)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-text-secondary)]">
        Aula particular
      </span>
    );
  }

  /*
    Fallback NEUTRO, não `pendente`. Se o servidor um dia mandar um estado
    que esta versão do app não conhece, pintar de vermelho seria acusar o
    professor de esquecimento por causa de um deploy fora de ordem.
  */
  const { texto, classe } = estilo[estado] ?? estilo.futura;

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${classe}`}
    >
      {texto}
    </span>
  );
}
