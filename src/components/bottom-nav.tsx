"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Plus, User, Users } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import type { Papel } from "@/lib/api-client";
import { getPapel } from "@/lib/auth-storage";

// Navegação inferior (tab bar) — padrão de mobile do app do aluno
// (DESIGN.md, seção Responsividade: "Cliente: navegação inferior (tab
// bar)"). Altura 80px e ícone lucide por item — SPEC-007 (design system
// "Performance Court"). Alvo de toque ~44px+ preservado (acessibilidade).
/**
 * SPEC-022 — **de cinco colunas para quatro, e de quatro destinos para
 * três.**
 *
 * A barra antiga tinha "Quadras" e "Reservas" lado a lado, e o botão grande
 * do meio levava ao mesmo lugar que "Quadras" — duas entradas para uma tela.
 * Agora `/quadras` e `/reservas` são uma tela só com duas abas, e a barra
 * oferece Home, Aulas e Reservas.
 *
 * **O botão "Reservar" ficou**, e a razão é de produto: reservar quadra é a
 * ação principal do app. O pedido era simplificar o menu, não tirar o
 * atalho da ação. O que ele perdeu foi a redundância — hoje é o único jeito
 * de cair direto na aba de quadras.
 */
const ITENS_ESQUERDA = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/minhas-aulas", label: "Aulas", Icon: TennisBallIcon },
] as const;

const ITENS_DIREITA = [
  { href: "/reservas", label: "Reservas", Icon: CalendarCheck },
] as const;

/** O atalho de um toque para escolher quadra (SPEC-022/REQ-002). */
const DESTINO_DE_RESERVAR = "/reservas?aba=quadras";

/**
 * DEF-011 (2026-08-26) — **a barra do professor.**
 *
 * O professor entrava em `/perfil` para trocar a própria foto e **ficava
 * preso**: aquela tela renderizava a barra do aluno, e o servidor recusa os
 * cinco itens dela — `/home`, `/minhas-aulas`, `/quadras` e `/reservas`
 * são `@Roles('aluno')`. Pior: `/minhas-turmas`, que é a tela dele,
 * **não estava na barra**, então não havia por onde voltar.
 *
 * `minhas-turmas-view` já tinha decidido certo e escrito o porquê: *"com os
 * itens do aluno seria mentira, porque o servidor recusa todos eles"*. O
 * defeito foi `perfil-view` não conhecer essa decisão — ela morava num
 * comentário de outro arquivo, não no componente que desenha a barra.
 *
 * **Por isso a regra passou para cá.** Tela nova que renderize
 * `<BottomNav>` sem pensar em papel agora acerta sozinha; antes, errava
 * sozinha.
 *
 * São dois itens, e os dois são reais — o professor alcança
 * `/me/teacher/classes` e `/me/foto`. A objeção da `minhas-turmas-view`
 * era contra barra de **um** item, que é decoração, e contra a do aluno,
 * que seria mentira. Nenhuma das duas se aplica aqui.
 */
/** O `subscribe` do `useSyncExternalStore`, declarado fora para ter identidade estável. */
const NAO_MUDA = () => () => {};

const ITENS_DO_PROFESSOR = [
  { href: "/minhas-turmas", label: "Turmas", Icon: Users },
  { href: "/perfil", label: "Perfil", Icon: User },
] as const;

/**
 * **A barra nunca adivinha** (correção de 2026-08-26, à noite).
 *
 * A primeira versão do DEF-011 desenhava a do aluno enquanto o papel era
 * `undefined`, com o argumento de que aluno é a maioria. **Estava errado, e
 * o Israel viu:** no painel do professor a barra do aluno aparecia por um
 * segundo antes de virar a certa. Um menu que pisca e some é pior que menu
 * nenhum — a pessoa toca no que viu, e o alvo já mudou.
 *
 * Agora são três fontes, nesta ordem:
 *
 * 1. a **prop**, quando a tela sabe quem está lá (`/minhas-turmas` é do
 *    professor por definição — o servidor não deixa mais ninguém entrar);
 * 2. o `localStorage`, gravado no login. Cobre `/perfil`, a única tela que
 *    os dois dividem, já na primeira pintura;
 * 3. **nada** — a barra sai vazia, com a mesma altura. É o caso da sessão
 *    antiga, de antes desta versão: some no próximo login, e até lá a
 *    pessoa não vê um menu que não é dela.
 */
export function BottomNav({ papel }: { papel?: Papel }) {
  const pathname = usePathname();
  // `useSyncExternalStore` e não `useState` + `useEffect`: o
  // `localStorage` não existe no servidor, e ler no corpo do componente
  // quebraria a hidratação. Este hook existe exatamente para isto — o
  // terceiro argumento é o que o SERVIDOR vê (`null`, "não sei"), e o
  // segundo é o que o navegador vê.
  //
  // O `subscribe` não faz nada: o papel só muda no login e no logout, e os
  // dois navegam para outra página. Assinar o evento `storage` seria
  // reagir a uma mudança feita em OUTRA aba, que não é o caso de uso.
  const doArmazenamento = useSyncExternalStore(
    NAO_MUDA,
    () => getPapel(),
    () => null,
  );

  const efetivo = papel ?? doArmazenamento;

  if (efetivo === "professor") {
    return <NavDoProfessor pathname={pathname} />;
  }

  if (efetivo === null) {
    return <NavVazia />;
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto grid h-[78px] max-w-[390px] grid-cols-4 items-center gap-1 rounded-[28px] bg-[var(--color-court-dark)]/95 p-2 text-white shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-white/10 backdrop-blur-xl"
    >
      {ITENS_ESQUERDA.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]" : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon className="size-[23px]" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
      <Link
        href={DESTINO_DE_RESERVAR}
        aria-label="Reservar quadra"
        className="-mt-8 flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold text-white"
      >
        <span className="flex size-16 items-center justify-center rounded-[24px] bg-[var(--color-primary-strong)] text-white shadow-[var(--shadow-glow)] ring-4 ring-background transition-transform active:scale-95">
          <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
        </span>
        Reservar
      </Link>
      {ITENS_DIREITA.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]" : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon className="size-[23px]" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Duas colunas em vez de cinco, e **sem o botão de reservar**: o professor
 * não reserva quadra. Um botão grande no meio que leva a 403 é pior que
 * botão nenhum — ele convida.
 */
function NavDoProfessor({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto grid h-[78px] max-w-[390px] grid-cols-2 items-center gap-1 rounded-[28px] bg-[var(--color-court-dark)]/95 p-2 text-white shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-white/10 backdrop-blur-xl"
    >
      {ITENS_DO_PROFESSOR.map(({ href, label, Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition-colors ${
              ativo
                ? "bg-white font-extrabold text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                : "text-white/60 hover:text-white"
            }`}
            aria-current={ativo ? "page" : undefined}
          >
            <Icon
              className="size-[23px]"
              strokeWidth={ativo ? 2.5 : 2}
              aria-hidden="true"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * A barra sem itens, do tamanho da barra de verdade.
 *
 * **Não é estado de carregamento normal** — ela só aparece para sessão
 * aberta antes de o papel passar a ser guardado no login. Ocupa o mesmo
 * espaço para a tela não pular quando a barra certa entrar.
 */
function NavVazia() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto h-[78px] max-w-[390px] rounded-[28px] bg-[var(--color-court-dark)]/95 shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-white/10 backdrop-blur-xl"
    />
  );
}
