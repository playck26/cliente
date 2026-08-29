"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import { getMinhaEmpresa, logout, type MinhaEmpresa } from "@/lib/api-client";

// Cabeçalho compartilhado (SPEC-007) — repete em Home/Minhas Aulas/
// Quadras/Minhas Reservas na referência "Performance Court". `iniciais`
// é opcional (a Home já tinha a inicial do aluno; as outras 3 telas não
// tinham esse dado antes e não precisam buscá-lo só pra isso).
export function TopAppBar({ saudacao, iniciais }: { saudacao?: string; iniciais?: string }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<MinhaEmpresa | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    // A chamada é cacheada no módulo: este cabeçalho aparece em quatro
    // telas, e sem o cache cada navegação refaria a requisição.
    getMinhaEmpresa()
      .then((e) => {
        if (vivo) setEmpresa(e);
      })
      .catch(() => {
        // Sem logo o cabeçalho continua inteiro, com a inicial. Erro aqui
        // não merece alarme: nada do que a pessoa veio fazer depende disso.
      });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border">
          {/* SPEC-018/TASK-006 — a marca do CLUBE, não a do PlayCK. O aluno
              abre o app da escola dele; mostrar a marca do fornecedor aqui
              dizia a coisa errada todos os dias. Sem logo, aparece a inicial
              do clube. */}
          <LogoDaEmpresa url={empresa?.logoUrl ?? null} nome={empresa?.nome} className="size-10" />
          <span className="absolute -top-1 -right-1 flex size-3 rounded-full bg-[var(--color-secondary)] ring-2 ring-background" />
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
            {saudacao ? `Olá, ${saudacao}` : iniciais ? `Olá, ${iniciais}` : "PlayCK Club"}
          </p>
          {/* O nome do clube toma o lugar de "PlayCK" pelo mesmo motivo da
              logo. Enquanto ele não chega, "PlayCK" segura o espaço — trocar
              por vazio faria o cabeçalho pular. */}
          <span className="text-2xl leading-none font-extrabold text-[var(--color-primary-strong)]">
            {empresa?.nome ?? "PlayCK"}
          </span>
        </div>
      </div>
      {/*
        **Revisão de 2026-08-29 — o topo ficou com uma coisa só.**

        Saíram dois botões, cada um por um motivo diferente:

        - **o sino**, porque não existe sistema de notificação no backend.
          Ele estava aqui desde a SPEC-007, documentado como "inerte", por
          identidade visual. Ícone que ignora o toque ensina a pessoa a não
          tocar nos outros — e o Israel decidiu tirá-lo até haver o que
          notificar;
        - **o ícone de perfil**, porque `/perfil` foi para a barra de baixo.
          O argumento de ele morar aqui era que a barra era `grid-cols-5`
          com botão central saliente e um sexto item quebraria o desenho.
          O botão saiu; o motivo saiu junto.

        A logo e o nome do clube FICAM (SPEC-018/TASK-006): eles não são
        botão, são a marca da escola do aluno.
      */}
      <button
        type="button"
        aria-label={confirmando ? "Confirmar saída" : "Sair da conta"}
        disabled={saindo}
        onClick={() => {
          if (!confirmando) {
            setConfirmando(true);
            return;
          }
          setSaindo(true);
          // `.catch` antes de navegar, e o mesmo padrão do `perfil-view`:
          // botão "Sair" que não sai porque a rede caiu é pior que não ter
          // botão. A sessão local é encerrada de qualquer forma.
          void logout()
            .catch(() => undefined)
            .finally(() => router.replace("/login"));
        }}
        className={`flex h-11 items-center gap-2 rounded-2xl px-3 text-[13px] font-extrabold shadow-[var(--shadow-low)] ring-1 transition-colors ${
          confirmando
            ? "bg-[var(--color-primary-strong)] text-white ring-transparent"
            : "bg-surface text-[var(--color-text-secondary)] ring-border hover:text-[var(--color-primary-strong)]"
        }`}
      >
        <LogOut className="size-5" aria-hidden="true" />
        {/*
          A confirmação é o próprio botão virando "Sair da conta?" — e não um
          diálogo. Este botão aparece em TODA tela e fica na altura do
          polegar: um toque acidental derrubaria a sessão, e quem não lembra
          a senha depende do clube para voltar (não há recuperação por
          e-mail, ADR-013). Dois toques deliberados custam pouco; a saída
          acidental custa uma ligação.
        */}
        {confirmando ? "Sair da conta?" : null}
      </button>
    </header>
  );
}
