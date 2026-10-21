<?php
/** Porta de entrada da API: api.php?r=<rota> */
declare(strict_types=1);

require __DIR__ . '/config.php';

/**
 * A resposta da API é sempre JSON (ou uma planilha/foto). Avisos do PHP impressos
 * no meio disso quebrariam a tela, então eles vão para o log do servidor.
 * Para investigar um problema, coloque MOSTRAR_ERROS como true no config.php.
 */
ini_set('display_errors', MOSTRAR_ERROS ? '1' : '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require __DIR__ . '/src/util.php';
require __DIR__ . '/src/banco.php';
require __DIR__ . '/src/sessao.php';
require __DIR__ . '/src/rotas.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

try {
    exigePedidoDoApp();
    $resposta = despacha(
        (string) ($_GET['r'] ?? ''),
        strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET')
    );
    responde($resposta);
} catch (ErroDeUso $e) {
    $status = $e->getCode();
    responde(['erro' => $e->getMessage()], $status >= 400 && $status < 600 ? $status : 400);
} catch (Throwable $e) {
    error_log('[frota] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
    responde(['erro' => 'Não foi possível concluir. Tente novamente.'], 500);
}
