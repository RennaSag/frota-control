import zlib from 'node:zlib';

export const PDF_LARGURA = 842;
export const PDF_ALTURA = 595;
export const PDF_MARGEM = 28;

export const PDF_VERDE = [0.08, 0.5, 0.25];
export const PDF_VERMELHO = [0.75, 0.15, 0.15];
export const PDF_CINZA = [0.4, 0.4, 0.4];
export const PDF_TINTA = [0.1, 0.1, 0.1];

const PDF_LARGURAS_HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

export function pdfCodifica(texto: string): string {
  // Normalize accents and strip unprintable characters
  let s = String(texto ?? '').replace(/[\x00-\x1F\x7F]/g, ' ');
  // Replace special characters with latin equivalents for Helvetica
  return s
    .replace(/[àáâãäå]/gi, (c) => (c === c.toUpperCase() ? 'A' : 'a'))
    .replace(/[èéêë]/gi, (c) => (c === c.toUpperCase() ? 'E' : 'e'))
    .replace(/[ìíîï]/gi, (c) => (c === c.toUpperCase() ? 'I' : 'i'))
    .replace(/[òóôõö]/gi, (c) => (c === c.toUpperCase() ? 'O' : 'o'))
    .replace(/[ùúûü]/gi, (c) => (c === c.toUpperCase() ? 'U' : 'u'))
    .replace(/[ç]/gi, (c) => (c === c.toUpperCase() ? 'C' : 'c'))
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/•/g, '·')
    .replace(/·/g, '-');
}

export function pdfLargura(texto: string, tamanho: number, negrito = false): number {
  let soma = 0;
  const s = pdfCodifica(texto);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    soma += (c >= 32 && c - 32 < PDF_LARGURAS_HELVETICA.length)
      ? PDF_LARGURAS_HELVETICA[c - 32]
      : 556;
  }
  return (soma * tamanho) / 1000 * (negrito ? 1.08 : 1);
}

export class Pdf {
  private paginas: string[] = [];
  private atual = '';
  public y: number = PDF_MARGEM;

  novaPagina(): void {
    if (this.atual !== '') {
      this.paginas.push(this.atual);
    }
    this.atual = ' ';
    this.y = PDF_MARGEM;
  }

  quebraSeFaltar(altura: number): boolean {
    if (this.y + altura <= PDF_ALTURA - PDF_MARGEM - 20) {
      return false;
    }
    this.novaPagina();
    return true;
  }

  cabecalho(titulo: string, subtitulo: string): void {
    this.texto(PDF_MARGEM, this.y + 14, titulo, 16, true);
    this.texto(PDF_MARGEM, this.y + 28, subtitulo, 9, false, PDF_CINZA);
    this.y += 40;
  }

  secao(titulo: string): void {
    this.quebraSeFaltar(70);
    this.y += 12;
    this.texto(PDF_MARGEM, this.y + 10, titulo, 11, true);
    this.y += 18;
  }

  indicadores(itens: [string, string, number[]][]): void {
    this.quebraSeFaltar(40);
    const largura = (PDF_LARGURA - 2 * PDF_MARGEM) / Math.max(itens.length, 5);
    let x = PDF_MARGEM;
    for (const [rotulo, valor, cor] of itens) {
      this.celula(x, this.y + 9, largura - 8, rotulo, 8, false, false, PDF_CINZA);
      this.celula(x, this.y + 25, largura - 8, valor, 12, true, false, cor);
      x += largura;
    }
    this.y += 36;
  }

  tabela(
    colunas: [string, number, boolean?][],
    linhas: (any)[][],
    vazio = 'Nada neste período.'
  ): void {
    const soma = colunas.reduce((acc, c) => acc + c[1], 0);
    const escala = Math.min(1, (PDF_LARGURA - 2 * PDF_MARGEM) / soma);
    const util = soma * escala;
    const alturaLinha = 13;

    const cabecalho = () => {
      this.retangulo(PDF_MARGEM, this.y, util, alturaLinha + 2, [0.18, 0.22, 0.28]);
      let x = PDF_MARGEM;
      for (const c of colunas) {
        this.celula(x + 3, this.y + 10, c[1] * escala - 6, c[0], 7, true, c[2] ?? false, [1, 1, 1]);
        x += c[1] * escala;
      }
      this.y += alturaLinha + 2;
    };

    this.quebraSeFaltar((alturaLinha + 2) * 2);
    cabecalho();

    if (!linhas || linhas.length === 0) {
      this.texto(PDF_MARGEM + 3, this.y + 10, vazio, 8, false, PDF_CINZA);
      this.y += alturaLinha;
      return;
    }

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (this.quebraSeFaltar(alturaLinha)) {
        cabecalho();
      }
      if (i % 2 === 1) {
        this.retangulo(PDF_MARGEM, this.y, util, alturaLinha, [0.95, 0.96, 0.97]);
      }
      let x = PDF_MARGEM;
      for (let k = 0; k < colunas.length; k++) {
        const c = colunas[k];
        const cel = linha[k];
        const [texto, cor] = Array.isArray(cel) ? cel : [cel, PDF_TINTA];
        this.celula(x + 3, this.y + 9, c[1] * escala - 6, String(texto ?? ''), 7, false, c[2] ?? false, cor);
        x += c[1] * escala;
      }
      this.y += alturaLinha;
    }
  }

  retangulo(x: number, y: number, l: number, a: number, cor: number[]): void {
    this.atual += `${cor[0].toFixed(3)} ${cor[1].toFixed(3)} ${cor[2].toFixed(3)} rg ${x.toFixed(2)} ${(PDF_ALTURA - y - a).toFixed(2)} ${l.toFixed(2)} ${a.toFixed(2)} re f\n`;
  }

  linha(x1: number, y1: number, x2: number, y2: number, cor: number[]): void {
    this.atual += `${cor[0].toFixed(3)} ${cor[1].toFixed(3)} ${cor[2].toFixed(3)} RG 0.5 w ${x1.toFixed(2)} ${(PDF_ALTURA - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PDF_ALTURA - y2).toFixed(2)} l S\n`;
  }

  texto(
    x: number,
    y: number,
    texto: string,
    tamanho = 8,
    negrito = false,
    cor: number[] = [0, 0, 0]
  ): void {
    const raw = pdfCodifica(texto)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    this.atual += `BT /${negrito ? 'F2' : 'F1'} ${tamanho.toFixed(1)} Tf ${cor[0].toFixed(3)} ${cor[1].toFixed(3)} ${cor[2].toFixed(3)} rg ${x.toFixed(2)} ${(PDF_ALTURA - y).toFixed(2)} Td (${raw}) Tj ET\n`;
  }

  celula(
    x: number,
    y: number,
    largura: number,
    texto: string,
    tamanho = 7,
    negrito = false,
    direita = false,
    cor: number[] = [0, 0, 0]
  ): void {
    let t = String(texto ?? '').trim().replace(/\s+/g, ' ');
    if (pdfLargura(t, tamanho, negrito) > largura) {
      while (t !== '' && pdfLargura(t + '...', tamanho, negrito) > largura) {
        t = t.slice(0, -1);
      }
      t = t.trim() + '...';
    }
    let posX = x;
    if (direita) {
      posX += largura - pdfLargura(t, tamanho, negrito);
    }
    this.texto(posX, y, t, tamanho, negrito, cor);
  }

  emCadaPagina(desenha: (pdf: Pdf, n: number, total: number) => void): void {
    this.novaPagina();
    this.atual = '';
    const total = this.paginas.length;
    for (let i = 0; i < total; i++) {
      this.atual = this.paginas[i];
      desenha(this, i + 1, total);
      this.paginas[i] = this.atual;
    }
    this.atual = '';
  }

  gera(): Buffer {
    if (this.atual !== '') {
      this.novaPagina();
      this.atual = '';
    }
    const objetos: Record<number, string | Buffer> = {
      1: '<< /Type /Catalog /Pages 2 0 R >>',
      2: '',
      3: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    };
    const filhos: string[] = [];
    let curObj = 5;

    for (const conteudo of this.paginas) {
      const pageObj = curObj++;
      const contentObj = curObj++;
      filhos.push(`${pageObj} 0 R`);

      const uncompressed = Buffer.from(conteudo, 'latin1');
      const compressed = zlib.deflateSync(uncompressed);

      objetos[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LARGURA} ${PDF_ALTURA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;
      objetos[contentObj] = Buffer.concat([
        Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`),
        compressed,
        Buffer.from('\nendstream'),
      ]);
    }

    objetos[2] = `<< /Type /Pages /Kids [${filhos.join(' ')}] /Count ${filhos.length} >>`;

    const partes: Buffer[] = [];
    let pos = 0;
    const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    partes.push(header);
    pos += header.length;

    const count = Object.keys(objetos).length;
    const posicoes: number[] = [];

    for (let i = 1; i <= count; i++) {
      posicoes[i] = pos;
      const corpo = objetos[i];
      const start = Buffer.from(`${i} 0 obj\n`);
      const end = Buffer.from('\nendobj\n');
      const bodyBuf = typeof corpo === 'string' ? Buffer.from(corpo, 'latin1') : corpo;
      partes.push(start, bodyBuf, end);
      pos += start.length + bodyBuf.length + end.length;
    }

    const xrefPos = pos;
    let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= count; i++) {
      xref += `${String(posicoes[i]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer << /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    partes.push(Buffer.from(xref));

    return Buffer.concat(partes);
  }
}
