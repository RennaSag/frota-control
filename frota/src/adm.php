<?php
declare(strict_types=1);

// Acesso ADM (suporte): entra com FROTA_ADM_USUARIO / FROTA_ADM_SENHA, só gerencia senhas e acessos
// e nunca aparece para o proprietário nem para os motoristas. No banco ele é o papel "sistema".
const PAPEL_ADM = 'sistema';
const ROTAS_ADM = ['POST login', 'POST logout', 'GET eu', 'GET adm-usuarios', 'PUT adm-usuario'];

function loginDoAdm(): string
{
    $login = mb_strtolower(trim(conf('ADM_USUARIO', '')));
    return $login !== '' && mb_strlen(conf('ADM_SENHA', '')) >= 8 ? $login : '';
}

// Devolve o id do ADM quando usuário e senha conferem com a configuração; null quando não é o ADM.
function entraComoAdm(string $usuario, string $senha): ?int
{
    $login = loginDoAdm();
    if ($login === '' || $usuario !== $login) {
        return null;
    }
    if (!hash_equals(hash('sha256', conf('ADM_SENHA', '')), hash('sha256', $senha))) {
        throw new ErroDeUso('Usuário ou senha incorretos.', 401);
    }
    $u = umaLinha('SELECT id, papel, ativo FROM usuarios WHERE usuario = ?', [$login]);
    if ($u && $u['papel'] !== PAPEL_ADM) {
        throw new ErroDeUso('Já existe um usuário comum com o login do ADM. Escolha outro FROTA_ADM_USUARIO.', 409);
    }
    if ($u) {
        if (!(int) $u['ativo']) {
            atualiza('usuarios', (int) $u['id'], ['ativo' => 1]);
        }
        return (int) $u['id'];
    }
    // A senha de verdade fica só na configuração; o hash gravado é aleatório e nunca confere.
    return insere('usuarios', [
        'nome' => 'ADM', 'usuario' => $login,
        'senha_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
        'papel' => PAPEL_ADM, 'ativo' => 1, 'criado_em' => instanteCadastro(),
    ]);
}

function exigeAdm(): array
{
    $eu = exigeLogin();
    if ($eu['papel'] !== PAPEL_ADM) {
        throw new ErroDeUso('Endereço não encontrado.', 404);
    }
    return $eu;
}

function loginsTravados(): array
{
    $desde = time() - 10 * 60;
    $presos = [];
    foreach (todas('SELECT chave, n, desde FROM tentativas_login WHERE n > ?', [9]) as $l) {
        if (strtotime((string) $l['desde']) >= $desde) {
            $presos[explode('|', (string) $l['chave'])[0]] = true;
        }
    }
    return $presos;
}

function rotaAdmUsuarios(): array
{
    exigeAdm();
    $presos = loginsTravados();
    $lista = todas(
        'SELECT id, nome, usuario, papel, telefone, ativo, criado_em
           FROM usuarios WHERE papel <> ? ORDER BY ativo DESC, papel, nome',
        [PAPEL_ADM]
    );
    foreach ($lista as &$u) {
        $u['login_travado'] = isset($presos[$u['usuario']]);
    }
    return $lista;
}

function encerraSessoesDe(int $id): void
{
    $marca = 'usuario_id|i:' . $id . ';';
    if (BANCO === 'pgsql') {
        consulta('DELETE FROM sessoes WHERE dados LIKE ?', ['%' . $marca . '%']);
        return;
    }
    // Nos outros bancos as sessões ficam nos arquivos padrão do PHP.
    iniciaSessao();
    $pasta = explode(';', (string) session_save_path());
    $pasta = end($pasta) ?: sys_get_temp_dir();
    foreach (glob(rtrim($pasta, '/\\') . DIRECTORY_SEPARATOR . 'sess_*') ?: [] as $arquivo) {
        if (basename($arquivo) !== 'sess_' . session_id() && str_contains((string) @file_get_contents($arquivo), $marca)) {
            @unlink($arquivo);
        }
    }
}

function destravaLogin(string $usuario): void
{
    foreach (todas('SELECT chave FROM tentativas_login') as $l) {
        if (explode('|', (string) $l['chave'])[0] === $usuario) {
            consulta('DELETE FROM tentativas_login WHERE chave = ?', [$l['chave']]);
        }
    }
}

function rotaAdmEditaUsuario(int $id): array
{
    exigeAdm();
    $corpo = corpoJson();
    $u = umaLinha('SELECT id, usuario, papel, ativo FROM usuarios WHERE id = ?', [$id]);
    if (!$u || $u['papel'] === PAPEL_ADM) {
        throw new ErroDeUso('Usuário não encontrado.', 404);
    }
    $nova = (string) ($corpo['senha_nova'] ?? '');
    if ($nova !== '') {
        if (mb_strlen($nova) < 4) {
            throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
        }
        atualiza('usuarios', $id, ['senha_hash' => password_hash($nova, PASSWORD_DEFAULT)]);
        encerraSessoesDe($id);
        destravaLogin((string) $u['usuario']);
    }
    if (array_key_exists('ativo', $corpo) && $corpo['ativo'] !== null && $corpo['ativo'] !== '') {
        $ativo = in_array($corpo['ativo'], [true, 1, '1', 'true', 'sim', 'on'], true) ? 1 : 0;
        if (!$ativo && $u['papel'] === 'admin' && (int) $u['ativo']) {
            $outros = (int) umValor(
                "SELECT COUNT(*) FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?",
                [$id]
            );
            if ($outros === 0) {
                throw new ErroDeUso('É preciso manter ao menos um proprietário ativo.');
            }
        }
        atualiza('usuarios', $id, ['ativo' => $ativo]);
        if (!$ativo) {
            encerraSessoesDe($id);
        }
    }
    if (!empty($corpo['destravar'])) {
        destravaLogin((string) $u['usuario']);
    }
    return ['ok' => true];
}
