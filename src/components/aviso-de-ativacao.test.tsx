import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_APOS_ATIVACAO, LOGIN_APOS_REDEFINICAO } from "@/lib/ativacao-navigation";
import {
  AvisoDeAtivacao,
  TEXTO_DO_AVISO_DE_ATIVACAO,
  TEXTO_DO_AVISO_DE_REDEFINICAO,
} from "./aviso-de-ativacao";

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

/**
 * SPEC-090 (AC-024, D9) — **o segundo protocolo, na mesma região.**
 *
 * As duas chegadas são medidas pelo mesmo roteiro: a região nasce vazia no
 * render (antes do efeito), o texto certo entra depois, e continua havendo uma
 * região só. Um ramo que preenchesse de imediato (S26) fica vermelho no
 * `toBeEmptyDOMElement` logo depois do `render`; uma segunda região (S25), no
 * `getAllByRole("status")`.
 */
describe("AvisoDeAtivacao — SPEC-090, a redefinição de senha", () => {
  it.each([
    [LOGIN_APOS_ATIVACAO, TEXTO_DO_AVISO_DE_ATIVACAO],
    [LOGIN_APOS_REDEFINICAO, TEXTO_DO_AVISO_DE_REDEFINICAO],
  ])("%s: uma região só, vazia antes do efeito, e o texto certo depois", async (endereco, texto) => {
    irPara(endereco);
    render(<AvisoDeAtivacao />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    await passarOTempo();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(regiao).toHaveTextContent(texto);
    expect(regiao.textContent).toBe(texto);
  });

  it("o texto da redefinição é o da D9", () => {
    expect(TEXTO_DO_AVISO_DE_REDEFINICAO).toBe("Senha redefinida. Entre com a senha nova.");
  });

  it.each(["/login?senha=", "/login?senha=1", "/login?senha=Redefinida", "/login?senha=redefinida2", "/login?redefinida=1"])(
    "%s: valor fora do protocolo, a região continua vazia",
    async (endereco) => {
      irPara(endereco);
      render(<AvisoDeAtivacao />);
      await passarOTempo();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    },
  );

  it("redefinição: não pede nada à rede, não grava nada e não tira o foco", async () => {
    irPara(LOGIN_APOS_REDEFINICAO);
    render(<AvisoDeAtivacao />);
    await passarOTempo();

    expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_AVISO_DE_REDEFINICAO);
    expect(pedidos).toEqual([]);
    expect(window.localStorage.length).toBe(0);
    expect(document.activeElement).toBe(document.body);
  });
});
