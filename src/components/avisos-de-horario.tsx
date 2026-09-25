"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  ApiError,
  cancelarPreReserva,
  listarMinhasPreReservas,
  listCourts,
  type PreReserva,
} from "@/lib/api-client";

const DIAS_SEMANA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function quando(aviso: PreReserva): string {
  const [ano, mes, dia] = aviso.data.split("-").map(Number);
  const semana = DIAS_SEMANA_CURTO[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")} às ${aviso.horaInicio}`;
}

/**
 * SPEC-074/D10 — **"Avisos de horário": os pedidos vivos do aluno, com
 * cancelar.**
 *
 * Mora na aba "Reservas" porque é lá que o aluno ACOMPANHA o que pediu
 * (SPEC-053/D3). E existe por causa do teto de 10 (D9): sem esta lista, quem
 * bate no limite não tem onde ver quais são os dez.
 *
 * **Sem avisos, não desenha nada** — uma seção vazia em toda entrada da tela
 * seria ruído para quem nunca pediu aviso. **Nome de quadra aparece aqui, e
 * isso não contradiz a LIM-074d:** a regra é do corpo do AVISO, que aparece na
 * tela bloqueada; esta é a tela do próprio aluno, atrás de login.
 *
 * Falha ao carregar também não desenha nada: a lista de reservas logo abaixo
 * continua sendo o que a tela promete.
 */
export function AvisosDeHorario() {
  const [avisos, setAvisos] = useState<PreReserva[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarMinhasPreReservas()
      .then(setAvisos)
      .catch(() => undefined);
    listCourts()
      .then((r) =>
        setNomes(Object.fromEntries(r.data.map((q) => [q.id, q.nome]))),
      )
      .catch(() => undefined);
  }, []);

  async function cancelar(aviso: PreReserva) {
    setErro(null);
    setCancelando(aviso.id);
    try {
      await cancelarPreReserva(aviso.id);
      setAvisos((atual) => atual.filter((a) => a.id !== aviso.id));
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível cancelar o aviso. Tente de novo.",
      );
    } finally {
      setCancelando(null);
    }
  }

  if (avisos.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-avisos-de-horario"
      className="mx-5 mb-5 space-y-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border"
    >
      <h2
        id="titulo-avisos-de-horario"
        className="flex items-center gap-2 text-base font-extrabold"
      >
        <Bell
          className="size-4 text-[var(--color-primary-strong)]"
          aria-hidden="true"
        />
        Avisos de horário
      </h2>
      <p className="text-[13px] text-[var(--color-text-secondary)]">
        Se um destes horários vagar, você recebe um aviso. Quem reservar
        primeiro fica com ele.
      </p>
      {erro ? (
        <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}
      <ul className="space-y-2">
        {avisos.map((aviso) => (
          <li
            key={aviso.id}
            className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-container)] px-3 py-2"
          >
            <Link
              href={`/quadras/${aviso.quadraId}?data=${aviso.data}`}
              className="min-w-0 flex-1"
            >
              <span className="block truncate text-sm font-bold">
                {nomes[aviso.quadraId] ?? "Quadra"}
              </span>
              <span className="block text-[13px] text-[var(--color-text-secondary)]">
                {quando(aviso)}
              </span>
            </Link>
            <button
              type="button"
              disabled={cancelando === aviso.id}
              onClick={() => void cancelar(aviso)}
              className="shrink-0 text-[13px] font-bold text-[var(--color-primary-strong)] underline disabled:opacity-50"
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
