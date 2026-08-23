"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleSlash, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopAppBar } from "@/components/top-app-bar";
import {
  ApiError,
  getChamada,
  salvarChamada,
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
      setChamada({ ...chamada, versao: res.versao });
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

  const marcados = Object.keys(marcas).length;
  const total = chamada?.alunos.length ?? 0;
  const faltamMarcar = total - marcados;
  // INV-026: o servidor recusa chamada incompleta. A tela impede antes de a
  // pessoa tentar, porque descobrir isso por erro de rede, em quadra, é o
  // pior momento possível.
  const completa = total > 0 && faltamMarcar === 0;

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-background)]">
      <TopAppBar />

      <main className="flex flex-1 flex-col gap-4 p-4 pb-32">
        <Button
          type="button"
          variant="ghost"
          className="self-start gap-2 px-0"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Button>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Chamada</h1>
          {chamada ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {chamada.data.split("-").reverse().join("/")} ·{" "}
              {chamada.horaInicio}–{chamada.horaFim}
            </p>
          ) : null}
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        {/* DEF-002: chamada gravada antes da correção pode estar pela
            metade, e ninguém sabe quem faltou. A tela diz isso em vez de
            apresentar uma lista incompleta como se fosse o registro. */}
        {chamada?.completude === "desconhecida" ? (
          <p className="rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface-container-high)] p-3 text-sm">
            Esta chamada foi lançada antes de o app exigir a lista completa,
            então pode estar pela metade. Confira todos os alunos e salve de
            novo para deixá-la fechada.
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

        <ul className="flex flex-col gap-2">
          {chamada?.alunos.map((aluno) => (
            <li key={aluno.alunoId}>
              <Card>
                <CardContent className="flex flex-col gap-3 py-3">
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
                  <div className="flex gap-2">
                    {OPCOES.map(({ valor, label, Icon }) => {
                      const ativo = marcas[aluno.alunoId] === valor;
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => marcar(aluno.alunoId, valor)}
                          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            ativo
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                              : "border-border text-[var(--color-text-secondary)]"
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
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-border bg-surface p-4">
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
        </div>
      ) : null}
    </div>
  );
}
