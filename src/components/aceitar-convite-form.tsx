"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, User } from "lucide-react";
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

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Criando conta..." : "Aceitar convite"}
      </Button>
    </form>
  );
}
