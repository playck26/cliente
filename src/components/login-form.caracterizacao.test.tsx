import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

/**
 * SPEC-084/TASK-004 — **caracterização do login, escrita ANTES do redesenho.**
 *
 * Este arquivo foi escrito contra o `login-form.tsx` do `main` `d61d55f`
 * (SHA-256 `2636200b…d026`) e é **congelado**: o SHA-256 dele está no
 * EVD-084-003, e o redesenho da SPEC-084 tem de passar por este mesmo arquivo,
 * byte a byte. Se um caso daqui ficar vermelho depois da reescrita, a regressão
 * é da reescrita. Ajustar este arquivo para acompanhá-la reabre a revisão
 * (DOR-084-R1-02).
 *
 * Ele observa COMPORTAMENTO, não aparência: o que vai para a rede, o que fica
 * guardado, para onde a pessoa vai, o que é anunciado e os atributos que o
 * navegador e o gerenciador de senhas usam. Texto de tela e layout ficam no
 * `login-form.test.tsx`, que pode mudar.
 *
 * **Única mudança depois de congelado (I5, 2026-10-02):** saiu a asserção do
 * link "Cadastre-se" → `/cadastro`. Não foi para acompanhar regressão: o
 * Israel decidiu tirar o cadastro do login, porque o aluno não se cadastra
 * sozinho. Hash do conteúdo em LF: `363bdb58…0590` (a234c3b) → o deste
 * arquivo, registrado no EVD-084-003. Todo o resto ficou igual.
 *
 * Os mocks são os mesmos da base: `next/navigation` só com `useRouter`. Um
 * hook novo dessa biblioteca dentro do `LoginForm` derruba este arquivo — e
 * isso é deliberado: o aviso pós-ativação mora FORA do formulário (D7).
 */

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

type Chamada = {
  caminho: string;
  metodo: string;
  corpo: unknown;
  credenciais: RequestCredentials | undefined;
  contentType: string | null;
};

type Resposta = Response | Promise<Response> | (() => Promise<Response>);

let chamadas: Chamada[] = [];

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USUARIO = {
  id: "u1",
  nome: "Aluno",
  email: "aluno@x.com",
  role: "aluno",
  companyId: "c1",
  senhaTemporaria: false,
};

function sucesso(usuario: Record<string, unknown> = {}): Response {
  return json(200, {
    accessToken: "token-123",
    refreshToken: "refresh-123",
    usuario: { ...USUARIO, ...usuario },
  });
}

/**
 * Um servidor de mentira que **registra** cada pedido. O login responde o que
 * o caso mandar; o aquecimento dos nomes responde nomes de clube.
 */
function servidor(login: Resposta) {
  chamadas = [];
  const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada.toString());
    const cabecalhos = new Headers(init?.headers);
    chamadas.push({
      caminho: url.pathname,
      metodo: (init?.method ?? "GET").toUpperCase(),
      corpo: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ?? null,
      credenciais: init?.credentials,
      contentType: cabecalhos.get("Content-Type"),
    });
    if (url.pathname === "/api/v1/auth/login") {
      return typeof login === "function" ? login() : login;
    }
    if (url.pathname === "/api/v1/me/company/operacao") {
      return json(200, { nomeTipoQuadra: "Espaço", nomeTipoAula: "Treino" });
    }
    throw new Error(`pedido nao previsto pela caracterizacao: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function preencherEEnviar(email = "aluno@x.com", senha = "senha-valida") {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

function armazenamento(): Record<string, string> {
  const tudo: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const chave = window.localStorage.key(i)!;
    tudo[chave] = window.localStorage.getItem(chave)!;
  }
  return tudo;
}

beforeEach(() => {
  pushMock.mockClear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("caracterização — atributos que o navegador e o gerenciador de senhas usam", () => {
  it("formulário sem validação nativa, campos com tipo, autocomplete e obrigatoriedade", () => {
    servidor(sucesso());
    const { container } = render(<LoginForm />);

    const formulario = container.querySelector("form");
    expect(formulario).not.toBeNull();
    expect(formulario!.noValidate).toBe(true);

    const email = screen.getByLabelText("E-mail") as HTMLInputElement;
    expect(email.type).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(email.required).toBe(true);

    const senha = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(senha.type).toBe("password");
    expect(senha.getAttribute("autocomplete")).toBe("current-password");
    expect(senha.required).toBe(true);
    expect(senha.minLength).toBe(8);
  });

  it("botões com tipo e nome acessível, ajuda fechada", () => {
    servidor(sucesso());
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: "Entrar" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute("type", "button");

    const ajuda = screen.getByRole("button", { name: "Esqueceu a senha?" });
    expect(ajuda).toHaveAttribute("type", "button");
    expect(ajuda).toHaveAttribute("aria-expanded", "false");

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("caracterização — o que vai para a rede e o que fica guardado", () => {
  it("aluno: um POST de login com e-mail e senha, depois um GET de aquecimento, e nada mais", async () => {
    servidor(sucesso());
    render(<LoginForm />);
    preencherEEnviar("aluno@x.com", "senha-valida");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    await waitFor(() =>
      expect(window.localStorage.getItem("playck_cliente_nomes_de_tipo")).not.toBeNull(),
    );

    expect(chamadas.map((c) => `${c.metodo} ${c.caminho}`)).toEqual([
      "POST /api/v1/auth/login",
      "GET /api/v1/me/company/operacao",
    ]);
    expect(chamadas[0].corpo).toEqual({ email: "aluno@x.com", senha: "senha-valida" });
    expect(chamadas[0].credenciais).toBe("include");
    expect(chamadas[0].contentType).toBe("application/json");
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("aluno: guarda exatamente o token, o papel e os nomes do clube", async () => {
    servidor(sucesso());
    render(<LoginForm />);
    preencherEEnviar();

    await waitFor(() =>
      expect(window.localStorage.getItem("playck_cliente_nomes_de_tipo")).not.toBeNull(),
    );

    expect(armazenamento()).toEqual({
      playck_cliente_access_token: "token-123",
      playck_cliente_papel: "aluno",
      playck_cliente_nomes_de_tipo: JSON.stringify({ quadra: "Espaço", aula: "Treino" }),
    });
  });

  it("Enter no formulário envia o mesmo pedido", async () => {
    servidor(sucesso());
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "aluno@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    expect(chamadas[0]).toMatchObject({
      caminho: "/api/v1/auth/login",
      metodo: "POST",
      corpo: { email: "aluno@x.com", senha: "senha-valida" },
    });
  });
});

describe("caracterização — para onde a pessoa vai", () => {
  it.each([
    ["aluno", false, "/home"],
    ["professor", false, "/minhas-turmas"],
    ["aluno", true, "/primeiro-acesso"],
    ["professor", true, "/primeiro-acesso"],
  ])("%s com senha temporária=%s vai para %s, com o papel guardado", async (role, temporaria, destino) => {
    servidor(sucesso({ role, senhaTemporaria: temporaria }));
    render(<LoginForm />);
    preencherEEnviar();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(destino));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("playck_cliente_papel")).toBe(role);
    expect(window.localStorage.getItem("playck_cliente_access_token")).toBe("token-123");
  });
});

describe("caracterização — erros", () => {
  it("erro da API: a mensagem do servidor é anunciada, nada é guardado, ninguém sai da tela", async () => {
    const mensagem =
      "Sua senha temporária venceu. Peça ao seu clube para gerar uma nova senha; ela chega por WhatsApp.";
    servidor(json(401, { message: mensagem, code: "SENHA_TEMPORARIA_EXPIRADA" }));
    render(<LoginForm />);
    preencherEEnviar();

    expect((await screen.findByRole("alert")).textContent?.trim()).toBe(mensagem);
    expect(pushMock).not.toHaveBeenCalled();
    expect(armazenamento()).toEqual({});
    expect(chamadas.map((c) => c.caminho)).toEqual(["/api/v1/auth/login"]);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("erro da API sem mensagem: o texto padrão do login", async () => {
    servidor(new Response("<html>erro</html>", { status: 500 }));
    render(<LoginForm />);
    preencherEEnviar();

    expect((await screen.findByRole("alert")).textContent?.trim()).toBe("Não foi possível entrar");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("erro de rede: mensagem fixa, e o formulário volta a aceitar envio", async () => {
    servidor(() => Promise.reject(new TypeError("Failed to fetch")));
    render(<LoginForm />);
    preencherEEnviar();

    expect((await screen.findByRole("alert")).textContent?.trim()).toBe(
      "Não foi possível entrar. Tente de novo.",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(armazenamento()).toEqual({});
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.getByLabelText("E-mail")).toBeEnabled();
  });
});

describe("caracterização — carregando", () => {
  it("durante o envio: botão e campos desabilitados, 'Entrando...', e um segundo clique não envia de novo", async () => {
    let liberar!: (r: Response) => void;
    const pendente = new Promise<Response>((r) => {
      liberar = r;
    });
    servidor(() => pendente);
    render(<LoginForm />);
    preencherEEnviar();

    const botao = await screen.findByRole("button", { name: "Entrando..." });
    expect(botao).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("Senha")).toBeDisabled();

    fireEvent.click(botao);
    expect(chamadas.filter((c) => c.caminho === "/api/v1/auth/login")).toHaveLength(1);

    liberar(sucesso());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    expect(chamadas.filter((c) => c.caminho === "/api/v1/auth/login")).toHaveLength(1);
  });

  it("um envio novo apaga o erro anterior enquanto carrega", async () => {
    let tentativa = 0;
    let liberar!: (r: Response) => void;
    servidor(() => {
      tentativa += 1;
      if (tentativa === 1) return Promise.resolve(json(401, { message: "E-mail ou senha incorretos" }));
      return new Promise<Response>((r) => {
        liberar = r;
      });
    });
    render(<LoginForm />);
    preencherEEnviar();
    expect((await screen.findByRole("alert")).textContent?.trim()).toBe("E-mail ou senha incorretos");

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("button", { name: "Entrando..." });
    expect(screen.queryByRole("alert")).toBeNull();

    liberar(sucesso());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });
});

describe("caracterização — senha visível e ajuda, sem sair do formulário", () => {
  it("o olho alterna o tipo do campo e o próprio nome, sem enviar nada", () => {
    const fetchMock = servidor(sucesso());
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo-123" } });

    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("segredo-123");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("“Esqueceu a senha?” abre e fecha a explicação atual, sem enviar nada", () => {
    const fetchMock = servidor(sucesso());
    render(<LoginForm />);
    const ajuda = screen.getByRole("button", { name: "Esqueceu a senha?" });
    const texto =
      "Ainda não enviamos e-mail de recuperação. Peça ao seu clube para gerar uma senha nova; ela chega por WhatsApp e você troca no primeiro acesso.";

    expect(screen.queryByText(texto)).toBeNull();
    fireEvent.click(ajuda);
    expect(ajuda).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(texto)).toBeInTheDocument();

    fireEvent.click(ajuda);
    expect(ajuda).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(texto)).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
