"use client";

import { useEffect, useState } from "react";
import { getMinhaMatricula, type Matricula } from "@/lib/api-client";

/**
 * SPEC-037/REQ-003 — **o plano do aluno, e o link para pagar.**
 *
 * ## O que esta faixa resolve
 *
 * Antes dela, o aluno não tinha onde ver o que contratou nem como pagar: o
 * link de pagamento existia só no painel do gestor, uma URL por clube. Agora
 * ele vem **resolvido** — o do plano, ou o do clube quando o plano não tem
 * próprio (SPEC-037/D6).
 *
 * ## Some quando não há plano, e isso é o normal
 *
 * A tabela nasceu vazia: a maioria dos alunos de hoje não tem matrícula.
 * Mostrar "você não tem plano" seria cobrar de quem talvez nem deva ter — o
 * clube é que decide quem matricula. E a rota devolve `null`, não `404`,
 * justamente para a tela poder sumir em silêncio.
 *
 * ## O valor mostrado é o CONGELADO
 *
 * `valorCentavos` é o que o aluno contratou, não o preço de hoje. O clube
 * pode ter reajustado o plano; a matrícula dele não muda (SPEC-037/D1), e a
 * tela precisa dizer a verdade do contrato dele.
 */
function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** `2026-10-10` → `10/10/2026`. Sem `new Date(iso)`: fuso (DEF-020). */
function porExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function MeuPlano() {
  const [matricula, setMatricula] = useState<Matricula | null>(null);

  useEffect(() => {
    let vivo = true;
    getMinhaMatricula()
      .then((m) => {
        if (vivo) setMatricula(m);
      })
      .catch(() => {
        // **Silêncio de propósito**, como a carteira: `403` é professor ou
        // gestor, e nos dois a resposta certa é não aparecer. Pintar erro no
        // perfil de quem não tem plano foi o defeito da SPEC-033.
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (!matricula) return null;

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-foreground">
          Seu plano
        </h2>
        <span className="shrink-0 text-[13px] font-extrabold text-[var(--color-primary-strong)]">
          {/* O valor CONTRATADO, não o preço de hoje: o clube pode ter
              reajustado, e a matrícula dele não muda. */}
          {emReais(matricula.valorCentavos)}
        </span>
      </div>

      <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
        {matricula.planoNome ?? "Plano"} · até {porExtenso(matricula.fim)}
      </p>

      {/*
        SPEC-045/AC-010 — **a data sozinha não cria urgência.**

        "até 12 de outubro" e "vence em 5 dias" são a mesma informação, e só a
        segunda faz alguém agir. Mesma lição do `70%` da SPEC-036 e da contagem
        de conflitos da SPEC-035: número bruto não diz o que fazer.

        **Sete dias, e nada fora disso.** Um aviso que aparece o mês inteiro
        vira paisagem, e aí não avisa mais nada quando importa.

        `diasRestantes` vem do SERVIDOR: "hoje" da tela é o relógio do
        navegador, que está no fuso de quem viaja e não no do clube.
      */}
      {matricula.diasRestantes <= 7 ? (
        <p
          role="status"
          className="mt-2 rounded-2xl bg-[var(--color-primary-strong)]/10 px-3 py-2 text-[13px] font-extrabold text-[var(--color-primary-strong)]"
        >
          {matricula.diasRestantes < 0
            ? `Seu plano venceu há ${Math.abs(matricula.diasRestantes)} ${Math.abs(matricula.diasRestantes) === 1 ? "dia" : "dias"}.`
            : matricula.diasRestantes === 0
              ? "Seu plano vence hoje."
              : `Seu plano vence em ${matricula.diasRestantes} ${matricula.diasRestantes === 1 ? "dia" : "dias"}.`}
        </p>
      ) : null}

      {matricula.linkPagamentoUrl ? (
        <a
          href={matricula.linkPagamentoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-2xl bg-[var(--color-primary-strong)] py-3 text-center text-[13px] font-extrabold text-white active:scale-[0.99]"
        >
          {/* `noopener noreferrer` porque o destino é de terceiro: sem ele, a
              página de pagamento recebe `window.opener` e pode navegar esta
              aba para onde quiser. */}
          Pagar
        </a>
      ) : (
        <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">
          {/* Sem link não há botão — um botão morto é pior que nenhum. */}O
          clube ainda não configurou um link de pagamento. Fale com a recepção.
        </p>
      )}
    </section>
  );
}
