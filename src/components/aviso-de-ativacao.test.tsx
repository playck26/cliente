import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_APOS_ATIVACAO } from "@/lib/ativacao-navigation";
import { AvisoDeAtivacao, TEXTO_DO_AVISO_DE_ATIVACAO } from "./aviso-de-ativacao";

/**
 * SPEC-084 (AC-008, TEST-005) — **o aviso de quem acabou de ativar a conta.**
 *
 * O que o jsdom consegue provar: a região existe vazia na montagem, o texto
 * entra depois, só para o valor exato do protocolo, e nada vai para a rede ou
 * para o armazenamento. O HTML do servidor e a navegação real ficam no
 * `e2e/login-aviso-ativacao.spec.ts`, porque só o navegador os tem.
 */

let pedidos: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  pedidos = [];
  // O `vitest.setup.ts` já recusa `fetch`; aqui ele também é CONTADO, para
  // que "nenhum pedido" seja observado e não deduzido.
  vi.stubGlobal("fetch", (entrada: RequestInfo | URL) => {
    pedidos.push(String(entrada));
    return Promise.reject(new Error("o aviso não pode pedir nada"));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function irPara(endereco: string) {
  window.history.replaceState(null, "", endereco);
}

async function passarOTempo() {
  await act(async () => {
    vi.advanceTimersByTime(1_000);
  });
}

describe("AvisoDeAtivacao", () => {
  it("chegando pela constante: a região nasce vazia e o texto entra depois", async () => {
    irPara(LOGIN_APOS_ATIVACAO);
    render(<AvisoDeAtivacao />);

    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    await passarOTempo();
    expect(regiao).toHaveTextContent(TEXTO_DO_AVISO_DE_ATIVACAO);
    expect(TEXTO_DO_AVISO_DE_ATIVACAO).toBe("Conta ativada. Entre com seu e-mail e senha.");
  });

  it.each(["/login", "/login?ativado=0", "/login?ativado=sim", "/login?ativacao=1"])(
    "%s: a região existe e continua vazia",
    async (endereco) => {
      irPara(endereco);
      render(<AvisoDeAtivacao />);
      await passarOTempo();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    },
  );

  it("não pede nada à rede, não grava nada e não tira o foco de onde está", async () => {
    irPara(LOGIN_APOS_ATIVACAO);
    const antes = { ...window.localStorage };
    render(<AvisoDeAtivacao />);
    await passarOTempo();

    expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_AVISO_DE_ATIVACAO);
    expect(pedidos).toEqual([]);
    expect({ ...window.localStorage }).toEqual(antes);
    expect(window.localStorage.length).toBe(0);
    expect(document.activeElement).toBe(document.body);
  });
});
