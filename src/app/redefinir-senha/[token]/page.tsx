import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RedefinirSenhaForm } from "@/components/redefinir-senha-form";

/**
 * SPEC-090 (D9) — **o token está no caminho, e o caminho não sai daqui.**
 *
 * A mesma regra da ativação (`/ativar/[token]`, SPEC-083): com a política
 * padrão do navegador, um pedido à mesma origem leva o endereço inteiro no
 * `Referer` — e o endereço inteiro é o link que redefine a senha.
 * `no-referrer` vale para o documento todo, e as duas chamadas da
 * redefinição repetem a regra no próprio `fetch` (`api-client.ts`).
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell
      titulo="Redefinir senha"
      descricao="Crie uma senha nova para entrar no PlayCK."
    >
      <RedefinirSenhaForm token={token} />
    </AuthShell>
  );
}
