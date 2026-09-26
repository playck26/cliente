import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api-client";
import { isoDeOffsetNoClube } from "@/lib/fuso";
import { ChamadaView } from "./chamada-view";

/**
 * SPEC-076/AC-017 — **a classe, não os rótulos.**
 *
 * Os testes antigos deste arquivo provavam o "Salvar chamada" (completude,
 * "Todos vieram"). A rota saiu do servidor (D1) e o botão saiu da tela; o que
 * se prova agora é que NENHUM caminho da tela manda presença:
 *
 * - (i) o `api-client` não tem função que escreva em
 *   `/me/teacher/attendance/` fora de `…/nao-houve`;
 * - (ii) a tela montada nos seis estados, com o `fetch` espionado de verdade
 *   (sem dublar o `api-client`), e TODO botão visível clicado com as
 *   confirmações aceitas: nenhum pedido mutador sai para fora de `/nao-houve`;
 * - (iii) o status gravado aparece em texto, e o selo de falta avisada também.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/top-app-bar", () => ({ TopAppBar: () => null }));

const ontem = () => isoDeOffsetNoClube(-1);
const emHoras = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const aluno = (
  alunoId: string,
  nome: string,
  status: string | null,
  extra: Record<string, unknown> = {},
) => ({
  alunoId,
  nome,
  status,
  naTurmaHoje: true,
  reposicao: false,
  faltaAvisada: false,
  ...extra,
});

function chamada(extra: Record<string, unknown>) {
  return {
    ocupacaoId: "oc1",
    turmaId: "t1",
    data: ontem(),
    horaInicio: "09:00",
    horaFim: "10:00",
    cancelada: false,
    completude: null,
    origem: null,
    origemInicial: null,
    corrigivelAte: null,
    desfazerNaoHouveAte: null,
    estado: "pendente",
    versao: "0",
    alunos: [aluno("a1", "Ana", null)],
    ...extra,
  };
}

/** Os seis estados da AC-017 (ii). */
const ESTADOS: Record<string, ReturnType<typeof chamada>> = {
  automatica: chamada({
    completude: "completa",
    origem: "automatica",
    origemInicial: "automatica",
    corrigivelAte: emHoras(48),
    estado: "feita",
    alunos: [
      aluno("a1", "Ana", "presente"),
      aluno("a2", "Bruno", "ausente", { faltaAvisada: true }),
    ],
  }),
  legada: chamada({
    completude: "desconhecida",
    origem: "legada_humana",
    origemInicial: "legada_humana",
    estado: "legada",
    alunos: [
      aluno("a1", "Ana", "presente"),
      aluno("a3", "Caio", "justificado"),
    ],
  }),
  nao_houve: chamada({
    completude: "nao_houve",
    origem: "professor",
    origemInicial: "automatica",
    desfazerNaoHouveAte: emHoras(24),
    estado: "nao_houve",
  }),
  pendente: chamada({ estado: "pendente" }),
  sem_registro: chamada({
    data: isoDeOffsetNoClube(-10),
    estado: "sem_registro",
  }),
  cancelada: chamada({
    cancelada: true,
    estado: "cancelada",
    alunos: [aluno("a2", "Bruno", null, { faltaAvisada: true })],
  }),
};

interface Pedido {
  metodo: string;
  url: string;
}
let pedidos: Pedido[] = [];
let atual: ReturnType<typeof chamada>;

function responder(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const metodo = (init?.method ?? "GET").toUpperCase();
      pedidos.push({ metodo, url });
      if (metodo === "PUT" && url.endsWith("/nao-houve")) {
        return Promise.resolve(
          responder({ ocupacaoId: "oc1", completude: "nao_houve" }),
        );
      }
      if (metodo === "DELETE" && url.endsWith("/nao-houve")) {
        return Promise.resolve(responder({ ocupacaoId: "oc1", estado: "feita" }));
      }
      return Promise.resolve(responder(atual));
    }),
  );
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SPEC-076/AC-017 (i) — o api-client não escreve presença", () => {
  const fonte = readFileSync(
    join(__dirname, "..", "lib", "api-client.ts"),
    "utf8",
  );

  it("não exporta `salvarChamada`", () => {
    expect(Object.keys(api)).not.toContain("salvarChamada");
  });

  it("toda escrita em /me/teacher/attendance/ termina em /nao-houve", () => {
    // Cada chamada a `authFetch` com caminho de chamada e `method` mutador.
    const escritas = [
      ...fonte.matchAll(
        /authFetch\(\s*`([^`]*\/me\/teacher\/attendance\/[^`]*)`\s*,\s*\{[^}]*method:\s*"(PUT|POST|PATCH|DELETE)"/g,
      ),
    ].map((m) => `${m[2]} ${m[1]}`);

    // Não é vacuidade: as duas do `nao-houve` estão aqui.
    expect(escritas.sort()).toEqual([
      "DELETE /me/teacher/attendance/${ocupacaoId}/nao-houve",
      "PUT /me/teacher/attendance/${ocupacaoId}/nao-houve",
    ]);
  });
});

describe("SPEC-076/AC-017 (ii) — todo botão, em todo estado, só chega a /nao-houve", () => {
  it.each(Object.keys(ESTADOS))("%s", async (nome) => {
    atual = ESTADOS[nome];
    render(<ChamadaView ocupacaoId="oc1" />);
    await screen.findByText(atual.alunos[0].nome);

    // Duas voltas: um clique pode trocar os botões (registrar → Desfazer).
    const clicados = new Set<string>();
    for (let volta = 0; volta < 2; volta += 1) {
      for (const botao of screen.queryAllByRole("button")) {
        const rotulo = botao.textContent ?? "";
        if (clicados.has(rotulo) || (botao as HTMLButtonElement).disabled) {
          continue;
        }
        clicados.add(rotulo);
        await act(async () => {
          fireEvent.click(botao);
        });
      }
      await waitFor(() =>
        expect(screen.queryAllByRole("button").every((b) => !(b as HTMLButtonElement).disabled)).toBe(true),
      );
    }

    const mutadores = pedidos.filter((p) => p.metodo !== "GET");
    for (const p of mutadores) {
      expect(p.url).toMatch(/\/api\/v1\/me\/teacher\/attendance\/oc1\/nao-houve$/);
    }
    // Não é vacuidade: onde há ação, ela foi clicada e chegou ao servidor.
    const esperados: Record<string, string[]> = {
      automatica: ["PUT"],
      legada: [],
      nao_houve: ["DELETE"],
      pendente: ["PUT"],
      sem_registro: [],
      cancelada: [],
    };
    expect(mutadores.map((p) => p.metodo)).toEqual(esperados[nome]);
  });
});

describe("SPEC-076/AC-017 (iii) — o que está gravado, em texto", () => {
  it("Veio, Faltou, o selo de quem avisou, e o registro antigo", async () => {
    atual = ESTADOS.automatica;
    const { unmount } = render(<ChamadaView ocupacaoId="oc1" />);

    expect(await screen.findByText("Veio")).toBeInTheDocument();
    expect(screen.getByText("Faltou")).toBeInTheDocument();
    expect(screen.getAllByText("avisou que ia faltar")).toHaveLength(1);
    unmount();

    atual = ESTADOS.legada;
    render(<ChamadaView ocupacaoId="oc1" />);
    expect(
      await screen.findByText("Justificou (registro antigo)"),
    ).toBeInTheDocument();
  });

  it("aula sem registro mostra 'sem registro' por aluno — e nenhum botão de presença", async () => {
    atual = ESTADOS.pendente;
    render(<ChamadaView ocupacaoId="oc1" />);

    expect(await screen.findByText("sem registro")).toBeInTheDocument();
    for (const rotulo of ["Veio", "Faltou", "Salvar chamada", "Todos vieram"]) {
      expect(screen.queryByRole("button", { name: rotulo })).toBeNull();
    }
  });
});
