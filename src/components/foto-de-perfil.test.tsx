import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FotoDePerfil } from "./foto-de-perfil";
import { ErroDeCompressao } from "@/lib/comprimir-imagem";

/**
 * SPEC-018/TASK-003 — as provas da tela de foto.
 *
 * O que este arquivo guarda é a **ordem** e a **mensagem**:
 *
 * - comprimir acontece ANTES de enviar. Na ordem inversa, quem tira foto no
 *   celular sobe 4 MB por uma rede ruim para levar 413 no fim;
 * - o que sobe é o arquivo COMPRIMIDO, não o original;
 * - o erro de compressão chega à tela com o texto dele. É por ali que
 *   aparece o caso do aparelho Display P3 (INV-050), que é o mais difícil
 *   de diagnosticar depois — e o único que a pessoa não causou.
 */

const comprimirImagem = vi.hoisted(() => vi.fn());
const getMinhaFoto = vi.hoisted(() => vi.fn());
const enviarMinhaFoto = vi.hoisted(() => vi.fn());
const removerMinhaFoto = vi.hoisted(() => vi.fn());

vi.mock("@/lib/comprimir-imagem", async () => {
  const real = await vi.importActual<typeof import("@/lib/comprimir-imagem")>(
    "@/lib/comprimir-imagem",
  );
  // `ErroDeCompressao` e as constantes vêm do módulo REAL: o componente faz
  // `instanceof`, e uma classe dublê passaria no teste e falharia no ar.
  return { ...real, comprimirImagem };
});

vi.mock("@/lib/api-client", () => ({
  getMinhaFoto,
  enviarMinhaFoto,
  removerMinhaFoto,
}));

const ORIGINAL = new File([new Uint8Array(4 * 1024 * 1024)], "foto.jpg", {
  type: "image/jpeg",
});
const COMPRIMIDA = new File([new Uint8Array(80 * 1024)], "foto.webp", {
  type: "image/webp",
});

beforeEach(() => {
  vi.clearAllMocks();
  getMinhaFoto.mockResolvedValue({ url: null });
  comprimirImagem.mockResolvedValue({
    arquivo: COMPRIMIDA,
    largura: 2000,
    altura: 1500,
    bytesOriginais: ORIGINAL.size,
    bytesFinais: COMPRIMIDA.size,
  });
  enviarMinhaFoto.mockResolvedValue({ url: "https://assinada/nova" });
  removerMinhaFoto.mockResolvedValue(undefined);
});

/**
 * `fireEvent` e não `user-event`: a planta deste repositório declara a lista
 * de dependências, e acrescentar uma por causa de um teste é mudança
 * estrutural. `fireEvent` é o que as outras suítes daqui já usam.
 */
function escolherArquivo(arquivo: File) {
  const entrada = screen.getByLabelText("Escolher foto de perfil");
  fireEvent.change(entrada, { target: { files: [arquivo] } });
}

describe("FotoDePerfil", () => {
  it("mostra o convite para adicionar quando não há foto", async () => {
    render(<FotoDePerfil />);
    expect(await screen.findByText("Adicionar foto")).toBeInTheDocument();
  });

  it("COMPRIME antes de enviar, e envia o comprimido — nunca o original", async () => {
    render(<FotoDePerfil />);
    await screen.findByText("Adicionar foto");

    escolherArquivo(ORIGINAL);

    await waitFor(() => expect(enviarMinhaFoto).toHaveBeenCalled());
    expect(comprimirImagem).toHaveBeenCalledWith(ORIGINAL);
    // A asserção que importa: o que subiu é o WebP pequeno. Enviar o
    // original daria 413 depois de a pessoa esperar o upload inteiro.
    // **`toHaveBeenCalledWith(COMPRIMIDA)` NÃO prova isto**, e a descoberta
    // custou uma sabotagem que passou (2026-08-26): `File` e `Blob` não têm
    // propriedade própria enumerável — `name`, `size` e `type` são getters
    // do protótipo. A comparação estrutural do vitest vê `{}` contra `{}`, e
    // considera **qualquer** File igual a qualquer outro.
    //
    // A identidade (`toBe`) é o que separa: só passa se for o mesmo objeto.
    //
    // Esta linha existe desde a TASK-003 e **nunca provou o que dizia
    // provar**: o cabeçalho deste arquivo garante que "o que sobe é o
    // arquivo COMPRIMIDO, não o original", e a asserção antiga passaria
    // igual se subisse o original de 4 MB.
    const [enviado] = enviarMinhaFoto.mock.calls[0] as [File];
    expect(enviado).toBe(COMPRIMIDA);
    expect(enviado).not.toBe(ORIGINAL);
    expect(enviado.name).toBe("foto.webp");

    const ordemDaCompressao = comprimirImagem.mock.invocationCallOrder[0];
    const ordemDoEnvio = enviarMinhaFoto.mock.invocationCallOrder[0];
    expect(ordemDaCompressao).toBeLessThan(ordemDoEnvio);
  });

  it("mostra a foto depois de enviar, e oferece trocar e remover", async () => {
    render(<FotoDePerfil nome="Ana" />);
    await screen.findByText("Adicionar foto");
    escolherArquivo(ORIGINAL);

    const imagem = await screen.findByAltText("Foto de Ana");
    expect(imagem).toHaveAttribute("src", "https://assinada/nova");
    expect(screen.getByText("Trocar foto")).toBeInTheDocument();
    expect(screen.getByText("Remover")).toBeInTheDocument();
  });

  it("erro do pré-voo chega à tela com o texto dele, e nada é enviado", async () => {
    // Este teste falava do `ICCP` e da INV-050 até 2026-08-26. Guardava a
    // mensagem errada: o `ICCP` deixou de ser motivo de recusa quando o
    // DEF-007 foi corrigido — o compressor **remove** o chunk, não reprova
    // por ele. Um teste que guarda mensagem que o produto não emite mais
    // parece cobertura e não é.
    //
    // O que continua valendo, e é o que ele prova: quando o pré-voo recusa,
    // o texto chega à tela em vez de virar um 422 genérico, e a rede não é
    // gasta. `EXIF` é um motivo que existe de verdade — não é removido,
    // porque carrega metadado (GPS, entre outros) e sumir com ele em
    // silêncio seria decidir por quem subiu a foto.
    comprimirImagem.mockRejectedValue(
      new ErroDeCompressao(
        'A imagem gerada não seria aceita pelo servidor (chunk fora da allowlist: "EXIF").',
      ),
    );

    render(<FotoDePerfil />);
    await screen.findByText("Adicionar foto");
    escolherArquivo(ORIGINAL);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("EXIF");
    // E nada foi enviado: o pré-voo recusou antes de gastar a rede.
    expect(enviarMinhaFoto).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece, e a tela volta a aceitar tentativa", async () => {
    enviarMinhaFoto.mockRejectedValueOnce(new Error("Arquivo acima do limite."));

    render(<FotoDePerfil />);
    await screen.findByText("Adicionar foto");
    escolherArquivo(ORIGINAL);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Arquivo acima do limite.",
    );
    // O botão volta a ficar clicável — travar aqui deixaria a pessoa sem
    // saída sem recarregar a página.
    expect(screen.getByText("Adicionar foto")).not.toBeDisabled();
  });

  it("remove e volta ao estado sem foto", async () => {
    getMinhaFoto.mockResolvedValue({ url: "https://assinada/atual" });
    render(<FotoDePerfil />);

    fireEvent.click(await screen.findByText("Remover"));

    await waitFor(() => expect(removerMinhaFoto).toHaveBeenCalled());
    expect(await screen.findByText("Adicionar foto")).toBeInTheDocument();
    expect(screen.queryByText("Remover")).not.toBeInTheDocument();
  });

  it("falha ao carregar não deixa a tela em spinner eterno", async () => {
    getMinhaFoto.mockRejectedValue(new Error("Sem rede."));
    render(<FotoDePerfil />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem rede.");
    // E ainda dá para tentar subir: o carregamento falhou, a ação não.
    expect(screen.getByText("Adicionar foto")).toBeInTheDocument();
  });
});
