"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Landmark, UserRound, Users } from "lucide-react";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopAppBar } from "@/components/top-app-bar";
import Link from "next/link";
import {
  ApiError,
  getMinhaTurma,
  listOcorrencias,
  type MinhaTurmaDetalhe,
  type Ocorrencia,
} from "@/lib/api-client";

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

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
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
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
    // Falha aqui não derruba a tela: a lista de alunos continua útil sem as
    // ocorrências, e a chamada é a parte que pode esperar um retry.
    listOcorrencias(id).then(setOcorrencias).catch(() => setOcorrencias([]));
  }, [id]);

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-5 px-4 pt-1 pb-8">
        <Button
          type="button"
          variant="ghost"
          className="self-start gap-2 px-0 text-[var(--color-primary-strong)]"
          onClick={() => router.push("/minhas-turmas")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Minhas turmas
        </Button>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        {turma ? (
          <>
            <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-primary-strong)] p-5 text-white shadow-[var(--shadow-elevated)]">
              <CourtLines className="opacity-30" />
              <div className="relative z-10">
                <p className="text-xs font-bold tracking-[0.14em] text-white/65 uppercase">Turma ativa</p>
                <h1 className="mt-2 text-3xl leading-tight font-extrabold">{turma.nome}</h1>
                <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {DIAS_SEMANA[turma.diaSemana] ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                  <Clock className="size-4" aria-hidden="true" />
                  {turma.horaInicio}–{turma.horaFim}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                  <Landmark className="size-4" aria-hidden="true" />
                  {turma.quadraNome}
                  </span>
                {/* Sem prefixo "Nível": o nome vem do cadastro do gestor e
                    costuma já conter a palavra — na primeira empresa real o
                    nível se chama "Nivel 1", e a tela mostrava "Nível Nivel
                    1". Rótulo que a gente inventa em cima de texto do
                    usuário duplica no primeiro dado de verdade. */}
                {turma.nivelNome ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                    <Users className="size-4" aria-hidden="true" />
                    {turma.nivelNome}
                  </span>
                ) : null}
                </div>
              </div>
            </section>

            {ocorrencias.length > 0 ? (
              <>
                <h2 className="text-lg font-extrabold">Aulas e chamadas</h2>
                <ul className="flex flex-col gap-2">
                  {ocorrencias.map((o) => {
                    const conteudo = (
                      <Card
                        className={
                          o.podeLancar
                            ? "border-0 shadow-[var(--shadow-low)] ring-1 ring-border transition-colors hover:ring-[var(--color-primary)]"
                            : "border-0 opacity-60 ring-1 ring-border"
                        }
                      >
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <span className="flex items-center gap-3 font-bold"><span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-surface-container)]"><CalendarDays className="size-4" /></span>{dataBR(o.data)}</span>
                          <span className={`text-xs font-semibold ${o.podeLancar ? "text-[var(--color-primary-strong)]" : "text-[var(--color-text-secondary)]"}`}>
                            {o.cancelada
                              ? "aula cancelada"
                              : o.chamadaFeita
                                ? `chamada feita · ${o.marcados}/${o.totalAlunos}`
                                : o.podeLancar
                                  ? "fazer chamada"
                                  : "ainda não aconteceu"}
                          </span>
                        </CardContent>
                      </Card>
                    );

                    // INV-017 decide no servidor; aqui a tela só não oferece
                    // o que seria recusado. Oferecer e depois recusar com
                    // 422 seria pior: a pessoa tocaria, esperaria e levaria
                    // um erro por algo que dava para saber antes.
                    return (
                      <li key={o.ocupacaoId}>
                        {o.podeLancar ? (
                          <Link href={`/chamada/${o.ocupacaoId}`} className="block">
                            {conteudo}
                          </Link>
                        ) : (
                          conteudo
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            <h2 className="text-lg font-extrabold">
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
                    <Card className="border-0 shadow-[var(--shadow-low)] ring-1 ring-border">
                      <CardContent className="flex items-center justify-between py-3">
                        <span className="flex items-center gap-3 font-semibold"><span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]"><UserRound className="size-4" /></span>{aluno.nome}</span>
                        {aluno.nivelNome ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            <CheckCircle2 className="size-3.5 text-[var(--color-primary)]" />
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
