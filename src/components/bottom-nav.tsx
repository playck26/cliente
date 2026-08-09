"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Landmark } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";

// Navegação inferior (tab bar) — padrão de mobile do app do aluno
// (DESIGN.md, seção Responsividade: "Cliente: navegação inferior (tab
// bar)"). Altura 80px e ícone lucide por item — SPEC-007 (design system
// "Performance Court"). Alvo de toque ~44px+ preservado (acessibilidade).
const ITENS = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/minhas-aulas", label: "Aulas", Icon: TennisBallIcon },
  { href: "/quadras", label: "Quadras", Icon: Landmark },
  { href: "/reservas", label: "Reservas", Icon: CalendarCheck },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-20 border-t border-border bg-surface shadow-[var(--shadow-elevated)]">
      {ITENS.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              ativo ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon className="size-6" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
