"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { TopAppBar } from "@/components/top-app-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ApiError, listMyClasses, type MyClass } from "@/lib/api-client";

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

// REQ-002 (SPEC-005): aluno lista as próprias próximas aulas. View-only
// nesta rodada (GAP-008, TARGET_ARCHITECTURE.md) — uma ocupação de turma
// é compartilhada por todos os alunos matriculados, sem aluno_id próprio,
// então remarcar/cancelar uma ocorrência individual não é suportado ainda.
export function MyClassesList() {
  const [aulas, setAulas] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyClasses()
      .then(setAulas)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar suas aulas.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      <TopAppBar />

      <div className="flex flex-col gap-6 px-5 pt-2">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">Minhas Aulas</h1>

        {error ? (
          <p role="alert" className="text-[var(--color-error)]">
            {error}
          </p>
        ) : loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : aulas.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">Nenhuma aula agendada.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {aulas.map((aula) => (
              <Card
                key={aula.ocupacaoId}
                className="relative overflow-hidden rounded-2xl border border-border/50 p-2 shadow-[var(--shadow-low)]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-bl-[100px] bg-[var(--color-primary)]/5"
                />
                <CardHeader className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {aula.turmaNome ?? "Turma"}
                    </h2>
                    {/* Badge de status com texto único (SPEC-007, decisão do
                        usuário): o backend não distingue "confirmada" de
                        "agendada" — toda aula listada é a mesma coisa, o
                        badge só reforça a estética do card. */}
                    <span className="flex h-6 shrink-0 items-center rounded-full bg-[var(--color-secondary-container)] px-3 text-xs font-semibold text-[var(--color-on-secondary-container)]">
                      Agendada
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="relative flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-[18px]" /> {formatarData(aula.data)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="size-[18px]" /> {aula.horaInicio}–{aula.horaFim}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="size-[18px]" /> {aula.quadraNome}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
