"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronRight, Users } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { TopAppBar } from "@/components/top-app-bar";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApiError,
  getMe,
  listMinhasTurmas,
  type MinhaTurma,
  type Usuario,
} from "@/lib/api-client";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/**
 * SPEC-013 — a grade do professor.
 *
 * É a tela inteira do app dele: sem quadras, sem reservas, sem valores. O
 * professor não é um aluno com permissões a mais nem um gestor com
 * permissões a menos — ele lê a própria grade e quem está nela.
 *
 * **Esta tela não tinha `BottomNav`, e o motivo era bom:** uma barra com um
 * item só é decoração, e com os itens do aluno seria mentira, porque o
 * servidor recusa todos eles (INV-012).
 *
 * **O DEF-011 mostrou que o raciocínio estava certo e o alcance errado.** A
 * decisão morava neste comentário, então `perfil-view` — a única tela que
 * aluno e professor dividem — não a conhecia, renderizava a barra do aluno,
 * e o professor ficava preso lá sem caminho de volta para cá.
 *
 * Agora `BottomNav` conhece o papel e dá ao professor **dois** itens, os
 * dois reais: esta tela e o perfil. E ela entra aqui: não renderizá-la
 * manteria metade do defeito — ele chegaria ao perfil e não voltaria.
 */
export function MinhasTurmasView() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [turmas, setTurmas] = useState<MinhaTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMe(), listMinhasTurmas()])
      .then(([usuarioData, turmasData]) => {
        setUsuario(usuarioData);
        setTurmas(turmasData);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar suas turmas.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar saudacao={usuario?.nome.split(" ")[0]} />

      {/* `pb-28` abre espaço para a barra fixa não cobrir a última turma. */}
      <main className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-28">
        <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]">
          <CourtLines className="opacity-35" />
          <div className="relative z-10 flex min-h-40 flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-white/65 uppercase">Painel do professor</p>
                <h1 className="mt-2 text-3xl leading-tight font-extrabold">Minhas turmas</h1>
                <p className="mt-1 text-sm text-white/70">Sua agenda de aulas em um só lugar.</p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[var(--color-court-dark)] shadow-lg">
                <CalendarCheck className="size-6" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-end justify-between border-t border-white/20 pt-4">
              <div>
                <p className="text-3xl font-extrabold">{loading ? "—" : turmas.length}</p>
                <p className="text-xs font-semibold text-white/65">turmas atribuídas</p>
              </div>
              <p className="max-w-32 text-right text-xs leading-relaxed text-white/60">Toque em uma turma para ver alunos e chamadas.</p>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        {!loading && !error && turmas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays
                className="size-8 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <p className="font-medium">Nenhuma turma atribuída a você</p>
              {/* Estado vazio que diz o que fazer: sem isso, o professor
                  fica sem saber se o app quebrou ou se o gestor ainda não
                  o vinculou. */}
              <p className="text-sm text-[var(--color-text-secondary)]">
                Quando o gestor colocar você como professor de uma turma, ela
                aparece aqui.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && turmas.length > 0 ? (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Sua grade</h2>
            <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">Semanal</span>
          </div>
        ) : null}

        <ul className="flex flex-col gap-3">
          {turmas.map((turma) => (
            <li key={turma.id}>
              <Link href={`/minhas-turmas/${turma.id}`} className="block">
                <Card className="border-0 shadow-[var(--shadow-low)] ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-[var(--color-primary)]">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-[var(--color-primary-strong)]">
                      <span className="text-[10px] font-bold uppercase">{(DIAS_SEMANA[turma.diaSemana] ?? "—").slice(0, 3)}</span>
                      <span className="text-sm font-extrabold">{turma.horaInicio.slice(0, 2)}h</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="truncate text-base font-extrabold">{turma.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {DIAS_SEMANA[turma.diaSemana] ?? "—"}, {turma.horaInicio}–{turma.horaFim}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <TennisCourtIcon className="size-4" aria-hidden="true" />
                          {turma.quadraNome}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-4" aria-hidden="true" />
                          {turma.totalAlunos}/{turma.capacidade}
                        </span>
                      </span>
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-[var(--color-primary-strong)]"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      {/*
        DEF-011 — sem isto o professor chega ao perfil e não volta. O papel
        vem do `getMe()` que esta tela já faz.
      */}
      <BottomNav papel={usuario?.role} />
    </div>
  );
}
