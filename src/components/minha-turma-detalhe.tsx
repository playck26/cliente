"use client";

import { useEffect, useState } from "react";
import { Paginacao } from "@/components/paginacao";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  UserRound,
  Users,
} from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopAppBar } from "@/components/top-app-bar";
import { formatarEncontro } from "@/lib/encontros";
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
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [tamanho, setTamanho] = useState(20);
  const [ocorrenciasCarregando, setOcorrenciasCarregando] = useState(true);

  const trocarPagina = (nova: number) => {
    setOcorrenciasCarregando(true);
    setPagina(nova);
  };

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

  /**
   * SPEC-027 — as ocorrências viraram lista paginada.
   *
   * Era a lista mais longa do painel do professor: uma turma de 3x por semana
   * enche 38 linhas na janela padrão de 30 dias, e ele rolava tudo para achar
   * a aula de ontem.
   *
   * Efeito separado do da turma **de propósito**: trocar de página não deve
   * rebuscar a turma nem piscar o cabeçalho.
   */
  useEffect(() => {
    // Falha aqui não derruba a tela: a lista de alunos continua útil sem as
    // ocorrências, e a chamada é a parte que pode esperar um retry.
    //
    // Sem `setState` síncrono aqui: quem marca "carregando" é `trocarPagina`,
    // no evento, que é onde a decisão acontece. A regra
    // `react-hooks/set-state-in-effect` está certa, e desligá-la seria trocar
    // um aviso legítimo por conveniência — foi o que a SPEC-026 já decidiu na
    // agenda do professor.
    listOcorrencias(id, 30, pagina)
      .then((r) => {
        setOcorrencias(r.data);
        setTotal(r.total);
        setTamanho(r.pageSize);
      })
      .catch(() => setOcorrencias([]))
      .finally(() => setOcorrenciasCarregando(false));
  }, [id, pagina]);

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
                <p className="text-xs font-bold tracking-[0.14em] text-white/65 uppercase">
                  Turma ativa
                </p>
                <h1 className="mt-2 text-3xl leading-tight font-extrabold">
                  {turma.nome}
                </h1>
                <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  {/*
                    **SPEC-019 — esta tela foi o BLOQUEADOR 1 da validação
                    cruzada.** A 1ª versão da spec listava só a rota de LISTA
                    do professor no contrato e esquecia o detalhe. A lista
                    seria atualizada e aqui continuaria esperando
                    `diaSemana`/`horaInicio`/`horaFim` — tela branca no app
                    do professor, exatamente o DEF-012.

                    Antes eram dois chips fixos (dia | horário). Agora é um
                    chip POR encontro, com dia e horário juntos: separá-los
                    numa turma de três dias produziria "Terça, Quinta, Sábado"
                    de um lado e três horários do outro, e ninguém saberia
                    qual hora é de qual dia.
                  */}
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
                          <span className="flex items-center gap-3 font-bold">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                              <CalendarDays className="size-4" />
                            </span>
                            {dataBR(o.data)}
                          </span>
                          <span
                            className={`text-xs font-semibold ${o.podeLancar ? "text-[var(--color-primary-strong)]" : "text-[var(--color-text-secondary)]"}`}
                          >
                            {/* SPEC-030 — `nao_houve` vem ANTES de
                                `chamadaFeita`, e tem que vir: uma aula não
                                realizada tem cabeçalho e zero presenças,
                                então cairia em "chamada feita · 0/5" — a
                                contagem sugeriria que o professor lançou uma
                                chamada vazia, que é o oposto do que houve. */}
                            {o.cancelada
                              ? "aula cancelada"
                              : o.estado === "nao_houve"
                                ? "aula não realizada"
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
                          <Link
                            href={`/chamada/${o.ocupacaoId}`}
                            className="block"
                          >
                            {conteudo}
                          </Link>
                        ) : (
                          conteudo
                        )}
                      </li>
                    );
                  })}
                </ul>

                <Paginacao
                  page={pagina}
                  pageSize={tamanho}
                  total={total}
                  ocupado={ocorrenciasCarregando}
                  onMudar={trocarPagina}
                  rotulo="aulas e chamadas"
                />
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
                        <span className="flex items-center gap-3 font-semibold">
                          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]">
                            <UserRound className="size-4" />
                          </span>
                          {aluno.nome}
                        </span>
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
