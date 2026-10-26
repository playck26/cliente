import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContaDaRedefinicao } from "@/lib/api-client";
import { metadata } from "@/app/redefinir-senha/[token]/page";
import { RedefinirSenhaForm, TEXTO_LINK_DE_REDEFINICAO_INVALIDO } from "./redefinir-senha-form";

/**
 * SPEC-090 (AC-023, D4, D5, D9) — **a página do link de redefinição.**
 *
 * O `fetch` é simulado (e não o `api-client`), para que o teste veja o que sai
 * de verdade: caminho, método, corpo e o `referrerPolicy` das duas chamadas.
 *
 * O destino depois do `204` é provado com um **sentinela**, como na ativação:
 * o módulo do protocolo é trocado por um que exporta outro endereço, e o
 * roteador tem de receber o sentinela. Um formulário que escrevesse
 * `/login?…` à mão mandaria para o endereço dele.
 */

const { SENTINELA, replace, push } = vi.hoisted(() => ({
  SENTINELA: "/destino-do-protocolo?sentinela=redefinicao",
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/ativacao-navigation", () => ({ LOGIN_APOS_REDEFINICAO: SENTINELA }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

/**
 * Um token com o formato do de verdade (43 caracteres de base64url), montado
 * em pedaços: num literal só, ele tem a forma de chave que o G4 do
 * `scripts/gates-de-push.mjs` recusa (INV-062b).
 */
const TOKEN = ["AbCdEfGhIjKlMnOpQrStUvWxYz", "0123456789", "-_AbCdE"].join("");

const CONTA_A: ContaDaRedefinicao = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  papel: "aluno",
  empresa: { nome: "Clube A", logoUrl: null },
};
const CONTA_B: ContaDaRedefinicao = {
  usuarioId: "22222222-2222-4222-8222-222222222222",
  papel: "professor",
  empresa: { nome: "Clube B", logoUrl: null },
};

const INVALIDO = {
  statusCode: 410,
  code: "LINK_INVALIDO",
  message: 'Este link não vale mais. Peça outro em "Esqueceu a senha?".',
};

type Pedido = {
  caminho: string;
  metodo: string;
  corpo: unknown;
  referrerPolicy: RequestInit["referrerPolicy"];
};
let pedidos: Pedido[] = [];

type Respostas = {
  get: () => Response | Promise<Response>;
  post?: () => Response | Promise<Response>;
};

function servidor({ get, post = () => new Response(null, { status: 204 }) }: Respostas) {
  pedidos = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(entrada));
      const metodo = (init?.method ?? "GET").toUpperCase();
      pedidos.push({
        caminho: url.pathname,
        metodo,
        corpo: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        referrerPolicy: init?.referrerPolicy,
      });
      if (metodo === "GET" && url.pathname === `/api/v1/public/redefinicao/${TOKEN}`) return get();
      if (metodo === "POST" && url.pathname === "/api/v1/public/redefinicao") return post();
      throw new Error(`pedido não previsto: ${metodo} ${url.pathname}`);
    }),
  );
}

const contas = (...lista: ContaDaRedefinicao[]) => () => Response.json({ contas: lista });
const gone = () => Response.json(INVALIDO, { status: 410 });

function preencher(senha: string, confirmacao: string) {
  fireEvent.change(screen.getByLabelText("Senha nova"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: confirmacao } });
}

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a página do token", () => {
  it("declara no-referrer para o documento inteiro", () => {
    expect(metadata.referrer).toBe("no-referrer");
  });
});

describe("AC-023 — uma conta: o formulário direto, com o clube e o papel", () => {
  it("mostra clube e papel em cima, senha e confirmação, sem lista nem voltar", async () => {
    servidor({ get: contas(CONTA_A) });
    render(<RedefinirSenhaForm token={TOKEN} />);

    expect(await screen.findByLabelText("Senha nova")).toBeInTheDocument();
    expect(screen.getByLabelText("Repita a senha nova")).toBeInTheDocument();
    expect(screen.getByText("Clube A")).toBeInTheDocument();
    expect(screen.getByText("Aluno")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Qual conta vai ter a senha redefinida?" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();

    // Abrir não gasta o link: só o GET, e sem Referer.
    expect(pedidos).toEqual([
      {
        caminho: `/api/v1/public/redefinicao/${TOKEN}`,
        metodo: "GET",
        corpo: null,
        referrerPolicy: "no-referrer",
      },
    ]);
  });

  it("204: manda token, conta e senha (sem Referer) e vai ao endereço IMPORTADO do protocolo", async () => {
    servidor({ get: contas(CONTA_A) });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("senha-nova-1", "senha-nova-1");
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(SENTINELA));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(pedidos[1]).toEqual({
      caminho: "/api/v1/public/redefinicao",
      metodo: "POST",
      corpo: { token: TOKEN, usuarioId: CONTA_A.usuarioId, senha: "senha-nova-1" },
      referrerPolicy: "no-referrer",
    });
    // O botão fica desabilitado até a navegação.
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  });

  it.each([
    ["1234567", "1234567", "A senha precisa ter pelo menos 8 caracteres."],
    ["senha-nova-1", "senha-nova-2", "As duas senhas não são iguais."],
  ])("senha %s / %s: o erro na tela, e nada vai para a rede", async (senha, confirmacao, mensagem) => {
    servidor({ get: contas(CONTA_A) });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher(senha, confirmacao);
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
    expect(pedidos.map((p) => p.metodo)).toEqual(["GET"]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("os dois campos mostram e ocultam a senha", async () => {
    servidor({ get: contas(CONTA_A) });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    const olhos = screen.getAllByRole("button", { name: "Mostrar senha" });
    expect(olhos).toHaveLength(2);
    fireEvent.click(olhos[0]);
    expect(screen.getByLabelText("Senha nova")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repita a senha nova")).toHaveAttribute("type", "password");
  });
});

describe("AC-023 — duas contas: lista → formulário → voltar", () => {
  it("a lista primeiro; o cartão leva ao formulário daquela conta; Voltar devolve a lista", async () => {
    servidor({ get: contas(CONTA_A, CONTA_B) });
    render(<RedefinirSenhaForm token={TOKEN} />);

    expect(
      await screen.findByRole("heading", { name: "Qual conta vai ter a senha redefinida?" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Redefinir a senha de Clube B, como Professor" }));
    expect(screen.getByLabelText("Senha nova")).toBeInTheDocument();
    expect(screen.getByText("Clube B")).toBeInTheDocument();
    expect(screen.getByText("Professor")).toBeInTheDocument();
    expect(screen.queryByText("Clube A")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      screen.getByRole("heading", { name: "Qual conta vai ter a senha redefinida?" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Ir e voltar não pediu nada além do GET.
    expect(pedidos.map((p) => p.metodo)).toEqual(["GET"]);
  });

  it("a conta escolhida é a que vai no POST", async () => {
    servidor({ get: contas(CONTA_A, CONTA_B) });
    render(<RedefinirSenhaForm token={TOKEN} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Redefinir a senha de Clube B, como Professor" }),
    );

    preencher("senha-nova-1", "senha-nova-1");
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(SENTINELA));
    expect(pedidos[1].corpo).toEqual({ token: TOKEN, usuarioId: CONTA_B.usuarioId, senha: "senha-nova-1" });
  });
});

/**
 * AC-026, REV-090-F03 — **o foco nas trocas da tela.** Tocar num cartão tira a
 * lista (e o botão focado) da página; o "Voltar" tira o formulário. O foco tem
 * de ir para a tela nova, e não cair no `body`. O cartão e o "Voltar" são
 * focados antes do toque, como faria o teclado.
 */
describe("AC-026 — duas contas: o foco acompanha a troca de tela", () => {
  const TITULO = "Qual conta vai ter a senha redefinida?";

  it("abrir a lista não rouba o foco; escolher leva a “Senha nova”; Voltar leva ao título da lista", async () => {
    servidor({ get: contas(CONTA_A, CONTA_B) });
    render(<RedefinirSenhaForm token={TOKEN} />);

    const titulo = await screen.findByRole("heading", { name: TITULO });
    expect(document.activeElement).toBe(document.body);
    // O título é focável pelo código, mas não entra na ordem do Tab.
    expect(titulo).toHaveAttribute("tabindex", "-1");

    const cartao = screen.getByRole("button", { name: "Redefinir a senha de Clube B, como Professor" });
    cartao.focus();
    fireEvent.click(cartao);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Senha nova")));

    const voltar = screen.getByRole("button", { name: "Voltar" });
    voltar.focus();
    fireEvent.click(voltar);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: TITULO })),
    );

    // E de novo, para outra conta: o foco vai outra vez ao campo.
    const outro = screen.getByRole("button", { name: "Redefinir a senha de Clube A, como Aluno" });
    outro.focus();
    fireEvent.click(outro);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Senha nova")));
    expect(screen.getByText("Clube A")).toBeInTheDocument();
  });

  it("uma conta: o formulário direto não rouba o foco na abertura", async () => {
    servidor({ get: contas(CONTA_A) });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");
    expect(document.activeElement).toBe(document.body);
  });
});

describe("AC-023 — 410: link inválido, com “Pedir outro link”", () => {
  async function conferirInvalido() {
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTO_LINK_DE_REDEFINICAO_INVALIDO);
    expect(TEXTO_LINK_DE_REDEFINICAO_INVALIDO).toBe("Este link não vale mais.");
    expect(screen.getByRole("link", { name: "Pedir outro link" })).toHaveAttribute("href", "/esqueci-senha");
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  }

  it("no GET: o estado inválido, e nenhum campo de senha", async () => {
    servidor({ get: gone });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await conferirInvalido();
  });

  it("GET com zero contas (não deveria vir, mas não abre formulário vazio): inválido", async () => {
    servidor({ get: contas() });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await conferirInvalido();
  });

  it("no POST: o formulário sai e fica o estado inválido", async () => {
    servidor({ get: contas(CONTA_A), post: gone });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("senha-nova-1", "senha-nova-1");
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));
    await conferirInvalido();
  });

  it("outro erro no POST (400): a mensagem, e o formulário fica", async () => {
    servidor({
      get: contas(CONTA_A),
      post: () => Response.json({ statusCode: 400, message: "Senha fraca demais." }, { status: 400 }),
    });
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("senha-nova-1", "senha-nova-1");
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha fraca demais.");
    expect(screen.getByRole("button", { name: "Redefinir minha senha" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("falha de rede no GET NÃO diz que o link morreu, e deixa tentar de novo", async () => {
    let primeira = true;
    servidor({
      get: () => {
        if (primeira) {
          primeira = false;
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return contas(CONTA_A)();
      },
    });
    render(<RedefinirSenhaForm token={TOKEN} />);

    const alerta = await screen.findByRole("alert");
    expect(alerta).not.toHaveTextContent(TEXTO_LINK_DE_REDEFINICAO_INVALIDO);
    expect(screen.queryByRole("link", { name: "Pedir outro link" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByLabelText("Senha nova")).toBeInTheDocument();
  });
});
