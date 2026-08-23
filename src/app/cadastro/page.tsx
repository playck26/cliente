import { AuthShell } from "@/components/auth-shell";
import { EscolherClubeForm } from "@/components/escolher-clube-form";

/**
 * DEF-003 — entrada do auto-cadastro para quem chega pelo app.
 *
 * O caminho que a ADR-013 desenhou é o clube divulgar `/cadastro/<slug>`.
 * Esta tela não substitui esse caminho: ela atende quem abriu o app, tocou
 * em "Cadastre-se" e não tem o link em mãos — que até hoje não ia a lugar
 * nenhum.
 */
export default function EscolherClubePage() {
  return (
    <AuthShell
      titulo="Criar conta"
      descricao="O cadastro é feito pelo clube onde você joga."
    >
      <EscolherClubeForm />
    </AuthShell>
  );
}
