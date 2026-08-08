"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-20">
      <h1 className="text-2xl font-semibold text-foreground">Minhas Aulas</h1>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : aulas.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhuma aula agendada.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {aulas.map((aula) => (
            <Card key={aula.ocupacaoId}>
              <CardHeader>
                <CardTitle className="text-base">{aula.turmaNome ?? "Turma"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {formatarData(aula.data)} · {aula.horaInicio}–{aula.horaFim} · {aula.quadraNome}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
