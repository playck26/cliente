"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/campo-senha";
import { EscolhaDeConta, nomeDoPapel } from "@/components/escolha-de-conta";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import {
  ApiError,
  getRedefinicao,
  redefinirSenha,
  type ContaDaRedefinicao,
} from "@/lib/api-client";
import { LOGIN_APOS_REDEFINICAO } from "@/lib/ativacao-navigation";

/** D9 — o estado do `410`, no `GET` ou no `POST`. */
export const TEXTO_LINK_DE_REDEFINICAO_INVALIDO = "Este link não vale mais.";

/** O mínimo do `RedefinirSenhaDto` (`MinLength(8)`), o mesmo de todo campo de senha. */
const TAMANHO_MINIMO_DA_SENHA = 8;

type Tela =
  | { fase: "carregando" }
  | { fase: "escolha"; contas: ContaDaRedefinicao[] }
  | { fase: "formulario"; contas: ContaDaRedefinicao[]; conta: ContaDaRedefinicao }
  | { fase: "link-invalido" }
  | { fase: "falha-ao-abrir" };

function ehLinkInvalido(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 410;
}

/**
 * SPEC-090 (D4, D5, D9) — **a página do link que chega por e-mail.**
 *
 * O `GET` devolve as contas daquele e-mail que ainda aceitam o link:
 *
 * - **uma** → o formulário direto, com o clube e o papel em cima;
 * - **duas ou mais** → `EscolhaDeConta`; tocar num clube leva ao formulário
 *   daquela conta, com "Voltar" para a lista;
 * - nenhuma, ou `410` → "Este link não vale mais." e "Pedir outro link".
 *
 * O formulário pede a senha nova duas vezes (mínimo 8, iguais). O `204` manda
 * para `LOGIN_APOS_REDEFINICAO`, **importado** do arquivo de protocolo — o
 * login lê a mesma constante e mostra "Senha redefinida." na região do aviso.
 *
 * ## O que esta tela NÃO faz
 *
 * - **Não abre sessão** (D5): a pessoa entra pelo login com a senha nova.
 * - **Não diz por que o link morreu:** usado, vencido, senha trocada por outro
 *   caminho — o servidor responde o mesmo `410` para todos, de propósito.
 * - **Não manda o `Referer`:** a página declara `no-referrer` e as duas
 *   chamadas repetem a regra (`api-client.ts`), como na ativação.
 *
 * `replace`, e não `push`, depois do `204`: o link já foi gasto, e o "voltar"
 * do navegador não deve devolver a pessoa a um formulário que só responde
 * `410`.
 */
export function RedefinirSenhaForm({ token }: { token: string }) {
  const router = useRouter();
  const [tela, setTela] = useState<Tela>({ fase: "carregando" });
  /** Muda a cada "Tentar de novo": é o que faz o efeito buscar outra vez. */
  const [tentativa, setTentativa] = useState(0);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Resposta de uma tentativa antiga que chega depois da nova não pinta a
    // tela (DEF-021).
    let valendo = true;
    getRedefinicao(token)
      .then(({ contas }) => {
        if (!valendo) return;
        if (contas.length === 0) setTela({ fase: "link-invalido" });
        else if (contas.length === 1) setTela({ fase: "formulario", contas, conta: contas[0] });
        else setTela({ fase: "escolha", contas });
      })
      .catch((e: unknown) => {
        if (!valendo) return;
        // Só o `410` é link morto. Falha de rede ou `5xx` não diz nada sobre
        // o link, e mandar a pessoa pedir outro por causa disso a faria
        // esperar outro e-mail à toa.
        setTela({ fase: ehLinkInvalido(e) ? "link-invalido" : "falha-ao-abrir" });
      });
    return () => {
      valendo = false;
    };
  }, [token, tentativa]);

  function escolher(contas: ContaDaRedefinicao[], usuarioId: string) {
    const conta = contas.find((c) => c.usuarioId === usuarioId);
    if (!conta) return;
    setSenha("");
    setConfirmacao("");
    setErro(null);
    setTela({ fase: "formulario", contas, conta });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, conta: ContaDaRedefinicao) {
    event.preventDefault();
    setErro(null);

    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setEnviando(true);
    try {
      await redefinirSenha({ token, usuarioId: conta.usuarioId, senha });
    } catch (e) {
      if (ehLinkInvalido(e)) {
        // O link morreu entre abrir a página e enviar (usado para outra
        // conta, vencido, senha trocada). O formulário sai: ele só
        // responderia `410` de novo.
        setTela({ fase: "link-invalido" });
      } else {
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível redefinir sua senha. Tente de novo.",
        );
      }
      setEnviando(false);
      return;
    }
    // O botão continua desabilitado até a navegação: um segundo toque
    // mandaria o link já gasto e mostraria o `410` a quem acabou de dar certo.
    router.replace(LOGIN_APOS_REDEFINICAO);
  }

  if (tela.fase === "carregando") {
    return (
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Carregando...
      </p>
    );
  }

  if (tela.fase === "link-invalido") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-text-secondary)]">
          {TEXTO_LINK_DE_REDEFINICAO_INVALIDO}
        </p>
        <Button asChild className="w-full">
          <Link href="/esqueci-senha">Pedir outro link</Link>
        </Button>
      </div>
    );
  }

  if (tela.fase === "falha-ao-abrir") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-error)]">
          Não foi possível abrir o link. Tente de novo.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTela({ fase: "carregando" });
            setTentativa((n) => n + 1);
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (tela.fase === "escolha") {
    const { contas } = tela;
    return <EscolhaDeConta contas={contas} onEscolher={(id) => escolher(contas, id)} />;
  }

  const { conta, contas } = tela;
  const daLista = contas.length > 1;

  return (
    <form onSubmit={(e) => void handleSubmit(e, conta)} className="flex flex-col gap-4" noValidate>
      {daLista ? (
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setTela({ fase: "escolha", contas });
          }}
          disabled={enviando}
          className="flex min-h-11 items-center gap-2 self-start rounded-lg px-1 text-sm font-bold text-[var(--color-primary-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </button>
      ) : null}

      <div
        data-conta-da-redefinicao=""
        className="flex items-center gap-3 rounded-lg bg-[var(--color-primary-container)]/40 p-3"
      >
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white p-1">
          <LogoDaEmpresa url={conta.empresa.logoUrl} nome={conta.empresa.nome} className="size-10" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          {/* React escapa o texto: o nome vem do banco e nunca vira HTML. */}
          <span className="text-sm leading-snug font-extrabold break-words">{conta.empresa.nome}</span>
          <span className="text-sm leading-snug text-[var(--color-text-secondary)]">
            {nomeDoPapel(conta.papel)}
          </span>
        </span>
      </div>

      <CampoSenha
        id="senha"
        label="Senha nova"
        valor={senha}
        onChange={setSenha}
        disabled={enviando}
      />
      <CampoSenha
        id="confirmacao"
        label="Repita a senha nova"
        valor={confirmacao}
        onChange={setConfirmacao}
        disabled={enviando}
      />

      {erro ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2 w-full">
        {enviando ? "Salvando..." : "Redefinir minha senha"}
      </Button>
    </form>
  );
}
