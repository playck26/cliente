import type { MetadataRoute } from "next";

// PWA instalável (ADR-012). Ícones são placeholder sólido — trocar quando
// o arquivo de marca oficial chegar (gap registrado em STATUS.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlayCK",
    short_name: "PlayCK",
    description: "Suas aulas e reservas de quadra em um só lugar",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f1",
    theme_color: "#2f6b3a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
