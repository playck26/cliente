"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ligarContador } from "@/lib/contador-de-avisos";

/**
 * SPEC-065 — **o sino, e ele agora leva a algum lugar.**
 *
 * ## No Cliente, este ícone já existiu e foi RETIRADO
 *
 * Ele estava aqui desde a SPEC-007, documentado como "inerte", por identidade
 * visual. O Israel mandou tirá-lo com esta razão, que continua certa:
 *
 * > *"ícone que ignora o toque ensina a pessoa a não tocar nos outros — tirá-lo
 * > até haver o que notificar"*
 *
 * **O que mudou não foi a regra, foi a premissa.** Desde 2026-09-20 os treze
 * gestos da SPEC-063 avisam de verdade, e existe uma tela para onde ir. O
 * precedente de como se faz está no `admin-top-bar.tsx`: *"a engrenagem deixou
 * de ser inerte na SPEC-010 — passou a existir uma tela, e um botão que não faz
 * nada quando já existe destino é pior do que não ter o botão"*.
 *
 * ## O contador não faz polling
 *
 * Ele sobe em dois momentos, e só neles: a abertura do app, e a chegada de um
 * push. As três travas contra rajada moram no `contador-de-avisos.ts`.
 *
 * **Arquivo idêntico em `cliente` e `admin`** (ADR-001).
 */
export function SinoDeAvisos({ href = "/avisos" }: { href?: string }) {
  const [naoLidos, setNaoLidos] = useState(0);

  useEffect(() => {
    const contador = ligarContador(setNaoLidos);
    return () => contador.parar();
  }, []);

  // **O número tem teto visual.** "99+" cabe; "1274" empurra o cabeçalho
  // inteiro num celular, e a diferença entre 100 e 1274 não muda o que a
  // pessoa faz a seguir.
  const rotuloDoNumero = naoLidos > 99 ? "99+" : String(naoLidos);

  return (
    <Link
      href={href}
      aria-label={
        naoLidos > 0 ? `Avisos, ${naoLidos} não lidos` : "Avisos"
      }
      className="relative flex size-10 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-accent hover:text-primary"
    >
      <Bell className="size-5" aria-hidden="true" />
      {naoLidos > 0 && (
        <span
          // `aria-hidden` porque o número já está no `aria-label` do link:
          // sem isto, o leitor de tela diria "Avisos, 3 não lidos — 3".
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[var(--color-error)] px-1 text-center text-[10px] font-semibold leading-4 text-white"
        >
          {rotuloDoNumero}
        </span>
      )}
    </Link>
  );
}
