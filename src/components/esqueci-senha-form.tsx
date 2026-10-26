"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, pedirRedefinicaoDeSenha } from "@/lib/api-client";

/**
 * SPEC-090 (D1, D9) — a frase depois do pedido, **sempre a mesma**, com conta
 * ou sem conta: o servidor responde `202` antes de olhar o banco, e a tela
 * não tem como (nem deve) dizer mais que isso.
 */
export const TEXTO_DO_PEDIDO_ENVIADO =
  "Se houver conta com este e-mail, enviamos um link para redefinir a senha. Ele vale por 1 hora. Confira também o spam.";

/**
 * SPEC-090 — **a página de pedir o link para redefinir a senha.**
 *
 * Um campo de e-mail. Ao enviar:
 *
 * - `202` → a frase de `TEXTO_DO_PEDIDO_ENVIADO`, para qualquer e-mail. O
 *   formulário sai: mandar de novo o mesmo pedido só gastaria o limite;
 * - `429` → a mensagem do servidor, e o formulário fica;
 * - `400` (e-mail malformado) → pede para conferir o e-mail;
 * - falha de rede ou `5xx` → pede para tentar de novo. Não diz que enviou:
 *   o pedido pode nem ter chegado.
 *
 * "Voltar ao login" está nos dois estados.
 */
export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    const digitado = email.trim();
    if (!digitado) {
      setErro("Digite o e-mail da sua conta.");
      return;
    }
    setEnviando(true);
    try {
      await pedirRedefinicaoDeSenha({ email: digitado });
      setEnviado(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setErro(e.message);
      } else if (e instanceof ApiError && e.status === 400) {
        setErro("Confira o e-mail digitado.");
      } else {
        setErro("Não foi possível pedir o link agora. Tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  const voltar = (
    <Link
      href="/login"
      className="flex min-h-11 items-center justify-center gap-2 self-center rounded-lg px-2 text-sm font-bold text-[var(--color-primary-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Voltar ao login
    </Link>
  );

  if (enviado) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          className="flex items-start gap-3 rounded-lg bg-[var(--color-primary-container)]/40 p-3 text-sm leading-snug"
        >
          <MailCheck className="mt-px size-5 shrink-0 text-[var(--color-primary-strong)]" aria-hidden="true" />
          <span className="min-w-0">{TEXTO_DO_PEDIDO_ENVIADO}</span>
        </p>
        {voltar}
      </div>
    );
  }

  return (
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
            disabled={enviando}
            className="pl-10"
          />
        </div>
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2 w-full">
        {enviando ? "Enviando..." : "Enviar link"}
      </Button>

      {voltar}
    </form>
  );
}
