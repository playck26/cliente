"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDays, Clock, Eye, Plus } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TopAppBar } from "@/components/top-app-bar";
import { ApiError, getMe, listMyClasses, type MyClass, type Usuario } from "@/lib/api-client";

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

const ATALHOS = [
  { href: "/quadras", label: "Reservar", Icon: Plus },
  { href: "/minhas-aulas", label: "Aulas", Icon: TennisBallIcon },
  { href: "/quadras", label: "Quadras", Icon: TennisCourtIcon },
  { href: "/reservas", label: "Reservas", Icon: CalendarCheck },
] as const;

// REQ-001 (SPEC-005): Home mostra nome do aluno e a próxima aula.
export function HomeView() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [aulas, setAulas] = useState<MyClass[]>([]);
  const [agendaIndisponivel, setAgendaIndisponivel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DEF-007 (2026-08-24) — três defeitos empilhados, achados em produção:
  //
  // 1. `/me/classes` é `@Roles('aluno')`, mas `rotaInicial()` manda para cá
  //    TODO papel que não é professor — gestor e super admin inclusive. Para
  //    eles a chamada sempre devolveu 403.
  // 2. O `Promise.all` fazia esse 403 derrubar o `getMe()` junto, e a home
  //    inteira — nome, agenda, atalhos — virava uma palavra vermelha.
  // 3. A palavra era "Forbidden", crua do servidor. Ninguém consegue agir
  //    sobre isso.
  //
  // A ordem aqui é deliberada: o `getMe()` decide o que mais vale a pena
  // pedir, e o que é secundário não pode derrubar o que é principal.
  useEffect(() => {
    let ativo = true;

    getMe()
      .then(async (usuarioData) => {
        if (!ativo) return;
        setUsuario(usuarioData);

        if (usuarioData.role !== "aluno") return;

        try {
          const aulasData = await listMyClasses();
          if (ativo) setAulas(aulasData);
        } catch {
          // A agenda é dado secundário: sem ela a home fica de pé, e o
          // aviso ocupa o lugar dela em vez do lugar da tela.
          if (ativo) setAgendaIndisponivel(true);
        }
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setError(
          err instanceof ApiError && err.status === 403
            ? "Sua conta não tem acesso a esta área."
            : "Não foi possível carregar a home.",
        );
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const primeiroNome = usuario?.nome.split(" ")[0];
  const proximaAula = aulas[0] ?? null;

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar saudacao={primeiroNome} />

      <div className="space-y-6 px-5">
        {error ? (
          <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-low)] ring-1 ring-border">
            <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">
              {error}
            </p>
          </section>
        ) : loading ? (
          <section className="relative h-[286px] animate-pulse overflow-hidden rounded-3xl bg-[var(--color-primary-container)]" aria-label="Carregando próxima aula" />
        ) : (
          <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-4 text-white shadow-[var(--shadow-lift)]">
            <CourtLines className="opacity-45" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/85 uppercase ring-1 ring-white/10">
                    <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
                    {proximaAula ? "Próxima aula" : "Sua agenda"}
                  </div>
                  <p className="text-[15px] font-semibold text-white/78">
                    {primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
                  </p>
                  <h1 className="mt-1 text-[32px] leading-[1.02] font-extrabold">
                    {proximaAula ? (proximaAula.turmaNome ?? "Turma") : "Pronto para jogar?"}
                  </h1>
                  <p className="mt-2 text-[15px] font-semibold text-white/78">
                    {proximaAula
                      ? `${formatarData(proximaAula.data)} • ${proximaAula.horaInicio}–${proximaAula.horaFim}`
                      : "Encontre uma quadra e monte seu próximo jogo."}
                  </p>
                </div>
                <span className="flex size-[62px] shrink-0 items-center justify-center rounded-3xl bg-white/12 ring-1 ring-white/10">
                  <TennisBallIcon className="size-10 text-[#b8ff29]" strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>

              {proximaAula ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/12 px-3 text-[13px] font-bold ring-1 ring-white/20">
                    <TennisCourtIcon className="size-4 text-[var(--color-secondary)]" aria-hidden="true" />
                    {proximaAula.quadraNome}
                  </span>
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/12 px-3 text-[13px] font-bold ring-1 ring-white/20">
                    <Clock className="size-4 text-[var(--color-secondary)]" aria-hidden="true" />
                    {proximaAula.horaInicio}
                  </span>
                </div>
              ) : null}

              {agendaIndisponivel ? (
                <p
                  role="status"
                  className="mt-4 text-[13px] font-semibold text-white/72"
                >
                  Não foi possível carregar sua agenda agora. O resto da home
                  continua funcionando.
                </p>
              ) : null}

              <Link
                href={proximaAula ? "/minhas-aulas" : "/quadras"}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)] transition-transform active:scale-[0.98]"
              >
                {proximaAula ? <Eye className="size-5" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}
                {proximaAula ? "Ver aula" : "Reservar quadra"}
              </Link>
            </div>
          </section>
        )}

        <section aria-label="Atalhos" className="grid grid-cols-4 gap-3">
          {ATALHOS.map(({ href, label, Icon }) => (
            <Link key={label} href={href} className="group flex min-w-0 flex-col items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-[var(--color-primary-strong)] shadow-[var(--shadow-low)] ring-1 ring-border transition-transform group-active:scale-95">
                <Icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="w-full text-[11px] font-bold text-[var(--color-text-secondary)]">{label}</span>
            </Link>
          ))}
        </section>

        <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-low)] ring-1 ring-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-primary-strong)] uppercase">Sua agenda</p>
              <h2 className="mt-1 text-xl font-extrabold text-[var(--color-text-primary)]">
                {aulas.length > 0 ? `${aulas.length} ${aulas.length === 1 ? "aula programada" : "aulas programadas"}` : "A agenda está livre"}
              </h2>
              <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                Consulte seus próximos treinos em um só lugar.
              </p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <CalendarDays className="size-6" aria-hidden="true" />
            </span>
          </div>
          <Link href="/minhas-aulas" className="mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-[var(--color-surface-container)] px-4 text-sm font-extrabold text-[var(--color-primary-strong)]">
            Abrir agenda
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">Quadras PlayCK</p>
              <h2 className="mt-1 text-xl font-extrabold">Seu próximo jogo começa aqui</h2>
              <p className="mt-1 text-sm font-medium text-white/65">Veja quadras, valores e horários disponíveis.</p>
            </div>
            <Link href="/quadras" aria-label="Ver quadras" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-court-dark)]">
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
