import type { components } from "./api-types";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: "super_admin" | "company_admin" | "aluno";
  companyId: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nome: string;
    role: "super_admin" | "company_admin" | "aluno";
    companyId: string | null;
    /**
     * SPEC-009/AC-008 — conta criada pelo admin entra com senha temporária
     * e precisa trocá-la antes de qualquer outra coisa. A trava de verdade
     * é do servidor (INV-008); isto aqui só evita que o app mostre telas
     * que ele sabe que vão voltar 403.
     */
    senhaTemporaria?: boolean;
  };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Court {
  id: string;
  companyId: string;
  nome: string;
  esporte: string;
  precoHora: number;
  status: "ativa" | "inativa";
  createdAt: string;
}

export interface AvailabilitySlot {
  slot: string;
  status: "livre" | "ocupado_turma" | "ocupado_avulso";
}

export interface Availability {
  quadraId: string;
  data: string;
  /**
   * SPEC-010/AC-008 — "fechado" e "aberto sem nada livre" produzem a mesma
   * lista vazia depois que a tela filtra os slots ocupados. Sem este
   * campo, os dois casos apareceriam como a mesma grade vazia sem
   * explicação.
   */
  estado: "aberto" | "fechado";
  slots: AvailabilitySlot[];
}

export interface Booking {
  id: string;
  companyId: string;
  quadraId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  origemTipo: "TURMA" | "AVULSO";
  alunoId: string | null;
  statusPagamento: "pendente_pagamento" | "pago" | "cancelado";
}

export interface MyClass {
  ocupacaoId: string;
  turmaId: string;
  turmaNome: string | null;
  quadraId: string;
  quadraNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
}

export interface PublicPaymentConfig {
  linkPagamentoUrl: string | null;
  whatsappNumero: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response, fallback: string): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : fallback;
  return new ApiError(res.status, message);
}

/**
 * Renova o access token usando o refresh token do cookie httpOnly.
 *
 * O backend implementa rotação de refresh desde a SPEC-001 (REQ-003), mas
 * nenhum frontend chamava esta rota: o access token vale 15 minutos, e
 * qualquer ação depois disso morria com "Unauthorized" no meio da tela.
 * Passava despercebido porque, em teste, o intervalo entre logar e agir
 * era sempre menor que 15 minutos.
 *
 * `credentials: "include"` é obrigatório — é o que manda o cookie de
 * refresh (httpOnly, `SameSite=Strict`, path `/api/v1/auth`).
 */
let renovacaoEmCurso: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  // Várias requisições podem receber 401 ao mesmo tempo (uma tela que
  // carrega três listas, por exemplo). Sem esta trava, cada uma dispararia
  // um refresh, e a rotação do backend trataria as concorrentes como reuso
  // de token — revogando a sessão inteira, que é o oposto do desejado.
  if (renovacaoEmCurso) return renovacaoEmCurso;

  renovacaoEmCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const { accessToken } = (await res.json()) as { accessToken: string };
      saveAccessToken(accessToken);
      return true;
    } catch {
      return false;
    } finally {
      renovacaoEmCurso = null;
    }
  })();

  return renovacaoEmCurso;
}

function encerrarSessao(): void {
  clearAccessToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    // Navegação dura de propósito, em vez de `router.push`: este módulo não
    // é componente (não há hook disponível) e, mais importante, sessão
    // perdida deve descartar todo o estado em memória — cache de listas,
    // formulário pela metade, dados de outro usuário.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
}

async function requisicaoAutenticada(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = getAccessToken();
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function ehSenhaTemporaria(res: Response): Promise<boolean> {
  try {
    const body: unknown = await res.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      (body as { code?: string }).code === "SENHA_TEMPORARIA"
    );
  } catch {
    return false;
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await requisicaoAutenticada(path, init);

  // 401 aqui quase sempre é access token vencido, não credencial errada:
  // tenta renovar uma vez e repete. Se a renovação falhar, a sessão acabou
  // de verdade — manda para o login em vez de mostrar "Unauthorized" no
  // meio de um formulário.
  // SPEC-009/INV-008: o servidor barra tudo enquanto a senha for
  // temporária. Sem este desvio, a pessoa que chegasse a uma rota interna
  // (link antigo, voltar do navegador) veria um erro seco em vez da tela
  // que resolve o problema dela.
  if (res.status === 403 && (await ehSenhaTemporaria(res.clone()))) {
    if (typeof window !== "undefined" && window.location.pathname !== "/primeiro-acesso") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/primeiro-acesso";
    }
    throw await parseError(res, "Crie sua senha para continuar.");
  }

  if (res.status === 401) {
    const renovou = await renovarSessao();
    if (!renovou) {
      encerrarSessao();
      throw await parseError(res, "Sua sessão expirou. Entre novamente.");
    }
    res = await requisicaoAutenticada(path, init);
    if (res.status === 401) {
      encerrarSessao();
      throw await parseError(res, "Sua sessão expirou. Entre novamente.");
    }
  }

  if (!res.ok) {
    throw await parseError(res, "Não foi possível completar a operação");
  }

  return res;
}

export async function login(dto: LoginDto): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw await parseError(res, "Não foi possível entrar");
  }

  return (await res.json()) as LoginResult;
}

export async function getMe(): Promise<Usuario> {
  const res = await authFetch("/auth/me");
  return (await res.json()) as Usuario;
}

export async function listMyClasses(): Promise<MyClass[]> {
  const res = await authFetch("/me/classes");
  return (await res.json()) as MyClass[];
}

export async function listCourts(): Promise<Paginated<Court>> {
  const res = await authFetch("/courts?pageSize=100");
  return (await res.json()) as Paginated<Court>;
}

export async function getAvailability(quadraId: string, data: string): Promise<Availability> {
  const res = await authFetch(`/courts/${quadraId}/availability?data=${data}`);
  return (await res.json()) as Availability;
}

export async function createBooking(dto: {
  quadraId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
}): Promise<Booking> {
  const res = await authFetch("/bookings", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as Booking;
}

export async function listMyBookings(): Promise<Paginated<Booking>> {
  const res = await authFetch("/bookings?pageSize=100");
  return (await res.json()) as Paginated<Booking>;
}

export async function cancelBooking(id: string): Promise<void> {
  await authFetch(`/bookings/${id}/cancel`, { method: "POST" });
}

export async function getPublicPaymentConfig(): Promise<PublicPaymentConfig> {
  const res = await authFetch("/payment-config/public");
  return (await res.json()) as PublicPaymentConfig;
}

// =====================================================================
// SPEC-009 — onboarding de conta do aluno
// =====================================================================

/** REQ-004: troca de senha do próprio usuário (primeiro acesso ou não). */
export async function trocarSenha(dto: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<{ accessToken: string }> {
  const res = await authFetch("/auth/trocar-senha", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  return (await res.json()) as { accessToken: string };
}

export interface EmpresaPublica {
  nome: string;
  logoUrl: string | null;
}

/** REQ-001: dados mínimos da empresa para a página pública de cadastro. */
export async function getEmpresaPorSlug(slug: string): Promise<EmpresaPublica> {
  const res = await fetch(`${API_URL}/api/v1/public/companies/${slug}`);
  if (!res.ok) {
    throw await parseError(res, "Link inválido ou indisponível.");
  }
  return (await res.json()) as EmpresaPublica;
}

/** REQ-001: auto-cadastro público — o aluno escolhe a própria senha. */
export async function registerAluno(dto: {
  empresaSlug: string;
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/register-aluno`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível concluir o cadastro.");
  }
}

export interface ConvitePublico {
  empresa: { nome: string };
  nome: string | null;
}

/** REQ-002: dados que a tela do convite pode mostrar (AC-024). */
export async function getConvite(token: string): Promise<ConvitePublico> {
  const res = await fetch(`${API_URL}/api/v1/public/invites/${token}`);
  if (!res.ok) {
    throw await parseError(res, "Convite inválido ou já utilizado.");
  }
  return (await res.json()) as ConvitePublico;
}

/** REQ-002: aceite do convite — o aluno escolhe a própria senha. */
export async function aceitarConvite(dto: {
  token: string;
  senha: string;
  nome?: string;
  email?: string;
  telefone?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/aceitar-convite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível concluir o cadastro.");
  }
}
