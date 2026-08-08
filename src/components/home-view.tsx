"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-screen flex-col gap-6 bg-background p-4 pb-20">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {loading ? "Olá!" : `Olá, ${usuario?.nome.split(" ")[0] ?? ""}!`}
        </h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">Suas aulas e reservas de quadra</p>
      </div>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próxima aula</CardTitle>
            {!proximaAula ? <CardDescription>Nenhuma aula agendada</CardDescription> : null}
          </CardHeader>
          {proximaAula ? (
            <CardContent className="flex flex-col gap-2">
              <p className="text-base font-medium text-foreground">{proximaAula.turmaNome ?? "Turma"}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {formatarData(proximaAula.data)} · {proximaAula.horaInicio}–{proximaAula.horaFim} ·{" "}
                {proximaAula.quadraNome}
              </p>
            </CardContent>
          ) : (
            <CardContent>
              <Button asChild size="sm">
                <Link href="/quadras">Reservar uma quadra</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <BottomNav />
    </main>
  );
}
