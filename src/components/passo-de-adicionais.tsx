"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  adicionaisDisponiveis,
  type AdicionalDisponivel,
  type ItemDoPedido,
} from "@/lib/api-client";

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Quantas reservas o pedido vira: horários **seguidos** são um bloco, separados
 * são blocos independentes — a mesma regra do servidor (SPEC-011). O adicional
 * vale para **cada** reserva (SPEC-054/D6), então o total do pedido multiplica
 * por aqui.
 */
export function contarBlocos(rotulos: readonly string[]): number {
  const ordenados = [...rotulos].sort();
  let blocos = 0;
  let fimAnterior: string | null = null;
  for (const rotulo of ordenados) {
    const [inicio, fim] = rotulo.split("-");
    if (inicio !== fimAnterior) blocos += 1;
    fimAnterior = fim;
  }
  return blocos;
}

/**
 * SPEC-054/D12 — **o passo "Adicionais"**, depois da escolha do horário, na
 * reserva de quadra e na aula particular.
 *
 * - `+`/`−` limitados ao `disponivel` — mas a tela não reserva nada: a corrida
 *   termina em `409 ESTOQUE_ESGOTADO` no servidor, e quem usa troca a `chave`
 *   para reler; o que já estava escolhido é recortado ao que sobrou (LIM-054j).
 * - Clube sem adicional ativo **pula o passo**: o componente não desenha nada.
 *   O `back` anterior à SPEC-054 cai no mesmo caminho (`404` → lista vazia).
 * - Informa os itens e a soma de UMA reserva; o total do pedido é de quem usa.
 */
export function PassoDeAdicionais({
  data,
  slots,
  onChange,
  desabilitado = false,
  chave = 0,
}: {
  data: string;
  slots: readonly string[];
  onChange: (itens: ItemDoPedido[], somaPorReserva: number) => void;
  desabilitado?: boolean;
  /** Troque para reler a disponibilidade (depois de um `409`). */
  chave?: number;
}) {
  const [disponiveis, setDisponiveis] = useState<AdicionalDisponivel[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);

  const slotsChave = [...slots].sort().join(",");

  useEffect(() => {
    if (!data || slotsChave === "") return;
    let vivo = true;
    adicionaisDisponiveis(data, slotsChave.split(","))
      .then((lista) => {
        if (!vivo) return;
        setDisponiveis(lista);
        setErro(null);
        setQuantidades((atual) => {
          const novo: Record<string, number> = {};
          for (const a of lista) {
            const q = Math.min(atual[a.id] ?? 0, a.disponivel);
            if (q > 0) novo[a.id] = q;
          }
          return novo;
        });
      })
      .catch(() => {
        // Sem a lista, a pessoa perde o adicional, não a reserva: o aviso é
        // discreto e o botão de confirmar continua lá.
        if (vivo) setErro("Não foi possível carregar os adicionais.");
      });
    return () => {
      vivo = false;
    };
  }, [data, slotsChave, chave]);

  const precoPorId = useMemo(
    () => new Map(disponiveis.map((a) => [a.id, a.preco])),
    [disponiveis],
  );

  useEffect(() => {
    const itens = Object.entries(quantidades)
      .filter(([, q]) => q > 0)
      .map(([adicionalId, quantidade]) => ({ adicionalId, quantidade }));
    const soma = itens.reduce(
      (total, i) => total + (precoPorId.get(i.adicionalId) ?? 0) * i.quantidade,
      0,
    );
    onChange(itens, Math.round(soma * 100) / 100);
    // `onChange` fora das dependências de propósito: quem usa passa função nova a
    // cada render, e reenviar a mesma escolha a cada render seria laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidades, precoPorId]);

  if (erro) {
    return (
      <p className="rounded-2xl bg-surface p-3 text-[13px] font-semibold text-[var(--color-text-secondary)] ring-1 ring-border">
        {erro}
      </p>
    );
  }
  if (disponiveis.length === 0) return null;

  const mudar = (id: string, delta: number, maximo: number) =>
    setQuantidades((atual) => ({
      ...atual,
      [id]: Math.max(0, Math.min(maximo, (atual[id] ?? 0) + delta)),
    }));

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">
        Adicionais
      </p>
      <h2 className="text-xl font-extrabold">Quer levar algo junto?</h2>
      {slots.length > 1 && contarBlocos(slots) > 1 ? (
        <p className="mt-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
          Vale para cada uma das {contarBlocos(slots)} reservas.
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {disponiveis.map((a) => {
          const q = quantidades[a.id] ?? 0;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-container)] p-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-extrabold">{a.nome}</span>
                <span className="block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                  {reais(a.preco)} ·{" "}
                  {a.disponivel === 0
                    ? "esgotado neste horário"
                    : `${a.disponivel} disponível(is)`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={`Menos ${a.nome}`}
                  disabled={desabilitado || q === 0}
                  onClick={() => mudar(a.id, -1, a.disponivel)}
                  className="flex size-10 items-center justify-center rounded-xl bg-surface ring-1 ring-border disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-[15px] font-extrabold" aria-live="polite">
                  {q}
                </span>
                <button
                  type="button"
                  aria-label={`Mais ${a.nome}`}
                  disabled={desabilitado || q >= a.disponivel}
                  onClick={() => mudar(a.id, 1, a.disponivel)}
                  className="flex size-10 items-center justify-center rounded-xl bg-surface ring-1 ring-border disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
