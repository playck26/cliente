// AC-003 (SPEC-006): monta o link wa.me a partir do whatsappNumero em
// E.164 — wa.me só aceita dígitos (sem "+", espaços ou parênteses).
// Compartilhado entre court-booking e my-bookings-list (SPEC-007).
export function buildWhatsAppLink(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}`;
}
