import { BottomNav } from "@/components/bottom-nav";
import { AulasAnteriores } from "@/components/aulas-anteriores";
import { TopAppBar } from "@/components/top-app-bar";

/**
 * SPEC-057/TASK-002/D11 — **o histórico ganhou endereço.**
 *
 * Era a aba "Anteriores", e é o **único lugar** de onde o aluno avalia uma
 * aula que passou (`avaliarAula` não é chamado em nenhum outro componente).
 * A semana da agenda agora alcança o passado, mas quem avalia é esta tela.
 */
export default function AulasAnterioresPage() {
  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />
      <div className="mt-5">
        <AulasAnteriores />
      </div>
      <BottomNav />
    </main>
  );
}
