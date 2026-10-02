# PlayCK — Cliente

App do aluno (Next.js App Router, PWA instalável — ADR-012). Consome a API
de `back` — nenhum acesso direto ao banco (poly-repo, ADR-001).

## Setup local

```bash
pnpm install
cp .env.example .env.local
pnpm run gen:api-types   # exige ../Back/openapi.json (repo back ao lado deste, localmente)
pnpm run dev
```

Em produção/CI real (repositórios já separados), `gen:api-types` roda
apontando `BACK_OPENAPI_SOURCE` para a URL do `openapi.json` publicado
pelo `back`, não para um caminho relativo local.

**`src/lib/api-types.ts` é versionado (não gerado no CI).** O CI deste
repositório (`.github/workflows/ci.yml`) não roda `gen:api-types` — ele
não tem acesso ao `back` (repositório separado, ADR-001) nem a uma URL
pública de `openapi.json` até o `back` estar implantado. Isso significa
que o contrato pode ficar desatualizado (stale) se alguém mudar a API do
`back` e esquecer de regenerar os tipos aqui. **Ação obrigatória:**
sempre que `back` mudar um endpoint consumido por este app, rodar `pnpm
run gen:api-types` localmente e commitar o diff de `api-types.ts` no
mesmo PR. Automatizar essa checagem no CI fica para quando `back` tiver
uma URL pública estável (deploy real) — registrado como lacuna em
`STATUS.md`.

## Scripts

| Script | O que faz |
|---|---|
| `dev` | Sobe em modo desenvolvimento |
| `build` | Build de produção |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `test` | Testes (Vitest + Testing Library) |
| `gen:api-types` | Gera `src/lib/api-types.ts` a partir do `openapi.json` do `back` (ADR-001) |

## PWA

Manifest em `src/app/manifest.ts`, service worker mínimo em
`public/sw.js` (só habilita o prompt de instalação, sem cache/offline no
MVP). Ícones em `public/icon-*.png` são placeholder sólido até o arquivo
de marca oficial chegar (gap registrado em `STATUS.md`).

## Design

Tokens de `DESIGN.md` (raiz do repositório de documentação) copiados
localmente em `src/app/globals.css` — sem pacote compartilhado entre os
3 frontends (ADR-001). Componentes base: shadcn/ui.

## Fundo do login (SPEC-084)

A tela `/login` mostra uma fotografia atrás do formulário. A foto é só
cenário: logo, textos, campos e botão são HTML, e trocá-la não mexe em
nenhum deles.

- Foto atual: `public/images/login/aluno-background-v1.webp` (864×1821, WebP).
- Configuração única: `src/lib/login-appearance.ts` (`FUNDO_DO_LOGIN`).
- Registro dos arquivos: `src/lib/login-assets-manifest.json`.

**Para trocar a foto:**

1. Gere um WebP em retrato, sem texto, logo ou marca d'água, com no máximo
   350 KiB. Confira isso olhando a imagem: o teste não enxerga texto.
2. Salve com um **nome novo e versionado** em `public/images/login/`
   (ex.: `aluno-background-v2.webp`). **Nunca sobrescreva um nome já
   publicado**: o rollback depende da foto anterior continuar lá.
3. Em `src/lib/login-appearance.ts`, aponte `src` para o arquivo novo,
   atualize `largura`/`altura` e, se o recorte pedir, `posicao`. Nada fora
   deste arquivo.
4. Acrescente o arquivo ao `login-assets-manifest.json` (SHA-256, bytes,
   largura, altura), sem apagar as entradas anteriores.
5. Rode `pnpm exec vitest run src/lib/login-appearance.test.ts` e a prova de
   contraste `pnpm run test:navegador -- e2e/login-visual.spec.ts`. O
   contraste é medido também sobre fundos branco e preto, então uma foto mais
   clara não quebra a leitura, mas o recorte da raquete deve ser conferido
   nas capturas.
6. Publique foto, configuração e manifesto **no mesmo commit**.

O teste do asset reprova: arquivo ausente, formato que não é WebP, arquivo
acima de 350 KiB, dimensões diferentes das declaradas, hash diferente do
manifesto, bytes novos num nome que já existia e o caminho `/images/login/`
copiado em outro arquivo de `src/`. O “nome que já existia” é conferido
contra duas bases do Git: o último commit (pega a troca antes de commitar) e
o `merge-base` com `origin/main` (pega a sobrescrita de um nome já
publicado). No CI, que faz checkout raso, a segunda aparece como **pulada**,
com o motivo, e não como aprovada.
