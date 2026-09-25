"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CalendarRange, Clock, List } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { CourtLines } from "@/components/court-lines";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { Paginacao } from "@/components/paginacao";
import { SemanaDoAluno } from "@/components/semana-do-aluno";
import {
  ApiError,
  avisarFalta,
  entrarNaFilaDeAula,
  getMeuCadastro,
  getMeuCreditoDeReposicao,
  listarMinhaFila,
  listarOportunidadesDeReposicao,
  listProximasAulas,
  marcarReposicao,
  retirarAvisoDeFalta,
  sairDaFila,
  type CreditoDeReposicao,
  type LinhaDaFila,
  type MyClass,
  type OportunidadeDeReposicao,
} from "@/lib/api-client";
import { acaoDaOportunidade } from "@/lib/acao-da-oportunidade";
import { creditoUtilizavel, EXPLICACAO } from "@/lib/credito-utilizavel";
import { apareceParaMim } from "@/lib/filtro-de-nivel";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaSemana =
    DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * SPEC-029 — **a vista mora na URL**, como as abas (`abas-na-url.tsx`).
 *
 * Mesmo raciocínio, e ele já está escrito lá: link compartilhável, "voltar"
 * que desfaz a troca, e a vista padrão fora do endereço para o que a pessoa
 * copia ficar limpo. Guardar em `useState` faria o botão do navegador
 * atravessar a troca sem desfazê-la.
 */
type Vista = "lista" | "semana";

function useVista(): { vista: Vista; irPara: (v: Vista) => void } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vista: Vista =
    searchParams.get("vista") === "semana" ? "semana" : "lista";

  const irPara = (nova: Vista) => {
    if (nova === vista) return;
    // Preserva o resto da query (`?aba=`, por exemplo) em vez de reescrever o
    // endereço inteiro.
    //
    // **A frase que estava aqui era falsa, e custou tempo.** Ela dizia que
    // era "assim que a barra de abas evitou de apagar o que não é dela" — e a
    // barra de abas **apagava**. Este era o único dos dois que preservava, e
    // o comentário creditava o cuidado ao vizinho errado. Achado pela
    // validação cruzada da SPEC-041, consertado na TASK-B3 junto com o
    // helper. Documentação que descreve o que deveria ser, no tempo do que
    // é, envelhece como verdade.
    const params = new URLSearchParams(searchParams.toString());
    if (nova === "lista") params.delete("vista");
    else params.set("vista", nova);
    const qs = params.toString();
    router.push(qs ? `/minhas-aulas?${qs}` : "/minhas-aulas", {
      scroll: false,
    });
  };

  return { vista, irPara };
}

/**
 * **`=== true`, e não o valor cru.** O campo `faltaAvisada` é novo; um back
 * anterior à TASK-009a responde `200` sem ele, e aí o valor é `undefined`
 * mesmo o tipo gerado dizendo `boolean`.
 *
 * Cinco repositórios, cinco deploys independentes — este cliente pode estar
 * publicado contra um back que não tem o campo. Ausência é lida como "não
 * avisou", que é o estado seguro: a tela oferece avisar, e o servidor decide.
 */
const avisou = (aula: MyClass) => aula.faltaAvisada === true;

/**
 * SPEC-066 — **dez por pagina.** E o numero que o usuario pediu, com todas as
 * letras. O servidor tem teto de 50 (`@Max(50)` no DTO); este e o padrao, e o
 * servidor usaria 10 mesmo se a tela nao mandasse.
 */
const AULAS_POR_PAGINA = 10;

// REQ-002 (SPEC-005): aluno lista as próprias próximas aulas.
export function MyClassesList() {
  const [aulas, setAulas] = useState<MyClass[]>([]);
  /**
   * SPEC-066/TASK-002 — **a pagina atual, e o total do servidor.**
   *
   * O pedido do usuario: *"as aulas estao apresentando mais de 40 itens e
   * deixando a pagina enorme, precisamos apresentar apenas 10 aulas por
   * pagina"*.
   *
   * **A pagina mora em `useState`, e nao no endereco.** A `vista` mora na
   * URL de proposito (link compartilhavel, "voltar" que desfaz) -- ver o
   * `useVista` acima. A pagina nao: ninguem compartilha "pagina 3 das minhas
   * aulas", e por o numero na URL faria o `router.push` correr a cada clique
   * do paginador. **A AC-003 exige trocar de pagina sem remontar a tela.**
   */
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  /**
   * **Trocar de pagina nao mostra o esqueleto.** O `loading` governa a
   * primeira pintura, e reusa-lo aqui faria a lista sumir e voltar a cada
   * clique do paginador -- pior que a espera que ele esconde.
   *
   * **E DERIVADO, nao guardado.** A primeira versao fazia
   * `setTrocandoPagina(true)` dentro do efeito, e o lint do React reprovou:
   * *"Calling setState synchronously within an effect can trigger cascading
   * renders"*. Guardar "estou trocando" e guardar o que ja da para calcular
   * — **qual pagina foi respondida por ultimo**. E o mesmo conserto do
   * DEF-037, onde um booleano de carregamento tambem virou derivacao.
   */
  const [respondido, setRespondido] = useState<number | null>(null);
  const trocandoPagina = respondido !== page;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** SPEC-031: qual ocorrência está com ação em voo. Um por vez basta. */
  const [agindoEm, setAgindoEm] = useState<string | null>(null);
  /**
   * SPEC-072/REQ-004 — **o crédito de reposição, aqui.**
   *
   * O pedido do Matheus é *"remarcar também na tela de Aulas"*, e para isso
   * esta tela precisa saber se a falta daquela aula virou crédito
   * **utilizável** — cinco motivos, no `credito-utilizavel.ts`.
   *
   * **Falha tolerada, e a oferta fecha.** Professor e gestor levam `403`
   * nesta rota, e um erro aqui não pode derrubar a lista de aulas: sem
   * crédito carregado, nenhum "Remarcar" aparece. Errar escondendo o botão é
   * recuperável; errar oferecendo leva o aluno a um `409`.
   */
  const [credito, setCredito] = useState<CreditoDeReposicao | null>(null);
  /**
   * **Qual aula está sendo remarcada, e com qual falta.**
   *
   * O `faltaId` é guardado junto **de propósito** (`AC-008`): é o crédito
   * daquela ocorrência, casado por `ocupacaoId`, e é ele que sobe no `POST`.
   * Reconstruí-lo na hora do clique abriria espaço para casar pela aula
   * errada quando há duas faltas de turmas homônimas (`INV-072c`).
   */
  const [remarcando, setRemarcando] = useState<{
    ocupacaoId: string;
    faltaId: string;
  } | null>(null);
  const [opcoes, setOpcoes] = useState<OportunidadeDeReposicao[] | null>(null);
  /**
   * **O nível do aluno, e o painel TEM de recortar por ele.**
   *
   * A primeira versão deste painel (SPEC-072/TASK-005) copiou a lista de
   * oportunidades de "Aulas para repor" e **não copiou o recorte** — então
   * quem remarcava pela tela de Aulas via oportunidades de TODOS os níveis,
   * que é exatamente o que o item 1 do card do Matheus mandou tirar. Foi ao ar
   * assim em `3248b94`, e só apareceu quando esta task foi mexer no mesmo
   * trecho. Duas telas, uma regra: o recorte mora em `filtro-de-nivel.ts`, e
   * esta tela passa a chamá-lo.
   *
   * **Leitura tolerante, como na outra tela:** se `/me/cadastro` falhar, nulo
   * mostra tudo (D15/INV-141). Errar mostrando demais é recuperável.
   */
  const [meuNivelId, setMeuNivelId] = useState<string | null>(null);
  /** SPEC-064/TASK-007 — as filas em que ele já está, para o botão de cada aula cheia. */
  const [minhaFila, setMinhaFila] = useState<LinhaDaFila[]>([]);
  /**
   * **Erro próprio da reposição, e não o `error` da tela.**
   *
   * O `error` da lista SUBSTITUI a lista inteira; usá-lo aqui faria a recusa
   * de uma reposição apagar as aulas. A `AC-009` exige que a recusa
   * **apareça** — não que a tela desapareça.
   */
  const [erroDaReposicao, setErroDaReposicao] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  /**
   * SPEC-066/TASK-003 — **o `doPassado` e o `pedirJanela` sairam daqui.**
   *
   * Eles existiam porque a vista de semana recebia as aulas deste componente
   * e nao sabia buscar. Agora ela busca a propria janela (INV-066d), e este
   * componente voltou a ter uma responsabilidade so: a LISTA.
   */
  const { vista, irPara } = useVista();

  const carregar = useCallback(
    () =>
      listProximasAulas({ page, pageSize: AULAS_POR_PAGINA })
        .then((pagina) => {
          setAulas(pagina.data);
          setTotal(pagina.total);
        })
        .catch((err: unknown) => {
          setError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar suas aulas.",
          );
        }),
    [page],
  );

  /**
   * **Buscado à parte, e com falha tolerada** — mesmo idioma do nível em
   * `turmas-do-clube.tsx`. O crédito é informação de OFERTA, não o conteúdo
   * da tela: se cair, a lista de aulas continua inteira e o botão não
   * aparece.
   */
  const carregarCredito = useCallback(
    () =>
      getMeuCreditoDeReposicao()
        .then(setCredito)
        .catch(() => setCredito(null)),
    [],
  );

  useEffect(() => {
    void carregar().finally(() => {
      setLoading(false);
      setRespondido(page);
    });
  }, [carregar, page]);

  useEffect(() => {
    void carregarCredito();
  }, [carregarCredito]);

  useEffect(() => {
    void getMeuCadastro()
      .then((cadastro) => setMeuNivelId(cadastro.nivelId))
      .catch(() => undefined);
  }, []);

  /**
   * SPEC-031/REQ-006 — avisar que vai faltar, e desfazer.
   *
   * **Recarrega sempre, inclusive no erro** — mesmo idioma de
   * `turmas-do-clube.tsx`, e pela mesma razão: o prazo envelhece entre a
   * pintura e o toque. Receber `PRAZO_DE_CANCELAMENTO` e continuar mostrando
   * o botão como se nada tivesse mudado seria a tela insistindo numa
   * informação que o servidor acabou de desmentir.
   *
   * O servidor é idempotente nos dois verbos, então toque duplo não é
   * problema — o que seria problema é a tela mentir sobre o estado.
   */
  const alternarFalta = async (aula: MyClass) => {
    if (!aula.turmaId) return;
    setAgindoEm(aula.ocupacaoId);
    setError(null);
    try {
      await (avisou(aula)
        ? retirarAvisoDeFalta(aula.turmaId, aula.ocupacaoId)
        : avisarFalta(aula.turmaId, aula.ocupacaoId));
    } catch (e: unknown) {
      // A mensagem vem do servidor: ela diz quantas horas o clube exige, e
      // essa informação não existe aqui.
      setError(
        e instanceof ApiError ? e.message : "Não foi possível concluir.",
      );
    } finally {
      await carregar();
      setAgindoEm(null);
    }
  };

  /**
   * **A mensagem do SERVIDOR, sempre que houver uma** (`AC-009`).
   *
   * O `authFetch` já lança `ApiError` para toda resposta não bem-sucedida, e
   * o `parseError` usa o texto do corpo quando existe. O padrão daqui só
   * entra quando **não** existe: resposta sem `message`, sem corpo, ou com
   * código que esta tela nunca viu.
   *
   * **É por isso que o mecanismo é por CLASSE e não por lista.** Uma lista de
   * códigos conhecidos não alcança resposta sem `code`, sem corpo, nem o que
   * o back acrescentar depois — e são seis cenários em cinco códigos, mais as
   * `NotFoundException` sem código (`LIM-072f`).
   */
  const mensagemDoServidor = (e: unknown, padrao: string): string =>
    e instanceof ApiError && e.message.trim().length > 0 ? e.message : padrao;

  const abrirRemarcacao = async (ocupacaoId: string, faltaId: string) => {
    setRemarcando({ ocupacaoId, faltaId });
    setOpcoes(null);
    setErroDaReposicao(null);
    try {
      // SPEC-064/TASK-007 — as cheias também, para oferecer a fila de espera.
      const [lista, fila] = await Promise.all([
        listarOportunidadesDeReposicao({ incluirSemVaga: true }),
        listarMinhaFila().catch(() => [] as LinhaDaFila[]),
      ]);
      setOpcoes(lista);
      setMinhaFila(fila);
    } catch (e: unknown) {
      setOpcoes([]);
      setErroDaReposicao(
        mensagemDoServidor(e, "Não foi possível carregar os horários."),
      );
    }
  };

  /**
   * SPEC-064/TASK-007 — entrar e sair da fila de uma aula cheia, sem sair do
   * painel. Relê a fila nos dois casos, inclusive no erro: o `JA_NA_FILA` é o
   * servidor dizendo que a tela estava velha.
   */
  const entrarNaFila = async (ocupacaoId: string) => {
    setMarcando(true);
    setErroDaReposicao(null);
    try {
      await entrarNaFilaDeAula(ocupacaoId);
    } catch (e: unknown) {
      setErroDaReposicao(
        mensagemDoServidor(e, "Não foi possível entrar na fila."),
      );
    } finally {
      setMinhaFila(await listarMinhaFila().catch(() => minhaFila));
      setMarcando(false);
    }
  };

  const sairDaFilaDaAula = async (linhaId: string) => {
    setMarcando(true);
    setErroDaReposicao(null);
    try {
      await sairDaFila(linhaId);
    } catch (e: unknown) {
      setErroDaReposicao(
        mensagemDoServidor(e, "Não foi possível sair da fila."),
      );
    } finally {
      setMinhaFila(await listarMinhaFila().catch(() => minhaFila));
      setMarcando(false);
    }
  };

  const confirmarRemarcacao = async (destinoId: string) => {
    if (!remarcando) return;
    setMarcando(true);
    setErroDaReposicao(null);
    try {
      await marcarReposicao(remarcando.faltaId, destinoId);
      setRemarcando(null);
      setOpcoes(null);
      await Promise.all([carregar(), carregarCredito()]);
    } catch (e: unknown) {
      // **O painel NÃO fecha na recusa** (`AC-009`): fechar é o gesto que diz
      // "pronto, marcado". A recusa aparece e o aluno continua na escolha.
      setErroDaReposicao(
        mensagemDoServidor(e, "Não foi possível marcar a reposição."),
      );
    } finally {
      setMarcando(false);
    }
  };

  const totalQuadras = new Set(aulas.map((aula) => aula.quadraId)).size;

  // SPEC-023 — a moldura saiu daqui: esta tela virou uma aba dentro de
  // `aulas-tabs.tsx`, ao lado das turmas do clube. Mesma razao de
  // `courts-list` e `my-bookings-list` na SPEC-022.
  return (
    <>
      <div className="space-y-5 px-5">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--color-primary-strong)] p-4 text-white shadow-[var(--shadow-lift)]">
          <CourtLines className="opacity-30" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/80 uppercase ring-1 ring-white/10">
                  <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
                  Minhas aulas
                </div>
                <h1 className="text-[28px] leading-[1.04] font-extrabold">
                  Agenda de treino
                </h1>
                <p className="mt-1.5 text-[13px] font-semibold text-white/75">
                  {loading
                    ? "Carregando sua agenda..."
                    : `${aulas.length} ${aulas.length === 1 ? "aula programada" : "aulas programadas"}`}
                </p>
              </div>
              <span className="flex size-[60px] shrink-0 items-center justify-center rounded-3xl bg-white/12 ring-1 ring-white/10">
                <TennisBallIcon
                  className="size-9 text-[#b8ff29]"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20">
                <p className="text-[22px] leading-none font-extrabold">
                  {loading ? "–" : aulas.length}
                </p>
                <p className="mt-1 text-[11px] font-bold text-white/70">
                  próximas
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20">
                <p className="text-[22px] leading-none font-extrabold">
                  {loading ? "–" : totalQuadras}
                </p>
                <p className="mt-1 text-[11px] font-bold text-white/70">
                  quadras
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          SPEC-029 — **o alternador de vista**, pedido do Israel.

          Dois botões visíveis em vez de um que troca de rótulo: um botão só,
          escrito "Semana", não diz se essa é a vista atual ou o destino — e a
          pessoa descobre tocando. `aria-pressed` conta a mesma coisa para
          quem usa leitor de tela.

          Fica escondido enquanto carrega e no erro: alternar entre duas
          telas vazias não é escolha.
        */}
        {!loading && !error && aulas.length > 0 ? (
          <div
            role="group"
            aria-label="Como ver as aulas"
            className="flex gap-2 rounded-2xl bg-[var(--color-surface-container)] p-1"
          >
            {(
              [
                { id: "lista", rotulo: "Lista", Icone: List },
                { id: "semana", rotulo: "Semana", Icone: CalendarRange },
              ] as const
            ).map(({ id, rotulo, Icone }) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => irPara(id)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold transition-colors ${
                  vista === id
                    ? "bg-surface text-[var(--color-primary-strong)] shadow-[var(--shadow-low)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <Icone className="size-4" aria-hidden="true" />
                {rotulo}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border"
          >
            {error}
          </p>
        ) : loading ? (
          <div className="space-y-3" aria-label="Carregando aulas">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-3xl bg-[var(--color-surface-container-high)]"
              />
            ))}
          </div>
        ) : aulas.length === 0 ? (
          <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]">
              <CalendarDays className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">
              Nenhuma aula agendada
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Quando seu clube programar uma aula, ela aparecerá aqui.
            </p>
          </section>
        ) : vista === "semana" ? (
          <SemanaDoAluno />
        ) : (
          <section className="space-y-3" aria-label="Próximas aulas">
            {aulas.map((aula, index) => {
              const veredicto = creditoUtilizavel(credito, aula.ocupacaoId);
              const emRemarcacao = remarcando?.ocupacaoId === aula.ocupacaoId;
              return (
                <article
                  key={aula.ocupacaoId}
                  className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--color-primary-strong)] uppercase">
                        {formatarData(aula.data)} • {aula.horaInicio}
                      </p>
                      {/*
                      **SPEC-057/TASK-002/D10 — daqui se chega à turma.**
                      O card pede *"clicar para ver sua turma"*, e o nome é o
                      alvo natural: é o que a pessoa lê para saber de que
                      turma se trata.

                      **Link no NOME, e não no cartão inteiro**, porque o
                      cartão já tem ação própria ("Vou faltar"). Cartão
                      clicável com botão dentro é a armadilha clássica: o
                      toque no botão vira navegação em metade das vezes.
                    */}
                      <h2 className="mt-1 truncate text-[19px] font-extrabold text-[var(--color-text-primary)]">
                        <Link
                          href={`/minhas-aulas/turma/${aula.turmaId}`}
                          className="hover:underline"
                        >
                          {aula.turmaNome ?? "Turma"}
                        </Link>
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                        <TennisCourtIcon
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{aula.quadraNome}</span>
                      </p>
                    </div>
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${index === 0 ? "bg-[var(--color-secondary-container)]" : "bg-[var(--color-primary-container)]/55"} text-[var(--color-primary-strong)]`}
                    >
                      {index === 0 ? (
                        <Clock className="size-6" aria-hidden="true" />
                      ) : (
                        <TennisBallIcon className="size-6" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                  <div className="mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-[var(--color-surface-container)] px-4">
                    <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">
                      {aula.horaInicio}–{aula.horaFim}
                    </span>
                    {/* SPEC-030 / achado 2 da validação cruzada — a aula que
                      NÃO aconteceu. Sem isto ela aparecia aqui como
                      "Agendada" até o dia passar, e no dia seguinte sumia
                      das "Anteriores" (o filtro da avaliação) sem nunca
                      dizer o que houve. O aluno pode ter ido até o clube. */}
                    {aula.naoRealizada ? (
                      <span className="rounded-full bg-[var(--color-surface-container-high)] px-3 py-1 text-[11px] font-extrabold text-[var(--color-text-secondary)] ring-1 ring-border">
                        Não realizada
                      </span>
                    ) : (
                      /* SPEC-031/REQ-006 — avisar que vai faltar.
                       O selo "Agendada" some quando há aviso: dizer "Agendada"
                       ao lado de "vou faltar" seria a tela afirmando duas
                       coisas sobre o mesmo estado.

                       Nada aqui quando a aula NÃO aconteceu: avisar falta de
                       aula que não houve não tem sentido, e o servidor
                       recusaria — a tela só não oferece o que seria recusado,
                       mesma regra da chamada. */
                      <div className="flex items-center gap-2">
                        {avisou(aula) ? (
                          <span className="rounded-full bg-[var(--color-warning)]/15 px-3 py-1 text-[11px] font-extrabold text-[var(--color-text-primary)] ring-1 ring-border">
                            Falta avisada
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)] ring-1 ring-border">
                            Agendada
                          </span>
                        )}
                        {aula.turmaId ? (
                          <button
                            type="button"
                            disabled={agindoEm === aula.ocupacaoId}
                            // O rótulo visível vira "..." durante a ação, e um
                            // nome acessível que muda no meio da operação deixa
                            // quem usa leitor de tela sem referência. O
                            // `aria-label` descreve a AÇÃO e não muda enquanto
                            // ela acontece.
                            aria-label={
                              avisou(aula)
                                ? "Desfazer aviso de falta"
                                : "Avisar que vou faltar"
                            }
                            onClick={() => void alternarFalta(aula)}
                            className="min-h-11 rounded-full px-3 text-[11px] font-extrabold text-[var(--color-primary-strong)] underline underline-offset-2 disabled:opacity-60"
                          >
                            {agindoEm === aula.ocupacaoId
                              ? "..."
                              : avisou(aula)
                                ? "Desfazer"
                                : "Vou faltar"}
                          </button>
                        ) : null}
                        {/*
                        **SPEC-072/AC-007 — o "Remarcar" só existe quando o
                        crédito é utilizável**, e são cinco motivos para não
                        ser: sem falta casada por `ocupacaoId`, já reposta,
                        aula cancelada pelo clube, expirada, e o teto do mês.
                        O quinto foi o achado B06 — falta válida com teto
                        estourado levava o aluno a um `409` que ele não
                        entende.

                        **A fronteira, declarada (`LIM-072f`):** isto prova
                        que há crédito, não que a vaga será aceita. As recusas
                        que dependem da ocupação ESCOLHIDA não existem aqui, e
                        quem as cobre é a `AC-009` — por classe.
                      */}
                        {veredicto.utilizavel ? (
                          <button
                            type="button"
                            disabled={emRemarcacao}
                            onClick={() =>
                              void abrirRemarcacao(
                                aula.ocupacaoId,
                                veredicto.faltaId,
                              )
                            }
                            className="min-h-11 rounded-full bg-[var(--color-primary-strong)] px-3 text-[11px] font-extrabold text-white disabled:opacity-60"
                          >
                            Remarcar
                          </button>
                        ) : avisou(aula) ? (
                          /*
                          **O motivo aparece, em vez do botão.** Aviso de
                          falta sem caminho para repor e sem explicação é a
                          tela deixando o aluno adivinhar por que o direito
                          dele não está ali.
                        */
                          <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                            {EXPLICACAO[veredicto.motivo]}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {emRemarcacao ? (
                    <div className="mt-3 rounded-2xl bg-[var(--color-surface-container)] p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-extrabold text-foreground">
                          Escolha o horário da reposição
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setRemarcando(null);
                            setOpcoes(null);
                            setErroDaReposicao(null);
                          }}
                          className="text-[11px] font-extrabold text-[var(--color-text-secondary)] underline"
                        >
                          Cancelar
                        </button>
                      </div>
                      {erroDaReposicao ? (
                        <p
                          role="alert"
                          className="mt-2 text-[12px] font-bold text-[var(--color-error)]"
                        >
                          {erroDaReposicao}
                        </p>
                      ) : null}
                      {opcoes === null ? (
                        <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
                          Carregando...
                        </p>
                      ) : opcoes.length === 0 ? (
                        /* Zero é uma resposta, e precisa ser dita — senão o
                         aluno acha que a tela quebrou. */
                        <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
                          Nenhuma turma com vaga nos próximos dias.
                        </p>
                      ) : (
                        <ul className="mt-2">
                          {opcoes
                            // O recorte que faltava — ver o comentário do
                            // `meuNivelId`. Mesma função, mesmo `false`, da
                            // outra tela.
                            .filter((o) => apareceParaMim(o, meuNivelId, false))
                            .map((o) => (
                              <li
                                key={o.ocupacaoId}
                                className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                              >
                                {/* Mesma lição da TASK-004: sem `truncate`, com o
                                `horaFim`, e `break-words` para nome longo não
                                estourar a largura a 320px. */}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-extrabold break-words text-foreground">
                                    {o.turmaNome}
                                  </p>
                                  <p className="text-[11px] break-words text-[var(--color-text-secondary)]">
                                    {formatarData(o.data)} · {o.horaInicio}–
                                    {o.horaFim} · {o.quadraNome} ·{" "}
                                    {o.vagas === 0
                                      ? "sem vaga"
                                      : o.vagas === 1
                                        ? "1 vaga"
                                        : `${o.vagas} vagas`}
                                  </p>
                                </div>
                                {(() => {
                                  const acao = acaoDaOportunidade(o, minhaFila);
                                  if (acao.tipo === "marcar") {
                                    return (
                                      <button
                                        type="button"
                                        disabled={marcando}
                                        onClick={() =>
                                          void confirmarRemarcacao(o.ocupacaoId)
                                        }
                                        className="shrink-0 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50"
                                      >
                                        Marcar
                                      </button>
                                    );
                                  }
                                  if (acao.tipo === "entrar-na-fila") {
                                    return (
                                      <button
                                        type="button"
                                        disabled={marcando}
                                        onClick={() =>
                                          void entrarNaFila(o.ocupacaoId)
                                        }
                                        aria-label="Entrar na fila de espera desta aula"
                                        className="shrink-0 rounded-2xl bg-surface px-3 py-1.5 text-[12px] font-extrabold text-[var(--color-primary-strong)] ring-1 ring-border disabled:opacity-50"
                                      >
                                        Entrar na fila
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      disabled={marcando}
                                      onClick={() =>
                                        void sairDaFilaDaAula(acao.linhaId)
                                      }
                                      aria-label="Você está na fila de espera desta aula — sair"
                                      className="shrink-0 rounded-2xl bg-surface px-3 py-1.5 text-[12px] font-extrabold text-[var(--color-text-secondary)] ring-1 ring-border disabled:opacity-50"
                                    >
                                      Sair da fila
                                    </button>
                                  );
                                })()}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {/*
              SPEC-066/AC-003 — o paginador. `Paginacao` ja existe desde a
              SPEC-027 e se esconde sozinho quando ha uma pagina so, entao
              aluno com poucas aulas nao ve nada de novo.

              `ocupado={loading}` impede o clique duplo enquanto a proxima
              pagina esta em voo.
            */}
            <Paginacao
              page={page}
              pageSize={AULAS_POR_PAGINA}
              total={total}
              onMudar={setPage}
              ocupado={trocandoPagina}
              rotulo="próximas aulas"
            />
          </section>
        )}
      </div>
    </>
  );
}
