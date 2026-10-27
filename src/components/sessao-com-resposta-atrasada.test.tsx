import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { PrimeiroAcessoForm } from "./primeiro-acesso-form";
import { TopAppBar } from "./top-app-bar";
import {
  getMe,
  getMinhaEmpresa,
  limparCacheDaEmpresa,
  logout,
  salvarMeuCadastro,
} from "@/lib/api-client";

/**
 * A resposta atrasada de uma sessão anterior (PRD-090-R4-01). As rodadas R2 a
 * R4 acharam, uma a uma, respostas que gravavam o token de uma conta depois
 * que outra já estava na tela: a renovação, depois a troca de senha do
 * primeiro acesso. Aqui ficam as sequências da família inteira — renovação,
 * troca de senha, login e "Sair" — com os componentes de verdade, e só a
 * rede, o roteador e a recarga simulados.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("./sino-de-avisos", () => ({ SinoDeAvisos: () => null }));

const CHAVE = "playck_cliente_access_token";

function token(sub: string, companyId: string, rodada = 0): string {
  return `h.${btoa(JSON.stringify({ sub, companyId, iat: rodada }))}.s`;
}
const TOKEN_A = token("u-a", "a");
const TOKEN_B = token("u-b", "b");

function resposta(corpo: unknown, status = 200): Response {
  const fazer = (): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

/** Uma resposta que só chega quando o teste mandar. */
function emEspera() {
  let entregar!: (r: Response) => void;
  let comecou!: () => void;
  const pedida = new Promise<void>((r) => (comecou = r));
  const promessa = new Promise<Response>((r) => (entregar = r));
  return { entregar, pedida, responder: () => (comecou(), promessa) };
}

const CLUBE = {
  a: { id: "a", nome: "Clube A", logoUrl: null },
  b: { id: "b", nome: "Clube B", logoUrl: null },
};

function loginDe(conta: "a" | "b", senhaTemporaria = false) {
  return resposta({
    accessToken: conta === "a" ? TOKEN_A : TOKEN_B,
    usuario: { id: `u-${conta}`, role: "aluno", senhaTemporaria },
  });
}

/** A empresa de quem mandou o pedido, pelo cabeçalho de autorização. */
function empresaDoPedido(init?: RequestInit) {
  const auth = String((init?.headers as Record<string, string>)?.Authorization);
  return resposta(auth.includes(TOKEN_B) ? CLUBE.b : CLUBE.a);
}

type Rota = (url: string, init?: RequestInit) => Promise<Response> | undefined;
let rotas: Rota;
let fetchMock: ReturnType<typeof vi.fn>;
const pedidosPara = (fim: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(fim));

const recarregar = vi.fn();
const navegarDuro = vi.fn();
let hrefAtribuido: string | null;

beforeEach(() => {
  limparCacheDaEmpresa();
  window.localStorage.clear();
  push.mockClear();
  recarregar.mockClear();
  navegarDuro.mockClear();
  hrefAtribuido = null;
  const local = {
    ...window.location,
    pathname: "/home",
    reload: recarregar,
    assign: navegarDuro,
  };
  Object.defineProperty(local, "href", {
    get: () => "http://localhost/home",
    set: (v: string) => (hrefAtribuido = v),
  });
  vi.stubGlobal("location", local);
  rotas = () => undefined;
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    const daRota = rotas(u, init);
    if (daRota) return daRota;
    if (u.endsWith("/me/company")) return Promise.resolve(empresaDoPedido(init));
    return Promise.resolve(resposta([]));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  limparCacheDaEmpresa();
});

async function entrarPeloFormulario(email: string) {
  const tela = render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  return tela;
}

function pedirTrocaDeSenha() {
  const tela = render(<PrimeiroAcessoForm />);
  fireEvent.change(screen.getByLabelText("Senha temporária"), { target: { value: "temporaria" } });
  fireEvent.change(screen.getByLabelText("Sua nova senha"), { target: { value: "senha-nova-1" } });
  fireEvent.change(screen.getByLabelText("Repita a nova senha"), { target: { value: "senha-nova-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar minha senha" }));
  return tela;
}

const evento = () =>
  window.dispatchEvent(new StorageEvent("storage", { key: CHAVE }));

describe("a troca de senha do primeiro acesso que volta depois de outro login", () => {
  it("aba sem dono: a resposta de A não grava, não pede /auth/me e a tela fica de B", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const troca = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/trocar-senha") ? troca.responder()
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;

    const primeiro = pedirTrocaDeSenha();
    await troca.pedida;
    primeiro.unmount();
    const formulario = await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    formulario.unmount();
    render(<TopAppBar />);
    await screen.findByText("Clube B");

    troca.entregar(resposta({ accessToken: token("u-a", "a", 1) }));
    await new Promise((r) => setTimeout(r, 0));

    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(pedidosPara("/auth/me")).toHaveLength(0);
    expect(push).toHaveBeenCalledTimes(1);
    expect(recarregar).not.toHaveBeenCalled();
    expect(screen.getByText("Clube B")).toBeInTheDocument();
  });

  it("cabeçalho de A montado: o login de B navega com recarga, e a resposta de A não grava", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const troca = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/trocar-senha") ? troca.responder()
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;
    const cabecalho = render(<TopAppBar />);
    await screen.findByText("Clube A");

    const primeiro = pedirTrocaDeSenha();
    await troca.pedida;
    primeiro.unmount();
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(navegarDuro).toHaveBeenCalledWith("/home"));

    troca.entregar(resposta({ accessToken: token("u-a", "a", 1) }));
    await new Promise((r) => setTimeout(r, 0));

    expect(push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(pedidosPara("/auth/me")).toHaveLength(0);
    cabecalho.unmount();
  });

  it("a mesma conta: o primeiro acesso grava o token novo e segue sem recarga", async () => {
    rotas = (u) =>
      u.endsWith("/auth/login") ? Promise.resolve(loginDe("a", true))
      : u.endsWith("/auth/trocar-senha") ? Promise.resolve(resposta({ accessToken: token("u-a", "a", 1) }))
      : u.endsWith("/auth/me") ? Promise.resolve(resposta({ id: "u-a", role: "aluno" }))
      : undefined;

    const formulario = await entrarPeloFormulario("a@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/primeiro-acesso"));
    formulario.unmount();
    pedirTrocaDeSenha();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));

    expect(window.localStorage.getItem(CHAVE)).toBe(token("u-a", "a", 1));
    expect(window.localStorage.getItem("playck_cliente_papel")).toBe("aluno");
    expect(recarregar).not.toHaveBeenCalled();
    expect(navegarDuro).not.toHaveBeenCalled();
  });
});

describe("logins que se cruzam", () => {
  it("o login de A volta depois do de B: vence B, o último enviado", async () => {
    const loginA = emEspera();
    let n = 0;
    rotas = (u) => {
      if (!u.endsWith("/auth/login")) return undefined;
      n += 1;
      return n === 1 ? loginA.responder() : Promise.resolve(loginDe("b"));
    };

    const primeiro = await entrarPeloFormulario("a@x.com");
    await loginA.pedida;
    primeiro.unmount();
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    loginA.entregar(loginDe("a"));
    await new Promise((r) => setTimeout(r, 0));

    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(push).toHaveBeenCalledTimes(1);
    expect(navegarDuro).not.toHaveBeenCalled();
  });

  it("depois do \"Sair\", entrar em outra conta continua sem recarga", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    rotas = (u) => (u.endsWith("/auth/login") ? Promise.resolve(loginDe("b")) : undefined);
    expect((await getMinhaEmpresa()).nome).toBe("Clube A");

    await logout();
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));

    expect(navegarDuro).not.toHaveBeenCalled();
    expect(recarregar).not.toHaveBeenCalled();
    expect((await getMinhaEmpresa()).nome).toBe("Clube B");
  });

  it("entrar de novo na MESMA conta, sem \"Sair\", não recarrega", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    rotas = (u) => (u.endsWith("/auth/login") ? Promise.resolve(loginDe("a")) : undefined);
    await getMinhaEmpresa();

    await entrarPeloFormulario("a@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));

    expect(navegarDuro).not.toHaveBeenCalled();
  });
});

describe("a renovação de uma sessão que já acabou", () => {
  it.each([
    ["a", "push"],
    ["b", "recarga"],
  ] as const)("renovação de A volta depois do login de %s: descartada, e o pedido antigo não repete", async (conta, navegacao) => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const renovacao = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/refresh") ? renovacao.responder()
      : u.endsWith("/auth/me") ? Promise.resolve(resposta({}, 401))
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe(conta))
      : undefined;
    await getMinhaEmpresa();

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await renovacao.pedida;
    await entrarPeloFormulario(`${conta}@x.com`);
    const esperado = conta === "a" ? push : navegarDuro;
    await waitFor(() => expect(esperado).toHaveBeenCalledWith("/home"));
    renovacao.entregar(resposta({ accessToken: token("u-a", "a", 1) }));

    expect(await antigo).toBe("SESSAO_SUBSTITUIDA");
    expect(window.localStorage.getItem(CHAVE)).toBe(conta === "a" ? TOKEN_A : TOKEN_B);
    expect(pedidosPara("/auth/me")).toHaveLength(1);
    expect(recarregar).not.toHaveBeenCalled();
    expect(navegacao === "push" ? navegarDuro : push).not.toHaveBeenCalled();
  });

  it("o 401 da renovação antiga não desloga quem entrou depois", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const renovacao = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/refresh") ? renovacao.responder()
      : u.endsWith("/auth/me") ? Promise.resolve(resposta({}, 401))
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await renovacao.pedida;
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    renovacao.entregar(resposta({}, 401));

    expect(await antigo).toBe("SESSAO_SUBSTITUIDA");
    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(hrefAtribuido).toBeNull();
  });

  it("o \"crie sua senha\" de A que chega depois do login de B não leva B ao primeiro acesso", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const me = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/me") ? me.responder()
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await me.pedida;
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    me.entregar(resposta({ code: "SENHA_TEMPORARIA", message: "x" }, 403));

    expect(await antigo).toBe("SESSAO_SUBSTITUIDA");
    expect(hrefAtribuido).toBeNull();
  });

  it("o \"conta inativa\" de A que chega depois do login de B não desloga B", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const me = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/me") ? me.responder()
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await me.pedida;
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    me.entregar(resposta({ code: "CONTA_INATIVA", message: "x" }, 403));
    await antigo;

    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(hrefAtribuido).toBeNull();
  });

  it("a renovação nova não espera a antiga: a sessão de B renova por conta própria", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const antiga = emEspera();
    let renovacoes = 0;
    let mes = 0;
    rotas = (u) => {
      if (u.endsWith("/auth/refresh")) {
        renovacoes += 1;
        return renovacoes === 1
          ? antiga.responder()
          : Promise.resolve(resposta({ accessToken: token("u-b", "b", 1) }));
      }
      if (u.endsWith("/auth/me")) {
        mes += 1;
        return Promise.resolve(mes <= 2 ? resposta({}, 401) : resposta({ id: "u-b", role: "aluno" }));
      }
      if (u.endsWith("/auth/login")) return Promise.resolve(loginDe("b"));
      return undefined;
    };

    const deA = getMe().catch((e: { code?: string }) => e.code);
    await antiga.pedida;
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));

    expect((await getMe()).id).toBe("u-b");
    expect(renovacoes).toBe(2);
    antiga.entregar(resposta({ accessToken: token("u-a", "a", 1) }));
    expect(await deA).toBe("SESSAO_SUBSTITUIDA");
    expect(window.localStorage.getItem(CHAVE)).toBe(token("u-b", "b", 1));
  });

  it("o \"Sair\" com uma renovação em voo: ela não devolve o token apagado", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const renovacao = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/refresh") ? renovacao.responder()
      : u.endsWith("/auth/me") ? Promise.resolve(resposta({}, 401))
      : undefined;

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await renovacao.pedida;
    await logout();
    renovacao.entregar(resposta({ accessToken: token("u-a", "a", 1) }));

    expect(await antigo).toBe("SESSAO_SUBSTITUIDA");
    expect(window.localStorage.getItem(CHAVE)).toBeNull();
  });

  it("o \"Sair\" que termina depois do login seguinte não apaga a sessão nova", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const saida = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/logout") ? saida.responder()
      : u.endsWith("/auth/login") ? Promise.resolve(loginDe("b"))
      : undefined;

    const saindo = logout();
    await saida.pedida;
    await entrarPeloFormulario("b@x.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home"));
    saida.entregar(resposta({}));
    await saindo;

    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
  });
});

describe("a renovação que devolve outra conta", () => {
  it("a alteração não é repetida com o token da outra conta", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_B);
    rotas = (u) =>
      u.endsWith("/me/cadastro") ? Promise.resolve(resposta({}, 401))
      : u.endsWith("/auth/refresh") ? Promise.resolve(resposta({ accessToken: TOKEN_A }))
      : undefined;
    await getMinhaEmpresa();

    const erro = await salvarMeuCadastro({} as never).catch((e: { code?: string }) => e.code);

    expect(erro).toBe("SESSAO_SUBSTITUIDA");
    const alteracoes = pedidosPara("/me/cadastro");
    expect(alteracoes).toHaveLength(1);
    const { headers } = alteracoes[0][1] as { headers: Record<string, string> };
    expect(headers.Authorization).toBe(`Bearer ${TOKEN_B}`);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("outra aba troca de conta com a renovação desta em voo: a renovação não grava por cima", async () => {
    window.localStorage.setItem(CHAVE, TOKEN_A);
    const renovacao = emEspera();
    rotas = (u) =>
      u.endsWith("/auth/refresh") ? renovacao.responder()
      : u.endsWith("/auth/me") ? Promise.resolve(resposta({}, 401))
      : undefined;
    await getMinhaEmpresa();

    const antigo = getMe().catch((e: { code?: string }) => e.code);
    await renovacao.pedida;
    window.localStorage.setItem(CHAVE, TOKEN_B);
    evento();
    expect(recarregar).toHaveBeenCalledTimes(1);
    renovacao.entregar(resposta({ accessToken: token("u-a", "a", 1) }));

    expect(await antigo).toBe("SESSAO_SUBSTITUIDA");
    expect(window.localStorage.getItem(CHAVE)).toBe(TOKEN_B);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
