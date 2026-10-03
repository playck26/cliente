import Image from "next/image";
import { AvisoDeAtivacao } from "@/components/aviso-de-ativacao";
import { LoginForm } from "@/components/login-form";
import { COR_DE_FUNDO_DO_LOGIN, FUNDO_DO_LOGIN } from "@/lib/login-appearance";

/**
 * SPEC-084 — **o login do aluno com fundo fotográfico.**
 *
 * ## A composição (REQ-001, D2–D4)
 *
 * Uma coluna de até 480 px (I3), centralizada, com a foto de quadra atrás e o
 * conteúdo em fluxo por cima: marca e texto no alto, um respiro onde a
 * raquete e as bolas aparecem, e o formulário embaixo. No celular a coluna é
 * a tela inteira; em tela larga ela fica no meio, com `#080D10` dos lados — a
 * foto vertical não amplia nem perde o céu.
 *
 * A página não usa mais o `app-screen` (430 px, fundo claro do tema): o
 * `globals.css` é de todas as telas e não muda por causa do login (D5).
 *
 * ## Quem garante a leitura: véu e foto, medidos juntos (D2, I10)
 *
 * Selo, título e apoio têm o próprio véu escuro (ver `VEU`), e o formulário
 * tem um véu de bloco. O TEST-002 mede cada texto sobre a foto CONFIGURADA, em
 * cinco larguras, e sobre a foto ausente. Uma foto nova passa pelo mesmo
 * medidor: se for mais clara, reprova até os véus serem refeitos (REQ-003).
 *
 * Até a I10 o medidor usava também uma foto toda branca, e cada véu era o
 * mínimo que passava sobre o branco — o topo e o pé da tela ficavam escuros
 * sobre qualquer foto, e o Israel pediu menos preto duas vezes (I6 e I10).
 *
 * A foto é decorativa: `alt=""` e camada `aria-hidden`. Vem crua de
 * `public/` (`unoptimized`), sem passar pelo `/_next/image`, para que o
 * arquivo publicado seja byte a byte o do manifesto.
 */
/**
 * O véu de cada texto do topo (I6, 2026-10-02): um pseudo-elemento escuro
 * atrás do próprio texto, da largura da coluna, desfeito em cima e embaixo.
 * Antes era um véu único de 0,74–0,90 sobre o bloco inteiro, e o Israel achou
 * o céu escuro demais — o sol quase sumia.
 *
 * O título (texto grande, 3:1) fica com 0,48; o apoio e o selo (texto
 * pequeno, 4,5:1), com 0,72 e 0,76. **A I10 NÃO os baixou, e foi medido:**
 * sobre a foto real, o mínimo que passa é 0,45, 0,65 e 0,70 — atrás das letras
 * há refletores da quadra, pontos quase brancos, e o medidor reprova com um
 * pixel claro só. Os valores de antes ficam com essa folga, e passam também
 * sobre branco. O véu se desfaz para a direita logo depois do fim de cada
 * linha (paradas em `em`, que acompanham o tamanho da fonte), até zero: é ali,
 * ao lado do título, que fica o sol.
 *
 * **A marca não tem véu (I10):** sobre o céu da foto ela passa com folga em
 * toda largura, e o véu de 0,66 que tinha era a mancha escura atrás do logo.
 * A linha QUEBRA (`flex-wrap`): com a fonte do sistema a 200% num celular de
 * 320 px, logo + “PlayCK” não cabem lado a lado, e a palavra passava da
 * coluna (LIM-084o). Agora ela desce inteira para baixo do logo.
 */
const VEU =
  "relative before:pointer-events-none before:absolute before:-inset-x-6 before:-z-10 before:content-[''] max-[340px]:before:-inset-x-5";
const VEU_DE_BLOCO =
  "before:-inset-y-4 before:[mask-image:linear-gradient(to_bottom,transparent,#000_1rem,#000_calc(100%_-_1rem),transparent)]";
/** Por linha do título: a borda desfeita fica FORA da caixa do texto (0,5em > 0,3em). */
const VEU_DE_LINHA =
  "before:-inset-y-[0.5em] before:[mask-image:linear-gradient(to_bottom,transparent,#000_0.3em,#000_calc(100%_-_0.3em),transparent)]";

export default function LoginPage() {
  return (
    <main
      className="relative min-h-svh w-full"
      style={{ backgroundColor: COR_DE_FUNDO_DO_LOGIN }}
    >
      <div
        data-coluna-do-login=""
        className="relative mx-auto flex min-h-svh w-full max-w-[480px] flex-col"
      >
        <div
          aria-hidden="true"
          data-camada-da-foto=""
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <Image
            src={FUNDO_DO_LOGIN.src}
            alt=""
            fill
            unoptimized
            loading="eager"
            fetchPriority="high"
            className="object-cover"
            style={{ objectPosition: FUNDO_DO_LOGIN.posicao }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,16,0)_55%,rgba(8,13,16,0.1)_75%,rgba(8,13,16,0.3)_100%)]" />
        </div>

        <div className="relative isolate px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 min-[341px]:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Image
                src="/playck-logo.png"
                alt="Logo PlayCK"
                width={64}
                height={64}
                loading="eager"
                className="size-16 object-contain"
              />
              <p className="min-w-0 text-[2rem] leading-none font-extrabold break-words">
                <span className="text-white">Play</span>
                <span className="text-[#B9E52B]">CK</span>
              </p>
            </div>

            <p className={`${VEU} ${VEU_DE_BLOCO} mt-8 text-xs font-extrabold tracking-[0.16em] text-[#B9E52B] before:bg-[linear-gradient(90deg,rgba(8,13,16,0.76)_0,rgba(8,13,16,0.76)_calc(1.5rem_+_20em),rgba(8,13,16,0)_calc(1.5rem_+_27em))]`}>
              SEU ESPORTE, SEU MOMENTO
            </p>
            <h1 className="mt-3 text-[1.875rem] leading-[1.08] font-extrabold break-words hyphens-auto text-white min-[360px]:text-[2rem] min-[400px]:text-[2.5rem]">
              <span className={`${VEU} ${VEU_DE_LINHA} block before:bg-[linear-gradient(90deg,rgba(8,13,16,0.48)_0,rgba(8,13,16,0.48)_calc(1.5rem_+_7em),rgba(8,13,16,0)_calc(1.5rem_+_9.5em))]`}>Mais esporte,</span>{" "}
              <span className={`${VEU} ${VEU_DE_LINHA} block before:bg-[linear-gradient(90deg,rgba(8,13,16,0.48)_0,rgba(8,13,16,0.48)_calc(1.5rem_+_8.5em),rgba(8,13,16,0)_calc(1.5rem_+_10.5em))]`}>mais conexões.</span>
            </h1>
            {/* I10: três linhas. A largura em `rem` acompanha a fonte, e o `text-balance` iguala as linhas. */}
            <p className={`${VEU} ${VEU_DE_BLOCO} mt-3 max-w-[18rem] text-base text-balance leading-normal font-medium text-[#D9DED6] before:bg-[linear-gradient(90deg,rgba(8,13,16,0.72)_0,rgba(8,13,16,0.72)_calc(100%_-_1.5rem),rgba(8,13,16,0)_100%)]`}>
              Reserve sua quadra, acompanhe suas aulas e aproveite cada momento no seu clube.
            </p>
          </div>
        </div>

        {/* O respiro onde a raquete e as bolas aparecem (AC-001). */}
        <div className="min-h-24 flex-1" />

        {/*
          O véu do formulário era 0,84 — o "preto embaixo das bolas" da I10.
          Com 0,35 a quadra aparece, e o que limita é a borda dos campos: a
          pior, medida sobre a foto em cinco larguras, fica em 3,47:1 (limite
          3). Os rótulos dentro da caixa ficam sobre o fundo do próprio campo.
        */}
        <div className="relative px-5 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] min-[341px]:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-[rgba(8,13,16,0.35)] [mask-image:linear-gradient(to_bottom,transparent,#000_4rem)]"
          />
          <div className="relative">
            <AvisoDeAtivacao />
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
