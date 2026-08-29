"use client";

import { BottomNav } from "@/components/bottom-nav";
import { AulasAnteriores } from "@/components/aulas-anteriores";
import { MyClassesList } from "@/components/my-classes-list";
import { TopAppBar } from "@/components/top-app-bar";
import { TurmasDoClube } from "@/components/turmas-do-clube";
import {
  BarraDeAbas,
  normalizarAba,
  useAbaAtiva,
  type AbaDaTela,
} from "@/components/abas-na-url";

/**
 * SPEC-023 — **a aba de Aulas ganhou o outro lado.**
 *
 * Até aqui `/minhas-aulas` só respondia "quando é minha próxima aula". A
 * pergunta que faltava — *"em que turma eu entro?"* — não tinha tela
 * nenhuma: quem matriculava era o gestor.
 *
 * As três moram na mesma aba do menu porque são a mesma coisa vista de
 * ângulos diferentes: o que eu tenho pela frente, o que eu já tive, e o que
 * o clube oferece. Uma aba a mais na barra de baixo seria desfazer a
 * SPEC-022 duas semanas depois de fazê-la.
 *
 * **SPEC-025 acrescentou "Anteriores"**, e ela não é enfeite: `GET
 * /me/classes` devolve só o futuro, então sem esta aba a avaliação seria uma
 * funcionalidade sem porta de entrada. Foi o Israel quem reparou, usando.
 *
 * **A aba padrão continua sendo a das próximas aulas**: quem abre o app na
 * quinta de manhã quer saber o horário de hoje, não avaliar o passado nem
 * escolher turma nova.
 */

const ABAS = [
  { id: "minhas", rotulo: "Próximas" },
  { id: "anteriores", rotulo: "Anteriores" },
  { id: "turmas", rotulo: "Turmas" },
] as const satisfies readonly AbaDaTela<"minhas" | "anteriores" | "turmas">[];

type AbaId = (typeof ABAS)[number]["id"];

export const ABA_PADRAO_DE_AULAS: AbaId = "minhas";

export function normalizarAbaDeAulas(valor: string | null): AbaId {
  return normalizarAba(ABAS, ABA_PADRAO_DE_AULAS, valor);
}

export function AulasTabs() {
  const { ativa, irPara } = useAbaAtiva(
    ABAS,
    ABA_PADRAO_DE_AULAS,
    "/minhas-aulas",
  );

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-5 px-5">
        <BarraDeAbas
          abas={ABAS}
          ativa={ativa}
          onTrocar={irPara}
          rotulo="Próximas aulas, aulas anteriores e turmas do clube"
        />
      </div>

      {/* Só o painel ativo é montado — uma ida à rede por entrada, não duas. */}
      <div
        role="tabpanel"
        id={`painel-${ativa}`}
        aria-labelledby={`aba-${ativa}`}
        className="mt-5"
      >
        {ativa === "turmas" ? (
          <TurmasDoClube />
        ) : ativa === "anteriores" ? (
          <AulasAnteriores />
        ) : (
          <MyClassesList />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
