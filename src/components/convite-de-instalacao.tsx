"use client";

import { useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { Share, SquarePlus, X } from "lucide-react";
import {
  assinarInstalacao,
  consumirEvento,
  eventoDisponivel,
  lerModoDeConvite,
  limparDispensa,
  modoNoServidor,
  registrarDispensa,
} from "@/lib/instalacao-pwa";

/**
 * SPEC-050 — **o convite para instalar que nunca existiu.**
 *
 * A ADR-012 entregou "instalável" ao pé da letra: manifest, service worker,
 * ícones. O que ela não entregou foi o **convite** — e sem convite o app
 * dependia do banner automático do navegador, que é de uma vez só por design.
 * O relato do Israel ("só apareceu no meu navegador uma única vez") é o
 * comportamento documentado do Chrome, não um defeito do navegador.
 *
 * ## Dois modos, porque são dois mundos
 *
 * - **`botao`** (Chromium: Android, Chrome/Edge desktop) — existe um evento
 *   `beforeinstallprompt` guardado, e `prompt()` abre o diálogo **nativo** de
 *   instalação. Um toque resolve.
 * - **`instrucao`** (iOS) — `beforeinstallprompt` não existe no Safari e não
 *   vai existir. Não há diálogo a abrir: o único caminho é o menu
 *   Compartilhar → "Adicionar à Tela de Início", e a única coisa útil que o
 *   app pode fazer é **ensinar o caminho**. Sem este modo, todo usuário de
 *   iPhone fica sem instalação — e num app de aluno isso é metade do público.
 *
 * ## Sem `useEffect`, e o porquê importa
 *
 * Instalação é **sistema externo**: dois eventos de `window` e uma chave de
 * `localStorage`. Ler sistema externo com `useEffect` + `setState` é o que o
 * `react-hooks/set-state-in-effect` recusa — e a primeira versão deste
 * componente levou exatamente esse erro no `eslint` dos três repositórios.
 * `useSyncExternalStore` é a ferramenta certa e a que `bottom-nav.tsx` já usa
 * aqui; a decisão toda vive em `lib/instalacao-pwa.ts`.
 *
 * ## Por que não é `role="alert"`
 *
 * Convite não é erro nem aviso de prazo. `role="region"` com nome acessível
 * deixa o bloco navegável por leitor de tela sem interromper quem está no meio
 * de reservar uma quadra.
 *
 * ## A posição, e a colisão que ela evita
 *
 * `bottom-[94px]`: a `BottomNav` é `fixed bottom-2` com `h-[78px]`, ou seja
 * ocupa de 8px a 86px. 94px deixa 8px de respiro acima dela. O `z-40` fica
 * **abaixo** do `z-50` da barra de propósito — se algum dia os dois se
 * cruzarem, quem ganha é a navegação, não a propaganda.
 *
 * Na tela de login não há barra, e aí o convite flutua 94px acima da borda.
 * Ficar assim é deliberado: a alternativa era este componente global
 * adivinhar, a cada rota, se a página renderizou barra — um acoplamento que
 * erra em silêncio a cada tela nova.
 */
export function ConviteDeInstalacao() {
  const modo = useSyncExternalStore(
    assinarInstalacao,
    lerModoDeConvite,
    modoNoServidor,
  );

  const dispensar = useCallback(() => registrarDispensa(), []);

  /**
   * Um "não" no diálogo nativo conta como dispensa: perguntar de novo na
   * próxima tela seria pior que não ter convite nenhum. **Aceitar não conta** —
   * se a instalação falhar depois, a pessoa ficaria 15 dias sem convite por
   * ter dito "sim".
   */
  const instalar = useCallback(async () => {
    const evento = eventoDisponivel();
    if (!evento) return;
    try {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === "dismissed") registrarDispensa();
      else limparDispensa();
    } catch {
      // Diálogo recusado pelo navegador (evento já consumido, gesto perdido).
      // Não registra dispensa: não foi decisão da pessoa, então o convite volta
      // na próxima visita, quando um evento novo puder chegar.
    } finally {
      consumirEvento();
    }
  }, []);

  if (modo === "oculto") return null;

  return (
    <div
      role="region"
      aria-label="Instalar o PlayCK"
      className="fixed inset-x-2 bottom-[94px] z-40 mx-auto flex max-w-[390px] items-center gap-3 rounded-[28px] bg-surface p-3 shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-border"
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-[14px] object-contain"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--color-text-primary)]">
          Instale o PlayCK
        </p>
        {modo === "botao" ? (
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
            Abre direto da sua tela de início, sem navegador.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
            <span>Toque em</span>
            <Share className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Compartilhar</span>
            <span>e depois em</span>
            <SquarePlus className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Adicionar à Tela de Início</span>
          </p>
        )}
      </div>

      {modo === "botao" && (
        <button
          type="button"
          onClick={() => void instalar()}
          className="min-h-11 shrink-0 rounded-full bg-[var(--color-primary-strong)] px-4 text-[13px] font-bold text-white"
        >
          Instalar
        </button>
      )}

      {/*
        Alvo de 44px mesmo com ícone de 16px — o mínimo de toque que o resto do
        app respeita (`BottomNav`, acessibilidade). Um "x" pequeno num banner
        que cobre a tela é o jeito clássico de tornar a dispensa impossível.
      */}
      <button
        type="button"
        onClick={dispensar}
        aria-label="Agora não"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
