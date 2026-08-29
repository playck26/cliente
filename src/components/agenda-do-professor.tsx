"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Circle, Users } from "lucide-react";
import {
  ApiError,
  getAgendaDoProfessor,
  getAulasDoDia,
  type AulaDoDiaDoProfessor,
  type DiaDaAgendaDoProfessor,
} from "@/lib/api-client";

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
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * **O mês de hoje, no fuso do clube.**
 *
 * Não é `new Date().toISOString()`: o servidor e o navegador podem discordar
 * do dia, e à noite o UTC já virou. É a mesma armadilha que
 * `date-time.util.ts` documenta no backend, e que já derrubou um teste meu.
 * Aqui ela apareceria como o calendário abrindo em outubro no dia 30 de
 * setembro à noite.
 */
const FUSO = "America/Sao_Paulo";

function hojeNoClube(): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { ano, mes, dia };
}

function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function chaveDoDia(ano: number, mes: number, dia: number): string {
  return `${chaveDoMes(ano, mes)}-${String(dia).padStart(2, "0")}`;
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

  useEffect(() => {
    // Sem `setState` síncrono aqui: trocar de mês zera `carregando` e o dia
    // aberto **no evento** (`mudarMes`), que é onde a decisão acontece.
    // A regra `react-hooks/set-state-in-effect` está certa, e desligá-la
    // seria trocar um aviso legítimo por conveniência.
    getAgendaDoProfessor(chaveDoMes(ano, mes))
      .then(setDias)
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      )
      .finally(() => setCarregando(false));
  }, [ano, mes]);

  function abrirDia(data: string) {
    if (diaAberto === data) {
      setDiaAberto(null);
      return;
    }
    setDiaAberto(data);
    setAulas([]);
    void getAulasDoDia(data)
      .then(setAulas)
      .catch(() => setAulas([]));
  }

  function mudarMes(passo: number) {
    // `Date.UTC` com mês fora de 0..11 normaliza sozinho: mês -1 vira
    // dezembro do ano anterior, 12 vira janeiro do seguinte. É a aritmética
    // que a virada de ano quebraria à mão, e há prova para os dois lados.
    const novo = new Date(Date.UTC(ano, mes - 1 + passo, 1));
    setCarregando(true);
    setDiaAberto(null);
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
            const ehHoje =
              hoje.ano === ano && hoje.mes === mes && hoje.dia === dia;
            const selecionado = diaAberto === data;

            return (
              <button
                key={data}
                type="button"
                disabled={!doDia}
                onClick={() => abrirDia(data)}
                aria-label={
                  doDia
                    ? `${dia}: ${doDia.aulas} ${doDia.aulas === 1 ? "aula" : "aulas"}${doDia.pendentes > 0 ? `, ${doDia.pendentes} sem chamada` : ""}`
                    : `${dia}, sem aula`
                }
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
                  A bolinha é o ponto inteiro da tela: dia com chamada
                  pendente. Sem ela, o calendário só repetiria a grade que o
                  professor já conhece.
                */}
                {doDia && doDia.pendentes > 0 && (
                  <Circle
                    className={`absolute bottom-1.5 size-1.5 fill-current ${selecionado ? "text-white" : "text-[var(--color-error)]"}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {carregando ? (
        <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">Carregando…</p>
      ) : dias.length === 0 ? (
        <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
          Nenhuma aula sua neste mês.
        </p>
      ) : null}

      {diaAberto && (
        <section className="space-y-3" aria-label={`Aulas de ${diaAberto}`}>
          {aulas.length === 0 ? (
            <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">Carregando aulas…</p>
          ) : (
            aulas.map((aula) => (
              /*
                REQ-003 — do dia à chamada em um toque. `/chamada/:id` já
                existe desde a SPEC-014; esta tela só precisava levar até lá.
              */
              <Link
                key={aula.ocupacaoId}
                href={`/chamada/${aula.ocupacaoId}`}
                className="block rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-[0.99]"
              >
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
              </Link>
            ))
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
function EstadoDaChamada({ estado }: { estado: string }) {
  const estilo: Record<string, { texto: string; classe: string }> = {
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
      classe: "bg-[var(--color-court-dark)]/10 text-[var(--color-text-secondary)]",
    },
  };
  const { texto, classe } = estilo[estado] ?? estilo.pendente;

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${classe}`}
    >
      {texto}
    </span>
  );
}
