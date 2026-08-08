import { CourtBooking } from "@/components/court-booking";

export default async function QuadraPage({ params }: PageProps<"/quadras/[id]">) {
  const { id } = await params;
  return <CourtBooking id={id} />;
}
