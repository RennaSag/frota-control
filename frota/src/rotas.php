<?php

const SQL_LANCAMENTO = '
    SELECT l.*, c.nome AS categoria, c.icone, c.tipo AS categoria_tipo,
           c.pede_litros, c.pede_descricao,
           u.nome AS motorista, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      JOIN usuarios u ON u.id = l.usuario_id
      LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
      LEFT JOIN viagens v ON v.id = l.viagem_id';

const SQL_VIAGEM = '
    SELECT v.*, u.nome AS motorista, cm.placa, cm.apelido AS caminhao_apelido,
           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l
             WHERE l.viagem_id = v.id AND l.tipo = \'saida\') AS saidas_centavos,
           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l
             WHERE l.viagem_id = v.id AND l.tipo = \'entrada\') AS entradas_centavos,
           (SELECT COUNT(*) FROM lancamentos l WHERE l.viagem_id = v.id) AS qtd_lancamentos
      FROM viagens v
      JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN caminhoes cm ON cm.id = v.caminhao_id';

const PAGAMENTOS = ['Dinheiro', 'Cartão da empresa', 'Pix', 'Cartão frete', 'Boleto', 'Do próprio bolso'];

function despacha(string $r, string $metodo)
{
    $q = $_GET;
    switch ("$metodo $r") {
        case 'POST login':
            return rotaLogin();
        case 'POST logout':
            encerraSessao();
            return ['ok' => true];
        case 'GET eu':
            return exigeLogin();
        case 'POST trocar-senha':
            return rotaTrocarSenha();

        case 'GET usuarios':
            return rotaUsuarios();
        case 'POST usuarios':
            return rotaNovoUsuario();
        case 'PUT usuario':
            return rotaEditaUsuario(campoId($q['id'] ?? null, 'Usuário', true));

        case 'GET caminhoes':
            exigeLogin();
            $todos = ehAdmin() && ($q['todos'] ?? '') === '1';
            return todas(
                'SELECT id, placa, apelido, ativo FROM caminhoes '
                . ($todos ? '' : 'WHERE ativo = 1 ') . 'ORDER BY ativo DESC, placa'
            );
        case 'POST caminhoes':
            return rotaNovoCaminhao();
        case 'PUT caminhao':
            return rotaEditaCaminhao(campoId($q['id'] ?? null, 'Caminhão', true));

        case 'GET categorias':
            return rotaCategorias();
        case 'POST categorias':
            return rotaNovaCategoria();
        case 'PUT categoria':
            return rotaEditaCategoria(campoId($q['id'] ?? null, 'Categoria', true));

        case 'GET viagens':
            return rotaViagens();
        case 'POST viagens':
            return rotaNovaViagem();
        case 'PUT viagem':
            return rotaEditaViagem(campoId($q['id'] ?? null, 'Viagem', true));
        case 'POST viagem-encerrar':
            return rotaEncerraViagem(campoId($q['id'] ?? null, 'Viagem', true));
        case 'DELETE viagem':
            exigeAdmin();
            $id = campoId($q['id'] ?? null, 'Viagem', true);
            consulta('UPDATE lancamentos SET viagem_id = NULL WHERE viagem_id = ?', [$id]);
            if (!consulta('DELETE FROM viagens WHERE id = ?', [$id])->rowCount()) {
                throw new ErroDeUso('Viagem não encontrada.', 404);
            }
            return ['ok' => true];

        case 'GET lancamentos':
            return rotaLancamentos();
        case 'GET lancamento':
            return rotaUmLancamento(campoId($q['id'] ?? null, 'Lançamento', true));
        case 'POST lancamentos':
            return rotaNovoLancamento();
        case 'PUT lancamento':
            return rotaEditaLancamento(campoId($q['id'] ?? null, 'Lançamento', true));
        case 'DELETE lancamento':
            return rotaExcluiLancamento(campoId($q['id'] ?? null, 'Lançamento', true));

        case 'GET resumo':
            return rotaResumo();
        case 'GET historico':
            return rotaHistorico();
        case 'GET relatorio':
            return rotaRelatorio();
        case 'GET csv':
            return rotaCsv();

        case 'POST comprovante':
            return rotaEnviaComprovante();
        case 'GET comprovante':
            return rotaBaixaComprovante();
    }
    throw new ErroDeUso('Endereço não encontrado.', 404);
}

function rotaLogin(): array
{
    $corpo = corpoJson();
    $usuario = mb_strtolower(campoTexto($corpo['usuario'] ?? null, 'Usuário', true, 40));
    $senha = (string) ($corpo['senha'] ?? '');
    $chave = substr($usuario . '|' . ($_SERVER['REMOTE_ADDR'] ?? '?'), 0, 120);

    if (!podeTentarLogin($chave)) {
        throw new ErroDeUso('Muitas tentativas de senha. Espere alguns minutos e tente de novo.', 429);
    }
    $u = umaLinha('SELECT * FROM usuarios WHERE usuario = ?', [$usuario]);
    if (!$u || !(int) $u['ativo'] || !password_verify($senha, $u['senha_hash'])) {
        throw new ErroDeUso('Usuário ou senha incorretos.', 401);
    }
    limpaTentativas($chave);
    criaSessao((int) $u['id']);
    return [
        'id' => (int) $u['id'],
        'nome' => $u['nome'],
        'usuario' => $u['usuario'],
        'papel' => $u['papel'],
    ];
}

function rotaTrocarSenha(): array
{
    $eu = exigeLogin();
    $corpo = corpoJson();
    $atual = (string) ($corpo['senha_atual'] ?? '');
    $nova = (string) ($corpo['senha_nova'] ?? '');
    if (mb_strlen($nova) < 4) {
        throw new ErroDeUso('A nova senha deve ter ao menos 4 caracteres.');
    }
    $u = umaLinha('SELECT senha_hash FROM usuarios WHERE id = ?', [$eu['id']]);
    if (!password_verify($atual, $u['senha_hash'])) {
        throw new ErroDeUso('Senha atual incorreta.');
    }
    atualiza('usuarios', $eu['id'], ['senha_hash' => password_hash($nova, PASSWORD_DEFAULT)]);
    return ['ok' => true];
}

function rotaUsuarios(): array
{
    $eu = exigeLogin();
    if ($eu['papel'] !== 'admin') {
        return [['id' => $eu['id'], 'nome' => $eu['nome'], 'papel' => $eu['papel'], 'ativo' => 1]];
    }
    return todas(
        'SELECT id, nome, usuario, papel, telefone, ativo, criado_em
           FROM usuarios ORDER BY ativo DESC, papel, nome'
    );
}

function rotaNovoUsuario(): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $nome = campoTexto($corpo['nome'] ?? null, 'Nome', true, 80);
    $usuario = mb_strtolower(preg_replace('/\s+/', '', campoTexto($corpo['usuario'] ?? null, 'Usuário', true, 40)));
    $senha = (string) ($corpo['senha'] ?? '');
    $papel = ($corpo['papel'] ?? '') === 'admin' ? 'admin' : 'motorista';

    if (!preg_match('/^[a-z0-9._-]{3,40}$/', $usuario)) {
        throw new ErroDeUso('O usuário deve ter de 3 a 40 caracteres: letras, números, ponto ou -.');
    }
    if (mb_strlen($senha) < 4) {
        throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
    }
    if (umValor('SELECT id FROM usuarios WHERE usuario = ?', [$usuario]) !== null) {
        throw new ErroDeUso('Já existe um usuário com esse login.');
    }
    $id = insere('usuarios', [
        'nome' => $nome,
        'usuario' => $usuario,
        'senha_hash' => password_hash($senha, PASSWORD_DEFAULT),
        'papel' => $papel,
        'telefone' => campoTexto($corpo['telefone'] ?? null, 'Telefone', false, 30),
        'ativo' => 1,
        'criado_em' => agora(),
    ]);
    return ['id' => $id];
}

function rotaEditaUsuario(int $id): array
{
    $eu = exigeAdmin();
    $corpo = corpoJson();
    $u = umaLinha('SELECT * FROM usuarios WHERE id = ?', [$id]);
    if (!$u) {
        throw new ErroDeUso('Usuário não encontrado.', 404);
    }
    $papel = ($corpo['papel'] ?? '') === 'admin' ? 'admin' : 'motorista';
    $ativo = campoSimNao($corpo['ativo'] ?? null);

    if ((int) $u['id'] === $eu['id'] && ($papel !== 'admin' || !$ativo)) {
        throw new ErroDeUso('Você não pode remover o seu próprio acesso de proprietário.');
    }
    if ($u['papel'] === 'admin' && $papel !== 'admin') {
        $outros = (int) umValor(
            "SELECT COUNT(*) FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?",
            [$id]
        );
        if ($outros === 0) {
            throw new ErroDeUso('É preciso manter ao menos um proprietário ativo.');
        }
    }
    atualiza('usuarios', $id, [
        'nome' => campoTexto($corpo['nome'] ?? null, 'Nome', true, 80),
        'telefone' => campoTexto($corpo['telefone'] ?? null, 'Telefone', false, 30),
        'papel' => $papel,
        'ativo' => $ativo,
    ]);
    $nova = (string) ($corpo['senha_nova'] ?? '');
    if ($nova !== '') {
        if (mb_strlen($nova) < 4) {
            throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
        }
        atualiza('usuarios', $id, ['senha_hash' => password_hash($nova, PASSWORD_DEFAULT)]);
    }
    return ['ok' => true];
}

function rotaNovoCaminhao(): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $placa = mb_strtoupper(campoTexto($corpo['placa'] ?? null, 'Placa', true, 10));
    if (umValor('SELECT id FROM caminhoes WHERE placa = ?', [$placa]) !== null) {
        throw new ErroDeUso('Essa placa já está cadastrada.');
    }
    return ['id' => insere('caminhoes', [
        'placa' => $placa,
        'apelido' => campoTexto($corpo['apelido'] ?? null, 'Apelido', false, 60),
        'ativo' => 1,
        'criado_em' => agora(),
    ])];
}

function rotaEditaCaminhao(int $id): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $placa = mb_strtoupper(campoTexto($corpo['placa'] ?? null, 'Placa', true, 10));
    if (umValor('SELECT id FROM caminhoes WHERE placa = ? AND id <> ?', [$placa, $id]) !== null) {
        throw new ErroDeUso('Essa placa já está cadastrada em outro caminhão.');
    }
    $mudou = atualiza('caminhoes', $id, [
        'placa' => $placa,
        'apelido' => campoTexto($corpo['apelido'] ?? null, 'Apelido', false, 60),
        'ativo' => campoSimNao($corpo['ativo'] ?? null),
    ]);
    if (!$mudou && umValor('SELECT id FROM caminhoes WHERE id = ?', [$id]) === null) {
        throw new ErroDeUso('Caminhão não encontrado.', 404);
    }
    return ['ok' => true];
}

function rotaCategorias(): array
{
    $eu = exigeLogin();
    $cond = [];
    $args = [];
    if ($eu['papel'] !== 'admin') {
        $cond[] = "tipo = 'saida'";
        $cond[] = 'ativo = 1';
    } elseif (($_GET['todos'] ?? '') !== '1') {
        $cond[] = 'ativo = 1';
    }
    if (in_array($_GET['tipo'] ?? '', ['entrada', 'saida'], true)) {
        $cond[] = 'tipo = ?';
        $args[] = $_GET['tipo'];
    }
    $where = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';
    return todas(
        "SELECT id, nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo
           FROM categorias $where ORDER BY tipo, ativo DESC, ordem, nome",
        $args
    );
}

function rotaNovaCategoria(): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $nome = campoTexto($corpo['nome'] ?? null, 'Nome', true, 40);
    $tipo = ($corpo['tipo'] ?? '') === 'entrada' ? 'entrada' : 'saida';
    if (umValor('SELECT id FROM categorias WHERE nome = ? AND tipo = ?', [$nome, $tipo]) !== null) {
        throw new ErroDeUso('Já existe uma categoria com esse nome.');
    }
    return ['id' => insere('categorias', [
        'nome' => $nome,
        'tipo' => $tipo,
        'icone' => $tipo === 'entrada' ? 'plus' : 'tag',
        'pede_litros' => 0,
        'pede_descricao' => 0,
        'ordem' => 500,
        'ativo' => 1,
    ])];
}

function rotaEditaCategoria(int $id): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $cat = umaLinha('SELECT * FROM categorias WHERE id = ?', [$id]);
    if (!$cat) {
        throw new ErroDeUso('Categoria não encontrada.', 404);
    }
    $nome = campoTexto($corpo['nome'] ?? null, 'Nome', true, 40);
    $igual = umValor(
        'SELECT id FROM categorias WHERE nome = ? AND tipo = ? AND id <> ?',
        [$nome, $cat['tipo'], $id]
    );
    if ($igual !== null) {
        throw new ErroDeUso('Já existe uma categoria com esse nome.');
    }
    atualiza('categorias', $id, ['nome' => $nome, 'ativo' => campoSimNao($corpo['ativo'] ?? null)]);
    return ['ok' => true];
}

function viagemAcessivel(int $id): array
{
    $eu = exigeLogin();
    $v = umaLinha('SELECT * FROM viagens WHERE id = ?', [$id]);
    if (!$v) {
        throw new ErroDeUso('Viagem não encontrada.', 404);
    }
    if ($eu['papel'] !== 'admin' && (int) $v['usuario_id'] !== $eu['id']) {
        throw new ErroDeUso('Essa viagem não é sua.', 403);
    }
    return $v;
}

function rotaViagens(): array
{
    $eu = exigeLogin();
    $cond = [];
    $args = [];
    if ($eu['papel'] !== 'admin') {
        $cond[] = 'v.usuario_id = ?';
        $args[] = $eu['id'];
    } elseif (!empty($_GET['usuario_id'])) {
        $cond[] = 'v.usuario_id = ?';
        $args[] = campoId($_GET['usuario_id'], 'Motorista');
    }
    if (in_array($_GET['status'] ?? '', ['aberta', 'encerrada'], true)) {
        $cond[] = 'v.status = ?';
        $args[] = $_GET['status'];
    }
    [$limite, $offset] = paginacao($_GET);
    $where = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';
    return todas(
        SQL_VIAGEM . " $where
          ORDER BY CASE WHEN v.status = 'aberta' THEN 0 ELSE 1 END, v.inicio DESC, v.id DESC
          LIMIT $limite OFFSET $offset",
        $args
    );
}

function rotaNovaViagem(): array
{
    $eu = exigeLogin();
    $corpo = corpoJson();
    $usuarioId = $eu['papel'] === 'admin' && !empty($corpo['usuario_id'])
        ? campoId($corpo['usuario_id'], 'Motorista')
        : $eu['id'];
    return ['id' => insere('viagens', [
        'usuario_id' => $usuarioId,
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'origem' => campoTexto($corpo['origem'] ?? null, 'Saindo de', true, 80),
        'destino' => campoTexto($corpo['destino'] ?? null, 'Indo para', true, 80),
        'inicio' => campoData($corpo['inicio'] ?? null, 'Data de saída'),
        'km_inicial' => campoNumero($corpo['km_inicial'] ?? null, 'Km inicial', 9999999, true),
        'status' => 'aberta',
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'criado_em' => agora(),
    ])];
}

function rotaEditaViagem(int $id): array
{
    $eu = exigeLogin();
    $atual = viagemAcessivel($id);
    $corpo = corpoJson();
    $inicio = campoData($corpo['inicio'] ?? null, 'Data de saída');
    $fim = campoData($corpo['fim'] ?? null, 'Data de chegada', false);
    $kmInicial = campoNumero($corpo['km_inicial'] ?? null, 'Km inicial', 9999999, true);
    $kmFinal = campoNumero($corpo['km_final'] ?? null, 'Km final', 9999999, true);
    if ($fim !== null && $fim < $inicio) {
        throw new ErroDeUso('A chegada não pode ser antes da saída.');
    }
    if ($kmFinal !== null && $kmInicial !== null && $kmFinal < $kmInicial) {
        throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
    }
    atualiza('viagens', $id, [
        'usuario_id' => $eu['papel'] === 'admin' && !empty($corpo['usuario_id'])
            ? campoId($corpo['usuario_id'], 'Motorista')
            : (int) $atual['usuario_id'],
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'origem' => campoTexto($corpo['origem'] ?? null, 'Saindo de', true, 80),
        'destino' => campoTexto($corpo['destino'] ?? null, 'Indo para', true, 80),
        'inicio' => $inicio,
        'fim' => $fim,
        'km_inicial' => $kmInicial,
        'km_final' => $kmFinal,
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'status' => ($corpo['status'] ?? '') === 'encerrada' ? 'encerrada' : 'aberta',
    ]);
    return ['ok' => true];
}

function rotaEncerraViagem(int $id): array
{
    $v = viagemAcessivel($id);
    $corpo = corpoJson();
    $fim = campoData($corpo['fim'] ?? date('Y-m-d'), 'Data de chegada');
    $kmFinal = campoNumero($corpo['km_final'] ?? null, 'Km final', 9999999, true);
    if ($fim < $v['inicio']) {
        throw new ErroDeUso('A chegada não pode ser antes da saída.');
    }
    if ($kmFinal !== null && $v['km_inicial'] !== null && $kmFinal < (int) $v['km_inicial']) {
        throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
    }
    atualiza('viagens', $id, ['status' => 'encerrada', 'fim' => $fim, 'km_final' => $kmFinal]);
    return ['ok' => true];
}

function filtrosLancamento(): array
{
    $eu = exigeLogin();
    $cond = [];
    $args = [];
    if ($eu['papel'] !== 'admin') {
        $cond[] = 'l.usuario_id = ?';
        $args[] = $eu['id'];
        $cond[] = "l.tipo = 'saida'";
    } else {
        if (!empty($_GET['usuario_id'])) {
            $cond[] = 'l.usuario_id = ?';
            $args[] = campoId($_GET['usuario_id'], 'Motorista');
        }
        if (in_array($_GET['tipo'] ?? '', ['entrada', 'saida'], true)) {
            $cond[] = 'l.tipo = ?';
            $args[] = $_GET['tipo'];
        }
    }
    if (!empty($_GET['mes'])) {
        [$de, $ate] = limitesDoMes(mesValido($_GET['mes']));
        $cond[] = 'l.data BETWEEN ? AND ?';
        $args[] = $de;
        $args[] = $ate;
    }
    if (!empty($_GET['de'])) {
        $cond[] = 'l.data >= ?';
        $args[] = campoData($_GET['de'], 'Data inicial');
    }
    if (!empty($_GET['ate'])) {
        $cond[] = 'l.data <= ?';
        $args[] = campoData($_GET['ate'], 'Data final');
    }
    foreach (['categoria_id' => 'Categoria', 'caminhao_id' => 'Caminhão', 'viagem_id' => 'Viagem'] as $campo => $rotulo) {
        if (!empty($_GET[$campo])) {
            $cond[] = "l.$campo = ?";
            $args[] = campoId($_GET[$campo], $rotulo);
        }
    }
    $busca = campoTexto($_GET['busca'] ?? null, 'Busca', false, 60);
    if ($busca !== null) {
        $like = BANCO === 'pgsql' ? 'ILIKE' : 'LIKE';
        $cond[] = "(l.descricao $like ? OR l.observacao $like ? OR l.lugar $like ? OR l.cliente $like ?)";
        for ($i = 0; $i < 4; $i++) {
            $args[] = '%' . $busca . '%';
        }
    }
    return [$cond ? 'WHERE ' . implode(' AND ', $cond) : '', $args];
}

function rotaLancamentos(): array
{
    [$where, $args] = filtrosLancamento();
    [$limite, $offset, $pagina] = paginacao($_GET);
    $itens = todas(SQL_LANCAMENTO . " $where ORDER BY l.data DESC, l.id DESC LIMIT $limite OFFSET $offset", $args);
    $totais = umaLinha(
        "SELECT COUNT(*) AS qtd,
                COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos
           FROM lancamentos l $where",
        $args
    );
    return [
        'itens' => $itens,
        'qtd' => (int) $totais['qtd'],
        'entradas_centavos' => (int) $totais['entradas_centavos'],
        'saidas_centavos' => (int) $totais['saidas_centavos'],
        'saldo_centavos' => (int) $totais['entradas_centavos'] - (int) $totais['saidas_centavos'],
        'pagina' => $pagina,
    ];
}

function rotaUmLancamento(int $id): array
{
    $eu = exigeLogin();
    $l = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    if (!$l) {
        throw new ErroDeUso('Lançamento não encontrado.', 404);
    }
    if ($eu['papel'] !== 'admin' && (int) $l['usuario_id'] !== $eu['id']) {
        throw new ErroDeUso('Sem acesso a este lançamento.', 403);
    }
    return $l;
}

function dadosLancamento(array $eu, ?array $atual = null): array
{
    $corpo = corpoJson();
    $categoriaId = campoId($corpo['categoria_id'] ?? null, 'Categoria', true);
    $cat = umaLinha('SELECT * FROM categorias WHERE id = ?', [$categoriaId]);
    if (!$cat) {
        throw new ErroDeUso('Categoria inválida.');
    }
    if ($eu['papel'] !== 'admin' && $cat['tipo'] !== 'saida') {
        throw new ErroDeUso('Somente o proprietário lança entradas.', 403);
    }
    $viagemId = campoId($corpo['viagem_id'] ?? null, 'Viagem');
    if ($viagemId !== null) {
        viagemAcessivel($viagemId);
    }
    $comprovante = campoTexto($corpo['comprovante'] ?? null, 'Comprovante', false, 120);
    if ($comprovante !== null && !preg_match('/^[A-Za-z0-9._-]+$/', $comprovante)) {
        throw new ErroDeUso('Comprovante inválido.');
    }
    $usuarioId = $eu['papel'] === 'admin' && !empty($corpo['usuario_id'])
        ? campoId($corpo['usuario_id'], 'Motorista')
        : ($atual !== null ? (int) $atual['usuario_id'] : $eu['id']);

    return [
        'tipo' => $cat['tipo'],
        'usuario_id' => $usuarioId,
        'viagem_id' => $viagemId,
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'categoria_id' => $categoriaId,
        'descricao' => campoTexto(
            $corpo['descricao'] ?? null,
            $cat['tipo'] === 'entrada' ? 'Descrição da entrada' : 'Descrição do gasto',
            (bool) (int) $cat['pede_descricao'],
            140
        ),
        'valor_centavos' => campoCentavos($corpo['valor'] ?? null),
        'litros' => campoNumero($corpo['litros'] ?? null, 'Litros', 5000),
        'km' => campoNumero($corpo['km'] ?? null, 'Km', 9999999, true),
        'data' => campoData($corpo['data'] ?? null, 'Data'),
        'pagamento' => campoTexto($corpo['pagamento'] ?? null, 'Forma de pagamento', false, 30),
        'lugar' => campoTexto($corpo['lugar'] ?? null, 'Onde foi', false, 90),
        'cliente' => campoTexto($corpo['cliente'] ?? null, 'Quem pagou', false, 90),
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'comprovante' => $comprovante,
    ];
}

function rotaNovoLancamento(): array
{
    $eu = exigeLogin();
    $dados = dadosLancamento($eu);
    $dados['criado_em'] = agora();
    $dados['criado_por'] = $eu['id'];
    $id = insere('lancamentos', $dados);
    return umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
}

function rotaEditaLancamento(int $id): array
{
    $eu = exigeLogin();
    $atual = umaLinha('SELECT * FROM lancamentos WHERE id = ?', [$id]);
    if (!$atual) {
        throw new ErroDeUso('Lançamento não encontrado.', 404);
    }
    if ($eu['papel'] !== 'admin' && (int) $atual['usuario_id'] !== $eu['id']) {
        throw new ErroDeUso('Você só pode editar os seus próprios gastos.', 403);
    }
    $dados = dadosLancamento($eu, $atual);
    $dados['atualizado_em'] = agora();
    $dados['atualizado_por'] = $eu['id'];
    atualiza('lancamentos', $id, $dados);
    return umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
}

function rotaExcluiLancamento(int $id): array
{
    $eu = exigeLogin();
    $atual = umaLinha('SELECT * FROM lancamentos WHERE id = ?', [$id]);
    if (!$atual) {
        throw new ErroDeUso('Lançamento não encontrado.', 404);
    }
    if ($eu['papel'] !== 'admin' && (int) $atual['usuario_id'] !== $eu['id']) {
        throw new ErroDeUso('Você só pode excluir os seus próprios gastos.', 403);
    }
    consulta('DELETE FROM lancamentos WHERE id = ?', [$id]);
    if (!empty($atual['comprovante']) && preg_match('/^[A-Za-z0-9._-]+$/', $atual['comprovante'])) {
        apagaComprovante($atual['comprovante']);
    }
    return ['ok' => true];
}

function rotaResumo(): array
{
    exigeAdmin();
    $mes = mesValido($_GET['mes'] ?? '');
    [$de, $ate] = limitesDoMes($mes);
    $anterior = mesAnterior($mes);
    [$deAnt, $ateAnt] = limitesDoMes($anterior);

    $totais = function (string $inicio, string $fim): array {
        $t = umaLinha(
            "SELECT COUNT(*) AS qtd,
                    COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                    COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor_centavos ELSE 0 END), 0) AS saidas_centavos
               FROM lancamentos WHERE data BETWEEN ? AND ?",
            [$inicio, $fim]
        );
        return [
            'qtd' => (int) $t['qtd'],
            'entradas_centavos' => (int) $t['entradas_centavos'],
            'saidas_centavos' => (int) $t['saidas_centavos'],
            'saldo_centavos' => (int) $t['entradas_centavos'] - (int) $t['saidas_centavos'],
        ];
    };

    $combustivel = umaLinha(
        "SELECT COALESCE(SUM(l.litros), 0) AS litros,
                COALESCE(SUM(l.valor_centavos), 0) AS centavos
           FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
          WHERE c.pede_litros = 1 AND l.data BETWEEN ? AND ?",
        [$de, $ate]
    );

    $porCategoria = function (string $tipo) use ($de, $ate): array {
        return todas(
            "SELECT c.nome, c.icone, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
              WHERE l.tipo = ? AND l.data BETWEEN ? AND ?
              GROUP BY c.id, c.nome, c.icone ORDER BY total_centavos DESC",
            [$tipo, $de, $ate]
        );
    };

    return [
        'mes' => $mes,
        'mes_anterior' => $anterior,
        'atual' => $totais($de, $ate),
        'anterior' => $totais($deAnt, $ateAnt),
        'litros' => (float) $combustivel['litros'],
        'combustivel_centavos' => (int) $combustivel['centavos'],
        'saidas_por_categoria' => $porCategoria('saida'),
        'entradas_por_categoria' => $porCategoria('entrada'),
        'por_caminhao' => todas(
            "SELECT COALESCE(cm.placa, 'Sem caminhão') AS placa, cm.apelido,
                    COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                    COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos,
                    COUNT(*) AS qtd
               FROM lancamentos l LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
              WHERE l.data BETWEEN ? AND ?
              GROUP BY cm.id, cm.placa, cm.apelido ORDER BY saidas_centavos DESC",
            [$de, $ate]
        ),
        'por_motorista' => todas(
            "SELECT u.nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id
              WHERE l.tipo = 'saida' AND l.data BETWEEN ? AND ?
              GROUP BY u.id, u.nome ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
        'por_dia' => todas(
            "SELECT l.data,
                    COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                    COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos
               FROM lancamentos l WHERE l.data BETWEEN ? AND ?
              GROUP BY l.data ORDER BY l.data",
            [$de, $ate]
        ),
        'viagens_abertas' => (int) umValor("SELECT COUNT(*) FROM viagens WHERE status = 'aberta'"),
    ];
}

function rotaHistorico(): array
{
    exigeAdmin();
    $meses = max(3, min((int) ($_GET['meses'] ?? 12), 36));
    $primeiro = date('Y-m-01', strtotime('-' . ($meses - 1) . ' month'));
    $coluna = sqlMes('data');
    $linhas = todas(
        "SELECT $coluna AS mes,
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor_centavos ELSE 0 END), 0) AS saidas_centavos,
                COUNT(*) AS qtd
           FROM lancamentos WHERE data >= ?
          GROUP BY $coluna ORDER BY mes",
        [$primeiro]
    );

    $porMes = [];
    foreach ($linhas as $l) {
        $porMes[$l['mes']] = $l;
    }
    $saida = [];
    for ($i = $meses - 1; $i >= 0; $i--) {
        $mes = date('Y-m', strtotime("-$i month"));
        $l = $porMes[$mes] ?? null;
        $entradas = (int) ($l['entradas_centavos'] ?? 0);
        $saidas = (int) ($l['saidas_centavos'] ?? 0);
        $saida[] = [
            'mes' => $mes,
            'entradas_centavos' => $entradas,
            'saidas_centavos' => $saidas,
            'saldo_centavos' => $entradas - $saidas,
            'qtd' => (int) ($l['qtd'] ?? 0),
        ];
    }
    return ['meses' => $saida];
}

function periodoRelatorio(): array
{
    $ate = !empty($_GET['ate']) ? campoData($_GET['ate'], 'Data final') : date('Y-m-t');
    $de = !empty($_GET['de'])
        ? campoData($_GET['de'], 'Data inicial')
        : date('Y-m-01', strtotime($ate . ' -11 month'));
    if ($de > $ate) {
        throw new ErroDeUso('A data inicial não pode ser depois da data final.');
    }
    return [$de, $ate];
}

function rotaRelatorio(): array
{
    exigeAdmin();
    [$de, $ate] = periodoRelatorio();

    $caminhoes = todas(
        "SELECT cm.id, cm.placa, cm.apelido,
                COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos,
                COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.litros ELSE 0 END), 0) AS litros,
                COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.valor_centavos ELSE 0 END), 0) AS combustivel_centavos,
                COUNT(l.id) AS qtd
           FROM caminhoes cm
           LEFT JOIN lancamentos l ON l.caminhao_id = cm.id AND l.data BETWEEN ? AND ?
           LEFT JOIN categorias c ON c.id = l.categoria_id
          GROUP BY cm.id, cm.placa, cm.apelido ORDER BY cm.placa",
        [$de, $ate]
    );

    foreach ($caminhoes as &$cm) {
        $km = umValor(
            'SELECT COALESCE(SUM(km_final - km_inicial), 0) FROM viagens
              WHERE caminhao_id = ? AND km_final IS NOT NULL AND km_inicial IS NOT NULL
                AND inicio BETWEEN ? AND ?',
            [$cm['id'], $de, $ate]
        );
        $cm['km_rodados'] = (int) $km;
        $cm['saldo_centavos'] = (int) $cm['entradas_centavos'] - (int) $cm['saidas_centavos'];
    }
    unset($cm);

    return [
        'de' => $de,
        'ate' => $ate,
        'por_caminhao' => $caminhoes,
        'saidas_por_categoria' => todas(
            "SELECT c.nome, c.icone, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
              WHERE l.tipo = 'saida' AND l.data BETWEEN ? AND ?
              GROUP BY c.id, c.nome, c.icone ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
        'entradas_por_categoria' => todas(
            "SELECT c.nome, c.icone, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
              WHERE l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
              GROUP BY c.id, c.nome, c.icone ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
        'por_motorista' => todas(
            "SELECT u.nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id
              WHERE l.tipo = 'saida' AND l.data BETWEEN ? AND ?
              GROUP BY u.id, u.nome ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
    ];
}

function rotaCsv(): void
{
    exigeAdmin();
    [$where, $args] = filtrosLancamento();
    $itens = todas(SQL_LANCAMENTO . " $where ORDER BY l.data, l.id", $args);

    $nome = 'lancamentos-' . date('Y-m-d') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nome . '"');
    header('Cache-Control: no-store');

    $linha = function (array $campos): string {
        $saida = [];
        foreach ($campos as $c) {
            $saida[] = '"' . str_replace('"', '""', (string) $c) . '"';
        }
        return implode(';', $saida) . "\r\n";
    };

    echo "\xEF\xBB\xBF";
    echo $linha(['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Caminhão', 'Motorista',
        'Viagem', 'Litros', 'Km', 'Onde foi', 'Quem pagou', 'Pagamento', 'Observação']);
    foreach ($itens as $l) {
        echo $linha([
            $l['data'],
            $l['tipo'] === 'entrada' ? 'Entrada' : 'Saída',
            $l['categoria'],
            $l['descricao'],
            number_format(((int) $l['valor_centavos']) / 100, 2, ',', ''),
            $l['placa'],
            $l['motorista'],
            $l['viagem_origem'] ? $l['viagem_origem'] . ' > ' . $l['viagem_destino'] : '',
            $l['litros'],
            $l['km'],
            $l['lugar'],
            $l['cliente'],
            $l['pagamento'],
            $l['observacao'],
        ]);
    }
    exit;
}

function pastaUploads(): string
{
    $pasta = __DIR__ . '/../uploads';
    if (!is_dir($pasta)) {
        mkdir($pasta, 0777, true);
    }
    return $pasta;
}

function guardaComprovante(string $nome, string $temporario): void
{
    if (BANCO === 'pgsql') {
        $arquivo = fopen($temporario, 'rb');
        $st = banco()->prepare('INSERT INTO comprovantes (nome, dados, criado_em) VALUES (?, ?, ?)');
        $st->bindValue(1, $nome);
        $st->bindValue(2, $arquivo, PDO::PARAM_LOB);
        $st->bindValue(3, agora());
        $st->execute();
        fclose($arquivo);
        return;
    }
    if (!move_uploaded_file($temporario, pastaUploads() . '/' . $nome)) {
        throw new ErroDeUso('Não foi possível salvar a foto no servidor.', 500);
    }
}

function leComprovante(string $nome): ?string
{
    if (BANCO === 'pgsql') {
        $dados = umValor('SELECT dados FROM comprovantes WHERE nome = ?', [$nome]);
        return is_resource($dados) ? stream_get_contents($dados) : $dados;
    }
    $caminho = pastaUploads() . '/' . $nome;
    return is_file($caminho) ? file_get_contents($caminho) : null;
}

function apagaComprovante(string $nome): void
{
    if (BANCO === 'pgsql') {
        consulta('DELETE FROM comprovantes WHERE nome = ?', [$nome]);
        return;
    }
    $caminho = pastaUploads() . '/' . $nome;
    if (is_file($caminho)) {
        @unlink($caminho);
    }
}

function rotaEnviaComprovante(): array
{
    exigeLogin();
    $arquivo = $_FILES['foto'] ?? null;
    if (!$arquivo || ($arquivo['error'] ?? 1) !== UPLOAD_ERR_OK) {
        $erro = $arquivo['error'] ?? UPLOAD_ERR_NO_FILE;
        if (in_array($erro, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new ErroDeUso('A foto é muito grande. Tente uma foto menor.');
        }
        throw new ErroDeUso('Não foi possível receber a foto. Tente de novo.');
    }
    if ($arquivo['size'] > 8 * 1024 * 1024) {
        throw new ErroDeUso('A foto é muito grande (máximo 8 MB).');
    }

    $inicio = (string) file_get_contents($arquivo['tmp_name'], false, null, 0, 16);
    $imagem = @getimagesize($arquivo['tmp_name']);
    $extensao = null;
    if ($imagem !== false) {
        $extensao = [
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
        ][$imagem[2]] ?? null;
    } elseif (strncmp($inicio, '%PDF', 4) === 0) {
        $extensao = 'pdf';
    }
    if ($extensao === null) {
        throw new ErroDeUso('Envie uma foto (JPG, PNG, WEBP) ou um PDF.');
    }

    $nome = date('YmdHis') . '-' . bin2hex(random_bytes(5)) . '.' . $extensao;
    guardaComprovante($nome, $arquivo['tmp_name']);
    return ['comprovante' => $nome];
}

function rotaBaixaComprovante(): void
{
    $eu = exigeLogin();
    $arquivo = (string) ($_GET['arquivo'] ?? '');
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $arquivo) || strpos($arquivo, '..') !== false) {
        throw new ErroDeUso('Arquivo inválido.');
    }
    $dono = umValor('SELECT usuario_id FROM lancamentos WHERE comprovante = ?', [$arquivo]);
    if ($dono !== null && $eu['papel'] !== 'admin' && (int) $dono !== $eu['id']) {
        throw new ErroDeUso('Sem acesso a este comprovante.', 403);
    }
    $conteudo = leComprovante($arquivo);
    if ($conteudo === null) {
        throw new ErroDeUso('Comprovante não encontrado.', 404);
    }
    $tipos = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
    $extensao = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($tipos[$extensao] ?? 'application/octet-stream'));
    header('Content-Length: ' . strlen($conteudo));
    header('Content-Disposition: inline; filename="' . $arquivo . '"');
    header('X-Content-Type-Options: nosniff');
    echo $conteudo;
    exit;
}
