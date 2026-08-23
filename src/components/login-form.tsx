"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { CourtLines } from "@/components/court-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api-client";
import { rotaInicial } from "@/lib/rota-inicial";
import { saveAccessToken } from "@/lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ajudaSenha, setAjudaSenha] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, senha });
      saveAccessToken(result.accessToken);
      router.push(result.usuario.senhaTemporaria ? "/primeiro-acesso" : rotaInicial(result.usuario.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-5 pb-14 text-white shadow-[var(--shadow-lift)]">
        <CourtLines className="opacity-35" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-16 shrink-0 items-center justify-center">
                <Image
                  src="/playck-logo.png"
                  alt="Logo PlayCK"
                  width={64}
                  height={64}
                  className="size-16 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)]"
                  priority
                />
              </span>
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-white/65 uppercase">PlayCK Club</p>
                <p className="text-2xl leading-none font-extrabold">PlayCK</p>
              </div>
            </div>
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.1em] text-white/80 uppercase ring-1 ring-white/15">Aluno</span>
          </div>
          <h1 className="mt-8 max-w-[280px] text-[34px] leading-[1.02] font-extrabold">Entre em quadra com tudo organizado.</h1>
          <p className="mt-3 max-w-[310px] text-sm font-semibold text-white/72">Aulas, reservas e horários do seu clube em um só lugar.</p>
        </div>
      </section>

      <section className="relative z-20 -mt-8 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-border">
        <div className="mb-5">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-primary-strong)] uppercase">Bem-vindo de volta</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--color-text-primary)]">Acesse sua conta</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-bold">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="h-12 rounded-2xl bg-[var(--color-surface-container)] pl-12" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha" className="text-sm font-bold">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <Input id="senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} disabled={loading} className="h-12 rounded-2xl bg-[var(--color-surface-container)] pr-12 pl-12" />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-primary-strong)]" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>
                {mostrarSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            <button type="button" onClick={() => setAjudaSenha((v) => !v)} aria-expanded={ajudaSenha} className="min-h-11 self-end px-1 text-xs font-extrabold text-[var(--color-primary-strong)]">
              Esqueceu a senha?
            </button>
            {ajudaSenha ? (
              <p className="rounded-2xl bg-[var(--color-primary-container)]/55 p-3 text-xs font-medium text-[var(--color-text-secondary)]">
                Ainda não enviamos e-mail de recuperação. Peça ao seu clube para gerar uma senha nova; ela chega por WhatsApp e você troca no primeiro acesso.
              </p>
            ) : null}
          </div>

          {error ? <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">{error}</p> : null}

          <Button type="submit" disabled={loading} className="h-12 rounded-2xl text-[15px] font-extrabold shadow-[var(--shadow-glow)]">
            {loading ? "Entrando..." : "Entrar"}
            {!loading ? <ArrowRight className="size-5" aria-hidden="true" /> : null}
          </Button>
          <p className="text-center text-sm font-medium text-[var(--color-text-secondary)]">
            Ainda não tem conta? <Link href="/cadastro" className="font-extrabold text-[var(--color-primary-strong)]">Cadastre-se</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
