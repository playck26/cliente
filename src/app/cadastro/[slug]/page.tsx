import { AuthShell } from "@/components/auth-shell";
import { CadastroPublicoForm } from "@/components/cadastro-publico-form";

export default async function CadastroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AuthShell
      titulo="Criar conta"
      descricao="Cadastre-se para ver suas aulas e reservar quadra."
    >
      <CadastroPublicoForm slug={slug} />
    </AuthShell>
  );
}
