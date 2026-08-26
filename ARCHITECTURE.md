# ARCHITECTURE — `cliente` (PlayCK)

**Fonte: análise direta do código.** Data: 2026-08-25.

Planta **AS-IS**. Intenção arquitetural vive em `TARGET_ARCHITECTURE.md`
(raiz do workspace) + ADRs em `DECISIONS.md`. Divergência entre este
documento e o código é defeito **deste documento**.

**Quem usa:** `aluno` · **Produção:** `app.playck.com.br`

PWA do aluno: ver aulas, reservar quadra, acompanhar reservas e criar a
própria conta pelos três caminhos de onboarding.

---

## 1. Stack real

| Lib | Versão | Papel |
|---|---|---|
| `next` | 16.3.0 | framework (App Router) |
| `react`, `react-dom` | 19.2.8 | UI |
| `radix-ui` | ^1.6.7 | primitivos acessíveis |
| `shadcn` | ^4.16.2 | componentes gerados em `components/ui/` |
| `tailwind-merge`, `clsx`, `class-variance-authority` | — | composição de classes |
| `lucide-react` | ^1.29.0 | ícones |

**NÃO existem no projeto:** biblioteca de estado global (Redux, Zustand,
Jotai, Recoil), React Query/SWR, form library (React Hook Form, Formik),
cliente HTTP (axios), i18n, biblioteca de datas (date-fns, dayjs — usa-se
`Intl` e `Date` nativos), Storybook, Sentry.

## 2. Visão geral e fluxo de referência

```
page.tsx (server component, fino)
   → components/*.tsx ("use client")
       → lib/api-client.ts  (authFetch: token, refresh, 401/403)
           → back (api.playck.com.br)
```

**Fluxo de referência — reservar quadra** (o molde a replicar):

1. `app/quadras/[id]/page.tsx` renderiza `components/court-booking.tsx`;
2. carrega quadra e disponibilidade por `lib/api-client.ts`;
3. a grade vem do **horário de funcionamento efetivo** da quadra;
   `estado: 'fechado'` tem tela própria — nunca grade vazia sem explicação;
4. seleção **múltipla**: o total aparece antes de confirmar;
5. `createBooking` manda os slots; **o servidor decide** o que é contíguo —
   a tela não agrupa nada.

## 3. Rotas e componentes

| Rota | Componente | Papel |
|---|---|---|
| `/login` | `login-form` | entrada; leva a `/primeiro-acesso` se a senha for temporária. **DEF-003**: "Cadastre-se" virou link real para `/cadastro` (era `<span>` morto desde a SPEC-007) e "Esqueceu a senha?" passou a dizer o caminho que existe hoje |
| `/primeiro-acesso` | `primeiro-acesso-form` | troca obrigatória da senha temporária (INV-008) |
| `/cadastro` | `escolher-clube-form` | **DEF-003**: pede o código do clube e redireciona para `/cadastro/<slug>`. Existe porque o login não sabe de qual clube a pessoa é; não valida o código aqui (o limite de 10/15min do endpoint público trancaria quem errasse duas vezes) |
| `/cadastro/[slug]` | `cadastro-publico-form` | auto-cadastro pelo link público da empresa |
| `/convite/[token]` | `aceitar-convite-form` | aceite de convite |
| `/home` | `home-view` | próximas aulas e atalhos |
| `/minhas-aulas` | `my-classes-list` | aulas de turma (view-only, GAP-008) |
| `/minhas-turmas` | `minhas-turmas-view` | **app do professor** (SPEC-013): a grade dele, sem `BottomNav` — barra com um item só é decoração |
| `/minhas-turmas/[id]` | `minha-turma-detalhe` | quem está na turma e as aulas dos últimos 30 dias |
| `/chamada/[ocupacaoId]` | `chamada-view` | **a chamada** (SPEC-014). Desenhada para uso em quadra: 3 estados visíveis, 1 toque cada, salvar explícito e barra fixa. **SPEC-015/DEF-002 (TASK-000a):** salvar exige todos os alunos marcados — antes gravava chamada pela metade — com atalho "Todos vieram" para o caso comum, e aviso quando a chamada é legada (`completude: desconhecida`) |
| `/quadras` (+ `[id]`) | `courts-list`, `court-booking` | reserva |
| `/perfil` | `perfil-view` + `foto-de-perfil` | **SPEC-018/TASK-003** — a foto do aluno/professor. Alcançável pelo ícone no `TopAppBar`, e não pela `BottomNav`: ela é `grid-cols-5` com botão central saliente, e um sexto item quebraria o desenho |
| `/reservas` | `my-bookings-list` | reservas do aluno |

## 4. Estado

| Tipo | Onde vive |
|---|---|
| Server state | `useState` + `useEffect` por tela, via `lib/api-client.ts` |
| Sessão | `lib/auth-storage.ts` — access token em `localStorage`; refresh em cookie `httpOnly` |
| UI local | `useState` no componente |
| Global | **não existe** |

**Nada de global**, mesma situação do `admin`. O token fica em
`localStorage` (`auth-storage.ts`); o refresh token é cookie `httpOnly` que
o JS nunca lê.

**PWA:** `register-service-worker.tsx` + manifest. A marca oficial vive em
`public/playck-logo.png` e deriva os ícones do navegador, Apple Touch Icon
e PWA (`192x192`/`512x512`).

## 5. Camada de API — a regra que mais importa

Todo acesso autenticado passa por **`authFetch`** (`lib/api-client.ts`), que
concentra três comportamentos:

1. **anexa o access token** do `localStorage`;
2. **renova a sessão em `401`** chamando `/auth/refresh` com
   `credentials: "include"`, e repete a requisição uma vez. A renovação é
   **compartilhada** entre chamadas simultâneas: sem isso, três `401` ao
   mesmo tempo disparariam três refreshes, e a rotação do backend trataria
   os concorrentes como reuso de token, **revogando a sessão inteira**;
3. **desvia em `403 SENHA_TEMPORARIA`** para a tela de primeiro acesso
   (só no `cliente`), em vez de mostrar erro seco.

**Chamar `fetch` direto numa tela é violação de camada** — perde as três
coisas acima.

## 6. Tipos do contrato

`lib/api-types.ts` é **gerado** do `openapi.json` do `back`
(`pnpm run gen:api-types`). Não editar à mão.

**Gap conhecido:** o CI **não** valida se esse arquivo está atualizado — a
mitigação é lembrar de rodar o comando, que é o tipo de mitigação que falha
em silêncio. Ver Gaps.

## 7. Requisitos de plataforma

Web responsivo, português do Brasil, tema claro. Sem offline (o service
worker do `cliente` registra, mas não há estratégia de cache de dados).
Deploy: Netlify (plano Personal desde 2026-08-22, ADR-014).

## 8. Regras de camada (com gate)

| Regra | Gate |
|---|---|
| `page.tsx` fina; lógica em componente cliente | revisão |
| Todo acesso autenticado por `authFetch` | busca por `fetch(` fora de `lib/` — **0 violações em 2026-08-22** |
| `api-types.ts` nunca editado à mão | arquivo é gerado; diff denuncia |
| Sem estado global sem ADR | busca por libs de estado no CI seria o gate — **hoje não existe** |
| `typecheck`, `lint`, `test`, `build` verdes | CI (GitHub Actions) a cada push |
| `comprimir-imagem.ts` idêntico entre `admin` e `cliente` | **não existe gate** — poly-repo sem pacote compartilhado (ADR-001). Custo declarado, ver a seção da compressão |

## 9. Compressão de imagem no navegador (SPEC-018/TASK-002)

`lib/comprimir-imagem.ts` — **existe desde 2026-08-25 e ainda não tem
chamador**: as telas que sobem foto são das TASK-003 a 006. É a peça que
transforma a foto de 12 MP do celular no que o servidor aceita: **2000px no
maior lado, WebP q90** (REQ-001), abaixo do teto de 2 MB e dos 2500px que o
`back` impõe.

**O arquivo é duplicado, byte a byte, em `admin` e `cliente`** — poly-repo
(ADR-001), sem pacote compartilhado. **Não há gate que garanta a
sincronia**: as duas cópias divergirem em silêncio é o custo declarado da
decisão, e mudança numa é mudança na outra.

**A parte que não é óbvia é o `ICCP` (INV-050, reescrita em 2026-08-26).**
`canvas.toBlob('image/webp')` **sempre** grava o chunk `ICCP` com um perfil
sRGB de 456 bytes, e o validador do `back` é allowlist — recusa. Sem
tratamento, **nenhuma imagem sobe**.

**O que este parágrafo dizia antes estava errado, e custou o DEF-007.** Dizia
que era caso de aparelho **Display P3** e que forçar `sRGB` no canvas
evitaria o chunk. Medido em Chrome 151 headless, sem tela nenhuma:
`colorSpace: 'srgb'`, contexto sem `colorSpace`, `colorSpaceConversion:
'none'` e `OffscreenCanvas` produzem o **mesmo arquivo, byte a byte**, todos
com `ICCP`. Foto de perfil e logo ficaram no ar sem funcionar.

Três camadas hoje:

1. `getContext('2d', { colorSpace: 'srgb' })` e
   `createImageBitmap(f, { colorSpaceConversion: 'default' })`, os dois
   **explícitos**. Não evitam o `ICCP` — garantem que os **pixels** saiam em
   sRGB, que é o que torna a camada 2 segura;
2. `removerIccp()` tira o chunk e apaga o bit `ICC` do `VP8X` antes de
   subir. Cirurgia de contêiner, **sem recodificar**: o bitstream sai
   intacto. Perda zero, porque o perfil removido é o sRGB — que já é como
   toda imagem sem perfil é lida;
3. `inspecionarWebp()` lê os FourCC do resultado **antes de subir**, e
   reprova localmente com mensagem legível em vez de deixar virar 422.
   `EXIF` cai aqui, e **não** é removido: carrega metadado de verdade (GPS,
   entre outros), e sumir com ele em silêncio seria decidir por quem subiu.

**A ordem entre 2 e 3 é o conserto.** Invertida, o pré-voo reprova o arquivo
que a remoção consertaria em seguida — que era, literalmente, o defeito.

A camada 3 **não é uma segunda validação**: a autoridade continua sendo
`webp.validator.ts` no `back`, que confere ordem, cardinalidade e dimensão.
Aqui só se pergunta "apareceu chunk que eu sei que vai ser recusado?".

**O que os testes provam e o que não provam.** `jsdom` não tem canvas nem
encoder de WebP, então **nenhum teste comprime imagem de verdade** — a
costura `DependenciasDoNavegador` existe para isso, e adicionar o pacote
nativo `canvas` seria mudar a lista de dependências deste repositório por
causa de um teste. Provado: a conta de dimensão (varredura, não caso
escolhido), a leitura de chunk, e **os argumentos exatos** de
`getContext`/`createImageBitmap`/`toBlob`, e **a remoção do `ICCP`**
(remoção do chunk, queda do bit `ICC`, tamanho do RIFF recalculado, padding
de payload ímpar, idempotência e totalidade).

**A lacuna que este parágrafo declarava antes era o DEF-007.** Dizia: "não
provado, e é lacuna real: que um Chrome em tela Display P3 de fato não grava
`ICCP`". Ele grava — sempre, em qualquer tela. A lacuna foi fechada por
medição em Chrome 151 headless, e o conserto foi conferido ponta a ponta
contra o `webp.validator.ts` real, com um arquivo produzido por um Chrome de
verdade: antes `IMAGEM_COM_METADADOS`, depois `valido: true`.

**A lição, que vale além deste arquivo:** lacuna declarada com honestidade
ainda é lacuna. Esta ficou escrita, revisada e aprovada por sete rodadas de
validação cruzada, e continuou sendo o defeito até alguém rodar o navegador.

### Foto de perfil (SPEC-018/TASK-003)

`/perfil` → `perfil-view.tsx` → `foto-de-perfil.tsx` → `comprimir-imagem.ts`
→ `api-client.ts` (`getMinhaFoto`/`enviarMinhaFoto`/`removerMinhaFoto`).
**A compressão acontece antes do envio, e a ordem é o ponto:** subir o
original de um celular (≈4 MB) daria 413 depois de a pessoa esperar o upload
inteiro por uma rede ruim.

**A URL da foto é assinada e expira**, e por isso vem de um `GET /me/foto`
próprio em vez de dentro de `/auth/me`: embutida na resposta de login,
ficaria velha numa sessão longa e a tela mostraria imagem quebrada sem ter
como se recuperar. Pela mesma razão a `<img>` é crua, e não `next/image` —
não há como otimizar no build uma URL que muda a cada leitura.

**`authFetch` deixou de mandar `Content-Type` quando o corpo é `FormData`.**
Quem monta o cabeçalho de multipart é o navegador, porque só ele conhece o
`boundary`. Com `application/json` junto, o campo `arquivo` nunca chegaria ao
servidor — e o erro apareceria como "envie o arquivo no campo arquivo",
mandando quem investigasse para o lado errado.

### A marca do clube na tela (SPEC-018/TASK-006)

`logo-da-empresa.tsx` — desenha a logo, ou a **inicial do clube** quando não
há. **Nunca cai para a marca do PlayCK:** o aluno abre o app da escola dele,
e pôr a marca do fornecedor no lugar diria a coisa errada todos os dias.

Aparece em dois lugares: o `TopAppBar` (quatro telas do aluno, onde o nome do
clube também substituiu "PlayCK") e a **página pública de cadastro**
`/cadastro/<slug>` — a única tela em que a logo aparece para quem ainda
**não** é cliente, e onde reconhecer a marca antes de digitar dados pessoais
é o que faz o link parecer legítimo.

**A URL vem sempre resolvida pelo servidor**, nunca montada aqui: quem
traduz `logo_key` → URL, com o fallback para a `logo_url` antiga (AC-013), é
o `LogoDaEmpresaService` no `back`. O frontend não sabe montar chave.

`getMinhaEmpresa()` é **cacheada num módulo** (uma promessa guardada), porque
o `TopAppBar` aparece em quatro telas e sem isso cada navegação refaria a
chamada. Não há React Query nem estado global neste projeto, e um store por
causa de um avatar seria a decisão errada. O cache é limpo em
`encerrarSessao()`: a próxima pessoa nesta aba pode ser de outro clube.

## 10. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | **`api-types.ts` pode ficar stale**: o CI não compara com o `openapi.json` do `back`. Já aconteceu — o `sadmin` acumulou 1.461 linhas de diferença | Média |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
