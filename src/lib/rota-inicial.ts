import type { Papel } from "@/lib/api-client";

/**
 * SPEC-013 — para onde cada papel vai depois de autenticar.
 *
 * Existe como função, e não espalhado em `router.push` pelos formulários,
 * porque são três portas de entrada (login, primeiro acesso, aceite de
 * convite) e um papel novo esquecido em uma delas manda a pessoa para uma
 * tela que o servidor recusa — erro seco no lugar do app dela.
 *
 * Isto é navegação, não autorização: quem decide o que cada papel pode ler
 * é o servidor (INV-012). Errar aqui dá tela errada, nunca dado vazado.
 */
export function rotaInicial(papel: Papel): string {
  return papel === "professor" ? "/minhas-turmas" : "/home";
}
