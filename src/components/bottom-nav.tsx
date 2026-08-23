"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Landmark, Plus } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";

// Navegação inferior (tab bar) — padrão de mobile do app do aluno
// (DESIGN.md, seção Responsividade: "Cliente: navegação inferior (tab
// bar)"). Altura 80px e ícone lucide por item — SPEC-007 (design system
// "Performance Court"). Alvo de toque ~44px+ preservado (acessibilidade).
const ITENS_ESQUERDA = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/minhas-aulas", label: "Aulas", Icon: TennisBallIcon },
] as const;

const ITENS_DIREITA = [
  { href: "/quadras", label: "Quadras", Icon: Landmark },
  { href: "/reservas", label: "Reservas", Icon: CalendarCheck },
] as const;

export function BottomNav() {
  const pathname = usePathname();

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
