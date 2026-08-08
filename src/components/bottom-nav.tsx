"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegação inferior (tab bar) — padrão de mobile do app do aluno
// (DESIGN.md, seção Responsividade: "Cliente: navegação inferior (tab
// bar)"). Alvo de toque ~44px (acessibilidade, DESIGN.md).
const ITENS = [
  { href: "/home", label: "Home" },
  { href: "/minhas-aulas", label: "Minhas Aulas" },
  { href: "/quadras", label: "Quadras" },
  { href: "/reservas", label: "Reservas" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background">
      {ITENS.map((item) => {
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center py-2 text-xs font-medium ${
              ativo ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
