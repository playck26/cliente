"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { FotoDePerfil } from "@/components/foto-de-perfil";
import { MinhaCarteira } from "@/components/minha-carteira";
import { TopAppBar } from "@/components/top-app-bar";
import { getMe, logout, type Usuario } from "@/lib/api-client";

/**
 * SPEC-018/TASK-003 — a página que hospeda a foto de perfil.
 *
 * **Ela é deliberadamente pequena.** A spec é explícita sobre o que NÃO
 * entra: logout e dados da conta são outra demanda do Israel, sem
 * dependência de storage, e saem em spec própria. Encher esta tela agora
 * seria misturar escopo — e uma tela de perfil "quase completa" é mais
 * difícil de terminar depois que uma que só faz uma coisa.
 *
 * **DEF-011 (2026-08-26) — esta é a única tela que aluno e professor
 * dividem**, e era por ela que o professor ficava preso: a barra de baixo
 * era a do aluno, e o servidor recusa todos os itens dela. Agora ela passa
 * o papel, e o `BottomNav` decide.
 */
export function PerfilView() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    getMe()
      .then((u) => {
        if (vivo) setUsuario(u);
      })
      .catch(() => {
        // Nome é enfeite aqui: sem ele a foto continua funcionando, e a
        // sessão inválida já é tratada pelo `authFetch`, que desvia para o
        // login. Mostrar um erro por causa do nome seria alarme falso.
      });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <TopAppBar saudacao={usuario?.nome} />

      <main className="mx-auto flex max-w-[390px] flex-col gap-6 px-5 pt-2">
        <header>
          <h1 className="text-2xl font-extrabold text-[var(--color-primary-strong)]">
            Seu perfil
          </h1>
          {usuario ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {usuario.nome} · {usuario.email}
            </p>
          ) : null}
        </header>

        <FotoDePerfil nome={usuario?.nome} />

        {/*
          SPEC-033/TASK-006 — a carteira mora aqui, e não numa aba própria.

          Acrescentar um quinto item na barra de baixo para uma tela que
          mostra dois números seria pagar navegação por conteúdo — e a barra
          é o recurso mais escasso desta interface. O perfil já é "sua
          conta", que é onde saldo pertence.

          **Ela some sozinha para quem não tem carteira** (professor e gestor
          logados aqui): o componente devolve `null` no `404` e no `403`, em
          vez de pintar erro para quem não deveria ver nada.

          **E aqui ela nem é montada para quem não é aluno.** O componente
          sozinho não bastou, e o defeito foi visto em produção: a rota tem
          `@Roles('aluno')`, então o professor recebia `403` — não `404` — e
          caía no ramo de erro, com "não foi possível carregar sua carteira"
          em vermelho no perfil dele.

          As duas defesas são de propósito. Esta evita a requisição inteira:
          não se faz uma pergunta cuja resposta já se sabe. A do componente é
          a rede de baixo, para quando alguém montá-lo em outro lugar.
        */}
        {usuario?.role === "aluno" ? <MinhaCarteira /> : null}

        {/*
          O "Sair" fica no fim, separado, e é a única ação destrutiva desta
          tela. Perto dos botões da foto, o dedo erraria.

          `router.replace` e não `push`: depois de sair, "voltar" não pode
          devolver a tela de quem saiu.
        */}
        <div className="mt-2 border-t border-border pt-5">
          <button
            type="button"
            disabled={saindo}
            onClick={() => {
              setSaindo(true);
              // `.catch` antes do `.finally`: o `logout()` de produção já
              // engole o erro, mas depender disso deixaria uma rejeição não
              // tratada no dia em que ele parar de engolir. O redirecionamento
              // acontece nos dois caminhos.
              void logout()
                .catch(() => undefined)
                .finally(() => router.replace("/login"));
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[var(--color-error)] ring-1 ring-border transition-colors hover:bg-[var(--color-error)]/5 disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {saindo ? "Saindo..." : "Sair da conta"}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--color-text-secondary)]">
            Você precisará entrar de novo com e-mail e senha.
          </p>
        </div>
      </main>

      {/*
        O papel vai como prop, e não é o `BottomNav` que busca: esta tela já
        chama `getMe()` para o nome, e uma segunda ida ao servidor dentro da
        barra faria toda página com barra pagar por isso.

        `undefined` enquanto carrega dá a barra do aluno por um instante, e é
        o certo: aluno é a maioria, e trocar cinco itens por dois depois que
        a tela desenhou pisca mais do que o contrário.
      */}
      <BottomNav papel={usuario?.role} />
    </div>
  );
}
