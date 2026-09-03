"use client";

/**
 * **SPEC-041/B4 — o grupo de filtros da SPEC-020, agora num lugar só.**
 *
 * Nasceu dentro de `courts-list.tsx`, para esporte e categoria. Quando as
 * reservas precisaram filtrar por status, copiar teria criado a segunda cópia
 * da mesma decisão — e é sempre a cópia que fica velha. É literalmente o
 * caminho que `abas-na-url.tsx` já percorreu na SPEC-023, e o mesmo que o
 * DEF-011 percorreu ao contrário, com a regra morando num comentário de outro
 * arquivo enquanto a tela vizinha errava sem saber.
 *
 * **O que ele decide, e vale para toda tela que o use:**
 *
 * - "todas" é uma opção **de verdade**, e a primeira — não a ausência de
 *   escolha. Quem já filtrou precisa de um caminho de volta visível;
 * - `aria-pressed` em vez de `aria-selected`: são botões de alternância, não
 *   abas. Leitor de tela anuncia "pressionado", que é o que eles são;
 * - rola na horizontal sem barra visível, porque em tela de celular a lista
 *   passa da largura e cortar opção é pior que rolar.
 *
 * O tipo da opção é `{ id, nome }` e não `OpcaoDeCatalogo`: status de pagamento
 * não é catálogo do banco, e amarrar o componente àquele schema faria a segunda
 * tela ter de fingir que é.
 */
export interface OpcaoDeFiltro {
  id: string;
  nome: string;
}

export function GrupoDeFiltro({
  rotulo,
  textoTodas,
  opcoes,
  escolhida,
  onEscolher,
}: {
  rotulo: string;
  textoTodas: string;
  opcoes: readonly OpcaoDeFiltro[];
  escolhida: string | null;
  onEscolher: (id: string | null) => void;
}) {
  const classe = (ativo: boolean) =>
    `h-10 shrink-0 rounded-full px-4 text-[13px] font-extrabold transition-colors ${ativo ? "bg-white text-[var(--color-primary-strong)]" : "bg-white/10 text-white ring-1 ring-white/20"}`;

  return (
    <div
      role="group"
      aria-label={rotulo}
      className="no-scrollbar mt-4 flex gap-2 overflow-x-auto"
    >
      <button
        type="button"
        onClick={() => onEscolher(null)}
        aria-pressed={escolhida === null}
        className={classe(escolhida === null)}
      >
        {textoTodas}
      </button>
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          onClick={() => onEscolher(opcao.id)}
          aria-pressed={escolhida === opcao.id}
          className={classe(escolhida === opcao.id)}
        >
          {opcao.nome}
        </button>
      ))}
    </div>
  );
}
