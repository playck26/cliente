import type { Papel } from "@/lib/api-client";

const ACCESS_TOKEN_KEY = "playck_cliente_access_token";

/**
 * O papel de quem está logado, guardado **para navegação, nunca para
 * autorização** — a mesma distinção que `rota-inicial.ts` declara. Quem
 * decide o que cada papel pode ler é o servidor (INV-012); adulterar este
 * valor no navegador dá tela errada, jamais dado.
 *
 * **Existe por causa do flash da barra de baixo.** Sem ele, o `BottomNav`
 * só descobre o papel quando o `getMe()` volta, e até lá ou desenha a barra
 * errada (o professor via a do aluno por um segundo) ou não desenha nada.
 * O papel já é conhecido no login — guardá-lo é o que torna a primeira
 * pintura correta.
 */
const PAPEL_KEY = "playck_cliente_papel";

const PAPEIS: readonly Papel[] = [
  "super_admin",
  "company_admin",
  "aluno",
  "professor",
];

export function saveAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function savePapel(papel: Papel): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAPEL_KEY, papel);
}

/**
 * **Valida antes de devolver.** O valor vem do `localStorage`, que é do
 * navegador e não nosso: qualquer string pode estar lá. Devolver
 * `"banana" as Papel` faria o `BottomNav` cair no ramo do aluno por
 * acidente, em vez de admitir que não sabe.
 */
export function getPapel(): Papel | null {
  if (typeof window === "undefined") return null;
  const bruto = window.localStorage.getItem(PAPEL_KEY);
  return PAPEIS.includes(bruto as Papel) ? (bruto as Papel) : null;
}

/**
 * **Os dois saem juntos, sempre.** Token sem papel deixaria a barra
 * adivinhando; papel sem token é uma sobra que a próxima pessoa a usar
 * este navegador herdaria.
 */
export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(PAPEL_KEY);
}
