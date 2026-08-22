"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoSenha } from "@/components/campo-senha";
import {
  ApiError,
  getEmpresaPorSlug,
  registerAluno,
  type EmpresaPublica,
} from "@/lib/api-client";

/**
 * SPEC-009/REQ-001 — auto-cadastro público.
 *
 * A pessoa escolhe a própria senha (não há senha temporária aqui) e a conta
 * nasce **pendente de aprovação** (REQ-008): ela entra e olha, mas não
 * reserva quadra nem entra em turma até alguém da empresa aprovar. A tela
 * diz isso no fim, para a espera não parecer defeito.
 */
export function CadastroPublicoForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<EmpresaPublica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    getEmpresaPorSlug(slug)
      .then(setEmpresa)
      .catch(() => setLinkInvalido(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerAluno({
        empresaSlug: slug,
        nome,
        email,
        senha,
        telefone: telefone || undefined,
      });
      setConcluido(true);
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

  if (linkInvalido) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Este link de cadastro não está disponível. Peça um link novo para a
          sua escola.
        </p>
        <Button type="button" variant="outline" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="font-medium">Cadastro enviado</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {empresa?.nome} vai revisar seu cadastro. Você já pode entrar e ver o
          app, mas só consegue reservar quadra depois que a escola aprovar.
        </p>
        <Button type="button" onClick={() => router.push("/login")}>
          Entrar agora
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome completo</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} className="pl-10" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="pl-10" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="telefone">
          Telefone <span className="font-normal text-[var(--color-text-secondary)]">(opcional)</span>
        </Label>
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={loading} className="pl-10" />
        </div>
      </div>

      <CampoSenha id="senha" label="Crie uma senha" valor={senha} onChange={setSenha} disabled={loading} />

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-[var(--color-text-secondary)]">
        Seu cadastro passa por aprovação da escola antes de você poder
        reservar quadra.
      </p>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Enviando..." : "Criar minha conta"}
      </Button>
    </form>
  );
}
