import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Fundo decorativo (SPEC-007) — grade sutil "linhas de quadra" +
          leve gradiente da cor primária, puro CSS. */}
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
      <LoginForm />
    </main>
  );
}
