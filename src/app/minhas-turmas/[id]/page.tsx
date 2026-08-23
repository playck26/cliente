import { MinhaTurmaDetalheView } from "@/components/minha-turma-detalhe";

export default async function MinhaTurmaPage({ params }: PageProps<"/minhas-turmas/[id]">) {
  const { id } = await params;
  return <MinhaTurmaDetalheView id={id} />;
}
