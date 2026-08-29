"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  getAceitesPendentes,
  registrarAceite,
  type AceitesPendentes,
} from "@/lib/api-client";

/**
 * SPEC-024/TASK-006 — **a tela que resolve o portão.**
 *
 * O `JwtAuthGuard` barra o app inteiro com `403 ACEITE_PENDENTE`; o
 * `api-client` desvia para cá. Sem esta tela, ligar o portão em produção
 * seria um apagão sem saída — é a LIM-024d da spec, e esta tela é a resposta
 * a ela.
 *
 * **Não tem barra de navegação nem botão de voltar**, e isso é de propósito:
 * o mesmo desenho de `/primeiro-acesso`. Oferecer uma saída que o servidor
 * recusa é convidar a pessoa a bater numa porta trancada. A saída real é
 * aceitar — ou sair da conta.
 *
 * **São dois textos independentes**, e a pessoa pode ter um pendente e o
 * outro não: o termo é da plataforma e o contrato é do clube, publicados por
 * gente diferente em momentos diferentes.
 */
export function AceiteView() {
  const router = useRouter();
  const [pendentes, setPendentes] = useState<AceitesPendentes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getAceitesPendentes()
      .then((p) => {
        setPendentes(p);
        // Chegar aqui sem nada pendente acontece de verdade: a pessoa aceitou
        // noutra aba, ou voltou pelo histórico. Mandar de volta é melhor que
        // mostrar uma tela vazia dizendo "aceite o quê?".
        if (!p.termo && !p.contrato) {
          router.replace("/home");
        }
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível carregar os termos.",
        ),
      );
    // Sem `router` nas dependências, e isto foi um defeito de verdade que a
    // prova pegou: com ele, cada render refazia a busca. O `useRouter` do
    // Next devolve objeto estável em produção, então isso passaria
    // despercebido no app e apareceria só como tráfego a mais. O `router` é
    // usado *dentro* do efeito, não é entrada dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aceitar() {
    if (!pendentes) return;
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await registrarAceite({
        termo: pendentes.termo?.versao,
        contrato: pendentes.contrato?.versao,
      });
      // O servidor diz se sobrou alguma coisa. Confiar num "deu certo" e
      // navegar assim mesmo faria a pessoa bater no portão de novo.
      if (resultado.aindaPendente) {
        const novos = await getAceitesPendentes();
        setPendentes(novos);
        setMarcado(false);
        return;
      }
      router.replace("/home");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === "VERSAO_DESATUALIZADA") {
        // O texto mudou enquanto ela lia. Recarregar é obrigatório: aceitar a
        // versão nova sem mostrá-la seria exatamente o que o servidor recusou.
        const novos = await getAceitesPendentes().catch(() => null);
        if (novos) setPendentes(novos);
        setMarcado(false);
      }
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível registrar.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !pendentes) {
    return (
      <main className="app-screen flex min-h-screen items-center justify-center bg-background px-5">
        <p role="alert" className="text-[13px] font-bold text-[var(--color-danger)]">
          {erro}
        </p>
      </main>
    );
  }

  if (!pendentes) {
    return <main className="app-screen min-h-screen bg-background" />;
  }

  const quantos = [pendentes.termo, pendentes.contrato].filter(Boolean).length;

  return (
    <main className="app-screen min-h-screen bg-background pb-32">
      <header className="px-5 pt-8">
        <h1 className="text-[22px] leading-tight font-extrabold text-foreground">
          {quantos > 1 ? "Antes de continuar" : "Um documento para ler"}
        </h1>
        <p className="mt-1 text-[13px] font-bold text-muted">
          {quantos > 1
            ? "São dois documentos: o termo da plataforma e o contrato do seu clube."
            : "Leia e confirme para continuar usando o aplicativo."}
        </p>
      </header>

      <div className="mt-6 space-y-4 px-5">
        {pendentes.termo && (
          <Documento
            icone={<ShieldCheck className="size-4" aria-hidden="true" />}
            titulo="Termo de uso da plataforma"
            versao={pendentes.termo.versao}
            texto={pendentes.termo.texto}
          />
        )}
        {pendentes.contrato && (
          <Documento
            icone={<FileText className="size-4" aria-hidden="true" />}
            titulo="Contrato do clube"
            versao={pendentes.contrato.versao}
            texto={pendentes.contrato.texto}
          />
        )}

        {erro && (
          <p
            role="alert"
            className="rounded-2xl bg-[var(--color-danger)]/10 px-4 py-3 text-[13px] font-bold text-[var(--color-danger)]"
          >
            {erro}
          </p>
        )}
      </div>

      {/*
        A caixa e o botão ficam fixos no rodapé, e o texto rola acima. Numa
        tela de celular, botão no fim de um texto longo é botão que a pessoa
        não acha — e o desenho não pode empurrar ninguém a aceitar sem ver
        onde confirma.
      */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface px-5 pt-4 pb-6">
        <label className="flex items-start gap-3 text-[13px] font-bold text-foreground">
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded"
          />
          <span>
            Li e concordo com {quantos > 1 ? "os documentos acima" : "o documento acima"}.
          </span>
        </label>
        <Button
          className="mt-3 w-full"
          disabled={!marcado || enviando}
          onClick={() => void aceitar()}
        >
          {enviando ? "Registrando…" : "Continuar"}
        </Button>
      </div>
    </main>
  );
}

function Documento({
  icone,
  titulo,
  versao,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  versao: number;
  texto: string;
}) {
  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-low)] ring-1 ring-border">
      <div className="flex items-center gap-2 text-[var(--color-primary-strong)]">
        {icone}
        <h2 className="text-[14px] font-extrabold">{titulo}</h2>
        <span className="ml-auto text-[11px] font-extrabold text-muted">
          versão {versao}
        </span>
      </div>
      {/*
        `whitespace-pre-wrap` porque o texto é PURO, com quebras de linha
        preservadas. Markdown e HTML ficam fora de propósito (spec, dúvida 5):
        HTML vindo do gestor seria XSS na tela do aluno.
      */}
      <p className="mt-3 max-h-[38vh] overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85">
        {texto}
      </p>
    </section>
  );
}
