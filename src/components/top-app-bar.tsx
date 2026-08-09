"use client";

import { Bell } from "lucide-react";

// Cabeçalho compartilhado (SPEC-007) — repete em Home/Minhas Aulas/
// Quadras/Minhas Reservas na referência "Performance Court". `iniciais`
// é opcional (a Home já tinha a inicial do aluno; as outras 3 telas não
// tinham esse dado antes e não precisam buscá-lo só pra isso).
export function TopAppBar({ iniciais }: { iniciais?: string }) {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)]">
          <span className="text-sm font-semibold">{iniciais ?? "?"}</span>
        </div>
        <span className="text-xl font-bold text-[var(--color-primary)]">PlayCK</span>
      </div>
      {/* Sino de notificação inerte (SPEC-007, decisão do usuário): não
          existe sistema de notificação no backend ainda — ícone presente
          por identidade visual, sem badge de "não lido" nem ação real. */}
      <button
        type="button"
        aria-label="Notificações"
        className="flex size-10 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-container)]"
      >
        <Bell className="size-5" />
      </button>
    </header>
  );
}
