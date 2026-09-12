import type { MetadataRoute } from "next";

// PWA instalável (ADR-012), usando a marca oficial fornecida para o Cliente.
/**
 * SPEC-050 — o que mudou aqui, e por que cada campo importa.
 *
 * O manifest anterior já bastava para o Chrome considerar o app instalável —
 * e é por isso que ele durou: nada reclamava. O que faltava era tudo o que
 * decide a **aparência** e a **identidade** do app depois de instalado.
 *
 * - **`icons` com `purpose: "maskable"`** — o par anterior era só `"any"`, e
 *   o logo sangra até a borda (o laço dourado). Launcher adaptativo do Android
 *   recorta em círculo ou squircle, e sem um `maskable` ele come o laço. Os
 *   arquivos saem de `harness/pwa/gerar-icones.mjs`, que também **achatou o
 *   alfa**: os ícones antigos eram transparentes, e transparência em ícone de
 *   instalação vira fundo preto no iOS e fundo-a-critério-do-launcher no
 *   Android.
 * - **`id`** — âncora de identidade do app. Sem ele o navegador usa a
 *   `start_url`, e mudar a `start_url` um dia passaria a valer como "outro
 *   app": quem tivesse instalado ficaria com um ícone órfão.
 * - **`scope`** — declara que o app é o site todo. Sem `scope` explícito o
 *   padrão é o diretório do manifest, que aqui dá no mesmo, mas deixa a regra
 *   dependente de onde o arquivo mora.
 * - **`lang`/`dir`** — o app é pt-BR, como o `<html lang>` já dizia.
 *
 * `start_url` continua `/`. Ver a ressalva registrada na SPEC-050: `/`
 * redireciona para `/login` e **o login não reconhece quem já tem token**, ou
 * seja o app instalado abre na tela de login mesmo para quem já entrou. Isso
 * é anterior a esta spec e mexe em fluxo de autenticação — ficou fora dela de
 * propósito, não por esquecimento.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PlayCK",
    short_name: "PlayCK",
    description: "Suas aulas e reservas de quadra em um só lugar",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#f7f8f5",
    theme_color: "#00763a",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
