"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/campo-senha";
import { ApiError, getMe, trocarSenha } from "@/lib/api-client";
import { rotaInicial } from "@/lib/rota-inicial";
import { saveAccessToken } from "@/lib/auth-storage";

/**
 * SPEC-009/REQ-004 — primeiro acesso.
 *
 * Quem entrou com a senha temporária recebida do admin não acessa mais nada
 * até trocá-la: a trava é do servidor (INV-008), e esta tela é onde a
 * pessoa sai dela. A senha atual é pedida porque ela acabou de ser digitada
 * no login — e porque a temporária circulou por WhatsApp, então confirmar
 * posse antes de fixar a definitiva não é burocracia.
 */
export function PrimeiroAcessoForm() {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (novaSenha !== confirmacao) {
      setError("As duas senhas não são iguais.");
      return;
    }

    setLoading(true);
    try {
      const { accessToken } = await trocarSenha({ senhaAtual, novaSenha });
      // O backend revoga as sessões antigas e devolve um par novo (AC-009):
      // sem guardar este token, a pessoa cairia no login logo depois de
      // fazer exatamente o que o sistema exigiu.
      saveAccessToken(accessToken);
      // SPEC-013 — o destino depende do papel, e `trocarSenha` devolve só o
      // token. Uma ida a `/auth/me` custa menos que mandar o professor para
      // a Home do aluno, onde o servidor recusaria tudo e ele veria um erro
      // logo depois de fazer exatamente o que o sistema exigiu.
      const usuario = await getMe();
      router.push(rotaInicial(usuario.role));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível trocar a senha. Tente de novo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <CampoSenha
        id="senha-atual"
        label="Senha temporária"
        valor={senhaAtual}
        onChange={setSenhaAtual}
        disabled={loading}
        autoComplete="current-password"
        placeholder="A que você recebeu"
      />
      <CampoSenha
        id="nova-senha"
        label="Sua nova senha"
        valor={novaSenha}
        onChange={setNovaSenha}
        disabled={loading}
      />
      <CampoSenha
        id="confirmacao"
        label="Repita a nova senha"
        valor={confirmacao}
        onChange={setConfirmacao}
        disabled={loading}
      />

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? "Salvando..." : "Criar minha senha"}
      </Button>
    </form>
  );
}
