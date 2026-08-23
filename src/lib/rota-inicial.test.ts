import { describe, expect, it } from "vitest";
import { rotaInicial } from "./rota-inicial";

// SPEC-013 — são três portas de entrada (login, primeiro acesso, aceite de
// convite). Um papel esquecido em uma delas manda a pessoa para uma tela
// que o servidor recusa, e ela vê um erro seco logo depois de fazer o que o
// sistema exigiu. Por isso a decisão mora num lugar só, e é testada.
describe("rotaInicial", () => {
  it("professor entra na grade dele, não na Home do aluno", () => {
    expect(rotaInicial("professor")).toBe("/minhas-turmas");
  });

  it("aluno continua na Home", () => {
    expect(rotaInicial("aluno")).toBe("/home");
  });

  // company_admin e super_admin não usam este app — têm os próprios. Se um
  // deles chegar aqui, a Home é o destino menos surpreendente, e o servidor
  // recusa o que ele não puder ler.
  it("papel de gestão não quebra a navegação", () => {
    expect(rotaInicial("company_admin")).toBe("/home");
    expect(rotaInicial("super_admin")).toBe("/home");
  });
});
