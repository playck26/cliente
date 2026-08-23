"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Landmark, Users } from "lucide-react";
import { TopAppBar } from "@/components/top-app-bar";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApiError,
  getMe,
  listMinhasTurmas,
  type MinhaTurma,
  type Usuario,
} from "@/lib/api-client";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/**
 * SPEC-013 — a grade do professor.
 *
 * É a tela inteira do app dele: sem quadras, sem reservas, sem valores. O
 * professor não é um aluno com permissões a mais nem um gestor com
 * permissões a menos — ele lê a própria grade e quem está nela.
 *
 * Por isso não há `BottomNav` aqui: uma barra de navegação com um item só
 * é decoração, e com os itens do aluno seria mentira, porque o servidor
 * recusa todos eles (INV-012).
 */
export function MinhasTurmasView() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [turmas, setTurmas] = useState<MinhaTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMe(), listMinhasTurmas()])
      .then(([usuarioData, turmasData]) => {
        setUsuario(usuarioData);
        setTurmas(turmasData);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar suas turmas.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar iniciais={usuario?.nome.charAt(0).toUpperCase()} />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">Minhas turmas</h1>
        {usuario ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Olá, {usuario.nome.split(" ")[0]}.
          </p>
        ) : null}

        {loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        {!loading && !error && turmas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays
                className="size-8 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <p className="font-medium">Nenhuma turma atribuída a você</p>
              {/* Estado vazio que diz o que fazer: sem isso, o professor
                  fica sem saber se o app quebrou ou se o gestor ainda não
                  o vinculou. */}
              <p className="text-sm text-[var(--color-text-secondary)]">
                Quando o gestor colocar você como professor de uma turma, ela
                aparece aqui.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <ul className="flex flex-col gap-3">
          {turmas.map((turma) => (
            <li key={turma.id}>
              <Link href={`/minhas-turmas/${turma.id}`} className="block">
                <Card className="transition-colors hover:border-[var(--color-primary)]">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="font-semibold">{turma.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {DIAS_SEMANA[turma.diaSemana] ?? "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-4" aria-hidden="true" />
                          {turma.horaInicio}–{turma.horaFim}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Landmark className="size-4" aria-hidden="true" />
                          {turma.quadraNome}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-4" aria-hidden="true" />
                          {turma.totalAlunos}/{turma.capacidade}
                        </span>
                      </span>
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-[var(--color-text-secondary)]"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
