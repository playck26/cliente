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
 * SPEC-036 — a ficha do aluno com o bloco `cadastro` calculado.
 *
 * Vem do `openapi.json` como todo o resto: tipo escrito a mao aqui e o
 * DEF-012, que deixa o typecheck verde e a tela quebrada em runtime.
 */
export type MeuCadastro = components["schemas"]["AlunoResponseDto"];
/** SPEC-037 — o plano contratado, com valor e prazo congelados. */
export type Matricula = components["schemas"]["MatriculaResponseDto"];
export type CamposDoCadastro = components["schemas"]["CamposDoCadastroDto"];

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

/** O resultado da varredura de uma janela: os itens, e se o teto cortou. */
export type ReservasDaJanela = {
  itens: ItemDaListaDeReservas[];
  truncou: boolean;
};

export type TurmaDoAlunoDetalhe =
  components["schemas"]["TurmaDoAlunoDetalheResponseDto"];
export type ColegaDeTurma = components["schemas"]["ColegaDeTurmaResponseDto"];
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

/** SPEC-024 — apelidos do schema, nunca escritos a mao (INV-059). */
export type AceitesPendentes =
  components["schemas"]["AceitesPendentesResponseDto"];
export type AceiteRegistrado =
  components["schemas"]["AceiteRegistradoResponseDto"];
export type TextoParaAceite = components["schemas"]["TextoParaAceiteDto"];

export type PublicPaymentConfig =
  components["schemas"]["PagamentoPublicoResponseDto"];

// SPEC-033 — a carteira, na visao do aluno. Sem `motivo`: e nota interna do
// clube (AC-013), e o tipo gerado do contrato e o que garante que ela nao
// aparece aqui nem por engano.
export type ExtratoDoAluno = components["schemas"]["ExtratoDoAlunoResponseDto"];
export type MovimentoDoAluno =
  components["schemas"]["MovimentoDoAlunoResponseDto"];

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
    /**
     * SPEC-057/TASK-001/D2 — **o corpo inteiro do erro, quando havia um.**
     *
     * O `409 CHAMADA_DESATUALIZADA` passou a carregar `fechamentoAutomatico`,
     * e a tela precisa dele para escolher a frase. Campo solto e não um
     * `fechamentoAutomatico?` aqui: o próximo sinal de outro erro não deve
     * precisar mexer nesta classe.
     */
    public corpo?: Record<string, unknown>,
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

  const corpo =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : undefined;

  if (res.status === 403 && message === FORBIDDEN_CRU) {
    return new ApiError(
      res.status,
      "Sua conta não tem acesso a esta área.",
      code,
      corpo,
    );
  }

  return new ApiError(res.status, message, code, corpo);
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

  // DEF-028 — o clube inteiro suspenso. Mesmo desvio da conta inativa, e
  // **precisa vir antes do bloco de 403 genérico logo abaixo**: aquele tenta
  // renovar a sessão, e a renovação de uma empresa suspensa responde `401` e
  // derruba as demais sessões. Sem este desvio a pessoa cairia no login sem
  // uma palavra sobre o motivo — um logout mudo no meio do trabalho.
  //
  // Mensagem separada de propósito: a conta dela está em ordem, e "procure o
  // administrador" mandaria o gestor procurar a si mesmo.
  if (res.status === 403 && (await temCodigo(res.clone(), "EMPRESA_INATIVA"))) {
    encerrarSessao();
    throw await parseError(
      res,
      "O acesso deste clube está suspenso. Fale com o suporte da plataforma.",
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

/**
 * SPEC-033/TASK-006 — a carteira do aluno.
 *
 * **`404` aqui não é erro de rede: é "você não tem carteira".** Usuário
 * autenticado sem linha de aluno recebe `404` de propósito (AC-012b) — `200`
 * com zero mentiria, porque não é que ela esteja vazia, é que não existe.
 * Quem chama distingue os dois pelo `status`.
 */
export async function getMinhaCarteira(): Promise<ExtratoDoAluno> {
  const res = await authFetch("/me/creditos");
  if (!res.ok)
    throw await parseError(res, "Não foi possível carregar sua carteira.");
  return (await res.json()) as ExtratoDoAluno;
}

/**
 * SPEC-036 — o cadastro do aluno logado.
 *
 * `403` para quem nao e aluno (professor e gestor nao tem ficha), e o chamador
 * distingue pelo `status` — o mesmo arranjo da carteira, e pelo mesmo motivo:
 * devolver `{}` faria a tela pintar uma barra de 0% para quem nao tem cadastro
 * de aluno nenhum.
 */
export async function getMeuCadastro(): Promise<MeuCadastro> {
  const res = await authFetch("/me/cadastro");
  if (!res.ok)
    throw await parseError(res, "Nao foi possivel carregar seu cadastro.");
  return (await res.json()) as MeuCadastro;
}

/**
 * SPEC-036/AC-006 — o aluno escreve os SETE campos, e so eles.
 *
 * `nivelId` e `status` nao existem neste corpo: o DTO do servidor e outro
 * (`CamposDoCadastroDto`), e mandar um deles derruba a requisicao inteira com
 * `400`. A garantia e de TIPO, nao de vigilancia.
 *
 * **`null` apaga; `""` o servidor recusa com `400`** (INV-108): ausencia e
 * `NULL`, e so. Quem chama converte campo vazio em `null` antes de mandar.
 */
export async function salvarMeuCadastro(
  dto: CamposDoCadastro,
): Promise<MeuCadastro> {
  const res = await authFetch("/me/cadastro", {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
  if (!res.ok)
    throw await parseError(res, "Nao foi possivel salvar seu cadastro.");
  return (await res.json()) as MeuCadastro;
}

/**
 * SPEC-037/AC-011 — a matricula VIGENTE do aluno logado.
 *
 * **Devolve `null` quando nao ha, e nao `404`.** Nao ter plano e um estado
 * normal -- a tabela nasceu vazia. `404` faria a tela tratar o normal como
 * erro, que e o defeito que a carteira levou para producao na SPEC-033.
 *
 * `403` para professor e gestor: quem chama distingue pelo `status`, como na
 * carteira.
 */
export async function getMinhaMatricula(): Promise<Matricula | null> {
  const res = await authFetch("/me/matricula");
  if (!res.ok)
    throw await parseError(res, "Nao foi possivel carregar seu plano.");
  const texto = await res.text();
  // Corpo vazio e o `null` do servidor: `res.json()` estouraria com
  // `Unexpected end of JSON input`, e o erro nao diria isso.
  return texto.trim() === "" ? null : (JSON.parse(texto) as Matricula);
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

/**
 * SPEC-056/D1 — `incluirInativas` traz também as turmas INATIVAS do professor
 * com aula nos últimos 90 dias ou no futuro. **O back anterior à SPEC-056
 * recusa o parâmetro com `400`** (`forbidNonWhitelisted`): back antes do Cliente.
 */
export async function listMinhasTurmas(
  incluirInativas = false,
): Promise<MinhaTurma[]> {
  const res = await authFetch(
    incluirInativas
      ? "/me/teacher/classes?incluirInativas=true"
      : "/me/teacher/classes",
  );
  return (await res.json()) as MinhaTurma[];
}

export async function getMinhaTurma(id: string): Promise<MinhaTurmaDetalhe> {
  const res = await authFetch(`/me/teacher/classes/${id}`);
  return (await res.json()) as MinhaTurmaDetalhe;
}

/**
 * SPEC-031/REQ-006 — **o aluno avisa que vai faltar, sem sair da turma.**
 *
 * Os dois verbos são simétricos por decisão (D23): retirar o aviso obedece ao
 * MESMO prazo que dá-lo. Sem isso o aluno avisaria cedo e retiraria em cima da
 * hora, terminando exatamente no estado que o prazo existe para negar.
 *
 * Os dois são idempotentes no servidor — repetir devolve o mesmo `204`, e a
 * garantia de linha única é do índice `faltas_unica`, não da aplicação. Então
 * a tela não precisa se defender de toque duplo; precisa só não mentir sobre
 * o estado, e por isso recarrega depois.
 */
export async function avisarFalta(
  turmaId: string,
  ocupacaoId: string,
): Promise<void> {
  await authFetch(`/me/classes/${turmaId}/aulas/${ocupacaoId}/falta`, {
    method: "POST",
  });
}

export async function retirarAvisoDeFalta(
  turmaId: string,
  ocupacaoId: string,
): Promise<void> {
  await authFetch(`/me/classes/${turmaId}/aulas/${ocupacaoId}/falta`, {
    method: "DELETE",
  });
}

/**
 * SPEC-046 — **reposição de aula.**
 *
 * O crédito é derivado no servidor (`faltas válidas − reposições`): a tela não
 * refaz essa conta, e nem poderia — ela não conhece as faltas dos outros
 * alunos, que é o que determina a vaga de cada ocorrência.
 */
export type CreditoDeReposicao =
  components["schemas"]["CreditoDeReposicaoResponseDto"];
export type FaltaParaRepor = components["schemas"]["FaltaParaReporResponseDto"];
export type OportunidadeDeReposicao =
  components["schemas"]["OportunidadeDeReposicaoResponseDto"];

export async function getMeuCreditoDeReposicao(): Promise<CreditoDeReposicao> {
  const res = await authFetch("/me/reposicoes");
  return (await res.json()) as CreditoDeReposicao;
}

/**
 * SPEC-064/TASK-007 — **`incluirSemVaga` traz também a aula CHEIA**, com
 * `vagas: 0`, para a tela oferecer a fila de espera em vez do "Marcar".
 *
 * **ORDEM DE ROLLOUT, e ela é dura:** o Back valida com
 * `forbidNonWhitelisted`, então pedir `incluirSemVaga` a um Back que ainda não
 * conhece o parâmetro devolve **400 na lista inteira** — o aluno perderia até
 * as oportunidades com vaga. **O `back` tem de estar no ar antes deste
 * Cliente**, e o rollback é na ordem inversa.
 */
export async function listarOportunidadesDeReposicao(
  opcoes: { incluirSemVaga?: boolean } = {},
): Promise<OportunidadeDeReposicao[]> {
  const res = await authFetch(
    opcoes.incluirSemVaga
      ? "/me/reposicoes/oportunidades?incluirSemVaga=true"
      : "/me/reposicoes/oportunidades",
  );
  return (await res.json()) as OportunidadeDeReposicao[];
}

export async function marcarReposicao(
  faltaId: string,
  ocupacaoId: string,
): Promise<void> {
  await authFetch("/me/reposicoes", {
    method: "POST",
    body: JSON.stringify({ faltaId, ocupacaoId }),
  });
}

/**
 * Desmarcar obedece ao MESMO prazo de marcar (SPEC-031/D23, herdado pela
 * SPEC-046/AC-014). Sem isso o aluno desmarcaria cinco minutos antes e a vaga
 * voltaria tarde demais para qualquer um usar.
 */
export async function desmarcarReposicao(id: string): Promise<void> {
  await authFetch(`/me/reposicoes/${id}`, { method: "DELETE" });
}

/**
 * SPEC-064/TASK-005 — **a fila de espera, pelo lado do aluno.**
 *
 * A fila existe no Back desde 20/09 e **nenhuma tela a usava**: só o arquivo
 * de tipos gerado conhecia estas rotas. A LIM-064d promete que quem não tem
 * push *"vê na tela da fila"*, e a tela não existia.
 *
 * `vezAberta` vem **calculado do servidor** e não é `estado === "chamado"`:
 * o varredor que expira a vez tem interruptor (D8), então uma linha pode
 * estar `chamado` com o prazo vencido. A tela obedece ao campo, e não ao
 * estado — oferecer confirmação que o servidor recusa é o DEF-011.
 */
export type LinhaDaFila = components["schemas"]["MinhaLinhaDaFilaResponseDto"];

export async function listarMinhaFila(): Promise<LinhaDaFila[]> {
  const res = await authFetch("/me/fila-de-espera");
  return (await res.json()) as LinhaDaFila[];
}

export async function entrarNaFilaDeTurma(turmaId: string): Promise<void> {
  await authFetch("/me/fila-de-espera/turmas", {
    method: "POST",
    body: JSON.stringify({ turmaId }),
  });
}

export async function entrarNaFilaDeAula(ocupacaoId: string): Promise<void> {
  await authFetch("/me/fila-de-espera/aulas", {
    method: "POST",
    body: JSON.stringify({ ocupacaoId }),
  });
}

/**
 * Sair vale **inclusive depois de chamado** — desistir da vez é legítimo, e
 * libera o alvo para o próximo do ciclo.
 */
export async function sairDaFila(id: string): Promise<void> {
  await authFetch(`/me/fila-de-espera/${id}`, { method: "DELETE" });
}

/**
 * Confirmar a vez. **Pode recusar com `409`, e a recusa é normal**: a fila é
 * convite para tentar primeiro, não reserva (LIM-064a), e a vaga pode ter
 * sido tomada pela tela normal durante o prazo (LIM-064f).
 */
export async function confirmarVezNaFila(id: string): Promise<void> {
  await authFetch(`/me/fila-de-espera/${id}/confirmar`, { method: "POST" });
}

/**
 * SPEC-057/TASK-002/D11 — **a janela é opcional, e a ausência dela é o
 * contrato de antes.**
 *
 * Sem `de`/`ate`, o servidor devolve do dia corrente em diante, como sempre.
 * Com os dois, devolve a janela pedida — é o que permite à vista de semana
 * navegar para trás em vez de mostrar sete travessões.
 *
 * Os dois **juntos**: o servidor recusa meia janela com `400`, e mandar um só
 * daqui seria pedir um erro que a tela já sabe evitar.
 */
export async function listMyClasses(janela?: {
  de: string;
  ate: string;
}): Promise<MyClass[]> {
  const q = janela ? `?de=${janela.de}&ate=${janela.ate}` : "";
  const res = await authFetch(`/me/classes${q}`);
  return (await res.json()) as MyClass[];
}

/**
 * SPEC-066/TASK-002 — **a pagina da lista de proximas aulas.**
 *
 * ## Por que nao e `listMyClasses` com um parametro
 *
 * Porque sao duas perguntas com garantias opostas. `listMyClasses` traz a
 * **janela inteira** e nao pode truncar -- a home desenha um mes e precisa de
 * todas as aulas dele. Esta traz **uma pagina** e nunca mais que isso.
 *
 * As duas convivem de proposito: a home e os dois calendarios continuam na de
 * cima, sem mudar uma linha. So a lista de `/minhas-aulas` migra.
 *
 * ## O tipo de retorno e a prova (AC-010)
 *
 * `PaginaDeAulas`, e nao `MyClass[]`. Trocar de volta faz o `typecheck`
 * falhar em `my-classes-list.tsx`, que le `.data` e `.total` -- e **essa e a
 * prova**, porque o `as` daqui nao muda valor nenhum em runtime e nenhum
 * teste de execucao ficaria vermelho sozinho.
 *
 * A prova de runtime e outra, e mora em `api-client-proximas.test.ts`: ela
 * mantem esta funcao REAL e mocka o `fetch`. Sao dois defeitos diferentes com
 * o mesmo sintoma, e por isso duas provas.
 */
export type PaginaDeAulas = {
  data: MyClass[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listProximasAulas(pagina?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginaDeAulas> {
  const params = new URLSearchParams();
  if (pagina?.page !== undefined) params.set("page", String(pagina.page));
  if (pagina?.pageSize !== undefined)
    params.set("pageSize", String(pagina.pageSize));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authFetch(`/me/classes/proximas${q}`);
  return (await res.json()) as PaginaDeAulas;
}

/**
 * SPEC-057/TASK-002 (card 5352) — **a ficha da turma do aluno.**
 *
 * Professor, nível, encontros, quadra e os colegas (nome e nível). Turma em
 * que ele não está matriculado responde **404**, não 403: confirmar que ela
 * existe já seria informação.
 */
export async function getMinhaTurmaDoAluno(
  id: string,
): Promise<TurmaDoAlunoDetalhe> {
  const res = await authFetch(`/me/classes/${id}`);
  return (await res.json()) as TurmaDoAlunoDetalhe;
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
  /** SPEC-054/D7 — valem para CADA reserva do pedido. */
  adicionais?: ItemDoPedido[];
}): Promise<{ reservas: Booking[] }> {
  const { adicionais, ...resto } = dto;
  const res = await authFetch("/bookings", {
    method: "POST",
    // SPEC-054/D9 — lista vazia NÃO vira campo: a impressão digital do pedido
    // só é idêntica à de antes da spec sem ele.
    body: JSON.stringify(comAdicionais(resto, adicionais)),
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
export async function listMyBookingsPaginado(
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

/**
 * SPEC-059/D5 — **as reservas de uma JANELA, para o calendário do aluno.**
 *
 * `listMyBookings` pagina por "futuras/anteriores", que é o vocabulário da
 * tela de reservas; o calendário pensa em mês, e um mês atravessa as duas
 * metades. A rota passou a aceitar `de`/`ate` (SPEC-059/TASK-001), e aqui se
 * pede a janela inteira de uma vez.
 *
 * **O teto de `pageSize` é 100, e ignorá-lo custou uma entrega.** A primeira
 * versão pedia 200 de uma vez; o DTO tem `@Max(100)`, a rota respondeu **400**,
 * e a agenda subiu em produção **sem reserva nenhuma** — calada, porque a tela
 * trata falha de reserva como "mostro as aulas e aviso". Nenhum teste pegou:
 * eles dublam esta função, e dublê não valida query string.
 *
 * Agora pagina até o fim da janela, com teto de segurança: um mês de agenda
 * cabe em uma ou duas voltas, e o laço nunca fica preso se o servidor
 * responder algo inesperado.
 *
 * **O teto é declarado, não escondido** (achado da validação independente de
 * 2026-09-18): com 1.001 reservas na janela, as primeiras 1.000 vinham e a
 * milésima primeira sumia **em silêncio**. Agora a função devolve
 * `truncou: true` quando o teto fecha antes do fim, e quem desenha decide o
 * que dizer. Para dar nisso hoje seria preciso um aluno com mil reservas em
 * dois meses; o silêncio é que não podia ficar.
 */
const PAGINAS_NO_MAXIMO = 10;
const POR_PAGINA = 100;

export async function listMyBookings(janela: {
  de: string;
  ate: string;
}): Promise<ReservasDaJanela> {
  const itens: ItemDaListaDeReservas[] = [];
  let truncou = false;
  for (let page = 1; page <= PAGINAS_NO_MAXIMO; page++) {
    const busca = new URLSearchParams({
      de: janela.de,
      ate: janela.ate,
      page: String(page),
      pageSize: String(POR_PAGINA),
    });
    const res = await authFetch(`/bookings?${busca.toString()}`);
    const corpo = (await res.json()) as {
      data?: ItemDaListaDeReservas[];
      total?: number;
    };
    const pagina = corpo.data ?? [];
    itens.push(...pagina);
    // Acabou quando a página veio incompleta (é a última) ou quando já se tem
    // tudo o que o servidor disse existir.
    if (
      pagina.length < POR_PAGINA ||
      itens.length >= (corpo.total ?? itens.length)
    ) {
      return { itens, truncou: false };
    }
    truncou = page === PAGINAS_NO_MAXIMO;
  }
  return { itens, truncou };
}

/**
 * SPEC-039 — a rota deixou de responder `204` e passa a dizer **quanto voltou**.
 *
 * `null` distingue "não havia o que devolver" de "devolveu zero", e a tela usa
 * essa diferença para ficar calada em vez de prometer um crédito que não
 * existe: reserva de turma e reserva sem aluno não devolvem nada.
 */
export async function cancelBooking(
  id: string,
): Promise<{ creditoDevolvidoCentavos: number | null }> {
  const res = await authFetch(`/bookings/${id}/cancel`, { method: "POST" });
  return (await res.json()) as { creditoDevolvidoCentavos: number | null };
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
/**
 * SPEC-031/AC-004 — os prazos do clube, pela rota do aluno.
 *
 * Devolve o corpo cru (`unknown`) de propósito: quem classifica é
 * `lerCapacidadeOperacao`, e para ela **um `200` sem o campo é informação** —
 * é o sinal de que o back é anterior à SPEC-031. Tipar aqui como
 * `ConfigOperacao` afirmaria a presença do campo, que é justamente o que está
 * em questão.
 *
 * Sem cache, e isso é deliberado: `getMinhaEmpresa` cacheia em módulo, e foi
 * por causa desse cache que o prazo **não** entrou no payload dela (AC-005).
 */
export async function getPrazosDoClube(): Promise<unknown> {
  const res = await authFetch("/me/company/operacao");
  return (await res.json()) as unknown;
}

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

// =====================================================================
// SPEC-047 — aula particular marcada pelo ALUNO
// =====================================================================

export type ProfessorParaAula =
  components["schemas"]["ProfessorParaAlunoResponseDto"];
export type HorariosDeAula = components["schemas"]["HorariosDeAulaResponseDto"];
export type HorarioDeAula = components["schemas"]["HorarioDeAulaDto"];

/**
 * SPEC-047/REQ-002 — quem dá aula particular, e por quanto.
 *
 * **Não é `/teachers`**: aquela é `CompanyAdminGuard` e devolve telefone,
 * e-mail e `usuarioId`. Esta traz só o que o aluno precisa para escolher.
 *
 * Professor sem preço resolvido **não vem** — o servidor já filtrou, e a tela
 * não precisa (nem deve) repetir a regra.
 */
export async function listarProfessoresParaAula(): Promise<
  ProfessorParaAula[]
> {
  const res = await authFetch("/me/professores");
  return (await res.json()) as ProfessorParaAula[];
}

/**
 * SPEC-047/REQ-005 — os horários que a criação **vai aceitar**.
 *
 * A tela não cruza nada: ela desenha o que vem. Cruzar aqui exigiria a janela
 * do professor e os compromissos dele, que o aluno não enxerga — e foi por
 * isso que esta rota existe (ver o serviço no `back`).
 *
 * `atende: false` é diferente de `slots: []`: um manda trocar de dia, o outro
 * manda esperar.
 */
export async function horariosDeAula(
  professorId: string,
  data: string,
): Promise<HorariosDeAula> {
  const res = await authFetch(
    `/me/professores/${professorId}/horarios?data=${data}`,
  );
  return (await res.json()) as HorariosDeAula;
}

/**
 * SPEC-047/D3 — **a tela NUNCA manda `valor`.**
 *
 * O preço vem da tabela do clube; mandar o valor daqui é o DEF-029, que já
 * esteve em produção e permitia ao aluno marcar a própria aula por R$ 0,01.
 * O servidor recusa com `VALOR_NAO_E_DO_ALUNO`, e esta função não tem por
 * onde enviar — é a trava no formato, não só na intenção.
 */
export async function marcarAulaParticular(dto: {
  quadraId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  professorId: string;
  /** SPEC-054 — o preço deles soma ao da aula no servidor, nunca aqui. */
  adicionais?: ItemDoPedido[];
}): Promise<{ reservas: Booking[] }> {
  const res = await authFetch("/bookings", {
    method: "POST",
    body: JSON.stringify(
      comAdicionais(
        {
          quadraId: dto.quadraId,
          data: dto.data,
          slots: [{ horaInicio: dto.horaInicio, horaFim: dto.horaFim }],
          professorId: dto.professorId,
        },
        dto.adicionais,
      ),
    ),
  });
  return (await res.json()) as { reservas: Booking[] };
}

// =====================================================================
// SPEC-054 — adicionais da reserva
// =====================================================================

export type AdicionalDisponivel =
  components["schemas"]["AdicionalDisponivelResponseDto"];
export type AdicionalDaReserva = components["schemas"]["AdicionalDaReservaDto"];
export type ItemDoPedido = components["schemas"]["AdicionalDoPedidoDto"];

/** O corpo com os itens só quando há item — ver `createBooking`. */
function comAdicionais<T extends object>(
  corpo: T,
  adicionais: ItemDoPedido[] | undefined,
): T | (T & { adicionais: ItemDoPedido[] }) {
  return adicionais && adicionais.length > 0 ? { ...corpo, adicionais } : corpo;
}

/**
 * SPEC-054/D8 — os adicionais ativos do clube e **o quanto cabe** no pedido: o
 * menor saldo entre os blocos dos horários escolhidos.
 *
 * **É leitura, não reserva** (LIM-054j): entre ler e confirmar, outra pessoa
 * pode levar a última raquete, e quem decide é o `POST /bookings`.
 *
 * O `404` vira lista vazia, e só ele: é o `back` anterior à SPEC-054, e o passo
 * de adicionais some como se o clube não tivesse nenhum. Qualquer outro erro
 * sobe — falha não é ausência (a lição da `capacidade-operacao`).
 */
export async function adicionaisDisponiveis(
  data: string,
  slots: readonly string[],
): Promise<AdicionalDisponivel[]> {
  const params = new URLSearchParams({
    data,
    slots: [...slots].sort().join(","),
  });
  try {
    const res = await authFetch(`/adicionais/disponiveis?${params.toString()}`);
    return (await res.json()) as AdicionalDisponivel[];
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 404) return [];
    throw erro;
  }
}

// ---------------------------------------------------------------------------
// SPEC-062 — push
// ---------------------------------------------------------------------------

export interface ChavePublicaDePush {
  chave: string;
  /**
   * `sha256` do texto da chave privada. **Não é segredo** — é o insumo do gate
   * que procura a chave nos bundles publicados sem nunca receber a chave. O
   * app não usa; fica no tipo porque a rota devolve, e tipo que esconde campo
   * publicado mente para quem lê.
   */
  impressaoDaPrivada: string;
}

/**
 * SPEC-062/D1b — a chave pública, **sem autenticação e sem cache**.
 *
 * Rota pública de propósito: o navegador assina antes de haver sessão em
 * alguns caminhos, e a chave pública é pública por definição. O que ela não
 * pode é ficar velha — depois de uma rotação do par, assinar com a chave
 * antiga só falharia no envio, longe da causa. Por isso `no-store` no
 * servidor e `cache: "no-store"` aqui.
 *
 * **Não passa por `authFetch`**: não há token a mandar, e o desvio de refresh
 * dele não faz sentido numa rota que nunca responde 401.
 */
export async function getChavePublicaDePush(): Promise<ChavePublicaDePush> {
  const res = await fetch(`${API_URL}/api/v1/push/chave-publica`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw await parseError(res, "Os avisos do clube não estão disponíveis");
  }
  return (await res.json()) as ChavePublicaDePush;
}

export interface AssinaturaParaRegistrar {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * SPEC-062/D2a — registrar o aparelho, que **também é a pergunta** "de quem é
 * esta assinatura?".
 *
 * `204` responde "é sua"; `409 ENDPOINT_EM_USO` responde "é de outra conta", e
 * quem trata isso é a reconciliação (`push-reconciliacao.ts`). Não existe rota
 * de consulta, e não precisa: uma rota que dissesse de quem é um `endpoint`
 * seria um oráculo de assinaturas alheias.
 */
export async function registrarAssinaturaDePush(
  assinatura: AssinaturaParaRegistrar,
): Promise<void> {
  await authFetch("/push/assinatura", {
    method: "POST",
    body: JSON.stringify(assinatura),
  });
}

/**
 * SPEC-062/D2a-2 — remover **a minha** assinatura deste aparelho.
 *
 * O `endpoint` vai no CORPO, não na query: em URL ele apareceria no log de
 * acesso de qualquer proxy no caminho, e ele é credencial (INV-062f). O
 * servidor responde `204` tenha apagado ou não.
 */
export async function removerAssinaturaDePush(endpoint: string): Promise<void> {
  await authFetch("/push/assinatura", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * SPEC-062/D6 — pedir um aviso de teste para si mesmo.
 *
 * É o que torna o cano verificável sem esperar um gesto do clube. Os erros que
 * a tela precisa distinguir vêm por `code`: `TESTE_JA_ENFILEIRADO` (já há um a
 * caminho) e `TESTE_ACIMA_DO_TETO` (três na última hora).
 */
export async function pedirAvisoDeTeste(): Promise<void> {
  await authFetch("/push/teste", { method: "POST" });
}

// ---------------------------------------------------------------------------
// SPEC-065 — a caixa de avisos
// ---------------------------------------------------------------------------

/**
 * Um aviso como a caixa o entrega. **Seis campos, e nenhum de fila.**
 *
 * O `back` recorta por `select` explícito: `estado`, `tentativas`,
 * `ultimo_erro`, `reivindicada_por` e — o mais perigoso — `origem_id` ficam de
 * fora. Aquele último aponta para a ação administrativa, que tem o autor do
 * gesto (SPEC-065/AC-003).
 */
export interface AvisoDaCaixa {
  id: string;
  titulo: string;
  corpo: string;
  destinoUrl: string | null;
  criadaEm: string;
  lidaEm: string | null;
}

/** O envelope de paginação do projeto, mais o contador. */
export interface CaixaDeAvisos extends Paginated<AvisoDaCaixa> {
  naoLidos: number;
}

/**
 * A caixa, paginada.
 *
 * **Ela não obedece a `expira_em`** (SPEC-065/D7): aquela coluna diz até quando
 * vale a pena TENTAR enviar, e quem abre a caixa amanhã está perguntando outra
 * coisa. Avisos em qualquer estado aparecem, inclusive os que o push não
 * conseguiu entregar — é para isso que a caixa existe.
 */
export async function getCaixaDeAvisos(
  page = 1,
  pageSize = 20,
): Promise<CaixaDeAvisos> {
  const res = await authFetch(`/me/avisos?page=${page}&pageSize=${pageSize}`);
  if (!res.ok)
    throw await parseError(res, "Não foi possível carregar seus avisos.");
  return (await res.json()) as CaixaDeAvisos;
}

/**
 * Só o inteiro que o sino precisa.
 *
 * Rota própria, e não `?pageSize=1` na listagem: pedir uma página para ler o
 * rodapé dela seria trazer linha de banco para descartar.
 */
export async function getAvisosNaoLidos(): Promise<number> {
  const res = await authFetch("/me/avisos/nao-lidos");
  if (!res.ok)
    throw await parseError(res, "Não foi possível contar seus avisos.");
  return ((await res.json()) as { naoLidos: number }).naoLidos;
}

/**
 * Marca **todas** como lidas, e devolve quantas foram.
 *
 * Idempotente por construção no servidor (`WHERE lida_em IS NULL`): chamar de
 * novo devolve `0` e não reescreve o `lida_em` já gravado. Duas abas chamando
 * ao mesmo tempo não brigam.
 */
export async function marcarAvisosComoLidos(): Promise<number> {
  const res = await authFetch("/me/avisos/lidas", { method: "POST" });
  if (!res.ok)
    throw await parseError(res, "Não foi possível marcar seus avisos.");
  return ((await res.json()) as { marcadas: number }).marcadas;
}
