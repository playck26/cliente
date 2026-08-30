"use client";

import { Star } from "lucide-react";
import type { MediaDaTurma } from "@/lib/api-client";

/**
 * **A nota da turma, em estrelas douradas.**
 *
 * Nasceu dentro de `turmas-do-clube.tsx` (SPEC-025) e saiu de lá na SPEC-027,
 * quando a mesma nota passou a aparecer na lista do professor. Copiar seria
 * criar a segunda cópia de uma regra, e é sempre a cópia que fica velha.
 *
 * ---
 *
 * **SPEC-028 — o que o Israel viu, e o que mudou.**
 *
 * A tela dizia **"2 de 3 avaliações"** e desenhava cinco estrelas vazias. Ele
 * perguntou: *"o que seria 2 de 3 aval? Precisa apresentar a média de nota e
 * não essa quantidade atual. As estrelas devem ser preenchidas, de dourado,
 * de acordo com a média."*
 *
 * Três coisas estavam erradas ao mesmo tempo:
 *
 * 1. **o número era a contagem, não a nota.** Vinha do mínimo de 3 avaliações
 *    (D4 da SPEC-025), que segurava a média até a terceira nota. O mínimo foi
 *    removido no servidor — a média sai desde a primeira;
 * 2. **as estrelas nunca foram douradas.** Usavam `--color-secondary`, que é
 *    `#00bd90` — verde-água. Agora há `--color-rating` (`#e8a317`);
 * 3. **o preenchimento era arredondado.** `n <= Math.round(nota)` desenhava 4
 *    estrelas cheias para 4,3 e 4 estrelas cheias para 4,4 — a mesma imagem
 *    para notas diferentes. Agora é **proporcional**.
 *
 * **O que se perdeu, e ele decidiu sabendo:** o mínimo era privacidade, não
 * estatística. Com uma nota, a média *é* aquela nota — numa turma de dois
 * alunos, o professor sabe quem disse o quê. Registrado em
 * `AvaliacaoDeAulaService`.
 *
 * O professor continua vendo **só a média** — sem autoria e sem comentário
 * (INV-025a). Isso não mudou.
 */
export function NotaDaTurma({ media }: { media?: MediaDaTurma }) {
  // Ainda carregando: não desenha nada. Meia estrela piscando é pior que
  // esperar meio segundo.
  if (!media) return null;

  const nota = media.media;

  if (nota === null) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5">
        <Estrelas preenchimento={0} rotulo="Ainda sem nota" />
        <span className="text-[12px] font-bold text-[var(--color-text-secondary)]">
          Ainda sem avaliações
        </span>
      </div>
    );
  }

  const formatada = nota.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Estrelas
        preenchimento={nota / 5}
        rotulo={`Nota ${formatada} de 5, em ${media.quantidade} ${
          media.quantidade === 1 ? "avaliação" : "avaliações"
        }`}
      />
      <span className="text-[13px] font-extrabold text-[var(--color-text-primary)]">
        {formatada}
        {/*
          A contagem fica, pequena, ao lado. Média sem o tamanho da amostra faz
          "5,0" de uma nota parecer "5,0" de vinte — e agora que o mínimo caiu,
          uma nota só é um caso real.
        */}
        <span className="ml-1 text-[12px] font-bold text-[var(--color-text-secondary)]">
          ({media.quantidade})
        </span>
      </span>
    </div>
  );
}

/**
 * Cinco estrelas com preenchimento **proporcional** (`0` a `1`).
 *
 * Duas fileiras sobrepostas: a de baixo cinza, a de cima dourada e recortada
 * por `width`. É o que permite 4,3 e 4,7 desenharem imagens diferentes sem
 * precisar de ícone de meia-estrela — e sem arredondar, que era o defeito.
 *
 * `aria-hidden` nas duas: quem usa leitor de tela ouve o `aria-label` do
 * contêiner, com a nota por extenso. Dez estrelas anunciadas uma a uma seriam
 * ruído.
 */
function Estrelas({
  preenchimento,
  rotulo,
}: {
  preenchimento: number;
  rotulo: string;
}) {
  // `min`/`max` porque a média vem do servidor: um valor fora de 1–5 não pode
  // vazar para um `width` inválido.
  const pct = Math.max(0, Math.min(1, preenchimento)) * 100;

  return (
    <span
      className="relative inline-flex shrink-0"
      role="img"
      aria-label={rotulo}
    >
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className="size-4 text-[var(--color-text-secondary)]/30" />
        ))}
      </span>

      <span
        className="absolute inset-0 inline-flex gap-0.5 overflow-hidden"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className="size-4 shrink-0 fill-[var(--color-rating)] text-[var(--color-rating)]"
          />
        ))}
      </span>
    </span>
  );
}
