"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronRight, Users } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { BottomNav } from "@/components/bottom-nav";
import { CourtLines } from "@/components/court-lines";
import { TopAppBar } from "@/components/top-app-bar";
import {
  encontroPrincipal,
  formatarEncontro,
  nomeDoDia,
} from "@/lib/encontros";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApiError,
  getMe,
  getMediaDaTurma,
  listMinhasTurmas,
  type MediaDaTurma,
  type MinhaTurma,
  type Usuario,
} from "@/lib/api-client";
import { NotaDaTurma } from "@/components/nota-da-turma";

/**
 * SPEC-013 — a grade do professor.
 *
 * É a tela inteira do app dele: sem quadras, sem reservas, sem valores. O
 * professor não é um aluno com permissões a mais nem um gestor com
 * permissões a menos — ele lê a própria grade e quem está nela.
 *
 * **Esta tela não tinha `BottomNav`, e o motivo era bom:** uma barra com um
 * item só é decoração, e com os itens do aluno seria mentira, porque o
 * servidor recusa todos eles (INV-012).
 *
 * **O DEF-011 mostrou que o raciocínio estava certo e o alcance errado.** A
 * decisão morava neste comentário, então `perfil-view` — a única tela que
 * aluno e professor dividem — não a conhecia, renderizava a barra do aluno,
 * e o professor ficava preso lá sem caminho de volta para cá.
 *
 * Agora `BottomNav` conhece o papel e dá ao professor **dois** itens, os
 * dois reais: esta tela e o perfil. E ela entra aqui: não renderizá-la
 * manteria metade do defeito — ele chegaria ao perfil e não voltaria.
 */
/**
 * SPEC-026 — `abas` é a barra de abas do professor, injetada de fora.
 *
 * A alternativa era extrair a moldura desta tela para o componente de abas,
 * como foi feito em `courts-list`/`my-bookings-list` na SPEC-022. **Aqui não
 * compensa:** lá as duas telas eram finas e a fusão era estrutural; esta tem
 * moldura própria, funciona, e mexer nela para ganhar simetria seria trocar
 * risco por estética.
 */
export function MinhasTurmasView({ abas }: { abas?: React.ReactNode } = {}) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [turmas, setTurmas] = useState<MinhaTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * As médias, buscadas em paralelo DEPOIS da grade — a nota é informação
   * secundária, e segurar a tela esperando por ela faria o professor esperar
   * mais para ver o que veio ver.
   */
  const [medias, setMedias] = useState<Record<string, MediaDaTurma>>({});

  useEffect(() => {
    Promise.all([getMe(), listMinhasTurmas()])
      .then(([usuarioData, turmasData]) => {
        setUsuario(usuarioData);
        setTurmas(turmasData);
        // Cada uma por sua conta: a falha de uma média não pode derrubar a
        // grade. Mesmo padrão de `turmas-do-clube`.
        for (const t of turmasData) {
          void getMediaDaTurma(t.id)
            .then((m) => setMedias((atual) => ({ ...atual, [t.id]: m })))
            .catch(() => undefined);
        }
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
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar saudacao={usuario?.nome.split(" ")[0]} />

      {/* `pb-28` abre espaço para a barra fixa não cobrir a última turma. */}
      <main className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-28">
        {abas}
        <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]">
          <CourtLines className="opacity-35" />
          <div className="relative z-10 flex min-h-40 flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-white/65 uppercase">
                  Painel do professor
                </p>
                <h1 className="mt-2 text-3xl leading-tight font-extrabold">
                  Minhas turmas
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  Sua agenda de aulas em um só lugar.
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[var(--color-court-dark)] shadow-lg">
                <CalendarCheck className="size-6" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-end justify-between border-t border-white/20 pt-4">
              <div>
                <p className="text-3xl font-extrabold">
                  {loading ? "—" : turmas.length}
                </p>
                <p className="text-xs font-semibold text-white/65">
                  turmas atribuídas
                </p>
              </div>
              <p className="max-w-32 text-right text-xs leading-relaxed text-white/60">
                Toque em uma turma para ver alunos e chamadas.
              </p>
            </div>
          </div>
        </section>

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

        {!loading && !error && turmas.length > 0 ? (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Sua grade</h2>
            <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              Semanal
            </span>
          </div>
        ) : null}

        <ul className="flex flex-col gap-3">
          {turmas.map((turma) => {
            const principal = encontroPrincipal(turma.encontros);
            return (
              <li key={turma.id}>
                <Link href={`/minhas-turmas/${turma.id}`} className="block">
                  <Card className="border-0 shadow-[var(--shadow-low)] ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-[var(--color-primary)]">
                    <CardContent className="flex items-center gap-3 py-4">
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-[var(--color-primary-strong)]">
                        {/*
                        SPEC-019 — o quadradinho cabe UM encontro, e mostra o
                        primeiro (a lista vem ordenada do servidor). O "+N"
                        avisa que há mais sem tentar espremer os outros aqui:
                        a lista completa está no texto ao lado.
                      */}
                        <span className="text-[10px] font-bold uppercase">
                          {principal === null
                            ? "—"
                            : nomeDoDia(principal.diaSemana).slice(0, 3)}
                        </span>
                        <span className="text-sm font-extrabold">
                          {principal === null
                            ? "—"
                            : `${principal.horaInicio.slice(0, 2)}h`}
                        </span>
                        {turma.encontros.length > 1 ? (
                          <span className="text-[9px] font-bold opacity-70">
                            +{turma.encontros.length - 1}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="truncate text-base font-extrabold">
                          {turma.nome}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                          {/*
                          Um item por encontro. Concatenar numa string só
                          ficaria ilegível numa turma de três dias, e é a
                          informação que o professor mais usa aqui.
                        */}
                          {turma.encontros.map((encontro, indice) => (
                            <span
                              key={indice}
                              className="inline-flex items-center gap-1"
                            >
                              <CalendarDays
                                className="size-4"
                                aria-hidden="true"
                              />
                              {formatarEncontro(encontro)}
                            </span>
                          ))}
                          <span className="inline-flex items-center gap-1">
                            <TennisCourtIcon
                              className="size-4"
                              aria-hidden="true"
                            />
                            {turma.quadraNome}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-4" aria-hidden="true" />
                            {turma.totalAlunos}/{turma.capacidade}
                          </span>
                        </span>
                        {/*
                          Pedido do Israel (2026-08-30): "as turmas devem
                          apresentar as avaliações, se tiver".

                          O professor vê a MÉDIA, e só ela — sem autoria e sem
                          comentário (INV-025a). Quem escreveu o quê é do
                          painel admin, e essa decisão não muda por ele ser o
                          professor da turma: justamente por ser, saber quem
                          deu nota baixa mudaria a relação com o aluno.

                          Buscadas fora da lista, uma por turma, e a falha de
                          uma não derruba a grade — que é o que ele veio ver.
                        */}
                        <NotaDaTurma media={medias[turma.id]} />
                      </div>
                      <ChevronRight
                        className="size-5 shrink-0 text-[var(--color-primary-strong)]"
                        aria-hidden="true"
                      />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>

      {/*
        DEF-011 — sem isto o professor chega ao perfil e não volta. O papel
        vem do `getMe()` que esta tela já faz.
      */}
      {/*
        `"professor"` literal, e não `usuario?.role`: esta tela é dele por
        definição — `/me/teacher/classes` é `@Roles('professor')`, e o
        servidor não deixa mais ninguém chegar aqui. Esperar o `getMe()`
        para descobrir o que a rota já garante era o que fazia a barra do
        aluno piscar no painel do professor.
      */}
      <BottomNav papel="professor" />
    </div>
  );
}
