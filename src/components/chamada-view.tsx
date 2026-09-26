"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellOff, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourtLines } from "@/components/court-lines";
import { TopAppBar } from "@/components/top-app-bar";
import {
  ApiError,
  desfazerNaoHouveAula,
  getChamada,
  registrarNaoHouveAula,
  type Chamada,
} from "@/lib/api-client";
import { isoDeOffsetNoClube } from "@/lib/fuso";

/**
 * SPEC-076/D1 — o que o servidor tem gravado para cada aluno, em texto.
 *
 * `justificado` não é mais gravado por ninguém; aparece só em registro antigo.
 */
const ROTULO: Record<string, string> = {
  presente: "Veio",
  ausente: "Faltou",
  justificado: "Justificou (registro antigo)",
};

/**
 * SPEC-030/D5 — o servidor recusa `nao_houve` em aula de data anterior a hoje
 * menos estes dias (`AULA_ANTIGA`). O espelho do `JANELA_RETROATIVA_DIAS` do
 * back, para a tela não oferecer o que seria recusado (AC-018).
 */
const JANELA_RETROATIVA_DIAS = 7;

/** `2026-09-25T17:00:00.000Z` → `25/09 às 14:00`, no relógio de quem lê. */
function formatarPrazo(iso: string): string {
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/**
 * SPEC-076/D1 — de onde veio o que está na tela. Uma frase por situação, e
 * nenhuma manda "marcar e salvar": ninguém grava presença à mão.
 */
function origemDoRegistro(chamada: Chamada): string {
  if (chamada.completude === "nao_houve") return "Aula não realizada.";
  if (chamada.origem === "automatica") {
    return "Fechada automaticamente — quem avisou falta pelo app aparece como Faltou.";
  }
  if (chamada.completude !== null) {
    return "Registro humano anterior à automação.";
  }
  // Sem cabeçalho. `estado` vem do Back da SPEC-076; o antigo não o manda, e
  // para ele a aula passada sem chamada é sempre `pendente` (D12).
  const estado: string | undefined = chamada.estado;
  if (estado === "sem_registro") return "Sem registro de presença.";
  if (estado === "sem_participantes") {
    return "Nenhum aluno participava desta aula — não há chamada a fechar.";
  }
  if (estado === "futura" || estado === "em_andamento") {
    return "A aula ainda não terminou — a chamada é fechada automaticamente depois do fim.";
  }
  return "Aguardando o fechamento automático.";
}

/**
 * SPEC-014 → SPEC-076 — **a chamada, só leitura.**
 *
 * Até a SPEC-076 esta tela era o lugar de marcar Veio/Faltou e salvar. O
 * Israel decidiu (decisões 1 e 9) que ninguém grava presença à mão: o
 * fechamento automático grava, e quem avisou falta pelo app vira "Faltou"
 * (D2). O servidor tirou a rota (D1) — oferecer os botões aqui seria ensinar
 * pelo erro.
 *
 * Ficam as duas ações que continuam existindo, cada uma só onde o servidor
 * aceitaria: "A aula não aconteceu" e o "Desfazer" dela (D3).
 */
export function ChamadaView({ ocupacaoId }: { ocupacaoId: string }) {
  const router = useRouter();
  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * SPEC-030 / achado 4 da 4ª validação cruzada — a escrita gravou, mas a
   * releitura não voltou. A tela não sabe o estado novo e **sabe que não
   * sabe**: some com as ações em vez de oferecê-las de novo sobre uma escrita
   * que já aconteceu.
   */
  const [releituraFalhou, setReleituraFalhou] = useState(false);
  /**
   * SPEC-057/TASK-001/D5 — o relógio dos prazos é o da abertura da tela, e não
   * o de cada render: render tem de ser puro. Tela aberta que atravessa o
   * prazo descobre pelo `422 AULA_ANTIGA` do servidor, que é o portão.
   */
  const [abertaEm] = useState(() => Date.now());

  useEffect(() => {
    getChamada(ocupacaoId)
      .then(setChamada)
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError && err.status === 404
            ? "Aula não encontrada."
            : "Não foi possível carregar a chamada.",
        );
      });
  }, [ocupacaoId]);

  /**
   * A escrita e a releitura em dois `try`: a releitura que falha não pode
   * dizer que a escrita falhou (achado 4 da 4ª validação cruzada da SPEC-030)
   * — um erro que nega uma escrita confirmada manda a pessoa refazê-la.
   */
  async function escreverERelear(
    escrever: () => Promise<unknown>,
    falhaAoEscrever: string,
    feito: string,
  ) {
    if (!chamada) return;
    setErro(null);
    setEnviando(true);
    try {
      await escrever();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : falhaAoEscrever);
      setEnviando(false);
      return;
    }
    try {
      setChamada(await getChamada(chamada.ocupacaoId));
    } catch {
      setErro(
        `${feito} Não foi possível atualizar a tela — recarregue para ver o estado atual.`,
      );
      setReleituraFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  async function naoHouveAula() {
    if (!chamada) return;
    if (
      !window.confirm(
        "Registrar que esta aula NÃO aconteceu?\n\n" +
          (chamada.origem === "automatica"
            ? "As presenças do fechamento automático serão apagadas. "
            : "") +
          "Ela não conta na frequência de ninguém.",
      )
    ) {
      return;
    }
    await escreverERelear(
      () => registrarNaoHouveAula(chamada.ocupacaoId),
      "Não foi possível registrar. Tente de novo.",
      "Registrado.",
    );
  }

  async function desfazer() {
    if (!chamada) return;
    if (
      !window.confirm(
        "Desfazer o registro de que esta aula não aconteceu?\n\n" +
          "A chamada volta ao que o fechamento automático registra.",
      )
    ) {
      return;
    }
    await escreverERelear(
      () => desfazerNaoHouveAula(chamada.ocupacaoId),
      "Não foi possível desfazer. Tente de novo.",
      "Desfeito.",
    );
  }

  const naoHouve = chamada?.completude === "nao_houve";
  const temPresencaGravada = Boolean(
    chamada?.alunos.some((a) => a.status !== null),
  );
  const estado: string | undefined = chamada?.estado;
  /**
   * SPEC-076/AC-018 — **o botão aparece só onde o servidor aceitaria.** As
   * mesmas guardas do portão (`travarEValidarOcorrencia`), na mesma ordem:
   * cancelada, aula que não começou, janela (a da automática: o fechamento +
   * 7 dias; a de qualquer outra: a data da aula + 7 dias) e presença humana
   * gravada (`CHAMADA_COM_PRESENCA`).
   */
  const dentroDaJanela = chamada
    ? chamada.origem === "automatica" && chamada.corrigivelAte
      ? new Date(chamada.corrigivelAte).getTime() > abertaEm
      : chamada.data >= isoDeOffsetNoClube(-JANELA_RETROATIVA_DIAS, new Date(abertaEm))
    : false;
  const podeDizerQueNaoHouve = Boolean(
    chamada &&
      !chamada.cancelada &&
      !naoHouve &&
      estado !== "futura" &&
      dentroDaJanela &&
      (!temPresencaGravada || chamada.origem === "automatica") &&
      !releituraFalhou,
  );
  /**
   * SPEC-076/D3 e D12 — o "Desfazer" existe **só** com o campo. O servidor o
   * manda não nulo apenas com `nao_houve` gravado e dentro do prazo; o Back
   * anterior à SPEC-076 não o manda, e aí o botão não aparece.
   */
  const desfazerAte =
    naoHouve && !releituraFalhou ? chamada?.desfazerNaoHouveAte : null;

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-5 px-4 pt-1 pb-10">
        <Button
          type="button"
          variant="ghost"
          className="self-start gap-2 px-0 text-[var(--color-primary-strong)]"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Button>

        <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-elevated)]">
          <CourtLines className="opacity-30" />
          <div className="relative z-10">
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-secondary)] uppercase">Controle de presença</p>
            <h1 className="mt-2 text-3xl font-extrabold">Chamada</h1>
            {chamada ? (
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {chamada.data.split("-").reverse().join("/")} · {chamada.horaInicio}–{chamada.horaFim}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <Users className="size-4" aria-hidden="true" />
                  {chamada.alunos.length} {chamada.alunos.length === 1 ? "aluno" : "alunos"}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {erro ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        {chamada?.cancelada ? (
          <p
            role="status"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-high)] p-3 text-sm"
          >
            <strong>Aula cancelada.</strong> O registro fica aqui, inclusive
            quem avisou que ia faltar
            {naoHouve ? " e o registro de que ela não aconteceu" : ""}.
          </p>
        ) : null}

        {chamada && !chamada.cancelada ? (
          <p
            role="status"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-high)] p-3 text-sm"
          >
            <strong>{origemDoRegistro(chamada)}</strong> A presença não é
            lançada à mão: quem avisou falta pelo app fica como Faltou.
          </p>
        ) : null}

        {podeDizerQueNaoHouve || desfazerAte ? (
          <div className="flex flex-col gap-2">
            {podeDizerQueNaoHouve ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                disabled={enviando}
                onClick={() => void naoHouveAula()}
              >
                A aula não aconteceu
              </Button>
            ) : null}
            {desfazerAte ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                disabled={enviando}
                onClick={() => void desfazer()}
              >
                Desfazer (até {formatarPrazo(desfazerAte)})
              </Button>
            ) : null}
          </div>
        ) : null}

        {chamada ? <h2 className="text-lg font-extrabold">Alunos</h2> : null}

        <ul className="flex flex-col gap-3">
          {chamada?.alunos.map((aluno) => (
            <li key={aluno.alunoId}>
              <Card className="border-0 shadow-[var(--shadow-low)] ring-1 ring-border">
                <CardContent className="flex flex-wrap items-center gap-2 py-4">
                  <span className="font-medium">{aluno.nome}</span>
                  {/* AC-010: quem saiu da turma continua no histórico, e a
                      tela diz por que ele ainda aparece aqui. */}
                  {!aluno.naTurmaHoje ? (
                    <span className="rounded-full bg-[var(--color-surface-container-high)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {aluno.reposicao ? "repondo aula" : "não está mais na turma"}
                    </span>
                  ) : null}
                  {/* SPEC-076/D1 — o aviso de falta nunca tinha aparecido
                      nesta tela (fato 10), e é ele que decide o "Faltou". */}
                  {aluno.faltaAvisada ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-container-high)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      <BellOff className="size-3" aria-hidden="true" />
                      avisou que ia faltar
                    </span>
                  ) : null}
                  <span className="ml-auto text-sm font-bold text-[var(--color-text-secondary)]">
                    {aluno.status ? ROTULO[aluno.status] ?? aluno.status : "sem registro"}
                  </span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
