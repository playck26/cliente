import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisosDoClube } from "./avisos-do-clube";

/**
 * SPEC-062/D2a-1, D3, D6 — **o interruptor, e a promessa de que ele não mente.**
 *
 * O que estes testes protegem é uma coisa só, dita de várias formas: **o
 * interruptor nunca diz "ligado" sem o servidor ter confirmado de quem é a
 * assinatura.** Se ele mentir, a pessoa descobre pelo aviso que não chegou — e
 * aí já é tarde, porque ela parou de conferir o app achando que seria avisada.
 */

const reconciliar = vi.hoisted(() => vi.fn());
const criarPortaDoNavegador = vi.hoisted(() => vi.fn());
const pedirPermissao = vi.hoisted(() => vi.fn());
const suportaPush = vi.hoisted(() => vi.fn());
const avisarOutrasAbas = vi.hoisted(() => vi.fn());
const pedirAvisoDeTeste = vi.hoisted(() => vi.fn());
const ehIOS = vi.hoisted(() => vi.fn());
const estaInstalado = vi.hoisted(() => vi.fn());

vi.mock("@/lib/push-do-navegador", () => ({
  criarPortaDoNavegador,
  pedirPermissao,
  suportaPush,
  avisarOutrasAbas,
  MENSAGEM_DE_RECONCILIAR: "playck:reconciliar-push",
}));

vi.mock("@/lib/push-reconciliacao", async () => {
  const real = await vi.importActual<typeof import("@/lib/push-reconciliacao")>(
    "@/lib/push-reconciliacao",
  );
  // `reconciliar` é dublada; o resto é real — `precisaInstalarNoIPhone` e as
  // esperas são decisão, e dublá-las faria o teste provar o dublê.
  return { ...real, reconciliar };
});

vi.mock("@/lib/instalacao-pwa", () => ({ ehIOS, estaInstalado }));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, pedirAvisoDeTeste };
});

function porta(sobrepor: Record<string, unknown> = {}) {
  return {
    assinaturaAtual: vi.fn().mockResolvedValue(null),
    desinscrever: vi.fn().mockResolvedValue(true),
    assinar: vi.fn().mockResolvedValue({
      endpoint: "https://push.exemplo/1",
      p256dh: "p",
      auth: "a",
    }),
    registrar: vi.fn().mockResolvedValue(undefined),
    ...sobrepor,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  suportaPush.mockReturnValue(true);
  ehIOS.mockReturnValue(false);
  estaInstalado.mockReturnValue(false);
  criarPortaDoNavegador.mockImplementation(() => porta());
  reconciliar.mockResolvedValue({ estado: "desligado", motivo: "sem-assinatura" });
});

const interruptor = () => screen.getByRole("switch", { name: "Avisos do clube" });

describe("o interruptor reflete o que a reconciliação disse", () => {
  it("assinatura confirmada: ligado", async () => {
    reconciliar.mockResolvedValue({ estado: "ligado" });
    render(<AvisosDoClube />);

    await waitFor(() => expect(interruptor()).toHaveAttribute("aria-checked", "true"));
  });

  it("sem assinatura: desligado, e sem texto de erro", async () => {
    render(<AvisosDoClube />);

    await waitFor(() =>
      expect(interruptor()).toHaveAttribute("aria-checked", "false"),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reconciliação que falha NÃO liga o interruptor", async () => {
    // A regressão mais cara possível. Falhar é um estado, e não o estado
    // otimista: o interruptor fica desligado e a tela oferece tentar de novo.
    reconciliar.mockResolvedValue({ estado: "erro", motivo: "falhou" });
    render(<AvisosDoClube />);

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(interruptor()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("aparelho de outra conta: diz isso, e não some com a explicação", async () => {
    reconciliar.mockResolvedValue({
      estado: "erro",
      motivo: "aparelho-de-outra-conta",
    });
    render(<AvisosDoClube />);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /registrado em outra conta/i,
      ),
    );
  });

  it("enquanto verifica, o interruptor fica desabilitado", async () => {
    // Sem isto, um toque no meio da reconciliação dispararia um pedido de
    // permissão concorrente — e o resultado dependeria de qual terminasse
    // primeiro.
    let liberar!: (v: unknown) => void;
    reconciliar.mockReturnValue(new Promise((r) => (liberar = r)));
    render(<AvisosDoClube />);

    expect(interruptor()).toBeDisabled();
    liberar({ estado: "desligado" });
    await waitFor(() => expect(interruptor()).not.toBeDisabled());
  });
});

describe("AC-007 — a permissão só é pedida no gesto", () => {
  it("montar a tela NÃO chama requestPermission", async () => {
    // Navegador que pede na abertura leva "bloquear", e bloqueio não se desfaz
    // sem ir às configurações do sistema. É um caminho sem volta criado por um
    // pedido que a pessoa não esperava.
    render(<AvisosDoClube />);

    await waitFor(() => expect(reconciliar).toHaveBeenCalled());
    expect(pedirPermissao).not.toHaveBeenCalled();
  });

  it("tocar no interruptor pede permissão, assina e registra", async () => {
    pedirPermissao.mockResolvedValue("granted");
    const p = porta();
    criarPortaDoNavegador.mockImplementation(() => p);
    render(<AvisosDoClube />);
    await waitFor(() => expect(interruptor()).not.toBeDisabled());

    fireEvent.click(interruptor());

    await waitFor(() => expect(interruptor()).toHaveAttribute("aria-checked", "true"));
    expect(pedirPermissao).toHaveBeenCalledTimes(1);
    expect(p.assinar).toHaveBeenCalledTimes(1);
    expect(p.registrar).toHaveBeenCalledTimes(1);
    // D2a-1 — as outras abas precisam saber: a assinatura é uma por service
    // worker, e o que uma aba faz vale para todas.
    expect(avisarOutrasAbas).toHaveBeenCalled();
  });

  it("permissão negada: continua desligado e explica o caminho de volta", async () => {
    pedirPermissao.mockResolvedValue("denied");
    render(<AvisosDoClube />);
    await waitFor(() => expect(interruptor()).not.toBeDisabled());

    fireEvent.click(interruptor());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/configurações do navegador/i),
    );
    expect(interruptor()).toHaveAttribute("aria-checked", "false");
  });

  it("assinar que falha não deixa o interruptor ligado", async () => {
    pedirPermissao.mockResolvedValue("granted");
    criarPortaDoNavegador.mockImplementation(() =>
      porta({ assinar: vi.fn().mockRejectedValue(new Error("sem rede")) }),
    );
    render(<AvisosDoClube />);
    await waitFor(() => expect(interruptor()).not.toBeDisabled());

    fireEvent.click(interruptor());

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(interruptor()).toHaveAttribute("aria-checked", "false");
  });
});

describe("desligar", () => {
  it("desinscreve e avisa as outras abas", async () => {
    reconciliar.mockResolvedValue({ estado: "ligado" });
    const p = porta();
    criarPortaDoNavegador.mockImplementation(() => p);
    render(<AvisosDoClube />);
    await waitFor(() => expect(interruptor()).toHaveAttribute("aria-checked", "true"));

    fireEvent.click(interruptor());

    await waitFor(() =>
      expect(interruptor()).toHaveAttribute("aria-checked", "false"),
    );
    expect(p.desinscrever).toHaveBeenCalledTimes(1);
    expect(avisarOutrasAbas).toHaveBeenCalled();
  });
});

describe("D6 — o aviso de teste", () => {
  it("só aparece quando está ligado", async () => {
    render(<AvisosDoClube />);
    await waitFor(() => expect(interruptor()).not.toBeDisabled());
    expect(
      screen.queryByRole("button", { name: /aviso de teste/i }),
    ).not.toBeInTheDocument();
  });

  it("pede o teste e confirma na tela", async () => {
    reconciliar.mockResolvedValue({ estado: "ligado" });
    pedirAvisoDeTeste.mockResolvedValue(undefined);
    render(<AvisosDoClube />);
    const botao = await screen.findByRole("button", { name: /aviso de teste/i });

    fireEvent.click(botao);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Deve chegar/i),
    );
  });

  it.each([
    ["TESTE_JA_ENFILEIRADO", /já há um aviso de teste a caminho/i],
    ["TESTE_ACIMA_DO_TETO", /três testes na última hora/i],
  ])("traduz %s pelo CÓDIGO, não pela mensagem", async (code, esperado) => {
    // O código é o contrato; a mensagem é texto para humano e muda numa
    // revisão de copy. Decidir pela mensagem levaria a regra junto.
    const { ApiError } = await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
    reconciliar.mockResolvedValue({ estado: "ligado" });
    pedirAvisoDeTeste.mockRejectedValue(new ApiError(409, "qualquer coisa", code));
    render(<AvisosDoClube />);
    const botao = await screen.findByRole("button", { name: /aviso de teste/i });

    fireEvent.click(botao);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(esperado));
  });
});

describe("LIM-062c — o iPhone fora do app instalado", () => {
  it("explica em vez de mostrar interruptor que nunca liga", async () => {
    ehIOS.mockReturnValue(true);
    estaInstalado.mockReturnValue(false);
    suportaPush.mockReturnValue(false);

    render(<AvisosDoClube />);

    expect(screen.getByText(/Adicionar à Tela de Início/i)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("iPhone JÁ instalado mostra o interruptor normal", async () => {
    ehIOS.mockReturnValue(true);
    estaInstalado.mockReturnValue(true);
    suportaPush.mockReturnValue(true);

    render(<AvisosDoClube />);

    await waitFor(() => expect(interruptor()).toBeInTheDocument());
  });
});
