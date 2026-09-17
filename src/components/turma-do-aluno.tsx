"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { CourtLines } from "@/components/court-lines";
import { TopAppBar } from "@/components/top-app-bar";
import { formatarEncontro } from "@/lib/encontros";
import {
  ApiError,
  getMinhaTurmaDoAluno,
  type TurmaDoAlunoDetalhe,
} from "@/lib/api-client";

/**
 * SPEC-057/TASK-002 (card 5352) — **a ficha da turma, do lado do aluno.**
 *
 * > *"gostaria de ver o que tem na minha turma: professor, outros alunos,
 * > nível da turma, para que possa saber detalhes da turma que fui inserido"*
 *
 * ## O que esta tela é, e o que ela não é
 *
 * **É a primeira tela do app do aluno que mostra o nome de outra pessoa.** O
 * recorte foi autorizado pelo Israel em 2026-09-16 — *"nome e nível"* —, e o
 * servidor não devolve mais que isso (INV-139, provada por conjunto exato de
 * chaves no e2e).
 *
 * **Não é um diretório de pessoas.** O nome do colega não é link, não é
 * botão, não abre nada: afordância sobre gente promete um perfil que não
 * existe — e que ninguém decidiu que deveria existir. Quem precisar falar com
 * alguém fala pelo clube.
 *
 * Endereço próprio (`/minhas-aulas/turma/[id]`) porque `/minhas-turmas/[id]`
 * **já é do professor**: um aluno que abrisse aquele endereço cairia numa
 * tela que responde 403 e mostra "não foi possível carregar a turma".
 */
export function TurmaDoAlunoView({ id }: { id: string }) {
  const [turma, setTurma] = useState<TurmaDoAlunoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    getMinhaTurmaDoAluno(id)
      .then((dados) => {
        if (atual) setTurma(dados);
      })
      .catch((e: unknown) => {
        if (!atual) return;
        // **404 é resposta, não falha.** É o que o servidor devolve para
        // turma de que ele não participa — e dizer "erro ao carregar" ali
        // mandaria a pessoa tentar de novo para sempre.
        setErro(
          e instanceof ApiError && e.status === 404
            ? "Turma não encontrada."
            : "Não foi possível carregar a turma.",
        );
      });
    return () => {
      atual = false;
    };
  }, [id]);

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <div className="flex-1 space-y-4 px-5 pb-28">
        <Link
          href="/minhas-aulas"
          className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--color-primary-strong)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>

        {erro ? (
          <p
            role="alert"
            className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
          >
            {erro}
          </p>
        ) : !turma ? (
          <div
            className="h-40 animate-pulse rounded-3xl bg-[var(--color-surface-container)]"
            aria-label="Carregando a turma"
          />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-5 text-white shadow-[var(--shadow-lift)]">
              <CourtLines className="opacity-45" />
              <div className="relative z-10">
                <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase opacity-80">
                  {turma.status === "inativa" ? "Turma inativa" : "Sua turma"}
                </p>
                <h1 className="mt-1 text-[28px] leading-[1.05] font-extrabold">
                  {turma.nome}
                </h1>

                <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  {turma.encontros.length === 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                      <CalendarDays className="size-4" aria-hidden="true" />—
                    </span>
                  ) : (
                    turma.encontros.map((encontro, indice) => (
                      <span
                        key={indice}
                        className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2"
                      >
                        <Clock className="size-4" aria-hidden="true" />
                        {formatarEncontro(encontro)}
                      </span>
                    ))
                  )}
                  <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                    <TennisCourtIcon className="size-4" aria-hidden="true" />
                    {turma.quadraNome}
                  </span>
                  {/* Sem prefixo "Nível": o nome vem do cadastro do gestor e
                      costuma já conter a palavra — na primeira empresa real o
                      nível se chama "Nivel 1". */}
                  {turma.nivelNome ? (
                    <span className="inline-flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2">
                      <Users className="size-4" aria-hidden="true" />
                      {turma.nivelNome}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
              <h2 className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-text-secondary)] uppercase">
                Professor
              </h2>
              <p className="mt-1 text-[15px] font-extrabold text-foreground">
                {turma.professorNome ?? "Sem professor definido"}
              </p>
            </section>

            <h2 className="text-lg font-extrabold">
              Quem está na turma ({turma.colegas.length}/{turma.capacidade})
            </h2>

            {turma.colegas.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Você é o primeiro. Ainda não há mais ninguém nesta turma.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {turma.colegas.map((colega, indice) => (
                  // A chave é o índice porque o servidor **não devolve id de
                  // colega**, de propósito (INV-139): um id seria uma alça
                  // para pedir outra coisa depois.
                  <li
                    key={indice}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-low)] ring-1 ring-border"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]">
                        <UserRound className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-extrabold text-foreground">
                          {colega.nome}
                        </span>
                        {colega.nivelNome ? (
                          <span className="block truncate text-[12px] font-semibold text-[var(--color-text-secondary)]">
                            {colega.nivelNome}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {colega.souEu ? (
                      <span className="shrink-0 rounded-full bg-[var(--color-secondary-container)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
                        você
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
