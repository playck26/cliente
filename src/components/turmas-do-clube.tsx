"use client";

import { useEffect, useState } from "react";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apareceParaMim } from "@/lib/filtro-de-nivel";
import {
  ApiError,
  entrarNaFilaDeTurma,
  entrarNaTurma,
  listarMinhaFila,
  sairDaFila,
  getMeuCadastro,
  listTurmasDisponiveis,
  sairDaTurma,
  type TurmaDisponivel,
} from "@/lib/api-client";
import { AvisoDePrazo } from "@/components/aviso-de-prazo";

/**
 * SPEC-023 — **o aluno entra e sai de turma sozinho.**
 *
 * As regras não moram aqui: `podeEntrar` e `motivo` vêm calculados do
 * servidor. Se a tela deduzisse, viraria uma segunda cópia das regras — e é
 * sempre a cópia que fica velha (DEF-012).
 *
 * **A ocupação fica à vista** (pedido do Israel): "6 de 8", com barra. Turma
 * cheia **aparece marcada**, não some — some com ela e a pessoa pergunta no
 * WhatsApp por que a turma das 18h não está na lista.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * O que cada motivo quer dizer para quem está olhando.
 *
 * **Chaveado pelo código, não pela mensagem do servidor.** O código é o
 * contrato (agora com schema publicado, LIM-004); a mensagem é texto para
 * humano e muda numa revisão de copy. Tela que decide por mensagem quebra
 * calada.
 */
const EXPLICACAO: Record<string, string> = {
  ALUNO_NAO_APROVADO: "Aguardando o clube aprovar seu cadastro",
  TURMA_INATIVA: "Turma fora de atividade",
  LIMITE_DE_TURMAS: "Você atingiu o limite de turmas deste clube",
  TURMA_CHEIA: "Sem vagas",
};

export function TurmasDoClube() {
  const [turmas, setTurmas] = useState<TurmaDisponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [agindoEm, setAgindoEm] = useState<string | null>(null);
  /**
   * SPEC-064/TASK-005 — **as filas do aluno, por turma.**
   *
   * A fila existe no Back desde 20/09 e esta tela era o único lugar onde
   * "Sem vagas" aparecia — ou seja, o único lugar onde entrar na fila faz
   * sentido. Sem isto, a pessoa lê "Sem vagas" e o assunto morre ali.
   *
   * **Falha tolerada:** se a chamada cair, a tela segue sem o botão de fila.
   * O catálogo é o conteúdo; a fila é o extra.
   */
  const [filaPorTurma, setFilaPorTurma] = useState<Record<string, string>>({});
  /**
   * SPEC-057/TASK-004 (card 5350) — o nível do aluno, para recortar a lista.
   *
   * **Buscado à parte e com falha tolerada**, como a média: o nível é
   * informação de recorte, não o conteúdo. Se `/me/cadastro` cair, a tela
   * mostra **tudo** — errar mostrando demais é recuperável; errar escondendo
   * faria o clube parecer vazio.
   */
  const [meuNivelId, setMeuNivelId] = useState<string | null>(null);

  const carregar = () =>
    listTurmasDisponiveis()
      .then(async (lista) => {
        setTurmas(lista);
        // As filas VIVAS do aluno, indexadas por turma. Uma ida só, ao lado
        // da lista — e tolerante: sem ela o catálogo continua inteiro.
        try {
          const fila = await listarMinhaFila();
          setFilaPorTurma(
            Object.fromEntries(
              fila
                .filter((l) => l.fila === "turma" && l.turmaId)
                .map((l) => [l.turmaId as string, l.id]),
            ),
          );
        } catch {
          setFilaPorTurma({});
        }
        /*
          SPEC-057/TASK-002/D12 (card 5352) — **a nota saiu da tela do
          aluno.** O card pede "ocultar nota da turma do usuário final e do
          professor"; a SPEC-052 já tinha tirado do professor e deixado a do
          aluno inalterada de propósito.

          A busca saiu junto com o render: manter a chamada alimentando um
          estado que ninguém lê seria uma ida à rede por turma, por nada.

          **A rota `GET /me/classes/:id/avaliacao` saiu do Back** depois que
          este Cliente foi ao ar (2026-09-17), na ordem de uma contração (D12),
          e com ela `getMediaDaTurma` e o componente `NotaDaTurma`. O `PUT` de
          avaliar segue sendo do aluno: ele avalia, o gestor lê.
        */
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível carregar as turmas.",
        ),
      )
      .finally(() => setCarregando(false));

  useEffect(() => {
    void getMeuCadastro()
      .then((cadastro) => setMeuNivelId(cadastro.nivelId))
      .catch(() => undefined);
    void carregar();
    // `carregar` fora das dependencias de proposito: ela e recriada a cada
    // render e entraria em laco. E o mesmo padrao das outras listas deste
    // app — a busca inicial acontece uma vez, e as recargas sao explicitas.
  }, []);

  /**
   * **Recarrega sempre, inclusive quando dá erro** — e isso é a dúvida 2 da
   * spec resolvida: a contagem que a tela pintou envelhece entre a pintura e
   * o toque. Receber `TURMA_CHEIA` e continuar mostrando "7 de 8" seria a
   * tela insistindo numa informação que o servidor acabou de desmentir.
   */
  const agir = async (
    turma: TurmaDisponivel,
    acao: "entrar" | "sair" | "entrar-na-fila" | "sair-da-fila",
  ) => {
    setAgindoEm(turma.id);
    setErro(null);
    try {
      if (acao === "entrar-na-fila") {
        await entrarNaFilaDeTurma(turma.id);
      } else if (acao === "sair-da-fila") {
        await sairDaFila(filaPorTurma[turma.id]);
      } else {
        await (acao === "entrar"
          ? entrarNaTurma(turma.id)
          : sairDaTurma(turma.id));
      }
    } catch (e: unknown) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível concluir.",
      );
    } finally {
      await carregar();
      setAgindoEm(null);
    }
  };

  if (carregando) {
    return (
      <div className="px-5 text-[13px] font-bold text-[var(--color-text-secondary)]">
        Carregando turmas…
      </div>
    );
  }

  // SPEC-072/D1 — **o `false` e literal, e e a decisao.** O escape "Todas"
  // saiu (supersessao da SPEC-057/TASK-004), e a funcao pura continua
  // aceitando o parametro de proposito: a `LIM-072b` preve a volta desta
  // decisao se o volume crescer, e o modulo segue testado para os tres casos.
  const visiveis = turmas.filter((t) => apareceParaMim(t, meuNivelId, false));

  return (
    <div className="space-y-4 px-5">
      {/* SPEC-031/REQ-002 — o prazo aparece ANTES do toque. Sem isto a regra
          só existe como `409` depois que a pessoa decidiu sair, tocou e
          esperou — e aí o app ensina a regra por erro. */}
      <AvisoDePrazo tipo="aula" />

      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-[var(--color-error)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-error)]"
        >
          {erro}
        </p>
      )}

      {/*
        **O seletor "Meu nível / Todas" NÃO existe aqui** (SPEC-072/AC-003), e
        não é caso de `hidden` nem de `display:none`: ele saiu do DOM. O
        pedido é do Matheus Moura — *"que somente aparecesse ... turmas que são
        do meu nível, para que eu não me confunda"* —, e ele supersede o escape
        que a validação independente da SPEC-057 tinha pedido.
      */}
      {turmas.length === 0 ? (
        <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
          <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
            Este clube ainda não tem turmas cadastradas.
          </p>
        </section>
      ) : visiveis.length === 0 ? (
        /*
          **Vazio do recorte ≠ clube sem turma**, e as duas frases continuam
          diferentes: uma diz que o clube não tem turma, a outra que nenhuma é
          do nível dele.

          **A saída que a primeira tinha saiu junto com o seletor**
          (SPEC-072/D1). A frase não pode continuar mandando tocar em "Todas"
          — botão que não existe mais é pior que nenhum botão.
        */
        <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-low)] ring-1 ring-border">
          <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">
            Nenhuma turma do seu nível por enquanto.
          </p>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Turmas do clube">
          {visiveis.map((turma) => {
            const lotada = turma.matriculados >= turma.capacidade;
            const ocupado = turma.capacidade
              ? Math.min(100, (turma.matriculados / turma.capacidade) * 100)
              : 0;

            return (
              <article
                key={turma.id}
                className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-extrabold text-foreground">
                      {turma.nome}
                    </h3>
                    {turma.encontros.length > 0 && (
                      <p className="mt-0.5 text-[12px] font-bold text-[var(--color-text-secondary)]">
                        {turma.encontros
                          .map(
                            (encontro) =>
                              `${DIAS[encontro.diaSemana]} ${encontro.horaInicio}`,
                          )
                          .join(" · ")}
                      </p>
                    )}
                    {turma.nivelNome && (
                      <p className="mt-0.5 text-[12px] font-extrabold text-[var(--color-primary-strong)]">
                        {turma.nivelNome}
                      </p>
                    )}

                  </div>

                  {turma.jaEstouNela && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-secondary-container)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-primary-strong)]">
                      <Check className="size-3.5" aria-hidden="true" />
                      Você está nela
                    </span>
                  )}
                </div>

                {/* A ocupação à vista — o pedido do Israel, em número e em barra. */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[var(--color-text-secondary)]">
                    <Users className="size-3.5" aria-hidden="true" />
                    <span>
                      {turma.matriculados} de {turma.capacidade}
                    </span>
                    {lotada && (
                      <span className="text-[var(--color-error)]">· sem vagas</span>
                    )}
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-court-dark)]/10"
                    role="progressbar"
                    aria-valuenow={turma.matriculados}
                    aria-valuemin={0}
                    aria-valuemax={turma.capacidade}
                    aria-label={`Ocupação da turma ${turma.nome}`}
                  >
                    <div
                      className={`h-full rounded-full ${lotada ? "bg-[var(--color-error)]" : "bg-[var(--color-primary-strong)]"}`}
                      style={{ width: `${ocupado}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  {turma.jaEstouNela ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={agindoEm === turma.id}
                      onClick={() => void agir(turma, "sair")}
                    >
                      {agindoEm === turma.id ? "Saindo…" : "Sair da turma"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        disabled={!turma.podeEntrar || agindoEm === turma.id}
                        onClick={() => void agir(turma, "entrar")}
                      >
                        {agindoEm === turma.id ? "Entrando…" : "Entrar na turma"}
                      </Button>
                      {/*
                        O motivo fica à vista embaixo do botão desabilitado.
                        Botão apagado sem explicação é a pessoa tocando de novo
                        achando que falhou.
                      */}
                      {turma.motivo && (
                        <p className="mt-2 text-center text-[12px] font-bold text-[var(--color-text-secondary)]">
                          {EXPLICACAO[turma.motivo] ?? "Não disponível"}
                        </p>
                      )}
                      {/*
                        SPEC-064/TASK-005 — **a fila nasce onde a recusa
                        aparece.** Só em `TURMA_CHEIA`: os outros motivos
                        (cadastro não aprovado, limite de turmas, turma
                        inativa) não são resolvidos por esperar, e oferecer
                        fila neles seria convite que nunca vira vaga.
                      */}
                      {turma.motivo === "TURMA_CHEIA" &&
                        (filaPorTurma[turma.id] ? (
                          <button
                            type="button"
                            className="mt-2 w-full text-[12px] font-bold text-[var(--color-text-secondary)] underline"
                            disabled={agindoEm === turma.id}
                            onClick={() => void agir(turma, "sair-da-fila")}
                          >
                            {agindoEm === turma.id
                              ? "Saindo…"
                              : "Você está na fila — sair"}
                          </button>
                        ) : (
                          <Button
                            variant="outline"
                            className="mt-2 w-full"
                            disabled={agindoEm === turma.id}
                            onClick={() => void agir(turma, "entrar-na-fila")}
                          >
                            {agindoEm === turma.id
                              ? "Entrando…"
                              : "Entrar na fila de espera"}
                          </Button>
                        ))}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
