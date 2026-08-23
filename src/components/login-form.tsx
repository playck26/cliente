"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      // SPEC-009/AC-008: conta com senha temporária não acessa mais nada
      // até trocá-la (INV-008). Mandar direto para a Home só produziria
      // uma tela de erro; o servidor barraria tudo de qualquer forma.
      router.push(
        result.usuario.senhaTemporaria
          ? "/primeiro-acesso"
          : rotaInicial(result.usuario.role),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="relative w-full max-w-[420px] overflow-hidden rounded-2xl p-2 shadow-[var(--shadow-elevated)]">
      {/* Textura decorativa "linhas de quadra" (SPEC-007) — CSS puro, sem
          asset; grade 2x2 (não repetida em ladrilho), mais próxima da
          referência do que um grid denso repetido. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-32 w-32 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 2px, transparent 2px), linear-gradient(90deg, currentColor 2px, transparent 2px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* justify-items-center além de items-center: CardHeader é um CSS
          grid (ver ui/card.tsx), então items-center só centraliza no eixo
          vertical — sem justify-items-center, o ícone (largura fixa,
          size-16) fica alinhado à esquerda da coluna do grid em vez de
          centralizado (achado da validação cruzada, Codex). */}
      <CardHeader className="items-center justify-items-center text-center">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-[var(--color-primary)]">
          <TennisBallIcon className="size-8" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Entrar</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Suas aulas e reservas de quadra — PlayCK</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11 pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <Input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={loading}
                className="h-11 pr-9 pl-9"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {/* DEF-003 — continua não existindo recuperação automática de
                senha (GAP-004, e-mail transacional). O que mudou é que o
                elemento parou de ser decorativo: em vez de não fazer nada,
                ele diz à pessoa qual é o caminho que existe hoje. Texto
                morto e caminho real levam ao mesmo lugar visualmente, e a
                pessoa não tem como saber qual é qual. */}
            <button
              type="button"
              onClick={() => setAjudaSenha((v) => !v)}
              aria-expanded={ajudaSenha}
              className="mt-1 self-end text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Esqueceu a senha?
            </button>
            {ajudaSenha ? (
              <p className="mt-1 rounded-lg bg-[var(--color-primary-container)]/40 p-3 text-xs text-[var(--color-text-secondary)]">
                Ainda não enviamos e-mail de recuperação. Peça ao seu clube
                para gerar uma senha nova — ela chega por WhatsApp e você
                troca no primeiro acesso.
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="mt-2 h-[52px] gap-2 text-base font-semibold">
            {loading ? "Entrando..." : "Entrar"}
            {!loading ? <ArrowRight className="size-4" /> : null}
          </Button>
          {/* DEF-003 — este texto era um `<span>` morto desde a SPEC-007, e
              o comentário que o justificava dizia que não existia cadastro
              público de aluno. Era verdade quando foi escrito; deixou de
              ser em 22/08, quando a SPEC-009 subiu os três caminhos de
              criação de conta. Ninguém voltou aqui, e o usuário tocava num
              texto que não levava a lugar nenhum. */}
          <p className="mt-2 text-center text-sm text-[var(--color-text-secondary)]">
            Ainda não tem conta?{" "}
            <Link
              href="/cadastro"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Cadastre-se
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
