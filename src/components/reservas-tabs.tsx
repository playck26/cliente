"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { CourtsList } from "@/components/courts-list";
import { MyBookingsList } from "@/components/my-bookings-list";
import { TopAppBar } from "@/components/top-app-bar";

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
 */

const ABAS = [
  { id: "reservas", rotulo: "Reservas" },
  { id: "quadras", rotulo: "Quadras" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

/** REQ-003: entrar sem parâmetro abre "as minhas reservas". */
export const ABA_PADRAO: AbaId = "reservas";

/**
 * **Valor desconhecido não é erro.** `?aba=lixo` vem de URL editada à mão ou
 * de link velho, e o certo é abrir a tela padrão em silêncio — mensagem de
 * erro aqui puniria a pessoa por um link que nós mudamos.
 */
export function normalizarAba(valor: string | null): AbaId {
  return ABAS.some((aba) => aba.id === valor) ? (valor as AbaId) : ABA_PADRAO;
}

export function ReservasTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ativa = normalizarAba(searchParams.get("aba"));

  /**
   * **A aba mora na URL, não em `useState`.** Três coisas dependem disso, e a
   * terceira é a que decide: link compartilhável; o "voltar" do navegador
   * desfazendo a troca (REQ-005); e o redirect de `/quadras`, que só tem
   * para onde apontar porque a aba tem endereço.
   *
   * `push` e não `replace`, justamente para o "voltar" ter o que desfazer.
   * `scroll: false` porque trocar de aba não é navegar para outra tela — a
   * pessoa perderia a posição de leitura sem motivo.
   */
  const irPara = (aba: AbaId) => {
    if (aba === ativa) return;
    router.push(aba === ABA_PADRAO ? "/reservas" : `/reservas?aba=${aba}`, {
      scroll: false,
    });
  };

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar />

      <div className="space-y-5 px-5">
        <div
          role="tablist"
          aria-label="Reservas e quadras"
          className="grid grid-cols-2 gap-1 rounded-[22px] bg-[var(--color-court-dark)]/[0.07] p-1.5"
        >
          {ABAS.map((aba) => {
            const selecionada = aba.id === ativa;
            return (
              <button
                key={aba.id}
                type="button"
                role="tab"
                id={`aba-${aba.id}`}
                aria-selected={selecionada}
                aria-controls={`painel-${aba.id}`}
                onClick={() => irPara(aba.id)}
                className={`flex h-11 items-center justify-center rounded-[16px] text-[13px] font-extrabold transition-colors ${
                  selecionada
                    ? "bg-white text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                    : "text-[var(--color-court-dark)]/55 hover:text-[var(--color-court-dark)]"
                }`}
              >
                {aba.rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        Só o painel ativo é montado. Montar os dois faria a tela buscar as
        reservas E as quadras a cada entrada — duas idas à rede para mostrar
        uma. O custo é remontar ao voltar para a aba; o ganho é a tela abrir
        no tempo de uma requisição, que é o que a pessoa sente.
      */}
      <div
        role="tabpanel"
        id={`painel-${ativa}`}
        aria-labelledby={`aba-${ativa}`}
        className="mt-5"
      >
        {ativa === "quadras" ? <CourtsList /> : <MyBookingsList />}
      </div>

      <BottomNav />
    </main>
  );
}
