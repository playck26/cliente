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
 * ## Quem garante a leitura é o véu, não a foto (D2)
 *
 * Cada texto do topo tem o próprio véu escuro (ver `VEU`), e o formulário
 * tem um véu de bloco. São eles que seguram o contraste — o TEST-002 mede tudo
 * também sobre uma foto toda branca, toda preta e ausente —, e por isso a foto
 * pode ser trocada sem refazer nenhum texto (REQ-003). O véu global sobre a
 * foto é só acabamento.
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
 * Cada texto recebe só o véu de que precisa para passar no medidor sobre um
 * fundo TODO BRANCO: o título (texto grande, 3:1) fica com 0,48; o apoio e o
 * selo (texto pequeno, 4,5:1), com 0,72 e 0,76. E o véu se desfaz para a
 * direita logo depois do fim de cada linha (paradas em `em`, que acompanham o
 * tamanho da fonte): é ali, ao lado do título, que fica o sol.
 *
 * A linha da marca QUEBRA (`flex-wrap`): com a fonte do sistema a 200% num
 * celular de 320 px, logo + “PlayCK” não cabem lado a lado, e a palavra
 * passava ~13 px da coluna, com o “CK” fora do véu (1,38:1 sobre branco —
 * ressalva da validação do delta, LIM-084o). Agora ela desce para baixo do
 * logo, dentro da coluna e do véu.
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,16,0.12)_0%,rgba(8,13,16,0)_40%,rgba(8,13,16,0.25)_62%,rgba(8,13,16,0.6)_100%)]" />
        </div>

        <div className="relative isolate px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 min-[341px]:px-6">
          <div>
            <div className={`${VEU} ${VEU_DE_BLOCO} flex flex-wrap items-center gap-3 before:bg-[linear-gradient(90deg,rgba(8,13,16,0.66)_0,rgba(8,13,16,0.66)_12rem,rgba(8,13,16,0.12)_17rem)]`}>
              <Image
                src="/playck-logo.png"
                alt="Logo PlayCK"
                width={48}
                height={48}
                loading="eager"
                className="size-12 object-contain"
              />
              <p className="min-w-0 text-2xl leading-none font-extrabold break-words">
                <span className="text-white">Play</span>
                <span className="text-[#B9E52B]">CK</span>
              </p>
            </div>

            <p className={`${VEU} ${VEU_DE_BLOCO} mt-8 text-xs font-extrabold tracking-[0.16em] text-[#B9E52B] before:bg-[linear-gradient(90deg,rgba(8,13,16,0.76)_0,rgba(8,13,16,0.76)_calc(1.5rem_+_20em),rgba(8,13,16,0.12)_calc(1.5rem_+_27em))]`}>
              SEU ESPORTE, SEU MOMENTO
            </p>
            <h1 className="mt-3 text-[1.875rem] leading-[1.08] font-extrabold break-words hyphens-auto text-white min-[360px]:text-[2rem] min-[400px]:text-[2.5rem]">
              <span className={`${VEU} ${VEU_DE_LINHA} block before:bg-[linear-gradient(90deg,rgba(8,13,16,0.48)_0,rgba(8,13,16,0.48)_calc(1.5rem_+_7em),rgba(8,13,16,0.1)_calc(1.5rem_+_9.5em))]`}>Mais esporte,</span>{" "}
              <span className={`${VEU} ${VEU_DE_LINHA} block before:bg-[linear-gradient(90deg,rgba(8,13,16,0.48)_0,rgba(8,13,16,0.48)_calc(1.5rem_+_8.5em),rgba(8,13,16,0.1)_calc(1.5rem_+_10.5em))]`}>mais conexões.</span>
            </h1>
            <p className={`${VEU} ${VEU_DE_BLOCO} mt-3 max-w-[22rem] text-base leading-normal font-medium text-[#D9DED6] before:bg-[linear-gradient(90deg,rgba(8,13,16,0.72)_0,rgba(8,13,16,0.72)_calc(100%_-_1.5rem),rgba(8,13,16,0)_100%)]`}>
              Reserve sua quadra, acompanhe suas aulas e aproveite cada momento no seu clube.
            </p>
          </div>
        </div>

        {/* O respiro onde a raquete e as bolas aparecem (AC-001). */}
        <div className="min-h-24 flex-1" />

        <div className="relative px-5 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] min-[341px]:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 bg-[rgba(8,13,16,0.84)] [mask-image:linear-gradient(to_bottom,transparent,#000_2.5rem)]"
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
