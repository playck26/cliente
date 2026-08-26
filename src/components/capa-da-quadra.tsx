import { CourtLines } from "@/components/court-lines";

/**
 * SPEC-018/TASK-005 — o fundo do cartão da quadra: **a foto, quando existe;
 * o desenho, quando não.**
 *
 * ## Por que existe
 *
 * A TASK-005 pôs a imagem de quadra no ar em 2026-08-26 — o gestor sobe em
 * `/quadras/[id]` no Admin, e o `back` devolve `imagemUrl` em toda leitura
 * de quadra. **E o app do aluno continuou desenhando as linhas sintéticas**,
 * porque ninguém tocou neste repositório. O upload funcionava e a foto não
 * aparecia para quem a spec dizia que ia ver: *"aparece para o aluno na hora
 * de escolher onde jogar"*.
 *
 * Existe como componente, e não como `<img>` repetido, porque são **dois**
 * lugares com o mesmo herói — a lista e a tela de reserva — e a decisão
 * "foto ou desenho" repetida em dois lugares é duas chances de um deles
 * ficar para trás. Foi exatamente assim que este defeito nasceu.
 *
 * ## O gradiente não é enfeite
 *
 * O preço e o nome da quadra são **texto branco por cima**. Sobre as linhas
 * sintéticas isso sempre funcionou, porque o fundo é uma cor escolhida por
 * nós. Sobre a foto que o clube subiu, não há garantia nenhuma: uma quadra
 * clara ao meio-dia apaga o texto.
 *
 * Por isso a foto vem com um degradê escuro por cima, e ele só existe quando
 * há foto — sobre o desenho seria escurecer de graça.
 */
export function CapaDaQuadra({
  imagemUrl,
  nome,
}: {
  imagemUrl: string | null;
  /** Vai para o `alt`. A foto é do produto, não decoração. */
  nome: string;
}) {
  if (imagemUrl === null) {
    return <CourtLines />;
  }

  return (
    <>
      {/*
        Sem `next/image`: a URL é de CDN externo e o domínio teria de entrar
        em `next.config.ts`. A planta declara que este projeto não carrega
        otimizador para host de terceiro.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagemUrl}
        alt={`Foto da ${nome}`}
        className="absolute inset-0 size-full object-cover"
      />
      {/*
        O degradê. Mais forte embaixo, onde ficam o esporte e o nome; o preço
        fica no alto e tem fundo próprio (`bg-white/16` com blur).
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/25"
      />
    </>
  );
}
