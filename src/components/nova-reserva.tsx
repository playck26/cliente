"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AulaParticular } from "@/components/aula-particular";
import { BottomNav } from "@/components/bottom-nav";
import { CourtsList } from "@/components/courts-list";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { TopAppBar } from "@/components/top-app-bar";
import {
  NOMES_PADRAO,
  lerNomesDeTipo,
  nomesGuardados,
  type NomesDeTipo,
} from "@/lib/nomes-de-tipo";

/**
 * SPEC-053/D3 — **`/reservas/nova`: escolher o TIPO antes do horário.**
 *
 * Quadra e aula particular são os dois tipos de reserva (ADR-021). Eles eram
 * abas de `/reservas`, ao lado das reservas feitas; agora `/reservas` é o lugar
 * de ACOMPANHAR e esta página, o de CONTRATAR.
 *
 * **Os painéis são reusados como estão** — `CourtsList` e `AulaParticular`
 * perderam a moldura própria na SPEC-022 justamente para morar dentro de uma
 * tela; muda só a tela.
 *
 * O `tipo` vem da página (servidor), e não de `useSearchParams`: a página já
 * lê os parâmetros, e ler de novo aqui obrigaria um `Suspense` só para isso.
 *
 * **SPEC-054/D1 — os nomes são os que o clube deu a cada tipo.** O endereço
 * (`?tipo=quadra`) não muda: é o comportamento, que é código. Enquanto os nomes
 * não chegam — ou se não chegarem —, os cartões aparecem com os padrões: o
 * nome é apresentação, e o cartão é o caminho que a pessoa veio buscar.
 */

export type TipoDeReserva = "quadra" | "aula";

function tiposDeReserva(nomes: NomesDeTipo) {
  return [
    {
      id: "quadra",
      nome: nomes.quadra,
      descricao: "Escolha a quadra, o dia e o horário.",
      Icon: TennisCourtIcon,
    },
    {
      id: "aula",
      nome: nomes.aula,
      descricao: "Escolha o professor; a quadra vem junto.",
      Icon: TennisBallIcon,
    },
  ] as const;
}

function tipoValido(tipo: string | null): TipoDeReserva | null {
  return tipo === "quadra" || tipo === "aula" ? tipo : null;
}

export function NovaReserva({ tipo }: { tipo: string | null }) {
  // Tipo desconhecido mostra os cartões, sem erro: um endereço editado à mão
  // ou um link velho não pode ser punido (a regra da SPEC-022).
  const escolhido = tipoValido(tipo);
  /**
   * SPEC-059 — **começa pelo nome que o clube deu, se ele já for conhecido.**
   *
   * Antes começava sempre em `NOMES_PADRAO` e trocava a palavra quando a
   * resposta chegava; o Israel viu isso em produção e é troca de texto na
   * cara de quem lê. O que vale continua valendo — o cartão **não espera**
   * pelo nome, porque ele é o caminho que a pessoa veio buscar.
   *
   * Função no `useState` (e não `nomesGuardados()` direto) porque a leitura
   * toca `localStorage`: fora do inicializador preguiçoso ela rodaria a cada
   * desenho, e no servidor nem existiria.
   */
  const [nomes, setNomes] = useState<NomesDeTipo>(
    () => nomesGuardados() ?? NOMES_PADRAO,
  );

  useEffect(() => {
    let vivo = true;
    // `lerNomesDeTipo` não lança: toda falha já volta como os padrões.
    void lerNomesDeTipo().then((lidos) => {
      if (vivo) setNomes(lidos);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-2 px-5">
        {escolhido ? (
          <Link
            href="/reservas/nova"
            className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--color-primary-strong)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Trocar o tipo
          </Link>
        ) : null}
        <h1 className="text-[28px] leading-[1.04] font-extrabold">
          Fazer reserva
        </h1>
      </div>

      <div className="mt-5">
        {escolhido === "quadra" ? (
          <CourtsList />
        ) : escolhido === "aula" ? (
          <AulaParticular />
        ) : (
          <ul className="space-y-3 px-5" aria-label="Tipos de reserva">
            {tiposDeReserva(nomes).map(({ id, nome, descricao, Icon }) => (
              <li key={id}>
                <Link
                  href={`/reservas/nova?tipo=${id}`}
                  className="flex items-center gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-[0.99]"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
                    <Icon className="size-[26px]" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-extrabold">{nome}</span>
                    <span className="mt-0.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {descricao}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-5 shrink-0 text-[var(--color-primary-strong)]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
