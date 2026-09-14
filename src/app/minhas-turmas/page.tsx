import { TelaDoProfessor } from "@/components/tela-do-professor";

/**
 * SPEC-052/D2 — a área do professor é **uma** tela: a agenda, com o índice das
 * turmas embaixo. As abas da SPEC-026 saíram.
 *
 * `?aba=agenda` e `?aba=turmas` **continuam abrindo esta tela** — ela ignora o
 * parâmetro. Nenhum código monta mais esses links, mas um favorito salvo não
 * pode virar erro.
 *
 * **A rota continua `/minhas-turmas`** (LIM-052b): o redirecionamento pós-login
 * (`rota-inicial.ts`) e o aceite de termo apontam para ela, e o professor lê
 * "Agenda" no rodapé, não na URL.
 *
 * Sem `Suspense`: ele existia porque as abas liam `useSearchParams`, e nada
 * aqui lê mais.
 */
export default function MinhasTurmasPage() {
  return <TelaDoProfessor />;
}
