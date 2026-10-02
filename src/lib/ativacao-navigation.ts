/**
 * SPEC-084 (D7, I4) — **o protocolo entre a ativação de conta e o login.**
 *
 * Quando a pessoa ativa a conta pelo link do e-mail (SPEC-083), a página de
 * ativação a manda para `LOGIN_APOS_ATIVACAO`, e o login mostra "Conta
 * ativada. Entre com seu e-mail e senha.". As duas pontas leem DAQUI:
 *
 * - a SPEC-084 é dona desta constante, da leitura (`chegouDaAtivacao`) e do
 *   aviso (`aviso-de-ativacao.tsx`);
 * - a SPEC-083 é dona do emissor, e **importa** `LOGIN_APOS_ATIVACAO` — nunca
 *   escreve o endereço à mão.
 *
 * Por isso o literal da chave só existe neste arquivo: o
 * `ativacao-navigation.test.ts` varre `src/` e reprova uma segunda cópia. A
 * varredura **não** pega um emissor que mande para `/login` puro, sem a
 * constante; esse caminho é do teste de navegação cruzada da SPEC-083
 * (`COORDENACAO-083-084.md`).
 *
 * O parâmetro é só apresentação: ele muda uma frase na tela e não autoriza,
 * não pula etapa e não grava nada.
 */
export const CHAVE_DE_ATIVACAO = "ativado";
export const VALOR_DE_ATIVACAO = "1";
export const LOGIN_APOS_ATIVACAO = `/login?${CHAVE_DE_ATIVACAO}=${VALOR_DE_ATIVACAO}`;

/** `true` só para o valor exato do protocolo: `?ativado=0` ou `=sim` não contam. */
export function chegouDaAtivacao(busca: string): boolean {
  return new URLSearchParams(busca).get(CHAVE_DE_ATIVACAO) === VALOR_DE_ATIVACAO;
}
