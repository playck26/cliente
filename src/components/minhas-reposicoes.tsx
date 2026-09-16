"use client";

import { useEffect, useState } from "react";
import {
  apareceParaMim,
  escondidosPeloFiltro,
  filtroFazSentido,
} from "@/lib/filtro-de-nivel";
import {
  getMeuCadastro,
  ApiError,
  desmarcarReposicao,
  getMeuCreditoDeReposicao,
  listarOportunidadesDeReposicao,
  marcarReposicao,
  type CreditoDeReposicao,
  type FaltaParaRepor,
  type OportunidadeDeReposicao,
} from "@/lib/api-client";

/**
 * SPEC-046/REQ-001 a REQ-003 — **repor uma aula que ele avisou que ia perder.**
 *
 * ## O que esta faixa resolve
 *
 * Desde a SPEC-031 o aluno avisa a falta sozinho, e a falta ficava ali: virava
 * um registro e nada mais. Agora ela vira **crédito**, e ele escolhe onde
 * repor — sem pedir, sem esperar aprovação (D3).
 *
 * ## Some quando não há falta nenhuma, e isso é o normal
 *
 * Quem não faltou não tem o que repor, e uma faixa dizendo "0 créditos" seria
 * ruído permanente na tela de quem está em dia. Mesma decisão do `meu-plano`,
 * pela mesma razão.
 *
 * ## O crédito vem do SERVIDOR, e a tela não o recalcula
 *
 * `creditos` é derivado lá (`faltas válidas − reposições`), e a vaga de cada
 * ocorrência depende das faltas dos **outros** alunos — que esta tela não
 * conhece e não deve conhecer. Refazer a conta aqui seria inventar um segundo
 * cálculo que diverge do primeiro no primeiro ajuste.
 *
 * ## Falta expirada e falta de aula cancelada CONTINUAM na lista
 *
 * Marcadas, e sem botão. Sumir com elas faria o aluno achar que nunca avisou —
 * é a mesma decisão que a SPEC-031/D14 tomou do outro lado, mantendo a falta
 * visível na chamada de uma aula cancelada.
 */
function diaEHora(data: string, hora: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} às ${hora}`;
}

function Falta({
  f,
  onRepor,
  onDesmarcar,
  ocupada,
}: {
  f: FaltaParaRepor;
  onRepor: () => void;
  onDesmarcar: () => void;
  ocupada: boolean;
}) {
  const indisponivel = f.expirada || f.aulaCancelada;

  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <p className="text-[13px] font-extrabold text-foreground">
        {f.turmaNome ?? "Aula"} · {diaEHora(f.data, f.horaInicio)}
      </p>

      {f.reposicao ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[12px] text-[var(--color-primary-strong)]">
            Reposta em {f.reposicao.turmaNome ?? "outra turma"} ·{" "}
            {diaEHora(f.reposicao.data, f.reposicao.horaInicio)}
          </p>
          <button
            type="button"
            disabled={ocupada}
            onClick={onDesmarcar}
            className="shrink-0 text-[12px] font-extrabold text-[var(--color-text-secondary)] underline disabled:opacity-50"
          >
            Desmarcar
          </button>
        </div>
      ) : f.aulaCancelada ? (
        /* Ele não perdeu nada: o clube cancelou a aula para todo mundo. */
        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
          O clube cancelou esta aula — não há o que repor.
        </p>
      ) : f.expirada ? (
        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
          O prazo para repor esta falta terminou em{" "}
          {f.expiraEm.split("-").reverse().join("/")}.
        </p>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[12px] text-[var(--color-text-secondary)]">
            Dá para repor até {f.expiraEm.split("-").reverse().join("/")}.
          </p>
          <button
            type="button"
            disabled={ocupada}
            onClick={onRepor}
            className="shrink-0 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-1.5 text-[12px] font-extrabold text-white active:scale-[0.99] disabled:opacity-50"
          >
            Repor
          </button>
        </div>
      )}

      {indisponivel ? null : null}
    </li>
  );
}

export function MinhasReposicoes() {
  const [dados, setDados] = useState<CreditoDeReposicao | null>(null);
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OportunidadeDeReposicao[] | null>(null);
  const [ocupada, setOcupada] = useState(false);
  /**
   * SPEC-057/TASK-004 (card 5350) — **o mesmo recorte da lista de turmas.**
   *
   * Esta lista é a que mais confunde: ela traz ocorrências de **todas** as
   * turmas ativas do clube das quais o aluno não participa.
   *
   * **E é a que mais exige cuidado**, porque aqui há um direito já pago: o
   * crédito de reposição. O veredito independente da SPEC-057 levantou
   * exatamente este caso — aluno de nível A, crédito na mão, e a única vaga
   * numa turma de nível B. Por isso o escape ("Todas") vale aqui igual, e
   * **filtrar não consome, não expira e não bloqueia** nada: o `POST`
   * continua aceitando a vaga escondida (D16).
   */
  const [meuNivelId, setMeuNivelId] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    setDados(await getMeuCreditoDeReposicao());
  }

  useEffect(() => {
    // Falha tolerada, como na lista de turmas: sem o nível a tela mostra
    // TUDO. Errar mostrando demais é recuperável; esconder uma vaga de um
    // crédito pago não é.
    void getMeuCadastro()
      .then((cadastro) => setMeuNivelId(cadastro.nivelId))
      .catch(() => undefined);
    let ativo = true;
    getMeuCreditoDeReposicao()
      .then((d) => {
        if (ativo) setDados(d);
      })
      // `403` (professor, gestor) e qualquer outra falha somem em silêncio:
      // esta faixa é um extra, e derrubar a página por causa dela seria pior
      // que não mostrá-la. Mesma decisão do `meu-plano`.
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  if (!dados || dados.faltas.length === 0) return null;

  async function abrirEscolha(faltaId: string) {
    setErro(null);
    setEscolhendo(faltaId);
    setOpcoes(null);
    try {
      setOpcoes(await listarOportunidadesDeReposicao());
    } catch (e: unknown) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível carregar os horários.",
      );
    }
  }

  async function confirmar(ocupacaoId: string) {
    if (!escolhendo) return;
    setOcupada(true);
    setErro(null);
    try {
      await marcarReposicao(escolhendo, ocupacaoId);
      setEscolhendo(null);
      setOpcoes(null);
      // **Recarrega em vez de mexer no estado local.** O crédito é derivado no
      // servidor, e espelhá-lo aqui criaria uma segunda contagem — que
      // divergiria no primeiro caso que eu não previsse.
      await recarregar();
    } catch (e: unknown) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível marcar.",
      );
    } finally {
      setOcupada(false);
    }
  }

  async function desmarcar(id: string) {
    setOcupada(true);
    setErro(null);
    try {
      await desmarcarReposicao(id);
      await recarregar();
    } catch (e: unknown) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível desmarcar.",
      );
    } finally {
      setOcupada(false);
    }
  }

  const visiveis = (opcoes ?? []).filter((o) =>
    apareceParaMim(o, meuNivelId, verTodas),
  );
  const escondidas = escondidosPeloFiltro(opcoes ?? [], meuNivelId, verTodas);

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-foreground">
          Aulas para repor
        </h2>
        <span className="shrink-0 text-[13px] font-extrabold text-[var(--color-primary-strong)]">
          {dados.creditos === 1
            ? "1 disponível"
            : `${dados.creditos} disponíveis`}
        </span>
      </div>

      {/* O teto entra aqui e não só na recusa: "você tem 1 crédito" sem dizer
          que o mês acabou produz um `409` que o aluno não entende. */}
      {dados.usadasNoMes >= dados.porMes ? (
        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
          Você já usou {dados.usadasNoMes} de {dados.porMes} reposições deste
          mês.
        </p>
      ) : null}

      {erro ? (
        <p role="alert" className="mt-2 text-[12px] text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      <ul className="mt-2">
        {dados.faltas.map((f) => (
          <Falta
            key={f.faltaId}
            f={f}
            ocupada={ocupada}
            onRepor={() => void abrirEscolha(f.faltaId)}
            onDesmarcar={() =>
              f.reposicao ? void desmarcar(f.reposicao.id) : undefined
            }
          />
        ))}
      </ul>

      {escolhendo ? (
        <div className="mt-3 rounded-2xl bg-[var(--color-surface-container)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-extrabold text-foreground">
              Escolha o horário
            </h3>
            <button
              type="button"
              onClick={() => {
                setEscolhendo(null);
                setOpcoes(null);
              }}
              className="text-[12px] font-extrabold text-[var(--color-text-secondary)] underline"
            >
              Cancelar
            </button>
          </div>

          {opcoes !== null && filtroFazSentido(opcoes, meuNivelId) && (
            <div
              className="mt-2 flex gap-2"
              role="group"
              aria-label="Filtrar horários por nível"
            >
              {[
                { rotulo: "Meu nível", ativo: !verTodas, valor: false },
                { rotulo: "Todas", ativo: verTodas, valor: true },
              ].map(({ rotulo, ativo, valor }) => (
                <button
                  key={rotulo}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setVerTodas(valor)}
                  className={`min-h-8 rounded-full px-3 text-[12px] font-extrabold transition-colors ${
                    ativo
                      ? "bg-[var(--color-primary-strong)] text-white"
                      : "bg-surface text-[var(--color-text-secondary)] ring-1 ring-border"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          {opcoes === null ? (
            <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
              Carregando...
            </p>
          ) : opcoes.length === 0 ? (
            /* Zero é uma resposta, e precisa ser dita: sem isto o aluno acha
               que a tela quebrou. */
            <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
              Nenhuma turma com vaga nos próximos dias. Tente de novo mais
              tarde.
            </p>
          ) : visiveis.length === 0 ? (
            /*
              **O crédito não pode sumir atrás do filtro.** Há vaga; ela só
              não é do nível dele. Dizer "nenhuma turma com vaga" aqui seria a
              tela escondendo um direito que o aluno já pagou.
            */
            <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
              Nenhum horário do seu nível. Toque em &ldquo;Todas&rdquo; para
              ver {escondidas === 1 ? "o outro horário" : "os outros horários"}{" "}
              com vaga.
            </p>
          ) : (
            <ul className="mt-2">
              {visiveis.map((o) => (
                <li
                  key={o.ocupacaoId}
                  className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-foreground">
                      {o.turmaNome}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-secondary)]">
                      {diaEHora(o.data, o.horaInicio)} · {o.quadraNome} ·{" "}
                      {o.vagas === 1 ? "1 vaga" : `${o.vagas} vagas`}
                      {o.nivelNome ? ` · ${o.nivelNome}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={ocupada}
                    onClick={() => void confirmar(o.ocupacaoId)}
                    className="shrink-0 rounded-2xl bg-[var(--color-primary-strong)] px-3 py-1.5 text-[12px] font-extrabold text-white active:scale-[0.99] disabled:opacity-50"
                  >
                    Marcar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
