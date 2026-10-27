/**
 * **A sessão desta aba tem número (PRD-090-R4-01).** Toda resposta que grava
 * token — renovação, troca de senha do primeiro acesso, login — leva o
 * número da sessão em que foi pedida, e é descartada se ele mudou. As rodadas
 * R2 a R4 acharam, uma a uma, entradas que gravavam o token de uma sessão
 * anterior depois que outra já estava na tela; o número fecha a família em
 * vez do próximo caso. Muda no login e no "Sair" desta aba, na sessão
 * encerrada e na troca de conta percebida.
 *
 * **Módulo próprio, e não dentro do `api-client`**, porque o "Sair"
 * (`sair.ts`) precisa do número ANTES da primeira espera do gesto
 * (PRD-090-R5-01), e há testes que trocam o `api-client` inteiro por um
 * dublê: o número não pode sumir junto com ele.
 */
let epocaDaSessao = 0;

export function epocaAtual(): number {
  return epocaDaSessao;
}

/** Começa outra sessão nesta aba: o que foi pedido antes não vale mais. */
export function abrirEpoca(): void {
  epocaDaSessao++;
}
