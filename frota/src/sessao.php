<?php

function iniciaSessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $segundos = DIAS_LOGADO * 24 * 60 * 60;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    ini_set('session.gc_maxlifetime', (string) $segundos);
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => $segundos,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $https,
    ]);
    if (BANCO === 'pgsql') {
        session_set_save_handler(new SessoesNoBanco($segundos), true);
    }
    session_name('frota');
    session_start();
}

class SessoesNoBanco implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface
{
    private int $duracao;

    public function __construct(int $duracao)
    {
        $this->duracao = $duracao;
    }

    public function open(string $caminho, string $nome): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string
    {
        return (string) umValor('SELECT dados FROM sessoes WHERE id = ? AND expira > ?', [$id, time()]);
    }

    public function write(string $id, string $dados): bool
    {
        consulta(
            'INSERT INTO sessoes (id, dados, expira) VALUES (?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, expira = EXCLUDED.expira',
            [$id, $dados, time() + $this->duracao]
        );
        return true;
    }

    public function destroy(string $id): bool
    {
        consulta('DELETE FROM sessoes WHERE id = ?', [$id]);
        return true;
    }

    public function gc(int $maximo): int|false
    {
        return consulta('DELETE FROM sessoes WHERE expira < ?', [time()])->rowCount();
    }

    public function validateId(string $id): bool
    {
        return umValor('SELECT 1 FROM sessoes WHERE id = ? AND expira > ?', [$id, time()]) !== null;
    }

    public function updateTimestamp(string $id, string $dados): bool
    {
        consulta('UPDATE sessoes SET expira = ? WHERE id = ?', [time() + $this->duracao, $id]);
        return true;
    }
}

function usuarioAtual(): ?array
{
    iniciaSessao();
    if (empty($_SESSION['usuario_id'])) {
        return null;
    }
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $u = umaLinha(
        'SELECT id, nome, usuario, papel, telefone, caminhao_padrao_id, valor_diaria_centavos
           FROM usuarios WHERE id = ? AND ativo = 1',
        [$_SESSION['usuario_id']]
    );
    if (!$u) {
        encerraSessao();
        return null;
    }
    $u['id'] = (int) $u['id'];
    $u['caminhao_padrao_id'] = $u['caminhao_padrao_id'] !== null ? (int) $u['caminhao_padrao_id'] : null;
    $u['valor_diaria_centavos'] = $u['valor_diaria_centavos'] !== null ? (int) $u['valor_diaria_centavos'] : null;
    $cache = $u;
    return $cache;
}

function exigeLogin(): array
{
    $u = usuarioAtual();
    if (!$u) {
        throw new ErroDeUso('Sua sessão expirou. Entre novamente.', 401);
    }
    return $u;
}

function exigeAdmin(): array
{
    $u = exigeLogin();
    if ($u['papel'] !== 'admin') {
        throw new ErroDeUso('Somente o proprietário pode fazer isso.', 403);
    }
    return $u;
}

function ehAdmin(): bool
{
    $u = usuarioAtual();
    return $u !== null && $u['papel'] === 'admin';
}

function criaSessao(int $usuarioId): void
{
    iniciaSessao();
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $usuarioId;
    $_SESSION['entrou_em'] = time();
}

function encerraSessao(): void
{
    iniciaSessao();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function exigePedidoDoApp(): void
{
    $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($metodo, ['GET', 'HEAD'], true)) {
        return;
    }
    if (($_SERVER['HTTP_X_APP_FROTA'] ?? '') !== '1') {
        throw new ErroDeUso('Pedido inválido. Recarregue a página e tente de novo.', 400);
    }
}

function podeTentarLogin(string $chave): bool
{
    $limite = 10;
    $minutos = 10;
    $linha = umaLinha('SELECT n, desde FROM tentativas_login WHERE chave = ?', [$chave]);
    $agora = time();

    if (!$linha) {
        consulta('INSERT INTO tentativas_login (chave, n, desde) VALUES (?, 1, ?)', [$chave, agora()]);
        return true;
    }
    if ($agora - strtotime($linha['desde']) > $minutos * 60) {
        consulta('UPDATE tentativas_login SET n = 1, desde = ? WHERE chave = ?', [agora(), $chave]);
        return true;
    }
    consulta('UPDATE tentativas_login SET n = n + 1 WHERE chave = ?', [$chave]);
    return ((int) $linha['n'] + 1) <= $limite;
}

function limpaTentativas(string $chave): void
{
    consulta('DELETE FROM tentativas_login WHERE chave = ?', [$chave]);
    consulta('DELETE FROM tentativas_login WHERE desde < ?', [date('Y-m-d H:i:s', time() - 86400)]);
}
