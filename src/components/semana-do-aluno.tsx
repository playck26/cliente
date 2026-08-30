"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { hojeNoClubeIso } from "@/lib/fuso";
import type { MyClass } from "@/lib/api-client";

/**
 * SPEC-029 — **as próximas aulas do aluno, vistas como semana.**
 *
 * Pedido do Israel: um botão na aba "Próximas" que apresenta as aulas em
 * calendário semanal. A lista responde *"qual é a próxima?"*; a semana
 * responde *"como está a minha semana?"* — que é outra pergunta, e a que
 * alguém faz na segunda de manhã.
 *
 * **Semana em LINHAS, não em sete colunas.** O calendário do professor é uma
 * grade de mês porque ali cada dia precisa de um número e um ponto, nada
 * mais. Aqui cada dia precisa de horário, turma e quadra — em 390px de
 * largura, sete colunas dão 50px cada, e o nome da turma não cabe em nenhuma.
 * Sete linhas cabem, e a semana continua legível de uma olhada.
 *
 * **Os dias vazios aparecem.** Mostrar só os dias com aula economizaria
 * espaço e destruiria a informação: o valor de ver a semana é enxergar os
 * buracos — é neles que se marca uma reserva avulsa.
 *
 * **A janela é a que o servidor dá.** `GET /me/classes` devolve só o futuro,
 * então os dias já passados da semana corrente vêm vazios por definição, não
 * por erro. O passado tem aba própria ("Anteriores"), e a tela diz isso em
 * vez de deixar a pessoa achar que perdeu dado.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Aritmética de dias sobre uma data **já resolvida** (`AAAA-MM-DD`).
 *
 * Em UTC de propósito: a data entra como texto sem fuso e sai como texto sem
 * fuso, então não há conversão em que errar. É a mesma convenção de
 * `isoDeOffsetNoClube` — misturar aritmética local com leitura UTC foi
 * exatamente o DEF-020.
 */
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** O domingo da semana de `iso`. Domingo porque é como o app já numera. */
function domingoDaSemana(iso: string): string {
  const diaDaSemana = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return somarDias(iso, -diaDaSemana);
}

function rotuloCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function SemanaDoAluno({ aulas }: { aulas: MyClass[] }) {
  const hoje = hojeNoClubeIso();
  const [domingo, setDomingo] = useState(() => domingoDaSemana(hoje));

  const dias = Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
  const sabado = dias[6];

  // Agrupa uma vez, em vez de filtrar sete vezes dentro do render.
  const porDia = new Map<string, MyClass[]>();
  for (const aula of aulas) {
    porDia.set(aula.data, [...(porDia.get(aula.data) ?? []), aula]);
  }

  const naSemana = dias.reduce(
    (total, dia) => total + (porDia.get(dia)?.length ?? 0),
    0,
  );
  const ehSemanaDeHoje = domingo === domingoDaSemana(hoje);

  return (
    <section className="space-y-3" aria-label="Minhas aulas por semana">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => setDomingo(somarDias(domingo, -7))}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-[15px] font-extrabold text-[var(--color-text-primary)]">
            {rotuloCurto(domingo)} – {rotuloCurto(sabado)}
          </p>
          {/*
            `aria-live` porque trocar de semana muda a lista inteira sem mover
            o foco: sem isto, quem usa leitor de tela aciona a seta e não ouve
            nada mudar.
          */}
          <p
            aria-live="polite"
            className="text-[11px] font-bold text-[var(--color-text-secondary)]"
          >
            {naSemana === 0
              ? "Nenhuma aula"
              : `${naSemana} ${naSemana === 1 ? "aula" : "aulas"}`}
            {ehSemanaDeHoje ? " · esta semana" : ""}
          </p>
        </div>

        <button
          type="button"
          aria-label="Próxima semana"
          onClick={() => setDomingo(somarDias(domingo, 7))}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      {/*
        Botão de volta, e ele só existe quando serve para alguma coisa. Sem
        ele, quem navegasse quatro semanas à frente teria de tocar quatro
        vezes na seta para voltar ao que importa.
      */}
      {!ehSemanaDeHoje && (
        <button
          type="button"
          onClick={() => setDomingo(domingoDaSemana(hoje))}
          className="mx-auto block rounded-full bg-[var(--color-secondary-container)] px-4 py-1.5 text-[12px] font-extrabold text-[var(--color-primary-strong)]"
        >
          Voltar para esta semana
        </button>
      )}

      <ul className="space-y-2">
        {dias.map((dia) => {
          const doDia = porDia.get(dia) ?? [];
          const ehHoje = dia === hoje;
          const jaPassou = dia < hoje;

          return (
            <li
              key={dia}
              className={`flex gap-3 rounded-3xl p-3 ring-1 ${
                doDia.length > 0
                  ? "bg-surface shadow-[var(--shadow-low)] ring-border"
                  : "bg-[var(--color-surface-container)] ring-transparent"
              }`}
            >
              <div
                className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl ${
                  ehHoje
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : doDia.length > 0
                      ? "bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]"
                      : "text-[var(--color-text-secondary)]/70"
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase">
                  {DIAS[new Date(`${dia}T00:00:00.000Z`).getUTCDay()]}
                </span>
                <span className="text-[15px] font-extrabold">
                  {dia.slice(8)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                {doDia.length === 0 ? (
                  <p className="text-[12px] font-bold text-[var(--color-text-secondary)]/80">
                    {/*
                      Dia passado vazio não é "dia livre": `GET /me/classes` só
                      devolve o futuro, então a aula pode ter existido. Dizer
                      "sem aula" ali seria a tela afirmando o que não sabe.
                    */}
                    {jaPassou ? "—" : "Sem aula"}
                  </p>
                ) : (
                  doDia.map((aula) => (
                    <div key={aula.ocupacaoId} className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-[var(--color-text-primary)]">
                        {aula.horaInicio}–{aula.horaFim} ·{" "}
                        {aula.turmaNome ?? "Turma"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                        <TennisCourtIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{aula.quadraNome}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {jaPassouAlgumDia(dias, hoje) && (
        <p className="px-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
          Os dias com “—” já passaram. Aulas que já aconteceram ficam na aba
          <strong className="font-extrabold"> Anteriores</strong>.
        </p>
      )}
    </section>
  );
}

/** Só explica o “—” quando ele está na tela. Nota de rodapé sem rodapé é ruído. */
function jaPassouAlgumDia(dias: string[], hoje: string): boolean {
  return dias.some((d) => d < hoje);
}
