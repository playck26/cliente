// Placeholder (AC-007, SPEC-001) — home real (minhas aulas/locação) entra
// nas specs 003/004/005.
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Bem-vindo(a)!</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Login funcionando. Suas aulas e reservas chegam nas próximas specs.
        </p>
      </div>
    </main>
  );
}
