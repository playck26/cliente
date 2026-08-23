# ARCHITECTURE — `cliente` (PlayCK)

**Fonte: análise direta do código.** Data: 2026-08-22.

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
| `/login` | `login-form` | entrada; leva a `/primeiro-acesso` se a senha for temporária |
| `/primeiro-acesso` | `primeiro-acesso-form` | troca obrigatória da senha temporária (INV-008) |
| `/cadastro/[slug]` | `cadastro-publico-form` | auto-cadastro pelo link público da empresa |
| `/convite/[token]` | `aceitar-convite-form` | aceite de convite |
| `/home` | `home-view` | próximas aulas e atalhos |
| `/minhas-aulas` | `my-classes-list` | aulas de turma (view-only, GAP-008) |
| `/minhas-turmas` | `minhas-turmas-view` | **app do professor** (SPEC-013): a grade dele, sem `BottomNav` — barra com um item só é decoração |
| `/minhas-turmas/[id]` | `minha-turma-detalhe` | quem está na turma e as aulas dos últimos 30 dias |
| `/chamada/[ocupacaoId]` | `chamada-view` | **a chamada** (SPEC-014). Desenhada para uso em quadra: 3 estados visíveis, 1 toque cada, salvar explícito e barra fixa |
| `/quadras` (+ `[id]`) | `courts-list`, `court-booking` | reserva |
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

**PWA:** `register-service-worker.tsx` + manifest. Ícones ainda são
placeholder sólido — falta o arquivo de marca oficial (ver Gaps).

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

## 9. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | **`api-types.ts` pode ficar stale**: o CI não compara com o `openapi.json` do `back`. Já aconteceu — o `sadmin` acumulou 1.461 linhas de diferença | Média |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
| 5 | Ícones e paleta ainda derivados de inferência, sem arquivo de marca oficial | Baixa |
