"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  confirmarVezNaFila,
  listarMinhaFila,
  sairDaFila,
  type LinhaDaFila,
} from "@/lib/api-client";

/**
 * SPEC-064/TASK-005 — **a tela da fila de espera.**
 *
 * ## Por que ela chega um ciclo depois do resto
 *
 * A fila inteira subiu em 20/09 — entrar, o varredor que chama, o prazo, a
 * confirmação atômica, o aviso *"Sua vez"* — e **nenhuma tela a usava**. Só o
 * arquivo de tipos gerado conhecia as rotas. A LIM-064d promete que quem não
 * tem push *"vê na tela da fila"*, e a tela não existia.
 *
 * ## `vezAberta`, e não `estado === "chamado"`
 *
 * O campo vem calculado do servidor de propósito. Quem expira a vez é um
 * agendador com interruptor (D8), então uma linha pode estar `chamado` no
 * banco com o prazo **já vencido**. Mostrar "Confirmar" nesse caso seria
 * oferecer o que o servidor recusa com `VEZ_EXPIRADA` — a armadilha do
 * DEF-011, que este projeto já pagou.
 *
 * ## O texto não promete vaga
 *
 * A LIM-064a é explícita: a fila é **convite para tentar primeiro**, não
 * reserva. Alguém pode levar a vaga pela tela normal durante o prazo
 * (LIM-064f), e um texto que dissesse *"sua vaga está garantida"* produziria
 * uma recusa que a pessoa não entende.
 *
 * ## Não mostra posição
 *
 * LIM-064c. Posição que anda para trás — porque alguém à frente desistiu, ou
 * porque a vaga foi tomada — é pior que nenhuma.
 */

/**
 * O que cada recusa quer dizer. **Chaveado pelo código, não pela mensagem**:
 * o código é contrato, a mensagem é copy e muda sem aviso. Tela que decide por
 * mensagem quebra calada — é a mesma regra do `turmas-do-clube`.
 */
const RECUSA: Record<string, string> = {
  NAO_E_SUA_VEZ: "Esta vez não está mais aberta.",
  VEZ_EXPIRADA: "O prazo desta vez venceu.",
  TURMA_SEM_VAGA: "A vaga foi preenchida antes de você confirmar.",
  TURMA_CHEIA: "A vaga foi preenchida antes de você confirmar.",
  SEM_CREDITO_DE_REPOSICAO: "Você não tem mais crédito de reposição.",
  TETO_DE_REPOSICAO: "Você atingiu o limite de reposições.",
  JA_MATRICULADO_NA_TURMA: "Você já está nesta turma.",
};

/** "quinta (19h)" / "quinta (19h30)" — a mesma forma do aviso. */
function quando(data: string, horaInicio: string): string {
  const dia = new Date(`${data}T12:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .replace(/-feira$/, "");
  const [hh, mm] = horaInicio.split(":");
  return `${dia} (${mm === "00" ? `${hh}h` : `${hh}h${mm}`})`;
}

/** "até quinta às 19h" — o prazo da vez. */
function ate(iso: string): string {
  const d = new Date(iso);
  const dia = d
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .replace(/-feira$/, "");
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const [hh, mm] = hora.split(":");
  return `${dia} às ${mm === "00" ? `${hh}h` : `${hh}h${mm}`}`;
}

/** O alvo, em uma linha, sem inventar dado que não veio. */
function alvo(linha: LinhaDaFila): string {
  if (linha.fila === "turma") {
    return linha.turmaNome ?? "Uma turma";
  }
  const nome = linha.turmaNome ?? "Uma aula";
  return linha.data && linha.horaInicio
    ? `${nome} · ${quando(linha.data, linha.horaInicio)}`
    : nome;
}

export function MinhaFilaDeEspera() {
  const [linhas, setLinhas] = useState<LinhaDaFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [agindoEm, setAgindoEm] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  /**
   * **Falha tolerada, e de propósito.** A fila é um extra nesta tela; se a
   * chamada cair, o resto continua. Esconder a agenda por causa da fila seria
   * trocar um problema pequeno por um grande.
   *
   * Cadeia de promessa, e não `async` no corpo do efeito: é o idioma das
   * outras listas deste app, e o `react-hooks/set-state-in-effect` reprova a
   * outra forma — `setState` síncrono dentro do efeito encadeia renders.
   */
  const carregar = () =>
    listarMinhaFila()
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));

  useEffect(() => {
    void carregar();
    // `carregar` fora das dependências de propósito: ela é recriada a cada
    // render e entraria em laço. A busca inicial acontece uma vez, e as
    // recargas são explícitas.
     
  }, []);

  async function agir(linha: LinhaDaFila, acao: "confirmar" | "sair") {
    setAgindoEm(linha.id);
    setRecusa(null);
    try {
      if (acao === "confirmar") {
        await confirmarVezNaFila(linha.id);
      } else {
        await sairDaFila(linha.id);
      }
      await carregar();
    } catch (erro) {
      // A recusa é desfecho NORMAL da confirmação (LIM-064f), não defeito: a
      // vaga pode ter sido tomada pela tela normal durante o prazo. E a linha
      // já ficou encerrada no servidor — por isso a lista é recarregada.
      const code = erro instanceof ApiError ? erro.code : null;
      setRecusa(
        (code && RECUSA[code]) ??
          (erro instanceof Error ? erro.message : "Não foi possível agora."),
      );
      await carregar();
    } finally {
      setAgindoEm(null);
    }
  }

  // Nada a dizer: a tela não ganha um bloco vazio só para existir.
  if (carregando || linhas.length === 0) {
    return null;
  }

  const suaVez = linhas.filter((l) => l.vezAberta);
  const esperando = linhas.filter((l) => !l.vezAberta);

  return (
    <section className="mb-4" aria-label="Fila de espera">
      {suaVez.map((linha) => (
        <article
          key={linha.id}
          className="mb-3 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-4"
        >
          <h3 className="text-[15px] font-black">É a sua vez</h3>
          <p className="mt-1 text-[13px] font-bold">{alvo(linha)}</p>
          {linha.chamadoAte && (
            <p className="mt-1 text-[12px] font-bold text-[var(--color-text-secondary)]">
              Confirme até {ate(linha.chamadoAte)}
            </p>
          )}
          {/*
            LIM-064a — o texto NÃO promete a vaga. Quem marcar primeiro fica
            com ela, e dizer o contrário produziria uma recusa incompreensível.
          */}
          <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
            A vaga não está reservada — quem confirmar primeiro fica com ela.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              disabled={agindoEm === linha.id}
              onClick={() => void agir(linha, "confirmar")}
            >
              {agindoEm === linha.id ? "Confirmando…" : "Confirmar"}
            </Button>
            <Button
              variant="outline"
              disabled={agindoEm === linha.id}
              onClick={() => void agir(linha, "sair")}
            >
              Desistir
            </Button>
          </div>
        </article>
      ))}

      {esperando.length > 0 && (
        <article className="rounded-2xl bg-[var(--color-surface)] p-4">
          <h3 className="text-[13px] font-black text-[var(--color-text-secondary)]">
            Na fila de espera
          </h3>
          <ul className="mt-2 space-y-2">
            {esperando.map((linha) => (
              <li
                key={linha.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-[13px] font-bold">{alvo(linha)}</span>
                <button
                  type="button"
                  className="text-[12px] font-bold text-[var(--color-text-secondary)] underline"
                  disabled={agindoEm === linha.id}
                  onClick={() => void agir(linha, "sair")}
                >
                  {agindoEm === linha.id ? "Saindo…" : "Sair"}
                </button>
              </li>
            ))}
          </ul>
        </article>
      )}

      {recusa && (
        <p
          role="alert"
          className="mt-2 text-[12px] font-bold text-[var(--color-error)]"
        >
          {recusa}
        </p>
      )}
    </section>
  );
}
