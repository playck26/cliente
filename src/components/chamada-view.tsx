"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CircleSlash, Minus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourtLines } from "@/components/court-lines";
import { TopAppBar } from "@/components/top-app-bar";
import {
  ApiError,
  getChamada,
  salvarChamada,
  registrarNaoHouveAula,
  type Chamada,
  type StatusPresenca,
} from "@/lib/api-client";

const OPCOES: { valor: StatusPresenca; label: string; Icon: typeof Check }[] = [
  { valor: "presente", label: "Veio", Icon: Check },
  { valor: "ausente", label: "Faltou", Icon: Minus },
  { valor: "justificado", label: "Justificou", Icon: CircleSlash },
];

/**
 * SPEC-014 — a chamada.
 *
 * O desenho todo responde a uma restrição de contexto: isto é usado **em
 * quadra**, no celular, com pressa, às vezes com sinal ruim. Daí três
 * decisões:
 *
 * 1. Os três estados ficam visíveis o tempo todo, um toque cada. Nada de
 *    menu, nada de deslizar, nada de confirmar duas vezes.
 * 2. Salvar é explícito e manda a chamada inteira. Salvar a cada toque
 *    multiplicaria requisições justamente onde a rede é pior.
 * 3. Conflito (409) não descarta o que a pessoa acabou de marcar: ela vê o
 *    aviso e decide. Perder toque de quem está segurando uma raquete é o
 *    pior resultado possível.
 *
 * **SPEC-015/DEF-002 (TASK-000a):** salvar exigia apenas um aluno marcado, e
 * mandava só os marcados — uma chamada de 2 em 10 era gravada como se
 * estivesse pronta, e os outros 8 sumiam ao reabrir. Agora salvar só libera
 * com todos marcados, e existe "todos vieram" para o caso comum: exigir
 * completude sem dar o atalho seria trocar um defeito por atrito em quadra.
 */
export function ChamadaView({ ocupacaoId }: { ocupacaoId: string }) {
  const router = useRouter();
  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [marcas, setMarcas] = useState<Record<string, StatusPresenca>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    getChamada(ocupacaoId)
      .then((data) => {
        setChamada(data);
        const iniciais: Record<string, StatusPresenca> = {};
        for (const aluno of data.alunos) {
          if (aluno.status) iniciais[aluno.alunoId] = aluno.status;
        }
        setMarcas(iniciais);
      })
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError && err.status === 404
            ? "Aula não encontrada."
            : "Não foi possível carregar a chamada.",
        );
      });
  }, [ocupacaoId]);

  function marcar(alunoId: string, status: StatusPresenca) {
    setSalvo(false);
    setMarcas((atual) => ({ ...atual, [alunoId]: status }));
  }

  /**
   * O caso comum de uma aula é todo mundo ter vindo. Sem este atalho, a
   * regra de completude cobraria N toques para registrar "nada de
   * anormal" — e quem está em quadra abandonaria a chamada.
   */
  function marcarTodosPresentes() {
    if (!chamada) return;
    setSalvo(false);
    setMarcas(
      Object.fromEntries(
        chamada.alunos.map((a) => [a.alunoId, "presente" as StatusPresenca]),
      ),
    );
  }

  async function salvar() {
    if (!chamada) return;
    setErro(null);
    setConflito(false);
    setSalvando(true);
    try {
      const itens = Object.entries(marcas).map(([alunoId, status]) => ({
        alunoId,
        status,
      }));
      const res = await salvarChamada(chamada.ocupacaoId, chamada.versao, itens);
      // A versão nova volta do servidor: sem atualizá-la, o próximo salvar
      // desta mesma tela bateria de frente com a INV-019 e daria 409 contra
      // a própria escrita anterior.
      //
      // **SPEC-030 / achado 3 da 2ª validação cruzada (MÉDIA).** Só a versão
      // era atualizada, e o resto da tela ficava no estado ANTERIOR ao
      // salvamento. Duas consequências, as duas silenciosas:
      //
      // 1. o botão "A aula não aconteceu" continuava visível, embora o
      //    servidor já fosse recusá-lo com `CHAMADA_COM_PRESENCA`;
      // 2. ao desfazer uma aula `nao_houve` por este caminho, a tela seguia
      //    dizendo "registrada como não realizada" até recarregar — o
      //    professor via a mensagem contrária ao que acabara de fazer.
      //
      // Não relê do servidor: **sabemos exatamente o que foi gravado**, e um
      // GET a mais na pior rede do produto (em quadra) não paga o que já
      // temos em mãos.
      setChamada({
        ...chamada,
        versao: res.versao,
        completude: "completa",
        alunos: chamada.alunos.map((a) => ({
          ...a,
          status: marcas[a.alunoId] ?? a.status,
        })),
      });
      setSalvo(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflito(true);
      } else {
        setErro(
          err instanceof ApiError ? err.message : "Não foi possível salvar.",
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  /**
   * SPEC-030 — **registrar que a aula não aconteceu.**
   *
   * Confirmação explícita antes de mandar. É a única ação desta tela que não
   * é um toque reversível: as outras marcam presença e podem ser
   * remarcadas até salvar, esta grava direto. E ela responde por todos os
   * alunos de uma vez.
   */
  async function naoHouveAula() {
    if (!chamada) return;
    if (
      !window.confirm(
        "Registrar que esta aula NÃO aconteceu?\n\n" +
          "Ela sai da lista de chamadas pendentes e não conta na frequência " +
          "de ninguém. Você pode desfazer lançando a chamada normalmente.",
      )
    ) {
      return;
    }
    setErro(null);
    setConflito(false);
    setSalvando(true);
    try {
      await registrarNaoHouveAula(chamada.ocupacaoId);
      // Relê em vez de remendar o estado local: o servidor é quem sabe a
      // `versao` nova, e ela é o que permite desfazer sem levar 409.
      setChamada(await getChamada(chamada.ocupacaoId));
      setMarcas({});
      setSalvo(false);
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível registrar. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const marcados = Object.keys(marcas).length;
  const total = chamada?.alunos.length ?? 0;
  const faltamMarcar = total - marcados;
  /** SPEC-030 — alguém já declarou que esta aula não aconteceu. */
  const naoHouve = chamada?.completude === "nao_houve";
  /**
   * **SPEC-030 / achado 3 da validação cruzada (MÉDIA).**
   *
   * A condição do botão era `marcados === 0`, e `marcados` conta as marcas
   * LOCAIS. Um toque errado em "Veio" — sem salvar nada — fazia o botão
   * sumir, e como `marcar()` só adiciona, **não havia como desmarcar**: o
   * caminho de "a aula não aconteceu" ficava perdido até recarregar a
   * página, em quadra, com sinal ruim.
   *
   * Agora a condição é o SERVIDOR: só some quando há presença de fato
   * gravada. É também o que o servidor recusa (`CHAMADA_COM_PRESENCA`) — a
   * tela deixou de esconder por conta própria o que a API ainda aceitaria.
   */
  const temPresencaSalva = Boolean(
    chamada?.alunos.some((a) => a.status !== null),
  );
  // INV-026: o servidor recusa chamada incompleta. A tela impede antes de a
  // pessoa tentar, porque descobrir isso por erro de rede, em quadra, é o
  // pior momento possível.
  const completa = total > 0 && faltamMarcar === 0;

  return (
    <div className="app-screen flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-5 px-4 pt-1 pb-40">
        <Button
          type="button"
          variant="ghost"
          className="self-start gap-2 px-0 text-[var(--color-primary-strong)]"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Button>

        <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-court-dark)] p-5 text-white shadow-[var(--shadow-elevated)]">
          <CourtLines className="opacity-30" />
          <div className="relative z-10">
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-secondary)] uppercase">Controle de presença</p>
            <h1 className="mt-2 text-3xl font-extrabold">Chamada</h1>
            {chamada ? (
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {chamada.data.split("-").reverse().join("/")} · {chamada.horaInicio}–{chamada.horaFim}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <Users className="size-4" aria-hidden="true" />
                  {marcados}/{total} marcados
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {erro ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        {/* DEF-002: chamada gravada antes da correção pode estar pela
            metade, e ninguém sabe quem faltou. A tela diz isso em vez de
            apresentar uma lista incompleta como se fosse o registro. */}
        {chamada?.completude === "desconhecida" ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-high)] p-3 text-sm">
            Esta chamada foi lançada antes de o app exigir a lista completa,
            então pode estar pela metade. Confira todos os alunos e salve de
            novo para deixá-la fechada.
          </p>
        ) : null}

        {/* SPEC-030 — o estado, e o caminho de volta junto com ele. Dizer
            "não aconteceu" sem dizer como desfazer transformaria um engano
            de toque em um dia perdido. */}
        {naoHouve ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-high)] p-3 text-sm">
            <strong>Esta aula está registrada como não realizada.</strong> Ela
            não aparece mais como chamada pendente e não conta na frequência
            de ninguém. Se foi engano, marque os alunos abaixo e salve — a
            chamada normal volta a valer.
          </p>
        ) : null}

        {conflito ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-[var(--color-error)] p-3 text-sm"
          >
            <span>
              Esta chamada mudou em outro aparelho. Suas marcações continuam
              aqui — recarregue para ver o que está salvo antes de decidir.
            </span>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </Button>
          </div>
        ) : null}

        {chamada ? (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Alunos</h2>
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">{faltamMarcar > 0 ? `${faltamMarcar} pendentes` : "Completa"}</span>
          </div>
        ) : null}

        <ul className="flex flex-col gap-3">
          {chamada?.alunos.map((aluno) => (
            <li key={aluno.alunoId}>
              <Card className="border-0 shadow-[var(--shadow-low)] ring-1 ring-border">
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{aluno.nome}</span>
                    {/* AC-010: quem saiu da turma continua no histórico, e a
                        tela diz por que ele ainda aparece aqui. */}
                    {!aluno.naTurmaHoje ? (
                      <span className="rounded-full bg-[var(--color-surface-container-high)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        não está mais na turma
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {OPCOES.map(({ valor, label, Icon }) => {
                      const ativo = marcas[aluno.alunoId] === valor;
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => marcar(aluno.alunoId, valor)}
                          className={`flex min-h-12 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors ${
                            ativo && valor === "presente"
                              ? "border-[var(--color-primary-strong)] bg-[var(--color-primary-strong)] text-white"
                              : ativo && valor === "ausente"
                                ? "border-[var(--color-tertiary)] bg-[var(--color-tertiary)] text-white"
                                : ativo
                                  ? "border-[var(--color-warning)] bg-[var(--color-warning)] text-white"
                                  : "border-border bg-[var(--color-surface-container)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </main>

      {/* Barra fixa: em quadra a pessoa rola a lista, e o botão de salvar não
          pode exigir que ela role de volta até o fim. */}
      {chamada ? (
        <div className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 flex-col gap-2 border-t border-border bg-surface/95 p-4 shadow-[0_-8px_24px_rgba(18,20,15,0.08)] backdrop-blur">
          <div className="flex items-center gap-3">
            {/* O contador dizia o estado ("2/10 marcados"); agora diz a
                pendência. Estado é informação; pendência é instrução, e em
                quadra a segunda vale mais. */}
            <span className="text-sm text-[var(--color-text-secondary)]">
              {completa
                ? `${total} de ${total} marcados`
                : `Faltam ${faltamMarcar} de ${total}`}
            </span>
            <Button
              type="button"
              className="ml-auto min-h-11"
              disabled={salvando || !completa}
              onClick={() => void salvar()}
            >
              {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar chamada"}
            </Button>
          </div>
          {!completa ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={marcarTodosPresentes}
            >
              Todos vieram
            </Button>
          ) : null}
          {/* SPEC-030 — some quando a aula JÁ está marcada como não
              realizada: repetir a ação não faria nada, e um botão que não
              faz nada ensina a desconfiar dos outros. Some também quando há
              presença **salva**, porque aí o servidor recusaria com
              `CHAMADA_COM_PRESENCA`. Marca local não conta: ela é
              reversível, e sumir com o botão por causa dela deixava o
              professor sem saída (achado 3 da validação cruzada). */}
          {!naoHouve && !temPresencaSalva ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full text-[var(--color-text-secondary)]"
              disabled={salvando}
              onClick={() => void naoHouveAula()}
            >
              A aula não aconteceu
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
