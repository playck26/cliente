"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TopAppBar } from "@/components/top-app-bar";
import { ApiError, listCourts, type Court } from "@/lib/api-client";

// REQ-005 (SPEC-005): aluno navega as quadras ativas da própria empresa.
export function CourtsList() {
  const [quadras, setQuadras] = useState<Court[]>([]);
  const [filtro, setFiltro] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCourts()
      .then((result) => setQuadras(result.data.filter((quadra) => quadra.status === "ativa")))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar as quadras.");
      })
      .finally(() => setLoading(false));
  }, []);

  const esportes = useMemo(() => ["Todas", ...Array.from(new Set(quadras.map((quadra) => quadra.esporte)))], [quadras]);
  const quadrasFiltradas = filtro === "Todas" ? quadras : quadras.filter((quadra) => quadra.esporte === filtro);

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-5 px-5">
        <section className="rounded-3xl bg-[var(--color-court-dark)] p-4 text-white shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/80 uppercase">
                <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
                Quadras
              </div>
              <h1 className="text-[28px] leading-[1.04] font-extrabold">Escolha sua quadra</h1>
              <p className="mt-1.5 text-[13px] font-semibold text-white/70">
                {loading ? "Buscando quadras..." : `${quadras.length} ${quadras.length === 1 ? "quadra ativa" : "quadras ativas"} no clube`}
              </p>
            </div>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-[var(--color-secondary)] text-[var(--color-on-secondary-container)]">
              <Landmark className="size-7" aria-hidden="true" />
            </span>
          </div>

          {esportes.length > 1 ? (
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" aria-label="Filtrar quadras por esporte">
              {esportes.map((esporte) => {
                const ativo = filtro === esporte;
                return (
                  <button key={esporte} type="button" onClick={() => setFiltro(esporte)} aria-pressed={ativo} className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-extrabold transition-colors ${ativo ? "bg-white text-[var(--color-primary-strong)]" : "bg-white/10 text-white ring-1 ring-white/20"}`}>
                    {esporte}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        {error ? (
          <p role="alert" className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border">{error}</p>
        ) : loading ? (
          <div className="space-y-4" aria-label="Carregando quadras">
            {[0, 1].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-[var(--color-surface-container-high)]" />)}
          </div>
        ) : quadrasFiltradas.length === 0 ? (
          <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
            <TennisBallIcon className="mx-auto size-9 text-[var(--color-primary-strong)]" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-extrabold">Nenhuma quadra encontrada</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Tente outro filtro ou consulte seu clube.</p>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Quadras disponíveis para reserva">
            {quadrasFiltradas.map((quadra, index) => (
              <Link key={quadra.id} href={`/quadras/${quadra.id}`} className="block overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-[0.99]">
                <div className={`relative h-[142px] overflow-hidden text-white ${index % 2 === 0 ? "bg-[var(--color-court-clay)]" : "bg-[var(--color-court-blue)]"}`}>
                  <CourtLines />
                  <div className="absolute top-3 right-4 z-10 rounded-2xl bg-white/16 px-3 py-2 text-right backdrop-blur-sm ring-1 ring-white/15">
                    <p className="text-lg leading-none font-extrabold">{quadra.precoHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/75">por hora</p>
                  </div>
                  <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
                    <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">{quadra.esporte}</p>
                    <h2 className="mt-1 text-[22px] leading-tight font-extrabold">{quadra.nome}</h2>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4">
                  <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">Consulte os horários disponíveis</p>
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-primary-strong)] text-white">
                    <ArrowRight className="size-5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
