/**
 * Centavos em reais, num lugar só.
 *
 * **Nasceu duplicado.** `minha-carteira.tsx` tinha o seu, e a SPEC-039 ia
 * escrever o segundo em `my-bookings-list.tsx` — duas funções que formatam
 * dinheiro divergem no primeiro ajuste, e a divergência aparece como dois
 * valores diferentes para a mesma quantia em duas telas do mesmo app.
 *
 * O servidor manda **centavos inteiros** em toda a carteira (SPEC-033/D2):
 * dividir por 100 aqui é a única conversão, e ela não acontece em lugar
 * nenhum antes.
 */
export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
