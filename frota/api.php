<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

ini_set('display_errors', MOSTRAR_ERROS ? '1' : '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require __DIR__ . '/src/util.php';
require __DIR__ . '/src/banco.php';
require __DIR__ . '/src/sessao.php';
require __DIR__ . '/src/rotas.php';
require __DIR__ . '/src/pdf.php';
require __DIR__ . '/src/push.php';
require __DIR__ . '/src/fila.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

try {
    exigePedidoDoApp();
    $envio = idDoEnvio();
    if ($envio !== null) {
        $repetido = reservaEnvio($envio);
        if ($repetido !== null) {
            responde($repetido);
        }
    }
    $transacaoFila = $envio !== null && ($_GET['r'] ?? '') !== 'comprovante';
    if ($transacaoFila) banco()->beginTransaction();
    try {
        $resposta = despacha(
            (string) ($_GET['r'] ?? ''),
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET')
        );
    } catch (Throwable $e) {
        if ($transacaoFila && banco()->inTransaction()) banco()->rollBack();
        if ($envio !== null) {
            liberaEnvio($envio);
        }
        throw $e;
    }
    if ($envio !== null) {
        guardaEnvio($envio, $resposta);
    }
    if ($transacaoFila && banco()->inTransaction()) banco()->commit();
    responde($resposta);
} catch (ErroDeUso $e) {
    $status = $e->getCode();
    responde(['erro' => $e->getMessage()], $status >= 400 && $status < 600 ? $status : 400);
} catch (Throwable $e) {
    error_log('[frota] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
    responde(['erro' => 'Não foi possível concluir. Tente novamente.'], 500);
}
