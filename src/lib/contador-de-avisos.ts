import { getAvisosNaoLidos } from "./api-client";

/**
 * SPEC-065/D5 — **o contador do sino, e as três travas contra a rajada.**
 *
 * ## O que a v2 da spec errou, e o validador pegou
 *
 * A v2 dizia "um pedido por evento, só nas abas abertas" e **não perguntou
 * quantos eventos nem quantas abas**. A conta: `P` pushes em `A` abas dão
 * `P × A` consultas.
 *
 * E rajada é o **caso normal**, não o excepcional: um gesto da SPEC-063 que
 * avisa vinte alunos são vinte pushes; um gestor com o Admin em três abas é
 * `A = 3`.
 *
 * ## As três travas, e cada uma corta um multiplicador
 *
 * | Trava | Corta | Como |
 * |---|---|---|
 * | só a aba **visível** consulta | o `A` | oculta marca sujo e pede no `visibilitychange` |
 * | **debounce** de 2 s | o `P` | evento novo **reagenda**, não soma |
 * | **single-flight** | a corrida | com pedido em voo, o próximo não começa |
 *
 * `P × A` vira ~1. E as três custam uma linha cada.
 *
 * ## Por que 2 s, e não 200 ms nem 10 s
 *
 * O número cobre a rajada de **um gesto**: o tick da SPEC-062 despacha o lote
 * numa passada só. Abaixo disso a rajada escapa; acima, o sino fica devendo
 * para quem está olhando a tela.
 */

/** O canal que a SPEC-062 já criou. Esta spec acrescenta duas mensagens. */
export const CANAL = "playck-push";

/** O `sw.js` posta isto ao receber um push que **não** é de teste. */
export const AVISO_NOVO = "playck:aviso-novo";

/** A aba que marcou tudo como lido posta isto. As outras zeram sem consultar. */
export const AVISOS_LIDOS = "playck:avisos-lidos";

export const DEBOUNCE_MS = 2_000;

interface Janela {
  visivel(): boolean;
  aoMudarVisibilidade(ouvinte: () => void): () => void;
  aoReceberMensagem(ouvinte: (tipo: string) => void): () => void;
  /** Para o teste substituir; em produção é `setTimeout`. */
  agendar(fn: () => void, ms: number): () => void;
}

/**
 * A porta do navegador, isolada para o teste poder dirigir o tempo e os
 * eventos sem `jsdom` fingindo ser um service worker.
 */
export function portaDoNavegador(): Janela {
  return {
    visivel: () =>
      typeof document === "undefined" || document.visibilityState === "visible",

    aoMudarVisibilidade(ouvinte) {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", ouvinte);
      return () => document.removeEventListener("visibilitychange", ouvinte);
    },

    aoReceberMensagem(ouvinte) {
      const limpezas: Array<() => void> = [];

      try {
        const canal = new BroadcastChannel(CANAL);
        canal.onmessage = (e: MessageEvent<{ tipo?: string }>) => {
          if (e.data?.tipo) ouvinte(e.data.tipo);
        };
        limpezas.push(() => canal.close());
      } catch {
        // Navegador sem BroadcastChannel: o caminho do service worker abaixo
        // continua valendo.
      }

      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        const daSw = (e: MessageEvent<{ tipo?: string }>) => {
          if (e.data?.tipo) ouvinte(e.data.tipo);
        };
        navigator.serviceWorker.addEventListener("message", daSw);
        limpezas.push(() =>
          navigator.serviceWorker.removeEventListener("message", daSw),
        );
      }

      return () => limpezas.forEach((f) => f());
    },

    agendar(fn, ms) {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
  };
}

/** Avisa as outras abas que esta marcou tudo como lido. */
export function avisarQueLeu(): void {
  try {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage({ tipo: AVISOS_LIDOS });
    canal.close();
  } catch {
    // Sem BroadcastChannel, cada aba se vira na próxima abertura.
  }
}

export interface ContadorDeAvisos {
  /** Desliga tudo: temporizador, canal e ouvinte de visibilidade. */
  parar(): void;
}

/**
 * Liga o contador. `aoMudar` recebe o número novo; **ele nunca é chamado com
 * um valor que a aba não confirmou** — a contagem vem sempre do servidor,
 * menos no caso `AVISOS_LIDOS`, que é zero por definição.
 */
export function ligarContador(
  aoMudar: (naoLidos: number) => void,
  porta: Janela = portaDoNavegador(),
  buscar: () => Promise<number> = getAvisosNaoLidos,
): ContadorDeAvisos {
  let emVoo = false;
  let sujo = false;
  let cancelarAgendamento: (() => void) | null = null;
  let parado = false;

  async function buscarAgora(): Promise<void> {
    if (parado) return;

    // **Single-flight.** Com um pedido em voo, o próximo não começa: marca
    // sujo e dispara no máximo mais um quando o primeiro voltar. Sem isto,
    // uma rajada viraria N pedidos simultâneos para a mesma resposta.
    if (emVoo) {
      sujo = true;
      return;
    }

    // **Só a aba visível consulta.** Oculta marca sujo e espera voltar — é o
    // que corta o multiplicador de abas, e normalmente só uma está visível.
    if (!porta.visivel()) {
      sujo = true;
      return;
    }

    emVoo = true;
    try {
      const n = await buscar();
      if (!parado) aoMudar(n);
    } catch {
      // Contador é conveniência: rede ruim não pode quebrar a tela. O número
      // fica velho até o próximo evento, e a LIM-065d já declara isso.
    } finally {
      emVoo = false;
      if (sujo && !parado) {
        sujo = false;
        void buscarAgora();
      }
    }
  }

  /** **Debounce**: evento novo REAGENDA, não soma. */
  function agendarBusca(): void {
    cancelarAgendamento?.();
    cancelarAgendamento = porta.agendar(() => {
      cancelarAgendamento = null;
      void buscarAgora();
    }, DEBOUNCE_MS);
  }

  const pararMensagens = porta.aoReceberMensagem((tipo) => {
    if (tipo === AVISO_NOVO) {
      agendarBusca();
      return;
    }
    if (tipo === AVISOS_LIDOS) {
      // **Zera sem consultar.** É o caso que derrubou a v1 da spec: uma aba
      // marcava tudo como lido e a outra seguia mostrando número positivo.
      aoMudar(0);
    }
  });

  const pararVisibilidade = porta.aoMudarVisibilidade(() => {
    if (porta.visivel() && sujo) {
      sujo = false;
      void buscarAgora();
    }
  });

  // A primeira contagem, na abertura. Sem debounce: não há rajada aqui.
  void buscarAgora();

  return {
    parar() {
      parado = true;
      cancelarAgendamento?.();
      pararMensagens();
      pararVisibilidade();
    },
  };
}
