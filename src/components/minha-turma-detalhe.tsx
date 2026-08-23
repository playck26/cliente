"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Landmark, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopAppBar } from "@/components/top-app-bar";
import {
  ApiError,
  getMinhaTurma,
  type MinhaTurmaDetalhe,
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
 * SPEC-013/AC-008 — quem está na quadra, e só isso.
 *
 * Sem telefone, sem e-mail, sem situação de pagamento. O servidor também
 * não devolve: se um dia alguém precisar do contato do aluno aqui, vai
 * precisar mudar o endpoint, e essa é exatamente a conversa que deve
 * acontecer antes — não depois.
 *
 * Turma de colega responde 404, não 403, e a tela trata como "não
 * encontrada": 403 confirmaria que ela existe.
 */
export function MinhaTurmaDetalheView({ id }: { id: string }) {
  const router = useRouter();
  const [turma, setTurma] = useState<MinhaTurmaDetalhe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMinhaTurma(id)
      .then(setTurma)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? "Turma não encontrada."
            : "Não foi possível carregar a turma.",
        );
      });
  }, [id]);

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <Button
          type="button"
          variant="ghost"
          className="self-start gap-2 px-0"
          onClick={() => router.push("/minhas-turmas")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Minhas turmas
        </Button>

        <h1 className="text-2xl font-bold">{turma?.nome ?? "Turma"}</h1>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        {turma ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-2 py-4 text-sm text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {DIAS_SEMANA[turma.diaSemana] ?? "—"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="size-4" aria-hidden="true" />
                  {turma.horaInicio}–{turma.horaFim}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Landmark className="size-4" aria-hidden="true" />
                  {turma.quadraNome}
                </span>
                {/* Sem prefixo "Nível": o nome vem do cadastro do gestor e
                    costuma já conter a palavra — na primeira empresa real o
                    nível se chama "Nivel 1", e a tela mostrava "Nível Nivel
                    1". Rótulo que a gente inventa em cima de texto do
                    usuário duplica no primeiro dado de verdade. */}
                {turma.nivelNome ? (
                  <span className="inline-flex items-center gap-2">
                    <Users className="size-4" aria-hidden="true" />
                    {turma.nivelNome}
                  </span>
                ) : null}
              </CardContent>
            </Card>

            <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-text-secondary)]">
              Alunos ({turma.alunos.length}/{turma.capacidade})
            </h2>

            {turma.alunos.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Nenhum aluno nesta turma ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {turma.alunos.map((aluno) => (
                  <li key={aluno.id}>
                    <Card>
                      <CardContent className="flex items-center justify-between py-3">
                        <span className="font-medium">{aluno.nome}</span>
                        {aluno.nivelNome ? (
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {aluno.nivelNome}
                          </span>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
