"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CapaDaQuadra } from "@/components/capa-da-quadra";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  createBooking,
  getAvailability,
  getMinhaCarteira,
  getPublicPaymentConfig,
  listCourts,
  type Availability,
  type Court,
  type PublicPaymentConfig,
} from "@/lib/api-client";
import { hojeNoClubeIso, isoDeOffsetNoClube } from "@/lib/fuso";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const DIAS_SEMANA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/**
 * DEF-020 — **as 30 datas, no fuso do clube e por montagem da tela.**
 *
 * Duas correções no mesmo lugar:
 *
 * 1. **O fuso.** Isto era `new Date().toISOString()`, que converte para UTC:
 *    das 21h à meia-noite a lista já começava **amanhã**, e quem abria o app
 *    às 21h30 não conseguia mais reservar os horários que ainda restavam
 *    hoje. O `isoDeOffset` antigo era pior — somava dias em horário local
 *    (`getDate()`) e lia em UTC (`toISOString()`), duas convenções em três
 *    linhas.
 * 2. **O momento do cálculo.** Era uma constante de módulo, avaliada uma vez
 *    no import. App deixado aberto atravessava a meia-noite ainda oferecendo
 *    a lista do dia anterior.
 */
function datasDisponiveis(): string[] {
  return Array.from({ length: 30 }, (_, i) => isoDeOffsetNoClube(i));
}

function labelDoDia(iso: string): { dia: string; numero: string } {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return {
    dia: DIAS_SEMANA_CURTO[data.getUTCDay()],
    numero: String(dia).padStart(2, "0"),
  };
}

function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return `${DIAS_SEMANA_CURTO[data.getUTCDay()]}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// REQ-005 (SPEC-005): grade de disponibilidade + reserva múltipla.
export function CourtBooking({ id }: { id: string }) {
  const router = useRouter();
  const [quadra, setQuadra] = useState<Court | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState(() => hojeNoClubeIso());
  // Resolvidas na montagem, não no import: ver `datasDisponiveis`.
  const [datasDaGrade] = useState(datasDisponiveis);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState<string | null>(null);
  const [slotsSelecionados, setSlotsSelecionados] = useState<string[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingOk, setBookingOk] = useState(false);
  const [paymentConfig, setPaymentConfig] =
    useState<PublicPaymentConfig | null>(null);
  /**
   * SPEC-048/REQ-001 — **o saldo, porque reservar GASTA ele.**
   *
   * Esta tela dizia *"Pago com seu saldo"* **depois** de confirmar, e nada
   * antes. Aviso depois do fato não é clareza, é recibo — e este é o fluxo
   * mais usado do app.
   *
   * `null` é "não sei", não "zero": a carteira pode não ter carregado, e a
   * diferença decide se a tela fala ou fica calada.
   */
  const [saldoCentavos, setSaldoCentavos] = useState<number | null>(null);

  useEffect(() => {
    listCourts()
      .then((result) => {
        const encontrada = result.data.find((court) => court.id === id);
        if (!encontrada) {
          setLoadError("Quadra não encontrada.");
          return;
        }
        setQuadra(encontrada);
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar a quadra.",
        );
      });
    getPublicPaymentConfig()
      .then(setPaymentConfig)
      .catch(() => undefined);
    // AC-004 — **falha aqui não derruba a tela.** Sem o saldo a pessoa perde o
    // aviso, não a possibilidade de reservar; e quem decide de verdade é o
    // servidor, na criação. Professor e gestor logados caem no `404` da
    // carteira legitimamente (SPEC-033), e para eles o silêncio é o certo.
    void recarregarSaldo();
  }, [id]);

  function recarregarSaldo() {
    return getMinhaCarteira()
      .then((extrato) => setSaldoCentavos(extrato.saldoCentavos))
      .catch(() => undefined);
  }

  async function loadAvailability(
    targetData: string,
    manterConfirmacao = false,
  ) {
    setAvailLoading(true);
    setAvailError(null);
    setSlotsSelecionados([]);
    // **O erro da reserva morre junto com a troca de dia ou de quadra.**
    // Sem esta linha ele sobrevivia: "nao foi possivel reservar; tente outro
    // horario" de terca continuava em cima do resumo de quarta, acusando um
    // dia em que nada tinha sido tentado. Achado pela revisao adversarial
    // desta PR, que reproduziu o caso antes de eu acreditar nele.
    setBookingError(null);
    if (!manterConfirmacao) setBookingOk(false);
    try {
      const result = await getAvailability(id, targetData);
      setAvailability(result);
    } catch (err) {
      setAvailError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar a disponibilidade.",
      );
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAvailability(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function alternarSlot(rotulo: string) {
    setSlotsSelecionados((atual) =>
      atual.includes(rotulo)
        ? atual.filter((slot) => slot !== rotulo)
        : [...atual, rotulo],
    );
  }

  // SPEC-033 — a reserva nasce `pago` quando o crédito cobre. Sem isto a tela
  // não tinha como distinguir "pague depois" de "já está pago".
  const [pagoComCredito, setPagoComCredito] = useState(false);

  async function handleConfirmar() {
    if (slotsSelecionados.length === 0) return;
    setBookingError(null);
    setBookingLoading(true);
    try {
      const { reservas } = await createBooking({
        quadraId: id,
        data,
        slots: slotsSelecionados.map((rotulo) => {
          const [horaInicio, horaFim] = rotulo.split("-");
          return { horaInicio, horaFim };
        }),
      });
      await loadAvailability(data, true);
      // **A resposta era descartada, e por isso a tela pedia pagamento de uma
      // reserva já paga.** O saldo em crédito (SPEC-033) faz a reserva nascer
      // `pago`, e este `every` é o que a tela precisa saber: pedir "abra o link
      // de pagamento" depois de debitar o crédito da pessoa é o pior tipo de
      // erro, o que faz duvidar de que o dinheiro entrou.
      //
      // `every` e não `some`: um pedido de vários horários pode, em tese,
      // esgotar o saldo no meio. Se **qualquer** bloco ficou pendente, o
      // caminho de pagamento continua sendo o certo.
      setPagoComCredito(
        reservas.length > 0 &&
          reservas.every((r) => r.statusPagamento === "pago"),
      );
      setBookingOk(true);
      // AC-005 — a carteira mudou: a reserva foi debitada. **Reler evita a
      // tela afirmar um saldo que já não é o dela** — e é o número que a
      // pessoa vai conferir logo depois.
      void recarregarSaldo();
    } catch (err) {
      setBookingError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível reservar; tente outro horário.",
      );
    } finally {
      setBookingLoading(false);
    }
  }

  if (loadError) {
    return (
      <main className="app-screen min-h-screen bg-background px-5 py-6 pb-36">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <p
          role="alert"
          className="mt-6 rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border"
        >
          {loadError}
        </p>
        <BottomNav />
      </main>
    );
  }

  const total = slotsSelecionados.length * (quadra?.precoHora ?? 0);

  /**
   * SPEC-048/D6 — **a conversão acontece AQUI, uma vez.**
   *
   * `precoHora` é `Decimal` em REAIS; a carteira é em CENTAVOS. Comparar os
   * dois é exatamente onde nasce erro de fator 100, e por isso a tela tem um
   * único lugar que atravessa a fronteira. `Math.round` porque `1.1 * 100` é
   * `110.00000000000001` em ponto flutuante — e centavo quebrado viraria
   * "faltam R$ 0,00".
   */
  const totalCentavos = Math.round(total * 100);
  const faltamCentavos =
    saldoCentavos === null ? 0 : Math.max(0, totalCentavos - saldoCentavos);
  const saldoNaoCobre = saldoCentavos !== null && faltamCentavos > 0;
  const emReais = (centavos: number) =>
    (centavos / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3 px-5 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
            Reserva
          </p>
          <h1 className="truncate text-lg leading-none font-extrabold text-[var(--color-primary-strong)]">
            {quadra?.nome ?? "Carregando..."}
          </h1>
        </div>
        <span
          className="flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-primary-strong)] shadow-[var(--shadow-low)] ring-1 ring-border"
          aria-hidden="true"
        >
          <Image
            src="/playck-logo.png"
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
          />
        </span>
      </header>

      <div className="space-y-4 px-5">
        <section className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-lift)] ring-1 ring-border">
          <div className="relative h-[128px] overflow-hidden bg-[var(--color-court-clay)] text-white">
            <CapaDaQuadra
              imagemUrl={quadra?.imagemUrl ?? null}
              nome={quadra?.nome ?? "quadra"}
            />
            <div className="absolute top-3 right-4 z-10 rounded-2xl bg-white/18 px-3 py-2 text-right backdrop-blur-sm ring-1 ring-white/15">
              <p className="text-lg leading-none font-extrabold">
                {(quadra?.precoHora ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="mt-1 text-[10px] font-bold text-white/75">
                por hora
              </p>
            </div>
            <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">
                {/* DEF-012 — `?? "Quadra"` NÃO protegia: objeto não é nulo, e o React
                  estourava. Só o `?.nome` fecha. */}
                {quadra?.esporte?.nome ?? "Quadra"}
              </p>
              <h2 className="mt-0.5 text-[22px] leading-tight font-extrabold">
                {quadra?.nome ?? "Carregando..."}
              </h2>
            </div>
          </div>
        </section>

        {!bookingOk ? (
          <>
            {/*
              AC-001 — **o saldo aparece antes de qualquer escolha.**
              Fica acima da data de propósito: quem abre a tela precisa saber
              com o que conta ANTES de montar um pedido que a carteira pode não
              cobrir. Some quando não carregou (`null`), porque afirmar "R$ 0,00"
              para quem não tem carteira seria inventar um fato.
            */}
            {saldoCentavos !== null ? (
              <p className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
                <Wallet className="size-4 shrink-0" aria-hidden="true" />
                Seu saldo: {emReais(saldoCentavos)}
                <Link
                  href="/perfil"
                  className="ml-auto shrink-0 text-[13px] font-bold text-[var(--color-primary-strong)] underline"
                >
                  carteira
                </Link>
              </p>
            ) : null}

            <section>
              <div className="mb-3">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">
                  Dia
                </p>
                <h2 className="text-xl font-extrabold">Escolha a data</h2>
              </div>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {datasDaGrade.map((iso, index) => {
                  const { dia, numero } = labelDoDia(iso);
                  const selecionado = iso === data;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setData(iso);
                        void loadAvailability(iso);
                      }}
                      aria-pressed={selecionado}
                      className={`flex h-16 w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl px-3 transition-transform active:scale-95 ${selecionado ? "bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)]" : "bg-surface text-[var(--color-text-primary)] shadow-[var(--shadow-low)] ring-1 ring-border"}`}
                    >
                      <span
                        className={`text-[11px] font-bold ${selecionado ? "text-white/80" : "text-[var(--color-text-secondary)]"}`}
                      >
                        {index === 0 ? "HOJE" : dia}
                      </span>
                      <span className="mt-1 text-[22px] leading-none font-extrabold">
                        {numero}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-low)] ring-1 ring-border">
              <div className="mb-3 flex items-start justify-between gap-3 px-1 pt-1">
                <div>
                  <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">
                    Horários
                  </p>
                  <h2 className="text-xl font-extrabold">Disponíveis</h2>
                </div>
                {availability?.estado === "aberto" ? (
                  <span className="rounded-full bg-[var(--color-secondary-container)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
                    {
                      availability.slots.filter(
                        (slot) => slot.status === "livre",
                      ).length
                    }{" "}
                    livres
                  </span>
                ) : null}
              </div>

              {availError ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-[var(--color-tertiary-container)] p-4 text-sm font-semibold text-[var(--color-error)]"
                >
                  {availError}
                </p>
              ) : availLoading ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  aria-label="Carregando horários"
                >
                  {[0, 1, 2, 3, 4, 5].map((item) => (
                    <div
                      key={item}
                      className="h-12 animate-pulse rounded-2xl bg-[var(--color-surface-container-high)]"
                    />
                  ))}
                </div>
              ) : availability?.estado === "fechado" ? (
                <p className="rounded-2xl bg-[var(--color-surface-container)] p-4 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                  A quadra não abre neste dia. Escolha outra data.
                </p>
              ) : availability?.slots.length === 0 ? (
                <p className="rounded-2xl bg-[var(--color-surface-container)] p-4 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                  Não há horários cadastrados para esta data.
                </p>
              ) : availability ? (
                <div className="grid grid-cols-3 gap-2">
                  {availability.slots.map((slot) => {
                    const livre = slot.status === "livre";
                    const selecionado = slotsSelecionados.includes(slot.slot);
                    const [inicio] = slot.slot.split("-");
                    return (
                      <button
                        key={slot.slot}
                        type="button"
                        disabled={!livre}
                        onClick={() => alternarSlot(slot.slot)}
                        aria-pressed={selecionado}
                        className={`flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 text-[13px] font-extrabold transition-colors ${!livre ? "cursor-not-allowed bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)] opacity-50" : selecionado ? "bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)]" : "bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary-strong)]"}`}
                      >
                        {inicio}
                        <span className="mt-0.5 text-[9px] font-bold opacity-75">
                          {livre
                            ? "Livre"
                            : slot.status === "ocupado_turma"
                              ? "Turma"
                              : "Reservado"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>

            {slotsSelecionados.length > 0 ? (
              <section className="rounded-3xl bg-[var(--color-court-dark)] p-4 text-white shadow-[var(--shadow-lift)]">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-secondary)] uppercase">
                  Resumo
                </p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold">
                      {formatarDataCurta(data)}
                    </h2>
                    <p className="mt-1 text-[13px] font-semibold text-white/70">
                      {quadra?.nome} • {slotsSelecionados.length}{" "}
                      {slotsSelecionados.length === 1 ? "horário" : "horários"}
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-extrabold">
                    {total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                {/*
                  AC-002/AC-003 — **o que vai sair da carteira, e o que falta.**

                  Para o ALUNO reservar é tudo-ou-nada: ou o saldo cobre o
                  pedido inteiro e a reserva nasce `pago`, ou o servidor recusa
                  com `SALDO_INSUFICIENTE`. Não existe reserva de aluno pendente
                  por falta de saldo — e era isso que a tela nunca disse.
                */}
                {saldoCentavos !== null ? (
                  <div className="mt-3 rounded-2xl bg-white/10 p-3">
                    <p className="flex items-center justify-between gap-3 text-[13px] font-semibold text-white/80">
                      <span className="flex items-center gap-2">
                        <Wallet className="size-4 shrink-0" aria-hidden="true" />
                        Sai do seu saldo
                      </span>
                      <span className="font-extrabold text-white">
                        {emReais(totalCentavos)}
                      </span>
                    </p>
                    {saldoNaoCobre ? (
                      <p className="mt-2 text-[13px] font-semibold text-white">
                        Seu saldo é {emReais(saldoCentavos)} — faltam{" "}
                        <span className="font-extrabold">
                          {emReais(faltamCentavos)}
                        </span>
                        .{" "}
                        <Link href="/perfil" className="underline">
                          Ver carteira
                        </Link>
                        {/*
                          **O botão continua habilitado** (D2/LIM-047f): o saldo
                          foi lido na montagem, e travar prenderia quem acabou
                          de receber crédito. A tela informa; quem julga é o
                          servidor.
                        */}
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] font-medium text-white/60">
                        Ficam {emReais(saldoCentavos - totalCentavos)} depois
                        desta reserva.
                      </p>
                    )}
                  </div>
                ) : null}

                {bookingError ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white"
                  >
                    {bookingError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  disabled={bookingLoading}
                  onClick={() => void handleConfirmar()}
                  className="mt-4 h-12 w-full rounded-2xl bg-white text-[14px] font-extrabold text-[var(--color-court-dark)] hover:bg-white/90"
                >
                  {bookingLoading ? "Reservando..." : "Confirmar reserva"}
                  {!bookingLoading ? (
                    <ArrowRight className="size-5" aria-hidden="true" />
                  ) : null}
                </Button>
              </section>
            ) : bookingError ? (
              <p
                role="alert"
                className="rounded-2xl bg-[var(--color-tertiary-container)] p-4 text-sm font-semibold text-[var(--color-error)]"
              >
                {bookingError}
              </p>
            ) : null}
          </>
        ) : (
          <section className="rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-lift)] ring-1 ring-border">
            <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold text-[var(--color-primary-strong)]">
              Reserva confirmada!
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
              Sua quadra foi reservada com sucesso.
            </p>

            {pagoComCredito ? (
              <div className="mt-5 rounded-2xl bg-[var(--color-secondary-container)] p-4 text-left">
                <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-primary-strong)]">
                  <Wallet className="size-4" aria-hidden="true" /> Pago com seu
                  saldo
                </p>
                <p className="mt-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
                  O valor foi debitado da sua carteira. Não há nada a pagar.
                  {/*
                    AC-005 — o saldo NOVO, relido do servidor depois da
                    reserva. Repetir o antigo aqui seria a tela afirmar um
                    número que ela mesma acabou de tornar falso.
                  */}
                  {saldoCentavos !== null
                    ? ` Seu saldo agora é ${emReais(saldoCentavos)}.`
                    : ""}
                </p>
              </div>
            ) : paymentConfig?.linkPagamentoUrl ||
              paymentConfig?.whatsappNumero ? (
              <div className="mt-5 rounded-2xl bg-[var(--color-surface-container)] p-3 text-left">
                <p className="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
                  Para pagar
                </p>
                <div className="flex flex-col gap-2">
                  {paymentConfig.linkPagamentoUrl ? (
                    <a
                      href={paymentConfig.linkPagamentoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-2 text-sm font-extrabold text-white"
                    >
                      <CreditCard className="size-4" aria-hidden="true" /> Abrir
                      link de pagamento
                    </a>
                  ) : null}
                  {paymentConfig.whatsappNumero ? (
                    <a
                      href={buildWhatsAppLink(paymentConfig.whatsappNumero)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-bold text-[var(--color-text-primary)]"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />{" "}
                      Falar no WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => router.push("/reservas")}
              className="mt-5 h-12 w-full rounded-2xl text-sm font-extrabold"
            >
              Ver minhas reservas
            </Button>
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
