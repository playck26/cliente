"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  createBooking,
  getAvailability,
  listCourts,
  type Availability,
  type AvailabilitySlot,
  type Court,
} from "@/lib/api-client";

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// REQ-005 (SPEC-005): grade de disponibilidade + reserva. Alvo de toque
// ~44px (NFR-001, DESIGN.md) — botões da grade usam min-h-11.
export function CourtBooking({ id }: { id: string }) {
  const router = useRouter();
  const [quadra, setQuadra] = useState<Court | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [data, setData] = useState(hojeIso());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingOk, setBookingOk] = useState(false);

  useEffect(() => {
    listCourts()
      .then((result) => {
        const encontrada = result.data.find((q) => q.id === id);
        if (!encontrada) {
          setLoadError("Quadra não encontrada.");
          return;
        }
        setQuadra(encontrada);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a quadra.");
      });
  }, [id]);

  async function loadAvailability(targetData: string) {
    setAvailLoading(true);
    setAvailError(null);
    setSelectedSlot(null);
    setBookingOk(false);
    try {
      const result = await getAvailability(id, targetData);
      setAvailability(result);
    } catch (err) {
      setAvailError(err instanceof ApiError ? err.message : "Não foi possível carregar a disponibilidade.");
    } finally {
      setAvailLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAvailability(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConfirmar() {
    if (!selectedSlot) return;
    setBookingError(null);
    setBookingLoading(true);
    try {
      const [horaInicio, horaFim] = selectedSlot.slot.split("-");
      await createBooking({ quadraId: id, data, horaInicio, horaFim });
      setBookingOk(true);
      await loadAvailability(data);
    } catch (err) {
      setBookingError(
        err instanceof ApiError ? err.message : "Não foi possível reservar — tente outro horário.",
      );
    } finally {
      setBookingLoading(false);
    }
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-20">
        <p role="alert" className="text-[var(--color-error)]">
          {loadError}
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-20">
      <h1 className="text-2xl font-semibold text-foreground">{quadra?.nome ?? "Carregando..."}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Disponibilidade</CardTitle>
          <CardDescription>Toque num horário livre para reservar</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                void loadAvailability(e.target.value);
              }}
            />
          </div>

          {availError ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {availError}
            </p>
          ) : availLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
          ) : availability ? (
            <div className="grid grid-cols-2 gap-2">
              {availability.slots.map((slot) => (
                <button
                  key={slot.slot}
                  type="button"
                  disabled={slot.status !== "livre"}
                  onClick={() => setSelectedSlot(slot)}
                  className={`min-h-11 rounded-[var(--radius)] border px-3 py-2 text-sm ${
                    slot.status === "livre"
                      ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "cursor-not-allowed border-border bg-muted text-[var(--color-text-secondary)]"
                  } ${selectedSlot?.slot === slot.slot ? "bg-[var(--color-primary)] text-white" : ""}`}
                >
                  {slot.slot}
                  <br />
                  <span className="text-xs">
                    {slot.status === "livre" ? "Livre" : slot.status === "ocupado_turma" ? "Turma" : "Reservado"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedSlot ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
              <p className="text-sm font-medium text-foreground">Reservar {selectedSlot.slot}</p>
              {bookingError ? (
                <p role="alert" className="text-sm text-[var(--color-error)]">
                  {bookingError}
                </p>
              ) : null}
              <Button type="button" disabled={bookingLoading} onClick={() => void handleConfirmar()}>
                {bookingLoading ? "Reservando..." : "Confirmar reserva"}
              </Button>
            </div>
          ) : null}

          {bookingOk ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-primary)] p-4">
              <p className="text-sm font-medium text-foreground">Reserva confirmada!</p>
              <Button type="button" variant="outline" size="sm" onClick={() => router.push("/reservas")}>
                Ver minhas reservas
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <BottomNav />
    </main>
  );
}
