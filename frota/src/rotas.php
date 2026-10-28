<?php

const SQL_LANCAMENTO = '
    SELECT l.*, c.nome AS categoria, c.icone, c.tipo AS categoria_tipo,
           c.pede_litros, c.pede_descricao,
           u.nome AS motorista, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino,
           rb.cliente AS recebivel_cliente, rb.descricao AS recebivel_descricao
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      JOIN usuarios u ON u.id = l.usuario_id
      LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
      LEFT JOIN viagens v ON v.id = l.viagem_id
      LEFT JOIN recebiveis rb ON rb.id = l.recebivel_id';

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
        case 'DELETE usuario':
            return rotaExcluiUsuario(campoId($q['id'] ?? null, 'Usuário', true));

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
        case 'DELETE caminhao':
            return rotaExcluiCaminhao(campoId($q['id'] ?? null, 'Caminhão', true));

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
            foreach (['lancamentos', 'recebiveis', 'notas_fiscais', 'diarias'] as $tabela) {
                consulta("UPDATE $tabela SET viagem_id = NULL WHERE viagem_id = ?", [$id]);
            }
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
        case 'GET push-chave':
            return rotaPushChave();
        case 'POST push-inscrever':
            return rotaPushInscrever();
        case 'POST push-cancelar':
            return rotaPushCancelar();
        case 'POST push-teste':
            return rotaPushTeste();
        case 'GET pdf':
            return rotaPdf();
        case 'GET pdf-panorama':
            return rotaPdfPanorama();

        case 'POST comprovante':
            return rotaEnviaComprovante();
        case 'GET comprovante':
            return rotaBaixaComprovante();

        case 'GET receita':
            return rotaReceita();

        case 'GET notas':
            return rotaNotas();
        case 'POST notas':
            return rotaNovaNota();
        case 'PUT nota':
            return rotaEditaNota(campoId($q['id'] ?? null, 'Nota fiscal', true));
        case 'DELETE nota':
            return rotaExcluiNota(campoId($q['id'] ?? null, 'Nota fiscal', true));

        case 'GET recebiveis':
            return rotaRecebiveis();
        case 'GET recebivel':
            return rotaUmRecebivel(campoId($q['id'] ?? null, 'Frete a receber', true));
        case 'POST recebiveis':
            return rotaNovoRecebivel();
        case 'PUT recebivel':
            return rotaEditaRecebivel(campoId($q['id'] ?? null, 'Frete a receber', true));
        case 'DELETE recebivel':
            return rotaExcluiRecebivel(campoId($q['id'] ?? null, 'Frete a receber', true));
        case 'POST recebivel-receber':
            return rotaRecebeParte(campoId($q['id'] ?? null, 'Frete a receber', true));

        case 'GET diarias':
            return rotaDiarias();
        case 'POST diarias':
            return rotaNovasDiarias();
        case 'PUT diaria':
            return rotaEditaDiaria(campoId($q['id'] ?? null, 'Diária', true));
        case 'DELETE diaria':
            return rotaExcluiDiaria(campoId($q['id'] ?? null, 'Diária', true));
        case 'POST diarias-pagar':
            return rotaPagaDiarias();
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
    return exigeLogin();
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
        return [[
            'id' => $eu['id'], 'nome' => $eu['nome'], 'papel' => $eu['papel'], 'ativo' => 1,
            'caminhao_padrao_id' => $eu['caminhao_padrao_id'],
            'valor_diaria_centavos' => $eu['valor_diaria_centavos'],
        ]];
    }
    return todas(
        'SELECT id, nome, usuario, papel, telefone, caminhao_padrao_id, valor_diaria_centavos, ativo, criado_em
           FROM usuarios ORDER BY ativo DESC, papel, nome'
    );
}

function camposExtrasUsuario(array $corpo): array
{
    $caminhaoId = campoId($corpo['caminhao_padrao_id'] ?? null, 'Caminhão padrão');
    if ($caminhaoId !== null && umValor('SELECT id FROM caminhoes WHERE id = ?', [$caminhaoId]) === null) {
        throw new ErroDeUso('Caminhão padrão não encontrado.');
    }
    return [
        'caminhao_padrao_id' => $caminhaoId,
        'valor_diaria_centavos' => campoCentavosOpcional($corpo['valor_diaria'] ?? null, 'Valor da diária'),
    ];
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
    ] + camposExtrasUsuario($corpo));
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
    $nova = (string) ($corpo['senha_nova'] ?? '');
    if ($nova !== '' && mb_strlen($nova) < 4) {
        throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
    }
    atualiza('usuarios', $id, [
        'nome' => campoTexto($corpo['nome'] ?? null, 'Nome', true, 80),
        'telefone' => campoTexto($corpo['telefone'] ?? null, 'Telefone', false, 30),
        'papel' => $papel,
        'ativo' => $ativo,
    ] + camposExtrasUsuario($corpo));
    if ($nova !== '') {
        atualiza('usuarios', $id, ['senha_hash' => password_hash($nova, PASSWORD_DEFAULT)]);
    }
    return ['ok' => true];
}

// Só apaga quem nunca lançou nada; quem tem histórico deve ser bloqueado, para os relatórios não perderem o nome.
function rotaExcluiUsuario(int $id): array
{
    $eu = exigeAdmin();
    $u = umaLinha('SELECT * FROM usuarios WHERE id = ?', [$id]);
    if (!$u) {
        throw new ErroDeUso('Usuário não encontrado.', 404);
    }
    if ((int) $u['id'] === $eu['id']) {
        throw new ErroDeUso('Você não pode excluir o seu próprio acesso.');
    }
    if ($u['papel'] === 'admin') {
        throw new ErroDeUso('Acessos de proprietário não podem ser excluídos. Mude para motorista ou bloqueie.');
    }
    $historico = (int) umValor('SELECT COUNT(*) FROM lancamentos WHERE usuario_id = ?', [$id])
        + (int) umValor('SELECT COUNT(*) FROM viagens WHERE usuario_id = ?', [$id])
        + (int) umValor('SELECT COUNT(*) FROM diarias WHERE usuario_id = ?', [$id])
        + (int) umValor('SELECT COUNT(*) FROM notas_fiscais WHERE usuario_id = ?', [$id]);
    if ($historico > 0) {
        throw new ErroDeUso(
            'Este motorista já tem lançamentos, viagens, diárias ou notas no sistema e não pode ser '
            . 'excluído sem perder esse histórico. Bloqueie o acesso dele em "Editar".',
            409
        );
    }
    consulta('DELETE FROM avisos WHERE usuario_id = ? OR para_usuario_id = ?', [$id, $id]);
    consulta('DELETE FROM avisos_vistos WHERE usuario_id = ?', [$id]);
    consulta('DELETE FROM inscricoes_push WHERE usuario_id = ?', [$id]);
    consulta('DELETE FROM envios_fila WHERE usuario_id = ?', [$id]);
    consulta('DELETE FROM usuarios WHERE id = ?', [$id]);
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

function rotaExcluiCaminhao(int $id): array
{
    exigeAdmin();
    $placa = umValor('SELECT placa FROM caminhoes WHERE id = ?', [$id]);
    if ($placa === null) {
        throw new ErroDeUso('Caminhão não encontrado.', 404);
    }
    $historico = 0;
    foreach (['lancamentos', 'viagens', 'recebiveis', 'notas_fiscais'] as $tabela) {
        $historico += (int) umValor("SELECT COUNT(*) FROM $tabela WHERE caminhao_id = ?", [$id]);
    }
    if ($historico > 0) {
        throw new ErroDeUso(
            "O caminhão $placa já tem lançamentos ou viagens e não pode ser excluído sem perder esse "
            . 'histórico. Marque-o como "Fora de operação" em "Editar".',
            409
        );
    }
    consulta('UPDATE usuarios SET caminhao_padrao_id = NULL WHERE caminhao_padrao_id = ?', [$id]);
    consulta('DELETE FROM caminhoes WHERE id = ?', [$id]);
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
        $cond[] = 'oculta_motorista = 0';
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
        "SELECT id, nome, tipo, icone, pede_litros, pede_descricao, oculta_motorista, ordem, ativo $qtd
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
        'oculta_motorista' => $tipo === 'saida' ? campoSimNao($corpo['oculta_motorista'] ?? null, false) : 0,
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
        'oculta_motorista' => $tipo === 'saida'
            ? campoSimNao($corpo['oculta_motorista'] ?? null, (bool) (int) $cat['oculta_motorista'])
            : 0,
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

// O motorista só pode corrigir ou apagar o que ele mesmo registrou, e só nos primeiros minutos.
// Depois disso, só o proprietário altera.
const MINUTOS_PARA_CORRIGIR = 5;

function segundosParaCorrigir($criadoEm): int
{
    if (!$criadoEm) {
        return 0;
    }
    $passou = time() - strtotime(substr((string) $criadoEm, 0, 19));
    return max(0, MINUTOS_PARA_CORRIGIR * 60 - $passou);
}

function podeCorrigir(array $eu, array $registro, string $campoDono): bool
{
    if ($eu['papel'] === 'admin') {
        return true;
    }
    return (int) $registro[$campoDono] === $eu['id'] && segundosParaCorrigir($registro['criado_em']) > 0;
}

function exigePrazoDoMotorista(array $eu, array $registro, string $campoDono, string $oQue): void
{
    if ($eu['papel'] === 'admin') {
        return;
    }
    if ((int) $registro[$campoDono] !== $eu['id']) {
        throw new ErroDeUso('Você só pode alterar o que você mesmo registrou.', 403);
    }
    if (segundosParaCorrigir($registro['criado_em']) <= 0) {
        throw new ErroDeUso(
            'O prazo de ' . MINUTOS_PARA_CORRIGIR . " minutos para corrigir $oQue terminou. "
            . 'Agora só o proprietário pode alterar ou excluir.',
            403
        );
    }
}

// Diz para a tela se o botão de editar/excluir aparece e por quanto tempo.
function anotaPrazo(array $eu, array $registro, string $campoDono): array
{
    $pode = podeCorrigir($eu, $registro, $campoDono);
    $registro['pode_alterar'] = $pode;
    $registro['segundos_para_alterar'] = $eu['papel'] === 'admin' ? null
        : ($pode ? segundosParaCorrigir($registro['criado_em']) : 0);
    return $registro;
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
    return array_map(fn ($v) => anotaPrazo($eu, $v, 'usuario_id'), todas(
        SQL_VIAGEM . " $where
          ORDER BY CASE WHEN v.status = 'aberta' THEN 0 ELSE 1 END, v.inicio DESC, v.id DESC
          LIMIT $limite OFFSET $offset",
        $args
    ));
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
    $resumo = $dados['origem'] . ' → ' . $dados['destino'] . ' · saída ' . pdfData($dados['inicio']);
    registraAviso($eu, 'abriu', 'viagem', null, $resumo);
    if ($eu['papel'] === 'admin') {
        registraAviso($eu, 'abriu', 'viagem', null, 'Nova viagem para você: ' . $resumo, $usuarioId);
    }
    return ['id' => $id];
}

function rotaEditaViagem(int $id): array
{
    $eu = exigeLogin();
    $atual = viagemAcessivel($id);
    exigePrazoDoMotorista($eu, $atual, 'usuario_id', 'esta viagem');
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
    if ($v['status'] === 'encerrada' && !ehAdmin()) {
        throw new ErroDeUso('Esta viagem já foi encerrada. Para corrigir, fale com o proprietário.', 403);
    }
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
        $cond[] = 'l.categoria_id NOT IN (SELECT id FROM categorias WHERE oculta_motorista = 1)';
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
    $porCampo = ['categoria_id' => 'Categoria', 'caminhao_id' => 'Caminhão', 'viagem_id' => 'Viagem',
        'recebivel_id' => 'Frete a receber'];
    foreach ($porCampo as $campo => $rotulo) {
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
    $eu = exigeLogin();
    $itens = array_map(
        fn ($l) => anotaPrazo($eu, $l, 'criado_por'),
        todas(SQL_LANCAMENTO . " $where ORDER BY l.data DESC, l.id DESC LIMIT $limite OFFSET $offset", $args)
    );
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
    if ($eu['papel'] !== 'admin'
        && ((int) $l['usuario_id'] !== $eu['id'] || $l['tipo'] !== 'saida' || categoriaOculta((int) $l['categoria_id']))) {
        throw new ErroDeUso('Sem acesso a este lançamento.', 403);
    }
    return anotaPrazo($eu, $l, 'criado_por');
}

function categoriaOculta(int $id): bool
{
    return (bool) (int) umValor('SELECT oculta_motorista FROM categorias WHERE id = ?', [$id]);
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
    if ($eu['papel'] !== 'admin' && (int) $cat['oculta_motorista']) {
        throw new ErroDeUso('Categoria inválida.');
    }
    $recebivelId = null;
    if ($eu['papel'] === 'admin' && $cat['tipo'] === 'entrada') {
        $recebivelId = campoId($corpo['recebivel_id'] ?? null, 'Frete a receber');
        if ($recebivelId !== null && umValor('SELECT id FROM recebiveis WHERE id = ?', [$recebivelId]) === null) {
            throw new ErroDeUso('Frete a receber não encontrado.');
        }
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
        'recebivel_id' => $recebivelId,
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
    return anotaPrazo($eu, $novo, 'criado_por');
}

function rotaEditaLancamento(int $id): array
{
    $eu = exigeLogin();
    $atual = umaLinha('SELECT * FROM lancamentos WHERE id = ?', [$id]);
    if (!$atual) {
        throw new ErroDeUso('Lançamento não encontrado.', 404);
    }
    exigePrazoDoMotorista($eu, $atual, 'criado_por', 'este lançamento');
    $dados = dadosLancamento($eu, $atual);
    $dados['atualizado_em'] = agora();
    $dados['atualizado_por'] = $eu['id'];
    atualiza('lancamentos', $id, $dados);
    $editado = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    registraAviso($eu, 'editou', $editado['tipo'], $id, resumoDoLancamento($editado));
    return anotaPrazo($eu, $editado, 'criado_por');
}

function rotaExcluiLancamento(int $id): array
{
    $eu = exigeLogin();
    $atual = umaLinha('SELECT * FROM lancamentos WHERE id = ?', [$id]);
    if (!$atual) {
        throw new ErroDeUso('Lançamento não encontrado.', 404);
    }
    exigePrazoDoMotorista($eu, $atual, 'criado_por', 'este lançamento');
    $completo = umaLinha(SQL_LANCAMENTO . ' WHERE l.id = ?', [$id]);
    consulta('DELETE FROM lancamentos WHERE id = ?', [$id]);
    consulta('UPDATE avisos SET lancamento_id = NULL WHERE lancamento_id = ?', [$id]);
    // Se era o pagamento de diárias, elas voltam a ficar pendentes.
    consulta('UPDATE diarias SET lancamento_id = NULL WHERE lancamento_id = ?', [$id]);
    registraAviso($eu, 'excluiu', $atual['tipo'], null, resumoDoLancamento($completo));
    if (!empty($atual['comprovante']) && preg_match('/^[A-Za-z0-9._-]+$/', $atual['comprovante'])
        && !arquivoEmUso($atual['comprovante'])) {
        apagaComprovante($atual['comprovante']);
    }
    return ['ok' => true];
}

// Avisos: o que os motoristas fazem fica registrado para o proprietário acompanhar.
// Com $para, o aviso vai só para aquele motorista (ex.: viagem aberta para ele, diárias pagas).
function registraAviso(array $eu, string $acao, string $tipo, ?int $lancamentoId, string $resumo, ?int $para = null): void
{
    if ($para === null ? $eu['papel'] === 'admin' : $para === $eu['id']) {
        return;
    }
    insere('avisos', [
        'usuario_id' => $eu['id'],
        'acao' => $acao,
        'tipo' => $tipo,
        'lancamento_id' => $lancamentoId,
        'resumo' => mb_substr($resumo, 0, 200),
        'para_usuario_id' => $para,
        'criado_em' => agora(),
    ]);
    $destinos = $para !== null ? [$para] : array_column(
        todas("SELECT id FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?", [$eu['id']]),
        'id'
    );
    agendaPush($destinos, $eu['nome'] . ' ' . (ACOES_AVISO[$acao][$tipo] ?? $acao) . ': ' . $resumo);
}

// Mesmo texto da tela (ACOES_AVISO em assets/app.js), usado nas notificações push.
const ACOES_AVISO = [
    'criou' => ['saida' => 'registrou um gasto', 'entrada' => 'registrou uma entrada'],
    'editou' => ['saida' => 'editou um gasto', 'entrada' => 'editou uma entrada', 'nota' => 'editou uma nota fiscal'],
    'excluiu' => [
        'saida' => 'excluiu um gasto', 'entrada' => 'excluiu uma entrada',
        'nota' => 'excluiu uma nota fiscal', 'diaria' => 'excluiu uma diária',
    ],
    'abriu' => ['viagem' => 'abriu uma viagem'],
    'enviou' => ['nota' => 'enviou uma nota fiscal'],
    'registrou' => ['diaria' => 'registrou dias trabalhados'],
    'pagou' => ['diaria' => 'pagou suas diárias'],
];

function filtroAvisos(array $eu): array
{
    return $eu['papel'] === 'admin'
        ? ['a.para_usuario_id IS NULL', []]
        : ['a.para_usuario_id = ?', [$eu['id']]];
}

function resumoDoLancamento(array $l): string
{
    return $l['categoria'] . ($l['descricao'] ? ' - ' . $l['descricao'] : '')
        . ' · ' . pdfReais((int) $l['valor_centavos']) . ' · ' . pdfData($l['data']);
}

function ultimoAvisoVisto(int $usuarioId): int
{
    $visto = umValor('SELECT ultimo_id FROM avisos_vistos WHERE usuario_id = ?', [$usuarioId]);
    if ($visto === null) {
        // Primeiro acesso: começa do zero, sem acusar o histórico antigo como novidade.
        $visto = (int) umValor('SELECT COALESCE(MAX(id), 0) FROM avisos');
        // Sem insere(): esta tabela não tem coluna id, e no PostgreSQL insere() pede "RETURNING id".
        consulta('INSERT INTO avisos_vistos (usuario_id, ultimo_id) VALUES (?, ?)', [$usuarioId, $visto]);
    }
    return (int) $visto;
}

function rotaAvisos(): array
{
    $eu = exigeLogin();
    $visto = ultimoAvisoVisto($eu['id']);
    [$cond, $args] = filtroAvisos($eu);
    $itens = todas(
        "SELECT a.id, a.acao, a.tipo, a.lancamento_id, a.resumo, a.criado_em, u.nome AS motorista
           FROM avisos a JOIN usuarios u ON u.id = a.usuario_id
          WHERE $cond
          ORDER BY a.id DESC LIMIT 40",
        $args
    );
    foreach ($itens as &$a) {
        $a['novo'] = (int) $a['id'] > $visto;
        $a['segundos'] = max(0, time() - strtotime((string) $a['criado_em']));
        // Motorista não abre lançamentos de outras pessoas a partir do aviso.
        if ($eu['papel'] !== 'admin') {
            $a['lancamento_id'] = null;
        }
    }
    unset($a);
    return [
        'nao_lidos' => avisosNaoLidos($eu),
        'ultimo_id' => (int) umValor("SELECT COALESCE(MAX(a.id), 0) FROM avisos a WHERE $cond", $args),
        'itens' => $itens,
    ];
}

function avisosNaoLidos(array $eu): int
{
    $visto = ultimoAvisoVisto($eu['id']);
    [$cond, $args] = filtroAvisos($eu);
    return (int) umValor("SELECT COUNT(*) FROM avisos a WHERE $cond AND a.id > ?", [...$args, $visto]);
}

function rotaAvisosLidos(): array
{
    $eu = exigeLogin();
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
            // Salário e diárias são pagos ao motorista, não gastos feitos por ele na estrada.
            "SELECT u.nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id
              WHERE l.tipo = 'saida' AND l.data BETWEEN ? AND ?
                AND l.categoria_id NOT IN (SELECT id FROM categorias WHERE oculta_motorista = 1)
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
        'a_receber' => totaisAReceber(),
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
        ['Preço médio do litro', $litros > 0 ? pdfReais((int) round($d['combustivel_centavos'] / $litros)) : '-', PDF_TINTA],
        ['A receber hoje', pdfReais($d['a_receber']['a_receber_centavos']), PDF_TINTA],
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
                $c['placa'] . ($c['apelido'] ? ' - ' . $c['apelido'] : ''),
                pdfReais((int) $c['entradas_centavos']),
                pdfReais((int) $c['saidas_centavos']),
                [pdfReais($c['saldo_centavos']), pdfCorSaldo($c['saldo_centavos'])],
                pdfReais((int) $c['combustivel_centavos']),
                $litros ? pdfNumero($litros, 2) : '-',
                $litros ? pdfReais((int) round($c['combustivel_centavos'] / $litros)) : '-',
                $km ? pdfNumero($km) : '-',
                $km && $litros ? pdfNumero($km / $litros, 2) : '-',
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
                $total ? pdfNumero($i['total_centavos'] / $total * 100, 1) . '%' : '-',
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
    $destino = pastaUploads() . '/' . $nome;
    $salvou = is_uploaded_file($temporario)
        ? move_uploaded_file($temporario, $destino)
        : rename($temporario, $destino);
    if (!$salvou) {
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

    $temporario = $arquivo['tmp_name'];
    $convertido = null;
    if ($extensao !== 'pdf') {
        $convertido = convertePraWebp($temporario, $imagem);
        if ($convertido !== null) {
            $temporario = $convertido;
            $extensao = 'webp';
        }
    }

    $nome = date('YmdHis') . '-' . bin2hex(random_bytes(5)) . '.' . $extensao;
    try {
        guardaComprovante($nome, $temporario);
    } finally {
        if ($convertido !== null && is_file($convertido)) {
            @unlink($convertido);
        }
    }
    return ['comprovante' => $nome];
}

// Reduz a foto (lado maior até 1600px), acerta a rotação do celular e regrava em WebP, o que
// também descarta os metadados (EXIF, GPS). Devolve o arquivo temporário novo, ou null se o
// servidor não tem suporte a WebP — aí a foto é guardada como chegou.
function convertePraWebp(string $caminho, array $info): ?string
{
    if (!function_exists('imagewebp')) {
        return null;
    }
    [$largura, $altura, $tipo] = $info;
    if ($largura * $altura > 40_000_000) {
        throw new ErroDeUso('A foto tem resolução grande demais. Tente uma foto menor.');
    }

    $imagem = match ($tipo) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($caminho),
        IMAGETYPE_PNG => @imagecreatefrompng($caminho),
        IMAGETYPE_WEBP => @imagecreatefromwebp($caminho),
        default => false,
    };
    if ($imagem === false) {
        throw new ErroDeUso('Não foi possível ler a foto. Tente outra.');
    }

    if ($tipo === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $graus = [3 => 180, 6 => -90, 8 => 90][(int) (@exif_read_data($caminho)['Orientation'] ?? 1)] ?? 0;
        if ($graus !== 0) {
            $girada = imagerotate($imagem, $graus, 0);
            if ($girada !== false) {
                imagedestroy($imagem);
                $imagem = $girada;
            }
        }
    }

    imagepalettetotruecolor($imagem);
    $largura = imagesx($imagem);
    $altura = imagesy($imagem);
    $escala = min(1, 1600 / max($largura, $altura));
    if ($escala < 1) {
        $menor = imagescale($imagem, (int) round($largura * $escala), (int) round($altura * $escala), IMG_BICUBIC);
        if ($menor !== false) {
            imagedestroy($imagem);
            $imagem = $menor;
        }
    }
    imagealphablending($imagem, false);
    imagesavealpha($imagem, true);

    $destino = tempnam(sys_get_temp_dir(), 'foto');
    $ok = $destino !== false && imagewebp($imagem, $destino, 80);
    imagedestroy($imagem);
    if (!$ok) {
        if ($destino !== false) {
            @unlink($destino);
        }
        throw new ErroDeUso('Não foi possível processar a foto no servidor.', 500);
    }
    return $destino;
}

// O arquivo é do motorista se está num lançamento dele, numa nota que ele enviou ou numa nota
// de viagem dele. Arquivo recém-enviado, ainda sem lançamento, fica visível (o nome é aleatório).
function motoristaVeArquivo(array $eu, string $arquivo): bool
{
    $donos = array_merge(
        todas('SELECT usuario_id AS dono, NULL AS motorista FROM lancamentos WHERE comprovante = ?', [$arquivo]),
        todas(
            'SELECT n.usuario_id AS dono, v.usuario_id AS motorista
               FROM notas_fiscais n LEFT JOIN viagens v ON v.id = n.viagem_id
              WHERE n.arquivo = ?',
            [$arquivo]
        )
    );
    if (!$donos) {
        return true;
    }
    foreach ($donos as $d) {
        if ((int) $d['dono'] === $eu['id'] || (int) $d['motorista'] === $eu['id']) {
            return true;
        }
    }
    return false;
}

function arquivoEmUso(string $arquivo): bool
{
    return (int) umValor('SELECT COUNT(*) FROM lancamentos WHERE comprovante = ?', [$arquivo])
        + (int) umValor('SELECT COUNT(*) FROM notas_fiscais WHERE arquivo = ?', [$arquivo]) > 0;
}

function rotaBaixaComprovante(): void
{
    $eu = exigeLogin();
    $arquivo = (string) ($_GET['arquivo'] ?? '');
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $arquivo) || strpos($arquivo, '..') !== false) {
        throw new ErroDeUso('Arquivo inválido.');
    }
    if ($eu['papel'] !== 'admin' && !motoristaVeArquivo($eu, $arquivo)) {
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

// ---------------------------------------------------------------------------
// Receita do negócio: todos consultam; só o proprietário lança e altera (em Lançamentos).
// ---------------------------------------------------------------------------

function rotaReceita(): array
{
    exigeLogin();
    [$deMes, $ateMes] = periodoPanorama();
    $de = limitesDoMes($deMes)[0];
    $ate = limitesDoMes($ateMes)[1];
    $meses = mesesEntre($deMes, $ateMes);
    $antAteMes = mesAnterior($deMes);
    $antDeMes = date('Y-m', strtotime("$deMes-01 -" . count($meses) . ' month'));

    $total = fn (string $inicio, string $fim) => (int) umValor(
        "SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos WHERE tipo = 'entrada' AND data BETWEEN ? AND ?",
        [$inicio, $fim]
    );

    $coluna = sqlMes('data');
    $porMes = [];
    foreach (todas(
        "SELECT $coluna AS mes, SUM(valor_centavos) AS total_centavos, COUNT(*) AS qtd
           FROM lancamentos WHERE tipo = 'entrada' AND data BETWEEN ? AND ?
          GROUP BY $coluna",
        [$de, $ate]
    ) as $m) {
        $porMes[$m['mes']] = $m;
    }

    return [
        'de' => $deMes,
        'ate' => $ateMes,
        'anterior_de' => $antDeMes,
        'anterior_ate' => $antAteMes,
        'total_centavos' => $total($de, $ate),
        'anterior_centavos' => $total(limitesDoMes($antDeMes)[0], limitesDoMes($antAteMes)[1]),
        'meses' => array_map(fn ($mes) => [
            'mes' => $mes,
            'total_centavos' => (int) ($porMes[$mes]['total_centavos'] ?? 0),
            'qtd' => (int) ($porMes[$mes]['qtd'] ?? 0),
        ], $meses),
        'por_categoria' => todas(
            "SELECT c.nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
              WHERE l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
              GROUP BY c.id, c.nome ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
        'por_caminhao' => todas(
            "SELECT COALESCE(cm.placa, 'Sem caminhão') AS nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
               FROM lancamentos l LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
              WHERE l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
              GROUP BY cm.id, cm.placa ORDER BY total_centavos DESC",
            [$de, $ate]
        ),
        'itens' => todas(
            "SELECT l.id, l.data, l.descricao, l.cliente, l.lugar, l.valor_centavos, c.nome AS categoria,
                    cm.placa, v.origem AS viagem_origem, v.destino AS viagem_destino
               FROM lancamentos l
               JOIN categorias c ON c.id = l.categoria_id
               LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
               LEFT JOIN viagens v ON v.id = l.viagem_id
              WHERE l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
              ORDER BY l.data DESC, l.id DESC LIMIT 300",
            [$de, $ate]
        ),
        'a_receber' => totaisAReceber(),
    ];
}

// ---------------------------------------------------------------------------
// Notas fiscais dos clientes (foto ou PDF).
// ---------------------------------------------------------------------------

const SQL_NOTA = '
    SELECT n.*, u.nome AS enviado_por, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino,
           (SELECT MIN(rb.id) FROM recebiveis rb WHERE rb.nota_fiscal_id = n.id) AS recebivel_id
      FROM notas_fiscais n
      JOIN usuarios u ON u.id = n.usuario_id
      LEFT JOIN caminhoes cm ON cm.id = n.caminhao_id
      LEFT JOIN viagens v ON v.id = n.viagem_id';

function rotaNotas(): array
{
    $eu = exigeLogin();
    $cond = [];
    $args = [];
    if ($eu['papel'] !== 'admin') {
        $cond[] = '(n.usuario_id = ? OR v.usuario_id = ?)';
        array_push($args, $eu['id'], $eu['id']);
    } elseif (!empty($_GET['usuario_id'])) {
        $cond[] = 'n.usuario_id = ?';
        $args[] = campoId($_GET['usuario_id'], 'Enviada por');
    }
    if (!empty($_GET['mes'])) {
        [$de, $ate] = limitesDoMes(mesValido($_GET['mes']));
        $cond[] = 'n.data BETWEEN ? AND ?';
        array_push($args, $de, $ate);
    }
    if (!empty($_GET['viagem_id'])) {
        $cond[] = 'n.viagem_id = ?';
        $args[] = campoId($_GET['viagem_id'], 'Viagem');
    }
    if (($_GET['sem_cobranca'] ?? '') === '1') {
        $cond[] = 'NOT EXISTS (SELECT 1 FROM recebiveis rb WHERE rb.nota_fiscal_id = n.id)';
    }
    $busca = campoTexto($_GET['busca'] ?? null, 'Busca', false, 60);
    if ($busca !== null) {
        $like = BANCO === 'pgsql' ? 'ILIKE' : 'LIKE';
        $cond[] = "(n.numero $like ? OR n.cliente $like ? OR n.observacao $like ?)";
        array_push($args, "%$busca%", "%$busca%", "%$busca%");
    }
    [$limite, $offset] = paginacao($_GET);
    $where = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';
    return array_map(
        fn ($n) => anotaPrazo($eu, $n, 'usuario_id'),
        todas(SQL_NOTA . " $where ORDER BY n.data DESC, n.id DESC LIMIT $limite OFFSET $offset", $args)
    );
}

function notaAlteravel(int $id): array
{
    $eu = exigeLogin();
    $n = umaLinha(SQL_NOTA . ' WHERE n.id = ?', [$id]);
    if (!$n) {
        throw new ErroDeUso('Nota fiscal não encontrada.', 404);
    }
    exigePrazoDoMotorista($eu, $n, 'usuario_id', 'esta nota');
    return $n;
}

function dadosNota(array $corpo): array
{
    $arquivo = campoTexto($corpo['arquivo'] ?? null, 'Arquivo da nota', false, 120);
    if ($arquivo === null) {
        throw new ErroDeUso('Anexe a foto ou o PDF da nota fiscal.');
    }
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $arquivo)) {
        throw new ErroDeUso('Arquivo inválido.');
    }
    $viagemId = campoId($corpo['viagem_id'] ?? null, 'Viagem');
    if ($viagemId !== null) {
        viagemAcessivel($viagemId);
    }
    return [
        'numero' => campoTexto($corpo['numero'] ?? null, 'Número da nota', false, 40),
        'cliente' => campoTexto($corpo['cliente'] ?? null, 'Cliente', false, 90),
        'data' => campoData($corpo['data'] ?? null, 'Data de emissão'),
        'valor_centavos' => campoCentavosOpcional($corpo['valor'] ?? null, 'Valor da nota'),
        'viagem_id' => $viagemId,
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'arquivo' => $arquivo,
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
    ];
}

function resumoDaNota(array $n): string
{
    return 'NF ' . ($n['numero'] ?: 'sem número') . ($n['cliente'] ? ' - ' . $n['cliente'] : '')
        . ($n['valor_centavos'] !== null ? ' · ' . pdfReais((int) $n['valor_centavos']) : '')
        . ' · ' . pdfData($n['data']);
}

function rotaNovaNota(): array
{
    $eu = exigeLogin();
    $dados = dadosNota(corpoJson());
    $dados['usuario_id'] = $eu['id'];
    $dados['criado_em'] = agora();
    $id = insere('notas_fiscais', $dados);
    registraAviso($eu, 'enviou', 'nota', null, resumoDaNota($dados));
    return anotaPrazo($eu, umaLinha(SQL_NOTA . ' WHERE n.id = ?', [$id]), 'usuario_id');
}

function rotaEditaNota(int $id): array
{
    $eu = exigeLogin();
    $atual = notaAlteravel($id);
    $dados = dadosNota(corpoJson());
    $dados['atualizado_em'] = agora();
    atualiza('notas_fiscais', $id, $dados);
    if ($dados['arquivo'] !== $atual['arquivo'] && !arquivoEmUso($atual['arquivo'])) {
        apagaComprovante($atual['arquivo']);
    }
    registraAviso($eu, 'editou', 'nota', null, resumoDaNota($dados));
    return anotaPrazo($eu, umaLinha(SQL_NOTA . ' WHERE n.id = ?', [$id]), 'usuario_id');
}

function rotaExcluiNota(int $id): array
{
    $eu = exigeLogin();
    $atual = notaAlteravel($id);
    consulta('UPDATE recebiveis SET nota_fiscal_id = NULL WHERE nota_fiscal_id = ?', [$id]);
    consulta('DELETE FROM notas_fiscais WHERE id = ?', [$id]);
    if (!arquivoEmUso($atual['arquivo'])) {
        apagaComprovante($atual['arquivo']);
    }
    registraAviso($eu, 'excluiu', 'nota', null, resumoDaNota($atual));
    return ['ok' => true];
}

// ---------------------------------------------------------------------------
// Fretes a receber: valor combinado com o cliente e as partes já recebidas.
// ---------------------------------------------------------------------------

const SQL_RECEBIDO = '(SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l WHERE l.recebivel_id = r.id)';

const SQL_RECEBIVEL = '
    SELECT r.*, c.nome AS categoria, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino,
           n.numero AS nota_numero, n.arquivo AS nota_arquivo,
           ' . SQL_RECEBIDO . ' AS recebido_centavos,
           (SELECT COUNT(*) FROM lancamentos l WHERE l.recebivel_id = r.id) AS qtd_recebimentos,
           (SELECT MAX(l.data) FROM lancamentos l WHERE l.recebivel_id = r.id) AS ultimo_recebimento
      FROM recebiveis r
      JOIN categorias c ON c.id = r.categoria_id
      LEFT JOIN caminhoes cm ON cm.id = r.caminhao_id
      LEFT JOIN viagens v ON v.id = r.viagem_id
      LEFT JOIN notas_fiscais n ON n.id = r.nota_fiscal_id';

function situacaoRecebivel(array $r): array
{
    $total = (int) $r['valor_centavos'];
    $recebido = (int) $r['recebido_centavos'];
    $r['valor_centavos'] = $total;
    $r['recebido_centavos'] = $recebido;
    $r['restante_centavos'] = max(0, $total - $recebido);
    $r['situacao'] = $recebido <= 0 ? 'pendente' : ($recebido >= $total ? 'recebido' : 'parcial');
    $r['vencido'] = $r['situacao'] !== 'recebido' && !empty($r['vencimento'])
        && substr((string) $r['vencimento'], 0, 10) < date('Y-m-d');
    return $r;
}

function totaisAReceber(): array
{
    $totais = ['a_receber_centavos' => 0, 'vencido_centavos' => 0, 'qtd_abertos' => 0];
    $linhas = todas('SELECT r.valor_centavos, r.vencimento, ' . SQL_RECEBIDO . ' AS recebido_centavos FROM recebiveis r');
    foreach ($linhas as $linha) {
        $r = situacaoRecebivel($linha);
        if ($r['situacao'] === 'recebido') {
            continue;
        }
        $totais['qtd_abertos']++;
        $totais['a_receber_centavos'] += $r['restante_centavos'];
        if ($r['vencido']) {
            $totais['vencido_centavos'] += $r['restante_centavos'];
        }
    }
    return $totais;
}

function rotaRecebiveis(): array
{
    exigeAdmin();
    $mes = mesValido($_GET['mes'] ?? '');
    [$de, $ate] = limitesDoMes($mes);
    $cond = [];
    $args = [];
    $busca = campoTexto($_GET['busca'] ?? null, 'Busca', false, 60);
    if ($busca !== null) {
        $like = BANCO === 'pgsql' ? 'ILIKE' : 'LIKE';
        $cond[] = "(r.cliente $like ? OR r.descricao $like ? OR n.numero $like ?)";
        array_push($args, "%$busca%", "%$busca%", "%$busca%");
    }
    $where = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';
    $status = $_GET['status'] ?? 'abertos';
    $itens = array_values(array_filter(
        array_map('situacaoRecebivel', todas(SQL_RECEBIVEL . " $where ORDER BY r.data DESC, r.id DESC", $args)),
        fn ($r) => $status === 'todos'
            || ($status === 'recebidos' ? $r['situacao'] === 'recebido' : $r['situacao'] !== 'recebido')
    ));
    $somaEntradas = fn (string $extra) => (int) umValor(
        "SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
          WHERE tipo = 'entrada' AND data BETWEEN ? AND ? $extra",
        [$de, $ate]
    );
    return [
        'mes' => $mes,
        'itens' => $itens,
        'recebido_mes_centavos' => $somaEntradas(''),
        'recebido_cobrancas_mes_centavos' => $somaEntradas('AND recebivel_id IS NOT NULL'),
        'faturado_mes_centavos' => (int) umValor(
            'SELECT COALESCE(SUM(valor_centavos), 0) FROM recebiveis WHERE data BETWEEN ? AND ?',
            [$de, $ate]
        ),
    ] + totaisAReceber();
}

function recebivelExistente(int $id): array
{
    $r = umaLinha(SQL_RECEBIVEL . ' WHERE r.id = ?', [$id]);
    if (!$r) {
        throw new ErroDeUso('Frete a receber não encontrado.', 404);
    }
    return situacaoRecebivel($r);
}

function rotaUmRecebivel(int $id): array
{
    $eu = exigeAdmin();
    $r = recebivelExistente($id);
    $r['recebimentos'] = array_map(
        fn ($l) => anotaPrazo($eu, $l, 'criado_por'),
        todas(SQL_LANCAMENTO . ' WHERE l.recebivel_id = ? ORDER BY l.data, l.id', [$id])
    );
    return $r;
}

function dadosRecebivel(array $corpo, ?int $id = null): array
{
    $categoriaId = campoId($corpo['categoria_id'] ?? null, 'Tipo de frete', true);
    $cat = umaLinha('SELECT * FROM categorias WHERE id = ?', [$categoriaId]);
    if (!$cat || $cat['tipo'] !== 'entrada') {
        throw new ErroDeUso('Escolha um tipo de frete (categoria de entrada).');
    }
    $viagemId = campoId($corpo['viagem_id'] ?? null, 'Viagem');
    if ($viagemId !== null && umValor('SELECT id FROM viagens WHERE id = ?', [$viagemId]) === null) {
        throw new ErroDeUso('Viagem não encontrada.');
    }
    $notaId = campoId($corpo['nota_fiscal_id'] ?? null, 'Nota fiscal');
    if ($notaId !== null) {
        if (umValor('SELECT id FROM notas_fiscais WHERE id = ?', [$notaId]) === null) {
            throw new ErroDeUso('Nota fiscal não encontrada.');
        }
        $outro = umValor('SELECT id FROM recebiveis WHERE nota_fiscal_id = ? AND id <> ?', [$notaId, $id ?? 0]);
        if ($outro !== null) {
            throw new ErroDeUso('Essa nota fiscal já está em outro frete a receber.');
        }
    }
    $data = campoData($corpo['data'] ?? null, 'Data do frete');
    $vencimento = campoData($corpo['vencimento'] ?? null, 'Vencimento', false);
    if ($vencimento !== null && $vencimento < $data) {
        throw new ErroDeUso('O vencimento não pode ser antes da data do frete.');
    }
    return [
        'cliente' => campoTexto($corpo['cliente'] ?? null, 'Cliente', true, 90),
        'descricao' => campoTexto($corpo['descricao'] ?? null, 'Descrição', (bool) (int) $cat['pede_descricao'], 140),
        'categoria_id' => $categoriaId,
        'valor_centavos' => campoCentavos($corpo['valor'] ?? null, 'Valor do frete'),
        'data' => $data,
        'vencimento' => $vencimento,
        'viagem_id' => $viagemId,
        'caminhao_id' => campoId($corpo['caminhao_id'] ?? null, 'Caminhão'),
        'nota_fiscal_id' => $notaId,
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
    ];
}

function rotaNovoRecebivel(): array
{
    $eu = exigeAdmin();
    $dados = dadosRecebivel(corpoJson());
    $dados['criado_em'] = agora();
    $dados['criado_por'] = $eu['id'];
    return recebivelExistente(insere('recebiveis', $dados));
}

function rotaEditaRecebivel(int $id): array
{
    exigeAdmin();
    $atual = recebivelExistente($id);
    $dados = dadosRecebivel(corpoJson(), $id);
    if ($dados['valor_centavos'] < $atual['recebido_centavos']) {
        throw new ErroDeUso(
            'O valor do frete não pode ficar menor que o já recebido (' . pdfReais($atual['recebido_centavos']) . ').'
        );
    }
    atualiza('recebiveis', $id, $dados);
    return recebivelExistente($id);
}

// Os recebimentos continuam como entradas; só deixam de apontar para este frete.
function rotaExcluiRecebivel(int $id): array
{
    exigeAdmin();
    recebivelExistente($id);
    consulta('UPDATE lancamentos SET recebivel_id = NULL WHERE recebivel_id = ?', [$id]);
    consulta('DELETE FROM recebiveis WHERE id = ?', [$id]);
    return ['ok' => true];
}

// Registra uma parte (ou o total) recebida: vira um lançamento de entrada ligado ao frete.
function rotaRecebeParte(int $id): array
{
    $eu = exigeAdmin();
    $r = recebivelExistente($id);
    $corpo = corpoJson();
    $valor = campoCentavos($corpo['valor'] ?? null, 'Valor recebido');
    if ($valor > $r['restante_centavos']) {
        throw new ErroDeUso(
            'O valor é maior do que falta receber (' . pdfReais($r['restante_centavos']) . '). '
            . 'Se o cliente pagou a mais, aumente antes o valor do frete.'
        );
    }
    $comprovante = campoTexto($corpo['comprovante'] ?? null, 'Comprovante', false, 120);
    if ($comprovante !== null && !preg_match('/^[A-Za-z0-9._-]+$/', $comprovante)) {
        throw new ErroDeUso('Comprovante inválido.');
    }
    insere('lancamentos', [
        'tipo' => 'entrada',
        'usuario_id' => $eu['id'],
        'viagem_id' => $r['viagem_id'],
        'caminhao_id' => $r['caminhao_id'],
        'categoria_id' => $r['categoria_id'],
        'descricao' => $r['descricao'],
        'valor_centavos' => $valor,
        'data' => campoData($corpo['data'] ?? date('Y-m-d'), 'Dia do recebimento'),
        'pagamento' => campoTexto($corpo['pagamento'] ?? null, 'Forma de pagamento', false, 30),
        'cliente' => $r['cliente'],
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'comprovante' => $comprovante,
        'recebivel_id' => $id,
        'criado_em' => agora(),
        'criado_por' => $eu['id'],
    ]);
    return recebivelExistente($id);
}

// ---------------------------------------------------------------------------
// Diárias dos motoristas: um registro por dia trabalhado.
// ---------------------------------------------------------------------------

const SQL_DIARIA = '
    SELECT d.*, u.nome AS motorista, v.origem AS viagem_origem, v.destino AS viagem_destino,
           l.data AS pago_em
      FROM diarias d
      JOIN usuarios u ON u.id = d.usuario_id
      LEFT JOIN viagens v ON v.id = d.viagem_id
      LEFT JOIN lancamentos l ON l.id = d.lancamento_id';

function anotaDiaria(array $eu, array $d): array
{
    $d = anotaPrazo($eu, $d, 'criado_por');
    $d['pago'] = $d['lancamento_id'] !== null;
    if ($d['pago']) {
        $d['pode_alterar'] = false;
        $d['segundos_para_alterar'] = $eu['papel'] === 'admin' ? null : 0;
    }
    return $d;
}

function rotaDiarias(): array
{
    $eu = exigeLogin();
    $mes = mesValido($_GET['mes'] ?? '');
    [$de, $ate] = limitesDoMes($mes);
    $cond = ['d.data BETWEEN ? AND ?'];
    $args = [$de, $ate];
    $soMotorista = $eu['papel'] !== 'admin' ? $eu['id'] : campoId($_GET['usuario_id'] ?? null, 'Motorista');
    if ($soMotorista !== null) {
        $cond[] = 'd.usuario_id = ?';
        $args[] = $soMotorista;
    }
    $itens = array_map(
        fn ($d) => anotaDiaria($eu, $d),
        todas(SQL_DIARIA . ' WHERE ' . implode(' AND ', $cond) . ' ORDER BY d.data DESC, u.nome', $args)
    );

    // Resumo por motorista: o mês escolhido e o que ainda está para pagar de qualquer mês.
    $pessoas = $soMotorista !== null
        ? todas('SELECT id, nome, valor_diaria_centavos FROM usuarios WHERE id = ?', [$soMotorista])
        : todas(
            "SELECT id, nome, valor_diaria_centavos FROM usuarios
              WHERE (papel = 'motorista' AND ativo = 1)
                 OR id IN (SELECT usuario_id FROM diarias WHERE data BETWEEN ? AND ?)
              ORDER BY nome",
            [$de, $ate]
        );
    $motoristas = [];
    foreach ($pessoas as $p) {
        $motoristas[(int) $p['id']] = [
            'usuario_id' => (int) $p['id'],
            'nome' => $p['nome'],
            'valor_diaria_centavos' => $p['valor_diaria_centavos'] !== null ? (int) $p['valor_diaria_centavos'] : null,
            'dias' => 0, 'total_centavos' => 0, 'pago_centavos' => 0, 'pendente_centavos' => 0,
            'pendente_geral_centavos' => 0, 'dias_pendentes_geral' => 0,
        ];
    }
    foreach ($itens as $d) {
        $id = (int) $d['usuario_id'];
        $motoristas[$id]['dias']++;
        $motoristas[$id]['total_centavos'] += (int) $d['valor_centavos'];
        $motoristas[$id][$d['pago'] ? 'pago_centavos' : 'pendente_centavos'] += (int) $d['valor_centavos'];
    }
    $pendentes = todas(
        'SELECT usuario_id, COUNT(*) AS dias, SUM(valor_centavos) AS total
           FROM diarias WHERE lancamento_id IS NULL GROUP BY usuario_id'
    );
    foreach ($pendentes as $p) {
        $id = (int) $p['usuario_id'];
        if (isset($motoristas[$id])) {
            $motoristas[$id]['pendente_geral_centavos'] = (int) $p['total'];
            $motoristas[$id]['dias_pendentes_geral'] = (int) $p['dias'];
        }
    }

    $totais = ['dias' => 0, 'total_centavos' => 0, 'pago_centavos' => 0, 'pendente_centavos' => 0];
    foreach ($motoristas as $m) {
        foreach (array_keys($totais) as $chave) {
            $totais[$chave] += $m[$chave];
        }
    }
    return [
        'mes' => $mes,
        'itens' => $itens,
        'motoristas' => array_values($motoristas),
        'totais' => $totais,
    ];
}

function diaPermitido(array $eu, string $data): void
{
    if ($eu['papel'] !== 'admin' && $data > date('Y-m-d')) {
        throw new ErroDeUso('Não dá para registrar diária de um dia que ainda não chegou.');
    }
}

function rotaNovasDiarias(): array
{
    $eu = exigeLogin();
    $corpo = corpoJson();
    $usuarioId = $eu['papel'] === 'admin' && !empty($corpo['usuario_id'])
        ? campoId($corpo['usuario_id'], 'Motorista')
        : $eu['id'];
    $motorista = umaLinha('SELECT id, nome, valor_diaria_centavos FROM usuarios WHERE id = ? AND ativo = 1', [$usuarioId]);
    if (!$motorista) {
        throw new ErroDeUso('Motorista não encontrado.');
    }
    $de = campoData($corpo['de'] ?? null, 'Dia trabalhado');
    $ate = campoData($corpo['ate'] ?? null, 'Até o dia', false) ?? $de;
    if ($ate < $de) {
        throw new ErroDeUso('O último dia não pode ser antes do primeiro.');
    }
    diaPermitido($eu, $ate);
    $dias = (int) (new DateTime($de))->diff(new DateTime($ate))->days + 1;
    if ($dias > 62) {
        throw new ErroDeUso('Registre no máximo 62 dias de uma vez.');
    }
    $valor = $eu['papel'] === 'admin' ? campoCentavosOpcional($corpo['valor'] ?? null, 'Valor da diária') : null;
    $valor = $valor ?? (int) $motorista['valor_diaria_centavos'];
    $viagemId = campoId($corpo['viagem_id'] ?? null, 'Viagem');
    if ($viagemId !== null) {
        viagemAcessivel($viagemId);
    }
    $observacao = campoTexto($corpo['observacao'] ?? null, 'Observação', false, 200);

    $criadas = 0;
    $dia = new DateTime($de);
    for ($i = 0; $i < $dias; $i++, $dia->modify('+1 day')) {
        $data = $dia->format('Y-m-d');
        if (umValor('SELECT id FROM diarias WHERE usuario_id = ? AND data = ?', [$usuarioId, $data]) !== null) {
            continue;
        }
        try {
            insere('diarias', [
                'usuario_id' => $usuarioId,
                'data' => $data,
                'valor_centavos' => $valor,
                'viagem_id' => $viagemId,
                'observacao' => $observacao,
                'criado_em' => agora(),
                'criado_por' => $eu['id'],
            ]);
            $criadas++;
        } catch (PDOException $e) {
            // Outro pedido gravou o mesmo dia ao mesmo tempo; conta como já registrado.
        }
    }
    if ($criadas > 0) {
        registraAviso($eu, 'registrou', 'diaria', null,
            ($criadas === 1 ? '1 diária' : "$criadas diárias") . ' · ' . pdfData($de)
            . ($ate !== $de ? ' a ' . pdfData($ate) : ''));
    }
    return ['criadas' => $criadas, 'ja_existiam' => $dias - $criadas];
}

function diariaAlteravel(int $id): array
{
    $eu = exigeLogin();
    $d = umaLinha('SELECT * FROM diarias WHERE id = ?', [$id]);
    if (!$d) {
        throw new ErroDeUso('Diária não encontrada.', 404);
    }
    exigePrazoDoMotorista($eu, $d, 'criado_por', 'esta diária');
    if ($d['lancamento_id'] !== null) {
        throw new ErroDeUso('Esta diária já foi paga. Para mudar, exclua antes o pagamento em Lançamentos.');
    }
    return $d;
}

function rotaEditaDiaria(int $id): array
{
    $eu = exigeLogin();
    $d = diariaAlteravel($id);
    $corpo = corpoJson();
    $data = campoData($corpo['data'] ?? null, 'Dia trabalhado');
    diaPermitido($eu, $data);
    $repetida = umValor('SELECT id FROM diarias WHERE usuario_id = ? AND data = ? AND id <> ?', [$d['usuario_id'], $data, $id]);
    if ($repetida !== null) {
        throw new ErroDeUso('Já existe uma diária deste motorista nesse dia.');
    }
    $viagemId = campoId($corpo['viagem_id'] ?? null, 'Viagem');
    if ($viagemId !== null) {
        viagemAcessivel($viagemId);
    }
    $dados = [
        'data' => $data,
        'viagem_id' => $viagemId,
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 200),
    ];
    if ($eu['papel'] === 'admin') {
        $dados['valor_centavos'] = campoCentavosOpcional($corpo['valor'] ?? null, 'Valor da diária')
            ?? (int) $d['valor_centavos'];
    }
    atualiza('diarias', $id, $dados);
    return ['ok' => true];
}

function rotaExcluiDiaria(int $id): array
{
    $eu = exigeLogin();
    $d = diariaAlteravel($id);
    consulta('DELETE FROM diarias WHERE id = ?', [$id]);
    registraAviso($eu, 'excluiu', 'diaria', null, 'Diária de ' . pdfData($d['data']));
    return ['ok' => true];
}

// Paga de uma vez as diárias pendentes do motorista no mês: vira uma saída em Lançamentos.
function rotaPagaDiarias(): array
{
    $eu = exigeAdmin();
    $corpo = corpoJson();
    $usuarioId = campoId($corpo['usuario_id'] ?? null, 'Motorista', true);
    if (umValor('SELECT id FROM usuarios WHERE id = ?', [$usuarioId]) === null) {
        throw new ErroDeUso('Motorista não encontrado.');
    }
    $mes = mesValido($corpo['mes'] ?? '');
    [$de, $ate] = limitesDoMes($mes);
    $categoriaId = campoId($corpo['categoria_id'] ?? null, 'Categoria do pagamento', true);
    if (umValor("SELECT id FROM categorias WHERE id = ? AND tipo = 'saida'", [$categoriaId]) === null) {
        throw new ErroDeUso('Escolha uma categoria de gasto para o pagamento.');
    }
    $pendentes = todas(
        'SELECT id, valor_centavos FROM diarias
          WHERE usuario_id = ? AND lancamento_id IS NULL AND data BETWEEN ? AND ?',
        [$usuarioId, $de, $ate]
    );
    if (!$pendentes) {
        throw new ErroDeUso('Nenhuma diária pendente deste motorista no mês.');
    }
    if (array_filter($pendentes, fn ($d) => (int) $d['valor_centavos'] <= 0)) {
        throw new ErroDeUso(
            'Há diárias sem valor. Defina o valor delas (ou a diária do motorista em Ajustes) antes de pagar.'
        );
    }
    $total = array_sum(array_map(fn ($d) => (int) $d['valor_centavos'], $pendentes));
    $qtd = count($pendentes);
    $descricao = 'Diárias de ' . mesPorExtenso($mes) . " ($qtd " . ($qtd === 1 ? 'dia' : 'dias') . ')';
    $lancamentoId = insere('lancamentos', [
        'tipo' => 'saida',
        'usuario_id' => $usuarioId,
        'categoria_id' => $categoriaId,
        'descricao' => $descricao,
        'valor_centavos' => $total,
        'data' => campoData($corpo['data'] ?? date('Y-m-d'), 'Dia do pagamento'),
        'pagamento' => campoTexto($corpo['pagamento'] ?? null, 'Forma de pagamento', false, 30),
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'criado_em' => agora(),
        'criado_por' => $eu['id'],
    ]);
    $ids = array_map(fn ($d) => (int) $d['id'], $pendentes);
    consulta(
        'UPDATE diarias SET lancamento_id = ? WHERE id IN (' . implode(', ', array_fill(0, count($ids), '?')) . ')',
        [$lancamentoId, ...$ids]
    );
    registraAviso($eu, 'pagou', 'diaria', null, "$descricao · " . pdfReais($total), $usuarioId);
    return ['lancamento_id' => $lancamentoId, 'total_centavos' => $total, 'dias' => $qtd];
}
