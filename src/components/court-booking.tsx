"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, MessageCircle } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ApiError,
  createBooking,
  getAvailability,
  getPublicPaymentConfig,
  listCourts,
  type Availability,
  type AvailabilitySlot,
  type Court,
  type PublicPaymentConfig,
} from "@/lib/api-client";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const DIAS_SEMANA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDeOffset(diasAPartirDeHoje: number): string {
  const data = new Date();
  data.setDate(data.getDate() + diasAPartirDeHoje);
  return data.toISOString().slice(0, 10);
}

// Seletor de data em chips (SPEC-007) — 30 dias a partir de hoje, rolagem
// horizontal, no lugar do <input type="date"> nativo (sem limite) do
// AS-IS. Restringe de fato o intervalo de datas selecionáveis — decisão
// de produto confirmada com o usuário após achado da validação cruzada
// (spec.md, "Decisões Necessárias", item 8), não um efeito colateral não
// percebido. Continua produzindo o mesmo formato ISO que
// `loadAvailability` sempre esperou.
const DATAS_DISPONIVEIS = Array.from({ length: 30 }, (_, i) => isoDeOffset(i));

function labelDoDia(iso: string): { dia: string; numero: string } {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return { dia: DIAS_SEMANA_CURTO[data.getUTCDay()], numero: String(dia).padStart(2, "0") };
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
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);

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
    // REQ-002 (SPEC-006): meio de pagamento é exibido na confirmação de
    // reserva — falha em buscar não deve travar o fluxo de reserva em si,
    // por isso sem tratamento de erro dedicado (some da tela se faltar).
    getPublicPaymentConfig()
      .then(setPaymentConfig)
      .catch(() => undefined);
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
    <main className="flex min-h-screen flex-col gap-6 bg-background px-5 pt-4 pb-20">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="-ml-2 flex size-9 items-center justify-center text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-primary)]">
          {quadra?.nome ?? "Carregando..."}
        </h1>
      </div>

      {/* Seletor de data em chips (SPEC-007) */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {DATAS_DISPONIVEIS.map((iso) => {
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
              className={`flex h-[72px] min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
                selecionado
                  ? "scale-105 bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-elevated)]"
                  : "bg-[var(--color-surface-container)] text-[var(--color-text-primary)] shadow-[var(--shadow-low)]"
              }`}
            >
              <span
                className={`text-[11px] font-semibold tracking-wide uppercase ${selecionado ? "text-white" : "text-[var(--color-text-secondary)]"}`}
              >
                {dia}
              </span>
              <span className="text-lg font-semibold">{numero}</span>
            </button>
          );
        })}
      </div>

      {!bookingOk ? (
        <Card className="relative overflow-hidden rounded-2xl p-2 shadow-[var(--shadow-low)]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Horários</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Toque num horário livre para reservar</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {availError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {availError}
              </p>
            ) : availLoading ? (
              <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
            ) : availability?.estado === "fechado" ? (
              /* SPEC-010/AC-008: "fechado" e "sem horário livre" produzem a
                 mesma lista vazia — sem este caso, o aluno veria uma tela
                 em branco e acharia que o app quebrou. */
              <p className="rounded-lg bg-[var(--color-surface-variant)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
                A quadra não abre neste dia. Escolha outra data.
              </p>
            ) : availability ? (
              <div className="grid grid-cols-2 gap-3">
                {availability.slots.map((slot) => {
                  const livre = slot.status === "livre";
                  const selecionado = selectedSlot?.slot === slot.slot;
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      disabled={!livre}
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                        !livre
                          ? "cursor-not-allowed border-transparent bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)] opacity-70"
                          : selecionado
                            ? "border-transparent bg-[var(--color-primary-container)] text-[var(--color-primary)]"
                            : "border-[var(--color-primary-container)] bg-surface text-[var(--color-primary)] hover:bg-[var(--color-surface-container)]"
                      }`}
                    >
                      {slot.slot.replace("-", " - ")}
                      <span className="text-xs font-medium">
                        {slot.status === "livre" ? "Livre" : slot.status === "ocupado_turma" ? "Turma" : "Reservado"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {selectedSlot ? (
              <div className="flex flex-col gap-3">
                {bookingError ? (
                  <p role="alert" className="text-sm text-[var(--color-error)]">
                    {bookingError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  disabled={bookingLoading}
                  onClick={() => void handleConfirmar()}
                  className="h-[52px] gap-2 text-base font-semibold"
                >
                  {bookingLoading ? "Reservando..." : "Confirmar reserva"}
                  {!bookingLoading ? <ArrowRight className="size-4" /> : null}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-t-4 border-[var(--color-primary)] p-6 text-center shadow-[var(--shadow-elevated)]">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-[var(--color-primary-container)]">
            <CheckCircle2 className="size-8 text-[var(--color-primary)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-primary)]">Reserva confirmada!</h2>
          <p className="mt-1 mb-6 text-sm text-[var(--color-text-secondary)]">
            Sua quadra foi reservada com sucesso.
          </p>

          {paymentConfig?.linkPagamentoUrl || paymentConfig?.whatsappNumero ? (
            <div className="mb-6 rounded-xl bg-[var(--color-surface-container)] p-4 text-left">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">
                Para pagar:
              </h3>
              <div className="flex flex-col gap-2">
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
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/reservas")}
            className="h-[52px] w-full border-[var(--color-primary)] text-[var(--color-primary)]"
          >
            Ver minhas reservas
          </Button>
        </Card>
      )}

      <BottomNav />
    </main>
  );
}
