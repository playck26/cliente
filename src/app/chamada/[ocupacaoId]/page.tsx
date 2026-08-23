import { ChamadaView } from "@/components/chamada-view";

export default async function ChamadaPage({ params }: PageProps<"/chamada/[ocupacaoId]">) {
  const { ocupacaoId } = await params;
  return <ChamadaView ocupacaoId={ocupacaoId} />;
}
