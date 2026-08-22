import { AuthShell } from "@/components/auth-shell";
import { AceitarConviteForm } from "@/components/aceitar-convite-form";

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell
      titulo="Você foi convidado"
      descricao="Crie sua senha para entrar no app."
    >
      <AceitarConviteForm token={token} />
    </AuthShell>
  );
}
