"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, UserMinus } from "lucide-react";
import { getAulasDoDia, type AulaDoDiaDoProfessor } from "@/lib/api-client";
import { hojeNoClubeIso } from "@/lib/fuso";

/**
 * SPEC-058/D4 — **o cartão do professor.**
 *
 * O Israel pediu insight também no painel do professor, e escolheu dois:
 * **aulas de hoje** e **quem avisou que vai faltar**. O segundo é o que muda
 * o dia dele — saber às 8h que dois dos quatro não vêm às 19h é o que decide
 * se a aula vira treino de dupla ou individual. A chamada já mostra isso,
 * mas só **depois** da aula; aqui é antes.
 *
 * **O que este cartão NÃO mostra, de propósito (LIM-058a):** "chamada
 * automática aguardando sua revisão". É o insight que eu recomendaria hoje,
 * com a presença automática recém-ligada — e o Israel não o escolheu. Fica
 * registrado aqui em vez de entrar por dentro.
 */

/** `19:00:00` → `19:00`. */
const hora = (h: string) => h.slice(0, 5);

/**
 * A próxima aula do dia é a primeira que **ainda não terminou**. Usar a
 * primeira da lista mandaria o professor para a aula das 8h às 20h.
 */
export function proximaDoDia(
  aulas: AulaDoDiaDoProfessor[],
  agoraHHMM: string,
): AulaDoDiaDoProfessor | null {
  const ordenadas = [...aulas].sort((a, b) =>
    a.horaInicio.localeCompare(b.horaInicio),
  );
  return ordenadas.find((a) => hora(a.horaFim) > agoraHHMM) ?? null;
}

/**
 * SPEC-058/D5 — `quemAvisou` pode não vir.
 *
 * Durante o rollout, o Cliente novo conversa com o Back antigo (mesma regra
 * que a SPEC-052 aplicou em `turmas`/`particulares`). Tratar `undefined`
 * como zero mantém a tela de pé; ler `.length` de `undefined` a derrubaria
 * inteira por causa de um enfeite.
 */
export function avisos(aula: AulaDoDiaDoProfessor | null): string[] {
  if (!aula) return [];
  const { quemAvisou } = aula as Partial<
    Pick<AulaDoDiaDoProfessor, "quemAvisou">
  >;
  return quemAvisou ?? [];
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e mais 2". */
export function frase(nomes: string[]): string {
  const primeiros = nomes.map((n) => n.split(" ")[0]);
  if (primeiros.length === 1) return primeiros[0];
  if (primeiros.length === 2) return `${primeiros[0]} e ${primeiros[1]}`;
  return `${primeiros[0]}, ${primeiros[1]} e mais ${primeiros.length - 2}`;
}

export function CartaoDoProfessor() {
  const [aulas, setAulas] = useState<AulaDoDiaDoProfessor[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    getAulasDoDia(hojeNoClubeIso())
      .then((d) => {
        if (ativo) setAulas(d);
      })
      .catch(() => {
        // O cartão é acessório: a agenda logo abaixo é a tela. Falhar aqui
        // não pode apagar o dia inteiro do professor.
        if (ativo) setFalhou(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (falhou || aulas === null) {
    return (
      <section
        aria-label="Resumo de hoje"
        className="mx-5 h-[108px] rounded-3xl bg-[var(--color-surface-container)]"
      >
        {falhou && (
          <p role="status" className="p-5 text-[13px] font-semibold text-[var(--color-text-secondary)]">
            Não foi possível carregar o resumo de hoje.
          </p>
        )}
      </section>
    );
  }

  const agora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const proxima = proximaDoDia(aulas, agora);
  const nomes = avisos(proxima);

  return (
    <section
      aria-label="Resumo de hoje"
      className="relative mx-5 overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-[var(--color-secondary)]/20 blur-2xl"
      />

      <div className="relative z-10">
        <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">
          Hoje
        </p>

        <h2 className="mt-1 text-xl font-extrabold">
          {aulas.length === 0
            ? "Nenhuma aula hoje"
            : `${aulas.length} ${aulas.length === 1 ? "aula" : "aulas"}`}
        </h2>

        {proxima && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white/65">
            <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
            Próxima às {hora(proxima.horaInicio)}
            {proxima.turmaNome ? ` · ${proxima.turmaNome}` : ""}
          </p>
        )}

        {/*
          A informação que o professor não tinha antes da aula. Sem aviso
          nenhum, a linha não aparece — "0 avisaram falta" é ruído, e o cartão
          existe para tirar ruído.
        */}
        {nomes.length > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-white/10 px-3 py-2 text-[13px] font-bold">
            <UserMinus className="mt-0.5 size-4 shrink-0 text-[var(--color-secondary)]" aria-hidden="true" />
            <span>
              {nomes.length === 1
                ? "1 aluno avisou que vai faltar: "
                : `${nomes.length} alunos avisaram que vão faltar: `}
              {frase(nomes)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
