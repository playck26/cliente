# ARCHITECTURE — `cliente` (PlayCK)

**Fonte: análise direta do código.** Data: 2026-08-30.

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
| `/minhas-aulas` | `aulas-tabs` → `my-classes-list` \| `aulas-anteriores` \| `turmas-do-clube` | **SPEC-025** acrescentou a aba "Anteriores", onde o aluno avalia a aula — sem ela a avaliação seria funcionalidade sem porta de entrada, porque `GET /me/classes` só devolve o futuro. **A aula não mostra média** (decisão do Israel); a média é da turma e aparece na aba "Turmas". **SPEC-023** — duas abas: "Minhas aulas" (padrão) e "Turmas do clube". O GAP-008 (view-only) **caiu**: o aluno entra e sai de turma sozinho. As regras não moram na tela — `podeEntrar` e `motivo` vêm calculados do servidor, porque tela que deduz vira segunda cópia das regras (DEF-012) |
| `/minhas-turmas` | `professor-tabs` → `agenda-do-professor` \| `minhas-turmas-view` | **app do professor**. **SPEC-026** acrescentou a aba **Agenda, que é a padrão** — o pedido do Israel era que ele começasse escolhendo o DIA, não a turma. O calendário marca com um ponto os dias com **chamada pendente**: a grade ele já conhece de cabeça; o que ficou por registrar, não. **SPEC-030** acrescentou o badge `nao_houve` ("Aula não realizada"), **neutro e nunca vermelho** — o vermelho quer dizer "você esqueceu", e aqui o professor respondeu; sem o estado registrado ele cairia no fallback e uma aula do mês passado apareceria como "Ainda não começou". O mês é calculado no fuso do clube, senão às 21h de 30/09 a tela abriria em outubro |
| `/minhas-turmas/[id]` | `minha-turma-detalhe` | quem está na turma e as aulas dos últimos 30 dias |
| `/chamada/[ocupacaoId]` | `chamada-view` | **a chamada** (SPEC-014). Desenhada para uso em quadra: 3 estados visíveis, 1 toque cada, salvar explícito e barra fixa. **SPEC-015/DEF-002 (TASK-000a):** salvar exige todos os alunos marcados — antes gravava chamada pela metade — com atalho "Todos vieram" para o caso comum, e aviso quando a chamada é legada (`completude: desconhecida`). **SPEC-030:** ação **"A aula não aconteceu"**, com confirmação — é a única ação desta tela que não é um toque reversível, e responde por todos os alunos de uma vez. Some quando a aula já está marcada (repetir não faria nada) e quando alguém já foi marcado (o servidor recusaria com `CHAMADA_COM_PRESENCA`). Depois de gravar, **relê do servidor**: a `versao` nova é o que permite desfazer sem `409` |
| `/quadras` | — | **SPEC-022**: só um `permanentRedirect` (308) para `/reservas?aba=quadras`. Deixou de ser destino, continua sendo endereço — atalho de tela inicial e link mandado por conversa não podem quebrar (INV-022b) |
| `/quadras/[id]` | `court-booking` | reservar UMA quadra. **Não** foi afetada pelo redirect do índice: é o passo seguinte do fluxo, não uma aba |
| `/aceite` | `aceite-view` | **SPEC-024** — a tela para onde o `403 ACEITE_PENDENTE` desvia. **Sem barra de navegacao nem voltar**, mesmo desenho de `/primeiro-acesso`: oferecer uma saida que o servidor recusa e convidar a pessoa a bater numa porta trancada. Sem esta tela, ligar o portao seria apagao sem saida (LIM-024d) |
| `/perfil` | `perfil-view` + `foto-de-perfil` | **SPEC-018/TASK-003** — a foto do aluno/professor. Alcançável pela `BottomNav` desde 2026-08-29 (antes era pelo ícone no `TopAppBar`) |
| `/reservas` | `reservas-tabs` → `my-bookings-list` \| `courts-list` (+ `GrupoDeFiltro`) | **SPEC-022 + SPEC-041** — **três** abas numa tela só: "Reservas" (padrão), "Anteriores" e "Quadras". A terceira nasceu de defeito, não de pedido: a lista não tinha corte temporal, e reserva de semana passada aparecia como se ainda fosse acontecer. O corte é pelo **fim** da ocupação (D-I4) — quem está na quadra às 20h numa reserva de 19h às 21h ainda a vê na primeira aba, e por isso ela não se chama "Próximas". A lista remonta ao trocar de aba (`key`), então a paginação reinicia: declarado em LIM-041g. A aba mora em `?aba=`, não em estado de componente: é o que dá link compartilhável, "voltar" que desfaz a troca, e um alvo para o redirect de `/quadras`. Só o painel ativo é montado — montar os dois faria duas idas à rede para mostrar uma |

## 4. Estado

| Tipo | Onde vive |
|---|---|
| Server state | `useState` + `useEffect` por tela, via `lib/api-client.ts` |
| Sessão | `lib/auth-storage.ts` — access token em `localStorage`; refresh em cookie `httpOnly` |
| UI local | `useState` no componente |
| **Aba e vista** | **na URL** (`?aba=`, `?vista=`), não em `useState` |
| Global | **não existe** |

**A URL guarda o que a pessoa escolheu ver.** `abas-na-url.tsx` (aba) e o
`useVista` de `my-classes-list.tsx` (lista × semana) seguem a mesma regra: link
compartilhável, "voltar" que desfaz a troca, valor desconhecido cai no padrão
em silêncio, e **o padrão sai do endereço** — endereço limpo é o que a pessoa
copia.

**A frase que estava aqui — "quem escreve preserva o resto da query" — era
falsa, e a validação cruzada da SPEC-041 mostrou.** `abas-na-url.tsx` reconstrói
a URL **só** com `aba`, e o ramo do padrão é o pior: empurra o caminho pelado e
apaga tudo. Já é defeito em produção em `/minhas-aulas`, onde `?vista=semana`
some ao trocar de aba. Quem preserva é o `useVista` — um dos dois, não os dois.
Conserto na SPEC-041/B3; até lá, **isto aqui é descrição do que deveria ser, e
está marcado como tal**.

**Data e hora saem de `lib/fuso.ts`, nunca de `new Date().toISOString()`**
(DEF-020). `toISOString()` converte para UTC, e no Brasil isso já é o dia
seguinte das 21h à meia-noite — a tela de reserva pulava o dia de hoje. O
gate `lib/fuso.test.ts` varre `src/` e recusa quem calcular "hoje" fora
daquele arquivo.

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

**E ele estava velho quando o DEF-012 aconteceu** — ainda pedia
`esporte: string` no `CreateCourtDto`. Desde a SPEC-020/TASK-007 há
**`pnpm run api-types:check`**, que regenera e sai com código 1 se o arquivo
commitado estava atrasado. Provado nos dois sentidos: sujo → 1, em dia → 0.

**O que mudou de verdade:** `Court` e `OpcaoDeCatalogo` deixaram de ser
`interface` escrita à mão em `api-client.ts` e passaram a ser apelidos do
schema gerado. Antes, o arquivo gerado podia estar perfeito e o defeito
acontecia mesmo assim, porque a tela consumia o tipo escrito à mão.

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
| **Fixture de tela é tipada pelo contrato (`MyClass`, `AulaAnterior`, …), nunca objeto literal solto nem `unknown[]`.** Fixture sem tipo é o que deixa um campo obrigatório novo passar despercebido: `naoRealizada` entrou no contrato, duas telas ganharam ramo por causa dele, e **as provas das duas ficavam verdes se o ramo sumisse** — o `tsc` não tinha como cobrar um campo de um `Record<string, unknown>` | **não existe gate automático** — as fixtures de `home-view.test.tsx`, `aulas-anteriores.test.tsx`, `my-classes-list.test.tsx` e `semana-do-aluno.test.tsx` estão tipadas; o `tsc` passa a ser o gate a partir daí, para o próximo campo. Um gate que varra `src/**/*.test.tsx` atrás de fixture sem anotação ainda não foi escrito |
| **O que a tela afirma sobre o servidor vale sobre o que FOI ENVIADO, não sobre o que está na tela quando a resposta chega.** Os controles seguem vivos durante a requisição de propósito (em quadra, travar a tela é pior), então existe uma janela em que o rascunho já mudou e a resposta ainda fala do envio anterior — foi "Salvo" aparecendo ao lado da marca que o servidor nunca recebeu | prova com **promessa controlada**, não `mockResolvedValue`: `chamada-nao-houve.test.tsx`, describe "o rascunho durante o salvamento". `mockResolvedValue` achata o tempo assíncrono e essa janela deixa de existir dentro da prova |
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

**O que este parágrafo dizia antes estava errado, e custou o DEF-010.** Dizia
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

### O cabeçalho tem um botão só (revisão de 2026-08-29)

`top-app-bar` mantém a marca do clube à esquerda (SPEC-018/TASK-006 — *"o
aluno abre o app da escola dele"*) e, à direita, **apenas o logout**.

Saíram dois botões por motivos diferentes: **o sino**, que estava ali desde a
SPEC-007 documentado como *inerte* — não existe notificação no backend, e
ícone que ignora o toque ensina a pessoa a não tocar nos outros; e **o ícone
de perfil**, porque `/perfil` desceu para a barra.

**O logout pergunta antes**, e o atrito é deliberado: ele aparece em toda
tela, na altura do polegar, e um toque acidental derrubaria a sessão de quem
não tem recuperação de senha por e-mail (ADR-013). A confirmação é o próprio
botão virando "Sair da conta?", não um diálogo. Se a rede cair, a pessoa sai
assim mesmo — o padrão do `perfil-view`.

### Abas na URL, num lugar só (SPEC-022 → SPEC-023)

`abas-na-url.tsx` guarda a mecânica que a SPEC-022 criou para `/reservas` e
que a SPEC-023 precisou de novo em `/minhas-aulas`. Copiar teria criado duas
cópias da mesma decisão — e é sempre a cópia que fica velha, como a regra do
DEF-011 que morava num comentário de outro arquivo.

O que ele decide, e vale para toda tela que o use: a aba mora na **URL** (link
compartilhável, "voltar" que desfaz a troca, e um endereço para redirects
apontarem); valor desconhecido cai no padrão **em silêncio**; e a aba padrão
sai da URL, porque endereço limpo é o que a pessoa copia.

**Duas telas usam `useSearchParams`, então as duas exigem `Suspense`** — com
`fallback`, senão a tela pisca branco sobre fundo escuro antes de pintar.

### O portão do aceite, e por que ele tem tela própria (SPEC-024)

`api-client` ganhou o terceiro desvio de `403`, ao lado de `CONTA_INATIVA` e
`SENHA_TEMPORARIA`: `ACEITE_PENDENTE` manda para `/aceite`. **Depois do de
senha temporária de propósito**, e a ordem espelha a do servidor — quem ainda
não definiu senha própria resolve isso primeiro; empilhar as duas pendências
seria pedir que a pessoa aceite um contrato antes de ter uma conta de verdade.

**O convite mostra o contrato e registra o aceite junto com a conta**
(`aceitar-convite-form`). O termo da plataforma **não** vai por ali: ele não
aparece naquela tela, e registrar aceite de texto não visto destruiria o valor
do registro. Ele é lido inteiro em `/aceite`, no primeiro acesso.

### O erro agora chega com código (SPEC-023)

`ApiError` passou a carregar `code`, além de `status` e `message`. O servidor
já mandava o código em vários erros e **esta classe descartava**: quem
quisesse decidir pelo código teria de reler o corpo, e por isso as telas
decidiam pela **mensagem**. Mensagem é texto para humano — muda numa revisão
de copy e leva a regra junto.

`turmas-do-clube.tsx` é a primeira tela a usar isso: o mapa de explicações é
chaveado por código, e código desconhecido cai num texto genérico em vez de
quebrar.

### A barra de baixo conhece o papel (DEF-011, 2026-08-26)

`bottom-nav.tsx` desenha **duas** barras: a do aluno e a do professor
(`/minhas-turmas` e `/perfil`).

**A do aluno tem quatro destinos** — `/home`, `/minhas-aulas`, `/reservas`
e `/perfil` — em quatro colunas iguais, sem saliência.

O caminho até aqui explica o desenho: eram **cinco colunas para quatro
destinos** (o botão central e a aba "Quadras" levavam ao mesmo lugar); a
SPEC-022 reduziu a três itens e manteve o botão; e a **revisão visual em
produção (2026-08-29) derrubou o botão** — com `/quadras` virando aba dentro
de `/reservas`, ele deixou de ser atalho para outro lugar e virou uma segunda
porta para a tela vizinha. `/perfil` desceu do cabeçalho para a vaga que
sobrou, e com isso caiu o motivo pelo qual ele não cabia ali ("a barra é
`grid-cols-5` com botão central saliente").

**Antes ela era cega a papel, e isso prendia o professor.** Ele entrava em
`/perfil` para trocar a própria foto — a única tela que aluno e professor
dividem — recebia a barra do aluno, e os itens dela são
`@Roles('aluno')` no servidor. Cada toque virava "Sua conta não tem acesso
a esta área", e `/minhas-turmas`, a tela dele, **não estava na barra**: não
havia caminho de volta.

> **Nota da SPEC-022 sobre a prova deste defeito.** A lista de rotas
> proibidas ao professor perdeu `/quadras`, e não por descuido: depois que
> ela saiu da barra de todo mundo, afirmar que o professor não a recebe
> passaria **por acidente**. A regra guardada continua sendo "a barra não
> oferece rota de aluno"; a lista é só o conteúdo dela hoje.

**A regra já existia e estava no lugar errado.** `minhas-turmas-view` tinha
decidido certo e escrito o porquê num comentário — *"com os itens do aluno
seria mentira, porque o servidor recusa todos eles"* — e `perfil-view` não
tinha como saber. Decisão que mora em comentário só vale para quem lê aquele
arquivo.

Agora ela mora no componente que desenha a barra: tela nova que renderize
`<BottomNav>` sem pensar em papel acerta sozinha.

**E ela nunca adivinha** (corrigido na mesma noite). A primeira versão do
conserto desenhava a do aluno enquanto o papel era `undefined`, com o
argumento de que aluno é a maioria. **Estava errado:** no painel do professor
a barra do aluno piscava por um segundo antes de virar a certa, e menu que
pisca e some é pior que menu nenhum — a pessoa toca no que viu, e o alvo já
mudou.

São três fontes, nesta ordem:

| Fonte | Quando | Exemplo |
|---|---|---|
| a **prop** | a tela sabe quem está lá | `/minhas-turmas` passa `"professor"` literal — a rota é dele por definição |
| `localStorage` | gravado no login, junto do token | cobre `/perfil`, a única tela que os dois dividem, já na primeira pintura |
| **nada** | sessão aberta antes desta versão | barra vazia, mesma altura. Some no próximo login |

O papel no `localStorage` é **navegação, nunca autorização** — a mesma
distinção que `rota-inicial.ts` declara. Adulterá-lo dá tela errada, jamais
dado. `getPapel()` valida contra a lista de papéis: não para impedir fraude,
mas para não devolver lixo como se fosse papel, o que faria a barra cair no
ramo do aluno por acidente em vez de admitir que não sabe.

### Sair da conta (2026-08-26)

`perfil-view` tem o botão, e é a única ação destrutiva daquela tela — por
isso fica no fim, separado por uma linha dos botões da foto.

**O app não tinha logout.** Quem entrava só saía limpando o navegador, o que
num celular emprestado não é uma opção.

`logout()` avisa o servidor primeiro — é ele que revoga o refresh token e
limpa o cookie — mas **o estado local sai de qualquer jeito**, no `finally`.
Botão "Sair" que não sai porque a rede caiu é pior que não ter botão; o custo
de sair só localmente é um refresh token que expira sozinho, e o de não sair
é o aparelho continuar logado.

`router.replace`, não `push`: depois de sair, "voltar" não pode devolver a
tela de quem saiu.

### A turma do professor mostra os N dias (SPEC-019/TASK-005)

As duas telas de turma — lista e detalhe — passam a mostrar toda a
recorrência.

**Dia e horário andam juntos no mesmo chip.** Antes eram dois chips fixos:
um com o dia, outro com o horário. Numa turma de dois dias isso produziria
*"Terça, Sábado"* de um lado e dois horários do outro, e ninguém saberia qual
hora é de qual dia. Há teste que cai se alguém separar de novo.

**O quadradinho do card cabe um encontro** e mostra o primeiro — a lista vem
ordenada do servidor, então escolher aqui faria a ordem do card discordar do
texto ao lado. O **`+N`** avisa que há mais sem tentar espremer.

**`DIAS_SEMANA` estava copiado nas duas telas** e virou `lib/encontros.ts`.
A convenção do índice é `0 = domingo`, igual a `Date.getDay()` e ao banco:
**não há tradução de índice em lugar nenhum deste produto**, e é deliberado —
tradução de índice de dia é erro que só aparece no domingo, quando ninguém
está olhando. Há sabotagem que prova isso.

**O detalhe do professor foi o BLOQUEADOR 1 da validação cruzada da
SPEC-019.** A 1ª versão da spec listava só a rota de lista no contrato e
esquecia `/me/teacher/classes/:id`: a lista seria atualizada e o detalhe
continuaria esperando campos removidos — tela branca, exatamente o DEF-012.
Nenhuma das duas telas tinha teste até a TASK-005.

### O filtro por esporte e categoria (SPEC-020/TASK-006)

A barra da lista de quadras tem **dois** grupos, esporte e categoria de piso,
e os dois se combinam por **interseção** (AC-009).

**As opções são derivadas das quadras que já chegaram** — e isso não é atalho,
é a leitura correta da spec. A INV-056 original proibia derivar das quadras; a
1ª rodada de dúvida derrubou a proibição, porque o defeito nunca foi *olhar
para as quadras*, era o valor ser **texto digitado**. Depois da TASK-003,
`quadra.esporte` é uma referência ao catálogo — derivar dela **é** derivar do
catálogo.

Derivar assim entrega duas coisas sem código extra:

- **AC-008** — opção do catálogo sem nenhuma quadra não vira botão morto. Um
  clube com 6 categorias e 2 em uso não empurra 4 filtros que não filtram;
- **NFR-001** — continua **uma** requisição. Filtro não vale três idas à rede.

**A regra de quando o grupo aparece não é "mais de uma opção".** Um clube com
*uma* categoria e algumas quadras sem categoria tem escolha real — ver só as de
saibro exclui as sem classificação. Já um clube onde *toda* quadra é de tênis
não tem escolha nenhuma. Por isso o "sem opção" conta como um balde, e o grupo
some quando existe um balde só.

**O filtro compara `id`, nunca `nome`.** Comparar por nome traria de volta
exatamente o que a SPEC-020 veio desfazer.

### DEF-012 — o app ficou em BRANCO em produção, e o typecheck estava verde

A TASK-003 trocou `quadra.esporte` de `string` para `{ id, nome } | null`.
Três telas deste repositório renderizavam a string direto — `courts-list`,
`court-booking` e `my-bookings-list`. Objeto como filho de JSX faz o React
**estourar**, não mostrar texto errado: a tela vai a branco.

**Por que o typecheck não pegou, e é a lição que fica:** a interface `Court`
é escrita **à mão** em `api-client.ts`. Ela dizia `esporte: string` e
continuou dizendo depois que o contrato mudou. **Tipo escrito à mão não é
contrato — é uma afirmação sobre ele, e ela envelhece calada.**

No mesmo dia, o Admin pegou um erro da mesma família (`categoriaId` emitido
como `Record<string, never>`) **porque lá os tipos são gerados** do
`openapi.json`. Mesma spec, mesmo dia, dois repositórios: o que gera pegou, o
que afirma não pegou.

**E `?? "Quadra"` não protegia.** `quadra?.esporte ?? "Quadra"` parece
defensivo e não é: objeto não é nulo, então o `??` entrega o objeto ao JSX.
Só o `?.nome` fecha.

**A raiz é maior do que este repositório, e foi medida:** das **90**
respostas que a API expõe, **zero** declaram schema no `openapi.json` — o
Nest só emite schema para corpo de **requisição**. Por isso o Admin pegou o
erro do `UpdateCourtDto` hoje (requisição) e ninguém tinha como pegar o do
`esporte` (resposta).

Ou seja: **não é que o Cliente escreve tipo à mão e o Admin gera.** Os três
frontends escrevem à mão *toda* resposta, porque não há o que gerar. Enquanto
o `back` não declarar tipo de resposta, **qualquer mudança de contrato de
resposta é invisível para os três typechecks.** Vai para a TASK-007.

**O teste que existia não pegava:** `my-bookings-list.test.tsx` mocka
`listCourts` com `data: []`. Lista vazia nunca chega à linha que renderiza o
esporte. `courts-list.test.tsx` nasceu para fechar isso, e reproduz o estouro
antes de consertá-lo.

### A imagem da quadra chega ao aluno (SPEC-018/TASK-005)

`capa-da-quadra.tsx` decide **foto quando há, desenho quando não**, e é
usada pela lista (`courts-list`) e pela tela de reserva (`court-booking`).

**Ela nasceu de um vão:** a TASK-005 subiu com o upload no Admin e a rota no
`back`, e **sem uma linha neste repositório**. O gestor subia a foto, o
servidor devolvia `imagemUrl`, e o app continuava com as linhas sintéticas —
exatamente para quem a spec dizia que ia ver.

**O degradê não é enfeite:** o preço e o nome são texto branco por cima.
Sobre as linhas o fundo é cor escolhida por nós; sobre a foto do clube não há
garantia, e uma quadra clara ao meio-dia apaga os dois. Ele só existe quando
há foto.

**Sem `next/image`:** URL de CDN externo exigiria o domínio em
`next.config.ts`, e a planta declara que este projeto não carrega otimizador
para host de terceiro.

**Um teste desta tela nunca provou o que dizia** (corrigido em 2026-08-26).
`expect(enviarMinhaFoto).toHaveBeenCalledWith(COMPRIMIDA)` passava mesmo
quando a tela subia o original de 4 MB: `File` não tem propriedade própria
enumerável, e a comparação estrutural do vitest vê `{}` contra `{}`. Agora
a asserção é por **identidade** (`toBe`). Vale para qualquer `File`,
`Blob`, `FormData` ou `Headers` num assert deste repositório.

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

**A lacuna que este parágrafo declarava antes era o DEF-010.** Dizia: "não
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
