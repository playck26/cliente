"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import {
  ApiError,
  getCaixaDeAvisos,
  marcarAvisosComoLidos,
  type AvisoDaCaixa,
} from "@/lib/api-client";
import { avisarQueLeu } from "@/lib/contador-de-avisos";
import { Paginacao } from "./paginacao";

/**
 * SPEC-065 — **a caixa de avisos: o que aconteceu, mesmo que o push não tenha
 * chegado.**
 *
 * A SPEC-062 declarava, em LIM-062b, que *"sem assinatura viva, o aviso se
 * perde; não há caixa de entrada"*. Era um limite barato enquanto o clube não
 * mandava nada — e deixou de ser quando a SPEC-063 pôs os treze gestos no ar.
 *
 * **Esta tela é o que derruba aquele limite**, e por isso ela mostra avisos
 * que o push NÃO conseguiu entregar. Se espelhasse só o que chegou, resolveria
 * a conveniência de reler e não a perda.
 *
 * ## Abrir marca tudo como lido (D9)
 *
 * Não há estado de lido por item, e a razão é que a alternativa não tem
 * resposta boa: *o que conta como ter lido — aparecer na tela? ficar dois
 * segundos? tocar?*. Qualquer critério seria arbitrário, e marcação arbitrária
 * é pior que marcação grossa e previsível.
 *
 * **Arquivo idêntico em `cliente` e `admin`** — poly-repo sem pacote
 * compartilhado (ADR-001), o mesmo custo declarado do `netlify-ignore.mjs`.
 */

/** "há 5 min", "ontem", "12/09". Só o que o sistema gera — nunca texto livre. */
function quando(iso: string): string {
  const quandoMs = new Date(iso).getTime();
  const minutos = Math.floor((Date.now() - quandoMs) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function CaixaDeAvisos() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<AvisoDaCaixa[]>([]);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(20);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Marcar como lido acontece **uma vez por visita**, não a cada página. */
  const jaMarcou = useRef(false);

  /**
   * **Encadeamento de promessa, e não `async/await` com `try/finally`.**
   *
   * A regra do React Compiler recusa `setState` síncrono dentro de um efeito
   * (renderização em cascata), e com `try/finally` o linter não consegue
   * provar que o `finally` só roda depois de um `await` — basta a função
   * lançar antes de devolver a promessa. Com `.finally()`, o retorno é sempre
   * microtarefa.
   *
   * É o mesmo estilo que o `aulas-anteriores.tsx` já usa, e pelo mesmo motivo.
   */
  const carregar = useCallback(
    (p: number) =>
      getCaixaDeAvisos(p)
        .then(async (r) => {
          setErro(null);
          setAvisos(r.data);
          setTotal(r.total);
          setTamanho(r.pageSize);

          if (!jaMarcou.current && r.naoLidos > 0) {
            jaMarcou.current = true;
            await marcarAvisosComoLidos();
            // **Avisa as outras abas** (AC-019): sem isto, uma aba marcaria
            // tudo como lido e a outra seguiria mostrando número positivo — o
            // caso que derrubou a v1 da spec.
            avisarQueLeu();
          }
        })
        .catch((e: unknown) =>
          setErro(
            e instanceof ApiError
              ? e.message
              : "Não foi possível carregar seus avisos.",
          ),
        )
        .finally(() => setCarregando(false)),
    [],
  );

  useEffect(() => {
    void carregar(pagina);
  }, [carregar, pagina]);

  if (carregando && avisos.length === 0) {
    return (
      <p className="p-6 text-sm text-[var(--color-text-secondary)]">
        Carregando seus avisos…
      </p>
    );
  }

  if (erro) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--color-error)]">{erro}</p>
        <button
          type="button"
          onClick={() => void carregar(pagina)}
          className="mt-3 rounded-lg border px-4 py-2 text-sm"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <BellOff
          className="size-8 text-[var(--color-text-secondary)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nenhum aviso por aqui ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <ul className="flex flex-col gap-2">
        {avisos.map((aviso) => {
          const naoLido = aviso.lidaEm === null;
          const conteudo = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{aviso.titulo}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                  {quando(aviso.criadaEm)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {aviso.corpo}
              </p>
            </>
          );

          return (
            <li key={aviso.id}>
              {aviso.destinoUrl ? (
                <button
                  type="button"
                  onClick={() => router.push(aviso.destinoUrl as string)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent ${
                    naoLido ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  {conteudo}
                </button>
              ) : (
                <div
                  className={`rounded-xl border p-3 ${
                    naoLido ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  {conteudo}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Paginacao
        page={pagina}
        pageSize={tamanho}
        total={total}
        ocupado={carregando}
        onMudar={(p) => {
          setCarregando(true);
          setPagina(p);
        }}
        rotulo="avisos"
      />
    </div>
  );
}
