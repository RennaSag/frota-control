<?php

// Operações compostas são atômicas: viagem, frete, entrada e nota gravam juntos.
function transacaoViagem(callable $acao): array
{
    $pdo = banco();
    if ($pdo->inTransaction()) return $acao();
    $pdo->beginTransaction();
    try {
        $resultado = $acao();
        // O recibo do envio confirma junto com o pagamento, inclusive se o processo
        // terminar antes de entregar a resposta ao aparelho.
        $envio = idDoEnvio();
        if ($envio !== null) guardaEnvio($envio, $resultado);
        $pdo->commit();
        return $resultado;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function bloqueiaViagem(int $id): array
{
    viagemAcessivel($id);
    $sufixo = BANCO === 'sqlite' ? '' : ' FOR UPDATE';
    return umaLinha('SELECT * FROM viagens WHERE id = ?' . $sufixo, [$id]);
}

function rotaClientes(): array
{
    $eu = exigeLogin();
    if ($eu['papel'] !== 'admin') {
        return todas('SELECT id, nome, ativo, criado_em FROM clientes WHERE ativo = 1 ORDER BY nome');
    }
    return todas('SELECT c.*, (SELECT COUNT(*) FROM viagens v WHERE v.cliente_id = c.id) AS qtd_viagens
        FROM clientes c ORDER BY c.ativo DESC, c.nome');
}

function salvaCliente(?int $id = null): array
{
    exigeAdmin();
    $corpo = corpoJson();
    $dados = [
        'nome' => campoTexto($corpo['nome'] ?? null, 'Nome do cliente', true, 90),
        'cep' => campoTexto($corpo['cep'] ?? null, 'CEP', false, 12),
        'logradouro' => campoTexto($corpo['logradouro'] ?? null, 'Endereço', false, 140),
        'numero' => campoTexto($corpo['numero'] ?? null, 'Número', false, 20),
        'complemento' => campoTexto($corpo['complemento'] ?? null, 'Complemento', false, 90),
        'bairro' => campoTexto($corpo['bairro'] ?? null, 'Bairro', false, 80),
        'cidade' => campoTexto($corpo['cidade'] ?? null, 'Cidade', false, 80),
        'uf' => campoTexto($corpo['uf'] ?? null, 'UF', false, 2),
        'telefone' => campoTexto($corpo['telefone'] ?? null, 'Telefone', false, 30),
        'documento' => campoTexto($corpo['documento'] ?? null, 'CPF/CNPJ', false, 30),
        'email' => campoTexto($corpo['email'] ?? null, 'E-mail', false, 120),
        'observacao' => campoTexto($corpo['observacao'] ?? null, 'Observação', false, 500),
        'ativo' => ($corpo['ativo'] ?? '1') === '0' ? 0 : 1,
    ];
    if ($dados['email'] && !filter_var($dados['email'], FILTER_VALIDATE_EMAIL)) {
        throw new ErroDeUso('Informe um e-mail válido.');
    }
    if (umValor('SELECT id FROM clientes WHERE LOWER(nome) = LOWER(?) AND id <> ?', [$dados['nome'], $id ?? 0])) {
        throw new ErroDeUso('Já existe um cliente com esse nome. Selecione o cadastro existente.');
    }
    if ($id !== null) {
        if (!umValor('SELECT id FROM clientes WHERE id = ?', [$id])) throw new ErroDeUso('Cliente não encontrado.', 404);
        $dados['atualizado_em'] = agora();
        atualiza('clientes', $id, $dados);
    } else {
        $dados['criado_em'] = instanteCadastro();
        $id = insere('clientes', $dados);
    }
    return umaLinha('SELECT * FROM clientes WHERE id = ?', [$id]);
}

function clienteDaViagem(array $corpo, ?int $atual = null): ?int
{
    $nome = campoTexto($corpo['cliente_novo'] ?? null, 'Novo cliente', false, 90);
    if ($nome !== null) {
        $existente = umaLinha('SELECT id, ativo FROM clientes WHERE LOWER(nome) = LOWER(?)', [$nome]);
        if ($existente) {
            if (!(int) $existente['ativo']) throw new ErroDeUso('Este cliente está arquivado. Reative em Clientes.');
            return (int) $existente['id'];
        }
        return insere('clientes', ['nome' => $nome, 'ativo' => 1, 'criado_em' => instanteCadastro()]);
    }
    $id = campoId($corpo['cliente_id'] ?? null, 'Cliente');
    if ($id !== null) {
        $c = umaLinha('SELECT id, ativo FROM clientes WHERE id = ?', [$id]);
        if (!$c || (!(int) $c['ativo'] && $id !== $atual)) throw new ErroDeUso('Escolha um cliente ativo.');
    }
    return $id;
}

function valorOpcionalZero($valor, string $campo): int
{
    if ($valor === null || trim((string) $valor) === '' || preg_match('/^0+([,.]0+)?$/', trim((string) $valor))) return 0;
    return campoCentavos($valor, $campo);
}

function financeiroViagem(int $id): array
{
    $v = umaLinha(SQL_VIAGEM . ' WHERE v.id = ?', [$id]);
    $v['pendente_centavos'] = max(0, (int) $v['valor_frete_centavos'] - (int) $v['recebido_centavos']);
    return $v;
}

function defineFreteViagem(int $id, array $corpo): void
{
    if (!array_key_exists('valor_viagem', $corpo)) return;
    $valor = valorOpcionalZero($corpo['valor_viagem'], 'Valor da viagem');
    $v = financeiroViagem($id);
    $fretes = todas('SELECT * FROM recebiveis WHERE viagem_id = ? ORDER BY id', [$id]);
    if (count($fretes) > 1) {
        if ($valor !== (int) $v['valor_frete_centavos']) throw new ErroDeUso('Esta viagem tem vários fretes antigos. Ajuste cada um em Cobranças anteriores.');
        return;
    }
    if ($valor < (int) $v['recebido_centavos']) throw new ErroDeUso('O valor da viagem não pode ser menor que o valor já recebido.');
    $cliente = $v['cliente'] ?: 'Cliente não informado';
    if ($fretes) {
        atualiza('recebiveis', (int) $fretes[0]['id'], ['valor_centavos' => $valor, 'cliente' => $cliente,
            'data' => $v['inicio'], 'caminhao_id' => $v['caminhao_id']]);
        consulta("UPDATE lancamentos SET recebivel_id = ? WHERE viagem_id = ? AND tipo = 'entrada' AND recebivel_id IS NULL", [$fretes[0]['id'], $id]);
    } elseif ($valor > 0) {
        $categoria = umValor("SELECT id FROM categorias WHERE tipo = 'entrada' ORDER BY CASE WHEN nome = 'Outro frete' THEN 0 ELSE 1 END, id LIMIT 1");
        if (!$categoria) throw new ErroDeUso('Cadastre uma categoria de entrada em Ajustes.');
        $rb = insere('recebiveis', ['cliente' => $cliente, 'descricao' => mb_substr($v['origem'] . ' → ' . $v['destino'], 0, 140),
            'categoria_id' => (int) $categoria, 'valor_centavos' => $valor, 'data' => $v['inicio'],
            'viagem_id' => $id, 'caminhao_id' => $v['caminhao_id'], 'criado_em' => instanteCadastro(), 'criado_por' => exigeLogin()['id']]);
        // Entradas antigas já ligadas à viagem passam a compor o mesmo saldo.
        consulta("UPDATE lancamentos SET recebivel_id = ? WHERE viagem_id = ? AND tipo = 'entrada' AND recebivel_id IS NULL", [$rb, $id]);
    }
}

function recebeNaViagem(int $id, array $corpo, string $campo = 'valor_pago'): void
{
    $v = financeiroViagem($id);
    $integral = ($corpo['integral'] ?? '') === '1';
    $valor = $integral ? $v['pendente_centavos'] : valorOpcionalZero($corpo[$campo] ?? null, 'Valor recebido');
    if ($valor === 0) return;
    if ($valor > $v['pendente_centavos']) throw new ErroDeUso('O pagamento ultrapassa o saldo pendente da viagem.');
    $data = campoData($corpo['data_pagamento'] ?? date('Y-m-d'), 'Dia do recebimento');
    $eu = exigeLogin();
    $fretes = todas('SELECT id FROM recebiveis WHERE viagem_id = ? ORDER BY id', [$id]);
    foreach ($fretes as $frete) {
        $r = recebivelExistente((int) $frete['id']);
        $parte = min($valor, $r['restante_centavos']);
        if ($parte <= 0) continue;
        insere('lancamentos', ['tipo' => 'entrada', 'usuario_id' => $v['usuario_id'], 'viagem_id' => $id,
            'caminhao_id' => $v['caminhao_id'], 'categoria_id' => $r['categoria_id'], 'descricao' => 'Pagamento de viagem',
            'valor_centavos' => $parte, 'data' => $data, 'cliente' => $r['cliente'], 'recebivel_id' => $r['id'],
            'criado_em' => instanteCadastro(), 'criado_por' => $eu['id']]);
        $valor -= $parte;
        if ($valor === 0) break;
    }
    if ($valor > 0) throw new ErroDeUso('Confira os recebimentos antigos desta viagem antes de registrar o pagamento.');
    atualiza('viagens', $id, ['atualizado_em' => agora()]);
    registraAviso($eu, 'criou', 'entrada', null, 'Pagamento da viagem ' . $v['origem'] . ' → ' . $v['destino']);
}

function notaInicialViagem(int $id, array $corpo): void
{
    if (empty($corpo['nota_arquivo'])) return;
    $v = financeiroViagem($id);
    $dados = dadosNota(['arquivo' => $corpo['nota_arquivo'], 'numero' => $corpo['nota_numero'] ?? null,
        'data' => $corpo['nota_data'] ?? $v['inicio'], 'cliente' => $v['cliente'], 'viagem_id' => $id,
        'caminhao_id' => $v['caminhao_id']]);
    $dados['usuario_id'] = exigeLogin()['id'];
    $dados['criado_em'] = instanteCadastro();
    insere('notas_fiscais', $dados);
}

function viagemComCadastro(): array
{
    exigeLogin();
    return transacaoViagem(function () {
        $corpo = corpoJson();
        $cliente = clienteDaViagem($corpo);
        $r = rotaNovaViagem();
        atualiza('viagens', $r['id'], ['cliente_id' => $cliente,
            'nota_fiscal_numero' => campoTexto($corpo['nota_numero'] ?? null, 'Número da nota fiscal', false, 40)]);
        defineFreteViagem($r['id'], $corpo);
        recebeNaViagem($r['id'], $corpo, 'valor_entrada');
        notaInicialViagem($r['id'], $corpo);
        return $r;
    });
}

function viagemComEdicao(int $id): array
{
    exigeLogin();
    return transacaoViagem(function () use ($id) {
        $v = bloqueiaViagem($id);
        $r = rotaEditaViagem($id);
        $corpo = corpoJson();
        if (array_key_exists('cliente_id', $corpo) || !empty($corpo['cliente_novo'])) {
            atualiza('viagens', $id, ['cliente_id' => clienteDaViagem($corpo, $v['cliente_id'] === null ? null : (int) $v['cliente_id'])]);
        }
        atualiza('viagens', $id, ['atualizado_em' => agora()]);
        if (array_key_exists('nota_numero', $corpo)) {
            atualiza('viagens', $id, ['nota_fiscal_numero' => campoTexto($corpo['nota_numero'], 'Número da nota fiscal', false, 40)]);
        }
        defineFreteViagem($id, $corpo);
        notaInicialViagem($id, $corpo);
        return $r;
    });
}

function viagemComEncerramento(int $id): array
{
    exigeLogin();
    return transacaoViagem(function () use ($id) {
        $v = bloqueiaViagem($id);
        if ($v['status'] === 'encerrada') return ['ok'=>true,'ja_encerrada'=>true];
        $r = rotaEncerraViagem($id);
        recebeNaViagem($id, corpoJson());
        atualiza('viagens', $id, ['atualizado_em' => agora()]);
        return $r;
    });
}

function viagemComPagamento(int $id): array
{
    exigeAdmin();
    return transacaoViagem(function () use ($id) {
        $v = bloqueiaViagem($id);
        if ($v['status'] !== 'encerrada') throw new ErroDeUso('Encerre a viagem antes de registrar a quitação.');
        recebeNaViagem($id, corpoJson());
        return financeiroViagem($id);
    });
}

function resumoFinanceiroViagens(): array
{
    exigeAdmin();
    $mes = mesValido($_GET['mes'] ?? '');
    [$de, $ate] = limitesDoMes($mes);
    $totais = ['mes' => $mes, 'pendente_mes_centavos' => 0, 'pendente_anterior_centavos' => 0, 'pendente_futuro_centavos' => 0];
    foreach (todas('SELECT r.data, r.valor_centavos, r.vencimento, ' . SQL_RECEBIDO . ' AS recebido_centavos FROM recebiveis r') as $r) {
        $r = situacaoRecebivel($r);
        $chave = $r['data'] < $de ? 'pendente_anterior_centavos' : ($r['data'] > $ate ? 'pendente_futuro_centavos' : 'pendente_mes_centavos');
        $totais[$chave] += $r['restante_centavos'];
    }
    $totais['recebido_mes_centavos'] = (int) umValor("SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
        WHERE tipo = 'entrada' AND data BETWEEN ? AND ? AND (viagem_id IS NOT NULL OR recebivel_id IS NOT NULL)", [$de, $ate]);
    $totais['cobrancas_anteriores'] = (int) umValor('SELECT COUNT(*) FROM recebiveis WHERE viagem_id IS NULL')
        + (int) umValor('SELECT COUNT(*) FROM (SELECT viagem_id FROM recebiveis WHERE viagem_id IS NOT NULL GROUP BY viagem_id HAVING COUNT(*) > 1) agrupadas');
    return $totais + totaisAReceber();
}
