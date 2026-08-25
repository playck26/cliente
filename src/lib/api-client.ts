import type { components } from "./api-types";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];

export type Papel = "super_admin" | "company_admin" | "aluno" | "professor";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Papel;
  companyId: string | null;
}

// SPEC-013 — o que o professor vê. Note o que **não** está aqui: telefone
// e e-mail de aluno, valor, situação de pagamento. O servidor também não
// devolve (AC-008); o tipo existe para que adicionar isso exija uma
// decisão, não um descuido.
export interface MinhaTurma {
  id: string;
  nome: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  quadraNome: string;
  nivelNome: string | null;
  capacidade: number;
  totalAlunos: number;
}

export interface MinhaTurmaDetalhe extends Omit<MinhaTurma, "totalAlunos"> {
  alunos: { id: string; nome: string; nivelNome: string | null }[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nome: string;
    role: Papel;
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

/**
 * O texto que o Nest devolve num `ForbiddenException()` sem argumento.
 * Chegou até o usuário em produção, sozinho no meio da tela (DEF-007).
 */
const FORBIDDEN_CRU = "Forbidden";

async function parseError(res: Response, fallback: string): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : fallback;

  // DEF-007 — um 403 sem mensagem própria é o servidor dizendo "seu papel
  // não pode isso". "Forbidden" na tela não diz nada a ninguém e não dá o
  // que fazer a seguir. Erro de domínio com mensagem própria passa intacto:
  // a troca só alcança o texto padrão do framework.
  if (res.status === 403 && message === FORBIDDEN_CRU) {
    return new ApiError(res.status, "Sua conta não tem acesso a esta área.");
  }

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
  // SPEC-018/TASK-003 — **`FormData` não pode levar `Content-Type` nosso.**
  // Quem monta o cabeçalho de multipart é o navegador, porque só ele conhece
  // o `boundary` que separa as partes. Mandar `application/json` junto de um
  // corpo multipart faz o servidor tentar parsear o corpo como JSON: o campo
  // `arquivo` nunca chega, e o erro que aparece é "envie o arquivo no campo
  // arquivo" — que manda quem for investigar para o lado errado.
  const ehFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(ehFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function temCodigo(res: Response, codigo: string): Promise<boolean> {
  try {
    const body: unknown = await res.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      (body as { code?: string }).code === codigo
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
  // SPEC-013/INV-013 — conta inativada enquanto a sessão estava aberta. O
  // servidor passa a responder 403 CONTA_INATIVA em toda rota, e um 403 não
  // dispara a renovação logo abaixo: sem este desvio a pessoa ficaria presa
  // numa tela viva cheia de erros, sem entender que perdeu o acesso.
  // Encerra a sessão como se fosse expiração, porque para ela é isso mesmo.
  if (res.status === 403 && (await temCodigo(res.clone(), "CONTA_INATIVA"))) {
    encerrarSessao();
    throw await parseError(res, "Esta conta está inativa. Procure o administrador.");
  }

  if (res.status === 403 && (await temCodigo(res.clone(), "SENHA_TEMPORARIA"))) {
    if (typeof window !== "undefined" && window.location.pathname !== "/primeiro-acesso") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/primeiro-acesso";
    }
    throw await parseError(res, "Crie sua senha para continuar.");
  }

  // DEF-008 (2026-08-24) — 403 puro, sem código conhecido, quase sempre é
  // **claim velha no token**, não falta de permissão de verdade.
  //
  // O servidor autoriza pelo TOKEN (`role` e `companyId` das claims); o app
  // navega pelo `/auth/me`, que lê do BANCO. Quando o papel ou a empresa de
  // alguém muda, os dois discordam até o próximo login — e como 403 nunca
  // disparava a renovação, a divergência **não tinha como se resolver
  // sozinha**. A pessoa ficava presa numa tela viva cheia de erro, e a
  // única saída era deslogar, que ninguém adivinha.
  //
  // Foi assim em produção: o app mandava o professor para `/minhas-turmas`
  // (o banco dizia professor) e a API recusava `/me/teacher/classes` (o
  // token dizia outra coisa).
  //
  // A renovação relê o usuário do banco e reemite o token com as claims
  // atuais. Se depois disso ainda for 403, aí é permissão de verdade.
  if (res.status === 403) {
    const renovou = await renovarSessao();
    if (renovou) {
      res = await requisicaoAutenticada(path, init);
    }
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

export type StatusPresenca = "presente" | "ausente" | "justificado";

export interface Ocorrencia {
  ocupacaoId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  cancelada: boolean;
  chamadaFeita: boolean;
  marcados: number;
  totalAlunos: number;
  /** SPEC-014/INV-017: falso para aula futura, cancelada ou com mais de 7 dias. */
  podeLancar: boolean;
}

export interface Chamada {
  ocupacaoId: string;
  turmaId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  cancelada: boolean;
  /**
   * SPEC-014/INV-019 — precisa voltar no PUT. Sem ela, dois aparelhos na
   * mesma chamada se sobrescrevem em silêncio.
   */
  versao: string;
  /**
   * SPEC-015/DEF-002/INV-027 — completude declarada pelo cabeçalho da
   * chamada. **Opcional de propósito:** esta tela é publicada antes do
   * backend que passa a mandar o campo (a sequência de deploy exige a tela
   * primeiro), então durante essa janela ele chega `undefined`. Ausente
   * significa "backend antigo", não "completa" — e por isso o aviso só
   * aparece no valor explícito.
   */
  completude?: "completa" | "desconhecida";
  alunos: {
    alunoId: string;
    nome: string;
    status: StatusPresenca | null;
    naTurmaHoje: boolean;
  }[];
}

export async function listOcorrencias(turmaId: string, dias = 30): Promise<Ocorrencia[]> {
  const res = await authFetch(`/me/teacher/classes/${turmaId}/ocorrencias?dias=${dias}`);
  return (await res.json()) as Ocorrencia[];
}

export async function getChamada(ocupacaoId: string): Promise<Chamada> {
  const res = await authFetch(`/me/teacher/attendance/${ocupacaoId}`);
  return (await res.json()) as Chamada;
}

export async function salvarChamada(
  ocupacaoId: string,
  versao: string,
  itens: { alunoId: string; status: StatusPresenca }[],
): Promise<{ versao: string; total: number }> {
  const res = await authFetch(`/me/teacher/attendance/${ocupacaoId}`, {
    method: "PUT",
    body: JSON.stringify({ versao, itens }),
  });
  return (await res.json()) as { versao: string; total: number };
}

export async function listMinhasTurmas(): Promise<MinhaTurma[]> {
  const res = await authFetch("/me/teacher/classes");
  return (await res.json()) as MinhaTurma[];
}

export async function getMinhaTurma(id: string): Promise<MinhaTurmaDetalhe> {
  const res = await authFetch(`/me/teacher/classes/${id}`);
  return (await res.json()) as MinhaTurmaDetalhe;
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

/**
 * SPEC-011 — reserva de um ou mais horários no mesmo dia.
 *
 * Slots contíguos viram **uma** reserva com o valor somado; separados
 * viram reservas independentes. O agrupamento é decidido pelo servidor: se
 * cada tela decidisse, o app e o painel poderiam divergir sobre o que é
 * "uma reserva".
 */
export async function createBooking(dto: {
  quadraId: string;
  data: string;
  slots: { horaInicio: string; horaFim: string }[];
}): Promise<{ reservas: Booking[] }> {
  const res = await authFetch("/bookings", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  return (await res.json()) as { reservas: Booking[] };
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

// ---------------------------------------------------------------------------
// SPEC-018/TASK-003 — foto de perfil
// ---------------------------------------------------------------------------

export interface FotoDePerfil {
  /** `null` é o estado normal de quem nunca subiu foto — não é erro. */
  url: string | null;
}

/**
 * A URL vem **assinada e expira** (SPEC-018/AC-003). Por isso a foto tem
 * endpoint próprio em vez de vir dentro de `/auth/me`: numa sessão longa,
 * uma URL embutida no login ficaria velha e a tela mostraria imagem
 * quebrada sem ter como se recuperar.
 */
export async function getMinhaFoto(): Promise<FotoDePerfil> {
  const res = await authFetch("/me/foto");
  if (!res.ok) {
    throw await parseError(res, "Não foi possível carregar sua foto");
  }
  return (await res.json()) as FotoDePerfil;
}

/**
 * O `arquivo` já vem **comprimido** por `comprimir-imagem.ts` — quem chama
 * é responsável por isso. Subir o original de um celular seria 413: o
 * servidor recusa acima de 2 MB, e uma foto de 12 MP tem o dobro disso.
 */
export async function enviarMinhaFoto(arquivo: File): Promise<FotoDePerfil> {
  const corpo = new FormData();
  // O nome do campo é contrato (CON-017.1). Errar aqui dá 400
  // `CAMPO_INESPERADO`, não um erro de validação comum.
  corpo.append("arquivo", arquivo);
  const res = await authFetch("/me/foto", { method: "PUT", body: corpo });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível enviar sua foto");
  }
  return (await res.json()) as FotoDePerfil;
}

export async function removerMinhaFoto(): Promise<void> {
  const res = await authFetch("/me/foto", { method: "DELETE" });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível remover sua foto");
  }
}
