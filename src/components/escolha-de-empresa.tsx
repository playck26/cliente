"use client";

import { ArrowLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import type { OpcaoDeEmpresa } from "@/lib/api-client";

/**
 * SPEC-086 — **a tela de escolha do clube, quando a senha abriu mais de uma
 * conta.**
 *
 * Mora no lugar do formulário, dentro do mesmo bloco do login fotográfico
 * (SPEC-084): a foto, a marca e os véus continuam os da página, e as cores
 * são as do formulário (verde-lima `#B9E52B` para ação e foco; superfícies
 * escuras translúcidas com borda de 2 px — a mesma razão de contraste medida
 * lá vale aqui).
 *
 * Cada clube é um botão inteiro: logo (ou inicial), nome e papel. O nome
 * quebra em linhas em vez de cortar (AC-016: 40 caracteres em 360 px, sem
 * rolagem lateral). A logo vai num quadro claro porque logos de clube são
 * desenhadas para fundo branco, e sumiriam sobre a superfície escura.
 *
 * **Senha expirada (I6):** o clube aparece, mas não é botão — um cartão com
 * borda tracejada, cadeado e o que fazer. Não some por opacidade: a regra do
 * login é que nada fique ilegível por estar indisponível.
 */

const FOCO =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#B9E52B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D10]";

const NOME_DO_PAPEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
};

export interface EscolhaDeEmpresaProps {
  empresas: readonly OpcaoDeEmpresa[];
  /** O `usuarioId` cuja entrada está em andamento; `null` quando nenhuma. */
  entrando: string | null;
  onEscolher: (usuarioId: string) => void;
  onVoltar: () => void;
}

export function EscolhaDeEmpresa({
  empresas,
  entrando,
  onEscolher,
  onVoltar,
}: EscolhaDeEmpresaProps) {
  const ocupado = entrando !== null;

  return (
    <section aria-labelledby="titulo-da-escolha" className="flex flex-col gap-4">
      {/* A sombra escura atrás do título e do apoio: em 360 px eles passam por
          cima das bolas amarelas da foto, e o branco perderia contraste ali. */}
      <div className="flex flex-col gap-1 [text-shadow:0_1px_2px_rgb(0_0_0/0.9),0_0_10px_rgb(0_0_0/0.75)]">
        <h2 id="titulo-da-escolha" className="text-xl leading-tight font-extrabold text-white">
          Em qual clube você quer entrar?
        </h2>
        <p className="text-sm leading-snug font-medium text-white/85">
          Seu e-mail tem acesso a mais de um clube.
        </p>
      </div>

      <ul className="flex flex-col gap-3" aria-busy={ocupado}>
        {empresas.map((empresa) => {
          const papel = NOME_DO_PAPEL[empresa.papel] ?? empresa.papel;
          const conteudo = (
            <>
              <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                <LogoDaEmpresa url={empresa.logoUrl} nome={empresa.empresaNome} className="size-11" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="text-base leading-snug font-extrabold break-words text-white">
                  {empresa.empresaNome}
                </span>
                <span className="text-sm leading-snug font-bold text-[#B9E52B]">{papel}</span>
              </span>
            </>
          );

          if (empresa.situacao === "senha_expirada") {
            return (
              <li key={empresa.usuarioId}>
                <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-white/45 bg-black/55 p-3">
                  <div className="flex items-center gap-3">
                    {conteudo}
                    <LockKeyhole className="size-5 shrink-0 text-white/85" aria-hidden="true" />
                  </div>
                  <p className="rounded-xl bg-[#161A1D] px-3 py-2 text-sm leading-snug font-semibold text-[#E6EAE3]">
                    Senha expirada — peça uma nova ao gestor.
                  </p>
                </div>
              </li>
            );
          }

          const esta = entrando === empresa.usuarioId;
          return (
            <li key={empresa.usuarioId}>
              <button
                type="button"
                onClick={() => onEscolher(empresa.usuarioId)}
                disabled={ocupado}
                aria-label={`Entrar em ${empresa.empresaNome}, como ${papel}`}
                className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border-2 border-white/45 bg-black/55 p-3 transition-colors hover:border-[#B9E52B] hover:bg-black/65 disabled:cursor-wait ${FOCO}`}
              >
                {conteudo}
                {esta ? (
                  <span className="shrink-0 text-sm font-extrabold text-[#B9E52B]">Entrando...</span>
                ) : (
                  <ChevronRight className="size-6 shrink-0 text-[#B9E52B]" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onVoltar}
        disabled={ocupado}
        className={`flex min-h-11 items-center gap-2 self-start rounded-lg px-1 text-sm font-extrabold text-[#B9E52B] ${FOCO}`}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Usar outro e-mail
      </button>
    </section>
  );
}
