"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  getMeuCadastro,
  salvarMeuCadastro,
  type MeuCadastro,
} from "@/lib/api-client";

/**
 * SPEC-036/TASK-005 — **"complete seu cadastro", e ele não bloqueia nada.**
 *
 * ## O item 14 do backlog diz "faixa de incentivo NÃO BLOQUEANTE", e é literal
 *
 * Nenhuma reserva é recusada por causa deste número; nenhuma tela fica
 * inacessível. A barra convida, e só. *Sem essa linha escrita, a primeira
 * pessoa a ler `percentual: 29` vai querer usá-lo como requisito* — e aí
 * teria nascido, de um número, uma barreira entre o aluno e a quadra que
 * ninguém decidiu.
 *
 * No `back` existe um gate (`completude-nao-bloqueia.spec.ts`) que fica
 * vermelho no dia em que alguém ler a completude fora do módulo dela.
 *
 * ## O piso é 29%, e não 0%
 *
 * `nome` e `email` são obrigatórios na conta: todo aluno já nasce com dois dos
 * sete. Uma barra em zero mentiria sobre o trabalho já feito, e quem acabou de
 * se cadastrar concluiria que o cadastro não salvou.
 *
 * ## Some sozinha para quem não é aluno
 *
 * A rota tem `@Roles('aluno')` e responde `403` a professor e gestor — o
 * mesmo arranjo da carteira, e pelo mesmo motivo: pintar erro para quem não
 * deveria ver nada foi um defeito real na SPEC-033, visto em produção.
 */
const ROTULO: Record<string, string> = {
  nome: "seu nome",
  email: "seu e-mail",
  telefone: "seu telefone",
  dataNascimento: "data de nascimento",
  emergenciaNome: "contato de emergência",
  emergenciaTelefone: "telefone de emergência",
  nivelId: "seu nível",
};

/** Os que o aluno consegue resolver aqui. `nivelId` é o clube que define. */
const EDITAVEIS = new Set([
  "telefone",
  "dataNascimento",
  "emergenciaNome",
  "emergenciaTelefone",
]);

/** `null` apaga; `""` o servidor recusa com `400` (INV-108). */
function ouNulo(valor: string): string | null {
  return valor.trim() === "" ? null : valor;
}

export function CompleteSeuCadastro() {
  const [cadastro, setCadastro] = useState<MeuCadastro | null>(null);
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [emergenciaNome, setEmergenciaNome] = useState("");
  const [emergenciaTelefone, setEmergenciaTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function aplicar(dados: MeuCadastro) {
    setCadastro(dados);
    setTelefone(dados.telefone ?? "");
    setDataNascimento(dados.dataNascimento ?? "");
    setEmergenciaNome(dados.emergenciaNome ?? "");
    setEmergenciaTelefone(dados.emergenciaTelefone ?? "");
  }

  useEffect(() => {
    let vivo = true;
    getMeuCadastro()
      .then((dados) => {
        if (vivo) aplicar(dados);
      })
      .catch(() => {
        // **Silêncio de propósito.** `403` é professor ou gestor; `404` é
        // conta sem ficha de aluno. Nos dois a resposta certa é não aparecer
        // — pintar "não foi possível carregar seu cadastro" no perfil de um
        // professor foi exatamente o defeito da carteira na SPEC-033.
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      aplicar(
        await salvarMeuCadastro({
          telefone: ouNulo(telefone) ?? undefined,
          dataNascimento: ouNulo(dataNascimento),
          emergenciaNome: ouNulo(emergenciaNome),
          emergenciaTelefone: ouNulo(emergenciaTelefone),
        }),
      );
      setAberto(false);
    } catch (e) {
      // Pelo `code`, nunca pelo texto — a mesma regra do D7 da SPEC-033.
      const code = e instanceof ApiError ? e.code : undefined;
      setErro(
        code === "DATA_NASCIMENTO_INVALIDA"
          ? "Confira a data: ela não pode estar no futuro."
          : e instanceof ApiError
            ? e.message
            : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!cadastro) return null;

  const { percentual, faltam } = cadastro.cadastro;

  /**
   * **Cadastro completo não vira selo de parabéns.**
   *
   * Uma faixa verde permanente ocuparia espaço numa tela de 390px para dizer
   * "não há nada a fazer". Sumir é a resposta certa — e é o que a carteira
   * sem saldo também faz.
   */
  if (faltam.length === 0) return null;

  const pendentes = faltam.filter((c) => EDITAVEIS.has(c));

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-foreground">
          Complete seu cadastro
        </h2>
        <span className="shrink-0 text-[13px] font-extrabold text-[var(--color-primary-strong)]">
          {percentual}%
        </span>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-container)]"
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Completude do seu cadastro"
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>

      <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
        {/* O número sozinho não diz o que fazer. A lista diz. */}
        Falta {faltam.map((c) => ROTULO[c] ?? c).join(", ")}.
        {pendentes.length === 0
          ? " O clube preenche o que falta."
          : " Nada aqui impede você de reservar."}
      </p>

      {pendentes.length === 0 ? null : !aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-3 w-full rounded-2xl bg-[var(--color-primary-strong)] py-3 text-[13px] font-extrabold text-white active:scale-[0.99]"
        >
          Completar agora
        </button>
      ) : (
        <form
          onSubmit={(e) => void salvar(e)}
          className="mt-3 flex flex-col gap-3"
        >
          {pendentes.includes("telefone") ? (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold">Telefone</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={salvando}
                inputMode="tel"
                className="h-11 rounded-xl border border-border bg-background px-3 text-[14px]"
              />
            </label>
          ) : null}

          {pendentes.includes("dataNascimento") ? (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold">Data de nascimento</span>
              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                disabled={salvando}
                className="h-11 rounded-xl border border-border bg-background px-3 text-[14px]"
              />
            </label>
          ) : null}

          {pendentes.includes("emergenciaNome") ? (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold">
                Contato de emergência
              </span>
              <input
                value={emergenciaNome}
                onChange={(e) => setEmergenciaNome(e.target.value)}
                disabled={salvando}
                placeholder="Quem avisar, se precisar"
                className="h-11 rounded-xl border border-border bg-background px-3 text-[14px]"
              />
            </label>
          ) : null}

          {pendentes.includes("emergenciaTelefone") ? (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold">
                Telefone de emergência
              </span>
              <input
                value={emergenciaTelefone}
                onChange={(e) => setEmergenciaTelefone(e.target.value)}
                disabled={salvando}
                inputMode="tel"
                className="h-11 rounded-xl border border-border bg-background px-3 text-[14px]"
              />
            </label>
          ) : null}

          {erro ? (
            <p
              role="alert"
              className="text-[12px] font-bold text-[var(--color-error)]"
            >
              {erro}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={salvando}
            className="rounded-2xl bg-[var(--color-primary-strong)] py-3 text-[13px] font-extrabold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}
    </section>
  );
}
