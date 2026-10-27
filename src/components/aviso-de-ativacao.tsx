"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { chegouDaAtivacao, chegouDaRedefinicao } from "@/lib/ativacao-navigation";

export const TEXTO_DO_AVISO_DE_ATIVACAO =
  "Conta ativada. Entre com seu e-mail e senha.";

/** SPEC-090 (D9) — quem acabou de redefinir a senha pelo link do e-mail. */
export const TEXTO_DO_AVISO_DE_REDEFINICAO =
  "Senha redefinida. Entre com a senha nova.";

/**
 * O texto que a região recebe depois da montagem, ou `null` para continuar
 * vazia. Os dois protocolos moram em `ativacao-navigation.ts`; aqui só se
 * escolhe a frase.
 */
function textoDaChegada(busca: string): string | null {
  if (chegouDaAtivacao(busca)) return TEXTO_DO_AVISO_DE_ATIVACAO;
  if (chegouDaRedefinicao(busca)) return TEXTO_DO_AVISO_DE_REDEFINICAO;
  return null;
}

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
 *
 * ## Dois protocolos, uma região (SPEC-090, D9)
 *
 * A redefinição de senha manda para `LOGIN_APOS_REDEFINICAO`, e a frase dela
 * entra **nesta mesma região**, pelo mesmo caminho: vazia no servidor e no
 * primeiro render, texto depois do atraso. Uma segunda região `role="status"`
 * quebraria a regra de uma região só na página (AC-008 da SPEC-084), e um
 * ramo que preenchesse de imediato perderia o anúncio (AC-024 da SPEC-090).
 */
export function AvisoDeAtivacao() {
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTexto(textoDaChegada(window.location.search));
    }, ATRASO_DO_ANUNCIO_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      role="status"
      data-aviso-de-ativacao=""
      className={
        texto
          ? "mb-4 flex items-start gap-3 rounded-2xl bg-[#161A1D] p-4 text-sm leading-snug font-semibold break-words text-white ring-1 ring-white/20"
          : undefined
      }
    >
      {texto ? (
        <>
          <CircleCheck className="mt-px size-5 shrink-0 text-[#B9E52B]" aria-hidden="true" />
          <span className="min-w-0">{texto}</span>
        </>
      ) : null}
    </div>
  );
}
