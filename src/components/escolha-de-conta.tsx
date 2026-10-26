"use client";

import { ChevronRight } from "lucide-react";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import type { ContaDaRedefinicao } from "@/lib/api-client";

/**
 * SPEC-090 (D9, I2) — **qual conta vai ter a senha redefinida.**
 *
 * O link do e-mail cobre todas as contas daquele e-mail (uma por clube), e a
 * pessoa escolhe **uma**: o link serve uma vez, para uma conta (I6).
 *
 * ## Componente próprio, e não o `EscolhaDeEmpresa`
 *
 * O desenho é o da escolha do clube no login (SPEC-086): um cartão inteiro por
 * clube, com logo (ou inicial), nome e papel. Mas o `escolha-de-empresa.tsx`
 * tem quatro textos de login fixos — título, apoio, o `aria-label` "Entrar em
 * …" e o "Usar outro e-mail" — e é congelado pelos testes da 086.
 * Parametrizá-lo mexeria nele para ganhar pouco; aqui nenhum texto é de login.
 *
 * - **Sem card bloqueado (I8):** a conta que não aceita mais o link já não vem
 *   do servidor.
 * - **Sem botão de voltar:** não há para onde voltar além do e-mail. Quem
 *   precisa de outro link chega a ele pelo estado de link inválido.
 * - O nome do clube quebra em linhas em vez de cortar (40 caracteres em
 *   360 px, sem rolagem lateral), como na 086.
 *
 * As cores são as do `AuthShell` (cartão claro do tema), e não as do login
 * fotográfico: esta tela mora na moldura das telas públicas de conta.
 */

const NOME_DO_PAPEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
  company_admin: "Gestor",
};

/** O nome do papel para gente; um papel desconhecido aparece como veio. */
export function nomeDoPapel(papel: string): string {
  return NOME_DO_PAPEL[papel] ?? papel;
}

const FOCO =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2";

export interface EscolhaDeContaProps {
  contas: readonly ContaDaRedefinicao[];
  onEscolher: (usuarioId: string) => void;
}

export function EscolhaDeConta({ contas, onEscolher }: EscolhaDeContaProps) {
  return (
    <section aria-labelledby="titulo-da-escolha-de-conta" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          id="titulo-da-escolha-de-conta"
          className="text-lg leading-tight font-extrabold text-[var(--color-text-primary)]"
        >
          Qual conta vai ter a senha redefinida?
        </h2>
        <p className="text-sm leading-snug text-[var(--color-text-secondary)]">
          Seu e-mail tem conta em mais de um clube.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {contas.map((conta) => {
          const papel = nomeDoPapel(conta.papel);
          return (
            <li key={conta.usuarioId}>
              <button
                type="button"
                onClick={() => onEscolher(conta.usuarioId)}
                aria-label={`Redefinir a senha de ${conta.empresa.nome}, como ${papel}`}
                className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-container)] ${FOCO}`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-[var(--color-border)]"
                >
                  <LogoDaEmpresa url={conta.empresa.logoUrl} nome={conta.empresa.nome} className="size-11" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  {/* React escapa o texto: o nome vem do banco e nunca vira HTML. */}
                  <span className="text-base leading-snug font-extrabold break-words text-[var(--color-text-primary)]">
                    {conta.empresa.nome}
                  </span>
                  <span className="text-sm leading-snug font-bold text-[var(--color-primary-strong)]">
                    {papel}
                  </span>
                </span>
                <ChevronRight className="size-6 shrink-0 text-[var(--color-primary-strong)]" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
