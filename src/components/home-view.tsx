"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Plus, Users } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TopAppBar } from "@/components/top-app-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ApiError, getMe, listMyClasses, type MyClass, type Usuario } from "@/lib/api-client";

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// REQ-001 (SPEC-005): Home mostra nome do aluno e a próxima aula.
export function HomeView() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [proximaAula, setProximaAula] = useState<MyClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMe(), listMyClasses()])
      .then(([usuarioData, aulas]) => {
        setUsuario(usuarioData);
        setProximaAula(aulas[0] ?? null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar a home.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      <TopAppBar iniciais={usuario ? usuario.nome.charAt(0).toUpperCase() : undefined} />

      <div className="flex flex-col gap-6 px-5">
        <section>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            {loading ? "Olá!" : `Olá, ${usuario?.nome.split(" ")[0] ?? ""}!`}
          </h1>
          <p className="mt-1 text-base text-[var(--color-text-secondary)]">Suas aulas e reservas de quadra</p>
        </section>

        {error ? (
          <p role="alert" className="text-[var(--color-error)]">
            {error}
          </p>
        ) : loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : (
          <Card className="relative overflow-hidden rounded-2xl border border-border/50 p-2 shadow-[var(--shadow-elevated)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-bl-[100px] bg-[var(--color-primary)]/5"
            />
            <CardHeader className="relative">
              {proximaAula ? (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
                    <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
                      Próxima aula
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {proximaAula.turmaNome ?? "Turma"}
                  </h2>
                </>
              ) : (
                <p className="text-[var(--color-text-secondary)]">Nenhuma aula agendada</p>
              )}
            </CardHeader>
            {proximaAula ? (
              <CardContent className="relative flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-[18px]" /> {formatarData(proximaAula.data)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="size-[18px]" /> {proximaAula.horaInicio}–{proximaAula.horaFim}
                  </span>
                  <span className="flex items-center gap-2">
                    <TennisBallIcon className="size-[18px]" /> {proximaAula.quadraNome}
                  </span>
                </div>
                <Button asChild className="h-[52px] w-full text-base font-semibold sm:w-auto">
                  <Link href="/minhas-aulas">Ver Detalhes</Link>
                </Button>
              </CardContent>
            ) : (
              <CardContent className="relative">
                <Button asChild className="h-[52px] w-full text-base font-semibold sm:w-auto">
                  <Link href="/quadras">Reservar uma quadra</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        <section className="grid grid-cols-2 gap-4">
          <Link
            href="/quadras"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface p-4 shadow-[var(--shadow-low)] transition-colors hover:bg-[var(--color-surface-container)]"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]">
              <Plus className="size-5" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Nova Reserva</span>
          </Link>
          <Link
            href="/minhas-aulas"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface p-4 shadow-[var(--shadow-low)] transition-colors hover:bg-[var(--color-surface-container)]"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-text-primary)]">
              <Users className="size-5" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Minhas Turmas</span>
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
