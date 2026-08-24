import type { SVGProps } from "react";

// lucide-react não tem ícone de quadra. O lugar usava `LayoutGrid`, que é
// um ícone de layout de página — não dizia nada sobre quadra, e num menu
// onde tudo é ícone isso custa uma leitura a cada vez.
//
// Desenhado no mesmo estilo do `TennisBallIcon` e do set lucide ao redor
// (stroke-based, round cap/join, strokeWidth 2, viewBox 24x24) para não
// destoar. Recriado localmente, não importado de outro app (ADR-001,
// poly-repo sem pacote compartilhado).
//
// A forma é a quadra **vista de cima**, que é como ela aparece na agenda e
// na tela de disponibilidade: retângulo, rede no meio, e as linhas de
// serviço. É a leitura mais direta possível — um jogador reconhece antes
// de ler o rótulo.
export function TennisCourtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* o perímetro */}
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      {/* a rede, no meio */}
      <path d="M3 12h18" />
      {/* as linhas de serviço, uma de cada lado */}
      <path d="M7 4v4h10V4" />
      <path d="M7 20v-4h10v4" />
      {/* a linha central de serviço */}
      <path d="M12 8v8" />
    </svg>
  );
}
