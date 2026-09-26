# ARCHITECTURE — `cliente` (PlayCK)

**Fonte: análise direta do código.** Data: **2026-09-25** (era 2026-09-24).
**Conferido por comando nesta data, na branch da SPEC-074:** **72** arquivos de
teste, **834** casos, **53** componentes e **21** módulos em `lib/`
(`vitest run --pool=threads`, em série; `.tsx` de `src/components`, sem
subpastas e sem os `.test.tsx`). **Mais 3 arquivos de prova de NAVEGADOR, 11
casos** (`pnpm run test:navegador`).

*Os 834 foram contados em DUAS partes, e a soma é a prova:* a suíte inteira
rodou 654 casos em 65 arquivos e saiu `1` **com zero vermelho** — 7 arquivos não
subiram worker, o defeito que o `CLAUDE.md` registra —, e os 7 rodados isolados
deram 180. **654 + 180 = 834**, a conta prevista antes de rodar (812 da `main` +
22 da SPEC-074). *A defasagem do topo anterior (69/777/51/20) não é toda desta
spec: a TASK-007 da SPEC-064 e a SPEC-073 passaram sem atualizá-lo.*

*Registro de 2026-09-24:* 69 arquivos, 777 casos, 51 componentes, 20 módulos, e
2 arquivos / 8 casos de navegador — categoria que não existia nesta planta.

*Histórico dos números: a SPEC-052 registrou 43/473/42; a SPEC-054 levou a
52/568/45; e este ciclo (SPEC-072) fecha em 69/777/51. **O salto de 17 arquivos
e 209 casos não é todo desta spec** — são as SPECs 055 a 071, que passaram sem
atualizar esta planta. Fica registrado porque planta desatualizada é pior que
planta ausente: quem lê confia nela.*

Planta **AS-IS**. Intenção arquitetural vive em `TARGET_ARCHITECTURE.md`
(raiz do workspace) + ADRs em `DECISIONS.md`. Divergência entre este
documento e o código é defeito **deste documento**.

**Quem usa:** `aluno` · **Produção:** `app.playck.com.br`

PWA do aluno: ver aulas, fazer reservas (quadra ou aula particular),
acompanhar reservas e criar a própria conta pelos três caminhos de onboarding.

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
| `@playwright/test` | ^1.63.0 | **prova de navegador** (SPEC-072/TASK-003) |

**NÃO existem no projeto:** biblioteca de estado global (Redux, Zustand,
Jotai, Recoil), React Query/SWR, form library (React Hook Form, Formik),
cliente HTTP (axios), i18n, biblioteca de datas (date-fns, dayjs — usa-se
`Intl` e `Date` nativos), Storybook, Sentry.

### Duas suítes, e a fronteira é explícita (SPEC-072/TASK-003)

| Suíte | Onde | Ambiente | Prova |
|---|---|---|---|
| `pnpm test` | `src/**`, `scripts/**` | `vitest` + **jsdom** | comportamento, contrato de chamada, DOM |
| `pnpm run test:navegador` | `e2e/**` | **Chromium**, 320px, build de produção | **geometria** — pixel, interseção, clipping, rolagem |

**O jsdom não tem layout engine.** `getBoundingClientRect()` devolve zero em
`width`, `height` e `right`; `scrollWidth` devolve zero no documento;
`getComputedStyle` só lê o declarado. **Toda alegação visual deste projeto era
indemonstrável antes da SPEC-072** — asserção de texto fica verde com
`overflow:hidden` num ancestral, com conteúdo atrás do botão e com rolagem
horizontal.

A fronteira é mecânica: o `vitest.config.mts` **exclui** `e2e/**`. É
`exclude` e não `include` de propósito — um `include: ["src/**"]` calou 44
testes de `scripts/` sem um único vermelho, e o que denunciou foi a contagem.
**Include estreito perde em silêncio; exclude só tira o que nomeia.**

**O job `navegador` do CI roda a segunda suíte, e NÃO é obrigatório:** o
ruleset do `main` exige `build` e `contrato`. Gate declarado aberto, não
mecanizado — `src/lib/prova-visual.test.ts` guarda a existência do job, não o
veredito dele.

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
| `/home` | `home-view` → `cartao-da-proxima-aula` + `calendario-do-aluno` | **SPEC-058 — o calendário do mês e o cartão de volta.** O Israel usou a home em produção e pediu as duas coisas: um calendário *"parecido com o do professor, só que mais atrativo"* e o cartão de volta, *"trazendo os insights mais importantes"*. O **cartão** não repete a grade: ele diz **quanto falta** ("em 3 horas", "amanhã às 19:00"), que é o que ela não diz — e o insight foi **escolha dele entre quatro** (D3). **Sem aula futura ele não some**, vira convite (AC-007): cartão que some faz a home pular de altura. O **calendário** nasceu do molde de `agenda-do-professor`, **não de abstração comum** — lá o ponto é "faltou registrar presença", aqui é "você avisou que vai faltar", e amarrar as duas agora seria amarrar telas que ainda vão divergir (D1). **Uma requisição só no primeiro desenho**, com janela do 1º do mês até +60 dias: ela alimenta a grade *e* o cartão; trocar de mês troca só a grade, para o cartão não passar a apontar para o mês que o aluno foi espiar. **A semana (`semana-do-aluno`) saiu daqui e continua em `/minhas-aulas`**, onde é uma das duas abas e o aluno escolhe — na home era imposição. Invariantes herdadas que **não** caíram: nenhum link para `/quadras` (SPEC-053/AC-009), a palavra "quadra" ausente da home (AC-001 — a primeira versão do cartão a escrevia, e quem pegou foi o teste plantado pela SPEC-057), aula **não realizada** marcada na lista do dia (SPEC-030, achado ALTA), e o aviso de falha da agenda com lugar próprio (DEF-033) **SPEC-059 — a agenda passou a ter TUDO.** O calendário nascia só com aula de turma, e quem reservava quadra na sexta via sexta vazia: agora ele junta as três origens (`/me/classes` + `/bookings` na mesma janela) e **cada linha diz o que é**, com o termo que o CLUBE deu ao tipo (`nomes-de-tipo`, SPEC-054/D1) — clube que chama de "Espaço" lê "Reserva · Espaço". Cada item traz os **materiais alugados** ("2× Raquete · 1× Toalha"), o valor, a situação de pagamento e as marcas de aula (falta avisada, não realizada). Reserva cancelada aparece **riscada**, não some (SPEC-041/SPEC-056). **Falha de uma origem não derruba a outra:** sem as reservas, a grade mostra as aulas e o aviso ocupa o lugar do que faltou. **O rótulo do tipo revogou em parte a SPEC-053/AC-001** (a home não escrevia "quadra"): o Israel pediu o oposto olhando a tela, e a D3b registra a troca — o gate de redação `redacao-de-reservas.test.ts` continua verde porque o texto agora vem do nome configurado, não de frase fixa **SPEC-073 — a home parou de esperar em fila.** Eram três idas em série (`me` → aulas → reservas), e o professor faz uma. Com o papel guardado no login (`getPapel`, **navegação, nunca autorização**) aulas e reservas saem **junto com** o `getMe()`, num `Promise.allSettled` — a falha de uma continua não derrubando a outra, e a busca adiantada nunca rejeita. **Quem decide o que pinta continua sendo o `getMe()`:** papel guardado de aluno com `getMe` dizendo gestor pede e descarta (LIM-073a). A grade desenha **antes** do dado, como a do professor, com `carregando` no lugar da lista — e durante a carga ela **não diz** "Nenhum compromisso neste mês". Um contador (`pedidoDaAgenda`, o molde do DEF-021) impede resposta velha de pintar o mês da tela; a carga inicial alimenta o cartão sempre |
| `/minhas-aulas` | `tela-de-aulas` → `my-classes-list` | **SPEC-057/TASK-002/D11 (card 5352) — a agenda é a tela, e o submenu saiu.** As abas "Próximas / Anteriores / Turmas" não existem mais. **A ordem da mudança é a decisão:** aquelas três abas **não eram três vistas do mesmo dado** — "Turmas" era o único lugar do produto onde o aluno entra e sai de turma, e "Anteriores" o único de onde ele avalia aula passada (achado B02 do veredito independente). Os dois ganharam **endereço próprio primeiro**, e só depois a barra saiu. A vista de semana agora **alcança o passado**: ela avisa a janela (`onJanela`) e o pai pede `GET /me/classes?de=&ate=`, somando ao que já tem em vez de substituir — trocar apagaria as próximas aulas da lista ao lado. **`abas-na-url` continua**, porque Reservas usa |
| `/minhas-aulas/turmas` | `turmas-do-clube` | o catálogo, com o filtro de nível da TASK-004. **Sem a nota** desde a TASK-002/D12: o card manda ocultá-la do aluno, a SPEC-052 já a tinha tirado do professor, e a busca da média saiu junto com o desenho — chamada alimentando estado que ninguém lê é ida à rede por nada |
| `/minhas-aulas/anteriores` | `aulas-anteriores` | o histórico e a **avaliação** da aula que passou. `avaliarAula` não é chamado em nenhum outro componente: esta tela é o fluxo inteiro |
| `/minhas-aulas/turma/[id]` | `turma-do-aluno` | **a ficha da turma, do lado do ALUNO** (SPEC-057/TASK-002/D9). Professor, nível, quadra, encontros e **quem está na turma — nome e nível**, autorizado pelo Israel. É a primeira tela do app do aluno que mostra nome de terceiro, e por isso **não inventa afordância sobre gente**: colega não é link nem botão. Endereço próprio porque `/minhas-turmas/[id]` **é do professor** — um aluno que abrisse aquele caía em 403 |
| `/minhas-turmas` | `tela-do-professor` → `agenda-do-professor` + `suas-turmas` | **app do professor — uma tela só desde a SPEC-052.** As abas da SPEC-026 saíram (`professor-tabs` e `minhas-turmas-view` foram apagados; `?aba=` é ignorado, para favorito antigo não quebrar). A **agenda** marca o tipo de aula de cada dia por **forma e cor** — círculo `primary-strong` para turma, quadrado `court-blue` para particular, com legenda em texto e `aria-label` que nomeia os tipos; no dia selecionado os marcadores ficam sobre pastilha branca, porque o fundo do selecionado é a cor do círculo. Cada aula de turma tem **"Ver turma"**. O **índice "Suas turmas"** embaixo não é a aba de volta: é o caminho para a ficha que a SPEC-031/AC-019b exige, porque a agenda exclui aula cancelada. **SPEC-056 (GAP-015):** o índice pede `incluirInativas` e mostra, embaixo, o grupo **"Turmas inativas"** (marcadas, com link para a ficha) — só as que o servidor devolve, com aula nos últimos 90 dias ou no futuro. Era o caso sem porta: turma inativada antes da primeira aula só tem aulas canceladas, e a agenda não mostra nenhuma. **O back anterior à 056 recusa o parâmetro com `400`**: back antes. **Sem nota de avaliação** (SPEC-052/D6). Histórico: a **SPEC-026** tinha criado a aba Agenda como padrão — o pedido do Israel era que ele começasse escolhendo o DIA, não a turma. O calendário marcava com um ponto os dias com **chamada pendente**; **a SPEC-076/D4 tirou o ponto, o anúncio "N sem chamada" e o selo vermelho** — ninguém lança presença à mão, e cobrar o professor seria acusá-lo de esquecimento. `pendente` diz "Aguardando fechamento" e `sem_registro` diz "Sem registro", os dois neutros (AC-019). A ficha da turma tira o rótulo do `estado` (e não mais de `podeLancar`, que dizia "ainda não aconteceu" em aula passada) e leva à chamada **toda aula já começada** (AC-020). **SPEC-030** acrescentou o badge `nao_houve` ("Aula não realizada"), **neutro e nunca vermelho** — o vermelho quer dizer "você esqueceu", e aqui o professor respondeu; sem o estado registrado ele cairia no fallback e uma aula do mês passado apareceria como "Ainda não começou". O mês é calculado no fuso do clube, senão às 21h de 30/09 a tela abriria em outubro |
| `/minhas-turmas/[id]` | `minha-turma-detalhe` | quem está na turma e as aulas dos últimos 30 dias — **90 na turma inativa** (SPEC-056: ela entra no índice com aula nos últimos 90 dias). O rótulo diz o `status` real; era "Turma ativa" fixo. Resposta de janela antiga que chega atrasada é descartada |
| `/chamada/[ocupacaoId]` | `chamada-view` | **a chamada, só leitura desde a SPEC-076** (decisões 1 e 9 do Israel: ninguém lança presença à mão). Cada aluno mostra o que está **gravado**, em texto ("Veio", "Faltou", "Justificou (registro antigo)", "sem registro"), e o selo **"avisou que ia faltar"** — o aviso nunca tinha aparecido aqui, e é ele que decide o "Faltou" (D2). Uma frase diz de onde veio o registro, pelo `estado` do `GET` (automática / humano anterior / não realizada / aguardando o fechamento / sem registro); o Back anterior à 076 não manda `estado`, e aí a aula sem cabeçalho é "aguardando" (D12). Ficam **duas** ações, cada uma só onde o servidor aceitaria: **"A aula não aconteceu"** (as guardas do portão espelhadas: cancelada, não começou, janela — a da automática pelo `corrigivelAte`, a outra pela data + 7 dias no fuso do clube —, presença humana gravada) e **"Desfazer (até …)"**, **só** com `desfazerNaoHouveAte` não nulo, que chama o `DELETE …/nao-houve` e relê. Escrita e releitura em dois `try`: releitura que falha não diz que a escrita falhou. Saíram: os botões Veio/Faltou, "Salvar chamada", "Todos vieram", o fluxo de `409`/revisão e o `salvarChamada` do `api-client` (AC-017 prova a classe: nenhum pedido mutador fora de `/nao-houve`, com o `fetch` espionado e todo botão clicado) |
| `/quadras` | — | só um `permanentRedirect` (308). **SPEC-053/D5:** o destino passou a ser `/reservas/nova?tipo=quadra` — direto, sem passar por `/reservas?aba=quadras`, que também redireciona e faria duas voltas. **SPEC-022** criou o redirecionamento: deixou de ser destino, continua sendo endereço — atalho de tela inicial e link mandado por conversa não podem quebrar (INV-022b, e agora INV-131) |
| `/quadras/[id]` | `court-booking` | reservar UMA quadra. **SPEC-074 — o horário OCUPADO deixou de ser botão morto:** tocar abre a confirmação *"Este horário está ocupado. Quer ser avisado se ele vagar?"* e pede aviso (`POST /me/pre-reservas`); o ocupado **nunca** entra na seleção de reserva, e o slot com aviso vivo diz *"Aviso ativo"* e oferece cancelar. **E a data vem pela URL** (`?data=AAAA-MM-DD`, lida no servidor pela página): é por onde o aviso de horário livre traz o aluno ao dia certo; malformada, inexistente ou passada cai em hoje (`dataInicialDaUrl`). **Não** foi afetada pelo redirect do índice: é o passo seguinte do fluxo, não uma aba — e segue assim na SPEC-053 (AC-011, medido: `200`, sem `Location`). A frase *"A quadra não abre neste dia."* fica: fala da quadra física, não da área (categoria C da D1). **SPEC-054/D12:** escolhido o horário, entra o **passo "Adicionais"** (`passo-de-adicionais`) — some quando o clube não tem adicional ativo. O total do resumo e o *"Sai do seu saldo"* somam **blocos × adicionais**: o adicional vale para cada reserva do pedido (D6), e para o aluno o saldo é tudo-ou-nada. `409 ESTOQUE_ESGOTADO` mostra a mensagem, **mantém o pedido montado** e relê o que sobrou |
| `/aceite` | `aceite-view` | **SPEC-024** — a tela para onde o `403 ACEITE_PENDENTE` desvia. **Sem barra de navegacao nem voltar**, mesmo desenho de `/primeiro-acesso`: oferecer uma saida que o servidor recusa e convidar a pessoa a bater numa porta trancada. Sem esta tela, ligar o portao seria apagao sem saida (LIM-024d) |
| `/perfil` | `perfil-view` + `foto-de-perfil` + **`minha-carteira`** | **SPEC-018/TASK-003** — a foto do aluno/professor. Alcançável pela `BottomNav` desde 2026-08-29 (antes era pelo ícone no `TopAppBar`). **SPEC-033:** o saldo e o extrato entram aqui, e **não** como quinto item da barra — um item novo para uma tela de dois números seria pagar navegação por conteúdo, e a barra é o recurso mais escasso desta interface. **A carteira tem TRÊS estados, não dois:** `404` é *"você não tem carteira"* e a seção **some em silêncio** (professor e gestor logados caem nele legitimamente); carteira **vazia** é uma carteira, e mostra zero; falha de verdade diz que falhou. Tratar o `404` como erro pintaria "não foi possível carregar" para quem não tem nada a resolver **SPEC-036:** entra a faixa **"complete seu cadastro"** — percentual, o que falta em português, e um formulário só com o que o aluno resolve (`nivelId` é o clube que define). **Não bloqueia nada** (D4): o item 14 do backlog diz "faixa de incentivo NÃO BLOQUEANTE", e há um gate no `back` que fica vermelho se alguém transformar o número em requisito. Some quando o cadastro fecha, em vez de virar selo de parabéns numa tela de 390px. **SPEC-037:** e **`meu-plano`** fecha a tela — o plano contratado, o valor **congelado** (não o preço de hoje: o clube pode ter reajustado, e a matrícula dele não muda) e o link de pagamento já resolvido pela herança. **Sem link não há botão**, porque botão morto é pior que nenhum. As três seções compartilham a mesma guarda de papel, e há caso para cada uma — a primeira a entrar sem prova seria a que quebraria **SPEC-046:** e **`minhas-reposicoes`** entra depois do plano — a ordem é de compromisso: o plano é o contrato, a reposição é o que ele faz com uma aula. **O crédito vem do servidor e a tela não o recalcula** (`faltas válidas − reposições`): a vaga de cada ocorrência depende das faltas dos **outros** alunos, que esta tela não conhece e não deve conhecer. Por isso marcar e desmarcar **recarregam**, em vez de espelhar o estado local. Falta expirada e falta de aula cancelada **continuam na lista, sem botão** — sumir com elas faria o aluno achar que nunca avisou, a mesma decisão da SPEC-031/D14 do outro lado. E o **teto do mês aparece antes da recusa**: *"você tem 1 crédito"* sem dizer que o mês acabou produz um `409` que ele não entende |
| `/reservas` | `reservas-tabs` → **`avisos-de-horario`** (SPEC-074, só na aba "Reservas", e só quando há aviso vivo) + `my-bookings-list` | **SPEC-053 — duas abas, "Reservas" (padrão) e "Anteriores", e o botão "Fazer reserva".** As abas de *contratar* ("Quadras" e "Aula particular") saíram para `/reservas/nova`: aqui ficou o que o aluno **já tem**. `?aba=quadras` e `?aba=aula` respondem **308** para `/reservas/nova?tipo=…` **no servidor, antes de renderizar** (D5) — por isso a página é `async` e lê `searchParams`, e continua componente de servidor; o `Suspense` segue protegendo o `useSearchParams` das abas. O **308 de verdade só existe no servidor Next**: o teste de unidade prova o destino, e o status com `Location` foi medido com `next build` + `next start` (AC-010). O botão aparece **só na aba Reservas**, com e sem reservas (no topo e dentro do vazio); em Anteriores ele seria convite a agir sobre o passado (AC-007). A barra das abas é rotulada "Suas reservas". **Rollback seletivo, não revert:** o 308 fica em cache no navegador, e um revert integral apagaria `/reservas/nova` e mandaria para 404 quem já foi redirecionado — o rollback mantém `reservas/nova/page.tsx` e `nova-reserva.tsx` (ensaiado, SPEC-053/TASK-004). **Histórico:** a SPEC-022 + SPEC-041 + SPEC-047 chegaram a **quatro** abas numa tela só — "Reservas", "Anteriores", "Quadras" e "Aula particular". "Anteriores" nasceu de defeito, não de pedido: a lista não tinha corte temporal, e reserva de semana passada aparecia como se ainda fosse acontecer. O corte é pelo **fim** da ocupação (D-I4) — quem está na quadra às 20h numa reserva de 19h às 21h ainda a vê na primeira aba, e por isso ela não se chama "Próximas". A lista remonta ao trocar de aba (`key`), então a paginação reinicia: declarado em LIM-041g. **SPEC-042** — em `Anteriores` o cartão perde o `Cancelar` e **mantém** o caminho de pagamento: cancelar o que já aconteceu apaga uma cobrança legítima, cobrar quem jogou e não pagou é o fluxo normal. Quem decide se é passado é o servidor (a aba veio de `quando=anteriores`); a tela não recalcula hora, porque recalcular seria a segunda cópia da regra. A aba mora em `?aba=`, não em estado de componente: é o que dá link compartilhável, "voltar" que desfaz a troca, e um endereço que o servidor consegue reconhecer — foi o que permitiu à SPEC-053 redirecionar as abas que saíram. Só o painel ativo é montado — montar os dois faria duas idas à rede para mostrar uma. **SPEC-054/D12:** o cartão lista os adicionais da reserva (`2× Raquete`), nas **duas** abas; reserva sem adicional não ganha linha |
| `/reservas/nova` | `nova-reserva` → `courts-list` (+ `GrupoDeFiltro`) \| **`aula-particular`** | **SPEC-053/D3 — o aluno escolhe o TIPO antes do horário.** Sem `?tipo`, dois cartões: **Quadra** (`?tipo=quadra`, a lista de quadras) e **Aula particular** (`?tipo=aula`, a escolha de professor); qualquer outro valor volta aos cartões **em silêncio**, e com um tipo escolhido há "Trocar o tipo". O tipo mora na **URL** pelo mesmo motivo das abas: é o que os 308 de `/quadras` e das abas antigas precisam como alvo. É o destino do botão "Fazer reserva" e dos atalhos da Home. **SPEC-054/D1 — os nomes dos cartões são os que o clube deu** (`lib/nomes-de-tipo.ts`, lendo `GET /me/company/operacao`); o endereço `?tipo=` não muda, porque é o comportamento. **Toda falha volta como o nome padrão**, sem erro e sem esperar: diferente dos prazos (`capacidade-operacao`, quatro estados), aqui o que está em jogo é o texto de um cartão, e o cartão é o caminho que a pessoa veio buscar. **SPEC-047 (herdado das abas):** as duas escolhas respondem *"o que eu quero marcar?"*, e muda só o que o aluno escolhe. Pela LIM-047e ele **não escolhe a quadra** numa aula particular — quem escolhe é o servidor —, então aula particular não é um passo dentro de "Quadra", é uma porta ao lado. **A tela não decide nada:** não filtra horário, não escolhe quadra e não calcula preço; os três vêm prontos de `GET /me/professores/:id/horarios`, porque marcar aula depende de três fatos (quadra livre, janela do professor, compromisso do professor) e o aluno enxerga **um**. Toda regra repetida aqui seria uma regra para divergir. E `marcarAulaParticular` **não tem campo `valor`** — o DEF-029 esteve em produção permitindo ao aluno marcar a própria aula por R$ 0,01, e aqui a trava é o formato da função, não só a intenção. A **carteira** é a única recusa da criação que a grade não antecipa (LIM-047f): a tela avisa quanto falta e linka `/perfil`, mas **não trava o botão** — o saldo foi lido há um minuto, e travar prenderia quem acabou de receber crédito. **SPEC-054:** a aula particular também tem o passo "Adicionais" depois do horário. A tela **passa a somar** — só os adicionais, nunca a quadra (SPEC-047/D5) —, porque a D6 exige o total antes de confirmar e o aviso de saldo com o preço só da aula diria "cabe" sobre uma aula que a carteira recusa. `marcarAulaParticular` ganhou `adicionais` e **continua sem `valor`** |

## 4. Estado

| Tipo | Onde vive |
|---|---|
| Server state | `useState` + `useEffect` por tela, via `lib/api-client.ts` |
| Sessão | `lib/auth-storage.ts` — access token em `localStorage`; refresh em cookie `httpOnly` |
| UI local | `useState` no componente |
| **Aba e vista** | **na URL** (`?aba=`, `?vista=`), não em `useState` |
| Global | **não existe** |

**SPEC-041/Fase B — a URL ganhou um terceiro morador, e o filtro de reservas
carrega o valor da API** (`?status=cancelado`), não um apelido em português. O
rótulo do botão é que traduz. Uma camada de tradução seria um segundo
vocabulário para o mesmo conceito, e não cobriria "Todas", que é a **ausência**
do parâmetro — são quatro estados de tela para três valores de API.

**O `GrupoDeFiltro` saiu de dentro do `courts-list`** e virou arquivo próprio
quando as reservas precisaram dele. Mesmo caminho do `abas-na-url` na SPEC-023,
e pelo mesmo motivo: a cópia é sempre a que fica velha.

**A URL guarda o que a pessoa escolheu ver.** `abas-na-url.tsx` (aba) e o
`useVista` de `my-classes-list.tsx` (lista × semana) seguem a mesma regra: link
compartilhável, "voltar" que desfaz a troca, valor desconhecido cai no padrão
em silêncio, e **o padrão sai do endereço** — endereço limpo é o que a pessoa
copia.

**Isto passou a ser verdade em 2026-09-02, e antes disso era mentira.**
`abas-na-url.tsx` reconstruía a URL **só** com `aba` — o ramo do padrão era o
pior, empurrando o caminho pelado —, e o `useVista` era o único dos dois que
preservava. Em `/minhas-aulas`, o `?vista=semana` sumia ao trocar de aba, em
produção.

Pior que o defeito: **o comentário do `useVista` creditava o cuidado à barra de
abas**, e esta planta repetia. Achado pela validação cruzada da SPEC-041,
consertado na TASK-B3 — helper, comentário e esta frase no mesmo ciclo, com
`abas-na-url.test.tsx`, que **não existia** apesar de o helper governar três
telas. A prova do ramo padrão é a que ninguém tinha.

**Data e hora saem de `lib/fuso.ts`, nunca de `new Date().toISOString()`**
(DEF-020). `toISOString()` converte para UTC, e no Brasil isso já é o dia
seguinte das 21h à meia-noite — a tela de reserva pulava o dia de hoje. O
gate `lib/fuso.test.ts` varre `src/` e recusa quem calcular "hoje" fora
daquele arquivo.

**Nada de global**, mesma situação do `admin`. O token fica em
`localStorage` (`auth-storage.ts`); o refresh token é cookie `httpOnly` que
o JS nunca lê.

**PWA (SPEC-050):** `register-service-worker.tsx` + `app/manifest.ts` +
**`convite-de-instalacao.tsx`**, com a decisão em `lib/instalacao-pwa.ts`
(mesma separação de `capacidade-operacao.ts` × `aviso-de-prazo.tsx`: decisão se
testa sem DOM).

Até a SPEC-050 existiam só os dois primeiros, e **o app era instalável sem
nunca convidar ninguém** — não havia `beforeinstallprompt` em nenhum
repositório, então a instalação dependia do banner automático do navegador, que
é de uma vez só por design e **inexistente no iOS**.

Três coisas aqui não são óbvias e cada uma tem teste:

1. **O evento é capturado antes da hidratação.** Um `<Script
   strategy="beforeInteractive">` no `layout.tsx` guarda o
   `beforeinstallprompt` em `window.__playckEventoDeInstalacao`, porque o
   Chrome o dispara logo após o `load` — normalmente **antes** de um
   `useEffect` assinar. Um componente que só assinasse no efeito não apareceria
   numa carga fria, reproduzindo o defeito original com o código novo no lugar.
2. **Dois modos.** `botao` no Chromium (diálogo nativo); `instrucao` no iOS,
   onde o evento não existe e a única saída é ensinar Compartilhar →
   "Adicionar à Tela de Início". A detecção de iOS testa `Macintosh` +
   `maxTouchPoints > 1`, porque o iPad se anuncia como Mac desde o iPadOS 13.
3. **Dispensar vale 15 dias** (`playck_instalacao_dispensada_em`), e a chave
   **não** leva o prefixo `playck_cliente_` de propósito: aquelas saem no
   `clearAccessToken()`, e dispensa que morre no logout faz o convite voltar a
   cada sessão. Há teste travando isso.

**Os ícones são gerados, não editados.** `harness/pwa/gerar-icones.mjs` (raiz
da governança) refaz os 15 arquivos dos 3 apps a partir de
`public/playck-logo.png`, achatando o alfa sobre `--color-court-dark` e
gerando o par `maskable` a 76% (a *safe zone* é o círculo de 80% de diâmetro; o
logo é circular, então não vale a conta do quadrado inscrito). Antes da
SPEC-050 os ícones eram o logo **com canal alfa** — fundo preto no iOS, fundo
a critério do launcher no Android, e nenhum `maskable`.

**Ressalva conhecida (não é defeito desta camada):** `start_url` é `/`, que
redireciona para `/login`, e o login **não reconhece quem já tem token** (não
há `middleware.ts`; `app/login/page.tsx` renderiza o formulário sem condição).
O app instalado abre no formulário de login para quem já está logado. Fora do
escopo da SPEC-050 de propósito — mexe em fluxo de autenticação.

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

**O gap fechou na SPEC-067 (2026-09-22).** O job **`contrato`** do CI compara
este arquivo com o contrato do `back` **fixado por SHA** em
`src/lib/contrato.lock.json`, buscado por `raw` imutável — em poly-repo não há
`../Back` no checkout (ADR-001). Ele gera num temporário e **não escreve** no
repositório, e o passo exige a linha `OK ... em dia`, não só o exit 0: um
script vazio também sai 0, e isso aconteceu ao replicar o gate.

Duas perguntas, dois mecanismos. O job responde *"os tipos correspondem ao
contrato fixado?"* e **reprova a PR**. O `contrato.yml` agendado responde *"o
contrato fixado ainda é o atual?"* e **abre uma PR-espelho** (`contrato/sync`)
em vez de reprovar PR alheia — 82 dos 277 commits do `back` em 30 dias mexeram
no contrato.

**Ressalva:** até o ruleset exigir `contrato` (SPEC-067/TASK-004, passo de
painel), o job aparece na PR mas **não bloqueia** o merge.

## 7. Requisitos de plataforma

Web responsivo, português do Brasil, tema claro. Sem offline (o service
worker do `cliente` registra, mas não há estratégia de cache de dados) —
**ele recebe push desde a SPEC-062**, ver a seção 11.
Deploy: Netlify (plano Personal desde 2026-08-22, ADR-014).

**Build pulado quando o commit não muda o site (2026-09-15).** Cada deploy de
produção custa **15 créditos**, qualquer que seja o tamanho do commit; entre 8 e
15/09, 26 merges nos três frontends gastaram ~351 dos 500. O `netlify.toml` chama
`scripts/netlify-ignore.mjs`, que **cancela o build (exit 0) só se todo arquivo
mudado** for documentação fora de `public/`, teste, `src/lib/api-types.ts` (só
tipos), o `src/lib/contrato.lock.json` (SPEC-067), CI, lint ou a própria regra. Sem os dois commits, com o mesmo commit
(*Trigger deploy* manual) ou com o `git diff` falhando, **constrói**. Aplicado ao
histórico real da semana, pula exatamente os 6 deploys que não mudavam o site e
constrói os outros 20. **O arquivo é idêntico nos três frontends**, sem gate de
sincronia (ADR-001). Mudou o `netlify.toml` ou uma variável no painel? *Trigger
deploy*.

## 8. Regras de camada (com gate)

| Regra | Gate |
|---|---|
| `page.tsx` fina; lógica em componente cliente | revisão |
| Todo acesso autenticado por `authFetch` | busca por `fetch(` fora de `lib/` — **0 violações em 2026-08-22** |
| `api-types.ts` nunca editado à mão, e em dia com o contrato fixado | job **`contrato`** do CI (SPEC-067): regenera do `back@<sha>` do `contrato.lock.json` e compara — reprova a PR. **Já é obrigatório** — conferido pela API em 2026-09-24: `required_status_checks` do `main` traz `build` **e** `contrato`, com `strict_required_status_checks_policy`. A frase anterior, *"só depois da TASK-004"*, ficou velha |
| Sem estado global sem ADR | busca por libs de estado no CI seria o gate — **hoje não existe** |
| **Fixture de tela é tipada pelo contrato (`MyClass`, `AulaAnterior`, …), nunca objeto literal solto nem `unknown[]`.** Fixture sem tipo é o que deixa um campo obrigatório novo passar despercebido: `naoRealizada` entrou no contrato, duas telas ganharam ramo por causa dele, e **as provas das duas ficavam verdes se o ramo sumisse** — o `tsc` não tinha como cobrar um campo de um `Record<string, unknown>` | **não existe gate automático** — as fixtures de `home-view.test.tsx`, `aulas-anteriores.test.tsx`, `my-classes-list.test.tsx` e `semana-do-aluno.test.tsx` estão tipadas; o `tsc` passa a ser o gate a partir daí, para o próximo campo. Um gate que varra `src/**/*.test.tsx` atrás de fixture sem anotação ainda não foi escrito |
| **O que a tela afirma sobre o servidor vale sobre o que FOI ENVIADO, não sobre o que está na tela quando a resposta chega.** Foi "Salvo" aparecendo ao lado da marca que o servidor nunca recebeu, na chamada | a prova era `chamada-nao-houve.test.tsx`, "o rascunho durante o salvamento" — **saiu com o rascunho** (SPEC-076: a chamada não tem mais rascunho). A regra vale para a próxima tela que mantiver controle vivo durante a requisição, e a prova tem de ser com **promessa controlada**: `mockResolvedValue` achata o tempo assíncrono |
| `typecheck`, `lint`, `test`, `build` verdes | CI (GitHub Actions) a cada push |
| `comprimir-imagem.ts` idêntico entre `admin` e `cliente` | **não existe gate** — poly-repo sem pacote compartilhado (ADR-001). Custo declarado, ver a seção da compressão |
| **Alegação VISUAL se prova em navegador, nunca em jsdom** (SPEC-072/D2). Campo presente no texto não é campo visível na tela: `overflow:hidden` num ancestral, conteúdo atrás do botão, largura insuficiente e rolagem horizontal deixam a asserção de texto verde com a queixa de pé | `pnpm run test:navegador` (job `navegador`). O detector do corte é geométrico e exato — elemento cortado por `text-overflow` tem `scrollWidth` **maior** que `clientWidth`. **O job não é obrigatório no ruleset**, e `src/lib/prova-visual.test.ts` guarda a existência dele |
| **Aula e crédito de reposição se casam por `ocupacaoId`, nunca por texto de exibição** (SPEC-072/INV-072c). `turmaNome + data + horaInicio` funciona no teste e casa o crédito errado em produção: o schema não torna o nome da turma único | `credito-utilizavel.test.ts` — o caso das duas faltas indistinguíveis por texto, e a asserção **nomeia** o `faltaId`. Sabotagem: casar pela primeira falta derruba 3 casos |
| **Filtro de nível é EXIBIÇÃO, e o servidor não recusa** (SPEC-072/INV-072a). Nível nunca foi autoridade | **duas metades em duas camadas:** no Cliente, `turmas-do-clube.test.tsx`; no **Back**, `test/fit/spec-072-credito-e-nivel.fit-spec.ts`, com `POST` real. A metade do Cliente usa o serviço mockado e **não diria nada** sobre o servidor |
| **Recusa do servidor nunca vira silêncio na tela** (SPEC-072/INV-072f), e o mecanismo é por **CLASSE**: uma lista de códigos conhecidos não alcança resposta sem `code`, sem corpo, com código novo, nem o que o back acrescentar depois | `my-classes-list.test.tsx`. Sabotagem que prova o desenho: trocar a classe por uma lista dos cinco códigos nomeados deixa **os cinco verdes** e derruba **só** o genérico |

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

> **E foi essa tolerância que permitiu o rollout do `AULA_HOJE` (SPEC-031).**
> Nos passos 3 e 4 o código que a rota devolve TROCOU — `AULA_HOJE` saiu,
> `PRAZO_DE_CANCELAMENTO` entrou — e **esta tela não mudou uma linha**. Há
> teste do contrapositivo: um código que ela nunca viu também mostra a
> mensagem. Se ela tivesse lista de códigos conhecidos, o passo 3 teria
> quebrado clube em produção.

### A SPEC-031 no Cliente: capability, prazo, falta e modo histórico

Quatro coisas entraram em 2026-09-06, todas em produção.

**1. A classificação em QUATRO** (`src/lib/capacidade-operacao.ts`). Cinco
repositórios, cinco deploys independentes, e **nenhum CI sobe o outro lado** —
então a resposta de `GET /me/company/operacao` é classificada em:

| O que veio | Estado | A tela |
|---|---|---|
| `200` **com** o campo | `disponivel` | mostra a feature |
| `404`, ou `200` **sem** o campo | `ausente` | esconde, em silêncio |
| `401`/`403` | `negado` | **mostra erro** |
| `500`, `429`, timeout, rede, corpo ilegível | `falhou` | falha **recuperável**, com retry |

As duas últimas linhas existem porque alguém erraria. **`403` não é "back
antigo"**: engolir faria a feature sumir em produção sem sinal nenhum. **`500`
também não**, e essa é a mais fácil de errar — `catch { return ausente }`
disfarça indisponibilidade de "versão antiga". **Ausência é uma conclusão**, e
só o `404` e o corpo sem o campo a autorizam.

Medido: com o atalho `catch { return ausente }`, **8 dos 16** casos caem.

**2. O aviso de prazo** (`aviso-de-prazo.tsx`), na lista de turmas. Sem ele a
regra só apareceria como `409` **depois** do toque — o app ensinaria a regra
por erro.

**3. O botão de avisar falta**, no card de cada aula em "Próximas". Fica ali e
não em tela nova porque `GET /me/classes` já devolve a lista de **ocorrências**
do aluno, não de turmas. `avisou()` compara `=== true`, não o valor cru: um
back anterior responde `200` **sem** o campo, e ausência é lida como "não
avisou" — o estado seguro.

**4. O modo histórico da chamada** (AC-019b). A aula cancelada virou
alcançável, e a tela entra em somente-leitura. O critério **não** é "não
oferece salvar": é a ausência de **toda** ação mutadora, incluindo os textos
que mandavam *"marque os alunos abaixo e salve"* — instrução impossível numa
tela com os botões desabilitados.

A prova mede **rede**, não aparência. Desde a SPEC-076 a tela inteira é
leitura, e a prova virou a da classe (AC-017): nos seis estados, com o
`fetch` global espionado, todo botão visível é clicado e nenhum pedido
mutador sai para fora de `…/nao-houve`.

### A barra de baixo conhece o papel (DEF-011, 2026-08-26)

`bottom-nav.tsx` desenha **duas** barras: a do aluno e a do professor
(`/minhas-turmas`, rotulado **"Agenda"** desde a SPEC-052, e `/perfil`).

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

## 10. Avisos do clube — push (SPEC-062/TASK-004)

**O que existe:** `public/sw.js` (antes com três linhas, só para instalabilidade)
trata `push`, `notificationclick` e `pushsubscriptionchange`;
`src/lib/push-reconciliacao.ts` (decisão, sem navegador),
`src/lib/push-do-navegador.ts` (`PushManager` + API), `src/lib/sair.ts` e a
seção `AvisosDoClube` no perfil.

**A fronteira, e por que ela existe.** A decisão — quando desinscrever, quando
desistir — mora num módulo que não conhece navegador nem rede, atrás de uma
interface de quatro métodos (`PortaDoNavegador`). É o que torna a posse do
aparelho **provável sem um aparelho**: um teste contra `PushManager` real
provaria o navegador, não a nossa regra.

**Três coisas que não são preferência:**

| Regra | Por quê |
|---|---|
| `showNotification()` em **todo** push, inclusive no `catch` do corpo quebrado | o WebKit **revoga a assinatura** de quem recebe e não mostra. Push silencioso não existe; existe push que custa a assinatura |
| `requestPermission()` **só dentro de um gesto** | pedir na abertura leva "bloquear", e bloqueio não se desfaz sem ir às configurações do sistema — caminho sem volta criado por um pedido que a pessoa não esperava |
| o interruptor tem **quatro** estados, e `erro` é um deles | ele é a única coisa que a pessoa tem para saber se vai receber aviso. Nunca `ligado` por otimismo |

**Como se pergunta "de quem é esta assinatura?":** não há rota de consulta, e
não precisa haver — **o próprio `POST /push/assinatura` é a pergunta.** `204`
responde "é sua"; `409 ENDPOINT_EM_USO` responde "é de outra conta", e aí o app
desinscreve, assina de novo e registra. Uma tentativa só: se o serviço devolver
o mesmo `endpoint`, para (LIM-062j). Uma rota que dissesse de quem é um
`endpoint` seria oráculo de assinaturas alheias.

**Três gatilhos de reconciliação**, e o terceiro fecha um buraco que a
validação independente achou: montagem, evento `online`, e `BroadcastChannel`.
A assinatura é **uma por service worker**, então o logout numa aba tira o push
de todas — e a aba que continua **visível** nunca recebe `visibilitychange`.

**`sairDaConta()` existe para não separar duas metades de uma decisão.**
Desinscrever e sair andam juntos; espalhados pelos dois lugares que fazem
logout, é questão de tempo até alguém aplicar um sem o outro. Não fica dentro
do `logout()` porque fecharia ciclo de import com `push-do-navegador`.

| Regra de camada | Gate |
|---|---|
| credencial de assinatura (`endpoint`, `p256dh`, `auth`) **nunca** em log ou resposta | revisão; no `back` há teste de serialização |
| a decisão de push não importa `PushManager` | `push-reconciliacao.ts` não tem `navigator` — **busca no CI seria o gate, hoje não existe** |
| `requestPermission()` só em manipulador de evento | **prova de tela**: `avisos-do-clube.test.tsx`, "montar a tela NÃO chama requestPermission" |

**LIM-062c — no iPhone, push exige o app instalado** na tela de início (iOS
16.4+). A tela detecta e **explica**, em vez de mostrar um interruptor que
nunca liga. A detecção reusa `ehIOS()` de `instalacao-pwa.ts`, que trata o iPad
anunciando-se como `Macintosh` desde o iPadOS 13 — uma segunda detecção aqui
divergiria, e a que diverge é sempre a mais nova.


### A caixa de avisos, e o sino que leva a ela (SPEC-065)

O push entrega **ou perde**: a SPEC-062 declarava, em LIM-062b, que *"sem
assinatura viva, o aviso se perde; nao ha caixa de entrada"*. Era um limite
barato enquanto o clube nao mandava nada, e deixou de ser quando a SPEC-063
pos os treze gestos no ar.

| O que | Onde |
|---|---|
| a tela | `/avisos` -> `components/caixa-de-avisos.tsx` |
| o sino, com contagem | `components/sino-de-avisos.tsx`, no topo |
| as travas contra rajada | `lib/contador-de-avisos.ts` |
| o gancho do push | `public/sw.js`, mensagem `playck:aviso-novo` |

**Abrir a caixa marca tudo como lido**, e nao ha estado por item: a
alternativa nao tem resposta boa (*o que conta como ter lido -- aparecer na
tela? ficar dois segundos? tocar?*), e marcacao arbitraria e pior que
marcacao grossa e previsivel.

#### O contador NAO faz polling, e as tres travas explicam por que ele nao precisa

Ele sobe em dois momentos: a abertura do app, e a chegada de um push. O
segundo era um gancho que **nao existia** -- o `sw.js` mostrava a notificacao
e as abas so descobriam na proxima abertura.

E rajada e o caso **normal**: um gesto que avisa vinte alunos sao vinte
pushes; tres abas abertas dariam sessenta consultas. Tres travas, uma linha
cada:

| Trava | Corta |
|---|---|
| so a aba **visivel** consulta | o numero de abas |
| **debounce** de 2 s -- evento novo REAGENDA, nao soma | a rajada |
| **single-flight** -- com pedido em voo, o proximo nao comeca | a corrida |

`P x A` vira ~1.

**O push de teste nao mexe no contador**: ele e diagnostico do canal, nao
recado do clube, e a caixa nao o mostra. Sem esse `if`, o numero subiria por
um aviso que a pessoa nao acharia ao abrir.

**A aba que marca tudo como lido posta `playck:avisos-lidos`**, e as outras
zeram **sem consultar**. Sem isso, uma aba marcaria lido e a outra seguiria
mostrando numero positivo -- o caso que derrubou a primeira versao da spec,
quando eu afirmei que a contagem "so erra para menos" sem testar a direcao
contraria.

#### O que e duplicado, e o custo declarado

`caixa-de-avisos.tsx`, `sino-de-avisos.tsx`, `contador-de-avisos.ts` e o teste
dele sao **identicos byte a byte** nos dois fronts -- poly-repo sem pacote
compartilhado (ADR-001), o mesmo custo do `netlify-ignore.mjs` e do
`gates-de-push.mjs`. **Nao ha gate de sincronia**: mudanca num tem de ser
copiada no outro a mao.

**Uma armadilha que so apareceu rodando:** o primeiro rascunho usava
`--color-on-surface-variant`, token do Admin que **nao existe no Cliente**. O
`cores.test.ts` pegou. *Componente identico nos dois fronts exige token que
exista nos dois* -- e o que existe e `--color-text-secondary`.

**O sino do Cliente tinha sido RETIRADO, e voltou.** Ele saiu na revisao de
2026-08-29 com uma razao do proprio Israel -- *"icone que ignora o toque ensina
a pessoa a nao tocar nos outros"* -- e havia um **teste travando a ausencia**.

**A regra nao mudou; a premissa caiu.** O teste encodava um estado do mundo
(*"nao ha o que notificar"*), nao um principio, e foi trocado por um que afirma
o contrario: o sino existe **e tem destino**. Teste assim tem de mudar quando o
mundo muda, em vez de congela-lo.

## 11. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | ~~`api-types.ts` pode ficar stale~~ — **fechado por completo**: o job `contrato` compara com o contrato fixado por SHA, o `contrato.yml` abre PR quando o `back` anda, e o ruleset **já exige** o job (conferido pela API em 2026-09-24). *O "resta" que estava aqui caiu.* | — |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
| 5 | **A PR-espelho `contrato/sync` não fica mergeável sozinha.** O `workflow_dispatch` que o `sincronizar-contrato.mjs` dispara cria os check runs no **commit**, mas eles **não entram no rollup da PR** — e é o rollup que o ruleset lê. Medido em 2026-09-24 nos três frontends: nenhuma `contrato/sync` jamais foi mergeada. O contorno é um push de **usuário** na mesma branch, que dispara `synchronize`. Conserto: PAT no script, ou outro gatilho | **Alta** |
| 6 | **O painel de escolha dentro da tela de Aulas não tem prova de geometria** (SPEC-072/`LIM-072g`). A `AC-006` cobre a tela de oportunidades; o painel da `TASK-005` é uma **segunda** superfície com a mesma informação a 320px. Ele nasceu com as classes que a TASK-004 provou, mas **semelhança de código não é medição** | Média |
| 7 | **O job `navegador` não é obrigatório.** O ruleset exige `build` e `contrato`; um `navegador` vermelho não bloqueia merge. `prova-visual.test.ts` guarda a existência do job, não o veredito | Média |
