// Gerador de PDF mínimo (A4 deitado, fontes Helvetica embutidas no leitor),
// suficiente para tabelas de texto sem depender de bibliotecas externas.
// Os textos aqui são "binários": cada caractere é um byte (0 a 255) do PDF final.

export const PDF_LARGURA = 842;
export const PDF_ALTURA = 595;
export const PDF_MARGEM = 28;

const PDF_LARGURAS_HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

export const PDF_VERDE = [0.08, 0.5, 0.25];
export const PDF_VERMELHO = [0.75, 0.15, 0.15];
export const PDF_CINZA = [0.4, 0.4, 0.4];
export const PDF_TINTA = [0.1, 0.1, 0.1];

const f = (n, casas) => n.toFixed(casas);

export class Pdf {
  constructor() {
    this.paginas = [];
    this.atual = '';
    // Posição vertical do próximo elemento (a partir do topo), usada pelos blocos de layout.
    this.y = PDF_MARGEM;
  }

  novaPagina() {
    if (this.atual !== '') this.paginas.push(this.atual);
    this.atual = ' ';
    this.y = PDF_MARGEM;
  }

  quebraSeFaltar(altura) {
    if (this.y + altura <= PDF_ALTURA - PDF_MARGEM - 20) return false;
    this.novaPagina();
    return true;
  }

  cabecalho(titulo, subtitulo) {
    this.texto(PDF_MARGEM, this.y + 14, titulo, 16, true);
    this.texto(PDF_MARGEM, this.y + 28, subtitulo, 9, false, PDF_CINZA);
    this.y += 40;
  }

  secao(titulo) {
    this.quebraSeFaltar(70);
    this.y += 12;
    this.texto(PDF_MARGEM, this.y + 10, titulo, 11, true);
    this.y += 18;
  }

  // itens: [[rótulo, valor, cor], ...] lado a lado.
  indicadores(itens) {
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

  // colunas: [[rótulo, largura, alinhaDireita?], ...] - se não couberem, as larguras encolhem
  // na mesma proporção. Cada célula de linhas é um texto ou [texto, cor].
  tabela(colunas, linhas, vazio = 'Nada neste período.') {
    const soma = colunas.reduce((s, c) => s + c[1], 0);
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
    if (!linhas.length) {
      this.texto(PDF_MARGEM + 3, this.y + 10, vazio, 8, false, PDF_CINZA);
      this.y += alturaLinha;
      return;
    }
    linhas.forEach((linha, i) => {
      if (this.quebraSeFaltar(alturaLinha)) cabecalho();
      if (i % 2 === 1) this.retangulo(PDF_MARGEM, this.y, util, alturaLinha, [0.95, 0.96, 0.97]);
      let x = PDF_MARGEM;
      colunas.forEach((c, k) => {
        const [texto, cor] = Array.isArray(linha[k]) ? linha[k] : [linha[k], PDF_TINTA];
        this.celula(x + 3, this.y + 9, c[1] * escala - 6, String(texto ?? ''), 7, false, c[2] ?? false, cor);
        x += c[1] * escala;
      });
      this.y += alturaLinha;
    });
  }

  retangulo(x, y, l, a, cor) {
    this.atual += `${f(cor[0], 3)} ${f(cor[1], 3)} ${f(cor[2], 3)} rg ${f(x, 2)} ${f(PDF_ALTURA - y - a, 2)} ${f(l, 2)} ${f(a, 2)} re f\n`;
  }

  // y é a linha de base do texto, medida a partir do topo da página.
  texto(x, y, texto, tamanho = 8, negrito = false, cor = [0, 0, 0]) {
    const escapado = pdfCodifica(texto).replace(/[\\()]/g, (c) => '\\' + c);
    this.atual += `BT /${negrito ? 'F2' : 'F1'} ${f(tamanho, 1)} Tf ${f(cor[0], 3)} ${f(cor[1], 3)} ${f(cor[2], 3)} rg `
      + `${f(x, 2)} ${f(PDF_ALTURA - y, 2)} Td (${escapado}) Tj ET\n`;
  }

  // Cabe o texto na largura, cortando com reticências; alinha à direita se pedido.
  celula(x, y, largura, texto, tamanho = 7, negrito = false, direita = false, cor = [0, 0, 0]) {
    let t = String(texto).replace(/\s+/gu, ' ').trim();
    if (pdfLargura(t, tamanho, negrito) > largura) {
      let letras = [...t];
      while (letras.length && pdfLargura(letras.join('') + '…', tamanho, negrito) > largura) letras.pop();
      t = letras.join('').trimEnd() + '…';
    }
    if (direita) x += largura - pdfLargura(t, tamanho, negrito);
    this.texto(x, y, t, tamanho, negrito, cor);
  }

  // Executa desenha(pdf, numero, total) em cada página já criada (ex.: rodapé).
  emCadaPagina(desenha) {
    this.novaPagina();
    this.atual = '';
    const total = this.paginas.length;
    this.paginas.forEach((conteudo, i) => {
      this.atual = conteudo;
      desenha(this, i + 1, total);
      this.paginas[i] = this.atual;
    });
    this.atual = '';
  }

  async gera() {
    if (this.atual !== '') {
      this.novaPagina();
      this.atual = '';
    }
    const objetos = [
      null,
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    const filhos = [];
    for (const conteudo of this.paginas) {
      const n = objetos.length;
      const dados = await comprime(conteudo);
      objetos[n] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LARGURA} ${PDF_ALTURA}]`
        + ` /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${n + 1} 0 R >>`;
      objetos[n + 1] = `<< /Length ${dados.length} /Filter /FlateDecode >>\nstream\n${dados}\nendstream`;
      filhos.push(`${n} 0 R`);
    }
    objetos[2] = `<< /Type /Pages /Kids [${filhos.join(' ')}] /Count ${filhos.length} >>`;

    let saida = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const posicoes = [];
    for (let n = 1; n < objetos.length; n++) {
      posicoes.push(saida.length);
      saida += `${n} 0 obj\n${objetos[n]}\nendobj\n`;
    }
    const xref = saida.length;
    saida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (const p of posicoes) saida += `${String(p).padStart(10, '0')} 00000 n \n`;
    saida += `trailer << /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Uint8Array.from(saida, (c) => c.charCodeAt(0));
  }
}

// Igual ao gzcompress() do PHP (formato zlib); devolve texto binário.
async function comprime(texto) {
  const bytes = Uint8Array.from(texto, (c) => c.charCodeAt(0));
  const fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  const comprimido = new Uint8Array(await new Response(fluxo).arrayBuffer());
  let s = '';
  for (let i = 0; i < comprimido.length; i += 8192) {
    s += String.fromCharCode(...comprimido.subarray(i, i + 8192));
  }
  return s;
}

// Windows-1252: 0x80 a 0x9F têm letras próprias; o resto que não existe vira "?".
const CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91,
  0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
  0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

export function pdfCodifica(texto) {
  let saida = '';
  for (const ch of String(texto).replace(/[\x00-\x1F\x7F]/g, ' ')) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) saida += ch;
    else if (CP1252[c]) saida += String.fromCharCode(CP1252[c]);
    else saida += '?';
  }
  return saida;
}

export function pdfLargura(texto, tamanho, negrito = false) {
  let soma = 0;
  const bytes = pdfCodifica(texto);
  for (let i = 0; i < bytes.length; i++) {
    soma += PDF_LARGURAS_HELVETICA[bytes.charCodeAt(i) - 32] ?? 556;
  }
  return soma * tamanho / 1000 * (negrito ? 1.08 : 1);
}

// number_format() do PHP.
export function pdfNumero(n, casas = 0) {
  const fixo = Math.abs(Number(n)).toFixed(casas);
  const [inteira, decimal] = fixo.split('.');
  const milhar = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sinal = Number(n) < 0 && Number(fixo) !== 0 ? '-' : '';
  return sinal + milhar + (decimal ? ',' + decimal : '');
}

export function pdfReais(centavos) {
  return (centavos < 0 ? '-' : '') + 'R$ ' + pdfNumero(Math.abs(centavos) / 100, 2);
}

export function pdfData(d) {
  return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
}

export function pdfCorSaldo(centavos) {
  return centavos >= 0 ? PDF_VERDE : PDF_VERMELHO;
}
