"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, MapPin, Wallet } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  getMinhaCarteira,
  horariosDeAula,
  listarProfessoresParaAula,
  marcarAulaParticular,
  type HorarioDeAula,
  type HorariosDeAula,
  type ProfessorParaAula,
} from "@/lib/api-client";
import { hojeNoClubeIso, isoDeOffsetNoClube } from "@/lib/fuso";

const DIAS_SEMANA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * As 30 datas, **no fuso do clube e na montagem da tela** — as duas metades da
 * DEF-020, copiadas de `court-booking.tsx` de propósito e não por descuido: a
 * função lá é privada daquele arquivo, e extrair as duas para um módulo comum
 * é mudança na tela que está em produção. Fica declarado aqui; se aparecer uma
 * terceira, extrai-se.
 */
function datasDisponiveis(): string[] {
  return Array.from({ length: 30 }, (_, i) => isoDeOffsetNoClube(i));
}

function labelDoDia(iso: string): { dia: string; numero: string } {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return {
    dia: DIAS_SEMANA_CURTO[data.getUTCDay()],
    numero: String(dia).padStart(2, "0"),
  };
}

function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return `${DIAS_SEMANA_CURTO[data.getUTCDay()]}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * SPEC-047/TASK-004 — **o aluno marca a própria aula particular.**
 *
 * ## O que esta tela NÃO decide
 *
 * Ela não escolhe a quadra, não filtra horário e não calcula preço. Os três
 * vêm prontos do servidor (`GET /me/professores/:id/horarios`), e é a LIM-047e
 * virando REQ-005: marcar aula depende de três fatos — quadra livre, janela do
 * professor, compromisso do professor — e o aluno **enxerga um**. Uma tela que
 * cruzasse o que consegue ver ofereceria horário que a criação recusa.
 *
 * Por isso aqui não há `??`, `filter` de horário nem multiplicação de preço.
 * **Toda regra que a tela repetisse seria uma regra para divergir.**
 *
 * ## E o preço nunca sobe daqui
 *
 * `marcarAulaParticular` não tem campo `valor`. O DEF-029 esteve em produção
 * permitindo ao aluno marcar a própria aula por R$ 0,01 — a trava está no
 * servidor (`VALOR_NAO_E_DO_ALUNO`), e aqui está no formato da função, para
 * não haver por onde tentar.
 *
 * ## A carteira é a única recusa que a grade não antecipa (LIM-047f)
 *
 * O saldo é do **aluno**, a grade é do **professor**. Sumir com o dia inteiro
 * de quem está sem crédito trocaria uma frase acionável por um desaparecimento
 * sem motivo — então a tela mostra saldo e preço **antes** da escolha, e é
 * isso que fecha a limitação.
 */
export function AulaParticular() {
  const [professores, setProfessores] = useState<ProfessorParaAula[]>([]);
  const [carregandoProfs, setCarregandoProfs] = useState(true);
  const [erroProfs, setErroProfs] = useState<string | null>(null);

  const [escolhido, setEscolhido] = useState<ProfessorParaAula | null>(null);
  const [data, setData] = useState(() => hojeNoClubeIso());
  const [datasDaGrade] = useState(datasDisponiveis);
  const [grade, setGrade] = useState<HorariosDeAula | null>(null);
  const [carregandoGrade, setCarregandoGrade] = useState(false);
  const [erroGrade, setErroGrade] = useState<string | null>(null);

  const [slot, setSlot] = useState<HorarioDeAula | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [erroMarcar, setErroMarcar] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(false);

  const [saldoCentavos, setSaldoCentavos] = useState<number | null>(null);

  useEffect(() => {
    listarProfessoresParaAula()
      .then(setProfessores)
      .catch((err: unknown) => {
        setErroProfs(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os professores.",
        );
      })
      .finally(() => setCarregandoProfs(false));

    // O saldo em paralelo, e uma falha aqui **não derruba a tela**: sem ele a
    // pessoa perde o aviso de crédito, não a possibilidade de marcar. Quem
    // decide de verdade é o servidor, na criação.
    getMinhaCarteira()
      .then((extrato) => setSaldoCentavos(extrato.saldoCentavos))
      .catch(() => undefined);
  }, []);

  async function carregarGrade(professorId: string, dia: string) {
    setCarregandoGrade(true);
    setErroGrade(null);
    setSlot(null);
    // O erro de marcar morre ao trocar de dia ou de professor. Sem esta linha
    // ele sobrevive, e "não foi possível marcar" de terça fica em cima da
    // grade de quarta — a correção que a revisão adversarial do
    // `court-booking` já cobrou uma vez.
    setErroMarcar(null);
    try {
      setGrade(await horariosDeAula(professorId, dia));
    } catch (err) {
      setGrade(null);
      setErroGrade(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os horários.",
      );
    } finally {
      setCarregandoGrade(false);
    }
  }

  function escolherProfessor(professor: ProfessorParaAula) {
    setEscolhido(professor);
    setMarcada(false);
    const hoje = hojeNoClubeIso();
    setData(hoje);
    void carregarGrade(professor.id, hoje);
  }

  async function confirmar() {
    if (!escolhido || !slot) return;
    setErroMarcar(null);
    setMarcando(true);
    try {
      await marcarAulaParticular({
        quadraId: slot.quadraId,
        data,
        horaInicio: slot.horaInicio,
        horaFim: slot.horaFim,
        professorId: escolhido.id,
      });
      setMarcada(true);
      // A carteira mudou: a aula foi debitada. Reler evita a tela afirmar um
      // saldo que já não é o dela.
      getMinhaCarteira()
        .then((extrato) => setSaldoCentavos(extrato.saldoCentavos))
        .catch(() => undefined);
    } catch (err) {
      setErroMarcar(
        err instanceof ApiError
          ? err.message
          : "Não foi possível marcar a aula.",
      );
    } finally {
      setMarcando(false);
    }
  }

  const precoCentavos = escolhido ? Math.round(escolhido.precoAula * 100) : 0;
  const faltaCredito =
    saldoCentavos !== null && escolhido !== null && saldoCentavos < precoCentavos;

  // ------------------------------------------------------------------
  // Depois de marcar
  // ------------------------------------------------------------------
  if (marcada && escolhido && slot) {
    return (
      <div className="space-y-5 px-5">
        <section className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-lift)] ring-1 ring-border">
          <CheckCircle2
            className="mx-auto size-12 text-[var(--color-success)]"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-xl font-extrabold">Aula marcada</h2>
          <p className="mt-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
            {escolhido.nome} · {formatarDataCurta(data)} · {slot.horaInicio}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text-secondary)]">
            {slot.quadraNome}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/reservas"
              className="flex h-12 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-[var(--color-primary-foreground)]"
            >
              Ver minhas reservas
            </Link>
            <button
              type="button"
              onClick={() => {
                setMarcada(false);
                setEscolhido(null);
                setGrade(null);
                setSlot(null);
              }}
              className="h-12 rounded-2xl text-[15px] font-bold text-[var(--color-primary-strong)]"
            >
              Marcar outra
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Passo 1 — o professor
  // ------------------------------------------------------------------
  if (!escolhido) {
    return (
      <div className="space-y-5 px-5">
        <section className="rounded-3xl bg-[var(--color-court-dark)] p-4 text-white shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/80 uppercase">
                <span className="size-2 rounded-full bg-[var(--color-secondary)]" />
                Aula particular
              </div>
              <h1 className="text-[28px] leading-[1.04] font-extrabold">
                Escolha o professor
              </h1>
              <p className="mt-1.5 text-[13px] font-semibold text-white/70">
                {carregandoProfs
                  ? "Buscando professores..."
                  : `${professores.length} ${professores.length === 1 ? "professor disponível" : "professores disponíveis"}`}
              </p>
            </div>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-[var(--color-secondary)] text-[var(--color-on-secondary-container)]">
              <TennisBallIcon className="size-7" aria-hidden="true" />
            </span>
          </div>
        </section>

        {saldoCentavos !== null ? (
          <p className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
            <Wallet className="size-4 shrink-0" aria-hidden="true" />
            Seu saldo: {reais(saldoCentavos / 100)}
          </p>
        ) : null}

        {erroProfs ? (
          <p
            role="alert"
            className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border"
          >
            {erroProfs}
          </p>
        ) : carregandoProfs ? (
          <p className="px-1 text-sm font-semibold text-[var(--color-text-secondary)]">
            Carregando...
          </p>
        ) : professores.length === 0 ? (
          /*
            Lista vazia tem **uma** causa visível daqui e duas reais: o clube
            não definiu preço nenhum, ou não tem professor ativo. A tela não
            sabe qual é — e prometer "em breve" seria inventar. Manda falar com
            quem sabe.
          */
          <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
            O clube ainda não tem aula particular disponível. Fale com a
            recepção.
          </p>
        ) : (
          <ul className="space-y-3">
            {professores.map((professor) => (
              <li key={professor.id}>
                <button
                  type="button"
                  onClick={() => escolherProfessor(professor)}
                  className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3 text-left shadow-[var(--shadow-low)] ring-1 ring-border"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-primary-container)] text-[15px] font-extrabold text-[var(--color-on-primary-container)]">
                    {professor.fotoUrl ? (
                      // Sem `next/image`: a URL é de CDN externo, e a planta
                      // declara que este projeto não carrega otimizador para
                      // host de terceiro (mesma razão da `CapaDaQuadra`).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={professor.fotoUrl}
                        alt={`Foto de ${professor.nome}`}
                        className="size-full object-cover"
                      />
                    ) : (
                      professor.nome.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold">
                      {professor.nome}
                    </span>
                    <span className="block text-[13px] font-semibold text-[var(--color-text-secondary)]">
                      {reais(professor.precoAula)} por aula
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Passo 2 — o dia e a hora
  // ------------------------------------------------------------------
  return (
    <div className="space-y-5 px-5">
      <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEscolhido(null);
              setGrade(null);
              setSlot(null);
            }}
            aria-label="Trocar de professor"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-container)] text-[var(--color-text-secondary)]"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold">
              {escolhido.nome}
            </p>
            <p className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {reais(escolhido.precoAula)} por aula
            </p>
          </div>
        </div>
      </section>

      {/*
        SPEC-047/LIM-047f — **o aviso de saldo vem ANTES da escolha.**

        É a única recusa da criação que a grade não antecipa: saldo é do aluno,
        a grade é do professor. O botão continua habilitado de propósito — quem
        decide é o servidor, e travar aqui com um saldo lido há um minuto
        prenderia quem acabou de receber crédito.
      */}
      {faltaCredito && saldoCentavos !== null ? (
        <p className="flex items-start gap-2 rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-warning)] shadow-[var(--shadow-low)] ring-1 ring-border">
          <Wallet className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Seu saldo é {reais(saldoCentavos / 100)} e a aula custa{" "}
            {reais(escolhido.precoAula)}. Faltam{" "}
            {reais((precoCentavos - saldoCentavos) / 100)} —{" "}
            <Link href="/perfil" className="underline">
              veja sua carteira
            </Link>
            .
          </span>
        </p>
      ) : null}

      <section>
        <div className="mb-3">
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">
            Dia
          </p>
          <h2 className="text-xl font-extrabold">Escolha a data</h2>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {datasDaGrade.map((iso) => {
            const { dia, numero } = labelDoDia(iso);
            const selecionado = iso === data;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  setData(iso);
                  void carregarGrade(escolhido.id, iso);
                }}
                aria-pressed={selecionado}
                className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl text-[13px] font-bold ${
                  selecionado
                    ? "bg-primary text-[var(--color-primary-foreground)]"
                    : "bg-surface text-[var(--color-text-secondary)] ring-1 ring-border"
                }`}
              >
                <span className="text-[10px] tracking-[0.1em]">{dia}</span>
                <span className="text-[17px] font-extrabold">{numero}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--color-primary-strong)] uppercase">
            Hora
          </p>
          <h2 className="text-xl font-extrabold">Escolha o horário</h2>
        </div>

        {erroGrade ? (
          <p
            role="alert"
            className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-error)] shadow-[var(--shadow-low)] ring-1 ring-border"
          >
            {erroGrade}
          </p>
        ) : carregandoGrade || grade === null ? (
          <p className="px-1 text-sm font-semibold text-[var(--color-text-secondary)]">
            Carregando horários...
          </p>
        ) : !grade.atende ? (
          /*
            **`atende: false` não é "está cheio".** O servidor distingue os
            dois porque a pessoa faz coisas diferentes com cada um: aqui ela
            troca de dia; abaixo, ela espera ou troca de professor. Mostrar a
            mesma frase vazia nos dois casos seria devolver silêncio.
          */
          <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
            {escolhido.nome} não dá aula neste dia. Escolha outra data.
          </p>
        ) : grade.slots.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-low)] ring-1 ring-border">
            Nenhum horário livre neste dia
            {grade.janela
              ? ` (ele atende das ${grade.janela.horaInicio} às ${grade.janela.horaFim})`
              : ""}
            . Tente outra data.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {grade.slots.map((h) => {
              const selecionado = slot?.horaInicio === h.horaInicio;
              return (
                <button
                  key={h.horaInicio}
                  type="button"
                  onClick={() => setSlot(h)}
                  aria-pressed={selecionado}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 text-[15px] font-extrabold ${
                    selecionado
                      ? "bg-primary text-[var(--color-primary-foreground)]"
                      : "bg-surface text-[var(--color-text-primary)] ring-1 ring-border"
                  }`}
                >
                  {h.horaInicio}
                  <span
                    className={`mt-0.5 max-w-full truncate text-[10px] font-bold ${
                      selecionado
                        ? "text-[var(--color-primary-foreground)]/80"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {h.quadraNome}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {slot ? (
        <section className="space-y-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-border">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {formatarDataCurta(data)} · {slot.horaInicio}–{slot.horaFim}
          </p>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {slot.quadraNome}
          </p>
          <p className="text-[22px] font-extrabold">
            {reais(escolhido.precoAula)}
          </p>
          {/*
            **O preço é o do professor, e inclui a quadra** (D5). A tela não
            soma nada: somar aqui criaria um segundo cálculo de preço, e o que
            a carteira debita é o que o servidor gravou.
          */}
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Valor da aula, quadra incluída.
          </p>

          {erroMarcar ? (
            <p
              role="alert"
              className="text-sm font-semibold text-[var(--color-error)]"
            >
              {erroMarcar}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={marcando}
            onClick={() => void confirmar()}
            className="h-12 w-full rounded-2xl text-[15px] font-bold"
          >
            {marcando ? "Marcando..." : "Confirmar aula"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
