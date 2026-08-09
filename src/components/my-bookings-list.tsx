"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, MessageCircle } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Booking["statusPagamento"], string> = {
  pendente_pagamento: "Pagamento pendente",
  pago: "Pago",
  cancelado: "Cancelada",
};

// REQ-004/005 (SPEC-005): aluno vê e cancela as próprias reservas avulsas
// de quadra (CON-005.5/006, escopadas ao próprio aluno_id pelo backend).
export function MyBookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  // REQ-005 (SPEC-007): "Pagar Agora" expande as mesmas opções de
  // pagamento já mostradas na confirmação de reserva (link/WhatsApp),
  // em vez de escolher uma das duas arbitrariamente.
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
    // REQ-005 (SPEC-007): falha em buscar não deve travar a listagem —
    // mesmo padrão de tolerância já usado na confirmação de reserva.
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
      setError(err instanceof ApiError ? err.message : "Não foi possível cancelar a reserva.");
    } finally {
      setCancelingId(null);
    }
  }

  function nomeQuadra(quadraId: string): string {
    return courts.find((c) => c.id === quadraId)?.nome ?? "Quadra";
  }

  const temMeioDePagamento = Boolean(paymentConfig?.linkPagamentoUrl || paymentConfig?.whatsappNumero);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background px-5 pt-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Minhas Reservas</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Gerencie seus horários de jogo e pagamentos.</p>
      </div>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : bookings.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhuma reserva de quadra ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => {
            const pago = booking.statusPagamento === "pago";
            const pagamentoAberto = pagamentoAbertoId === booking.id;
            return (
              <Card key={booking.id} className="rounded-xl p-2 shadow-[var(--shadow-low)]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-[var(--color-primary)]">
                      {nomeQuadra(booking.quadraId)}
                    </h2>
                    <span
                      className={`flex h-6 shrink-0 items-center rounded-full px-3 text-xs font-semibold ${
                        pago
                          ? "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
                          : "bg-[#fdf6b2] text-[var(--color-warning)]"
                      }`}
                    >
                      {STATUS_LABEL[booking.statusPagamento]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                    <CalendarDays className="size-4" />
                    {formatarData(booking.data)} · {booking.horaInicio}–{booking.horaFim}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <hr className="border-border" />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={cancelingId === booking.id}
                      onClick={() => void handleCancel(booking.id)}
                    >
                      {cancelingId === booking.id ? "Cancelando..." : "Cancelar"}
                    </Button>
                    {!pago && temMeioDePagamento ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setPagamentoAbertoId(pagamentoAberto ? null : booking.id)}
                      >
                        Pagar Agora
                      </Button>
                    ) : null}
                  </div>

                  {pagamentoAberto && paymentConfig ? (
                    <div className="flex flex-col gap-2 rounded-lg bg-[var(--color-surface-container)] p-3">
                      {paymentConfig.linkPagamentoUrl ? (
                        <a
                          href={paymentConfig.linkPagamentoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-center text-sm font-semibold text-white"
                        >
                          <CreditCard className="size-4" /> Abrir link de pagamento
                        </a>
                      ) : null}
                      {paymentConfig.whatsappNumero ? (
                        <a
                          href={buildWhatsAppLink(paymentConfig.whatsappNumero)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-[var(--color-text-primary)]"
                        >
                          <MessageCircle className="size-4" /> Falar no WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
