<?php

// Envios que vêm da fila do aparelho (feitos sem internet) trazem o cabeçalho X-Fila-Id.
// Se o sinal cair depois de gravar e antes da resposta chegar, o aparelho manda de novo:
// aqui o repetido devolve a mesma resposta da primeira vez, sem gravar duas vezes.

function idDoEnvio(): ?string
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return null;
    }
    $id = (string) ($_SERVER['HTTP_X_FILA_ID'] ?? '');
    return preg_match('/^[A-Za-z0-9-]{8,40}$/', $id) ? $id : null;
}

// Devolve a resposta guardada se o envio já foi feito; senão reserva o id e devolve null.
function reservaEnvio(string $id): ?array
{
    $eu = exigeLogin();
    $linha = umaLinha('SELECT usuario_id, resposta, criado_em FROM envios_fila WHERE id = ?', [$id]);
    if ($linha && $linha['resposta'] === null && time() - strtotime((string) $linha['criado_em']) > 120) {
        // Reserva abandonada (o pedido anterior morreu no meio): libera para gravar de novo.
        consulta('DELETE FROM envios_fila WHERE id = ? AND resposta IS NULL', [$id]);
        $linha = null;
    }
    if ($linha) {
        if ((int) $linha['usuario_id'] !== $eu['id']) {
            throw new ErroDeUso('Pedido inválido. Recarregue a página e tente de novo.');
        }
        if ($linha['resposta'] === null) {
            throw new ErroDeUso('Este envio ainda está sendo gravado. Tente de novo em instantes.', 409);
        }
        return json_decode((string) $linha['resposta'], true);
    }
    try {
        consulta('INSERT INTO envios_fila (id, usuario_id, resposta, criado_em) VALUES (?, ?, NULL, ?)',
            [$id, $eu['id'], agora()]);
    } catch (PDOException $e) {
        throw new ErroDeUso('Este envio ainda está sendo gravado. Tente de novo em instantes.', 409);
    }
    if (random_int(1, 50) === 1) {
        consulta('DELETE FROM envios_fila WHERE criado_em < ?', [date('Y-m-d H:i:s', time() - 30 * 86400)]);
    }
    return null;
}

function guardaEnvio(string $id, $resposta): void
{
    consulta('UPDATE envios_fila SET resposta = ? WHERE id = ?',
        [json_encode($resposta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
}

function liberaEnvio(string $id): void
{
    try {
        consulta('DELETE FROM envios_fila WHERE id = ? AND resposta IS NULL', [$id]);
    } catch (Throwable $e) {
    }
}
