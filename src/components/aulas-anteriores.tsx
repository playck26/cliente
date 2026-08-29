"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  avaliarAula,
  listAulasAnteriores,
  type AulaAnterior,
} from "@/lib/api-client";

/**
 * SPEC-025 — **as aulas que já aconteceram, e a avaliação delas.**
 *
 * Esta tela existe porque o Israel reparou, ao usar, que não havia como
 * chegar até a aula: `GET /me/classes` devolve só o futuro. Sem ela, a
 * avaliação seria uma funcionalidade sem porta de entrada.
 *
 * **A nota é da aula; a média é da turma.** Aqui não se mostra média nenhuma
 * — a decisão dele foi explícita ("as aulas não têm média"). O que aparece é
 * a própria nota, para a pessoa reconhecer o que já avaliou.
 */

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana = DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

export function AulasAnteriores() {
  const [aulas, setAulas] = useState<AulaAnterior[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const carregar = () =>
    listAulasAnteriores()
      .then(setAulas)
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      )
      .finally(() => setCarregando(false));

  useEffect(() => {
    void carregar();
    // `carregar` fora das dependências: ela é recriada a cada render e
    // entraria em laço. Mesmo padrão das outras listas deste app.
  }, []);

  if (carregando) {
    return (
      <div className="px-5 text-[13px] font-bold text-[var(--color-text-secondary)]">
        Carregando suas aulas…
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5">
      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
        >
          {erro}
        </p>
      )}

      {aulas.length === 0 ? (
        <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
          <CalendarDays
            className="mx-auto size-8 text-[var(--color-primary-strong)]"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-lg font-extrabold">Nenhuma aula ainda</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Suas aulas passadas aparecerão aqui para você avaliar.
          </p>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Aulas anteriores">
          {aulas.map((aula) => (
            <AulaCard
              key={aula.ocupacaoId}
              aula={aula}
              aberta={abertaId === aula.ocupacaoId}
              onAbrir={() =>
                setAbertaId(
                  abertaId === aula.ocupacaoId ? null : aula.ocupacaoId,
                )
              }
              onAvaliada={() => {
                setAbertaId(null);
                void carregar();
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function AulaCard({
  aula,
  aberta,
  onAbrir,
  onAvaliada,
}: {
  aula: AulaAnterior;
  aberta: boolean;
  onAbrir: () => void;
  onAvaliada: () => void;
}) {
  const [nota, setNota] = useState(aula.minhaNota ?? 0);
  const [comentario, setComentario] = useState(aula.meuComentario ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await avaliarAula(aula.ocupacaoId, {
        nota,
        comentario: comentario.trim() || undefined,
      });
      onAvaliada();
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-extrabold text-foreground">
            {aula.turmaNome ?? "Aula"}
          </h3>
          <p className="mt-0.5 text-[12px] font-bold text-[var(--color-text-secondary)]">
            {formatarData(aula.data)} · {aula.horaInicio}–{aula.horaFim} ·{" "}
            {aula.quadraNome}
          </p>
        </div>

        {aula.minhaNota !== null && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-secondary-container)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
            <Star className="size-3.5 fill-current" aria-hidden="true" />
            {aula.minhaNota}
          </span>
        )}
      </div>

      {aberta ? (
        <div className="mt-4">
          <Estrelas nota={nota} onEscolher={setNota} />

          {/*
            REQ-008 — **antes do campo de texto, e não depois.**

            A primeira versão punha este aviso ABAIXO do `textarea`, e a
            validação cruzada pegou: a pessoa já tinha escrito quando lia que
            o clube veria o nome dela. Cumprir a letra do requisito ("está na
            tela") e trair a intenção ("antes de escrever") é a forma mais
            fácil de um aviso não servir para nada.

            A avaliação NÃO é anônima para o clube (decisão do Israel,
            ADR-017/4), e prometer o contrário por omissão seria o produto
            mentindo no momento exato em que a pessoa se expõe.
          */}
          <p className="mt-3 text-[11px] font-bold text-[var(--color-text-secondary)]">
            O clube vê sua nota, seu comentário e seu nome.
          </p>

          <label className="sr-only" htmlFor={`c-${aula.ocupacaoId}`}>
            Comentário sobre a aula
          </label>
          <textarea
            id={`c-${aula.ocupacaoId}`}
            rows={3}
            maxLength={500}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Quer contar mais? (opcional)"
            className="mt-2 w-full rounded-2xl bg-[var(--color-surface-container)] p-3 text-[13px]"
          />

          {erro && (
            <p
              role="alert"
              className="mt-2 text-[12px] font-bold text-[var(--color-error)]"
            >
              {erro}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onAbrir} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              disabled={nota < 1 || enviando}
              onClick={() => void enviar()}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4 w-full" onClick={onAbrir}>
          {aula.minhaNota === null ? "Avaliar esta aula" : "Mudar minha nota"}
        </Button>
      )}
    </article>
  );
}

/**
 * As cinco estrelas.
 *
 * `radiogroup` e não uma fila de botões soltos: leitor de tela precisa
 * anunciar "1 de 5", e o teclado precisa andar entre elas como um grupo.
 */
function Estrelas({
  nota,
  onEscolher,
}: {
  nota: number;
  onEscolher: (n: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Nota da aula, de 1 a 5"
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nota === n}
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          onClick={() => onEscolher(n)}
          className="flex size-11 items-center justify-center rounded-2xl transition-transform active:scale-95"
        >
          <Star
            className={`size-7 ${
              n <= nota
                ? "fill-[var(--color-secondary)] text-[var(--color-secondary)]"
                : "text-[var(--color-court-dark)]/25"
            }`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
