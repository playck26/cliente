import { logout } from "./api-client";
import { desinscreverNoLogout } from "./push-do-navegador";

/**
 * SPEC-062/D2a — **sair da conta, incluindo o aparelho.**
 *
 * ## Por que não dentro do `logout()`
 *
 * `push-do-navegador.ts` importa o `api-client` (precisa do `authFetch` para o
 * `DELETE /push/assinatura`). Pôr a chamada dentro do `logout()` fecharia um
 * ciclo de import entre os dois módulos — que o ESM até tolera, mas que
 * quebra no dia em que alguém mover uma chamada para o corpo do módulo.
 *
 * ## Por que não nos dois lugares que chamam `logout()`
 *
 * Porque são dois, e viram três. Desinscrever e sair são **duas metades de uma
 * decisão só**; separadas, é questão de tempo até alguém aplicar uma sem a
 * outra — que é o mesmo raciocínio do `@Throttle` + contagem por IP no `back`.
 *
 * ## A ordem importa
 *
 * Desinscrever **antes**: depois do `POST /auth/logout` o token já não serve
 * para o `DELETE /push/assinatura`, e a linha ficaria no banco até o primeiro
 * `410`.
 *
 * **É melhor-esforço, e está declarado.** A garantia de posse do aparelho não
 * mora aqui — mora na reconciliação, que roda na abertura do app (D2a-1).
 * Isto é a cortesia de liberar o aparelho na saída, e falha em silêncio de
 * propósito: um "Sair" que trava por causa de push seria pior que o problema
 * que resolve.
 */
export async function sairDaConta(): Promise<void> {
  await desinscreverNoLogout();
  await logout();
}
