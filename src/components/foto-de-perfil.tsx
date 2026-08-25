"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { comprimirImagem, LADO_MAXIMO_PX } from "@/lib/comprimir-imagem";
import {
  enviarMinhaFoto,
  getMinhaFoto,
  removerMinhaFoto,
} from "@/lib/api-client";

/**
 * SPEC-018/TASK-003 — a foto de perfil, ponta a ponta.
 *
 * **A ordem aqui é comprimir e só então enviar.** Uma foto de celular tem
 * uns 4 MB e o servidor recusa acima de 2 MB: sem a compressão local, quem
 * tirasse a foto na quadra levaria 413 depois de esperar o upload inteiro
 * subir pela rede ruim. Comprimir antes é o NFR-001.
 *
 * **E o erro de compressão é mostrado como erro de verdade**, com o texto do
 * `ErroDeCompressao`. É por ali que aparece o caso do aparelho com tela
 * Display P3 (INV-050): "o navegador gravou o perfil de cor" é uma frase
 * ruim, mas é infinitamente melhor que um 422 sem explicação — e diz a quem
 * for investigar exatamente onde olhar.
 *
 * Este componente é **duplicado** no `admin` (ADR-001, poly-repo).
 */

type Estado = "carregando" | "pronto" | "enviando" | "removendo";

export function FotoDePerfil({ nome }: { nome?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    getMinhaFoto()
      .then((foto) => {
        if (vivo) {
          setUrl(foto.url);
          setEstado("pronto");
        }
      })
      .catch((e: unknown) => {
        if (vivo) {
          setErro(mensagem(e, "Não foi possível carregar sua foto."));
          setEstado("pronto");
        }
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function escolher(arquivo: File) {
    setErro(null);
    setEstado("enviando");
    try {
      const comprimida = await comprimirImagem(arquivo);
      const foto = await enviarMinhaFoto(comprimida.arquivo);
      setUrl(foto.url);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível enviar sua foto."));
    } finally {
      setEstado("pronto");
      // Sem isto, escolher **o mesmo arquivo** depois de um erro não dispara
      // `change` de novo, e a tela parece travada.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setErro(null);
    setEstado("removendo");
    try {
      await removerMinhaFoto();
      setUrl(null);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível remover sua foto."));
    } finally {
      setEstado("pronto");
    }
  }

  const ocupado = estado === "enviando" || estado === "removendo";

  return (
    <section className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-border">
          {estado === "carregando" ? (
            <Loader2
              className="size-8 animate-spin text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
          ) : url ? (
            // `img` e não `next/image`: a URL é **assinada e expira**, então
            // não há como otimizá-la no build nem cacheá-la no servidor do
            // Next — e o domínio do bucket mudaria a cada ambiente.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={nome ? `Foto de ${nome}` : "Sua foto de perfil"}
              className="size-full object-cover"
            />
          ) : (
            <User
              className="size-12 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
          )}
        </div>

        {ocupado ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="size-8 animate-spin text-white" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <input
        ref={entrada}
        type="file"
        // `image/*` e não `image/webp`: a pessoa escolhe o JPEG que o celular
        // tirou, e a conversão para WebP é nossa. Filtrar por WebP aqui
        // deixaria a galeria dela vazia.
        accept="image/*"
        className="sr-only"
        aria-label="Escolher foto de perfil"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void escolher(arquivo);
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => entrada.current?.click()}
          className="flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--color-primary-strong)] px-4 text-sm font-bold text-white shadow-[var(--shadow-low)] transition-transform active:scale-95 disabled:opacity-60"
        >
          <Camera className="size-4" aria-hidden="true" />
          {url ? "Trocar foto" : "Adicionar foto"}
        </button>

        {url ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void remover()}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-surface px-4 text-sm font-bold text-[var(--color-text-secondary)] ring-1 ring-border transition-colors hover:text-[var(--color-primary-strong)] disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remover
          </button>
        ) : null}
      </div>

      <p className="max-w-xs text-center text-xs text-[var(--color-text-secondary)]">
        A imagem é reduzida para no máximo {LADO_MAXIMO_PX}px antes de subir, e
        só você a vê.
      </p>

      {erro ? (
        <p role="alert" className="max-w-xs text-center text-sm font-semibold text-[var(--color-danger,#c0392b)]">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

function mensagem(erro: unknown, padrao: string): string {
  // **Um `if (erro instanceof ErroDeCompressao)` morava aqui e foi removido:
  // ele devolvia exatamente o que a linha abaixo já devolve** — a classe
  // estende `Error`. Descoberto sabotando o próprio código: apagar o ramo
  // não deixou nenhum teste vermelho, que é a definição de ramo morto.
  //
  // O que importa continua valendo, e é o motivo de a função existir: a
  // mensagem do `ErroDeCompressao` **é texto de produto**, escrito para ser
  // lido por quem tirou a foto — inclusive a do aparelho com tela Display P3
  // (INV-050), que é o caso mais difícil de diagnosticar depois. Trocar isto
  // por um texto genérico esconderia justamente o erro que a pessoa não
  // causou.
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}
