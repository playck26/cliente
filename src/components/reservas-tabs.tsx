"use client";

import { BottomNav } from "@/components/bottom-nav";
import { MyBookingsList } from "@/components/my-bookings-list";
import { TopAppBar } from "@/components/top-app-bar";
import {
  BarraDeAbas,
  normalizarAba,
  useAbaAtiva,
  type AbaDaTela,
} from "@/components/abas-na-url";

/**
 * SPEC-022 — **a aba única de Reservas.**
 *
 * Antes eram duas entradas no menu com nomes que se confundiam: `/quadras`
 * ("escolher onde reservar") e `/reservas` ("as que eu já fiz"). Pior: o
 * botão grande do meio da barra e a aba "Quadras" levavam **ao mesmo
 * lugar**, então cinco colunas ofereciam quatro destinos.
 *
 * Agora é uma tela com duas abas, e as duas telas antigas viraram o
 * conteúdo delas — foi por isso que `courts-list` e `my-bookings-list`
 * perderam a moldura própria. Duas telas irmãs dentro de abas não podem
 * desenhar duas `TopAppBar` e duas `BottomNav`.
 *
 * **SPEC-023:** a mecânica das abas saiu daqui para `abas-na-url.tsx`,
 * quando a tela de aulas precisou da mesma coisa. Copiar teria criado duas
 * cópias da mesma decisão.
 */

/**
 * **SPEC-041 acrescentou "Anteriores", e ela nasceu de um defeito.**
 *
 * A lista do aluno não tinha corte temporal: uma reserva de semana passada,
 * com pagamento pendente, continuava aparecendo como se ainda fosse acontecer.
 * O Israel achou usando. O molde é o mesmo de `aulas-tabs.tsx` (SPEC-025), que
 * já tinha resolvido a mesma pergunta uma tela ao lado — a assimetria é que
 * era o defeito.
 *
 * **A primeira aba continua se chamando "Reservas", por decisão do Israel
 * (D-I4).** "Próximas" seria mais preciso se o corte fosse pelo início da
 * ocupação, mas ele é pelo **fim**: quem está na quadra às 20h numa reserva de
 * 19h às 21h ainda a vê aqui. Chamar de "próxima" o que é atual seria trocar
 * um rótulo impreciso por outro — e "Reservas" já está em produção.
 */
/**
 * **SPEC-047 acrescentou "Aula particular", e ela é irmã de "Quadras".**
 *
 * As duas são a mesma pergunta — *"o que eu quero marcar?"* — e a resposta
 * muda só no que o aluno escolhe: lá a quadra, aqui o professor. Pela LIM-047e
 * ele **não escolhe a quadra** numa aula particular, então a tela nova não é
 * um passo dentro de "Quadras": é uma porta ao lado.
 *
 * Não virou item da `BottomNav` porque a barra tem quatro destinos e um quinto
 * custaria a legibilidade de todos — e porque "marcar aula" é reserva, que já
 * tem casa. `/minhas-aulas` é outra coisa: são as aulas de TURMA, e juntar as
 * duas repetiria a confusão que a SPEC-022 desfez entre `/quadras` e
 * `/reservas`.
 */
/**
 * **SPEC-053/D3 — "Quadras" e "Aula particular" saíram da barra**, e viraram os
 * cartões de `/reservas/nova`. Esta tela é o lugar de ACOMPANHAR; contratar
 * mora ao lado. `?aba=quadras` e `?aba=aula` respondem `308` na página, antes
 * de chegar aqui. O nome e o corte da primeira aba não mudam (SPEC-041/D-I4).
 */
const ABAS = [
  { id: "reservas", rotulo: "Reservas" },
  { id: "anteriores", rotulo: "Anteriores" },
] as const satisfies readonly AbaDaTela<"reservas" | "anteriores">[];

type AbaId = (typeof ABAS)[number]["id"];

/** REQ-003: entrar sem parâmetro abre "as minhas reservas". */
export const ABA_PADRAO: AbaId = "reservas";

/** Mantido exportado: as provas da SPEC-022 dependem dele diretamente. */
export function normalizarAbaDeReservas(valor: string | null): AbaId {
  return normalizarAba(ABAS, ABA_PADRAO, valor);
}

export function ReservasTabs() {
  const { ativa, irPara } = useAbaAtiva(ABAS, ABA_PADRAO, "/reservas");

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-5 px-5">
        <BarraDeAbas
          abas={ABAS}
          ativa={ativa}
          onTrocar={irPara}
          rotulo="Suas reservas"
        />
      </div>

      {/*
        Só o painel ativo é montado: montar os dois faria a tela buscar as duas
        listas a cada entrada. O custo é remontar ao voltar para a aba; o ganho
        é a tela abrir no tempo de uma requisição, que é o que a pessoa sente.
      */}
      <div
        role="tabpanel"
        id={`painel-${ativa}`}
        aria-labelledby={`aba-${ativa}`}
        className="mt-5"
      >
        {/*
          A `key` força remontar ao trocar de aba, e isso é de propósito: sem
          ela o React reaproveitaria a instância, e a página em que a pessoa
          estava em "Reservas" viria junto para "Anteriores", pedindo a página 3
          de uma lista que pode ter uma só. Consequência aceita: a paginação
          reinicia na troca (LIM-041g).
        */}
        <MyBookingsList key={ativa} aba={ativa} />
      </div>

      <BottomNav />
    </main>
  );
}
