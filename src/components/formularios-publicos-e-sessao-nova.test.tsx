import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aceitarConvite,
  ativarConta,
  getAtivacao,
  getConvite,
  getRedefinicao,
  redefinirSenha,
} from "@/lib/api-client";
import { abrirEpoca } from "@/lib/sessao-da-aba";
import { AceitarConviteForm } from "./aceitar-convite-form";
import { AtivarContaForm } from "./ativar-conta-form";
import { RedefinirSenhaForm } from "./redefinir-senha-form";

/**
 * Os três formulários de link (ativar conta, redefinir senha, aceitar convite)
 * mandam para o login quando o servidor responde. Se nesse meio-tempo outra
 * sessão começou nesta aba — um login em outra rota —, mandá-la para o login
 * seria sair por ela: o mesmo formato do "Sair" antigo (PRD-090-R5-01).
 *
 * O login do meio é o `abrirEpoca()`, que é o que `iniciarSessaoNestaAba` faz;
 * a sequência com o formulário de login de verdade está em
 * `sessao-com-resposta-atrasada.test.tsx`.
 */

const replace = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  getAtivacao: vi.fn(),
  ativarConta: vi.fn(),
  getRedefinicao: vi.fn(),
  redefinirSenha: vi.fn(),
  getConvite: vi.fn(),
  aceitarConvite: vi.fn(),
}));

const TOKEN = ["AbCdEfGhIjKlMnOpQrStUvWxYz", "0123456789", "-_AbCdE"].join("");

/** A resposta do servidor só chega quando o teste mandar. */
function respostaEmEspera() {
  let responder!: () => void;
  let pedida!: () => void;
  const foiPedida = new Promise<void>((r) => (pedida = r));
  const chegou = new Promise<void>((r) => (responder = r));
  return { responder, foiPedida, chamada: () => (pedida(), chegou.then(() => undefined)) };
}

const navegou = () => replace.mock.calls.length + push.mock.calls.length;
const umaVolta = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

type Caso = {
  nome: string;
  abrir: () => Promise<void>;
  enviar: (espera: ReturnType<typeof respostaEmEspera>) => Promise<void>;
};

const casos: Caso[] = [
  {
    nome: "ativar conta",
    abrir: async () => {
      vi.mocked(getAtivacao).mockResolvedValue({
        primeiroNome: "Maria",
        empresa: { nome: "Clube A" },
      } as never);
      render(<AtivarContaForm token={TOKEN} />);
      await screen.findByLabelText("Crie uma senha");
    },
    enviar: async (espera) => {
      vi.mocked(ativarConta).mockImplementation(espera.chamada as never);
      fireEvent.change(screen.getByLabelText("Crie uma senha"), { target: { value: "senha-nova-1" } });
      fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: "senha-nova-1" } });
      fireEvent.submit(screen.getByRole("button", { name: "Criar minha senha" }).closest("form")!);
    },
  },
  {
    nome: "redefinir senha",
    abrir: async () => {
      vi.mocked(getRedefinicao).mockResolvedValue({
        contas: [
          {
            usuarioId: "11111111-1111-4111-8111-111111111111",
            papel: "aluno",
            empresa: { nome: "Clube A", logoUrl: null },
          },
        ],
      } as never);
      render(<RedefinirSenhaForm token={TOKEN} />);
      await screen.findByLabelText("Senha nova");
    },
    enviar: async (espera) => {
      vi.mocked(redefinirSenha).mockImplementation(espera.chamada as never);
      fireEvent.change(screen.getByLabelText("Senha nova"), { target: { value: "senha-nova-1" } });
      fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: "senha-nova-1" } });
      fireEvent.submit(screen.getByRole("button", { name: "Redefinir minha senha" }).closest("form")!);
    },
  },
  {
    nome: "aceitar convite",
    abrir: async () => {
      vi.mocked(getConvite).mockResolvedValue({ nome: "Maria", empresa: { nome: "Clube A" }, contrato: null } as never);
      render(<AceitarConviteForm token={TOKEN} />);
      await screen.findByLabelText("Crie uma senha");
    },
    enviar: async (espera) => {
      vi.mocked(aceitarConvite).mockImplementation(espera.chamada as never);
      fireEvent.change(screen.getByLabelText("Crie uma senha"), { target: { value: "senha-nova-1" } });
      fireEvent.submit(screen.getByRole("button", { name: "Aceitar convite" }).closest("form")!);
    },
  },
];

describe.each(casos)("$nome", ({ abrir, enviar }) => {
  it("outra sessão começou enquanto o servidor respondia: não vai para o login", async () => {
    await abrir();
    const espera = respostaEmEspera();
    await enviar(espera);
    await espera.foiPedida;

    abrirEpoca();
    espera.responder();
    await umaVolta();
    await umaVolta();

    expect(navegou()).toBe(0);
  });

  it("sem sessão nova no meio: vai para o login", async () => {
    await abrir();
    const espera = respostaEmEspera();
    await enviar(espera);
    await espera.foiPedida;

    espera.responder();
    await umaVolta();
    await umaVolta();

    expect(navegou()).toBe(1);
  });
});
