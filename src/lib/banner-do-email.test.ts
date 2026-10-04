import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-083 (D8, I15, AC-044) — **o banner que todo e-mail da PlayCK carrega.**
 *
 * O e-mail aponta para `URL_CLIENTE + '/email/playck-banner.jpg'`, e quem serve
 * o arquivo é este repositório (`public/email/`). O Back só conhece o endereço:
 * se o arquivo sumir, mudar de tamanho ou de formato, o e-mail continua saindo
 * e o defeito só aparece na caixa de entrada de quem recebeu.
 *
 * ## O que é conferido, e por quê
 *
 * - **JPEG de 1200 × 427 px:** o dobro dos `600 × 213` que o HTML do e-mail
 *   declara (tela de alta densidade), na proporção do original de 1600 × 569.
 * - **Até 150 KB:** é a primeira coisa que a pessoa baixa ao abrir o convite.
 * - **O SHA-256 do arquivo revisado:** a versão otimizada foi comparada com
 *   `banner-email-original.png` uma vez (registro no `CLI_AUDIT.md` da spec).
 *   Daí em diante quem garante a identidade é o hash: trocar a imagem, mesmo
 *   por outra do mesmo tamanho, deixa este teste vermelho até alguém revisar de
 *   novo e atualizar o valor aqui.
 *
 * As dimensões vêm do cabeçalho do próprio JPEG (o segmento SOF), e não de
 * biblioteca de imagem: o repositório não tem uma, e não ganha uma por isto.
 */

const ARQUIVO = join(__dirname, "..", "..", "public", "email", "playck-banner.jpg");

/** O arquivo revisado contra o original em 2026-10-04 (SPEC-083, TASK-008). */
const SHA256_REVISADO = "16e01033b4fba39056433821f194fd38b990c98845c02be9d58282faaf409f96";

const LIMITE_EM_BYTES = 150 * 1000;

type Dimensoes = { largura: number; altura: number };

/**
 * Anda pelos segmentos do JPEG até o primeiro SOF (`FFC0`–`FFCF`, menos os três
 * que não são quadro: `C4` tabela de Huffman, `C8` reservado e `CC` tabela
 * aritmética). Ali estão a altura e a largura, nessa ordem.
 */
function dimensoesDoJpeg(bytes: Uint8Array): Dimensoes | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marcador = bytes[i + 1];
    // Preenchimento: vários FF seguidos antes do marcador são válidos.
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    const tamanho = (bytes[i + 2] << 8) | bytes[i + 3];
    const ehQuadro =
      marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (ehQuadro) {
      if (i + 8 >= bytes.length) return null;
      return {
        altura: (bytes[i + 5] << 8) | bytes[i + 6],
        largura: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    i += 2 + tamanho;
  }
  return null;
}

describe("SPEC-083 (AC-044) — o banner dos e-mails servido pelo Cliente", () => {
  const bytes = new Uint8Array(readFileSync(ARQUIVO));

  it("é JPEG: começa com SOI e termina com EOI", () => {
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xff, 0xd8, 0xff]);
    expect([bytes[bytes.length - 2], bytes[bytes.length - 1]]).toEqual([0xff, 0xd9]);
  });

  it("tem 1200 × 427 px, a proporção do original de 1600 × 569", () => {
    expect(dimensoesDoJpeg(bytes)).toEqual({ largura: 1200, altura: 427 });
    // A mesma proporção, até o arredondamento de um pixel na altura.
    expect(Math.abs(1200 / 427 - 1600 / 569)).toBeLessThan(1 / 427);
  });

  it("tem até 150 KB", () => {
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.length).toBeLessThanOrEqual(LIMITE_EM_BYTES);
  });

  it("é o arquivo revisado contra o original (SHA-256)", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(SHA256_REVISADO);
  });
});

describe("dimensoesDoJpeg — o leitor do cabeçalho, contra fixture", () => {
  /** Um JPEG mínimo de cabeçalho: SOI, um APP0 curto, SOF0 com altura e largura. */
  function jpeg(marcadorDoQuadro: number, altura: number, largura: number): Uint8Array {
    return new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc4, 0x00, 0x03, 0x00,
      0xff, marcadorDoQuadro, 0x00, 0x0b, 0x08,
      altura >> 8, altura & 0xff, largura >> 8, largura & 0xff,
      0x03, 0x01, 0x11, 0x00,
    ]);
  }

  it("lê o SOF0 (sequencial) e o SOF2 (progressivo), pulando a tabela de Huffman", () => {
    expect(dimensoesDoJpeg(jpeg(0xc0, 427, 1200))).toEqual({ largura: 1200, altura: 427 });
    expect(dimensoesDoJpeg(jpeg(0xc2, 569, 1600))).toEqual({ largura: 1600, altura: 569 });
  });

  it("não troca largura por altura", () => {
    expect(dimensoesDoJpeg(jpeg(0xc0, 1200, 427))).toEqual({ largura: 427, altura: 1200 });
  });

  it("recusa o que não é JPEG", () => {
    expect(dimensoesDoJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(dimensoesDoJpeg(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
