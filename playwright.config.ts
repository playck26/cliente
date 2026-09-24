/**
 * SPEC-072/TASK-003 — **a primeira infraestrutura de prova VISUAL do projeto.**
 *
 * ## Por que ela precisou existir
 *
 * A queixa do Matheus é geométrica: *"a informação da aula fica cortada"*. A
 * v1 desta spec tentou fechá-la com asserção de campo — *"o `horaFim` aparece
 * no texto"* —, e o validador independente mostrou o furo: `overflow:hidden`
 * num ancestral, conteúdo atrás do botão, largura insuficiente ou overflow
 * horizontal deixam a asserção **verde** com a queixa **de pé**.
 *
 * **E o jsdom não alcança nada disso.** Medido antes de decidir: um
 * `getBoundingClientRect()` ali devolve **zero** em `width`, `height` e
 * `right`, e `scrollWidth` também; `getComputedStyle` só lê o que foi
 * declarado, nunca o que foi calculado. Não há layout engine. Então **ou a
 * prova é de navegador, ou não é prova** — é a `D2`.
 *
 * ## As escolhas, e o motivo de cada uma
 *
 * **Viewport de 320px**, e não 390: é a largura normativa da `AC-006`, e o
 * limite inferior defensável. Provar a 390 e quebrar a 320 seria provar a
 * tela errada.
 *
 * **`workers: 1` e `fullyParallel: false`.** Esta máquina não sobe worker de
 * forma confiável — o `CLAUDE.md` registra três `pnpm test` simultâneos
 * matando os workers dos três. Aqui o paralelismo não compraria nada: são
 * poucos casos, e o servidor é um só.
 *
 * **`retries: 0`, inclusive no CI.** Retry esconde instabilidade, e este
 * projeto acabou de gastar três rodadas medindo uma. Se ficar instável, o
 * lugar de tratar é a causa.
 *
 * **Build de produção, não `next dev`.** O `dev` injeta indicador e overlay
 * próprios, que ocupam pixel e mudam o que a geometria mede. O objeto do
 * julgamento é o que o usuário recebe.
 *
 * **`NEXT_PUBLIC_API_URL` aponta para a PRÓPRIA origem**, e não para uma porta
 * morta — e a razão foi medida, não escolhida.
 *
 * A primeira versão apontava para `127.0.0.1:59999`, morta de propósito, para
 * que um teste sem mock falhasse em vez de passar por acidente. **Não
 * funciona:** a chamada da app leva `Authorization`, o que a torna "não
 * simples"; o navegador manda um **preflight `OPTIONS`** antes, e a
 * interceptação do Playwright **não o serve** — ele vai para a rede de
 * verdade, encontra a porta fechada e o `fetch` morre com *"Failed to
 * fetch"*. A tela vira boundary de erro e nenhuma geometria chega a existir.
 *
 * Mesma origem elimina o preflight, e a propriedade que interessava
 * **sobrevive**: o `next start` não tem rota `/api/v1`, então chamada sem mock
 * recebe a página 404 do Next e o cliente falha ao ler JSON. Continua falhando
 * alto.
 */
import { defineConfig, devices } from "@playwright/test";

/** Porta própria: não colide com o `next dev` (3000) nem com o Back. */
const PORTA = 3101;
const BASE = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-320",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 640 },
      },
    },
  ],
  webServer: {
    command: `pnpm run build && pnpm exec next start --port ${PORTA}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    // O `next build` sozinho leva ~1min nesta máquina; no CI, mais.
    timeout: 300_000,
    env: {
      // Mesma origem, para não haver preflight — ver o cabeçalho.
      NEXT_PUBLIC_API_URL: BASE,
    },
  },
});
