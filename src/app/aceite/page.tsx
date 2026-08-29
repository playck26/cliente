import { AceiteView } from "@/components/aceite-view";

/**
 * SPEC-024/TASK-006 — a tela para onde o `403 ACEITE_PENDENTE` desvia.
 *
 * Sem `Suspense` aqui: esta tela nao le `useSearchParams`. A barreira das
 * outras existe por causa dele, nao por hábito.
 */
export default function AceitePage() {
  return <AceiteView />;
}
