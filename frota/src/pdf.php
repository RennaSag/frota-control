<?php

// Gerador de PDF mínimo (A4 deitado, fontes Helvetica embutidas no leitor),
// suficiente para tabelas de texto sem depender de bibliotecas externas.

const PDF_LARGURA = 842;
const PDF_ALTURA = 595;
const PDF_MARGEM = 28;

const PDF_LARGURAS_HELVETICA = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const PDF_VERDE = [0.08, 0.5, 0.25];
const PDF_VERMELHO = [0.75, 0.15, 0.15];
const PDF_CINZA = [0.4, 0.4, 0.4];
const PDF_TINTA = [0.1, 0.1, 0.1];

class Pdf
{
    private array $paginas = [];
    private string $atual = '';

    // Posição vertical do próximo elemento (a partir do topo), usada pelos blocos de layout.
    public float $y = PDF_MARGEM;

    public function novaPagina(): void
    {
        if ($this->atual !== '') {
            $this->paginas[] = $this->atual;
        }
        $this->atual = ' ';
        $this->y = PDF_MARGEM;
    }

    public function quebraSeFaltar(float $altura): bool
    {
        if ($this->y + $altura <= PDF_ALTURA - PDF_MARGEM - 20) {
            return false;
        }
        $this->novaPagina();
        return true;
    }

    public function cabecalho(string $titulo, string $subtitulo): void
    {
        $this->texto(PDF_MARGEM, $this->y + 14, $titulo, 16, true);
        $this->texto(PDF_MARGEM, $this->y + 28, $subtitulo, 9, false, PDF_CINZA);
        $this->y += 40;
    }

    public function secao(string $titulo): void
    {
        $this->quebraSeFaltar(70);
        $this->y += 12;
        $this->texto(PDF_MARGEM, $this->y + 10, $titulo, 11, true);
        $this->y += 18;
    }

    // $itens: [[rótulo, valor, cor], ...] lado a lado.
    public function indicadores(array $itens): void
    {
        $this->quebraSeFaltar(40);
        $largura = (PDF_LARGURA - 2 * PDF_MARGEM) / max(count($itens), 5);
        $x = PDF_MARGEM;
        foreach ($itens as [$rotulo, $valor, $cor]) {
            $this->celula($x, $this->y + 9, $largura - 8, $rotulo, 8, false, false, PDF_CINZA);
            $this->celula($x, $this->y + 25, $largura - 8, $valor, 12, true, false, $cor);
            $x += $largura;
        }
        $this->y += 36;
    }

    // $colunas: [[rótulo, largura, alinhaDireita?], ...] - se não couberem, as larguras encolhem
    // na mesma proporção. Cada célula de $linhas é um texto ou [texto, cor].
    public function tabela(array $colunas, array $linhas, string $vazio = 'Nada neste período.'): void
    {
        $soma = array_sum(array_column($colunas, 1));
        $escala = min(1, (PDF_LARGURA - 2 * PDF_MARGEM) / $soma);
        $util = $soma * $escala;
        $alturaLinha = 13;
        $cabecalho = function () use ($colunas, $escala, $util, $alturaLinha) {
            $this->retangulo(PDF_MARGEM, $this->y, $util, $alturaLinha + 2, [0.18, 0.22, 0.28]);
            $x = PDF_MARGEM;
            foreach ($colunas as $c) {
                $this->celula($x + 3, $this->y + 10, $c[1] * $escala - 6, $c[0], 7, true, $c[2] ?? false, [1, 1, 1]);
                $x += $c[1] * $escala;
            }
            $this->y += $alturaLinha + 2;
        };

        $this->quebraSeFaltar(($alturaLinha + 2) * 2);
        $cabecalho();
        if (!$linhas) {
            $this->texto(PDF_MARGEM + 3, $this->y + 10, $vazio, 8, false, PDF_CINZA);
            $this->y += $alturaLinha;
            return;
        }
        foreach ($linhas as $i => $linha) {
            if ($this->quebraSeFaltar($alturaLinha)) {
                $cabecalho();
            }
            if ($i % 2 === 1) {
                $this->retangulo(PDF_MARGEM, $this->y, $util, $alturaLinha, [0.95, 0.96, 0.97]);
            }
            $x = PDF_MARGEM;
            foreach ($colunas as $k => $c) {
                [$texto, $cor] = is_array($linha[$k]) ? $linha[$k] : [$linha[$k], PDF_TINTA];
                $this->celula($x + 3, $this->y + 9, $c[1] * $escala - 6, (string) $texto, 7, false, $c[2] ?? false, $cor);
                $x += $c[1] * $escala;
            }
            $this->y += $alturaLinha;
        }
    }

    public function retangulo(float $x, float $y, float $l, float $a, array $cor): void
    {
        $this->atual .= sprintf("%.3F %.3F %.3F rg %.2F %.2F %.2F %.2F re f\n",
            $cor[0], $cor[1], $cor[2], $x, PDF_ALTURA - $y - $a, $l, $a);
    }

    public function linha(float $x1, float $y1, float $x2, float $y2, array $cor): void
    {
        $this->atual .= sprintf("%.3F %.3F %.3F RG 0.5 w %.2F %.2F m %.2F %.2F l S\n",
            $cor[0], $cor[1], $cor[2], $x1, PDF_ALTURA - $y1, $x2, PDF_ALTURA - $y2);
    }

    // $y é a linha de base do texto, medida a partir do topo da página.
    public function texto(float $x, float $y, string $texto, float $tamanho = 8, bool $negrito = false,
        array $cor = [0, 0, 0]): void
    {
        $this->atual .= sprintf("BT /%s %.1F Tf %.3F %.3F %.3F rg %.2F %.2F Td (%s) Tj ET\n",
            $negrito ? 'F2' : 'F1', $tamanho, $cor[0], $cor[1], $cor[2], $x, PDF_ALTURA - $y,
            strtr(pdfCodifica($texto), ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']));
    }

    // Cabe o texto na largura, cortando com reticências; alinha à direita se pedido.
    public function celula(float $x, float $y, float $largura, string $texto, float $tamanho = 7,
        bool $negrito = false, bool $direita = false, array $cor = [0, 0, 0]): void
    {
        $texto = trim(preg_replace('/\s+/u', ' ', $texto));
        if (pdfLargura($texto, $tamanho, $negrito) > $largura) {
            while ($texto !== '' && pdfLargura($texto . '…', $tamanho, $negrito) > $largura) {
                $texto = preg_replace('/.$/su', '', $texto);
            }
            $texto = rtrim($texto) . '…';
        }
        if ($direita) {
            $x += $largura - pdfLargura($texto, $tamanho, $negrito);
        }
        $this->texto($x, $y, $texto, $tamanho, $negrito, $cor);
    }

    // Executa $desenha(pdf, numero, total) em cada página já criada (ex.: rodapé).
    public function emCadaPagina(callable $desenha): void
    {
        $this->novaPagina();
        $this->atual = '';
        $total = count($this->paginas);
        foreach ($this->paginas as $i => $conteudo) {
            $this->atual = $conteudo;
            $desenha($this, $i + 1, $total);
            $this->paginas[$i] = $this->atual;
        }
        $this->atual = '';
    }

    public function gera(): string
    {
        if ($this->atual !== '') {
            $this->novaPagina();
            $this->atual = '';
        }
        $objetos = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            2 => '',
            3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            4 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        ];
        $filhos = [];
        foreach ($this->paginas as $conteudo) {
            $n = count($objetos) + 1;
            $dados = function_exists('gzcompress') ? gzcompress($conteudo) : $conteudo;
            $filtro = function_exists('gzcompress') ? ' /Filter /FlateDecode' : '';
            $objetos[$n] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . PDF_LARGURA . ' ' . PDF_ALTURA . ']'
                . ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' . ($n + 1) . ' 0 R >>';
            $objetos[$n + 1] = '<< /Length ' . strlen($dados) . $filtro . " >>\nstream\n" . $dados . "\nendstream";
            $filhos[] = "$n 0 R";
        }
        $objetos[2] = '<< /Type /Pages /Kids [' . implode(' ', $filhos) . '] /Count ' . count($filhos) . ' >>';

        $saida = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $posicoes = [];
        foreach ($objetos as $n => $corpo) {
            $posicoes[$n] = strlen($saida);
            $saida .= "$n 0 obj\n$corpo\nendobj\n";
        }
        $xref = strlen($saida);
        $saida .= 'xref' . "\n0 " . (count($objetos) + 1) . "\n0000000000 65535 f \n";
        foreach ($posicoes as $p) {
            $saida .= sprintf("%010d 00000 n \n", $p);
        }
        $saida .= 'trailer << /Size ' . (count($objetos) + 1) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
        return $saida;
    }
}

function pdfCodifica(string $texto): string
{
    $texto = preg_replace('/[\x00-\x1F\x7F]/', ' ', $texto);
    $convertido = function_exists('mb_convert_encoding')
        ? mb_convert_encoding($texto, 'Windows-1252', 'UTF-8')
        : iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $texto);
    return $convertido === false ? '' : $convertido;
}

function pdfLargura(string $texto, float $tamanho, bool $negrito = false): float
{
    $soma = 0;
    $bytes = pdfCodifica($texto);
    for ($i = 0, $n = strlen($bytes); $i < $n; $i++) {
        $c = ord($bytes[$i]);
        $soma += PDF_LARGURAS_HELVETICA[$c - 32] ?? 556;
    }
    return $soma * $tamanho / 1000 * ($negrito ? 1.08 : 1);
}
