import { CourtBooking } from "@/components/court-booking";

/**
 * SPEC-074/D10 — **a data pela URL.** O aviso de horário livre traz o aluno para
 * `/quadras/<id>?data=AAAA-MM-DD`, e a tela abre naquele dia. O valor vai CRU:
 * quem decide se ele serve é `dataInicialDaUrl`, que cai em hoje quando a data
 * é malformada ou já passou — a URL vem de um aviso que pode ser antigo.
 */
export default async function QuadraPage({
  params,
  searchParams,
}: PageProps<"/quadras/[id]">) {
  const { id } = await params;
  const { data } = await searchParams;
  return (
    <CourtBooking
      id={id}
      dataInicial={typeof data === "string" ? data : undefined}
    />
  );
}
