"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { CapaDaQuadra } from "@/components/capa-da-quadra";
// SPEC-041/B4 — extraido daqui quando as reservas precisaram do mesmo grupo
// de filtros. Copiar teria criado a segunda copia da mesma decisao.
import { GrupoDeFiltro } from "@/components/grupo-de-filtro";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { ApiError, listCourts, type Court, type OpcaoDeCatalogo } from "@/lib/api-client";

/**
 * SPEC-020/TASK-006 — a barra de filtro passa a ter DOIS grupos, esporte e
 * categoria de piso, e os dois vêm do catálogo do clube.
 *
 * **De onde saem as opções, e por que isso não contradiz a spec.** Elas são
 * derivadas das quadras que já chegaram. A INV-056 original proibia isso, e a
 * 1ª rodada de dúvida derrubou a proibição: o defeito nunca foi "olhar para as
 * quadras", era o valor ser **texto digitado**. Agora `quadra.esporte` é uma
 * referência ao catálogo — derivar dela **é** derivar do catálogo.
 *
 * E derivar assim entrega duas coisas de graça:
 *
 * - **AC-008**, opção sem quadra não vira filtro morto. Um clube com 6
 *   categorias e 2 em uso não empurra 4 botões que não filtram nada;
 * - **NFR-001**, continua **uma** requisição. Filtro não vale três idas à rede.
 */

/**
 * Uma opção só é oferecida quando escolhê-la muda alguma coisa.
 *
 * **Contar as opções não basta**, e é aqui que mora a sutileza: um clube com
 * *uma* categoria e algumas quadras sem categoria tem escolha real — ver só as
 * de saibro exclui as sem classificação. Já um clube onde *toda* quadra é de
 * tênis não tem escolha nenhuma. Por isso o "sem opção" conta como um balde.
 */
function opcoesDe(quadras: Court[], de: (quadra: Court) => OpcaoDeCatalogo | null) {
  const porId = new Map<string, OpcaoDeCatalogo>();
  let temSemOpcao = false;

  for (const quadra of quadras) {
    const opcao = de(quadra);
    if (opcao === null) {
      temSemOpcao = true;
    } else {
      porId.set(opcao.id, opcao);
    }
  }

  const opcoes = [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { opcoes, oferece: opcoes.length + (temSemOpcao ? 1 : 0) > 1 };
}

// REQ-005 (SPEC-005): aluno navega as quadras ativas da própria empresa.
export function CourtsList() {
  const [quadras, setQuadras] = useState<Court[]>([]);
  const [esporteId, setEsporteId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
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

  const esportes = useMemo(() => opcoesDe(quadras, (quadra) => quadra.esporte), [quadras]);
  const categorias = useMemo(() => opcoesDe(quadras, (quadra) => quadra.categoria), [quadras]);

  // AC-009 — os dois se combinam por INTERSEÇÃO. `null` de um lado significa
  // "não filtra por isto", e não "casa com qualquer coisa": uma quadra SEM
  // categoria não pertence a categoria nenhuma, então ela some quando o aluno
  // escolhe uma — e volta quando ele limpa.
  const quadrasFiltradas = quadras.filter(
    (quadra) =>
      (esporteId === null || quadra.esporte?.id === esporteId) &&
      (categoriaId === null || quadra.categoria?.id === categoriaId),
  );

  // SPEC-022 — a moldura (main, TopAppBar, BottomNav) saiu daqui e passou
  // para `reservas-tabs.tsx`. Duas telas irmãs dentro de abas não podem
  // desenhar duas barras: este componente agora é conteúdo, não tela.
  return (
    <>
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
              <TennisCourtIcon className="size-7" aria-hidden="true" />
            </span>
          </div>

          {esportes.oferece ? (
            <GrupoDeFiltro rotulo="Filtrar quadras por esporte" textoTodas="Todos os esportes" opcoes={esportes.opcoes} escolhida={esporteId} onEscolher={setEsporteId} />
          ) : null}
          {categorias.oferece ? (
            <GrupoDeFiltro rotulo="Filtrar quadras por categoria" textoTodas="Todas as categorias" opcoes={categorias.opcoes} escolhida={categoriaId} onEscolher={setCategoriaId} />
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
                  <CapaDaQuadra imagemUrl={quadra.imagemUrl} nome={quadra.nome} />
                  <div className="absolute top-3 right-4 z-10 rounded-2xl bg-white/16 px-3 py-2 text-right backdrop-blur-sm ring-1 ring-white/15">
                    <p className="text-lg leading-none font-extrabold">{quadra.precoHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/75">por hora</p>
                  </div>
                  <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
                    {/*
                      DEF-012 — era `{quadra.esporte}`, e desde a TASK-003 isso é
                      um objeto: o React estourava e a tela ficava BRANCA, não
                      com texto errado. "Quadra" cobre a que o backfill não
                      catalogou.
                    */}
                    <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">
                      {quadra.esporte?.nome ?? "Quadra"}
                      {quadra.categoria === null ? null : <span className="text-white/60"> · {quadra.categoria.nome}</span>}
                    </p>
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
    </>
  );
}
