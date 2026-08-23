import { cn } from "@/lib/utils";

export function CourtLines({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("court-lines pointer-events-none absolute inset-0 z-0", className)}
    />
  );
}
