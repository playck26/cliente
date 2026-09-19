"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, pedirAvisoDeTeste } from "@/lib/api-client";
import { ehIOS, estaInstalado } from "@/lib/instalacao-pwa";
import {
  avisarOutrasAbas,
  criarPortaDoNavegador,
  MENSAGEM_DE_RECONCILIAR,
  pedirPermissao,
  suportaPush,
} from "@/lib/push-do-navegador";
import {
  ESPERAS_DE_RETENTATIVA_MS,
  precisaInstalarNoIPhone,
  reconciliar,
  type EstadoDoPush,
  type ResultadoDaReconciliacao,
} from "@/lib/push-reconciliacao";

/**
 * SPEC-062/D3, D2a-1, D6 — **"Avisos do clube", no perfil.**
 *
 * ## O interruptor nunca mente
 *
 * Quatro estados, e `erro` é um deles. Enquanto a reconciliação não confirmou
 * com o servidor de quem é a assinatura, ele fica em `verificando` e
 * desabilitado — **nunca `ligado` por otimismo**. É a única coisa que a pessoa
 * tem para saber se vai receber aviso; se ele mentir, ela descobre pelo aviso
 * que não chegou.
 *
 * ## A permissão só é pedida no toque (AC-007)
 *
 * Navegador que pede na abertura leva "bloquear", e bloqueio não se desfaz sem
 * ir às configurações do sistema. Abrir o app, trocar de rota ou voltar ao
 * primeiro plano **não** chamam `requestPermission()` — só o toque aqui.
 *
 * ## Três gatilhos de reconciliação
 *
 * Montagem, `online` e `BroadcastChannel`. O terceiro fecha o buraco que a
 * validação achou: a assinatura é **uma por service worker**, então o logout
 * numa aba tira o push de todas — e a aba que continua **visível** nunca recebe
 * `visibilitychange`.
 */

const TEXTO: Record<EstadoDoPush, { titulo: string; detalhe: string }> = {
  verificando: {
    titulo: "Conferindo neste aparelho…",
    detalhe: "Só um instante.",
  },
  ligado: {
    titulo: "Avisos ligados",
    detalhe: "Você recebe avisos do clube neste aparelho.",
  },
  desligado: {
    titulo: "Avisos desligados",
    detalhe: "Ligue para saber de aula cancelada e reserva sem abrir o app.",
  },
  erro: {
    titulo: "Não deu para conferir agora",
    detalhe: "Toque em tentar de novo.",
  },
};

export function AvisosDoClube() {
  const [estado, setEstado] = useState<EstadoDoPush>("verificando");
  const [motivo, setMotivo] = useState<ResultadoDaReconciliacao["motivo"]>();
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  /**
   * **Gatilho em vez de recursão.** A retentativa reagenda incrementando isto,
   * e não chamando a si mesma: função que se referencia dentro do próprio
   * `useCallback` é acesso antes da declaração, e a versão com `ref` esconde
   * a dependência de quem lê depois.
   */
  const [gatilho, setGatilho] = useState(0);
  const tentativa = useRef(0);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Tudo o que mexe em estado mora aqui dentro, e depois de um `await`: o
    // `set` síncrono no corpo do efeito dispara renderização em cascata, e o
    // eslint do projeto recusa (`react-hooks/set-state-in-effect`).
    const rodar = async () => {
      if (!suportaPush()) {
        if (vivo) setEstado("desligado");
        return;
      }
      const r = await reconciliar(criarPortaDoNavegador());
      if (!vivo) return;

      setEstado(r.estado);
      setMotivo(r.motivo);

      // D2a-1 — espera crescente enquanto houver o que tentar. Esgotadas as
      // três, só o botão: insistir para sempre gastaria bateria repetindo um
      // erro que já se mostrou estável.
      if (r.estado === "erro" && r.motivo === "falhou") {
        const espera = ESPERAS_DE_RETENTATIVA_MS[tentativa.current];
        if (espera !== undefined) {
          tentativa.current += 1;
          timer = setTimeout(() => {
            if (vivo) setGatilho((g) => g + 1);
          }, espera);
        }
      } else {
        tentativa.current = 0;
      }
    };

    void rodar();

    const aoVoltarARede = () => setGatilho((g) => g + 1);
    window.addEventListener("online", aoVoltarARede);

    const aoReceberAviso = (e: MessageEvent<{ tipo?: string }>) => {
      if (e.data?.tipo === MENSAGEM_DE_RECONCILIAR) {
        setGatilho((g) => g + 1);
      }
    };

    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel("playck-push");
      canal.onmessage = aoReceberAviso;
    } catch {
      // Navegador sem `BroadcastChannel`: a outra aba reconcilia no próximo
      // `visibilitychange`. Pior, e ainda assim correto.
    }

    navigator.serviceWorker?.addEventListener("message", aoReceberAviso);

    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", aoVoltarARede);
      navigator.serviceWorker?.removeEventListener("message", aoReceberAviso);
      canal?.close();
    };
  }, [gatilho]);

  const reconciliarDeNovo = () => {
    tentativa.current = 0;
    setGatilho((g) => g + 1);
  };

  const ligar = async () => {
    setOcupado(true);
    setRecado(null);
    try {
      // AC-007 — **aqui, e só aqui.** Estamos dentro do gesto.
      const permissao = await pedirPermissao();
      if (permissao !== "granted") {
        setEstado("desligado");
        setRecado(
          permissao === "denied"
            ? "Você bloqueou os avisos para este site. Para voltar atrás, é nas configurações do navegador."
            : null,
        );
        return;
      }
      const porta = criarPortaDoNavegador();
      const nova = await porta.assinar();
      await porta.registrar(nova);
      setEstado("ligado");
      setMotivo(undefined);
      avisarOutrasAbas();
    } catch {
      setEstado("erro");
      setMotivo("falhou");
      setRecado("Não deu para ligar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    setOcupado(true);
    setRecado(null);
    try {
      await criarPortaDoNavegador().desinscrever();
      setEstado("desligado");
      setMotivo("sem-assinatura");
      avisarOutrasAbas();
    } catch {
      setRecado("Não deu para desligar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const testar = async () => {
    setOcupado(true);
    setRecado(null);
    try {
      await pedirAvisoDeTeste();
      setRecado("Aviso enviado. Deve chegar em alguns segundos.");
    } catch (causa) {
      const code = causa instanceof ApiError ? causa.code : undefined;
      setRecado(
        code === "TESTE_JA_ENFILEIRADO"
          ? "Já há um aviso de teste a caminho."
          : code === "TESTE_ACIMA_DO_TETO"
            ? "Você já pediu três testes na última hora."
            : "Não deu para enviar o teste agora.",
      );
    } finally {
      setOcupado(false);
    }
  };

  // LIM-062c — no iPhone fora do app instalado, push não existe. Explicar é
  // melhor que mostrar um interruptor que nunca liga.
  if (
    typeof window !== "undefined" &&
    precisaInstalarNoIPhone(ehIOS(), estaInstalado(), suportaPush())
  ) {
    return (
      <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
        <h2 className="text-[15px] font-extrabold text-foreground">
          Avisos do clube
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          No iPhone, os avisos só funcionam com o PlayCK instalado na tela de
          início. Toque em Compartilhar e depois em &quot;Adicionar à Tela de
          Início&quot;.
        </p>
      </section>
    );
  }

  const texto = TEXTO[estado];
  const ligadoAgora = estado === "ligado";
  const podeMexer = estado !== "verificando" && !ocupado;

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-foreground">
          Avisos do clube
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={ligadoAgora}
          aria-label="Avisos do clube"
          disabled={!podeMexer}
          onClick={() => void (ligadoAgora ? desligar() : ligar())}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            ligadoAgora
              ? "bg-[var(--color-primary-strong)]"
              : "bg-[var(--color-text-secondary)]/30"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${
              ligadoAgora ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
        {texto.titulo} {texto.detalhe}
      </p>

      {estado === "erro" && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[13px] font-bold text-[var(--color-text-secondary)] ring-1 ring-border"
        >
          <span>
            {motivo === "aparelho-de-outra-conta"
              ? "Não foi possível ativar neste aparelho: ele está registrado em outra conta."
              : "Não deu para conferir agora."}
          </span>
          <button
            type="button"
            onClick={reconciliarDeNovo}
            className="rounded-full bg-[var(--color-primary-strong)] px-3 py-1 text-[13px] font-bold text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {ligadoAgora && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void testar()}
          className="mt-3 block w-full rounded-2xl bg-[var(--color-primary-strong)] py-3 text-center text-[13px] font-extrabold text-white active:scale-[0.99] disabled:opacity-60"
        >
          Enviar aviso de teste
        </button>
      )}

      {recado && (
        <p
          role="alert"
          className="mt-2 text-[12px] text-[var(--color-text-secondary)]"
        >
          {recado}
        </p>
      )}
    </section>
  );
}
