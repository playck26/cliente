import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EsqueciSenhaPage from "@/app/esqueci-senha/page";
import {
  EsqueciSenhaForm,
  TEXTO_DE_MUITAS_TENTATIVAS,
  TEXTO_DO_PEDIDO_ENVIADO,
} from "./esqueci-senha-form";

/**
 * SPEC-090 (AC-023, D1, D9) — **a página de pedir o link.**
 *
 * O servidor de mentira registra cada pedido. O que se prova: o `202` mostra a
 * MESMA frase para qualquer e-mail (o servidor não diz se há conta, e a tela
 * não inventa diferença); o `429` mostra o texto fixo da I9 e deixa o
 * formulário; e "Voltar ao login" existe nos dois estados.
 */

type Pedido = { caminho: string; metodo: string; corpo: unknown };
let pedidos: Pedido[] = [];

function servidor(resposta: () => Response | Promise<Response>) {
  pedidos = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(entrada));
      pedidos.push({
        caminho: url.pathname,
        metodo: (init?.method ?? "GET").toUpperCase(),
        corpo: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return resposta();
    }),
  );
}

const ACEITO = () => new Response(null, { status: 202 });

afterEach(() => {
  vi.unstubAllGlobals();
});

function pedir(email: string) {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
}

describe("AC-023 — /esqueci-senha: a mesma frase para qualquer e-mail", () => {
  it("a frase é a da D9", () => {
    expect(TEXTO_DO_PEDIDO_ENVIADO).toBe(
      "Se houver conta com este e-mail, enviamos um link para redefinir a senha. Ele vale por 1 hora. Confira também o spam.",
    );
  });

  it.each(["aluno@clube.com", "ninguem@lugar-nenhum.com", "gestor@clube.com"])(
    "202 para %s: um POST com o e-mail, e a frase de sempre",
    async (email) => {
      servidor(ACEITO);
      const { container } = render(<EsqueciSenhaForm />);
      pedir(email);

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO));
      expect(pedidos).toEqual([
        { caminho: "/api/v1/auth/esqueci-senha", metodo: "POST", corpo: { email } },
      ]);
      // O formulário sai; o texto da tela é a frase e o link de volta, e só.
      expect(screen.queryByLabelText("E-mail")).toBeNull();
      expect(container.textContent).toBe(`${TEXTO_DO_PEDIDO_ENVIADO}Voltar ao login`);
      expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login");
    },
  );

  it("SPEC-090/I9: o texto fixo do 429 é o que o Israel decidiu", () => {
    expect(TEXTO_DE_MUITAS_TENTATIVAS).toBe("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
  });

  it("SPEC-090/I9 — 429: o texto fixo, e NÃO a mensagem do servidor; o formulário fica", async () => {
    // A mensagem que o `@nestjs/throttler` manda de verdade, em inglês.
    const DO_SERVIDOR = "ThrottlerException: Too Many Requests";
    servidor(() => Response.json({ statusCode: 429, message: DO_SERVIDOR }, { status: 429 }));
    render(<EsqueciSenhaForm />);
    pedir("aluno@clube.com");

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe(TEXTO_DE_MUITAS_TENTATIVAS);
    expect(screen.queryByText(DO_SERVIDOR)).toBeNull();
    // A região existe desde a montagem (REV-090-F03), e continua vazia.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByLabelText("E-mail")).toHaveValue("aluno@clube.com");
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });

  it("400 (e-mail malformado): pede para conferir, sem dizer que enviou", async () => {
    servidor(() => Response.json({ statusCode: 400, message: ["email must be an email"] }, { status: 400 }));
    render(<EsqueciSenhaForm />);
    pedir("nao-e-email");

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o e-mail digitado.");
    expect(screen.queryByText(TEXTO_DO_PEDIDO_ENVIADO)).toBeNull();
  });

  it("falha de rede: não diz que enviou, e deixa tentar de novo", async () => {
    servidor(() => Promise.reject(new TypeError("Failed to fetch")));
    render(<EsqueciSenhaForm />);
    pedir("aluno@clube.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível pedir o link agora. Tente de novo.",
    );
    expect(screen.queryByText(TEXTO_DO_PEDIDO_ENVIADO)).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });

  it("campo vazio: nada vai para a rede", async () => {
    servidor(ACEITO);
    render(<EsqueciSenhaForm />);
    pedir("   ");

    expect(await screen.findByRole("alert")).toHaveTextContent("Digite o e-mail da sua conta.");
    expect(pedidos).toEqual([]);
  });

  it("enquanto envia: botão desabilitado e um segundo toque não pede de novo", async () => {
    let responder: (r: Response) => void = () => {};
    servidor(() => new Promise<Response>((r) => (responder = r)));
    render(<EsqueciSenhaForm />);
    pedir("aluno@clube.com");

    const botao = await screen.findByRole("button", { name: "Enviando..." });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(pedidos).toHaveLength(1);

    responder(new Response(null, { status: 202 }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO));
  });

  it("“Voltar ao login” também antes de enviar", () => {
    servidor(ACEITO);
    render(<EsqueciSenhaForm />);
    expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login");
  });
});

/**
 * REV-090-F03 — a região viva existe **vazia** antes do pedido (a que nasce
 * com o texto costuma não ser anunciada) e é o mesmo nó que recebe a frase; e
 * o foco não cai no `body` quando o formulário sai.
 */
describe("AC-026 — /esqueci-senha: o anúncio e o foco", () => {
  it("a região de status existe vazia desde a montagem e é a mesma que recebe a frase", async () => {
    servidor(ACEITO);
    render(<EsqueciSenhaForm />);

    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    pedir("aluno@clube.com");
    await waitFor(() => expect(regiao).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(regiao);
  });

  it("depois do 202, o foco vai para “Voltar ao login”, e não para o body", async () => {
    servidor(ACEITO);
    render(<EsqueciSenhaForm />);
    pedir("aluno@clube.com");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Voltar ao login" })),
    );
  });
});

describe("a página /esqueci-senha", () => {
  it("compõe a moldura das telas de conta com o formulário", () => {
    servidor(ACEITO);
    render(<EsqueciSenhaPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Esqueceu a senha?" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });
});
