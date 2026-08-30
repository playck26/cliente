"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CalendarRange, Clock, List } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { CourtLines } from "@/components/court-lines";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { SemanaDoAluno } from "@/components/semana-do-aluno";
import { ApiError, listMyClasses, type MyClass } from "@/lib/api-client";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * SPEC-029 — **a vista mora na URL**, como as abas (`abas-na-url.tsx`).
 *
 * Mesmo raciocínio, e ele já está escrito lá: link compartilhável, "voltar"
 * que desfaz a troca, e a vista padrão fora do endereço para o que a pessoa
 * copia ficar limpo. Guardar em `useState` faria o botão do navegador
 * atravessar a troca sem desfazê-la.
 */
type Vista = "lista" | "semana";

function useVista(): { vista: Vista; irPara: (v: Vista) => void } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vista: Vista = searchParams.get("vista") === "semana" ? "semana" : "lista";

  const irPara = (nova: Vista) => {
    if (nova === vista) return;
    // Preserva o resto da query (`?aba=`, por exemplo) em vez de reescrever o
    // endereço inteiro — foi assim que a barra de abas evitou de apagar o que
    // não é dela.
    const params = new URLSearchParams(searchParams.toString());
    if (nova === "lista") params.delete("vista");
    else params.set("vista", nova);
    const qs = params.toString();
    router.push(qs ? `/minhas-aulas?${qs}` : "/minhas-aulas", {
      scroll: false,
    });
  };

  return { vista, irPara };
}

// REQ-002 (SPEC-005): aluno lista as próprias próximas aulas. View-only.
export function MyClassesList() {
  const [aulas, setAulas] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { vista, irPara } = useVista();

  useEffect(() => {
    listMyClasses()
      .then(setAulas)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar suas aulas.");
      })
      .finally(() => setLoading(false));
  }, []);

  const totalQuadras = new Set(aulas.map((aula) => aula.quadraId)).size;

  // SPEC-023 — a moldura saiu daqui: esta tela virou uma aba dentro de
  // `aulas-tabs.tsx`, ao lado das turmas do clube. Mesma razao de
  // `courts-list` e `my-bookings-list` na SPEC-022.
  return (
    <>
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

        {/*
          SPEC-029 — **o alternador de vista**, pedido do Israel.

          Dois botões visíveis em vez de um que troca de rótulo: um botão só,
          escrito "Semana", não diz se essa é a vista atual ou o destino — e a
          pessoa descobre tocando. `aria-pressed` conta a mesma coisa para
          quem usa leitor de tela.

          Fica escondido enquanto carrega e no erro: alternar entre duas
          telas vazias não é escolha.
        */}
        {!loading && !error && aulas.length > 0 ? (
          <div
            role="group"
            aria-label="Como ver as aulas"
            className="flex gap-2 rounded-2xl bg-[var(--color-surface-container)] p-1"
          >
            {([
              { id: "lista", rotulo: "Lista", Icone: List },
              { id: "semana", rotulo: "Semana", Icone: CalendarRange },
            ] as const).map(({ id, rotulo, Icone }) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => irPara(id)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold transition-colors ${
                  vista === id
                    ? "bg-surface text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <Icone className="size-4" aria-hidden="true" />
                {rotulo}
              </button>
            ))}
          </div>
        ) : null}

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
        ) : vista === "semana" ? (
          <SemanaDoAluno aulas={aulas} />
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
                      <TennisCourtIcon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{aula.quadraNome}</span>
                    </p>
                  </div>
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${index === 0 ? "bg-[var(--color-secondary-container)]" : "bg-[var(--color-primary-container)]/55"} text-[var(--color-primary-strong)]`}>
                    {index === 0 ? <Clock className="size-6" aria-hidden="true" /> : <TennisBallIcon className="size-6" aria-hidden="true" />}
                  </span>
                </div>
                <div className="mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-[var(--color-surface-container)] px-4">
                  <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">{aula.horaInicio}–{aula.horaFim}</span>
                  {/* SPEC-030 / achado 2 da validação cruzada — a aula que
                      NÃO aconteceu. Sem isto ela aparecia aqui como
                      "Agendada" até o dia passar, e no dia seguinte sumia
                      das "Anteriores" (o filtro da avaliação) sem nunca
                      dizer o que houve. O aluno pode ter ido até o clube. */}
                  {aula.naoRealizada ? (
                    <span className="rounded-full bg-[var(--color-surface-container-high)] px-3 py-1 text-[11px] font-extrabold text-[var(--color-text-secondary)] ring-1 ring-border">
                      Não realizada
                    </span>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)] ring-1 ring-border">Agendada</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
