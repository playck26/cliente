"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, Landmark } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TopAppBar } from "@/components/top-app-bar";
import { ApiError, listMyClasses, type MyClass } from "@/lib/api-client";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// REQ-002 (SPEC-005): aluno lista as próprias próximas aulas. View-only.
export function MyClassesList() {
  const [aulas, setAulas] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyClasses()
      .then(setAulas)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar suas aulas.");
      })
      .finally(() => setLoading(false));
  }, []);

  const totalQuadras = new Set(aulas.map((aula) => aula.quadraId)).size;

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-5 px-5">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-4 text-white shadow-[var(--shadow-lift)]">
          <CourtLines className="opacity-30" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/80 uppercase ring-1 ring-white/10">
                  <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
                  Minhas aulas
                </div>
                <h1 className="text-[28px] leading-[1.04] font-extrabold">Agenda de treino</h1>
                <p className="mt-1.5 text-[13px] font-semibold text-white/75">
                  {loading ? "Carregando sua agenda..." : `${aulas.length} ${aulas.length === 1 ? "aula programada" : "aulas programadas"}`}
                </p>
              </div>
              <span className="flex size-[60px] shrink-0 items-center justify-center rounded-3xl bg-white/12 ring-1 ring-white/10">
                <TennisBallIcon className="size-9 text-[#b8ff29]" strokeWidth={2.25} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20">
                <p className="text-[22px] leading-none font-extrabold">{loading ? "–" : aulas.length}</p>
                <p className="mt-1 text-[11px] font-bold text-white/70">próximas</p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20">
                <p className="text-[22px] leading-none font-extrabold">{loading ? "–" : totalQuadras}</p>
                <p className="mt-1 text-[11px] font-bold text-white/70">quadras</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border">{error}</p>
        ) : loading ? (
          <div className="space-y-3" aria-label="Carregando aulas">
            {[0, 1].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl bg-[var(--color-surface-container-high)]" />)}
          </div>
        ) : aulas.length === 0 ? (
          <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <CalendarDays className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">Nenhuma aula agendada</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Quando seu clube programar uma aula, ela aparecerá aqui.</p>
          </section>
        ) : (
          <section className="space-y-3" aria-label="Próximas aulas">
            {aulas.map((aula, index) => (
              <article key={aula.ocupacaoId} className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-primary-strong)] uppercase">
                      {formatarData(aula.data)} • {aula.horaInicio}
                    </p>
                    <h2 className="mt-1 truncate text-[19px] font-extrabold text-[var(--color-text-primary)]">{aula.turmaNome ?? "Turma"}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                      <Landmark className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{aula.quadraNome}</span>
                    </p>
                  </div>
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${index === 0 ? "bg-[var(--color-secondary-container)]" : "bg-[var(--color-primary-container)]/55"} text-[var(--color-primary-strong)]`}>
                    {index === 0 ? <Clock className="size-6" aria-hidden="true" /> : <TennisBallIcon className="size-6" aria-hidden="true" />}
                  </span>
                </div>
                <div className="mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-[var(--color-surface-container)] px-4">
                  <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">{aula.horaInicio}–{aula.horaFim}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)] ring-1 ring-border">Agendada</span>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
