import { BottomNav } from "@/components/bottom-nav";
import { CaixaDeAvisos } from "@/components/caixa-de-avisos";
import { TopAppBar } from "@/components/top-app-bar";

/**
 * SPEC-065 — **a caixa de avisos do aluno e do professor.**
 *
 * Destino do sino que voltou ao topo. É a tela que derruba a LIM-062b: o aviso
 * que o push não entregou continua aqui.
 */
export default function AvisosPage() {
  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />
      <div className="mt-5">
        <CaixaDeAvisos />
      </div>
      <BottomNav />
    </main>
  );
}
