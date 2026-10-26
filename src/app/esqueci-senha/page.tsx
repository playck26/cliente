import { AuthShell } from "@/components/auth-shell";
import { EsqueciSenhaForm } from "@/components/esqueci-senha-form";

/**
 * SPEC-090 (D9) — **pedir o link para redefinir a senha.** Aonde o
 * "Esqueceu a senha?" do login leva. A resposta é sempre a mesma frase, com
 * conta ou sem conta (D1).
 */
export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      titulo="Esqueceu a senha?"
      descricao="Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova."
    >
      <EsqueciSenhaForm />
    </AuthShell>
  );
}
