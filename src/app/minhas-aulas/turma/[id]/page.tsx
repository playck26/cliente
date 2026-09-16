import { TurmaDoAlunoView } from "@/components/turma-do-aluno";

/**
 * SPEC-057/TASK-002 — endereço próprio, e não `/minhas-turmas/[id]`, que **já
 * é do professor** (`rota-inicial.ts` manda o professor para lá). Um aluno
 * que abrisse aquele caiu, até hoje, numa tela que responde 403.
 */
export default async function TurmaDoAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TurmaDoAlunoView id={id} />;
}
