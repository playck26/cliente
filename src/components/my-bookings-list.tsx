"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, cancelBooking, listCourts, listMyBookings, type Booking, type Court } from "@/lib/api-client";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

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

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-20">
      <h1 className="text-2xl font-semibold text-foreground">Minhas Reservas</h1>

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
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{nomeQuadra(booking.quadraId)}</CardTitle>
                  <Badge variant={booking.statusPagamento === "pago" ? "default" : "secondary"}>
                    {STATUS_LABEL[booking.statusPagamento]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {formatarData(booking.data)} · {booking.horaInicio}–{booking.horaFim}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancelingId === booking.id}
                  onClick={() => void handleCancel(booking.id)}
                >
                  {cancelingId === booking.id ? "Cancelando..." : "Cancelar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
