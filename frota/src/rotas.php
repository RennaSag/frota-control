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
        case 'DELETE categoria':
            return rotaExcluiCategoria(campoId($q['id'] ?? null, 'Categoria', true));

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
        case 'GET avisos':
            return rotaAvisos();
        case 'POST avisos-lidos':
            return rotaAvisosLidos();
        case 'GET pdf':
            return rotaPdf();
        case 'GET pdf-panorama':
            return rotaPdfPanorama();

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
    $qtd = $eu['papel'] === 'admin'
        ? ', (SELECT COUNT(*) FROM lancamentos l WHERE l.categoria_id = categorias.id) AS qtd_lancamentos'
        : '';
    return todas(
        "SELECT id, nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo $qtd
           FROM categorias $where ORDER BY tipo, ativo DESC, ordem, nome",
        $args
    );
}

function qtdLancamentosDaCategoria(int $id): int
{
    return (int) umValor('SELECT COUNT(*) FROM lancamentos WHERE categoria_id = ?', [$id]);
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
    $tipo = in_array($corpo['tipo'] ?? '', ['entrada', 'saida'], true) ? $corpo['tipo'] : $cat['tipo'];
    if ($tipo !== $cat['tipo'] && qtdLancamentosDaCategoria($id) > 0) {
        throw new ErroDeUso(
            'Esta categoria já tem lançamentos, por isso não pode mudar entre gasto e entrada. '
            . 'Crie uma categoria nova do outro tipo.'
        );
    }
    $igual = umValor(
        'SELECT id FROM categorias WHERE nome = ? AND tipo = ? AND id <> ?',
        [$nome, $tipo, $id]
    );
    if ($igual !== null) {
        throw new ErroDeUso('Já existe uma categoria com esse nome.');
    }
    atualiza('categorias', $id, [
        'nome' => $nome,
        'tipo' => $tipo,
        'ativo' => campoSimNao($corpo['ativo'] ?? null),
    ]);
    return ['ok' => true];
}

function rotaExcluiCategoria(int $id): array
{
    exigeAdmin();
    if (umValor('SELECT id FROM categorias WHERE id = ?', [$id]) === null) {
        throw new ErroDeUso('Categoria não encontrada.', 404);
    }
    $qtd = qtdLancamentosDaCategoria($id);
    if ($qtd > 0) {
        throw new ErroDeUso(
            "Esta categoria tem $qtd " . ($qtd === 1 ? 'lançamento' : 'lançamentos')
            . ' e não pode ser apagada sem perder esse histórico. Você pode escondê-la: '
            . 'ela some da hora de lançar, mas os lançamentos antigos continuam.',
            409
        );
    }
    consulta('DELETE FROM categorias WHERE id = ?', [$id]);
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
    $dados = [
        'usuario_id' => $usuarioId,
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'origem' => campoTexto($corpo['origem'] ?? null, 'Saindo de', true, 80),
        'destino' => campoTexto($corpo['destino'] ?? null, 'Indo para', true, 80),
        'inicio' => campoData($corpo['inicio'] ?? null, 'Data de saída'),
        'km_inicial' => campoNumero($corpo['km_inicial'] ?? null, 'Km inicial', 9999999, true),
        'status' => 'aberta',
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'criado_em' => agora(),
    ];
    $id = insere('viagens', $dados);
    registraAviso($eu, 'abriu', 'viagem', null,
        $dados['origem'] . ' → ' . $dados['destino'] . ' · saída ' . pdfData($dados['inicio']));
    return ['id' => $id];
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
    $novo = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    registraAviso($eu, 'criou', $novo['tipo'], $id, resumoDoLancamento($novo));
    return $novo;
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
    $editado = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    registraAviso($eu, 'editou', $editado['tipo'], $id, resumoDoLancamento($editado));
    return $editado;
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
    $completo = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    consulta('DELETE FROM lancamentos WHERE id = ?', [$id]);
    consulta('UPDATE avisos SET lancamento_id = NULL WHERE lancamento_id = ?', [$id]);
    registraAviso($eu, 'excluiu', $atual['tipo'], null, resumoDoLancamento($completo));
    if (!empty($atual['comprovante']) && preg_match('/^[A-Za-z0-9._-]+$/', $atual['comprovante'])) {
        apagaComprovante($atual['comprovante']);
    }
    return ['ok' => true];
}

// Avisos: o que os motoristas fazem fica registrado para o proprietário acompanhar.
function registraAviso(array $eu, string $acao, string $tipo, ?int $lancamentoId, string $resumo): void
{
    if ($eu['papel'] === 'admin') {
        return;
    }
    insere('avisos', [
        'usuario_id' => $eu['id'],
        'acao' => $acao,
        'tipo' => $tipo,
        'lancamento_id' => $lancamentoId,
        'resumo' => mb_substr($resumo, 0, 200),
        'criado_em' => agora(),
    ]);
}

function resumoDoLancamento(array $l): string
{
    return $l['categoria'] . ($l['descricao'] ? ' — ' . $l['descricao'] : '')
        . ' · ' . pdfReais((int) $l['valor_centavos']) . ' · ' . pdfData($l['data']);
}

function ultimoAvisoVisto(int $usuarioId): int
{
    $visto = umValor('SELECT ultimo_id FROM avisos_vistos WHERE usuario_id = ?', [$usuarioId]);
    if ($visto === null) {
        // Primeiro acesso: começa do zero, sem acusar o histórico antigo como novidade.
        $visto = (int) umValor('SELECT COALESCE(MAX(id), 0) FROM avisos');
        insere('avisos_vistos', ['usuario_id' => $usuarioId, 'ultimo_id' => $visto]);
    }
    return (int) $visto;
}

function rotaAvisos(): array
{
    $eu = exigeAdmin();
    $visto = ultimoAvisoVisto($eu['id']);
    $itens = todas(
        'SELECT a.id, a.acao, a.tipo, a.lancamento_id, a.resumo, a.criado_em, u.nome AS motorista
           FROM avisos a JOIN usuarios u ON u.id = a.usuario_id
          ORDER BY a.id DESC LIMIT 40'
    );
    foreach ($itens as &$a) {
        $a['novo'] = (int) $a['id'] > $visto;
        $a['segundos'] = max(0, time() - strtotime((string) $a['criado_em']));
    }
    unset($a);
    return [
        'nao_lidos' => (int) umValor('SELECT COUNT(*) FROM avisos WHERE id > ?', [$visto]),
        'ultimo_id' => (int) umValor('SELECT COALESCE(MAX(id), 0) FROM avisos'),
        'itens' => $itens,
    ];
}

function rotaAvisosLidos(): array
{
    $eu = exigeAdmin();
    ultimoAvisoVisto($eu['id']);
    $ultimo = (int) umValor('SELECT COALESCE(MAX(id), 0) FROM avisos');
    consulta('UPDATE avisos_vistos SET ultimo_id = ? WHERE usuario_id = ?', [$ultimo, $eu['id']]);
    return ['ok' => true];
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesPorExtenso(string $mes): string
{
    [$ano, $m] = explode('-', $mes);
    return MESES_PT[(int) $m - 1] . " de $ano";
}

function periodoPorExtenso(string $deMes, string $ateMes): string
{
    return $deMes === $ateMes ? mesPorExtenso($deMes) : mesPorExtenso($deMes) . ' a ' . mesPorExtenso($ateMes);
}

function mesesEntre(string $deMes, string $ateMes): array
{
    $lista = [];
    for ($m = $deMes; $m <= $ateMes; $m = date('Y-m', strtotime("$m-01 +1 month"))) {
        $lista[] = $m;
    }
    return $lista;
}

// Período do panorama em meses (AAAA-MM). Sem nada informado, é o mês atual.
function periodoPanorama(): array
{
    if (!empty($_GET['mes'])) {
        $deMes = $ateMes = mesValido($_GET['mes']);
    } else {
        $deMes = mesValido($_GET['de'] ?? '');
        $ateMes = mesValido($_GET['ate'] ?? '');
    }
    if ($deMes > $ateMes) {
        [$deMes, $ateMes] = [$ateMes, $deMes];
    }
    if (count(mesesEntre($deMes, $ateMes)) > 36) {
        throw new ErroDeUso('Escolha um período de até 36 meses.');
    }
    return [$deMes, $ateMes];
}

function dadosPanorama(string $deMes, string $ateMes): array
{
    $meses = mesesEntre($deMes, $ateMes);
    $de = limitesDoMes($deMes)[0];
    $ate = limitesDoMes($ateMes)[1];
    $antAteMes = mesAnterior($deMes);
    $antDeMes = date('Y-m', strtotime("$deMes-01 -" . count($meses) . ' month'));

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

    $coluna = sqlMes('data');
    $porMes = [];
    foreach (todas(
        "SELECT $coluna AS mes,
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor_centavos ELSE 0 END), 0) AS saidas_centavos,
                COUNT(*) AS qtd
           FROM lancamentos WHERE data BETWEEN ? AND ?
          GROUP BY $coluna",
        [$de, $ate]
    ) as $l) {
        $porMes[$l['mes']] = $l;
    }
    $serie = [];
    foreach ($meses as $mes) {
        $entradas = (int) ($porMes[$mes]['entradas_centavos'] ?? 0);
        $saidas = (int) ($porMes[$mes]['saidas_centavos'] ?? 0);
        $serie[] = [
            'mes' => $mes,
            'entradas_centavos' => $entradas,
            'saidas_centavos' => $saidas,
            'saldo_centavos' => $entradas - $saidas,
            'qtd' => (int) ($porMes[$mes]['qtd'] ?? 0),
        ];
    }

    $caminhoes = todas(
        "SELECT cm.id, COALESCE(cm.placa, 'Sem caminhão') AS placa, cm.apelido,
                COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
                COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos,
                COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.litros ELSE 0 END), 0) AS litros,
                COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.valor_centavos ELSE 0 END), 0) AS combustivel_centavos,
                COUNT(*) AS qtd
           FROM lancamentos l
           JOIN categorias c ON c.id = l.categoria_id
           LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
          WHERE l.data BETWEEN ? AND ?
          GROUP BY cm.id, cm.placa, cm.apelido ORDER BY saidas_centavos DESC",
        [$de, $ate]
    );
    foreach ($caminhoes as &$cm) {
        $cm['km_rodados'] = $cm['id'] ? (int) umValor(
            'SELECT COALESCE(SUM(km_final - km_inicial), 0) FROM viagens
              WHERE caminhao_id = ? AND km_final IS NOT NULL AND km_inicial IS NOT NULL
                AND inicio BETWEEN ? AND ?',
            [$cm['id'], $de, $ate]
        ) : 0;
        $cm['saldo_centavos'] = (int) $cm['entradas_centavos'] - (int) $cm['saidas_centavos'];
    }
    unset($cm);

    return [
        'de' => $deMes,
        'ate' => $ateMes,
        'anterior_de' => $antDeMes,
        'anterior_ate' => $antAteMes,
        'atual' => $totais($de, $ate),
        'anterior' => $totais(limitesDoMes($antDeMes)[0], limitesDoMes($antAteMes)[1]),
        'litros' => (float) $combustivel['litros'],
        'combustivel_centavos' => (int) $combustivel['centavos'],
        'meses' => $serie,
        'saidas_por_categoria' => $porCategoria('saida'),
        'entradas_por_categoria' => $porCategoria('entrada'),
        'por_caminhao' => $caminhoes,
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

function rotaResumo(): array
{
    exigeAdmin();
    return dadosPanorama(...periodoPanorama());
}

function pdfReais(int $centavos): string
{
    return ($centavos < 0 ? '-' : '') . 'R$ ' . number_format(abs($centavos) / 100, 2, ',', '.');
}

function pdfNumero(float $n, int $casas = 0): string
{
    return number_format($n, $casas, ',', '.');
}

function pdfData(?string $d): string
{
    return $d ? implode('/', array_reverse(explode('-', substr($d, 0, 10)))) : '';
}

function pdfCorSaldo(int $centavos): array
{
    return $centavos >= 0 ? PDF_VERDE : PDF_VERMELHO;
}

function pdfTabelaLancamentos(Pdf $pdf, array $itens): void
{
    $pdf->tabela(
        [
            ['Data', 44], ['Tipo', 32], ['Categoria', 64], ['Descrição', 90], ['Valor', 54, true],
            ['Caminhão', 44], ['Motorista', 58], ['Viagem', 72], ['Litros', 30, true], ['Km', 34, true],
            ['Onde foi', 60], ['Quem pagou', 58], ['Pagamento', 52], ['Observação', 94],
        ],
        array_map(fn ($l) => [
            pdfData($l['data']),
            $l['tipo'] === 'entrada' ? 'Entrada' : 'Saída',
            (string) $l['categoria'],
            (string) $l['descricao'],
            [pdfReais((int) $l['valor_centavos']), $l['tipo'] === 'entrada' ? PDF_VERDE : PDF_VERMELHO],
            (string) $l['placa'],
            (string) $l['motorista'],
            $l['viagem_origem'] ? $l['viagem_origem'] . ' > ' . $l['viagem_destino'] : '',
            $l['litros'] !== null && $l['litros'] !== '' ? pdfNumero((float) $l['litros'], 2) : '',
            $l['km'] !== null && $l['km'] !== '' ? pdfNumero((float) $l['km']) : '',
            (string) $l['lugar'],
            (string) $l['cliente'],
            (string) $l['pagamento'],
            (string) $l['observacao'],
        ], $itens),
        'Nenhum lançamento encontrado.'
    );
}

function enviaPdf(Pdf $pdf, string $nome): void
{
    $geradoEm = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('d/m/Y H:i');
    $pdf->emCadaPagina(function (Pdf $p, int $n, int $total) use ($geradoEm) {
        $y = PDF_ALTURA - PDF_MARGEM + 6;
        $p->texto(PDF_MARGEM, $y, "Gerado em $geradoEm", 7, false, PDF_CINZA);
        $p->celula(PDF_MARGEM, $y, PDF_LARGURA - 2 * PDF_MARGEM, "Página $n de $total", 7, false, true, PDF_CINZA);
    });
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $nome . '"');
    header('Cache-Control: no-store');
    echo $pdf->gera();
    exit;
}

function rotaPdf(): void
{
    exigeAdmin();
    [$where, $args] = filtrosLancamento();
    $itens = todas(SQL_LANCAMENTO . " $where ORDER BY l.data, l.id", $args);

    if (!empty($_GET['mes'])) {
        [$de, $ate] = limitesDoMes(mesValido($_GET['mes']));
    } else {
        $de = $_GET['de'] ?? ($itens[0]['data'] ?? '');
        $ate = $_GET['ate'] ?? ($itens ? end($itens)['data'] : '');
    }
    $periodo = $de || $ate ? '  ·  Período: ' . pdfData($de) . ' a ' . pdfData($ate) : '';

    $entradas = 0;
    $saidas = 0;
    foreach ($itens as $l) {
        $l['tipo'] === 'entrada' ? $entradas += (int) $l['valor_centavos'] : $saidas += (int) $l['valor_centavos'];
    }

    $pdf = new Pdf();
    $pdf->novaPagina();
    $pdf->cabecalho('Lançamentos', NOME_SISTEMA . $periodo);
    $pdf->indicadores([
        ['Entradas', pdfReais($entradas), PDF_VERDE],
        ['Saídas', pdfReais($saidas), PDF_VERMELHO],
        ['Saldo', pdfReais($entradas - $saidas), pdfCorSaldo($entradas - $saidas)],
        ['Lançamentos', (string) count($itens), PDF_TINTA],
    ]);
    $pdf->y += 6;
    pdfTabelaLancamentos($pdf, $itens);
    enviaPdf($pdf, 'lancamentos-' . date('Y-m-d') . '.pdf');
}

function rotaPdfPanorama(): void
{
    exigeAdmin();
    [$deMes, $ateMes] = periodoPanorama();
    $d = dadosPanorama($deMes, $ateMes);
    $a = $d['atual'];
    $varios = count($d['meses']) > 1;

    $pdf = new Pdf();
    $pdf->novaPagina();
    $pdf->cabecalho('Panorama', NOME_SISTEMA . '  ·  ' . periodoPorExtenso($deMes, $ateMes));

    $pdf->indicadores([
        ['Entradas (fretes)', pdfReais($a['entradas_centavos']), PDF_VERDE],
        ['Saídas (gastos)', pdfReais($a['saidas_centavos']), PDF_VERMELHO],
        ['Saldo', pdfReais($a['saldo_centavos']), pdfCorSaldo($a['saldo_centavos'])],
        ['Lançamentos', (string) $a['qtd'], PDF_TINTA],
        ['Viagens abertas hoje', (string) $d['viagens_abertas'], PDF_TINTA],
    ]);
    $litros = $d['litros'];
    $comMovimento = count(array_filter($d['meses'], fn ($m) => $m['qtd'] > 0)) ?: 1;
    $pdf->indicadores(array_merge([
        ['Combustível', pdfReais($d['combustivel_centavos']), PDF_TINTA],
        ['Litros', pdfNumero($litros, 2), PDF_TINTA],
        ['Preço médio do litro', $litros > 0 ? pdfReais((int) round($d['combustivel_centavos'] / $litros)) : '—', PDF_TINTA],
    ], $varios ? [
        ['Saldo médio por mês', pdfReais((int) round($a['saldo_centavos'] / $comMovimento)),
            pdfCorSaldo($a['saldo_centavos'])],
    ] : []));

    $periodoAnterior = periodoPorExtenso($d['anterior_de'], $d['anterior_ate']);
    $diferenca = $a['saldo_centavos'] - $d['anterior']['saldo_centavos'];
    $pdf->texto(PDF_MARGEM, $pdf->y + 4, $d['anterior']['qtd']
        ? 'Comparado a ' . $periodoAnterior . ' (saldo de ' . pdfReais($d['anterior']['saldo_centavos']) . '): '
            . pdfReais(abs($diferenca)) . ($diferenca >= 0 ? ' melhor.' : ' pior.')
        : "Sem lançamentos em $periodoAnterior para comparar.", 8, false, PDF_CINZA);
    $pdf->y += 10;

    if ($varios) {
        $pdf->secao('Mês a mês');
        $pdf->tabela(
            [['Mês', 130], ['Entradas', 100, true], ['Saídas', 100, true], ['Saldo', 100, true], ['Lançamentos', 70, true]],
            array_map(fn ($m) => [
                mesPorExtenso($m['mes']),
                pdfReais($m['entradas_centavos']),
                pdfReais($m['saidas_centavos']),
                [pdfReais($m['saldo_centavos']), pdfCorSaldo($m['saldo_centavos'])],
                (string) $m['qtd'],
            ], $d['meses'])
        );
    }

    $pdf->secao('Por caminhão');
    $pdf->tabela(
        [['Caminhão', 150], ['Entradas', 85, true], ['Saídas', 85, true], ['Saldo', 85, true],
            ['Combustível', 85, true], ['Litros', 60, true], ['R$/litro', 60, true], ['Km', 60, true], ['Km/litro', 60, true]],
        array_map(function ($c) {
            $litros = (float) $c['litros'];
            $km = (int) $c['km_rodados'];
            return [
                $c['placa'] . ($c['apelido'] ? ' — ' . $c['apelido'] : ''),
                pdfReais((int) $c['entradas_centavos']),
                pdfReais((int) $c['saidas_centavos']),
                [pdfReais($c['saldo_centavos']), pdfCorSaldo($c['saldo_centavos'])],
                pdfReais((int) $c['combustivel_centavos']),
                $litros ? pdfNumero($litros, 2) : '—',
                $litros ? pdfReais((int) round($c['combustivel_centavos'] / $litros)) : '—',
                $km ? pdfNumero($km) : '—',
                $km && $litros ? pdfNumero($km / $litros, 2) : '—',
            ];
        }, $d['por_caminhao'])
    );

    $porCategoria = function (array $itens, int $total, string $rotulo) use ($pdf) {
        $pdf->tabela(
            [[$rotulo, 200], ['Lançamentos', 70, true], ['Total', 100, true], ['% do total', 70, true]],
            array_map(fn ($i) => [
                (string) $i['nome'],
                (string) $i['qtd'],
                pdfReais((int) $i['total_centavos']),
                $total ? pdfNumero($i['total_centavos'] / $total * 100, 1) . '%' : '—',
            ], $itens)
        );
    };
    $pdf->secao('Saídas por categoria');
    $porCategoria($d['saidas_por_categoria'], $a['saidas_centavos'], 'Categoria');
    $pdf->secao('Entradas por tipo de frete');
    $porCategoria($d['entradas_por_categoria'], $a['entradas_centavos'], 'Tipo de frete');

    $pdf->secao('Gastos por motorista');
    $pdf->tabela(
        [['Motorista', 200], ['Lançamentos', 70, true], ['Total', 100, true]],
        array_map(fn ($i) => [(string) $i['nome'], (string) $i['qtd'], pdfReais((int) $i['total_centavos'])],
            $d['por_motorista'])
    );

    $pdf->novaPagina();
    $pdf->secao('Lançamentos do período');
    pdfTabelaLancamentos($pdf, todas(
        SQL_LANCAMENTO . ' WHERE l.data BETWEEN ? AND ? ORDER BY l.data, l.id',
        [limitesDoMes($deMes)[0], limitesDoMes($ateMes)[1]]
    ));

    enviaPdf($pdf, 'panorama-' . ($deMes === $ateMes ? $deMes : "$deMes-a-$ateMes") . '.pdf');
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
