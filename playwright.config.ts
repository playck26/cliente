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
 * **`NEXT_PUBLIC_API_URL` aponta para uma porta MORTA de propósito.** Nenhuma
 * prova aqui deve falar com servidor: ou a tela não chama API, ou a chamada é
 * interceptada por `page.route()`. Com um endereço vivo, um teste que
 * esqueceu o mock passaria por acidente hoje e quebraria amanhã.
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
      // Porta morta — ver o cabeçalho.
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:59999",
    },
  },
});
