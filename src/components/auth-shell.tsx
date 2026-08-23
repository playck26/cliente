import type { ReactNode } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Moldura das telas públicas de conta (SPEC-009: primeiro acesso,
 * auto-cadastro e aceite de convite).
 *
 * Extraída do layout do login em vez de duplicada quatro vezes: as quatro
 * telas são o mesmo momento do produto — alguém de fora tentando entrar —
 * e precisam parecer a mesma coisa.
 */
export function AuthShell({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,156,63,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,156,63,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[var(--color-primary-container)]/40 to-transparent"
      />
      <Card className="relative w-full max-w-[420px] overflow-hidden rounded-2xl p-2 shadow-[var(--shadow-elevated)]">
        <CardHeader className="items-center justify-items-center text-center">
          <div className="mb-2 flex size-20 items-center justify-center">
            <Image
              src="/playck-logo.png"
              alt="Logo PlayCK"
              width={80}
              height={80}
              className="size-20 object-contain drop-shadow-[0_8px_14px_rgba(18,20,15,0.18)]"
            />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">{titulo}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{descricao}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
