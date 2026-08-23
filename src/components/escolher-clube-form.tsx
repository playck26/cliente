"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * DEF-003 — a porta que faltava para o auto-cadastro.
 *
 * A SPEC-009 entregou `/cadastro/<slug>` e nada no app levava até lá: o
 * "Cadastre-se" do login era um `<span>` morto desde a SPEC-007, com um
 * comentário dizendo que não existia cadastro público — verdade em julho,
 * mentira desde 22/08.
 *
 * Esta tela existe porque o login **não sabe de qual clube a pessoa é**. O
 * caminho principal continua sendo o link que o clube divulga; aqui é a
 * entrada de quem chegou pelo app e não tem o link em mãos.
 */
export function EscolherClubeForm() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  /**
   * Aceita o que a pessoa realmente tem em mãos: o link inteiro colado do
   * WhatsApp, com ou sem `https://`, ou só o nome do clube. Reduzir tudo ao
   * slug aqui evita mandá-la para `/cadastro/https%3A%2F%2F...`.
   */
  function normalizar(entrada: string): string {
    const limpo = entrada.trim().toLowerCase();
    const depoisDaBarra = limpo.includes("/cadastro/")
      ? limpo.slice(limpo.lastIndexOf("/cadastro/") + "/cadastro/".length)
      : limpo;

    return depoisDaBarra
      .split(/[?#]/)[0]
      .replace(/^\/+|\/+$/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = normalizar(codigo);
    if (!slug) {
      return;
    }

    // Sem conferir o código aqui de propósito. `GET /public/companies/:slug`
    // tem limite de 10 chamadas por 15 minutos (NFR-001), e conferir antes
    // gastaria duas por tentativa — quem errasse o nome duas vezes ficaria
    // trancado do lado de fora. A tela de destino já faz essa única consulta
    // e já trata o código inválido.
    router.push(`/cadastro/${encodeURIComponent(slug)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="codigo">Código do clube</Label>
        <div className="relative">
          <Building2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <Input
            id="codigo"
            name="codigo"
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ex.: smart-tennis"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Pode colar o link de cadastro que o clube enviou.
        </p>
      </div>

      <Button
        type="submit"
        disabled={!codigo.trim()}
        className="h-[52px] text-base font-semibold"
      >
        Continuar
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Não tem o código? Peça ao seu clube o link de cadastro.
      </p>
    </form>
  );
}
