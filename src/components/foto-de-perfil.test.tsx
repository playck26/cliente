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
    expect(enviarMinhaFoto).toHaveBeenCalledWith(COMPRIMIDA);

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

  it("INV-050 — o erro do Display P3 chega à tela com o texto dele", async () => {
    // O caso que a INV-050 existe para não deixar acontecer em silêncio. Sem
    // esta mensagem, a pessoa veria um 422 genérico num aparelho onde a foto
    // é perfeitamente boa, e o problema não reproduziria em outra máquina.
    comprimirImagem.mockRejectedValue(
      new ErroDeCompressao(
        "A imagem gerada não seria aceita pelo servidor (o navegador gravou o perfil de cor (ICCP) na imagem).",
      ),
    );

    render(<FotoDePerfil />);
    await screen.findByText("Adicionar foto");
    escolherArquivo(ORIGINAL);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("perfil de cor (ICCP)");
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
