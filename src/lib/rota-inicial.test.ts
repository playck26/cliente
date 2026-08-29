import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rotaInicial } from "./rota-inicial";

/**
 * **DEF-018 — o gate que faltava, e por que ele precisa existir.**
 *
 * Este projeto já entregou a tela do aluno ao professor **três vezes**:
 *
 * | Quando | Onde |
 * |---|---|
 * | antes do DEF-011 | `perfil-view` renderizava a barra do aluno |
 * | DEF-011 (2026-08-26) | a `BottomNav` não conhecia papel |
 * | **DEF-018 (2026-08-29)** | a tela de aceite mandava todos para `/home` |
 *
 * As três vezes o aviso existia. O comentário de `rota-inicial.ts` diz, com
 * todas as letras, que o helper existe *"porque são três portas de entrada, e
 * um papel novo esquecido em uma delas manda a pessoa para uma tela que o
 * servidor recusa"*. A SPEC-024 abriu a **quarta porta** e não o usou.
 *
 * **A lição que este arquivo aplica é a do DEF-016: aviso não é mecanismo.**
 * Comentário não impede; teste impede. Este gate varre o código e recusa
 * navegação para uma home de papel escrita à mão.
 */

const RAIZ = join(__dirname, "..");

/** As homes de papel. Navegar para uma delas à mão é o defeito. */
const DESTINOS_DE_PAPEL = ["/home", "/minhas-turmas"];

/**
 * O único arquivo autorizado a conhecer os dois destinos.
 *
 * `bottom-nav.tsx` também os cita, e legitimamente: ele **desenha** os itens
 * do menu, não navega depois de autenticar. A distinção que este gate faz é
 * `router.push`/`router.replace` — ir para um lugar —, não `href`.
 */
const ARQUIVO_AUTORIZADO = "lib/rota-inicial.ts";

/**
 * **Exceções declaradas, com motivo — e a lista é curta de propósito.**
 *
 * O defeito que este gate persegue é navegar para a home de um papel a partir
 * de uma tela que **mais de um papel alcança**: login, primeiro acesso,
 * aceite, convite. Nessas, o destino depende de quem está lá.
 *
 * Voltar para a própria área, de dentro dela, é outra coisa: só o professor
 * chega em `/minhas-turmas/[id]`, então o "voltar" dele não pode errar de
 * papel. A exceção existe para o gate não obrigar um `rotaInicial()` onde ele
 * não significa nada.
 *
 * **Entrar nesta lista tem de ser uma decisão, não um reflexo.** Se a tela é
 * alcançada por mais de um papel, ela não pertence aqui.
 */
const EXCECOES = new Map<string, string>([
  [
    "components/minha-turma-detalhe.tsx",
    'o "voltar" para a grade do professor, de dentro de uma tela que só ele alcança',
  ],
]);

function arquivosDeCodigo(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeCodigo(caminho));
      continue;
    }
    if (!/\.tsx?$/.test(nome) || /\.test\.tsx?$/.test(nome)) continue;
    saida.push(caminho);
  }
  return saida;
}

describe("rotaInicial", () => {
  it("manda o professor para a grade dele", () => {
    expect(rotaInicial("professor")).toBe("/minhas-turmas");
  });

  it("e todo o resto para a home do aluno", () => {
    expect(rotaInicial("aluno")).toBe("/home");
    expect(rotaInicial("company_admin")).toBe("/home");
  });
});

describe("DEF-018 — ninguém navega para uma home de papel à mão", () => {
  const arquivos = arquivosDeCodigo(RAIZ);

  it("varreu o código de verdade — senão o teste passa por vacuidade", () => {
    expect(arquivos.length).toBeGreaterThan(20);
    expect(
      arquivos.some((a) => a.endsWith(ARQUIVO_AUTORIZADO.replace("/", "\\")) || a.endsWith(ARQUIVO_AUTORIZADO)),
    ).toBe(true);
  });

  it("nenhum `router.push`/`replace` aponta para /home ou /minhas-turmas", () => {
    const infratores: string[] = [];

    for (const caminho of arquivos) {
      const relativo = caminho.replace(/\\/g, "/").split("/src/")[1] ?? "";
      if (relativo === ARQUIVO_AUTORIZADO || EXCECOES.has(relativo)) continue;
      const conteudo = readFileSync(caminho, "utf8");

      for (const destino of DESTINOS_DE_PAPEL) {
        // `router.push("/home")`, `router.replace('/home')`, com ou sem
        // espaço. Não pega `href="/home"` — link no menu é desenho, e o
        // `BottomNav` já sabe de papel desde o DEF-011.
        const padrao = new RegExp(
          `router\\.(push|replace)\\(\\s*["'\`]${destino}["'\`]`,
        );
        if (padrao.test(conteudo)) {
          infratores.push(`${relativo} → ${destino}`);
        }
      }
    }

    // A mensagem precisa dizer QUAL arquivo, senão o próximo a ver isto
    // vermelho gasta a primeira meia hora descobrindo onde olhar. E o que
    // fazer: ou usar `rotaInicial(papel)`, ou declarar a exceção com motivo.
    expect(infratores).toEqual([]);
  });
});
