"use client";

import { AgendaDoProfessor } from "@/components/agenda-do-professor";
import { BottomNav } from "@/components/bottom-nav";
import { MinhasTurmasView } from "@/components/minhas-turmas-view";
import { TopAppBar } from "@/components/top-app-bar";
import {
  BarraDeAbas,
  normalizarAba,
  useAbaAtiva,
  type AbaDaTela,
} from "@/components/abas-na-url";

/**
 * SPEC-026 — **a área do professor ganhou a entrada pelo dia.**
 *
 * O pedido do Israel era *"Calendário → Turma → Alunos → Presença"*, e as
 * três últimas já existiam desde a SPEC-014. Faltava a primeira.
 *
 * **A Agenda é a aba PADRÃO, e isso é o pedido, não preferência minha.** Ele
 * pediu que o professor comece escolhendo o dia — antes ele começava
 * escolhendo a turma. Quem quiser a lista de turmas continua a um toque.
 *
 * **`papel="professor"` literal na barra**, como já fazia a
 * `minhas-turmas-view`: esta área é dele por definição, o servidor não deixa
 * mais ninguém chegar aqui, e esperar o `getMe()` para descobrir o que a
 * rota já garante era o que fazia a barra do aluno piscar no painel dele
 * (DEF-011).
 */

const ABAS = [
  { id: "agenda", rotulo: "Agenda" },
  { id: "turmas", rotulo: "Minhas turmas" },
] as const satisfies readonly AbaDaTela<"agenda" | "turmas">[];

type AbaId = (typeof ABAS)[number]["id"];

export const ABA_PADRAO_DO_PROFESSOR: AbaId = "agenda";

export function normalizarAbaDoProfessor(valor: string | null): AbaId {
  return normalizarAba(ABAS, ABA_PADRAO_DO_PROFESSOR, valor);
}

export function ProfessorTabs() {
  const { ativa, irPara } = useAbaAtiva(
    ABAS,
    ABA_PADRAO_DO_PROFESSOR,
    "/minhas-turmas",
  );

  const barra = (
    <BarraDeAbas
      abas={ABAS}
      ativa={ativa}
      onTrocar={irPara}
      rotulo="Agenda e turmas"
    />
  );

  // A aba de turmas mantém a tela que já existia, inteira — inclusive a
  // moldura dela. Extrair a moldura de `minhas-turmas-view` seria mexer numa
  // tela que funciona para ganhar simetria, e simetria não é motivo.
  if (ativa === "turmas") {
    return <MinhasTurmasView abas={barra} />;
  }

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-5 pt-2 pb-28">
        <div className="px-5">{barra}</div>

        <AgendaDoProfessor />
      </main>

      <BottomNav papel="professor" />
    </div>
  );
}
