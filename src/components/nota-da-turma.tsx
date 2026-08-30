"use client";

import { Star } from "lucide-react";
import type { MediaDaTurma } from "@/lib/api-client";

/**
 * **A nota da turma, em estrelas.**
 *
 * Nasceu dentro de `turmas-do-clube.tsx` (SPEC-025, a pedido do Israel ao ver
 * a tela em produção) e saiu de lá em 2026-08-30, quando ele pediu a mesma
 * nota **na lista do professor**. Copiar seria criar a segunda cópia de uma
 * regra de privacidade — e é sempre a cópia que fica velha.
 *
 * **O mínimo de 3 avaliações continua valendo** (D4 da SPEC-025), e ele é de
 * privacidade antes de estatística: abaixo dele a média não é publicada. Quem
 * decide isso é o servidor, que manda `media: null` — este componente não
 * recalcula nada, só apresenta.
 *
 * A linha **sempre aparece**. A primeira versão só desenhava quando havia
 * média, e o resultado foi turma nenhuma exibindo nada: a informação existia e
 * a tela não a mostrava. Estrela vazia é informação; ausência de estrela é
 * dúvida.
 *
 * **O professor vê o mesmo número que o aluno, e nada além dele.** A rota
 * `GET /me/classes/:id/avaliacao` aceita os dois papéis e não devolve autoria
 * nem comentário (INV-025a) — a decisão do Israel diz "somente o painel
 * admin", e ela vale para quem escreveu e para o que escreveu.
 */
export function NotaDaTurma({ media }: { media?: MediaDaTurma }) {
  // Ainda carregando: não desenha nada. Meia estrela piscando é pior que
  // esperar meio segundo.
  if (!media) return null;

  const nota = media.media;
  const temNota = nota !== null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-0.5"
        aria-label={
          temNota
            ? `Nota ${nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} de 5, em ${media.quantidade} avaliações`
            : "Ainda sem nota"
        }
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`size-3.5 ${
              temNota && n <= Math.round(nota)
                ? "fill-[var(--color-secondary)] text-[var(--color-secondary)]"
                : "text-[var(--color-text-secondary)]/35"
            }`}
            aria-hidden="true"
          />
        ))}
      </span>

      {temNota ? (
        <span className="text-[12px] font-extrabold text-[var(--color-primary-strong)]">
          {nota.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          <span className="ml-1 font-bold text-[var(--color-text-secondary)]">
            ({media.quantidade})
          </span>
        </span>
      ) : (
        /*
          Sem média, a tela diz POR QUE — e não some. "Ainda sem nota" faria a
          pessoa achar que ninguém avaliou, quando pode haver duas avaliações
          esperando a terceira.
        */
        <span className="text-[12px] font-bold text-[var(--color-text-secondary)]">
          {media.quantidade === 0
            ? "Ainda sem avaliações"
            : `${media.quantidade} de ${media.minimoParaMedia} avaliações`}
        </span>
      )}
    </div>
  );
}
