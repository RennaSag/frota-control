<?php

// Notificações push (Web Push com VAPID, RFC 8291 e 8292), sem bibliotecas externas.
// Chegam no celular mesmo com o app fechado: Android, computador e iPhone (iOS 16.4 ou mais
// novo, com o app instalado na tela de início). As chaves VAPID são criadas na primeira vez
// e ficam na tabela "configuracoes".

// Cabeçalho DER de uma chave pública P-256; depois dele vêm os 65 bytes do ponto.
const PUSH_DER_P256 = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

function b64u(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function deB64u(string $texto): string
{
    $dados = base64_decode(strtr($texto, '-_', '+/'), true);
    return $dados === false ? '' : $dados;
}

function opcoesChaveEc(): array
{
    $opcoes = ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC];
    // No Windows (XAMPP) o OpenSSL do PHP às vezes não acha o openssl.cnf sozinho.
    if (!getenv('OPENSSL_CONF')) {
        $pastas = array_filter([dirname((string) php_ini_loaded_file()), PHP_BINARY ? dirname(PHP_BINARY) : '']);
        foreach ($pastas as $pasta) {
            if (is_file("$pasta/extras/ssl/openssl.cnf")) {
                $opcoes['config'] = "$pasta/extras/ssl/openssl.cnf";
                break;
            }
        }
    }
    return $opcoes;
}

function pushDisponivel(): bool
{
    return function_exists('openssl_pkey_derive')
        && (function_exists('curl_init') || filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN));
}

function novaChaveEc(): array
{
    $chave = openssl_pkey_new(opcoesChaveEc());
    if ($chave === false) {
        throw new RuntimeException('OpenSSL não conseguiu criar a chave: ' . openssl_error_string());
    }
    $ec = openssl_pkey_get_details($chave)['ec'];
    $publica = "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
    return [$chave, $publica];
}

function configuracao(string $chave): ?string
{
    $valor = umValor('SELECT valor FROM configuracoes WHERE chave = ?', [$chave]);
    return $valor === null ? null : (string) $valor;
}

// [chave pública em base64url, chave privada em PEM]
function chavesVapid(): array
{
    $publica = configuracao('vapid_publica');
    $privada = configuracao('vapid_privada');
    if ($publica !== null && $privada !== null) {
        return [$publica, $privada];
    }
    [$chave, $bruta] = novaChaveEc();
    if (!openssl_pkey_export($chave, $pem, null, opcoesChaveEc())) {
        throw new RuntimeException('OpenSSL não conseguiu exportar a chave VAPID.');
    }
    try {
        consulta('DELETE FROM configuracoes WHERE chave IN (?, ?)', ['vapid_publica', 'vapid_privada']);
        consulta('INSERT INTO configuracoes (chave, valor) VALUES (?, ?), (?, ?)',
            ['vapid_publica', b64u($bruta), 'vapid_privada', $pem]);
    } catch (PDOException $e) {
        // Outro pedido criou ao mesmo tempo: vale a que ficou gravada.
    }
    return [(string) configuracao('vapid_publica'), (string) configuracao('vapid_privada')];
}

// O OpenSSL assina em DER; o JWT (ES256) quer r e s com 32 bytes cada, colados.
function assinaturaEs256(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) {
        $pos += ord($der[1]) & 0x7f;
    }
    $saida = '';
    for ($i = 0; $i < 2; $i++) {
        $tamanho = ord($der[$pos + 1]);
        $numero = ltrim(substr($der, $pos + 2, $tamanho), "\0");
        $saida .= str_pad($numero, 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $tamanho;
    }
    return $saida;
}

function cabecalhoVapid(string $endpoint): string
{
    [$publica, $privada] = chavesVapid();
    $p = parse_url($endpoint);
    $corpo = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . b64u(json_encode([
        'aud' => $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''),
        'exp' => time() + 12 * 3600,
        'sub' => PUSH_CONTATO,
    ], JSON_UNESCAPED_SLASHES));
    if (!openssl_sign($corpo, $der, $privada, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Não foi possível assinar o pedido de push.');
    }
    return "vapid t=$corpo." . b64u(assinaturaEs256($der)) . ", k=$publica";
}

// Cifra a mensagem para o aparelho (aes128gcm, RFC 8291): só ele consegue ler.
function cifraPush(string $mensagem, string $p256dh, string $auth): string
{
    $publicaAparelho = deB64u($p256dh);
    $segredoAparelho = deB64u($auth);
    $pem = "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode(hex2bin(PUSH_DER_P256) . $publicaAparelho), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
    [$minha, $minhaPublica] = novaChaveEc();
    $compartilhado = openssl_pkey_derive(openssl_pkey_get_public($pem), $minha, 32);
    if ($compartilhado === false) {
        throw new RuntimeException('Chave do aparelho inválida.');
    }
    $prkChave = hash_hmac('sha256', $compartilhado, $segredoAparelho, true);
    $ikm = hash_hmac('sha256', "WebPush: info\0" . $publicaAparelho . $minhaPublica . "\x01", $prkChave, true);
    $sal = random_bytes(16);
    $prk = hash_hmac('sha256', $ikm, $sal, true);
    $cek = substr(hash_hmac('sha256', "Content-Encoding: aes128gcm\0\x01", $prk, true), 0, 16);
    $nonce = substr(hash_hmac('sha256', "Content-Encoding: nonce\0\x01", $prk, true), 0, 12);
    $cifrado = openssl_encrypt($mensagem . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    return $sal . pack('N', 4096) . chr(strlen($minhaPublica)) . $minhaPublica . $cifrado . $tag;
}

// Devolve o código HTTP do serviço de push (201 = entregue; 404/410 = inscrição morta).
function postPush(string $endpoint, string $corpo, array $cabecalhos): int
{
    if (function_exists('curl_init')) {
        $c = curl_init($endpoint);
        curl_setopt_array($c, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $corpo,
            CURLOPT_HTTPHEADER => $cabecalhos,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($c);
        $status = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
        curl_close($c);
        return $status;
    }
    $contexto = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $cabecalhos),
        'content' => $corpo,
        'timeout' => 8,
        'ignore_errors' => true,
    ]]);
    @file_get_contents($endpoint, false, $contexto);
    $linha = $http_response_header[0] ?? '';
    return preg_match('/\s(\d{3})\s/', $linha . ' ', $m) ? (int) $m[1] : 0;
}

function enviaPush(array $inscricao, array $mensagem): int
{
    $corpo = cifraPush(
        json_encode($mensagem, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $inscricao['p256dh'],
        $inscricao['auth']
    );
    return postPush($inscricao['endpoint'], $corpo, [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'Content-Length: ' . strlen($corpo),
        'TTL: 86400',
        'Urgency: high',
        'Authorization: ' . cabecalhoVapid($inscricao['endpoint']),
    ]);
}

// Os pushes saem depois que a resposta já foi entregue ao aparelho de quem registrou,
// para ninguém esperar o serviço de push do Google ou da Apple.
function agendaPush(array $usuarioIds, string $texto): void
{
    static $fila = null;
    if ($fila === null) {
        $fila = [];
        register_shutdown_function(function () use (&$fila) {
            // Uma gravação rejeitada ou desfeita não pode gerar aviso de sucesso.
            if (http_response_code() >= 400) return;
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
                flush();
            }
            ignore_user_abort(true);
            foreach ($fila as [$ids, $corpo]) {
                notificaUsuarios($ids, $corpo);
            }
        });
    }
    $fila[] = [$usuarioIds, $texto];
}

function notificaUsuarios(array $usuarioIds, string $texto): int
{
    $usuarioIds = array_values(array_unique(array_map('intval', $usuarioIds)));
    if (!$usuarioIds || !pushDisponivel()) {
        return 0;
    }
    $entregues = 0;
    try {
        $marcas = implode(', ', array_fill(0, count($usuarioIds), '?'));
        $inscricoes = todas(
            "SELECT p.*, u.papel FROM inscricoes_push p JOIN usuarios u ON u.id = p.usuario_id
              WHERE u.ativo = 1 AND p.usuario_id IN ($marcas)",
            $usuarioIds
        );
        foreach ($inscricoes as $i) {
            try {
                $status = enviaPush($i, [
                    'titulo' => NOME_SISTEMA,
                    'corpo' => $texto,
                    'tag' => 'frota-avisos',
                    'url' => './?acao=avisos',
                    'nao_lidos' => avisosNaoLidos(['id' => (int) $i['usuario_id'], 'papel' => $i['papel']]),
                ]);
                if ($status === 404 || $status === 410) {
                    consulta('DELETE FROM inscricoes_push WHERE id = ?', [$i['id']]);
                } elseif ($status >= 200 && $status < 300) {
                    $entregues++;
                } else {
                    error_log("[frota] push recusado ($status) para o usuário {$i['usuario_id']}");
                }
            } catch (Throwable $e) {
                error_log('[frota] push: ' . $e->getMessage());
            }
        }
    } catch (Throwable $e) {
        error_log('[frota] push: ' . $e->getMessage());
    }
    return $entregues;
}

function rotaPushChave(): array
{
    exigeLogin();
    if (!pushDisponivel()) {
        return ['chave' => null];
    }
    try {
        return ['chave' => chavesVapid()[0]];
    } catch (Throwable $e) {
        error_log('[frota] VAPID: ' . $e->getMessage());
        return ['chave' => null];
    }
}

function rotaPushInscrever(): array
{
    $eu = exigeLogin();
    $corpo = corpoJson();
    $endpoint = is_string($corpo['endpoint'] ?? null) ? $corpo['endpoint'] : '';
    $p256dh = (string) ($corpo['keys']['p256dh'] ?? '');
    $auth = (string) ($corpo['keys']['auth'] ?? '');
    if (!preg_match('#^https://[^\s]+$#', $endpoint) || strlen($endpoint) > 1000
        || strlen(deB64u($p256dh)) !== 65 || strlen(deB64u($auth)) !== 16) {
        throw new ErroDeUso('Inscrição de notificação inválida.');
    }
    $hash = hash('sha256', $endpoint);
    consulta('DELETE FROM inscricoes_push WHERE endpoint_hash = ?', [$hash]);
    insere('inscricoes_push', [
        'usuario_id' => $eu['id'],
        'endpoint_hash' => $hash,
        'endpoint' => $endpoint,
        'p256dh' => $p256dh,
        'auth' => $auth,
        'criado_em' => agora(),
    ]);
    return ['ok' => true];
}

function rotaPushCancelar(): array
{
    exigeLogin();
    $endpoint = (string) (corpoJson()['endpoint'] ?? '');
    consulta('DELETE FROM inscricoes_push WHERE endpoint_hash = ?', [hash('sha256', $endpoint)]);
    return ['ok' => true];
}

function rotaPushTeste(): array
{
    $eu = exigeLogin();
    if (!pushDisponivel()) {
        throw new ErroDeUso('O PHP deste servidor não tem OpenSSL para enviar notificações.', 500);
    }
    $entregues = notificaUsuarios([$eu['id']], 'Teste: as notificações deste aparelho estão funcionando.');
    if ($entregues === 0) {
        throw new ErroDeUso('Nenhum aparelho recebeu. Ative as notificações de novo neste aparelho.');
    }
    return ['entregues' => $entregues];
}
