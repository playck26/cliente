"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { SemanaDoAluno } from "@/components/semana-do-aluno";
import { TopAppBar } from "@/components/top-app-bar";
import { ApiError, getMe, listMyClasses, type MyClass, type Usuario } from "@/lib/api-client";

/**
 * SPEC-005/REQ-001 — a primeira tela do aluno.
 *
 * **SPEC-057/TASK-003 (card 5353) — a home abre na AGENDA.** O que saiu, e
 * por quê:
 *
 * - **A faixa de atalhos.** Dos três, dois eram duplicata literal do menu
 *   inferior — mesmo rótulo, mesmo destino e **mesmo ícone** (`Aulas` →
 *   `/minhas-aulas`, `Reservas` → `/reservas`). Sobraria "Reservar", e faixa
 *   de um item é decoração: o precedente é a SPEC-052/D7, que **removeu** a
 *   faixa equivalente do painel do gestor em vez de encolhê-la.
 * - **O card "Sua agenda".** Ele contava aulas ("3 aulas programadas") e
 *   oferecia "Abrir agenda". Com a agenda aberta logo acima, virou um
 *   contador de uma lista visível.
 * - **O hero "Próxima aula".** Repetia o primeiro item da semana. Com ele, a
 *   mesma aula aparecia duas vezes na mesma tela.
 *
 * **O que NÃO saiu, e é o detalhe que importa:** o aviso de falha da agenda
 * morava *dentro* do hero. Removê-lo junto faria a falha voltar a ser
 * silenciosa — o mesmo defeito do DEF-033, noutra tela. Ele agora tem lugar
 * próprio.
 *
 * **A semana não custa rede:** a home já buscava `/me/classes` para contar as
 * aulas. É o mesmo dado, agora desenhado.
 */
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
  const ehAluno = usuario?.role === "aluno";

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
        ) : null}

        {/* **AC-019.** Fora do hero, porque o hero saiu — e este aviso é a
            única coisa que distingue "você não tem aula" de "não consegui
            carregar sua agenda". */}
        {agendaIndisponivel ? (
          <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
            <p role="status" className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
              Não foi possível carregar sua agenda agora. O resto da home
              continua funcionando.
            </p>
          </section>
        ) : null}

        {loading && !error ? (
          <section
            className="h-[420px] animate-pulse rounded-3xl bg-[var(--color-surface-container)]"
            aria-label="Carregando sua agenda"
          />
        ) : null}

        {/*
          **LIM-057h — até a TASK-002, esta semana não clica e não tem
          passado.** O rodapé do próprio componente explica o "—" dos dias
          que já passaram, e o menu inferior mantém `/minhas-aulas` a um
          toque. A tela não finge o que ainda não faz.

          `mostrarQuadra={false}`: a home não escreve a palavra "quadra"
          (SPEC-053/AC-001, decisão 6 do Israel), e cada aula da semana traz
          o nome da quadra.
        */}
        {!loading && !error && ehAluno && !agendaIndisponivel ? (
          <SemanaDoAluno
            aulas={aulas}
            mostrarQuadra={false}
            mostrarLinkDaTurma={false}
          />
        ) : null}

        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">Reservas PlayCK</p>
              <h2 className="mt-1 text-xl font-extrabold">Seu próximo jogo começa aqui</h2>
              <p className="mt-1 text-sm font-medium text-white/65">Veja o que o clube oferece, com valores e horários.</p>
            </div>
            <Link href="/reservas/nova" aria-label="Fazer reserva" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-court-dark)]">
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
