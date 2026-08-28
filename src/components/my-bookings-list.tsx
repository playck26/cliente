"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, MessageCircle, WalletCards } from "lucide-react";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  cancelBooking,
  getPublicPaymentConfig,
  listCourts,
  listMyBookings,
  type Booking,
  type Court,
  type PublicPaymentConfig,
} from "@/lib/api-client";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Booking["statusPagamento"], string> = {
  pendente_pagamento: "Pagamento pendente",
  pago: "Pago",
  cancelado: "Cancelada",
};

// REQ-004/005 (SPEC-005): aluno vê e cancela as próprias reservas avulsas.
export function MyBookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [pagamentoAbertoId, setPagamentoAbertoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bookingsResult, courtsResult] = await Promise.all([listMyBookings(), listCourts()]);
      setBookings(
        bookingsResult.data
          .filter((booking) => booking.statusPagamento !== "cancelado")
          .sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio)),
      );
      setCourts(courtsResult.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar suas reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    getPublicPaymentConfig().then(setPaymentConfig).catch(() => undefined);
  }, []);

  async function handleCancel(id: string) {
    setCancelingId(id);
    setError(null);
    try {
      await cancelBooking(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cancelar a reserva.");
    } finally {
      setCancelingId(null);
    }
  }

  function quadraDaReserva(quadraId: string): Court | undefined {
    return courts.find((court) => court.id === quadraId);
  }

  const pendentes = bookings.filter((booking) => booking.statusPagamento === "pendente_pagamento").length;
  const temMeioDePagamento = Boolean(paymentConfig?.linkPagamentoUrl || paymentConfig?.whatsappNumero);

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
                <h1 className="text-[28px] leading-[1.04] font-extrabold">Quadras na sua agenda</h1>
                <p className="mt-1.5 text-[13px] font-semibold text-white/75">
                  {loading ? "Carregando reservas..." : `${bookings.length} ${bookings.length === 1 ? "reserva ativa" : "reservas ativas"}`}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/20">
                <p className="text-2xl leading-none font-extrabold">{loading ? "–" : pendentes}</p>
                <p className="mt-1 text-[10px] font-bold text-white/70">pendentes</p>
              </div>
            </div>
          </div>
        </section>

        {error ? <p role="alert" className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border">{error}</p> : null}

        {loading ? (
          <div className="space-y-3" aria-label="Carregando reservas">
            {[0, 1].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl bg-[var(--color-surface-container-high)]" />)}
          </div>
        ) : bookings.length === 0 ? (
          <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
            <CalendarDays className="mx-auto size-8 text-[var(--color-primary-strong)]" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-extrabold">Nenhuma reserva ainda</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Suas próximas reservas de quadra aparecerão aqui.</p>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Reservas ativas">
            {bookings.map((booking, index) => {
              const quadra = quadraDaReserva(booking.quadraId);
              const pago = booking.statusPagamento === "pago";
              const pagamentoAberto = pagamentoAbertoId === booking.id;
              return (
                <article key={booking.id} className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border">
                  <div className={`relative h-[118px] overflow-hidden text-white ${index % 2 === 0 ? "bg-[var(--color-court-clay)]" : "bg-[var(--color-court-blue)]"}`}>
                    <CourtLines />
                    <span className={`absolute top-3 right-4 z-10 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${pago ? "bg-white text-[var(--color-primary-strong)]" : "bg-[var(--color-court-dark)] text-white"}`}>
                      {STATUS_LABEL[booking.statusPagamento]}
                    </span>
                    <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
                      <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">{formatarData(booking.data)} • {booking.horaInicio}</p>
                      <h2 className="mt-1 text-[21px] leading-tight font-extrabold">{quadra?.nome ?? "Quadra"}</h2>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[var(--color-surface-container)] p-3">
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)]">Horário</p>
                        <p className="mt-0.5 text-[13px] font-extrabold">{booking.horaInicio}–{booking.horaFim}</p>
                      </div>
                      <div className="rounded-2xl bg-[var(--color-surface-container)] p-3">
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)]">Esporte</p>
                        <p className="mt-0.5 truncate text-[13px] font-extrabold">{/* DEF-012 — ver `courts-list.tsx`. */}
                        {quadra?.esporte?.nome ?? "Quadra"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" disabled={cancelingId === booking.id} onClick={() => void handleCancel(booking.id)} className="h-11 rounded-2xl font-extrabold">
                        {cancelingId === booking.id ? "Cancelando..." : "Cancelar"}
                      </Button>
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
                        <span className="flex h-11 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[13px] font-extrabold text-[var(--color-primary-strong)]">Pagamento ok</span>
                      ) : temMeioDePagamento ? (
                        <Button type="button" onClick={() => setPagamentoAbertoId(pagamentoAberto ? null : booking.id)} className="h-11 rounded-2xl font-extrabold">
                          <WalletCards className="size-4" aria-hidden="true" /> Pagar agora
                        </Button>
                      ) : (
                        <span className="flex h-11 items-center justify-center rounded-2xl bg-[var(--color-surface-container)] px-2 text-center text-[12px] font-bold text-[var(--color-text-secondary)]">Combine o pagamento com o clube</span>
                      )}
                    </div>

                    {pagamentoAberto && paymentConfig ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[var(--color-surface-container)] p-3">
                        {paymentConfig.linkPagamentoUrl ? (
                          <a href={paymentConfig.linkPagamentoUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-2 text-center text-sm font-extrabold text-white">
                            <CreditCard className="size-4" aria-hidden="true" /> Abrir link de pagamento
                          </a>
                        ) : null}
                        {paymentConfig.whatsappNumero ? (
                          <a href={buildWhatsAppLink(paymentConfig.whatsappNumero)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-center text-sm font-bold text-[var(--color-text-primary)]">
                            <MessageCircle className="size-4" aria-hidden="true" /> Falar no WhatsApp
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
