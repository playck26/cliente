"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, User } from "lucide-react";

// Cabeçalho compartilhado (SPEC-007) — repete em Home/Minhas Aulas/
// Quadras/Minhas Reservas na referência "Performance Court". `iniciais`
// é opcional (a Home já tinha a inicial do aluno; as outras 3 telas não
// tinham esse dado antes e não precisam buscá-lo só pra isso).
export function TopAppBar({ saudacao, iniciais }: { saudacao?: string; iniciais?: string }) {
  return (
    <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border">
          <Image
            src="/playck-logo.png"
            alt=""
            width={40}
            height={40}
            className="size-10 object-contain"
            aria-hidden="true"
          />
          <span className="absolute -top-1 -right-1 flex size-3 rounded-full bg-[var(--color-secondary)] ring-2 ring-background" />
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
            {saudacao ? `Olá, ${saudacao}` : iniciais ? `Olá, ${iniciais}` : "PlayCK Club"}
          </p>
          <span className="text-2xl leading-none font-extrabold text-[var(--color-primary-strong)]">PlayCK</span>
        </div>
      </div>
      {/* Sino de notificação inerte (SPEC-007, decisão do usuário): não
          existe sistema de notificação no backend ainda — ícone presente
          por identidade visual, sem badge de "não lido" nem ação real. */}
      <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Notificações"
        className="relative flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border transition-colors hover:text-[var(--color-primary-strong)]"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
      {/* SPEC-018/TASK-003 — o acesso ao perfil. Fica aqui, e não na
          `BottomNav`, porque a barra inferior é `grid-cols-5` com o botão
          central saliente: um sexto item quebraria o desenho dela. E o
          cabeçalho já é o lugar de "quem sou eu" nas quatro telas. */}
      <Link
        href="/perfil"
        aria-label="Seu perfil"
        className="relative flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border transition-colors hover:text-[var(--color-primary-strong)]"
      >
        <User className="size-5" aria-hidden="true" />
      </Link>
      </div>
    </header>
  );
}
