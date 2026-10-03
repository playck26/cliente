"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api-client";
import { rotaInicial } from "@/lib/rota-inicial";
import { saveAccessToken, savePapel } from "@/lib/auth-storage";
import { lerNomesDeTipo } from "@/lib/nomes-de-tipo";

/**
 * SPEC-084 — **os campos do login fotográfico.** A foto, a marca, o texto e o
 * aviso pós-ativação moram na página (`app/login/page.tsx`); aqui fica só o
 * formulário, com o comportamento de sempre.
 *
 * O comportamento é o da base e está congelado em
 * `login-form.caracterizacao.test.tsx`: pedidos, armazenamento, destino por
 * papel, erros, carregamento, senha visível e ajuda. Mexer aqui é passar por
 * aquele arquivo sem mudá-lo.
 *
 * **Sem "Ainda não tem conta? Cadastre-se" (I5, 2026-10-02):** o aluno não se
 * cadastra sozinho, e o Israel pediu para tirar o convite ao cadastro do login.
 *
 * As cores são locais do login (DESIGN.md, “Login fotográfico”), e cada uma
 * foi escolhida pelo contraste medido sobre foto, branco, preto e foto
 * ausente (TEST-002), não pela aparência:
 *
 * - campos: superfície preta translúcida e borda de 2 px, branca a 45%
 *   (≥ 3:1 contra o que está dentro e fora dela). A primeira versão tinha 1 px
 *   a 55% e o medidor reprovou (2,81:1): numa posição fracionária o navegador
 *   reparte a linha em duas a meia intensidade. Com 2 px sempre sobra uma
 *   linha inteira. Texto branco a 16 px em toda largura — abaixo disso o
 *   Safari do iPhone dá zoom no foco;
 * - o rótulo mora DENTRO da caixa, no alto, e o texto digitado logo abaixo
 *   (I10, 2026-10-02: o Israel pediu para economizar a linha que o rótulo
 *   ocupava em cima). Continua um `<label for>` visível, não placeholder, e
 *   altura e posições em `rem` acompanham a fonte aumentada do sistema;
 * - o preenchimento automático do navegador pinta o campo de azul-claro com
 *   texto escuro (o print do Israel no computador): com o rótulo branco dentro
 *   da caixa, ele sumiria. A sombra interna opaca cobre esse fundo, e o
 *   `-webkit-text-fill-color` devolve o texto branco — o `color` do navegador
 *   ali é `!important` e não se sobrescreve;
 * - verde-lima `#B9E52B` para ícones, links e o botão, com texto `#12160F`;
 * - erro e ajuda em superfície opaca escura: o vermelho `#ED0040` do tema dá
 *   4,35:1 sobre o fundo escuro e ficou de fora;
 * - nada some por opacidade enquanto carrega: o primitivo `Input`/`Button`
 *   aplica `opacity-50` no desabilitado, e o "Entrando..." precisa continuar
 *   legível.
 */
const CAMPO =
  "h-[3.75rem] rounded-2xl border-2 border-white/45 bg-black/45 pt-6 pb-1 text-base text-white placeholder:text-white/60 md:text-base focus-visible:border-[#B9E52B] focus-visible:ring-2 focus-visible:ring-[#B9E52B] disabled:bg-black/45 disabled:opacity-100 autofill:shadow-[inset_0_0_0_100rem_#15191B] autofill:[-webkit-text-fill-color:#fff] autofill:caret-white";

const ROTULO =
  "pointer-events-none absolute top-[0.625rem] left-[calc(3rem_+_2px)] text-xs leading-4 font-bold text-white/75";

const FOCO =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#B9E52B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D10]";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ajudaSenha, setAjudaSenha] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, senha });
      saveAccessToken(result.accessToken);
      // O papel vai junto do token: é o que permite ao `BottomNav` acertar
      // a barra na PRIMEIRA pintura, sem esperar o `getMe()`.
      savePapel(result.usuario.role);
      // SPEC-059 — **aquece o nome dos tipos de reserva no login.**
      //
      // Sem isto, a primeira visita a "Fazer reserva" ainda mostraria
      // "Quadra" por um quadro antes de virar o nome do clube: o
      // armazenamento só ajuda a partir da segunda. `void` porque nada nesta
      // tela depende do resultado, e `lerNomesDeTipo` nunca lança.
      void lerNomesDeTipo();
      router.push(result.usuario.senhaTemporaria ? "/primeiro-acesso" : rotaInicial(result.usuario.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="relative">
        <Mail className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#B9E52B]" aria-hidden="true" />
        <Label htmlFor="email" className={ROTULO}>E-mail</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className={`${CAMPO} pl-12`} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#B9E52B]" aria-hidden="true" />
          <Label htmlFor="senha" className={ROTULO}>Senha</Label>
          <Input id="senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} disabled={loading} className={`${CAMPO} pr-14 pl-12`} />
          <button type="button" onClick={() => setMostrarSenha((v) => !v)} className={`absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/85 hover:text-white ${FOCO}`} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>
            {mostrarSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <button type="button" onClick={() => setAjudaSenha((v) => !v)} aria-expanded={ajudaSenha} className={`min-h-11 self-end rounded-lg px-1 text-sm font-extrabold text-[#B9E52B] ${FOCO}`}>
          Esqueceu a senha?
        </button>
        {ajudaSenha ? (
          <p className="rounded-2xl bg-[#161A1D] p-3 text-sm leading-snug font-medium break-words text-[#E6EAE3] ring-1 ring-white/20">
            Ainda não enviamos e-mail de recuperação. Peça ao seu clube para gerar uma senha nova; ela chega por WhatsApp e você troca no primeiro acesso.
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-3 rounded-2xl bg-[#1E1517] p-3 text-sm leading-snug font-semibold break-words text-white ring-1 ring-[#FF9AAE]/60">
          <CircleAlert className="mt-px size-5 shrink-0 text-[#FF9AAE]" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className={`h-[52px] w-full rounded-2xl bg-[#B9E52B] text-base font-extrabold text-[#12160F] hover:bg-[#C6EF3F] disabled:opacity-100 ${FOCO} focus-visible:ring-[3px] focus-visible:ring-white`}>
        {loading ? "Entrando..." : "Entrar"}
        {!loading ? <ArrowRight className="size-5" aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
