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
 * O texto do topo e o formulário têm cada um um véu escuro próprio, opaco a
 * pelo menos 70% sob as letras, que se desfaz em degradê nas bordas. É ele que
 * segura o contraste — o TEST-002 mede tudo também sobre uma foto toda branca,
 * toda preta e ausente. A foto pode ser trocada sem refazer nenhum texto
 * (REQ-003). O véu global sobre a foto é só acabamento.
 *
 * A foto é decorativa: `alt=""` e camada `aria-hidden`. Vem crua de
 * `public/` (`unoptimized`), sem passar pelo `/_next/image`, para que o
 * arquivo publicado seja byte a byte o do manifesto.
 */
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,16,0.35)_0%,rgba(8,13,16,0.05)_45%,rgba(8,13,16,0.25)_62%,rgba(8,13,16,0.6)_100%)]" />
        </div>

        <div className="relative px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 min-[341px]:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -bottom-10 bg-[linear-gradient(180deg,rgba(8,13,16,0.9)_0%,rgba(8,13,16,0.74)_100%)] [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_2.5rem),transparent)]"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Image
                src="/playck-logo.png"
                alt="Logo PlayCK"
                width={48}
                height={48}
                loading="eager"
                className="size-12 object-contain"
              />
              <p className="text-2xl leading-none font-extrabold">
                <span className="text-white">Play</span>
                <span className="text-[#B9E52B]">CK</span>
              </p>
            </div>

            <p className="mt-8 text-xs font-extrabold tracking-[0.16em] text-[#B9E52B]">
              SEU ESPORTE, SEU MOMENTO
            </p>
            <h1 className="mt-3 text-[1.875rem] leading-[1.08] font-extrabold break-words hyphens-auto text-white min-[360px]:text-[2rem] min-[400px]:text-[2.5rem]">
              <span className="block">Mais esporte,</span>{" "}
              <span className="block">mais conexões.</span>
            </h1>
            <p className="mt-3 max-w-[22rem] text-base leading-normal font-medium text-[#D9DED6]">
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
