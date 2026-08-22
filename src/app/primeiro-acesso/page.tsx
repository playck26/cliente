import { AuthShell } from "@/components/auth-shell";
import { PrimeiroAcessoForm } from "@/components/primeiro-acesso-form";

export default function PrimeiroAcessoPage() {
  return (
    <AuthShell
      titulo="Crie sua senha"
      descricao="Você entrou com uma senha temporária. Escolha a sua para continuar."
    >
      <PrimeiroAcessoForm />
    </AuthShell>
  );
}
