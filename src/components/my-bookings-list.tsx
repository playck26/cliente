"use client";

import { useEffect, useState } from "react";
import { Paginacao } from "@/components/paginacao";
import {
  CalendarDays,
  CreditCard,
  MessageCircle,
  WalletCards,
} from "lucide-react";
import { CapaDaQuadra } from "@/components/capa-da-quadra";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { GrupoDeFiltro } from "@/components/grupo-de-filtro";
import {
  ApiError,
  cancelBooking,
  getPublicPaymentConfig,
  listCourts,
  listMyBookings,
  type Booking,
  type Court,
  type ItemDaListaDeReservas,
  type PublicPaymentConfig,
} from "@/lib/api-client";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana =
    DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * SPEC-041/LIM-041c — **provisório por decisão, não por descuido.**
 *
 * O Israel: *"o nome nem vai ser clube — teremos uma definição para o nome que
 * o dono quiser pôr, nas configurações do admin da empresa, mas isso é coisa
 * mais pra frente."*
 *
 * Fica no **Cliente**, e não no `back`, porque é *copy* de interface: o
 * servidor devolve estado, não frase em português. Numa constante só, para a
 * spec do nome configurável trocar em um lugar.
 */
/**
 * SPEC-041/AC-012 e LIM-041c — **as três frases do cancelamento.**
 *
 * O aluno não vê NOME de quem cancelou: vê qual dos dois casos. Nome de
 * funcionário na tela do aluno é informação que ninguém pediu e que cria
 * expectativa de contato direto (D2).
 *
 * **"clube" é provisório por decisão do Israel**, não por descuido: *"o nome
 * nem vai ser clube — teremos uma definição para o nome que o dono quiser pôr,
 * nas configurações do admin da empresa, mas isso é coisa mais pra frente."*
 * Fica aqui, numa constante só, para a spec futura trocar em um lugar.
 *
 * Fica no **Cliente** e não no `back` porque é *copy* de interface: o servidor
 * devolve classificação (`canceladaPorMim`), não frase em português.
 *
 * **E o caso `null` cala.** Sem histórico é diferente de sem cancelamento, e
 * inventar texto para o nulo é o mesmo erro do "criada por —" que a SPEC-032
 * recusou. É também o estado normal de tudo que foi cancelado antes dela
 * (LIM-041b).
 */
const TEXTO_CANCELAMENTO = {
  eu: "Você cancelou esta reserva.",
  clube: "Cancelada pelo clube.",
  semRegistro: "Esta reserva foi cancelada.",
} as const;

function textoDoCancelamento(canceladaPorMim: boolean | null): string {
  if (canceladaPorMim === true) return TEXTO_CANCELAMENTO.eu;
  if (canceladaPorMim === false) return TEXTO_CANCELAMENTO.clube;
  return TEXTO_CANCELAMENTO.semRegistro;
}

/**
 * SPEC-041/AC-014 e D6 — **os quatro estados do filtro, e só três têm valor.**
 *
 * "Todas" é a AUSÊNCIA do parâmetro, não um valor dele — por isso um mapa
 * 1-para-1 não serviria: são quatro estados de tela para três valores de API.
 *
 * A URL carrega o valor da API (`?status=cancelado`), e o português vive só no
 * rótulo. Sem camada de tradução: ela seria um segundo vocabulário para o
 * mesmo conceito, e é ela que produziria o 400 se alguém repassasse
 * `?status=canceladas` direto.
 */
const FILTROS_DE_STATUS = [
  { id: "pendente_pagamento", nome: "Pendentes" },
  { id: "pago", nome: "Pagas" },
  { id: "cancelado", nome: "Canceladas" },
] as const;

type StatusDeFiltro = Booking["statusPagamento"];

/**
 * O filtro mora na URL, no molde do `useVista` de `my-classes-list`: link
 * compartilhável, "voltar" que desfaz, e valor desconhecido caindo em "todas"
 * **em silêncio** — URL editada à mão ou link velho não merece erro na cara.
 *
 * Preserva o resto da query em vez de reescrever o endereço. O `abas-na-url`
 * fazia o contrário até a TASK-B3 de hoje, e era defeito em produção.
 */
function useStatusNaUrl(): {
  status: StatusDeFiltro | null;
  irPara: (s: string | null) => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cru = searchParams.get("status");
  const status = FILTROS_DE_STATUS.some((f) => f.id === cru)
    ? (cru as StatusDeFiltro)
    : null;

  const irPara = (novo: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (novo) params.set("status", novo);
    else params.delete("status");
    const qs = params.toString();
    router.push(qs ? `/reservas?${qs}` : "/reservas", { scroll: false });
  };

  return { status, irPara };
}

const STATUS_LABEL: Record<Booking["statusPagamento"], string> = {
  pendente_pagamento: "Pagamento pendente",
  pago: "Pago",
  cancelado: "Cancelada",
};

/**
 * SPEC-041 — **o que cada aba diz de si.**
 *
 * Duas abas, duas perguntas, e o vazio de uma não serve à outra: "Suas
 * próximas reservas aparecerão aqui" numa aba de histórico é a frase errada
 * para quem só quer saber se jogou semana passada.
 */
const COPY_DA_ABA = {
  reservas: {
    titulo: "Quadras na sua agenda",
    contagem: (n: number) => `${n} ${n === 1 ? "reserva" : "reservas"}`,
    rotuloDaLista: "Reservas",
    vazioTitulo: "Nenhuma reserva por vir",
    vazioTexto: "Suas próximas reservas de quadra aparecerão aqui.",
  },
  anteriores: {
    titulo: "O que já passou",
    contagem: (n: number) =>
      `${n} ${n === 1 ? "reserva anterior" : "reservas anteriores"}`,
    rotuloDaLista: "Reservas anteriores",
    vazioTitulo: "Nada no histórico ainda",
    vazioTexto: "Suas reservas passadas aparecerão aqui.",
  },
} as const;

// REQ-004/005 (SPEC-005): aluno vê e cancela as próprias reservas avulsas.
// SPEC-041: e agora com corte temporal, porque sem ele o passado se
// apresentava como futuro.
export function MyBookingsList({
  aba = "reservas",
}: {
  aba?: "reservas" | "anteriores";
} = {}) {
  const copy = COPY_DA_ABA[aba];
  const quando = aba === "anteriores" ? "anteriores" : "futuras";
  const { status, irPara: navegarParaStatus } = useStatusNaUrl();
  const [bookings, setBookings] = useState<ItemDaListaDeReservas[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [paymentConfig, setPaymentConfig] =
    useState<PublicPaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [pagamentoAbertoId, setPagamentoAbertoId] = useState<string | null>(
    null,
  );
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [tamanho, setTamanho] = useState(20);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bookingsResult, courtsResult] = await Promise.all([
        listMyBookings(pagina, 20, quando, status ?? undefined),
        listCourts(),
      ]);
      // SPEC-027: o `.filter` de canceladas saiu daqui e foi para o servidor
      // (`excluirCanceladas=true`). Filtrar no cliente depois de paginar faria
      // uma página de 20 mostrar 12 itens com o rodapé dizendo "1–20 de 47".
      /**
       * **A página em que estou ainda existe?** (validação cruzada da
       * SPEC-027, achado 1.)
       *
       * Cenário: 21 reservas ativas, a pessoa está na página 2 e cancela a
       * única que há ali. O servidor passa a responder `page=2, total=20,
       * data=[]` — e a tela, que decide o estado vazio por
       * `bookings.length === 0`, dizia **"Nenhuma reserva ainda"** e escondia
       * a paginação. Com 20 reservas vivas na página 1.
       *
       * Cancelar é a única ação desta tela que ENCOLHE a lista, e por isso o
       * defeito é só dela — em "aulas anteriores" avaliar não remove nada.
       *
       * Corrigido no dono do dado, não no controle: a `Paginacao` recebe
       * números prontos e não tem como saber que a página sumiu. E `total`
       * cobre o encolhimento de várias páginas de uma vez, o que
       * `pagina - 1` não cobriria.
       */
      const ultimaPagina = Math.max(
        1,
        Math.ceil(bookingsResult.total / bookingsResult.pageSize),
      );
      if (pagina > ultimaPagina) {
        // `loading` continua ligado de propósito: o efeito vai recarregar, e
        // desligar aqui pintaria o vazio falso por um quadro.
        setPagina(ultimaPagina);
        return;
      }

      /**
       * **SPEC-041 — o `.sort` que morava aqui saiu, e ele era um terceiro
       * defeito.**
       *
       * O servidor paginava em `data desc` e a tela repintava em ordem
       * crescente. A lista não era crescente nem decrescente: era um serrote
       * que reiniciava a cada página — da 20ª-mais-recente até a mais
       * recente, e a página 2 voltava para a 40ª e subia de novo.
       *
       * É o irmão que a SPEC-027 esqueceu quando mandou o `.filter` para o
       * servidor. E enquanto ele existisse, **nenhuma** mudança de `orderBy`
       * no servidor apareceria na tela: quem ordena agora é quem tem a lista
       * inteira, que é o único que pode.
       */
      setBookings(bookingsResult.data);
      setTotal(bookingsResult.total);
      setTamanho(bookingsResult.pageSize);
      setCourts(courtsResult.data);
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas reservas.",
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // `status` entra na lista porque trocar o filtro muda o conjunto.
    //
    // `load` fica de fora, e a regra reclama disso: ela é recriada a cada
    // render, então incluí-la faria o efeito rodar sem parar. A saída certa
    // seria `useCallback`, mas ela arrastaria as sete dependências de `load`
    // para cá e o efeito voltaria a disparar por motivo errado. Fica
    // declarado em vez de silenciado — o `disable` que morava aqui ficou
    // órfão quando a lista mudou, e comentário que não desabilita nada é
    // pior que advertência visível.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, quando, status]);

  useEffect(() => {
    // A config de pagamento não muda com a página — buscar uma vez.
    getPublicPaymentConfig()
      .then(setPaymentConfig)
      .catch(() => undefined);
  }, []);

  async function handleCancel(id: string) {
    setCancelingId(id);
    setError(null);
    try {
      await cancelBooking(id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível cancelar a reserva.",
      );
    } finally {
      setCancelingId(null);
    }
  }

  /**
   * Trocar o filtro volta para a página 1, e isso não é detalhe: pedir a
   * página 3 de um conjunto que acabou de encolher devolve lista vazia com
   * `total` alto — a contagem mentirosa que a SPEC-027 consertou, por outro
   * caminho. O `useState` de `pagina` não sabe que a URL mudou; quem sabe é
   * quem muda.
   */
  function filtrarPor(novo: string | null) {
    setPagina(1);
    navegarParaStatus(novo);
  }

  function quadraDaReserva(quadraId: string): Court | undefined {
    return courts.find((court) => court.id === quadraId);
  }

  const pendentes = bookings.filter(
    (booking) => booking.statusPagamento === "pendente_pagamento",
  ).length;
  const temMeioDePagamento = Boolean(
    paymentConfig?.linkPagamentoUrl || paymentConfig?.whatsappNumero,
  );

  // SPEC-022 — ver a nota gêmea em `courts-list.tsx`: a moldura passou para
  // `reservas-tabs.tsx`, porque as duas telas agora dividem uma só.
  return (
    <>
      <div className="space-y-5 px-5">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-4 text-white shadow-[var(--shadow-lift)]">
          <CourtLines className="opacity-35" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/80 uppercase ring-1 ring-white/10">
              <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
              Minhas reservas
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-[28px] leading-[1.04] font-extrabold">
                  {copy.titulo}
                </h1>
                {/*
                  SPEC-041/AC-008 — **`total`, não `bookings.length`.** A
                  frase contava a PÁGINA: com 47 reservas, a página 1 dizia
                  "20 reservas ativas". E "ativa" deixou de ser verdade no
                  minuto em que as canceladas passaram a aparecer aqui.
                */}
                <p className="mt-1.5 text-[13px] font-semibold text-white/75">
                  {loading ? "Carregando reservas..." : copy.contagem(total)}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/20">
                <p className="text-2xl leading-none font-extrabold">
                  {loading ? "–" : pendentes}
                </p>
                <p className="mt-1 text-[10px] font-bold text-white/70">
                  pendentes
                </p>
              </div>
            </div>

            {/* SPEC-041/AC-014 — o filtro que o Israel pediu ("podemos colocar
                tipo uns filtros pra mostrar as canceladas"). Começa por
                status, que é o que os dois defeitos pediram; quadra e período
                esperam uso real dizer se fazem falta (LIM-041a). */}
            <GrupoDeFiltro
              rotulo="Filtrar reservas por situação"
              textoTodas="Todas"
              opcoes={FILTROS_DE_STATUS}
              escolhida={status}
              onEscolher={filtrarPor}
            />
          </div>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-3" aria-label="Carregando reservas">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-3xl bg-[var(--color-surface-container-high)]"
              />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
            <CalendarDays
              className="mx-auto size-8 text-[var(--color-primary-strong)]"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-extrabold">{copy.vazioTitulo}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {copy.vazioTexto}
            </p>
          </section>
        ) : (
          <section className="space-y-4" aria-label={copy.rotuloDaLista}>
            {bookings.map((booking, index) => {
              const quadra = quadraDaReserva(booking.quadraId);
              const pago = booking.statusPagamento === "pago";
              // SPEC-041/AC-006 — cancelada é exibida, e **não é operável**.
              const cancelada = booking.statusPagamento === "cancelado";
              /**
               * SPEC-042 — **o que já aconteceu não se cancela.**
               *
               * Quem decide se é passado é o **servidor**: esta reserva está
               * aqui porque `quando=anteriores` a trouxe, e o corte foi feito
               * com o relógio do clube em `recorteTemporal`. A tela não
               * recalcula hora nenhuma — recalcular seria a segunda cópia da
               * regra, que é o defeito que o gate de fuso existe para impedir.
               *
               * **Cancelar sai, cobrar fica.** Não são o mesmo caso: cancelar
               * o que já aconteceu apaga uma cobrança legítima; cobrar quem
               * jogou e não pagou é o fluxo normal do clube.
               */
              const jaAconteceu = aba === "anteriores";
              const pagamentoAberto = pagamentoAbertoId === booking.id;
              return (
                <article
                  key={booking.id}
                  className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border"
                >
                  <div
                    className={`relative h-[118px] overflow-hidden text-white ${index % 2 === 0 ? "bg-[var(--color-court-clay)]" : "bg-[var(--color-court-blue)]"}`}
                  >
                    {/*
                      Revisão de 2026-08-29 — a reserva mostra a MESMA capa
                      que a lista de quadras. A pessoa escolhe pela foto e
                      depois não reconhecia o que reservou: eram dois
                      desenhos para a mesma quadra.

                      Nada de novo veio do servidor para isto. Esta tela já
                      buscava as quadras (para o nome e o esporte), então a
                      imagem já estava aqui do lado — faltava usá-la.

                      `CapaDaQuadra` cai em `<CourtLines/>` sozinha quando a
                      quadra não tem foto, que é exatamente o que havia antes.
                    */}
                    <CapaDaQuadra
                      imagemUrl={quadra?.imagemUrl ?? null}
                      nome={quadra?.nome ?? "Quadra"}
                    />
                    {/*
                      SPEC-041 — o ternário tinha dois ramos para o que agora
                      são três estados. Cancelada caía no ramo de "pendente" e
                      ficava **visualmente idêntica** a uma reserva que a
                      pessoa ainda vai usar. O `line-through` segue o molde de
                      `semana-do-aluno.tsx`, onde a aula não realizada já é
                      marcada assim.
                    */}
                    <span
                      className={`absolute top-3 right-4 z-10 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${cancelada ? "bg-white/85 text-[var(--color-text-secondary)] line-through" : pago ? "bg-white text-[var(--color-primary-strong)]" : "bg-[var(--color-court-dark)] text-white"}`}
                    >
                      {STATUS_LABEL[booking.statusPagamento]}
                    </span>
                    <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
                      <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">
                        {formatarData(booking.data)} • {booking.horaInicio}
                      </p>
                      <h2
                        className={`mt-1 text-[21px] leading-tight font-extrabold ${cancelada ? "text-white/70 line-through" : ""}`}
                      >
                        {quadra?.nome ?? "Quadra"}
                      </h2>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[var(--color-surface-container)] p-3">
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                          Horário
                        </p>
                        <p className="mt-0.5 text-[13px] font-extrabold">
                          {booking.horaInicio}–{booking.horaFim}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[var(--color-surface-container)] p-3">
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                          Esporte
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-extrabold">
                          {/* DEF-012 — ver `courts-list.tsx`. */}
                          {quadra?.esporte?.nome ?? "Quadra"}
                        </p>
                      </div>
                    </div>

                    {/*
                      SPEC-041/AC-006 — **o grid inteiro some numa cancelada,
                      não só o "Cancelar".**
                      
                      O "Cancelar" duplicado seria só feio: o servidor ignora
                      (`cancelBooking` é no-op em quem já está cancelada). O
                      grave é o outro lado do grid — cancelada cai em `!pago`,
                      e a tela ofereceria **link de pagamento e WhatsApp para
                      cobrar** uma reserva que o clube desmarcou. Cobrar por
                      algo que não vai acontecer é pior que qualquer botão
                      inerte.
                      
                      No lugar, a razão do estado, que é o que a pessoa veio
                      procurar. O texto é provisório por decisão do Israel: o
                      nome do clube vira configuração numa spec futura
                      (LIM-041c), e por isso mora numa constante só.
                    */}
                    {cancelada ? (
                      <p className="mt-4 rounded-2xl bg-[var(--color-surface-container)] p-3 text-center text-[13px] font-bold text-[var(--color-text-secondary)]">
                        {textoDoCancelamento(booking.canceladaPorMim)}
                      </p>
                    ) : (
                      <div
                        className={`mt-4 grid gap-2 ${jaAconteceu ? "grid-cols-1" : "grid-cols-2"}`}
                      >
                        {jaAconteceu ? null : (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={cancelingId === booking.id}
                            onClick={() => void handleCancel(booking.id)}
                            className="h-11 rounded-2xl font-extrabold"
                          >
                            {cancelingId === booking.id
                              ? "Cancelando..."
                              : "Cancelar"}
                          </Button>
                        )}
                        {/* DEF-005 — este ternário tinha dois ramos para três
                          casos. A condição era `!pago && temMeioDePagamento`, e
                          o `else` dizia "Pagamento ok" — verdade para quem
                          pagou, **mentira para quem deve numa empresa que não
                          cadastrou meio de pagamento**. O cartão chegava a se
                          contradizer: a tarja de status dizia "Pagamento
                          pendente" três linhas acima. Nunca diga a alguém que
                          a dívida dela está quitada porque falta configuração
                          do outro lado. */}
                        {pago ? (
                          <span className="flex h-11 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[13px] font-extrabold text-[var(--color-primary-strong)]">
                            Pagamento ok
                          </span>
                        ) : temMeioDePagamento ? (
                          <Button
                            type="button"
                            onClick={() =>
                              setPagamentoAbertoId(
                                pagamentoAberto ? null : booking.id,
                              )
                            }
                            className="h-11 rounded-2xl font-extrabold"
                          >
                            <WalletCards
                              className="size-4"
                              aria-hidden="true"
                            />{" "}
                            Pagar agora
                          </Button>
                        ) : (
                          <span className="flex h-11 items-center justify-center rounded-2xl bg-[var(--color-surface-container)] px-2 text-center text-[12px] font-bold text-[var(--color-text-secondary)]">
                            Combine o pagamento com o clube
                          </span>
                        )}
                      </div>
                    )}

                    {!cancelada && pagamentoAberto && paymentConfig ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[var(--color-surface-container)] p-3">
                        {paymentConfig.linkPagamentoUrl ? (
                          <a
                            href={paymentConfig.linkPagamentoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-2 text-center text-sm font-extrabold text-white"
                          >
                            <CreditCard className="size-4" aria-hidden="true" />{" "}
                            Abrir link de pagamento
                          </a>
                        ) : null}
                        {paymentConfig.whatsappNumero ? (
                          <a
                            href={buildWhatsAppLink(
                              paymentConfig.whatsappNumero,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-center text-sm font-bold text-[var(--color-text-primary)]"
                          >
                            <MessageCircle
                              className="size-4"
                              aria-hidden="true"
                            />{" "}
                            Falar no WhatsApp
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            <Paginacao
              page={pagina}
              pageSize={tamanho}
              total={total}
              ocupado={loading}
              onMudar={setPagina}
              rotulo="minhas reservas"
            />
          </section>
        )}
      </div>
    </>
  );
}
