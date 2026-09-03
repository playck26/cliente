import type { components } from "./api-types";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];

/**
 * SPEC-021/INV-059 — o papel vem do contrato, e não de uma cópia.
 *
 * Esta união estava certa hoje, e é o tipo de coisa que fica errada quando
 * ninguém está olhando: o `"professor"` entrou na SPEC-013 e o `LoginResult`
 * do SAdmin **nunca soube** — lá a lista tinha três papéis até 2026-08-27.
 * Mesma união, dois repositórios, um deles desatualizado por semanas.
 */
export type Papel = components["schemas"]["UsuarioPublicoResponseDto"]["role"];

export type Usuario = components["schemas"]["UsuarioPublicoResponseDto"];

/**
 * SPEC-013 — o que o professor vê. Note o que **não** está aqui: telefone e
 * e-mail de aluno, valor, situação de pagamento. O servidor também não
 * devolve (AC-008); o tipo existe para que adicionar isso exija uma decisão,
 * não um descuido.
 *
 * **SPEC-019/REQ-006 (AC-016) — eram `interface` escrita à mão, e diziam
 * `diaSemana`.** Enquanto fossem locais, trocar a forma da resposta no `back`
 * deixaria o typecheck daqui verde e a tela quebrada em runtime — que foi
 * literalmente o DEF-012, em 2026-08-26, neste repositório.
 *
 * E a validação cruzada da SPEC-019 apontou que `MinhaTurmaDetalhe` ia
 * repetir o defeito: a rota `/me/teacher/classes/:id` não estava no contrato
 * da 1ª versão da spec.
 */
export type EncontroDaTurma = components["schemas"]["TurmaEncontroResponseDto"];
export type MinhaTurma = components["schemas"]["TurmaDoProfessorResponseDto"];
export type MinhaTurmaDetalhe =
  components["schemas"]["TurmaDoProfessorDetalheResponseDto"];

export type LoginResult = components["schemas"]["LoginResponseDto"];

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * SPEC-041/AC-016 — paginação cujo conjunto depende do RELÓGIO.
 *
 * A lista de reservas é cortada entre passado e futuro, e essa fronteira anda
 * sozinha. O servidor devolve o instante que usou; quem pagina reenvia, para a
 * página 2 ver o mesmo conjunto que a página 1.
 */
export interface PaginadoComReferencia<T> extends Paginated<T> {
  referenciaTemporal: string;
}

/**
 * SPEC-020/TASK-007 — **estes dois tipos deixaram de ser escritos à mão.**
 *
 * Eram uma `interface Court` local, e foi ela que causou o DEF-012: dizia
 * `esporte: string`, continuou dizendo depois que o `back` passou a devolver
 * objeto, e o typecheck ficou verde enquanto três telas iam a branco em
 * produção.
 *
 * **Tipo escrito à mão não é contrato — é uma afirmação sobre ele, e ela
 * envelhece calada.** Agora vêm de `openapi.json`, que vem do
 * `QuadraResponseDto` do `back`, que está amarrado ao retorno de
 * `toQuadraResponse`. Mudar a forma da resposta acende vermelho em três
 * lugares antes de chegar a um usuário.
 *
 * `esporte` pode ser `null` de verdade: quadra cujo texto estava em branco
 * quando o backfill da TASK-001 rodou. `categoria` é opcional por decisão de
 * produto (AC-006). `imagemUrl` é CDN sem assinatura (SPEC-018/AC-002) — a
 * chave crua nunca chega aqui (INV-037).
 */
export type OpcaoDeCatalogo =
  components["schemas"]["OpcaoDeCatalogoResponseDto"];
export type Court = components["schemas"]["QuadraResponseDto"];

/**
 * SPEC-021/INV-059 — **de `interface` escrita à mão para apelido do schema.**
 *
 * Este é o repositório do DEF-012: três telas ficaram em branco em produção
 * porque `quadra.esporte` virou objeto e o tipo daqui continuou dizendo
 * `string`, com o typecheck verde o tempo todo. `Court` virou alias naquele
 * dia; **o resto continuou afirmado à mão até hoje**, porque não havia schema
 * publicado para apontar.
 *
 * Agora há, para as 90 rotas. O que era afirmação vira consulta.
 *
 * `Booking` é o exemplo de que a mão também acerta e mesmo assim custa:
 * `statusPagamento` aqui estava **certo** (`pendente_pagamento`), e foi o
 * contrato que eu publiquei hoje que saiu errado (DEF-016). Estar certo por
 * enquanto não é o mesmo que estar amarrado.
 *
 * O que ele perdia era outra coisa: `valor` — o preço **congelado** na
 * reserva. Sem ele no tipo, `court-booking.tsx` recalcula
 * `slotsSelecionados.length × precoHora`, e passaria a mostrar número
 * diferente do cobrado no primeiro reajuste do clube. O DTO do `back` existe
 * dizendo exatamente isso.
 */
export type AvailabilitySlot =
  components["schemas"]["SlotDeDisponibilidadeResponseDto"];

/**
 * SPEC-010/AC-008 — `estado` distingue "fechado" de "aberto sem nada livre".
 * As duas viram a mesma lista vazia depois que a tela filtra os ocupados, e
 * sem o campo apareceriam como a mesma grade sem explicação.
 */
export type Availability = components["schemas"]["DisponibilidadeResponseDto"];

export type Booking = components["schemas"]["OcupacaoResponseDto"];

/**
 * SPEC-041/AC-011 — **o item da LISTAGEM, que não é o mesmo que `Booking`.**
 *
 * Ele carrega `canceladaPorMim`, que depende de **quem está pedindo** e por
 * isso não cabe no DTO compartilhado por `POST /bookings` e pelo `PATCH` de
 * pagamento. Apelido do schema, nunca escrito à mão (INV-059).
 */
export type ItemDaListaDeReservas =
  components["schemas"]["ItemDaListaDeReservasDto"];

export type MyClass = components["schemas"]["AulaDoAlunoResponseDto"];

/**
 * SPEC-023 — apelido do schema, nao tipo escrito a mao (INV-059).
 *
 * O DEF-012 foi exatamente o contrario: `Court.esporte` era `string` aqui
 * enquanto o contrato ja dizia objeto, o typecheck ficou verde e tres telas
 * foram a branco. Tipo local nao e contrato, e uma afirmacao sobre ele.
 */
export type TurmaDisponivel =
  components["schemas"]["TurmaDisponivelResponseDto"];

/** Os cinco codigos de erro de matricula, tambem vindos do schema (LIM-004). */
export type ErroDeMatricula =
  components["schemas"]["ErroDeMatriculaResponseDto"];

/** SPEC-026 — apelidos do schema, nunca escritos a mao (INV-059). */
export type DiaDaAgendaDoProfessor =
  components["schemas"]["DiaDaAgendaDoProfessorDto"];
export type AulaDoDiaDoProfessor =
  components["schemas"]["AulaDoDiaDoProfessorDto"];

/** SPEC-025 — apelidos do schema, nunca escritos a mao (INV-059). */
export type AulaAnterior = components["schemas"]["AulaAnteriorResponseDto"];
export type MinhaAvaliacao = components["schemas"]["MinhaAvaliacaoResponseDto"];
export type MediaDaTurma = components["schemas"]["MediaDaTurmaResponseDto"];

/** SPEC-024 — apelidos do schema, nunca escritos a mao (INV-059). */
export type AceitesPendentes =
  components["schemas"]["AceitesPendentesResponseDto"];
export type AceiteRegistrado =
  components["schemas"]["AceiteRegistradoResponseDto"];
export type TextoParaAceite = components["schemas"]["TextoParaAceiteDto"];

export type PublicPaymentConfig =
  components["schemas"]["PagamentoPublicoResponseDto"];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * SPEC-023 — **o codigo, que ate agora se perdia aqui.**
     *
     * O servidor ja mandava `code` em varios erros (`CONTA_INATIVA`,
     * `SENHA_TEMPORARIA`), e esta classe descartava: quem quisesse decidir
     * pelo codigo tinha de reler o corpo, e por isso as telas decidiam pela
     * MENSAGEM. Mensagem e texto para humano — muda numa revisao de copy e
     * leva a regra junto.
     *
     * Opcional porque nem todo erro tem codigo (400 de validacao do Nest,
     * 500). Quem le trata `undefined` como "sem codigo", nunca como um
     * codigo especifico.
     */
    public code?: string,
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
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : fallback;

  // DEF-007 — um 403 sem mensagem própria é o servidor dizendo "seu papel
  // não pode isso". "Forbidden" na tela não diz nada a ninguém e não dá o
  // que fazer a seguir. Erro de domínio com mensagem própria passa intacto:
  // a troca só alcança o texto padrão do framework.
  const code =
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code
      : undefined;

  if (res.status === 403 && message === FORBIDDEN_CRU) {
    return new ApiError(
      res.status,
      "Sua conta não tem acesso a esta área.",
      code,
    );
  }

  return new ApiError(res.status, message, code);
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
  // A navegação dura abaixo já descartaria o cache, mas ela é condicional
  // (não roda se a pessoa já está em /login). Limpar aqui garante que a
  // logo do clube anterior não sobreviva à troca de sessão na mesma aba.
  limparCacheDaEmpresa();
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
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

async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
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
    throw await parseError(
      res,
      "Esta conta está inativa. Procure o administrador.",
    );
  }

  if (
    res.status === 403 &&
    (await temCodigo(res.clone(), "SENHA_TEMPORARIA"))
  ) {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/primeiro-acesso"
    ) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/primeiro-acesso";
    }
    throw await parseError(res, "Crie sua senha para continuar.");
  }

  // SPEC-024/INV-024b — o portao do aceite, no mesmo molde do de cima.
  //
  // **DEPOIS do de senha temporaria de proposito**, e a ordem espelha a do
  // servidor: quem ainda nao definiu senha propria resolve isso primeiro.
  // Empilhar as duas pendencias seria pedir que a pessoa aceite um contrato
  // antes de ter uma conta de verdade.
  //
  // Sem este desvio, ligar o portao em producao viraria apagao: o servidor
  // barraria tudo e a pessoa veria um erro seco, sem caminho para a tela que
  // resolve o problema dela. E a LIM-024d da spec, e este bloco e a resposta
  // a ela.
  if (res.status === 403 && (await temCodigo(res.clone(), "ACEITE_PENDENTE"))) {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/aceite"
    ) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/aceite";
    }
    throw await parseError(res, "Leia e aceite os termos para continuar.");
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

/**
 * Encerra a sessão.
 *
 * **A ordem importa, e o `finally` é o ponto.** O servidor precisa ser
 * avisado primeiro — é ele que revoga o refresh token e limpa o cookie; sem
 * isso a sessão continuaria viva do lado de lá, e quem ficou com o
 * navegador poderia renová-la.
 *
 * Mas o estado local sai **de qualquer jeito**. Se a rede caiu ou o
 * servidor respondeu erro, insistir deixaria a pessoa presa numa sessão que
 * ela pediu para encerrar — e um botão "Sair" que não sai é pior que não
 * ter botão. O custo de sair só localmente é um refresh token que expira
 * sozinho; o de não sair é o dispositivo continuar logado.
 *
 * `credentials: "include"` é obrigatório: a identificação do refresh vem
 * pelo cookie.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
    });
  } catch {
    // Rede fora. O servidor não soube, e o token dele expira sozinho.
  } finally {
    clearAccessToken();
  }
}

export async function getMe(): Promise<Usuario> {
  const res = await authFetch("/auth/me");
  return (await res.json()) as Usuario;
}

/**
 * SPEC-014 — os três estados de presença.
 *
 * Vem do contrato pelo caminho da **linha da chamada**, tirando o `null`:
 * ali `null` significa "ainda não lançado", que não é um quarto estado de
 * presença e não pode ser oferecido como opção na tela.
 */
export type StatusPresenca = NonNullable<
  components["schemas"]["LinhaDaChamadaResponseDto"]["status"]
>;

/**
 * SPEC-014 — a ocorrência na visão do professor.
 *
 * `podeLancar` vem calculado do servidor e **não é derivável** do resto: ele
 * junta cancelamento, data futura e a janela retroativa de 7 dias. Recompor
 * com `data <= hoje` erraria a janela e ofereceria botão que volta 422.
 */
export type Ocorrencia = components["schemas"]["OcorrenciaDaTurmaResponseDto"];

/**
 * SPEC-014/SPEC-015 — a chamada do professor.
 *
 * **`completude` era `?` de propósito, e o motivo expirou.** O comentário
 * original dizia: esta tela é publicada antes do backend que passa a mandar
 * o campo (a sequência de deploy exige a tela primeiro), então durante essa
 * janela ele chega `undefined`, e ausente significa "backend antigo", não
 * "completa".
 *
 * A janela fechou — o `back` manda o campo desde a SPEC-015 e está no ar há
 * dias. No contrato ele é **obrigatório e nulável**: `null` é "chamada não
 * lançada", que é estado real e não ausência de backend. As duas leituras
 * pedem o mesmo cuidado na tela (só avisar no valor explícito), e agora a
 * que está escrita é a que corresponde à API.
 *
 * `versao` (INV-019) continua obrigatória: sem ela no PUT, dois aparelhos na
 * mesma chamada se sobrescrevem em silêncio.
 */
export type Chamada = components["schemas"]["ChamadaResponseDto"];

/**
 * SPEC-027 — paginada. `dias` e `page` coexistem de propósito: `dias` diz
 * QUANTO histórico existe (teto de 90 no servidor), `page` diz quanto vem por
 * vez. Trocar uma pela outra perderia a metade útil.
 */
export async function listOcorrencias(
  turmaId: string,
  dias = 30,
  page = 1,
  pageSize = 20,
): Promise<Paginated<Ocorrencia>> {
  const res = await authFetch(
    `/me/teacher/classes/${turmaId}/ocorrencias?dias=${dias}&page=${page}&pageSize=${pageSize}`,
  );
  return (await res.json()) as Paginated<Ocorrencia>;
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

/**
 * SPEC-030 — **a aula não aconteceu.**
 *
 * Choveu, o professor ficou doente, o clube fechou: a aula existe na grade e
 * não houve. Antes disto o produto não tinha resposta para esse dia, e o
 * calendário ficava com o ponto vermelho de "chamada pendente" **para
 * sempre** — o professor só conseguia zerar mentindo que deu a aula.
 *
 * **Sem corpo, de propósito.** A rota inteira é a afirmação. Mandar isto
 * como um campo no `salvarChamada` faria "salvei com zero alunos" e "a aula
 * não aconteceu" viajarem pelo mesmo caminho, que é exatamente a confusão
 * que a SPEC-015 já pagou uma vez para desfazer.
 *
 * **Não é cancelar a aula.** Cancelar libera a quadra e é do gestor sobre a
 * grade; isto só diz o que aconteceu (LIM-030b).
 *
 * `versao` não entra: não há o que sobrescrever de outra aba — o servidor
 * recusa se houver presença lançada (`CHAMADA_COM_PRESENCA`), e é essa
 * recusa que protege o trabalho de quem chegou primeiro.
 */
export async function registrarNaoHouveAula(
  ocupacaoId: string,
): Promise<{ ocupacaoId: string; completude: string }> {
  const res = await authFetch(
    `/me/teacher/attendance/${ocupacaoId}/nao-houve`,
    { method: "PUT" },
  );
  return (await res.json()) as { ocupacaoId: string; completude: string };
}

/**
 * SPEC-026 — o resumo do mes do professor: por dia, quantas aulas e quantas
 * com chamada pendente.
 *
 * A segunda contagem e a razao da tela existir: a grade ele conhece de
 * cabeca; o que ficou faltando registrar, nao.
 */
export async function getAgendaDoProfessor(
  mes: string,
): Promise<DiaDaAgendaDoProfessor[]> {
  const res = await authFetch(`/me/teacher/agenda?mes=${mes}`);
  return (await res.json()) as DiaDaAgendaDoProfessor[];
}

/** SPEC-026 — as aulas de um dia, com o `ocupacaoId` que a chamada aceita. */
export async function getAulasDoDia(
  data: string,
): Promise<AulaDoDiaDoProfessor[]> {
  const res = await authFetch(`/me/teacher/agenda/${data}`);
  return (await res.json()) as AulaDoDiaDoProfessor[];
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

/**
 * SPEC-023 — as turmas do clube, com a ocupacao e o motivo de bloqueio ja
 * calculados pelo servidor.
 *
 * `podeEntrar` e `motivo` vem prontos de proposito: se a tela deduzisse as
 * regras, viraria uma segunda copia delas — e e sempre a copia que fica
 * velha, como o tipo escrito a mao do DEF-012.
 */
/**
 * SPEC-024 — o que falta aceitar, **com o texto junto**.
 *
 * O texto vem na mesma resposta de proposito: uma segunda requisicao criaria
 * a janela em que a pessoa le um texto e aceita outro.
 */
export async function getAceitesPendentes(): Promise<AceitesPendentes> {
  const res = await authFetch("/me/aceites/pendentes");
  return (await res.json()) as AceitesPendentes;
}

/**
 * Registra o aceite, **informando as versoes lidas**.
 *
 * Sem mandar a versao, um cliente velho aceitaria "o que estiver valendo" — e
 * a pessoa estaria concordando com um texto que nao viu. O servidor recusa
 * com VERSAO_DESATUALIZADA quando o texto mudou no meio.
 */
export async function registrarAceite(versoes: {
  termo?: number;
  contrato?: number;
}): Promise<AceiteRegistrado> {
  const res = await authFetch("/me/aceites", {
    method: "POST",
    body: JSON.stringify(versoes),
  });
  return (await res.json()) as AceiteRegistrado;
}

/**
 * SPEC-025 — as aulas que ja aconteceram, para poder avalia-las.
 *
 * `listMyClasses` devolve so o FUTURO. Sem esta, nao haveria como chegar ate
 * a aula para dar nota — foi o que o Israel pediu ao ver a tela.
 *
 * Cada item ja vem com a nota que a pessoa deu: a tela precisa distinguir
 * "ainda nao avaliei" de "dei 4", e uma segunda requisicao por aula seria
 * uma por linha da lista.
 */
export async function listAulasAnteriores(
  page = 1,
  pageSize = 20,
): Promise<Paginated<AulaAnterior>> {
  const res = await authFetch(
    `/me/classes/anteriores?page=${page}&pageSize=${pageSize}`,
  );
  return (await res.json()) as Paginated<AulaAnterior>;
}

/** SPEC-025 — avalia ou corrige a nota de UMA aula. */
export async function avaliarAula(
  ocupacaoId: string,
  dados: { nota: number; comentario?: string },
): Promise<MinhaAvaliacao> {
  const res = await authFetch(`/me/classes/aulas/${ocupacaoId}/avaliacao`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
  return (await res.json()) as MinhaAvaliacao;
}

/**
 * SPEC-025 — a media da TURMA, agregada das notas das aulas dela.
 *
 * A aula nao tem media propria (decisao do Israel). Esta resposta NAO traz
 * autoria nem comentario — INV-025a, e o servidor garante isso com um DTO
 * separado, nao com um filtro.
 */
export async function getMediaDaTurma(turmaId: string): Promise<MediaDaTurma> {
  const res = await authFetch(`/me/classes/${turmaId}/avaliacao`);
  return (await res.json()) as MediaDaTurma;
}

export async function listTurmasDisponiveis(): Promise<TurmaDisponivel[]> {
  const res = await authFetch("/me/classes/disponiveis");
  return (await res.json()) as TurmaDisponivel[];
}

export async function entrarNaTurma(turmaId: string): Promise<void> {
  await authFetch(`/me/classes/${turmaId}`, { method: "POST" });
}

export async function sairDaTurma(turmaId: string): Promise<void> {
  await authFetch(`/me/classes/${turmaId}`, { method: "DELETE" });
}

export async function listCourts(): Promise<Paginated<Court>> {
  const res = await authFetch("/courts?pageSize=100");
  return (await res.json()) as Paginated<Court>;
}

export async function getAvailability(
  quadraId: string,
  data: string,
): Promise<Availability> {
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

/**
 * SPEC-027 — paginada de verdade.
 *
 * Era `?pageSize=100`, que é paginação desligada com outro nome: cem reservas
 * de uma vez, e a lista quebraria em silêncio na centésima primeira. E o
 * filtro de canceladas passou para o servidor (`excluirCanceladas`) — a tela
 * filtrava depois de receber, e com paginação isso faria a contagem mentir.
 */
export async function listMyBookings(
  page = 1,
  pageSize = 20,
  quando: "futuras" | "anteriores" = "futuras",
  // SPEC-041/D6 — **o valor da API, não um apelido.** A URL da tela carrega
  // `?status=cancelado`, e o português vive só no rótulo do botão, como já faz
  // o `STATUS_LABEL`. Uma camada de tradução aqui seria um segundo vocabulário
  // para o mesmo conceito — e `todas` não teria par nenhum, porque "todas" é a
  // AUSÊNCIA do parâmetro, não um valor dele.
  status?: Booking["statusPagamento"],
  // SPEC-041/AC-016 — o instante da 1ª página desta travessia. Ver
  // `useTravessia` em `my-bookings-list.tsx`.
  referenciaTemporal?: string,
): Promise<PaginadoComReferencia<ItemDaListaDeReservas>> {
  // SPEC-041 — **`excluirCanceladas=true` saiu daqui, e era o defeito 2.**
  //
  // A SPEC-027 mudou o filtro de lugar (tela → servidor) para consertar a
  // contagem, e no caminho manteve "esconder" onde o certo era "mostrar como
  // cancelada". Para o aluno, uma reserva cancelada pelo clube simplesmente
  // desaparecia — sem aviso, sem registro, sem onde procurar.
  //
  // O parâmetro continua existindo na rota, `deprecated`, pela janela de skew
  // entre os deploys (ver o DTO no `back`). Quem sai é o único emissor.
  const busca = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    quando,
  });
  if (status) busca.set("status", status);
  if (referenciaTemporal) busca.set("referenciaTemporal", referenciaTemporal);
  const res = await authFetch(`/bookings?${busca.toString()}`);
  return (await res.json()) as PaginadoComReferencia<ItemDaListaDeReservas>;
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

/**
 * REQ-001 — os dados mínimos da empresa na página pública de cadastro.
 *
 * **Dois campos, e a escassez é a decisão:** esta rota é alcançável sem
 * token. Nem o `status`, que o servidor LÊ para decidir se responde, sai no
 * corpo.
 */
export type EmpresaPublica = components["schemas"]["EmpresaPublicaResponseDto"];

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

/**
 * REQ-002 — o que a tela do convite pode mostrar (AC-024).
 *
 * O que **não** está aqui é o ponto: `email`, `telefone` e `nivelId` existem
 * no convite no banco e não saem nesta resposta.
 */
export type ConvitePublico = components["schemas"]["ConvitePublicoResponseDto"];

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
  /**
   * SPEC-024/REQ-007 — as versoes LIDAS na tela do convite. O servidor as
   * grava na MESMA transacao que cria a conta: fora dela existiria uma janela
   * em que a conta existe sem aceite, e o portao mandaria a pessoa aceitar
   * de novo logo depois de ela ter aceitado.
   */
  termoVersao?: number;
  contratoVersao?: number;
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

/** `null` é o estado normal de quem nunca subiu foto — não é erro. */
export type FotoDePerfil = components["schemas"]["FotoDePerfilResponseDto"];

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

// ---------------------------------------------------------------------------
// SPEC-018/TASK-006 — a marca do clube
// ---------------------------------------------------------------------------

/**
 * A empresa como o gestor/aluno a vê. `logoUrl` já vem resolvida pelo
 * servidor — a chave crua nunca chega aqui (INV-037).
 */
export type MinhaEmpresa = components["schemas"]["MinhaEmpresaResponseDto"];

let empresaEmCache: Promise<MinhaEmpresa> | null = null;

/**
 * **Cacheada em memória, e de propósito.** O `TopAppBar` aparece em quatro
 * telas; sem o cache, cada navegação refaria a chamada só para desenhar a
 * mesma logo. Este projeto não tem React Query nem estado global (ADR
 * registrado na planta), então o cache é uma promessa guardada no módulo —
 * a coisa mais simples que resolve, e some quando a aba fecha.
 *
 * `limparCacheDaEmpresa()` existe para o logout: a próxima pessoa a entrar
 * nesta aba pode ser de outro clube.
 */
export async function getMinhaEmpresa(): Promise<MinhaEmpresa> {
  empresaEmCache ??= authFetch("/me/company")
    .then(async (res) => {
      if (!res.ok) {
        throw await parseError(res, "Não foi possível carregar o clube");
      }
      return (await res.json()) as MinhaEmpresa;
    })
    .catch((erro: unknown) => {
      // Uma falha não pode envenenar o cache: sem isto, um erro de rede no
      // primeiro carregamento deixaria a logo ausente até recarregar a aba.
      empresaEmCache = null;
      throw erro;
    });
  return empresaEmCache;
}

export function limparCacheDaEmpresa(): void {
  empresaEmCache = null;
}
