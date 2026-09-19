/**
 * SPEC-062/D2a-1 — **a reconciliação, e por que ela é o mecanismo central.**
 *
 * A primeira versão desta spec apoiava a posse do aparelho no logout: sair da
 * conta desinscrevia, e pronto. A validação independente derrubou, e o
 * argumento é curto — o logout deste app **termina localmente mesmo com a rede
 * fora**, de propósito (`api-client.ts`: *"um botão 'Sair' que não sai é pior
 * que não ter botão"*). Se a aba morre antes do `unsubscribe()`, ou se ele
 * rejeita, a assinatura do service worker continua válida, e "até o próximo
 * envio falhar" pode ser **nunca**.
 *
 * Então a garantia mudou de lugar: **quem garante é a reconciliação**, e ela
 * roda antes de o push valer.
 *
 * ## Como se pergunta "de quem é esta assinatura?" sem rota para isso
 *
 * Não há rota de consulta, e não precisa haver: **o próprio registro é a
 * pergunta.** `POST /push/assinatura` com a assinatura que o navegador já tem
 * responde tudo de uma vez —
 *
 * - `204` → é minha (ou não era de ninguém, e agora é). Ligado.
 * - `409 ENDPOINT_EM_USO` → é de outra conta. Desinscreve, assina de novo,
 *   registra. O `unsubscribe()` é executado **pelo navegador dono da
 *   assinatura**, que é a única prova de controle que existe do lado do
 *   cliente — e ele mata o `endpoint` no serviço de push, não só a linha no
 *   banco.
 *
 * ## O limite, declarado (LIM-062j)
 *
 * Se o serviço de push devolver o **mesmo** `endpoint` depois do
 * `unsubscribe()`, o registro bate no `409` de novo. O app tenta **uma vez**, e
 * para. Insistir seria transferir posse por teimosia — exatamente o sequestro
 * que o `409` existe para impedir.
 */

export type EstadoDoPush =
  /** A reconciliação está rodando. O interruptor fica desabilitado. */
  | 'verificando'
  /** Assinatura registrada e confirmada como DESTA conta. */
  | 'ligado'
  /** Sem permissão, sem assinatura, ou a pessoa desligou. */
  | 'desligado'
  /** A reconciliação falhou. **Nunca `ligado` por otimismo.** */
  | 'erro';

/** D2a-1 — tentar de novo enquanto a aba está visível. Depois, só no botão. */
export const ESPERAS_DE_RETENTATIVA_MS = [5_000, 15_000, 60_000] as const;

export interface AssinaturaDoNavegador {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * O que a reconciliação precisa do mundo. Interface pequena de propósito: é o
 * que permite provar a máquina de estados sem navegador, sem rede e sem
 * relógio.
 */
export interface PortaDoNavegador {
  /** `null` quando não há permissão ou não há assinatura. */
  assinaturaAtual(): Promise<AssinaturaDoNavegador | null>;
  /** Mata a assinatura no serviço de push. `false` se falhou. */
  desinscrever(): Promise<boolean>;
  /** Cria assinatura nova (exige permissão já concedida). */
  assinar(): Promise<AssinaturaDoNavegador>;
  /** `POST /push/assinatura`. Lança `ConflitoDeEndpoint` no `409`. */
  registrar(a: AssinaturaDoNavegador): Promise<void>;
}

export class ConflitoDeEndpoint extends Error {
  constructor() {
    super('ENDPOINT_EM_USO');
    this.name = 'ConflitoDeEndpoint';
  }
}

export interface ResultadoDaReconciliacao {
  estado: EstadoDoPush;
  /** Por que parou, quando não ficou `ligado`. Vai para a tela, não para log. */
  motivo?: 'sem-assinatura' | 'aparelho-de-outra-conta' | 'falhou';
}

/**
 * Roda a reconciliação uma vez.
 *
 * **Nunca devolve `ligado` sem ter confirmado com o servidor.** O interruptor é
 * a única coisa que a pessoa tem para saber se vai receber aviso; se ele
 * mentir, ela descobre pelo aviso que não chegou.
 */
export async function reconciliar(
  porta: PortaDoNavegador,
): Promise<ResultadoDaReconciliacao> {
  let atual: AssinaturaDoNavegador | null;
  try {
    atual = await porta.assinaturaAtual();
  } catch {
    return { estado: 'erro', motivo: 'falhou' };
  }

  // Sem assinatura não é erro: é o estado de quem nunca ligou, ou desligou. A
  // tela oferece o interruptor, e a permissão só é pedida no toque (AC-007).
  if (!atual) {
    return { estado: 'desligado', motivo: 'sem-assinatura' };
  }

  try {
    await porta.registrar(atual);
    return { estado: 'ligado' };
  } catch (causa) {
    if (!(causa instanceof ConflitoDeEndpoint)) {
      return { estado: 'erro', motivo: 'falhou' };
    }
  }

  // `409`: o aparelho está registrado em OUTRA conta. Uma tentativa de troca.
  try {
    const matou = await porta.desinscrever();
    if (!matou) {
      return { estado: 'erro', motivo: 'aparelho-de-outra-conta' };
    }
    const nova = await porta.assinar();
    await porta.registrar(nova);
    return { estado: 'ligado' };
  } catch (causa) {
    // LIM-062j — veio `409` de novo: o serviço devolveu o mesmo `endpoint`.
    // Para aqui. Não se transfere posse por insistência.
    return {
      estado: 'erro',
      motivo:
        causa instanceof ConflitoDeEndpoint ? 'aparelho-de-outra-conta' : 'falhou',
    };
  }
}

/**
 * LIM-062c — **no iPhone, push só existe com o app instalado** na tela de
 * início (iOS 16.4+). Nenhuma configuração de servidor muda isso.
 *
 * A tela precisa saber para explicar, em vez de mostrar um interruptor que
 * nunca liga — que é o que aconteceria se só olhássemos `'PushManager' in
 * window`.
 *
 * **Recebe `ehIOS` em vez de detectar.** A detecção já existe em
 * `instalacao-pwa.ts`, e ela tem um ramo que uma versão escrita aqui não teria:
 * desde o iPadOS 13 **o iPad se anuncia como `Macintosh`**, e um regex só de
 * `iPhone|iPad|iPod` deixa todo iPad de fora. Duas detecções do mesmo fato
 * divergem — e a que diverge é sempre a mais nova.
 */
export function precisaInstalarNoIPhone(
  ehIOS: boolean,
  standalone: boolean,
  temPushManager: boolean,
): boolean {
  return ehIOS && !standalone && !temPushManager;
}

/**
 * A chave pública vem em base64url e o `PushManager` quer `Uint8Array`.
 *
 * Conversão chata e sem graça — está aqui, isolada e testada, porque escrita
 * inline ela é o tipo de coisa que "quase funciona": erra o padding e falha só
 * em algumas chaves, dependendo do tamanho.
 */
export function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64);
  // `new ArrayBuffer(...)` explicito, e nao `new Uint8Array(n)`: o TypeScript
  // moderno tipa o segundo como `ArrayBufferLike`, que inclui
  // `SharedArrayBuffer` — e `applicationServerKey` exige `ArrayBuffer`. Sem
  // isto o `subscribe()` nao compila, e a correcao no ponto de uso seria um
  // cast escondendo a diferenca.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) {
    bytes[i] = bruto.charCodeAt(i);
  }
  return bytes;
}
