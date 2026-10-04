"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/campo-senha";
import {
  ApiError,
  ativarConta,
  getAtivacao,
  type AtivacaoPublica,
} from "@/lib/api-client";
import { LOGIN_APOS_ATIVACAO } from "@/lib/ativacao-navigation";

/** D11 — o texto do `410`, igual ao que o servidor manda no `LINK_INVALIDO`. */
export const TEXTO_LINK_INVALIDO =
  "Este link não vale mais. Peça um novo convite ao seu clube.";

/** O mínimo do `AtivarContaDto` (`minLength: 8`), o mesmo de todo campo de senha. */
const TAMANHO_MINIMO_DA_SENHA = 8;

type Tela =
  | { fase: "carregando" }
  | { fase: "pronta"; ativacao: AtivacaoPublica }
  | { fase: "link-invalido" }
  | { fase: "falha-ao-abrir" };

function ehLinkInvalido(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 410;
}

/**
 * SPEC-083 (D11) — **a pessoa cria a própria senha pelo link do e-mail.**
 *
 * A conta já existe: o gestor a criou na importação ou na ficha, com uma
 * senha que ninguém conhece. O link é de uso único e morre quando é usado,
 * quando outro o substitui, quando a senha muda por outro caminho, ou em 7
 * dias — e o servidor responde o mesmo `410` nos oito casos, de propósito: a
 * página não diz *por que* o link morreu.
 *
 * ## O que esta tela NÃO faz
 *
 * - **Não abre sessão.** O `204` não traz token; a pessoa entra pelo login
 *   com a senha que acabou de criar, e o termo e o contrato são aceitos no
 *   portão do primeiro acesso (I12), não aqui.
 * - **Não escreve o endereço do login.** Depois do `204` ela vai para
 *   `LOGIN_APOS_ATIVACAO`, **importado** de `ativacao-navigation.ts`, que é da
 *   SPEC-084 e onde mora o único literal do protocolo
 *   (`COORDENACAO-083-084.md`). O login lê a mesma constante e mostra "Conta
 *   ativada.". Um endereço escrito à mão aqui passaria na varredura da 084 e
 *   deixaria o aviso sem aparecer — é o que o `e2e/ativacao-login.spec.ts`
 *   pega (S17).
 * - **Não leva para o login com o aviso em erro.** `410`, `400` e falha de
 *   rede ficam nesta tela, com o texto do erro.
 *
 * `replace`, e não `push`: o link já foi gasto, e o "voltar" do navegador não
 * deve devolver a pessoa a um formulário que agora só responde `410`.
 */
export function AtivarContaForm({ token }: { token: string }) {
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
    // tela: o mesmo cuidado do DEF-021.
    let valendo = true;
    getAtivacao(token)
      .then((ativacao) => {
        if (valendo) setTela({ fase: "pronta", ativacao });
      })
      .catch((e: unknown) => {
        if (!valendo) return;
        // Só o `410` é link morto. Falha de rede ou `5xx` não diz nada sobre
        // o link, e mandar a pessoa pedir outro convite por causa disso seria
        // gastar o convite que ainda vale.
        setTela({ fase: ehLinkInvalido(e) ? "link-invalido" : "falha-ao-abrir" });
      });
    return () => {
      valendo = false;
    };
  }, [token, tentativa]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      await ativarConta({ token, senha });
    } catch (e) {
      if (ehLinkInvalido(e)) {
        // O link morreu entre abrir a página e enviar (usado em outra aba,
        // substituído por um reenvio, expirado). O formulário sai: ele só
        // responderia `410` de novo.
        setTela({ fase: "link-invalido" });
      } else {
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível criar sua senha. Tente de novo.",
        );
      }
      setEnviando(false);
      return;
    }
    // O botão continua desabilitado até a navegação: um segundo toque
    // mandaria o mesmo token já gasto e mostraria o `410` a quem acabou de
    // dar certo.
    router.replace(LOGIN_APOS_ATIVACAO);
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
      <p role="alert" className="text-center text-sm text-[var(--color-text-secondary)]">
        {TEXTO_LINK_INVALIDO}
      </p>
    );
  }

  if (tela.fase === "falha-ao-abrir") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-error)]">
          Não foi possível abrir o convite. Tente de novo.
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

  const { ativacao } = tela;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* React escapa o texto: nome e clube vêm do banco e nunca viram HTML. */}
      <p className="rounded-lg bg-[var(--color-primary-container)]/40 p-3 text-sm">
        Olá, {ativacao.primeiroNome}. Crie sua senha para entrar no{" "}
        {ativacao.empresa.nome}.
      </p>

      <CampoSenha
        id="senha"
        label="Crie uma senha"
        valor={senha}
        onChange={setSenha}
        disabled={enviando}
      />
      <CampoSenha
        id="confirmacao"
        label="Repita a senha"
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
        {enviando ? "Salvando..." : "Criar minha senha"}
      </Button>
    </form>
  );
}
