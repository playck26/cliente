import { permanentRedirect } from "next/navigation";

/**
 * SPEC-022/REQ-004 — `/quadras` deixou de ser um destino, mas continua sendo
 * um **endereço**.
 *
 * Atalho na tela inicial e link mandado por conversa são o caso real de quem
 * já usa o app: some a aba, não pode sumir a URL. `permanentRedirect` (308)
 * e não `redirect` (307) porque a mudança é definitiva — vale dizer isso ao
 * navegador e aos buscadores.
 *
 * **`/quadras/[id]` não é afetada** (INV-022b): reservar UMA quadra continua
 * sendo o passo seguinte do fluxo, e rota filha não herda o redirect do
 * índice.
 */
export default function QuadrasPage() {
  permanentRedirect("/reservas?aba=quadras");
}
