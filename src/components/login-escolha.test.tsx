import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

/**
 * SPEC-086/AC-014 e AC-015 — **o login quando a senha abre mais de uma
 * conta**, pelo `LoginForm` inteiro e um servidor de mentira que registra
 * cada pedido (o molde de `login-form.caracterizacao.test.tsx`, que não muda).
 *
 * O `409 ESCOLHA_DE_EMPRESA` troca o formulário pela escolha; tocar num clube
 * chama `POST /auth/login/escolher` e segue o MESMO pós-login de hoje: token
 * e papel guardados, nomes de tipo aquecidos, destino por papel — para aluno
 * E para professor. Um erro na escolha volta ao formulário com a mensagem do
 * servidor e o e-mail preenchido.
 */

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

type Chamada = { caminho: string; metodo: string; corpo: unknown; credenciais?: RequestCredentials };
let chamadas: Chamada[] = [];

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ESCOLHA = {
  token: "token-de-escolha",
  empresas: [
    {
      usuarioId: "u-a",
      empresaNome: "Smart Tennis",
      logoUrl: "https://cdn.exemplo/logo-a.webp",
      papel: "aluno",
      situacao: "disponivel",
    },
    {
      usuarioId: "u-b",
      empresaNome: "Arena Beach",
      logoUrl: null,
      papel: "professor",
      situacao: "disponivel",
    },
    {
      usuarioId: "u-c",
      empresaNome: "Clube Antigo",
      logoUrl: null,
      papel: "aluno",
      situacao: "senha_expirada",
    },
  ],
};

const CONFLITO = json(409, {
  statusCode: 409,
  code: "ESCOLHA_DE_EMPRESA",
  message: "Este e-mail tem acesso a mais de uma empresa. Entre pelo app do aluno para escolher.",
  escolha: ESCOLHA,
});

function sessao(role: string, senhaTemporaria = false): Response {
  return json(200, {
    accessToken: `token-${role}`,
    refreshToken: "refresh",
    usuario: { id: "u", nome: "N", email: "x@x.com", role, companyId: "c", senhaTemporaria },
  });
}

function servidor(escolher: () => Response) {
  chamadas = [];
  const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada.toString());
    chamadas.push({
      caminho: url.pathname,
      metodo: (init?.method ?? "GET").toUpperCase(),
      corpo: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      credenciais: init?.credentials,
    });
    if (url.pathname === "/api/v1/auth/login") return CONFLITO.clone();
    if (url.pathname === "/api/v1/auth/login/escolher") return escolher();
    if (url.pathname === "/api/v1/me/company/operacao") {
      return json(200, { nomeTipoQuadra: "Espaço", nomeTipoAula: "Treino" });
    }
    throw new Error(`pedido nao previsto: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

/**
 * IMP-086-R1-03 — **o aquecimento dos nomes de tipo, provado pelo pedido E
 * pelo efeito, em cada variante do pós-login.** Conferir só o redirect deixava
 * passar `if (role !== "professor") void lerNomesDeTipo()`. `nomes-de-tipo.ts`
 * não tem cache em memória — a única memória é a chave do `localStorage`, que
 * o `beforeEach` zera; por isso o `null` antes do toque é conferido aqui, para
 * que um valor herdado de outro teste nunca faça a asserção passar sozinha.
 */
async function tocarEConferirAquecimento(botao: string) {
  expect(window.localStorage.getItem("playck_cliente_nomes_de_tipo")).toBeNull();
  expect(chamadas.some((c) => c.caminho === "/api/v1/me/company/operacao")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: botao }));
  await waitFor(() =>
    expect(chamadas.filter((c) => c.caminho === "/api/v1/me/company/operacao")).toHaveLength(1),
  );
  await waitFor(() =>
    expect(JSON.parse(window.localStorage.getItem("playck_cliente_nomes_de_tipo") ?? "null")).toEqual({
      quadra: "Espaço",
      aula: "Treino",
    }),
  );
}

async function chegarNaEscolha() {
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "mesmo@x.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("heading", { name: "Em qual clube você quer entrar?" });
}

beforeEach(() => {
  pushMock.mockClear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SPEC-086/AC-014 — a escolha do clube", () => {
  it("o 409 troca o formulário pela escolha: um cartão por clube, com nome e papel", async () => {
    servidor(() => sessao("aluno"));
    await chegarNaEscolha();

    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Entrar em Arena Beach, como Professor" })).toBeEnabled();
    // A vencida aparece, mas NÃO é botão, e diz o que fazer (I6).
    expect(screen.getByText("Clube Antigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clube Antigo/ })).toBeNull();
    expect(screen.getByText("Senha expirada — peça uma nova ao gestor.")).toBeInTheDocument();
    // Nada foi guardado e ninguém foi levado a lugar nenhum ainda.
    expect(window.localStorage.getItem("playck_cliente_access_token")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("aluno: tocar no clube chama /auth/login/escolher e segue o pós-login de hoje", async () => {
    servidor(() => sessao("aluno"));
    await chegarNaEscolha();

    await tocarEConferirAquecimento("Entrar em Smart Tennis, como Aluno");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    const escolha = chamadas.find((c) => c.caminho === "/api/v1/auth/login/escolher");
    expect(escolha).toMatchObject({
      metodo: "POST",
      corpo: { token: "token-de-escolha", usuarioId: "u-a" },
      credenciais: "include",
    });
    expect(Object.values(armazenamento())).toContain("token-aluno");
    expect(Object.values(armazenamento())).toContain("aluno");
  });

  it("professor: aquece os nomes de tipo e o destino é o do papel (as turmas dele)", async () => {
    servidor(() => sessao("professor"));
    await chegarNaEscolha();

    await tocarEConferirAquecimento("Entrar em Arena Beach, como Professor");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/minhas-turmas"));
    expect(Object.values(armazenamento())).toContain("professor");
  });

  it("senha temporária na conta escolhida: aquece os nomes de tipo e vai para o primeiro acesso", async () => {
    servidor(() => sessao("aluno", true));
    await chegarNaEscolha();

    await tocarEConferirAquecimento("Entrar em Smart Tennis, como Aluno");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/primeiro-acesso"));
  });

  it("'Usar outro e-mail' volta ao formulário, com o e-mail preenchido", async () => {
    servidor(() => sessao("aluno"));
    await chegarNaEscolha();

    fireEvent.click(screen.getByRole("button", { name: "Usar outro e-mail" }));

    expect(screen.getByLabelText("E-mail")).toHaveValue("mesmo@x.com");
  });
});

describe("SPEC-086/AC-015 — erro e espera na escolha", () => {
  it("erro (escolha expirada) volta ao formulário com a mensagem do servidor e o e-mail", async () => {
    servidor(() =>
      json(401, {
        statusCode: 401,
        code: "ESCOLHA_EXPIRADA",
        message: "A escolha de empresa expirou. Entre de novo.",
      }),
    );
    await chegarNaEscolha();

    fireEvent.click(screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A escolha de empresa expirou. Entre de novo.",
    );
    expect(screen.getByLabelText("E-mail")).toHaveValue("mesmo@x.com");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("enquanto a escolha está no ar, os cartões ficam desabilitados e o escolhido diz 'Entrando...'", async () => {
    let responder!: (r: Response) => void;
    servidor(() => undefined as unknown as Response);
    const fetchOriginal = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof entrada === "string" ? entrada : entrada.toString());
        if (url.pathname === "/api/v1/auth/login/escolher") {
          return new Promise<Response>((r) => (responder = r));
        }
        return fetchOriginal(entrada, init);
      }),
    );
    await chegarNaEscolha();

    fireEvent.click(screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Entrar em Smart Tennis, como Aluno" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Entrar em Arena Beach, como Professor" })).toBeDisabled();
    expect(screen.getByText("Entrando...")).toBeInTheDocument();

    responder(sessao("aluno"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });
});

function armazenamento(): Record<string, string> {
  const tudo: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const chave = window.localStorage.key(i)!;
    tudo[chave] = window.localStorage.getItem(chave)!;
  }
  return tudo;
}
