import {
  ApiError,
  getChavePublicaDePush,
  registrarAssinaturaDePush,
  removerAssinaturaDePush,
} from "./api-client";
import {
  ConflitoDeEndpoint,
  chaveParaBytes,
  type AssinaturaDoNavegador,
  type PortaDoNavegador,
} from "./push-reconciliacao";

/**
 * SPEC-062 — **a implementação concreta da `PortaDoNavegador`.**
 *
 * Tudo o que depende de `PushManager`, de permissão e de rede mora aqui; a
 * decisão — quando desinscrever, quando desistir — mora em
 * `push-reconciliacao.ts`, que se prova sem navegador. A fronteira é o que
 * permitiu testar a posse do aparelho sem um aparelho.
 */

/** O que o service worker manda quando o `endpoint` muda sozinho. */
export const MENSAGEM_DE_RECONCILIAR = "playck:reconciliar-push";

function paraAssinatura(s: PushSubscription): AssinaturaDoNavegador {
  const json = s.toJSON();
  const chaves = json.keys ?? {};
  return {
    endpoint: s.endpoint,
    p256dh: chaves.p256dh ?? "",
    auth: chaves.auth ?? "",
  };
}

/** `true` quando o navegador tem tudo o que push exige. */
export function suportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** A permissão do sistema, sem pedir nada. */
export function permissaoAtual(): NotificationPermission | "indisponivel" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "indisponivel";
  }
  return Notification.permission;
}

export function criarPortaDoNavegador(): PortaDoNavegador {
  return {
    async assinaturaAtual() {
      if (!suportaPush() || Notification.permission !== "granted") {
        return null;
      }
      const registro = await navigator.serviceWorker.ready;
      const atual = await registro.pushManager.getSubscription();
      return atual ? paraAssinatura(atual) : null;
    },

    async desinscrever() {
      const registro = await navigator.serviceWorker.ready;
      const atual = await registro.pushManager.getSubscription();
      if (!atual) {
        return true;
      }
      // **Avisa o servidor ANTES de matar a assinatura**, e não depois: depois
      // do `unsubscribe()` o `endpoint` já não existe do lado do navegador, e
      // um `DELETE` que falhe deixaria a linha órfã até o primeiro `410`.
      // Melhor-esforço: se a rede estiver fora, o `unsubscribe()` acontece
      // mesmo assim — é ele que mata a capacidade de verdade.
      await removerAssinaturaDePush(atual.endpoint).catch(() => undefined);
      return atual.unsubscribe();
    },

    async assinar() {
      const registro = await navigator.serviceWorker.ready;
      const { chave } = await getChavePublicaDePush();
      const nova = await registro.pushManager.subscribe({
        // D1a — **obrigatório `true`.** Com `false` o WebKit recusa a
        // assinatura, e o Chrome mostra uma notificação genérica no lugar da
        // nossa. Push silencioso não existe; existe push que custa a
        // assinatura.
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(chave),
      });
      return paraAssinatura(nova);
    },

    async registrar(assinatura) {
      try {
        await registrarAssinaturaDePush(assinatura);
      } catch (causa) {
        // O `409` é resposta esperada, não falha: significa "este aparelho é
        // de outra conta". Vira tipo próprio para a máquina de estados poder
        // distinguir isso de rede caída sem reler corpo de erro.
        if (causa instanceof ApiError && causa.code === "ENDPOINT_EM_USO") {
          throw new ConflitoDeEndpoint();
        }
        throw causa;
      }
    },
  };
}

/**
 * AC-007 — **a permissão só é pedida dentro de um gesto da pessoa.**
 *
 * Navegador que pede na abertura leva "bloquear", e bloqueio não se desfaz sem
 * ir às configurações do sistema — é um caminho sem volta, criado por um
 * pedido que a pessoa não esperava. Por isso esta função existe separada de
 * tudo o que roda sozinho, e só o toque no interruptor a chama.
 */
export async function pedirPermissao(): Promise<NotificationPermission> {
  if (!suportaPush()) {
    return "denied";
  }
  return Notification.requestPermission();
}

/**
 * D2a — o logout desinscreve, **e é melhor-esforço declarado.**
 *
 * A garantia de posse do aparelho não mora aqui: mora na reconciliação, que
 * roda na abertura do app. Isto é só a cortesia de liberar o aparelho na
 * saída — e ela falha em silêncio de propósito, porque um "Sair" que trava por
 * causa de push seria pior que o problema que resolve.
 */
export async function desinscreverNoLogout(): Promise<void> {
  try {
    if (!suportaPush() || Notification.permission !== "granted") {
      return;
    }
    const registro = await navigator.serviceWorker.getRegistration();
    const atual = await registro?.pushManager.getSubscription();
    if (!atual) {
      return;
    }
    await removerAssinaturaDePush(atual.endpoint).catch(() => undefined);
    await atual.unsubscribe();
    avisarOutrasAbas();
  } catch {
    // Melhor-esforço. A abertura seguinte reconcilia.
  }
}

/**
 * D2a-1 — **o canal entre abas, e o buraco que ele fecha.**
 *
 * A assinatura é **uma por service worker**, então o `unsubscribe()` de uma aba
 * tira o push de todas. A aba que continua **visível** nunca recebe
 * `visibilitychange` — ela ficaria sem push por tempo indeterminado, com o
 * interruptor dizendo que está ligado.
 */
export function avisarOutrasAbas(): void {
  try {
    const canal = new BroadcastChannel("playck-push");
    canal.postMessage({ tipo: MENSAGEM_DE_RECONCILIAR });
    canal.close();
  } catch {
    // `BroadcastChannel` não existe em todo navegador. Sem ele, a outra aba
    // reconcilia no próximo `visibilitychange` — pior, e ainda assim correto.
  }
}
