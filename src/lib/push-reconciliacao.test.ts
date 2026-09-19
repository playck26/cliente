import { describe, expect, it, vi } from "vitest";
import {
  chaveParaBytes,
  ConflitoDeEndpoint,
  precisaInstalarNoIPhone,
  reconciliar,
  type AssinaturaDoNavegador,
  type PortaDoNavegador,
} from "./push-reconciliacao";

/**
 * SPEC-062/D2a-1 — **a máquina de estados da reconciliação.**
 *
 * Ela é o mecanismo central da posse do aparelho, e é a correção do achado que
 * derrubou a primeira versão da spec: apoiar a garantia no logout, que termina
 * localmente mesmo com a rede fora.
 *
 * Os testes existem sem navegador de propósito — a `PortaDoNavegador` é uma
 * interface de quatro métodos justamente para isto. Um teste contra
 * `PushManager` real provaria o navegador.
 */
const ASSINATURA: AssinaturaDoNavegador = {
  endpoint: "https://push.exemplo/aparelho-1",
  p256dh: "chave-do-aparelho",
  auth: "segredo-do-aparelho",
};
const OUTRA: AssinaturaDoNavegador = { ...ASSINATURA, endpoint: "https://push.exemplo/aparelho-2" };

function porta(sobrepor: Partial<PortaDoNavegador> = {}): PortaDoNavegador {
  return {
    assinaturaAtual: vi.fn().mockResolvedValue(ASSINATURA),
    desinscrever: vi.fn().mockResolvedValue(true),
    assinar: vi.fn().mockResolvedValue(OUTRA),
    registrar: vi.fn().mockResolvedValue(undefined),
    ...sobrepor,
  };
}

describe("reconciliar — o caminho de quem já é dono", () => {
  it("assinatura minha: liga, e o registro É a pergunta", async () => {
    // Não há rota de "de quem é este endpoint", e não precisa haver: o próprio
    // `POST /push/assinatura` responde. `204` = é minha.
    const p = porta();

    expect(await reconciliar(p)).toEqual({ estado: "ligado" });
    expect(p.registrar).toHaveBeenCalledWith(ASSINATURA);
    expect(p.desinscrever).not.toHaveBeenCalled();
  });

  it("sem assinatura: desligado, e isso NÃO é erro", async () => {
    // É o estado de quem nunca ligou, ou desligou. A permissão só é pedida no
    // toque (AC-007) — pedir aqui levaria "bloquear", e bloqueio não se desfaz
    // sem ir às configurações do sistema.
    const p = porta({ assinaturaAtual: vi.fn().mockResolvedValue(null) });

    expect(await reconciliar(p)).toEqual({
      estado: "desligado",
      motivo: "sem-assinatura",
    });
    expect(p.registrar).not.toHaveBeenCalled();
  });
});

describe("reconciliar — o aparelho de outra conta (409)", () => {
  it("desinscreve, assina de novo e registra", async () => {
    const registrar = vi
      .fn()
      .mockRejectedValueOnce(new ConflitoDeEndpoint())
      .mockResolvedValueOnce(undefined);
    const p = porta({ registrar });

    expect(await reconciliar(p)).toEqual({ estado: "ligado" });
    expect(p.desinscrever).toHaveBeenCalledTimes(1);
    expect(p.assinar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenLastCalledWith(OUTRA);
  });

  it("LIM-062j — mesmo endpoint de volta: UMA tentativa, e para", async () => {
    // O serviço devolveu o mesmo `endpoint` depois do `unsubscribe()`.
    // Insistir seria transferir posse por teimosia — que é exatamente o
    // sequestro que o `409` existe para impedir.
    const registrar = vi.fn().mockRejectedValue(new ConflitoDeEndpoint());
    const p = porta({ registrar });

    expect(await reconciliar(p)).toEqual({
      estado: "erro",
      motivo: "aparelho-de-outra-conta",
    });
    expect(p.desinscrever).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledTimes(2);
  });

  it("`unsubscribe()` que falha não vira `ligado`", async () => {
    const p = porta({
      registrar: vi.fn().mockRejectedValue(new ConflitoDeEndpoint()),
      desinscrever: vi.fn().mockResolvedValue(false),
    });

    expect((await reconciliar(p)).estado).toBe("erro");
    expect(p.assinar).not.toHaveBeenCalled();
  });
});

describe("reconciliar — falhar é um estado, e nunca vira `ligado`", () => {
  it("rede caída ao consultar o navegador", async () => {
    const p = porta({
      assinaturaAtual: vi.fn().mockRejectedValue(new Error("boom")),
    });
    expect(await reconciliar(p)).toEqual({ estado: "erro", motivo: "falhou" });
  });

  it("rede caída ao registrar", async () => {
    const p = porta({ registrar: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(await reconciliar(p)).toEqual({ estado: "erro", motivo: "falhou" });
  });

  it("nenhum caminho devolve `ligado` sem o servidor ter confirmado", async () => {
    // Guarda contra a regressão mais cara possível: um interruptor que diz
    // "ligado" por otimismo. A pessoa descobriria pelo aviso que não chegou.
    const falhas = [
      porta({ assinaturaAtual: vi.fn().mockRejectedValue(new Error()) }),
      porta({ registrar: vi.fn().mockRejectedValue(new Error()) }),
      porta({
        registrar: vi.fn().mockRejectedValue(new ConflitoDeEndpoint()),
        desinscrever: vi.fn().mockResolvedValue(false),
      }),
    ];
    for (const p of falhas) {
      expect((await reconciliar(p)).estado).not.toBe("ligado");
    }
  });
});

describe("precisaInstalarNoIPhone — LIM-062c", () => {
  it("iOS no navegador, sem PushManager: precisa instalar", () => {
    expect(precisaInstalarNoIPhone(true, false, false)).toBe(true);
  });

  it("iOS já instalado: não precisa", () => {
    expect(precisaInstalarNoIPhone(true, true, true)).toBe(false);
  });

  it("fora do iOS não é caso de instalar no iPhone", () => {
    // A mensagem é específica do iOS. Mostrá-la no Android seria mandar a
    // pessoa fazer algo que não resolve o problema dela.
    expect(precisaInstalarNoIPhone(false, false, false)).toBe(false);
  });

  it("recebe `ehIOS` pronto, e isso é a decisão", () => {
    // A detecção mora em `instalacao-pwa.ts`, que trata o iPad anunciando-se
    // como `Macintosh` desde o iPadOS 13. Uma segunda detecção aqui
    // divergiria — e a que diverge é sempre a mais nova.
    expect(precisaInstalarNoIPhone(true, false, false)).toBe(true);
  });
});

describe("chaveParaBytes", () => {
  it("converte base64url com e sem padding", () => {
    // O padding é a parte que "quase funciona": sem ele, falha só em algumas
    // chaves, dependendo do tamanho.
    expect(Array.from(chaveParaBytes("AQAB"))).toEqual([1, 0, 1]);
    expect(Array.from(chaveParaBytes("AQ"))).toEqual([1]);
  });

  it("aceita os caracteres trocados do base64url", () => {
    // `-` e `_` no lugar de `+` e `/`: é o que o VAPID usa.
    expect(Array.from(chaveParaBytes("-_8"))).toEqual([251, 255]);
  });

  it("uma chave VAPID real tem 65 bytes", () => {
    // 65 bytes = **87 caracteres** em base64url, nao 88: 65 = 3*21 + 2, entao
    // sao 21 grupos de 4 mais 3 caracteres. A chave que a producao devolveu
    // tem exatamente 87 — e a primeira versao deste teste usava 88, que
    // decodifica para 66. O teste estava errado, nao a conversao.
    const chave = "B" + "A".repeat(84) + "ab";
    expect(chave).toHaveLength(87);
    expect(chaveParaBytes(chave)).toHaveLength(65);
  });
});
