"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, MessageCircle } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  createBooking,
  getAvailability,
  getPublicPaymentConfig,
  listCourts,
  type Availability,
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

const DATAS_DISPONIVEIS = Array.from({ length: 30 }, (_, i) => isoDeOffset(i));

function labelDoDia(iso: string): { dia: string; numero: string } {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return { dia: DIAS_SEMANA_CURTO[data.getUTCDay()], numero: String(dia).padStart(2, "0") };
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
  const [data, setData] = useState(hojeIso());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState<string | null>(null);
  const [slotsSelecionados, setSlotsSelecionados] = useState<string[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingOk, setBookingOk] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);

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
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a quadra.");
      });
    getPublicPaymentConfig().then(setPaymentConfig).catch(() => undefined);
  }, [id]);

  async function loadAvailability(targetData: string, manterConfirmacao = false) {
    setAvailLoading(true);
    setAvailError(null);
    setSlotsSelecionados([]);
    if (!manterConfirmacao) setBookingOk(false);
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

  function alternarSlot(rotulo: string) {
    setSlotsSelecionados((atual) => atual.includes(rotulo) ? atual.filter((slot) => slot !== rotulo) : [...atual, rotulo]);
  }

  async function handleConfirmar() {
    if (slotsSelecionados.length === 0) return;
    setBookingError(null);
    setBookingLoading(true);
    try {
      await createBooking({
        quadraId: id,
        data,
        slots: slotsSelecionados.map((rotulo) => {
          const [horaInicio, horaFim] = rotulo.split("-");
          return { horaInicio, horaFim };
        }),
      });
      await loadAvailability(data, true);
      setBookingOk(true);
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Não foi possível reservar; tente outro horário.");
    } finally {
      setBookingLoading(false);
    }
  }

  if (loadError) {
    return (
      <main className="app-screen min-h-screen bg-background px-5 py-6 pb-36">
        <button type="button" onClick={() => router.back()} className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border" aria-label="Voltar">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <p role="alert" className="mt-6 rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border">{loadError}</p>
        <BottomNav />
      </main>
    );
  }

  const total = slotsSelecionados.length * (quadra?.precoHora ?? 0);

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3 px-5 pt-4 pb-3">
        <button type="button" onClick={() => router.back()} aria-label="Voltar" className="flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">Reserva</p>
          <h1 className="truncate text-lg leading-none font-extrabold text-[var(--color-primary-strong)]">{quadra?.nome ?? "Carregando..."}</h1>
        </div>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-[var(--color-primary-strong)] shadow-[var(--shadow-low)] ring-1 ring-border" aria-hidden="true">
          <Image src="/playck-logo.png" alt="" width={36} height={36} className="size-9 object-contain" />
        </span>
      </header>

      <div className="space-y-4 px-5">
        <section className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-lift)] ring-1 ring-border">
          <div className="relative h-[128px] overflow-hidden bg-[var(--color-court-clay)] text-white">
            <CourtLines />
            <div className="absolute top-3 right-4 z-10 rounded-2xl bg-white/18 px-3 py-2 text-right backdrop-blur-sm ring-1 ring-white/15">
              <p className="text-lg leading-none font-extrabold">{(quadra?.precoHora ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</p>
              <p className="mt-1 text-[10px] font-bold text-white/75">por hora</p>
            </div>
            <div className="absolute inset-x-4 bottom-3 z-10 min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/75 uppercase">{quadra?.esporte ?? "Quadra"}</p>
              <h2 className="mt-0.5 text-[22px] leading-tight font-extrabold">{quadra?.nome ?? "Carregando..."}</h2>
            </div>
          </div>
        </section>

        {!bookingOk ? (
          <>
            <section>
              <div className="mb-3">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">Dia</p>
                <h2 className="text-xl font-extrabold">Escolha a data</h2>
              </div>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {DATAS_DISPONIVEIS.map((iso, index) => {
                  const { dia, numero } = labelDoDia(iso);
                  const selecionado = iso === data;
                  return (
                    <button key={iso} type="button" onClick={() => { setData(iso); void loadAvailability(iso); }} aria-pressed={selecionado} className={`flex h-16 w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl px-3 transition-transform active:scale-95 ${selecionado ? "bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)]" : "bg-surface text-[var(--color-text-primary)] shadow-[var(--shadow-low)] ring-1 ring-border"}`}>
                      <span className={`text-[11px] font-bold ${selecionado ? "text-white/80" : "text-[var(--color-text-secondary)]"}`}>{index === 0 ? "HOJE" : dia}</span>
                      <span className="mt-1 text-[22px] leading-none font-extrabold">{numero}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-low)] ring-1 ring-border">
              <div className="mb-3 flex items-start justify-between gap-3 px-1 pt-1">
                <div>
                  <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">Horários</p>
                  <h2 className="text-xl font-extrabold">Disponíveis</h2>
                </div>
                {availability?.estado === "aberto" ? (
                  <span className="rounded-full bg-[var(--color-secondary-container)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
                    {availability.slots.filter((slot) => slot.status === "livre").length} livres
                  </span>
                ) : null}
              </div>

              {availError ? (
                <p role="alert" className="rounded-2xl bg-[var(--color-tertiary-container)] p-4 text-sm font-semibold text-[var(--color-error)]">{availError}</p>
              ) : availLoading ? (
                <div className="grid grid-cols-3 gap-2" aria-label="Carregando horários">
                  {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-12 animate-pulse rounded-2xl bg-[var(--color-surface-container-high)]" />)}
                </div>
              ) : availability?.estado === "fechado" ? (
                <p className="rounded-2xl bg-[var(--color-surface-container)] p-4 text-center text-sm font-medium text-[var(--color-text-secondary)]">A quadra não abre neste dia. Escolha outra data.</p>
              ) : availability?.slots.length === 0 ? (
                <p className="rounded-2xl bg-[var(--color-surface-container)] p-4 text-center text-sm font-medium text-[var(--color-text-secondary)]">Não há horários cadastrados para esta data.</p>
              ) : availability ? (
                <div className="grid grid-cols-3 gap-2">
                  {availability.slots.map((slot) => {
                    const livre = slot.status === "livre";
                    const selecionado = slotsSelecionados.includes(slot.slot);
                    const [inicio] = slot.slot.split("-");
                    return (
                      <button key={slot.slot} type="button" disabled={!livre} onClick={() => alternarSlot(slot.slot)} aria-pressed={selecionado} className={`flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 text-[13px] font-extrabold transition-colors ${!livre ? "cursor-not-allowed bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)] opacity-50" : selecionado ? "bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)]" : "bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary-strong)]"}`}>
                        {inicio}
                        <span className="mt-0.5 text-[9px] font-bold opacity-75">{livre ? "Livre" : slot.status === "ocupado_turma" ? "Turma" : "Reservado"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>

            {slotsSelecionados.length > 0 ? (
              <section className="rounded-3xl bg-[var(--color-court-dark)] p-4 text-white shadow-[var(--shadow-lift)]">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-secondary)] uppercase">Resumo</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold">{formatarDataCurta(data)}</h2>
                    <p className="mt-1 text-[13px] font-semibold text-white/70">{quadra?.nome} • {slotsSelecionados.length} {slotsSelecionados.length === 1 ? "horário" : "horários"}</p>
                  </div>
                  <p className="shrink-0 text-2xl font-extrabold">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</p>
                </div>
                {bookingError ? <p role="alert" className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white">{bookingError}</p> : null}
                <Button type="button" disabled={bookingLoading} onClick={() => void handleConfirmar()} className="mt-4 h-12 w-full rounded-2xl bg-white text-[14px] font-extrabold text-[var(--color-court-dark)] hover:bg-white/90">
                  {bookingLoading ? "Reservando..." : "Confirmar reserva"}
                  {!bookingLoading ? <ArrowRight className="size-5" aria-hidden="true" /> : null}
                </Button>
              </section>
            ) : bookingError ? (
              <p role="alert" className="rounded-2xl bg-[var(--color-tertiary-container)] p-4 text-sm font-semibold text-[var(--color-error)]">{bookingError}</p>
            ) : null}
          </>
        ) : (
          <section className="rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-lift)] ring-1 ring-border">
            <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold text-[var(--color-primary-strong)]">Reserva confirmada!</h2>
            <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">Sua quadra foi reservada com sucesso.</p>

            {paymentConfig?.linkPagamentoUrl || paymentConfig?.whatsappNumero ? (
              <div className="mt-5 rounded-2xl bg-[var(--color-surface-container)] p-3 text-left">
                <p className="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">Para pagar</p>
                <div className="flex flex-col gap-2">
                  {paymentConfig.linkPagamentoUrl ? (
                    <a href={paymentConfig.linkPagamentoUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-2 text-sm font-extrabold text-white">
                      <CreditCard className="size-4" aria-hidden="true" /> Abrir link de pagamento
                    </a>
                  ) : null}
                  {paymentConfig.whatsappNumero ? (
                    <a href={buildWhatsAppLink(paymentConfig.whatsappNumero)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-bold text-[var(--color-text-primary)]">
                      <MessageCircle className="size-4" aria-hidden="true" /> Falar no WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Button type="button" onClick={() => router.push("/reservas")} className="mt-5 h-12 w-full rounded-2xl text-sm font-extrabold">Ver minhas reservas</Button>
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
