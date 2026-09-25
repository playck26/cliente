"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import {
  CalendarioDoAluno,
  deAula,
  deReserva,
  janelaDoMes,
  type Compromisso,
} from "@/components/calendario-do-aluno";
import { CartaoDaProximaAula } from "@/components/cartao-da-proxima-aula";
import { TopAppBar } from "@/components/top-app-bar";
import { getPapel } from "@/lib/auth-storage";
import { hojeNoClube } from "@/lib/fuso";
import {
  NOMES_PADRAO,
  lerNomesDeTipo,
  nomesGuardados,
  type NomesDeTipo,
} from "@/lib/nomes-de-tipo";
import {
  ApiError,
  getMe,
  listMyBookings,
  listMyClasses,
  type MyClass,
  type Usuario,
} from "@/lib/api-client";

/** O `subscribe` do `useSyncExternalStore`: o papel só muda no login e no logout, e os dois navegam. */
const NAO_MUDA = () => () => {};

/**
 * SPEC-073/D1 — **aulas e reservas saem juntas**, e antes saíam em fila: as
 * reservas só eram pedidas depois que as aulas chegavam. `allSettled`, e não
 * `all`, pela SPEC-059/D5 — a falha de uma não derruba a outra — e porque ela
 * nunca rejeita: a busca adiantada pode ser largada sem virar erro solto.
 */
function buscarAgenda(janela: { de: string; ate: string }) {
  return Promise.allSettled([listMyClasses(janela), listMyBookings(janela)]);
}

/**
 * SPEC-005/REQ-001 — a primeira tela do aluno.
 *
 * **SPEC-058 — o cartão voltou, e a semana virou calendário.** O Israel usou
 * a home em produção e pediu as duas coisas: um calendário *"parecido com o
 * do professor, só que mais atrativo"* e o cartão de volta, *"muito mais
 * moderno… trazendo os insights mais importantes"*. O cartão novo não repete
 * a agenda logo abaixo — ele diz **quanto falta** para a próxima aula, que é
 * o que a grade não diz.
 *
 * **SPEC-057/TASK-003 (card 5353) — a home abriu na AGENDA.** O que saiu, e
 * por quê:
 *
 * - **A faixa de atalhos.** Dos três, dois eram duplicata literal do menu
 *   inferior — mesmo rótulo, mesmo destino e **mesmo ícone** (`Aulas` →
 *   `/minhas-aulas`, `Reservas` → `/reservas`). Sobraria "Reservar", e faixa
 *   de um item é decoração: o precedente é a SPEC-052/D7, que **removeu** a
 *   faixa equivalente do painel do gestor em vez de encolhê-la.
 * - **O card "Sua agenda".** Ele contava aulas ("3 aulas programadas") e
 *   oferecia "Abrir agenda". Com a agenda aberta logo acima, virou um
 *   contador de uma lista visível.
 * - **O hero "Próxima aula".** Repetia o primeiro item da semana. Com ele, a
 *   mesma aula aparecia duas vezes na mesma tela.
 *
 * **O que NÃO saiu, e é o detalhe que importa:** o aviso de falha da agenda
 * morava *dentro* do hero. Removê-lo junto faria a falha voltar a ser
 * silenciosa — o mesmo defeito do DEF-033, noutra tela. Ele agora tem lugar
 * próprio.
 *
 * **A semana não custa rede:** a home já buscava `/me/classes` para contar as
 * aulas. É o mesmo dado, agora desenhado.
 */
export function HomeView() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  /**
   * SPEC-058 — **duas listas, uma requisição.**
   *
   * O cartão precisa da PRÓXIMA aula, que pode cair no mês que vem; o
   * calendário precisa do MÊS, que inclui dias já passados. Uma lista só não
   * serve para os dois: a do mês esconderia a próxima aula de quem está no
   * fim de setembro, e a das próximas deixaria o mês sem o passado.
   *
   * A primeira busca cobre os dois — do primeiro dia do mês até 60 dias à
   * frente — e alimenta as duas listas. Depois disso, trocar de mês troca só
   * a do calendário: o cartão continua apontando para a próxima aula de
   * verdade, e não para a do mês que o aluno foi espiar.
   */
  const [aulasDoCartao, setAulasDoCartao] = useState<MyClass[]>([]);
  /**
   * SPEC-059 — **a agenda do mês passa a ter as três origens.**
   *
   * O cartão continua olhando só as AULAS (o insight que o Israel escolheu é
   * "sua próxima aula", não "seu próximo compromisso"); a grade abaixo mistura
   * aula de turma, aula particular e reserva de quadra, porque calendário que
   * esconde compromisso não serve para se organizar.
   */
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [agendaIndisponivel, setAgendaIndisponivel] = useState(false);
  const [reservasIndisponiveis, setReservasIndisponiveis] = useState(false);
  /**
   * SPEC-059/D3b — o termo do clube para cada tipo. Começa pelo que já está
   * guardado (SPEC-059: memória de rótulo) para a agenda não trocar palavra
   * na cara de quem lê, e confere com o servidor logo depois.
   */
  const [nomes, setNomes] = useState<NomesDeTipo>(
    () => nomesGuardados() ?? NOMES_PADRAO,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * SPEC-073 — o papel gravado no login, lido como a `BottomNav` lê:
   * `useSyncExternalStore`, porque o `localStorage` não existe no servidor e
   * lê-lo no corpo quebraria a hidratação. O servidor vê `null` ("não sei") e
   * desenha o esqueleto de sempre.
   */
  const papelGuardado = useSyncExternalStore(NAO_MUDA, getPapel, () => null);
  /**
   * SPEC-073/D3 — **qual pedido de agenda ainda pinta a grade.** O molde é o
   * DEF-021 do professor: duas setas rápidas, ou uma seta durante a carga
   * inicial, e a resposta velha chegava por último pintando o mês errado.
   */
  const pedidoDaAgenda = useRef(0);

  // DEF-007 (2026-08-24) — três defeitos empilhados, achados em produção:
  //
  // 1. `/me/classes` é `@Roles('aluno')`, mas `rotaInicial()` manda para cá
  //    TODO papel que não é professor — gestor e super admin inclusive. Para
  //    eles a chamada sempre devolveu 403.
  // 2. O `Promise.all` fazia esse 403 derrubar o `getMe()` junto, e a home
  //    inteira — nome, agenda, atalhos — virava uma palavra vermelha.
  // 3. A palavra era "Forbidden", crua do servidor. Ninguém consegue agir
  //    sobre isso.
  //
  // A ordem aqui é deliberada: o `getMe()` decide o que mais vale a pena
  // pedir, e o que é secundário não pode derrubar o que é principal.
  useEffect(() => {
    let vivo = true;
    void lerNomesDeTipo().then((lidos) => {
      if (vivo) setNomes(lidos);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    const hoje = hojeNoClube();
    const daqui60Dias = new Date(
      Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 60),
    )
      .toISOString()
      .slice(0, 10);
    const janela = {
      de: janelaDoMes(hoje.ano, hoje.mes).de,
      ate: daqui60Dias,
    };
    const meuPedido = ++pedidoDaAgenda.current;

    // SPEC-073/D1 — **com o papel guardado de aluno, a agenda não espera o
    // `getMe()`.** Eram três idas em fila (`me` → aulas → reservas), e a do
    // professor é uma. O papel guardado só decide QUANDO pedir: quem decide o
    // que pinta continua sendo o `getMe()` logo abaixo, e o servidor recusa o
    // que não for do papel (INV-073a).
    const adiantada = getPapel() === "aluno" ? buscarAgenda(janela) : null;

    getMe()
      .then(async (usuarioData) => {
        if (!ativo) return;
        setUsuario(usuarioData);

        // Resposta adiantada de quem não é aluno é descartada sem pintar
        // (AC-003). Ela não rejeita — `allSettled` —, então largar a promessa
        // aqui não vira erro solto.
        if (usuarioData.role !== "aluno") return;

        const [aulas, reservas] = await (adiantada ?? buscarAgenda(janela));
        if (!ativo) return;

        if (aulas.status === "rejected") {
          // A agenda é dado secundário: sem ela a home fica de pé, e o
          // aviso ocupa o lugar dela em vez do lugar da tela.
          setAgendaIndisponivel(true);
          return;
        }

        // SPEC-073/D3 — o cartão é SEMPRE desta carga: ele olha a próxima
        // aula, não o mês que o aluno foi espiar enquanto ela chegava.
        setAulasDoCartao(aulas.value);

        // SPEC-059/D5 — **a falha de uma não derruba a outra.** Sem as
        // reservas, a grade mostra as aulas e o aviso ocupa o lugar do que
        // faltou. O teto da varredura é declarado, não escondido: se ele
        // cortou, a tela avisa em vez de mostrar meia agenda como inteira.
        const itensDeReserva =
          reservas.status === "fulfilled" ? reservas.value.itens : [];
        if (reservas.status === "rejected" || reservas.value.truncou) {
          setReservasIndisponiveis(true);
        }

        // A grade, só se nenhuma troca de mês saiu depois desta carga.
        if (pedidoDaAgenda.current === meuPedido) {
          setCompromissos([
            ...aulas.value.map(deAula),
            ...itensDeReserva.map(deReserva),
          ]);
        }
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setError(
          err instanceof ApiError && err.status === 403
            ? "Sua conta não tem acesso a esta área."
            : "Não foi possível carregar a home.",
        );
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const primeiroNome = usuario?.nome.split(" ")[0];
  const ehAluno = usuario?.role === "aluno";
  /**
   * SPEC-073/D2 — **a grade antes do dado.** Enquanto o `getMe()` não volta,
   * o papel guardado basta para DESENHAR (navegação, não autorização — é o
   * mesmo uso que a barra de baixo faz dele). Depois que ele volta, só ele
   * vale.
   */
  const pareceAluno = usuario ? ehAluno : papelGuardado === "aluno";
  const mostrarAgenda = !error && pareceAluno && !agendaIndisponivel;

  return (
    <main className="app-screen min-h-screen overflow-hidden bg-background pb-36">
      <TopAppBar saudacao={primeiroNome} />

      <div className="space-y-6 px-5">
        {error ? (
          <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-low)] ring-1 ring-border">
            <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">
              {error}
            </p>
          </section>
        ) : null}

        {/* **AC-019.** Fora do hero, porque o hero saiu — e este aviso é a
            única coisa que distingue "você não tem aula" de "não consegui
            carregar sua agenda". */}
        {reservasIndisponiveis && !agendaIndisponivel ? (
          <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
            <p role="status" className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
              Suas aulas estão aqui, mas não consegui carregar suas reservas
              agora.
            </p>
          </section>
        ) : null}

        {agendaIndisponivel ? (
          <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
            <p role="status" className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
              Não foi possível carregar sua agenda agora. O resto da home
              continua funcionando.
            </p>
          </section>
        ) : null}

        {/*
          Sem papel guardado (sessão de antes do DEF-011) a home não sabe o
          que desenhar até o `getMe()` voltar: fica o esqueleto de sempre.
        */}
        {loading && !error && !pareceAluno ? (
          <section
            className="h-[420px] animate-pulse rounded-3xl bg-[var(--color-surface-container)]"
            aria-label="Carregando sua agenda"
          />
        ) : null}

        {/*
          SPEC-058/D3 — o cartão vem ANTES do calendário: ele responde "quanto
          falta", que é a pergunta de quem abre o app com pressa. A grade, que
          responde "quando são as outras", vem logo abaixo.

          SPEC-073/D2 — durante a carga, um esqueleto do tamanho do cartão:
          o cartão vazio diria "Nenhuma aula marcada" antes de saber.
        */}
        {mostrarAgenda && loading ? (
          <section
            className="h-[132px] animate-pulse rounded-3xl bg-[var(--color-surface-container)]"
            aria-label="Carregando sua próxima aula"
          />
        ) : null}
        {mostrarAgenda && !loading ? (
          <CartaoDaProximaAula aulas={aulasDoCartao} />
        ) : null}

        {/*
          SPEC-058/D1 — a semana saiu daqui e **continua em `/minhas-aulas`**,
          onde é uma das duas abas e o aluno escolhe. `mostrarLinkDaTurma`
          falso: na home o cartão já leva à turma, e dois caminhos para o
          mesmo lugar na mesma tela foi o que a SPEC-057/D13 tirou.
        */}
        {mostrarAgenda ? (
          <CalendarioDoAluno
            compromissos={compromissos}
            nomes={nomes}
            mostrarLinkDaTurma={false}
            carregando={loading}
            onJanela={(janela) => {
              const meuPedido = ++pedidoDaAgenda.current;
              Promise.all([
                listMyClasses(janela),
                listMyBookings(janela).catch(() => {
                  setReservasIndisponiveis(true);
                  return { itens: [], truncou: false };
                }),
              ])
                .then(([aulas, reservas]) => {
                  // SPEC-073/D3 — resposta de um mês que já saiu da tela
                  // não pinta a grade.
                  if (pedidoDaAgenda.current !== meuPedido) return;
                  setCompromissos([
                    ...aulas.map(deAula),
                    ...reservas.itens.map(deReserva),
                  ]);
                  if (reservas.truncou) setReservasIndisponiveis(true);
                })
                // Falha ao trocar de mês conserva a grade (AC-005): o aviso
                // já tem lugar próprio nesta tela, e sumir com o calendário
                // seria punir quem só quis espiar outubro.
                .catch(() => setAgendaIndisponivel(true));
            }}
          />
        ) : null}

        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-lift)]">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-secondary)] uppercase">Reservas PlayCK</p>
              <h2 className="mt-1 text-xl font-extrabold">Seu próximo jogo começa aqui</h2>
              <p className="mt-1 text-sm font-medium text-white/65">Veja o que o clube oferece, com valores e horários.</p>
            </div>
            <Link href="/reservas/nova" aria-label="Fazer reserva" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-court-dark)]">
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
