import { describe, expect, it, vi } from "vitest";
import {
  AVISO_NOVO,
  AVISOS_LIDOS,
  DEBOUNCE_MS,
  ligarContador,
} from "./contador-de-avisos";

/**
 * SPEC-065/AC-019 e AC-020 — **as três travas contra a rajada.**
 *
 * A v2 da spec dizia "um pedido por evento, só nas abas abertas" e não
 * perguntou quantos eventos nem quantas abas: `P` pushes em `A` abas dão
 * `P × A` consultas. E rajada é o caso **normal** — um gesto que avisa vinte
 * alunos são vinte pushes.
 *
 * **A porta é dublada de propósito.** Dirigir o tempo e os eventos aqui é o
 * que torna estes casos determinísticos: com `BroadcastChannel` de verdade e
 * `setTimeout` de verdade, o teste mediria a máquina.
 */

function portaFalsa() {
  let visivel = true;
  let ouvinteDeMensagem: (tipo: string) => void = () => {};
  let ouvinteDeVisibilidade: () => void = () => {};
  const agendados: Array<{ fn: () => void; ms: number; vivo: boolean }> = [];

  return {
    porta: {
      visivel: () => visivel,
      aoMudarVisibilidade(o: () => void) {
        ouvinteDeVisibilidade = o;
        return () => {};
      },
      aoReceberMensagem(o: (tipo: string) => void) {
        ouvinteDeMensagem = o;
        return () => {};
      },
      agendar(fn: () => void, ms: number) {
        const item = { fn, ms, vivo: true };
        agendados.push(item);
        return () => {
          item.vivo = false;
        };
      },
    },
    /** Dispara o que ainda estiver vivo — o debounce cancela os anteriores. */
    correrOTempo() {
      for (const a of agendados) {
        if (a.vivo) {
          a.vivo = false;
          a.fn();
        }
      }
    },
    agendamentosVivos: () => agendados.filter((a) => a.vivo).length,
    esperaUsada: () => agendados.at(-1)?.ms,
    push: (n = 1) => {
      for (let i = 0; i < n; i++) ouvinteDeMensagem(AVISO_NOVO);
    },
    leu: () => ouvinteDeMensagem(AVISOS_LIDOS),
    esconder: () => {
      visivel = false;
      ouvinteDeVisibilidade();
    },
    mostrar: () => {
      visivel = true;
      ouvinteDeVisibilidade();
    },
  };
}

const proximoTick = () => new Promise((r) => setTimeout(r, 0));

describe("SPEC-065/AC-020 — a rajada não vira enxurrada", () => {
  it("conta uma vez na abertura", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockResolvedValue(3);
    const vistos: number[] = [];

    ligarContador((n) => vistos.push(n), f.porta, buscar);
    await proximoTick();

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(vistos).toEqual([3]);
  });

  /**
   * **O caso que a v2 não tinha.** Vinte pushes numa rajada — um gesto que
   * avisa vinte alunos — e o contador faz **uma** consulta.
   */
  it("vinte pushes em rajada geram UMA consulta a mais", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockResolvedValue(20);

    ligarContador(() => {}, f.porta, buscar);
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(1); // a da abertura

    f.push(20);
    // Um agendamento vivo só: cada evento REAGENDA, não soma.
    expect(f.agendamentosVivos()).toBe(1);

    f.correrOTempo();
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("o debounce é de 2 segundos", () => {
    const f = portaFalsa();
    ligarContador(() => {}, f.porta, vi.fn().mockResolvedValue(0));
    f.push();
    expect(f.esperaUsada()).toBe(DEBOUNCE_MS);
  });

  /**
   * **Single-flight.** Com um pedido em voo, o próximo não começa: marca sujo
   * e dispara **no máximo mais um** quando o primeiro volta.
   */
  it("com pedido em voo, o próximo não abre um segundo", async () => {
    const f = portaFalsa();
    let soltar: (n: number) => void = () => {};
    const buscar = vi
      .fn()
      .mockImplementation(
        () => new Promise<number>((r) => (soltar = r)),
      );

    ligarContador(() => {}, f.porta, buscar);
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(1); // em voo, sem responder

    f.push(5);
    f.correrOTempo();
    await proximoTick();
    // **Ainda 1:** o segundo não começou.
    expect(buscar).toHaveBeenCalledTimes(1);

    soltar(7);
    await proximoTick();
    await proximoTick();
    // Voltou, e disparou NO MÁXIMO mais um.
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  /**
   * **Só a aba visível consulta** — é o que corta o multiplicador de abas.
   */
  it("aba oculta não consulta, e pede ao voltar a ficar visível", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockResolvedValue(1);

    ligarContador(() => {}, f.porta, buscar);
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(1);

    f.esconder();
    f.push(3);
    f.correrOTempo();
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(1); // nada enquanto oculta

    f.mostrar();
    await proximoTick();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("aba oculta que volta SEM ter perdido evento não consulta à toa", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockResolvedValue(1);

    ligarContador(() => {}, f.porta, buscar);
    await proximoTick();

    f.esconder();
    f.mostrar();
    await proximoTick();

    expect(buscar).toHaveBeenCalledTimes(1);
  });
});

describe("SPEC-065/AC-019 — duas abas não discordam", () => {
  /**
   * **O caso que derrubou a v1 da spec.** Eu afirmei que a contagem "só erra
   * para menos, que é o lado seguro" sem testar a direção contrária: bastava
   * uma segunda aba marcar tudo como lido para a outra seguir mostrando
   * número positivo — erro para **mais**.
   */
  it("a aba que recebe AVISOS_LIDOS zera SEM consultar o servidor", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockResolvedValue(4);
    const vistos: number[] = [];

    ligarContador((n) => vistos.push(n), f.porta, buscar);
    await proximoTick();
    expect(vistos).toEqual([4]);

    f.leu();
    await proximoTick();

    expect(vistos).toEqual([4, 0]);
    // **Nenhuma consulta nova:** zero é zero por definição, não por leitura.
    expect(buscar).toHaveBeenCalledTimes(1);
  });
});

describe("SPEC-065/LIM-065d — o contador é conveniência", () => {
  it("erro de rede não quebra a tela nem apaga o número anterior", async () => {
    const f = portaFalsa();
    const buscar = vi.fn().mockRejectedValue(new Error("sem rede"));
    const vistos: number[] = [];

    ligarContador((n) => vistos.push(n), f.porta, buscar);
    await proximoTick();

    expect(vistos).toEqual([]);
  });

  it("parar() impede qualquer aviso depois", async () => {
    const f = portaFalsa();
    let soltar: (n: number) => void = () => {};
    const buscar = vi
      .fn()
      .mockImplementation(() => new Promise<number>((r) => (soltar = r)));
    const vistos: number[] = [];

    const contador = ligarContador((n) => vistos.push(n), f.porta, buscar);
    await proximoTick();
    contador.parar();
    soltar(9);
    await proximoTick();

    expect(vistos).toEqual([]);
  });
});
