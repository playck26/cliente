"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { hojeNoClubeIso } from "@/lib/fuso";
import { listMyClasses, type MyClass } from "@/lib/api-client";
import { agruparPorDia } from "@/lib/agrupar-por-dia";

/**
 * SPEC-029 — **as próximas aulas do aluno, vistas como semana.**
 *
 * Pedido do Israel: um botão na aba "Próximas" que apresenta as aulas em
 * calendário semanal. A lista responde *"qual é a próxima?"*; a semana
 * responde *"como está a minha semana?"* — que é outra pergunta, e a que
 * alguém faz na segunda de manhã.
 *
 * **Semana em LINHAS, não em sete colunas.** O calendário do professor é uma
 * grade de mês porque ali cada dia precisa de um número e um ponto, nada
 * mais. Aqui cada dia precisa de horário, turma e quadra — em 390px de
 * largura, sete colunas dão 50px cada, e o nome da turma não cabe em nenhuma.
 * Sete linhas cabem, e a semana continua legível de uma olhada.
 *
 * **Os dias vazios aparecem.** Mostrar só os dias com aula economizaria
 * espaço e destruiria a informação: o valor de ver a semana é enxergar os
 * buracos — é neles que se marca uma reserva avulsa.
 *
 * **A janela é a que o servidor dá.** `GET /me/classes` devolve só o futuro,
 * então os dias já passados da semana corrente vêm vazios por definição, não
 * por erro. O passado tem aba própria ("Anteriores"), e a tela diz isso em
 * vez de deixar a pessoa achar que perdeu dado.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Aritmética de dias sobre uma data **já resolvida** (`AAAA-MM-DD`).
 *
 * Em UTC de propósito: a data entra como texto sem fuso e sai como texto sem
 * fuso, então não há conversão em que errar. É a mesma convenção de
 * `isoDeOffsetNoClube` — misturar aritmética local com leitura UTC foi
 * exatamente o DEF-020.
 */
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** O domingo da semana de `iso`. Domingo porque é como o app já numera. */
function domingoDaSemana(iso: string): string {
  const diaDaSemana = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return somarDias(iso, -diaDaSemana);
}

function rotuloCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/**
 * **SPEC-057/TASK-003 — `mostrarQuadra` existe por causa da home.**
 *
 * A home não escreve a palavra "quadra" (SPEC-053/AC-001, decisão 6 do
 * Israel), e cada aula desta vista mostra o nome da quadra — que na primeira
 * empresa real se chama "Quadra 1". Montar a semana lá reintroduziria a
 * palavra que a 053 tirou.
 *
 * **Por prop, e não por edição:** a TASK-002 também mexe neste componente
 * (drill down). Apagar a linha da quadra aqui tiraria informação de
 * `/minhas-aulas`, onde ela é útil e permitida. O contexto decide.
 */
export function SemanaDoAluno({
  mostrarQuadra = true,
  mostrarLinkDaTurma = true,
}: {
  mostrarQuadra?: boolean;
  /**
   * Falso esconde o link para a ficha da turma.
   *
   * **A frase anterior aqui estava velha e foi corrigida na SPEC-066:** ela
   * dizia que *"a HOME monta esta vista"*, e a home monta o
   * `CalendarioDoAluno`, nao esta. Conferido por varredura — o unico
   * consumidor de producao e `my-classes-list.tsx`. Comentario que descreve
   * um arranjo que nao existe mais envelhece como verdade.
   */
  mostrarLinkDaTurma?: boolean;
}) {
  const hoje = hojeNoClubeIso();
  const [domingo, setDomingo] = useState(() => domingoDaSemana(hoje));

  /**
   * SPEC-066/TASK-003 — **esta vista busca a propria janela** (INV-066d).
   *
   * Antes ela recebia `aulas` do pai, e o pai as tinha porque
   * `GET /me/classes` devolvia o futuro inteiro. Com a lista paginada isso
   * deixou de funcionar -- e e bom que tenha deixado: era esse acoplamento
   * que fazia o calendario filtrar a lista inteira para mostrar sete dias.
   *
   * ## O cache vive na MONTAGEM, e isso e normativo (AC-012)
   *
   * Uma busca por janela por montagem. Voltar a uma semana ja vista **nao
   * busca de novo** (AC-005); um `F5` remonta e **busca de novo**, que e o
   * correto -- guardar cache atraves de `F5` exigiria nomear armazenamento,
   * invalidacao e escopo para economizar uma busca que a pessoa pediu ao
   * recarregar.
   *
   * A v3 da spec dizia so *"repetir a entrada na mesma janela nao busca de
   * novo"*, **sem dizer dentro de que** -- lido ao pe da letra, aquilo pedia
   * persistencia. A 3a rodada de validacao pegou.
   */
  const [porJanela, setPorJanela] = useState<Map<string, MyClass[]>>(
    () => new Map(),
  );
  const pedidas = useRef<Set<string>>(new Set());

  const buscar = useCallback((de: string, ate: string) => {
    const chave = `${de}:${ate}`;
    if (pedidas.current.has(chave)) return;
    pedidas.current.add(chave);
    void listMyClasses({ de, ate })
      .then((lista) => {
        setPorJanela((atual) => new Map(atual).set(chave, lista));
      })
      .catch(() => {
        // Falha nao derruba a tela: a semana volta a mostrar "—", que e o
        // que ela mostrava antes da SPEC-057. E libera a chave, para a
        // proxima navegacao poder tentar de novo.
        pedidas.current.delete(chave);
      });
  }, []);

  /**
   * **Um mecanismo, os dois gatilhos da D5.**
   *
   * A spec lista duas entradas -- o clique em "Semana" e a entrada direta
   * por link, `F5` ou *voltar*. Um efeito com `domingo` na dependencia cobre
   * as duas: ele roda na montagem (que e a entrada direta) e roda de novo
   * quando a seta muda a semana.
   *
   * **A regra da SPEC-057 nao e contradita.** O que ela proibia era efeito
   * que reage a DADO, disparando busca que ninguem pediu a cada pintura --
   * e na epoca o pai ja tinha as aulas, entao a busca era mesmo desnecessaria.
   * Aqui o pai nao tem mais nada, e abrir a vista **e** o pedido.
   */
  useEffect(() => {
    buscar(domingo, somarDias(domingo, 6));
  }, [buscar, domingo]);

  /**
   * SPEC-066/TASK-004 — **memorizado porque a identidade importa.**
   *
   * Sem o `useMemo`, este `flat()` devolve um array NOVO a cada render, e um
   * array novo invalida qualquer `useMemo` que dependa dele — inclusive o do
   * agrupamento logo abaixo. **Era esse o defeito que a spec descreve no pai,
   * e ele se mudou para ca junto com o cache.**
   */
  const aulas = useMemo(
    () => Array.from(porJanela.values()).flat(),
    [porJanela],
  );

  const dias = Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
  const sabado = dias[6];

  /** Trocar a semana e so mudar o estado: o efeito acima busca o que faltar. */
  const irParaSemana = (novoDomingo: string) => setDomingo(novoDomingo);

  /**
   * **AC-007 — o agrupamento roda uma vez por conjunto de aulas.**
   *
   * Ele morava aqui dentro, refeito a cada render, com *spread* no laco. Agora
   * mora em `@/lib/agrupar-por-dia` — modulo proprio, porque e o que permite
   * ao teste interceptar com `vi.mock` e CONTAR. Exportar do proprio arquivo
   * nao serviria: chamada lexical nao passa pelo binding exportado.
   */
  const porDia = useMemo(() => agruparPorDia(aulas), [aulas]);

  const naSemana = dias.reduce(
    (total, dia) => total + (porDia.get(dia)?.length ?? 0),
    0,
  );
  const ehSemanaDeHoje = domingo === domingoDaSemana(hoje);

  return (
    <section className="space-y-3" aria-label="Minhas aulas por semana">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => irParaSemana(somarDias(domingo, -7))}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-[15px] font-extrabold text-[var(--color-text-primary)]">
            {rotuloCurto(domingo)} – {rotuloCurto(sabado)}
          </p>
          {/*
            `aria-live` porque trocar de semana muda a lista inteira sem mover
            o foco: sem isto, quem usa leitor de tela aciona a seta e não ouve
            nada mudar.
          */}
          <p
            aria-live="polite"
            className="text-[11px] font-bold text-[var(--color-text-secondary)]"
          >
            {naSemana === 0
              ? "Nenhuma aula"
              : `${naSemana} ${naSemana === 1 ? "aula" : "aulas"}`}
            {ehSemanaDeHoje ? " · esta semana" : ""}
          </p>
        </div>

        <button
          type="button"
          aria-label="Próxima semana"
          onClick={() => irParaSemana(somarDias(domingo, 7))}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-low)] ring-1 ring-border transition-transform active:scale-95"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      {/*
        Botão de volta, e ele só existe quando serve para alguma coisa. Sem
        ele, quem navegasse quatro semanas à frente teria de tocar quatro
        vezes na seta para voltar ao que importa.
      */}
      {!ehSemanaDeHoje && (
        <button
          type="button"
          onClick={() => irParaSemana(domingoDaSemana(hoje))}
          className="mx-auto block rounded-full bg-[var(--color-secondary-container)] px-4 py-1.5 text-[12px] font-extrabold text-[var(--color-primary-strong)]"
        >
          Voltar para esta semana
        </button>
      )}

      <ul className="space-y-2">
        {dias.map((dia) => {
          const doDia = porDia.get(dia) ?? [];
          const ehHoje = dia === hoje;
          const jaPassou = dia < hoje;

          return (
            <li
              key={dia}
              className={`flex gap-3 rounded-3xl p-3 ring-1 ${
                doDia.length > 0
                  ? "bg-surface shadow-[var(--shadow-low)] ring-border"
                  : "bg-[var(--color-surface-container)] ring-transparent"
              }`}
            >
              <div
                className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl ${
                  ehHoje
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : doDia.length > 0
                      ? "bg-[var(--color-secondary-container)] text-[var(--color-primary-strong)]"
                      : "text-[var(--color-text-secondary)]/70"
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase">
                  {DIAS[new Date(`${dia}T00:00:00.000Z`).getUTCDay()]}
                </span>
                <span className="text-[15px] font-extrabold">
                  {dia.slice(8)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                {doDia.length === 0 ? (
                  <p className="text-[12px] font-bold text-[var(--color-text-secondary)]/80">
                    {/*
                      Dia passado vazio não é "dia livre": `GET /me/classes` só
                      devolve o futuro, então a aula pode ter existido. Dizer
                      "sem aula" ali seria a tela afirmando o que não sabe.
                    */}
                    {jaPassou ? "—" : "Sem aula"}
                  </p>
                ) : (
                  doDia.map((aula) => (
                    <div key={aula.ocupacaoId} className="min-w-0">
                      {/*
                        **SPEC-057/TASK-002/D10 — a semana também leva à
                        ficha.** Antes estes itens eram `<div>` sem clique
                        nenhum: a vista mostrava a semana e terminava ali.

                        `mostrarLinkDaTurma` existe porque a HOME monta este
                        mesmo componente (SPEC-057/TASK-003), e lá o clique
                        ainda não tem destino — LIM-057h. Contexto decide,
                        como no nome da quadra.
                      */}
                      <p
                        className={`truncate text-[14px] font-extrabold ${aula.naoRealizada ? "text-[var(--color-text-secondary)] line-through" : "text-[var(--color-text-primary)]"}`}
                      >
                        {aula.horaInicio}–{aula.horaFim} ·{" "}
                        {mostrarLinkDaTurma ? (
                          <Link
                            href={`/minhas-aulas/turma/${aula.turmaId}`}
                            className="hover:underline"
                          >
                            {aula.turmaNome ?? "Turma"}
                          </Link>
                        ) : (
                          (aula.turmaNome ?? "Turma")
                        )}
                      </p>
                      {/* SPEC-030 / achado 1 da 2ª validação cruzada — esta
                          vista ignorava `naoRealizada` e mostrava a aula
                          como qualquer outra. O risco: o aluno se organiza
                          pela semana e vai ao clube numa aula que o gestor já
                          marcou como não realizada. */}
                      {aula.naoRealizada ? (
                        <p className="mt-0.5 text-[12px] font-extrabold text-[var(--color-text-secondary)]">
                          Aula não realizada
                        </p>
                      ) : null}
                      {mostrarQuadra ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                          <TennisCourtIcon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">{aula.quadraNome}</span>
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/*
        **SPEC-066/TASK-003 — o rodape saiu, porque a duvida que ele
        explicava acabou.**

        Ele so aparecia quando NAO havia `onJanela` — ou seja, quando ninguem
        buscava a semana passada e o "—" podia querer dizer *"nao sei"*. Agora
        esta vista busca a propria janela sempre, entao travessao quer dizer
        uma coisa so: **nao houve aula nesse dia**.

        Aviso que explica uma ambiguidade removida vira ruido, e depois vira
        mentira.
      */}
    </section>
  );
}
