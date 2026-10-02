/**
 * SPEC-084 — **o único lugar que sabe qual é a foto do login.**
 *
 * A fotografia é cenário e nada mais: logo, textos, campos e botão vivem no
 * HTML (D1), e por isso trocar a foto não mexe em nenhum deles. Trocar é
 * adicionar um arquivo NOVO em `public/images/login/` com versão no nome,
 * apontar `src` para ele, ajustar `posicao` se o recorte pedir e registrar o
 * arquivo no `login-assets-manifest.json` — tudo neste diretório, nada nas
 * telas. O passo a passo está no `README.md`.
 *
 * **Nunca sobrescreva um nome já publicado.** O `login-appearance.test.ts`
 * compara o manifesto com o da base Git e reprova bytes novos com nome velho,
 * mesmo que o hash do manifesto tenha sido atualizado junto. Nome novo é o
 * que deixa o rollback servir a foto anterior intacta.
 *
 * O caminho `/images/login/` só pode aparecer aqui: o mesmo teste varre o
 * código de produção e reprova uma segunda cópia em TSX ou CSS.
 */
export const FUNDO_DO_LOGIN = {
  src: "/images/login/aluno-background-v1.webp",
  /** Dimensões do arquivo, conferidas no cabeçalho do WebP pelo teste. */
  largura: 864,
  altura: 1821,
  /** `object-position` da foto dentro da coluna (D2, D3). */
  posicao: "center",
} as const;

/**
 * A cor que fica quando a foto não carrega e, em tela larga, fora da coluna
 * de 480 px (I3). O contraste do login é medido também sobre ela — a foto
 * nunca decide a legibilidade (D2).
 */
export const COR_DE_FUNDO_DO_LOGIN = "#080D10";
