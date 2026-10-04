import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AtivarContaForm } from "@/components/ativar-conta-form";

/**
 * SPEC-083 (D11) — **o token está no caminho, e o caminho não sai daqui.**
 *
 * Com a política padrão do navegador, um pedido a outra origem leva só a
 * origem no `Referer`, mas um pedido à mesma origem leva o endereço inteiro —
 * e o endereço inteiro é o link que define a senha. `no-referrer` vale para o
 * documento todo: nenhum pedido feito a partir desta tela conta de onde veio.
 * As duas chamadas da ativação repetem a regra no próprio `fetch`
 * (`api-client.ts`).
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default async function AtivarContaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell
      titulo="Crie sua senha"
      descricao="Você recebeu o convite por e-mail."
    >
      <AtivarContaForm token={token} />
    </AuthShell>
  );
}
