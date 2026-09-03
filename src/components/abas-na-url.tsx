"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * SPEC-023 — **o padrão de abas da SPEC-022, agora num lugar só.**
 *
 * Nasceu dentro de `reservas-tabs.tsx`. Quando a tela de aulas precisou do
 * mesmo comportamento, copiar teria criado duas cópias da mesma decisão — e
 * é sempre a cópia que fica velha. Foi assim que a regra da barra do
 * professor (DEF-011) morou num comentário de outro arquivo e o
 * `perfil-view` errou sem saber.
 *
 * **O que este componente decide, e vale para toda tela que o use:**
 *
 * - a aba mora na **URL**, não em `useState` — link compartilhável, "voltar"
 *   que desfaz a troca, e um endereço para redirects apontarem;
 * - valor desconhecido cai na aba padrão **em silêncio**: `?aba=lixo` vem de
 *   URL editada à mão ou link velho, e punir a pessoa por um endereço que
 *   nós mudamos seria o pior dos dois mundos;
 * - a aba padrão sai da URL, em vez de virar `?aba=padrao` — endereço limpo
 *   é o que a pessoa copia.
 */
export interface AbaDaTela<Id extends string> {
  id: Id;
  rotulo: string;
}

export function useAbaAtiva<Id extends string>(
  abas: readonly AbaDaTela<Id>[],
  padrao: Id,
  caminho: string,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ativa = normalizarAba(abas, padrao, searchParams.get("aba"));

  // `push` e não `replace`, para o "voltar" ter o que desfazer.
  // `scroll: false` porque trocar de aba não é ir para outra tela — a
  // pessoa perderia a posição de leitura sem motivo.
  //
  // **SPEC-041/B3 — este helper APAGAVA o resto da query, e isso já era
  // defeito em produção.**
  //
  // Ele reconstruía o endereço só com `aba`, então tudo o mais sumia na
  // troca. O ramo do padrão era o pior dos dois: empurrava o caminho pelado.
  // Em `/minhas-aulas`, o `?vista=semana` que o `my-classes-list` acabara de
  // pôr desaparecia quando a pessoa ia para "Turmas" e voltava.
  //
  // **E a documentação afirmava o contrário.** O comentário do `useVista`
  // dizia que preservar a query era "assim que a barra de abas evitou de
  // apagar o que não é dela" — creditando à barra um cuidado que só o
  // `useVista` tinha. A planta do Cliente repetia. Os dois foram corrigidos
  // no mesmo ciclo; ver a nota lá.
  //
  // Agora parte da query existente e mexe **só** na própria chave. O padrão
  // continua saindo do endereço — endereço limpo é o que a pessoa copia —,
  // mas agora `delete` em vez de "reescrever do zero".
  const irPara = (aba: Id) => {
    if (aba === ativa) return;
    const params = new URLSearchParams(searchParams.toString());
    if (aba === padrao) params.delete("aba");
    else params.set("aba", aba);
    const qs = params.toString();
    router.push(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  };

  return { ativa, irPara };
}

export function normalizarAba<Id extends string>(
  abas: readonly AbaDaTela<Id>[],
  padrao: Id,
  valor: string | null,
): Id {
  return abas.some((aba) => aba.id === valor) ? (valor as Id) : padrao;
}

/**
 * A barra de abas em si. Segue o tratamento de item ativo da barra inferior
 * (fundo branco, `extrabold`, `--color-primary-strong`) para as duas
 * navegações da tela lerem como a mesma linguagem, e não como dois widgets
 * de origens diferentes.
 */
export function BarraDeAbas<Id extends string>({
  abas,
  ativa,
  onTrocar,
  rotulo,
}: {
  abas: readonly AbaDaTela<Id>[];
  ativa: Id;
  onTrocar: (aba: Id) => void;
  rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="grid gap-1 rounded-[22px] bg-[var(--color-court-dark)]/[0.07] p-1.5"
      style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}
    >
      {abas.map((aba) => {
        const selecionada = aba.id === ativa;
        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            id={`aba-${aba.id}`}
            aria-selected={selecionada}
            aria-controls={`painel-${aba.id}`}
            onClick={() => onTrocar(aba.id)}
            className={`flex h-11 items-center justify-center rounded-[16px] text-[13px] font-extrabold transition-colors ${
              selecionada
                ? "bg-white text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                : "text-[var(--color-court-dark)]/55 hover:text-[var(--color-court-dark)]"
            }`}
          >
            {aba.rotulo}
          </button>
        );
      })}
    </div>
  );
}
