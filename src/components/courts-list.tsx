"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { TopAppBar } from "@/components/top-app-bar";
import { Card } from "@/components/ui/card";
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
    <main className="flex min-h-screen flex-col bg-background pb-20">
      <TopAppBar />

      <div className="flex flex-col gap-5 px-5 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Quadras</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Selecione uma quadra para reservar</p>
        </div>

        {error ? (
          <p role="alert" className="text-[var(--color-error)]">
            {error}
          </p>
        ) : loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : quadras.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">Nenhuma quadra disponível ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {quadras.map((quadra) => (
              <Link key={quadra.id} href={`/quadras/${quadra.id}`}>
                <Card className="overflow-hidden rounded-xl p-0 shadow-[var(--shadow-low)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
                  {/* Sem foto real da quadra nesta spec (SPEC-007, decisão
                      do usuário — opção A): bloco decorativo com a textura
                      "linhas de quadra" no lugar da foto que a referência
                      usava, sem inventar upload de imagem (ADR-011). */}
                  <div
                    className="relative flex h-[100px] items-end justify-start bg-[var(--color-primary-container)] p-3"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(0,156,63,0.12) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(0,156,63,0.12) 1.5px, transparent 1.5px)",
                      backgroundSize: "18px 18px",
                    }}
                  >
                    <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-[var(--color-on-primary-container)] backdrop-blur-sm">
                      <TennisBallIcon className="size-3.5" strokeWidth={2} /> {quadra.esporte}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{quadra.nome}</h2>
                    <div className="text-right">
                      <span className="block text-lg font-semibold text-[var(--color-primary)]">
                        {quadra.precoHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">/ hora</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
