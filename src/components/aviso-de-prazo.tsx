"use client";

import { useCallback, useEffect, useState } from "react";
import {
  lerCapacidadeOperacao,
  type CapacidadeOperacao,
} from "@/lib/capacidade-operacao";

/**
 * SPEC-031/REQ-002 — **o aluno sabe do prazo antes de tentar sair.**
 *
 * Sem isto, a regra só aparece como `409` depois do toque: a pessoa decide
 * sair, toca, espera, e leva um erro por algo que dava para saber antes. É a
 * mesma razão pela qual a tela de chamada não oferece o que seria recusado.
 *
 * ## Os quatro casos do rollout, e por que são quatro
 *
 * Cinco repositórios, cinco deploys independentes: este componente pode estar
 * publicado contra um back anterior à SPEC-031. `lerCapacidadeOperacao`
 * classifica, e aqui cada estado tem uma tela — inclusive os dois que é
 * tentador tratar igual:
 *
 * - **`ausente` esconde em silêncio.** Back antigo não é erro do aluno.
 * - **`negado` MOSTRA erro.** Engolir `403` faria a feature sumir em produção
 *   sem ninguém saber — o clube configuraria o prazo e o aluno não veria
 *   nada, sem nenhum sinal para investigar.
 * - **`falhou` mostra falha recuperável, com "Tentar de novo".** Uma
 *   indisponibilidade não pode se disfarçar de "versão antiga": nesse
 *   disfarce ninguém recarrega, porque nada pareceu quebrado.
 *
 * ## `null` não é zero, e aqui isso vira ausência de aviso
 *
 * Prazo `null` é "o clube não exige antecedência". Não há o que avisar, e
 * inventar um "sem prazo" na tela seria ruído sobre o estado padrão. O que
 * continua valendo — não dá para cancelar **depois** de começar — é do
 * servidor e aparece no `409`, porque não depende de configuração nenhuma.
 */
export function AvisoDePrazo({
  tipo = "aula",
}: {
  /** Qual dos dois prazos mostrar. Os dois existem e são independentes. */
  tipo?: "aula" | "reserva";
}) {
  const [cap, setCap] = useState<CapacidadeOperacao | null>(null);

  // `buscar` NÃO mexe em estado de forma síncrona: o `setCap` só acontece no
  // `then`. Chamar `setCap(null)` aqui dispararia
  // `react-hooks/set-state-in-effect` — e o aviso tem razão, seria render em
  // cascata no primeiro pintar. O reset para `null` pertence ao retry, que é
  // manipulador de evento.
  const buscar = useCallback(() => {
    void lerCapacidadeOperacao().then(setCap);
  }, []);

  useEffect(buscar, [buscar]);

  const tentarDeNovo = () => {
    setCap(null);
    buscar();
  };

  // Carregando: nada. Um esqueleto para uma linha de texto piscaria mais do
  // que informaria.
  if (cap === null) return null;

  if (cap.estado === "ausente") return null;

  if (cap.estado === "negado") {
    return (
      <p
        role="alert"
        className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
      >
        Não foi possível conferir o prazo do clube: seu acesso foi recusado.
        Fale com o clube.
      </p>
    );
  }

  if (cap.estado === "falhou") {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] ring-1 ring-border"
      >
        <span>Não foi possível conferir o prazo do clube agora.</span>
        <button
          type="button"
          onClick={tentarDeNovo}
          className="rounded-full bg-[var(--color-primary-strong)] px-3 py-1 text-[13px] font-bold text-white"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const horas =
    tipo === "aula"
      ? cap.prazos.prazoCancelamentoAulaHoras
      : cap.prazos.prazoCancelamentoReservaHoras;

  if (horas === null) return null;

  return (
    <p className="rounded-2xl bg-surface px-4 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] ring-1 ring-border">
      {tipo === "aula"
        ? `Saída até ${horas}h antes da aula.`
        : `Cancelamento até ${horas}h antes da reserva.`}
    </p>
  );
}
