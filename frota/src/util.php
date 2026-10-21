<?php

class ErroDeUso extends Exception
{
    public function __construct(string $mensagem, int $status = 400)
    {
        parent::__construct($mensagem, $status);
    }
}

function responde($dados, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function corpoJson(): array
{
    $bruto = file_get_contents('php://input');
    if ($bruto === '' || $bruto === false) {
        return [];
    }
    $dados = json_decode($bruto, true);
    if (!is_array($dados)) {
        throw new ErroDeUso('Não foi possível ler os dados enviados.');
    }
    return $dados;
}

function campoTexto($valor, string $campo, bool $obrigatorio = false, int $max = 300): ?string
{
    $v = is_scalar($valor) ? trim((string) $valor) : '';
    if ($v === '') {
        if ($obrigatorio) {
            throw new ErroDeUso("Preencha o campo \"$campo\".");
        }
        return null;
    }
    if (mb_strlen($v) > $max) {
        throw new ErroDeUso("O campo \"$campo\" é muito longo (máximo $max caracteres).");
    }
    return $v;
}

function campoCentavos($valor, string $campo = 'Valor'): int
{
    if ($valor === null || $valor === '') {
        throw new ErroDeUso('Informe o valor.');
    }
    $s = preg_replace('/\s|R\$/iu', '', (string) $valor);
    $virgula = strrpos($s, ',');
    $ponto = strrpos($s, '.');
    if ($virgula !== false && $ponto !== false) {
        $separador = $virgula > $ponto ? ',' : '.';
        $outro = $separador === ',' ? '.' : ',';
        $s = str_replace($outro, '', $s);
        $s = str_replace($separador, '.', $s);
    } elseif ($virgula !== false) {
        $s = str_replace(',', '.', $s);
    }
    if (!is_numeric($s)) {
        throw new ErroDeUso("$campo inválido. Use apenas números, como 1250,90.");
    }
    $centavos = (int) round(((float) $s) * 100);
    if ($centavos <= 0) {
        throw new ErroDeUso("$campo deve ser maior que zero.");
    }
    if ($centavos > 100000000000) {
        throw new ErroDeUso("$campo acima do limite permitido.");
    }
    return $centavos;
}

function campoNumero($valor, string $campo, float $max = 10000000, bool $inteiro = false)
{
    if ($valor === null || $valor === '') {
        return null;
    }
    $s = str_replace(',', '.', (string) $valor);
    if (!is_numeric($s)) {
        throw new ErroDeUso("O campo \"$campo\" deve ser um número.");
    }
    $n = (float) $s;
    if ($n < 0 || $n > $max) {
        throw new ErroDeUso("O campo \"$campo\" está fora do intervalo permitido.");
    }
    return $inteiro ? (int) round($n) : round($n, 3);
}

function campoId($valor, string $campo, bool $obrigatorio = false): ?int
{
    if ($valor === null || $valor === '' || $valor === 'null') {
        if ($obrigatorio) {
            throw new ErroDeUso("Selecione o campo \"$campo\".");
        }
        return null;
    }
    if (!is_numeric($valor) || (int) $valor <= 0) {
        throw new ErroDeUso("O campo \"$campo\" é inválido.");
    }
    return (int) $valor;
}

function campoData($valor, string $campo = 'Data', bool $obrigatorio = true): ?string
{
    $v = is_scalar($valor) ? substr(trim((string) $valor), 0, 10) : '';
    if ($v === '') {
        if ($obrigatorio) {
            throw new ErroDeUso("Informe a " . mb_strtolower($campo) . ".");
        }
        return null;
    }
    $d = DateTime::createFromFormat('!Y-m-d', $v);
    if (!$d || $d->format('Y-m-d') !== $v) {
        throw new ErroDeUso("$campo inválida.");
    }
    return $v;
}

function campoSimNao($valor, bool $padrao = true): int
{
    if ($valor === null) {
        return $padrao ? 1 : 0;
    }
    if ($valor === false || $valor === 0 || $valor === '0' || $valor === 'false') {
        return 0;
    }
    return 1;
}

function mesValido($valor): string
{
    $v = trim((string) $valor);
    return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $v) ? $v : date('Y-m');
}

function limitesDoMes(string $mes): array
{
    return [$mes . '-01', date('Y-m-t', strtotime($mes . '-01'))];
}

function mesAnterior(string $mes): string
{
    return date('Y-m', strtotime($mes . '-01 -1 month'));
}

function agora(): string
{
    return date('Y-m-d H:i:s');
}

function paginacao(array $query): array
{
    $limite = (int) ($query['limite'] ?? 100);
    $limite = max(1, min($limite, 1000));
    $pagina = max(1, (int) ($query['pagina'] ?? 1));
    return [$limite, ($pagina - 1) * $limite, $pagina];
}
