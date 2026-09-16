import { BottomNav } from "@/components/bottom-nav";
import { TopAppBar } from "@/components/top-app-bar";
import { TurmasDoClube } from "@/components/turmas-do-clube";

/**
 * SPEC-057/TASK-002/D11 — **o catálogo ganhou endereço.**
 *
 * Ele era a aba "Turmas", e é o **único lugar do produto** onde o aluno entra
 * e sai de turma. Tirar a aba sem isto apagaria o fluxo (achado B02 do
 * veredito independente).
 */
export default function TurmasDoClubePage() {
  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />
      <div className="mt-5">
        <TurmasDoClube />
      </div>
      <BottomNav />
    </main>
  );
}
