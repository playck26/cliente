"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { chegouDaAtivacao } from "@/lib/ativacao-navigation";

export const TEXTO_DO_AVISO_DE_ATIVACAO =
  "Conta ativada. Entre com seu e-mail e senha.";

/**
 * Quanto esperar depois da montagem para pôr o texto na região viva. Não é
 * para o olho: é para o leitor de tela já ter registrado a região quando o
 * conteúdo chegar.
 */
const ATRASO_DO_ANUNCIO_MS = 150;

/**
 * SPEC-084 (AC-008, D7) — **o aviso de quem acabou de ativar a conta.**
 *
 * A página de ativação (SPEC-083) manda para `LOGIN_APOS_ATIVACAO`, e aqui a
 * pessoa lê que a conta está pronta e só falta entrar.
 *
 * ## Fora do `LoginForm`, de propósito
 *
 * A caracterização congelada do login (`login-form.caracterizacao.test.tsx`)
 * monta o formulário com os mocks da base, e um hook novo lá dentro a
 * derrubaria sem regressão nenhuma. Este componente é irmão do formulário, e a
 * página os compõe.
 *
 * ## Vazio no servidor, texto depois
 *
 * O contêiner `role="status"` existe **vazio** no HTML do servidor e só recebe
 * o texto depois da montagem. Uma região viva que já nasce com conteúdo
 * costuma não ser anunciada; a que muda depois, sim. Vale também para quem
 * chega por navegação do cliente (a página de ativação usa o roteador): o
 * componente monta vazio e o texto entra no tempo seguinte.
 *
 * O `setState` mora dentro do `setTimeout`, e não no corpo do efeito: é
 * exatamente o atraso que torna o anúncio confiável, e é o que mantém o
 * `react-hooks/set-state-in-effect` satisfeito sem desligá-lo.
 *
 * O foco não se move: o aviso informa e não interrompe.
 *
 * Cores locais do login (DESIGN.md, “Login fotográfico”): superfície opaca
 * escura, texto branco e ícone verde-lima. O verde `#00763A` do tema dava
 * 3,4:1 sobre o fundo escuro e ficou de fora (DOR-084-R1-01).
 */
export function AvisoDeAtivacao() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMostrar(chegouDaAtivacao(window.location.search));
    }, ATRASO_DO_ANUNCIO_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      role="status"
      data-aviso-de-ativacao=""
      className={
        mostrar
          ? "mb-4 flex items-start gap-3 rounded-2xl bg-[#161A1D] p-4 text-sm leading-snug font-semibold break-words text-white ring-1 ring-white/20"
          : undefined
      }
    >
      {mostrar ? (
        <>
          <CircleCheck className="mt-px size-5 shrink-0 text-[#B9E52B]" aria-hidden="true" />
          <span className="min-w-0">{TEXTO_DO_AVISO_DE_ATIVACAO}</span>
        </>
      ) : null}
    </div>
  );
}
