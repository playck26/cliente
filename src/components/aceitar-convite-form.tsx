"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoSenha } from "@/components/campo-senha";
import {
  aceitarConvite,
  ApiError,
  getConvite,
  type ConvitePublico,
} from "@/lib/api-client";

/**
 * SPEC-009/REQ-002 — aceite de convite.
 *
 * Diferente do auto-cadastro: aqui a empresa convidou, então a conta nasce
 * **aprovada** e a pessoa já pode reservar. A senha é escolhida por ela, e
 * por isso não há primeiro acesso forçado neste caminho.
 *
 * A tela só mostra o nome que o admin preencheu (AC-024). E-mail, telefone
 * e nível também podem ter vindo no convite, mas são aplicados no aceite
 * **sem serem exibidos** (AC-025): quem tem o link não deve conseguir ler
 * dado pessoal de outra pessoa.
 */
export function AceitarConviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  /** SPEC-024/REQ-007 — so vira exigencia quando ha contrato para ler. */
  const [aceitouContrato, setAceitouContrato] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [conviteInvalido, setConviteInvalido] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConvite(token)
      .then((c) => {
        setConvite(c);
        if (c.nome) setNome(c.nome);
      })
      .catch(() => setConviteInvalido(true))
      .finally(() => setCarregando(false));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await aceitarConvite({
        token,
        senha,
        nome: nome || undefined,
        email: email || undefined,
        // SPEC-024/REQ-007 — **so o contrato, e so porque esta tela o
        // mostra.** O termo da plataforma NAO vai daqui: ele nao aparece
        // nesta tela, e registrar aceite de um texto que a pessoa nao viu
        // destruiria o valor do registro. Ele e lido e aceito em `/aceite`,
        // no primeiro acesso, onde aparece inteiro.
        contratoVersao: convite?.contrato?.versao,
      });
      router.push("/login");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível concluir o cadastro.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return <p className="text-center text-sm text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  if (conviteInvalido) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Este convite não é mais válido — pode já ter sido usado ou ter
          vencido. Peça um novo à sua escola.
        </p>
        <Button type="button" variant="outline" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="rounded-lg bg-[var(--color-primary-container)]/40 p-3 text-sm">
        Convite de <strong>{convite?.empresa.nome}</strong>
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome completo</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} className="pl-10" />
        </div>
      </div>

      {/*
        O convite pode já trazer o e-mail definido pela escola. Nesse caso o
        backend usa o dele e ignora o que vier daqui — pedir mesmo assim
        criaria a impressão de que a pessoa pode escolher, e daria erro
        confuso se ela digitasse outro.
      */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          E-mail{" "}
          <span className="font-normal text-[var(--color-text-secondary)]">
            (se a escola já cadastrou o seu, pode deixar em branco)
          </span>
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="pl-10" />
        </div>
      </div>

      <CampoSenha id="senha" label="Crie uma senha" valor={senha} onChange={setSenha} disabled={loading} />

      {/*
        SPEC-024/REQ-007 — o contrato do clube na PROPRIA tela do convite,
        pedido do Israel. Aparece so quando o clube publicou um: clube sem
        contrato nao ganha uma caixa vazia dizendo "leia o nada".
      */}
      {convite?.contrato ? (
        <section className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <h2 className="text-sm font-bold">Contrato do clube</h2>
            <span className="ml-auto text-xs font-bold text-[var(--color-text-secondary)]">
              versão {convite.contrato.versao}
            </span>
          </div>
          {/*
            `whitespace-pre-wrap`: o texto e PURO. Markdown e HTML ficam fora
            de proposito — HTML vindo do gestor seria XSS nesta tela publica,
            que e a mais exposta do app.
          */}
          <p className="mt-2 max-h-48 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]">
            {convite.contrato.texto}
          </p>
          <label className="mt-3 flex items-start gap-2 text-[13px] font-bold">
            <input
              type="checkbox"
              checked={aceitouContrato}
              onChange={(e) => setAceitouContrato(e.target.checked)}
              disabled={loading}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>Li e concordo com o contrato do clube.</span>
          </label>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={loading || (!!convite?.contrato && !aceitouContrato)}
        className="w-full"
      >
        {loading ? "Criando conta..." : "Aceitar convite"}
      </Button>
    </form>
  );
}
