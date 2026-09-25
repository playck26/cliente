import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    /**
     * **A fronteira entre as duas suites, e ela EXCLUI em vez de incluir.**
     *
     * Sem isto o vitest varre a raiz inteira e alcanca `e2e/`, tentando
     * rodar Playwright dentro do jsdom (SPEC-072/TASK-003). Teste de
     * componente mora em `src/`; prova de navegador mora em `e2e/`, e e do
     * `pnpm run test:navegador`.
     *
     * **A primeira versao disto era um `include` de `src/**`, e ela calou 44
     * testes** — os de `scripts/` (`netlify-ignore.test.mjs` e
     * `badge-do-aviso.test.mjs`), que ninguem lembrou de listar. A suite
     * passou VERDE com 66 arquivos onde havia 68, e quem denunciou foi a
     * CONTAGEM, nao um vermelho.
     *
     * Dai a forma: `include` estreito perde em silencio; `exclude` so tira o
     * que nomeia. Quando errar, errar para o lado de rodar demais.
     */
    exclude: [...configDefaults.exclude, "e2e/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
