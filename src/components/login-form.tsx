"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        result.usuario.senhaTemporaria ? "/primeiro-acesso" : "/home",
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
            {/* "Esqueceu a senha?" é só visual nesta spec (SPEC-007) — não
                existe fluxo de recuperação de senha no backend ainda; mesmo
                tratamento dado ao sino de notificação (elemento presente,
                sem ação real, não finge uma feature que não existe). */}
            <span className="mt-1 self-end text-xs font-medium text-[var(--color-primary)] opacity-60">
              Esqueceu a senha?
            </span>
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
          {/* "Cadastre-se" é só visual nesta spec (SPEC-007, achado da
              validação cruzada — Codex) — igual "Esqueceu a senha?", não
              existe cadastro público de aluno no backend (aluno é criado
              só pelo admin, sem senha inicial). Elemento presente pra
              fidelidade com a referência, sem fingir uma feature que não
              existe. */}
          <p className="mt-2 text-center text-sm text-[var(--color-text-secondary)]">
            Ainda não tem conta?{" "}
            <span className="font-semibold text-[var(--color-primary)] opacity-60">Cadastre-se</span>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
