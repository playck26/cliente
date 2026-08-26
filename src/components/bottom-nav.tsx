"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Plus, User, Users } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import type { Papel } from "@/lib/api-client";

// Navegação inferior (tab bar) — padrão de mobile do app do aluno
// (DESIGN.md, seção Responsividade: "Cliente: navegação inferior (tab
// bar)"). Altura 80px e ícone lucide por item — SPEC-007 (design system
// "Performance Court"). Alvo de toque ~44px+ preservado (acessibilidade).
const ITENS_ESQUERDA = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/minhas-aulas", label: "Aulas", Icon: TennisBallIcon },
] as const;

const ITENS_DIREITA = [
  { href: "/quadras", label: "Quadras", Icon: TennisCourtIcon },
  { href: "/reservas", label: "Reservas", Icon: CalendarCheck },
] as const;

/**
 * DEF-011 (2026-08-26) — **a barra do professor.**
 *
 * O professor entrava em `/perfil` para trocar a própria foto e **ficava
 * preso**: aquela tela renderizava a barra do aluno, e o servidor recusa os
 * cinco itens dela — `/home`, `/minhas-aulas`, `/quadras` e `/reservas`
 * são `@Roles('aluno')`. Pior: `/minhas-turmas`, que é a tela dele,
 * **não estava na barra**, então não havia por onde voltar.
 *
 * `minhas-turmas-view` já tinha decidido certo e escrito o porquê: *"com os
 * itens do aluno seria mentira, porque o servidor recusa todos eles"*. O
 * defeito foi `perfil-view` não conhecer essa decisão — ela morava num
 * comentário de outro arquivo, não no componente que desenha a barra.
 *
 * **Por isso a regra passou para cá.** Tela nova que renderize
 * `<BottomNav>` sem pensar em papel agora acerta sozinha; antes, errava
 * sozinha.
 *
 * São dois itens, e os dois são reais — o professor alcança
 * `/me/teacher/classes` e `/me/foto`. A objeção da `minhas-turmas-view`
 * era contra barra de **um** item, que é decoração, e contra a do aluno,
 * que seria mentira. Nenhuma das duas se aplica aqui.
 */
const ITENS_DO_PROFESSOR = [
  { href: "/minhas-turmas", label: "Turmas", Icon: Users },
  { href: "/perfil", label: "Perfil", Icon: User },
] as const;

export function BottomNav({ papel }: { papel?: Papel }) {
  const pathname = usePathname();

  if (papel === "professor") {
    return <NavDoProfessor pathname={pathname} />;
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto grid h-[78px] max-w-[390px] grid-cols-5 items-center gap-1 rounded-[28px] bg-[var(--color-court-dark)]/95 p-2 text-white shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-white/10 backdrop-blur-xl"
    >
      {ITENS_ESQUERDA.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]" : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon className="size-[23px]" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
      <Link
        href="/quadras"
        aria-label="Reservar quadra"
        className="-mt-8 flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold text-white"
      >
        <span className="flex size-16 items-center justify-center rounded-[24px] bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)] ring-4 ring-background transition-transform active:scale-95">
          <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
        </span>
        Reservar
      </Link>
      {ITENS_DIREITA.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]" : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon className="size-[23px]" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Duas colunas em vez de cinco, e **sem o botão de reservar**: o professor
 * não reserva quadra. Um botão grande no meio que leva a 403 é pior que
 * botão nenhum — ele convida.
 */
function NavDoProfessor({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto grid h-[78px] max-w-[390px] grid-cols-2 items-center gap-1 rounded-[28px] bg-[var(--color-court-dark)]/95 p-2 text-white shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-white/10 backdrop-blur-xl"
    >
      {ITENS_DO_PROFESSOR.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo
                ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon
              className="size-[23px]"
              strokeWidth={ativo ? 2.5 : 2}
              aria-hidden="true"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
