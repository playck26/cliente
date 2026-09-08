"use client";

import { useEffect, useState } from "react";
import { ApiError, getMinhaCarteira, type ExtratoDoAluno } from "@/lib/api-client";

/**
 * SPEC-033/TASK-006 — o saldo e o extrato do aluno.
 *
 * ## Os três estados são TRÊS, e um deles é "você não tem carteira"
 *
 * O servidor responde `404` quando o usuário não tem linha de aluno
 * (AC-012b), e isso **não é falha**: professor e gestor logados no app caem
 * aqui legitimamente. Tratar `404` como erro pintaria "não foi possível
 * carregar" para quem simplesmente não tem carteira — e a pessoa tentaria
 * recarregar para sempre.
 *
 * Os outros dois são: carteira vazia (saldo zero, sem movimento), que **é**
 * uma carteira; e falha de verdade, que precisa dizer que falhou.
 *
 * ## Por que o extrato mostra o tipo em vez do motivo
 *
 * O `motivo` não vem nesta rota, de propósito (AC-013) — é nota interna do
 * clube. O que o aluno precisa saber é **o que moveu o saldo**: um
 * lançamento, uma reserva, um estorno.
 */
export function MinhaCarteira() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let vivo = true;
    getMinhaCarteira()
      .then((dados) => vivo && setEstado({ tipo: "ok", dados }))
      .catch((erro: unknown) => {
        if (!vivo) return;
        // `404` é ausência de carteira, não falha de carga.
        setEstado(
          erro instanceof ApiError && erro.status === 404
            ? { tipo: "sem-carteira" }
            : { tipo: "erro" },
        );
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado.tipo === "sem-carteira") return null;

  if (estado.tipo === "carregando") {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-border">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Carregando sua carteira…
        </p>
      </section>
    );
  }

  if (estado.tipo === "erro") {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-border">
        <p className="text-sm text-[var(--color-error)]">
          Não foi possível carregar sua carteira. Tente de novo mais tarde.
        </p>
      </section>
    );
  }

  const { saldoCentavos, movimentos } = estado.dados;

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-border">
      <div>
        <h2 className="text-sm font-bold text-[var(--color-text-secondary)]">
          Seus créditos
        </h2>
        <p
          className="mt-1 text-3xl font-extrabold text-[var(--color-primary-strong)]"
          data-testid="saldo"
        >
          {emReais(saldoCentavos)}
        </p>
      </div>

      {movimentos.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nenhuma movimentação ainda. Fale com o clube para adicionar créditos.
        </p>
      ) : (
        <ul className="flex flex-col">
          {movimentos.map((m) => (
            <li
              key={m.id}
              className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm first:border-t-0"
            >
              <span className="text-[var(--color-text-secondary)]">
                {ROTULO[m.tipo] ?? m.tipo}
              </span>
              <span
                className={
                  SOMA.has(m.tipo)
                    ? "font-bold text-[var(--color-primary-strong)]"
                    : "font-bold"
                }
              >
                {SOMA.has(m.tipo) ? "+" : "−"} {emReais(m.valorCentavos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Estado =
  | { tipo: "carregando" }
  | { tipo: "ok"; dados: ExtratoDoAluno }
  | { tipo: "sem-carteira" }
  | { tipo: "erro" };

function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const ROTULO: Record<string, string> = {
  entrada: "Crédito adicionado",
  retirada: "Crédito retirado",
  consumo: "Reserva de quadra",
  devolucao: "Reserva cancelada",
};

/** Quem soma no saldo (D3 — o sinal vem do tipo, nunca do valor). */
const SOMA = new Set(["entrada", "devolucao"]);
