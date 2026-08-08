"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ApiError, listCourts, type Court } from "@/lib/api-client";

// REQ-005 (SPEC-005): aluno navega as quadras da própria empresa pela
// mesma grade de disponibilidade do admin (CON-005.1, agora aberta a
// aluno para leitura).
export function CourtsList() {
  const [quadras, setQuadras] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCourts()
      .then((result) => setQuadras(result.data.filter((quadra) => quadra.status === "ativa")))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar as quadras.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-20">
      <h1 className="text-2xl font-semibold text-foreground">Quadras</h1>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : quadras.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhuma quadra disponível ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {quadras.map((quadra) => (
            <Link key={quadra.id} href={`/quadras/${quadra.id}`}>
              <Card className="transition-colors hover:bg-muted">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{quadra.nome}</CardTitle>
                    <p className="text-sm text-[var(--color-text-secondary)]">{quadra.esporte}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {quadra.precoHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
