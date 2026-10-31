<?php

function banco(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $opcoes = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        if (BANCO === 'sqlite') {
            $pasta = dirname(SQLITE_ARQUIVO);
            if (!is_dir($pasta)) {
                mkdir($pasta, 0777, true);
            }
            $pdo = new PDO('sqlite:' . SQLITE_ARQUIVO, null, null, $opcoes);
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->sqliteCreateFunction('normaliza_busca', 'normalizaBusca', 1, PDO::SQLITE_DETERMINISTIC);
        } elseif (BANCO === 'pgsql') {
            [$dsn, $usuario, $senha] = dsnPostgres(PG_URL);
            $pdo = new PDO($dsn, $usuario, $senha, $opcoes);
        } else {
            $base = 'mysql:host=' . MYSQL_HOST . ';port=' . MYSQL_PORTA . ';charset=utf8mb4';
            try {
                $servidor = new PDO($base, MYSQL_USUARIO, MYSQL_SENHA, $opcoes);
                $servidor->exec(
                    'CREATE DATABASE IF NOT EXISTS `' . MYSQL_BANCO . '`'
                    . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
                );
                $servidor = null;
            } catch (PDOException $e) {
            }
            $pdo = new PDO($base . ';dbname=' . MYSQL_BANCO, MYSQL_USUARIO, MYSQL_SENHA, $opcoes);
        }
    } catch (PDOException $e) {
        throw new ErroDeUso(mensagemDeConexao($e), 500);
    }

    criaEstrutura($pdo);
    return $pdo;
}

function dsnPostgres(string $url): array
{
    $p = parse_url($url);
    if (!$p || empty($p['host']) || empty($p['path'])) {
        throw new ErroDeUso('O endereço do PostgreSQL (DATABASE_URL) está incompleto.', 500);
    }
    parse_str($p['query'] ?? '', $extras);
    $dsn = 'pgsql:host=' . $p['host']
        . ';port=' . ($p['port'] ?? 5432)
        . ';dbname=' . ltrim(rawurldecode($p['path']), '/')
        . ';sslmode=' . ($extras['sslmode'] ?? 'prefer');
    return [$dsn, rawurldecode($p['user'] ?? ''), rawurldecode($p['pass'] ?? '')];
}

function mensagemDeConexao(PDOException $e): string
{
    if (BANCO === 'sqlite') {
        return 'Não foi possível abrir o arquivo do banco em "dados/". '
            . 'Verifique se a pasta existe e tem permissão de escrita. (' . $e->getMessage() . ')';
    }
    if (BANCO === 'pgsql') {
        return 'Não foi possível conectar no PostgreSQL. Confira a variável DATABASE_URL. ('
            . $e->getMessage() . ')';
    }
    return 'Não foi possível conectar no MySQL. Abra o Painel de Controle do XAMPP e '
        . 'clique em "Start" no MySQL. Se o seu MySQL tem senha, ajuste o arquivo '
        . 'config.php. (' . $e->getMessage() . ')';
}

function sqlMes(string $coluna): string
{
    if (BANCO === 'sqlite') {
        return "strftime('%Y-%m', $coluna)";
    }
    return BANCO === 'pgsql'
        ? "to_char($coluna, 'YYYY-MM')"
        : "DATE_FORMAT($coluna, '%Y-%m')";
}

function consulta(string $sql, array $args = []): PDOStatement
{
    $st = banco()->prepare($sql);
    $st->execute($args);
    return $st;
}

function todas(string $sql, array $args = []): array
{
    return consulta($sql, $args)->fetchAll();
}

function umaLinha(string $sql, array $args = []): ?array
{
    $linha = consulta($sql, $args)->fetch();
    return $linha === false ? null : $linha;
}

function umValor(string $sql, array $args = [])
{
    $valor = consulta($sql, $args)->fetchColumn();
    return $valor === false ? null : $valor;
}

function insere(string $tabela, array $dados): int
{
    $colunas = array_keys($dados);
    $marcas = array_fill(0, count($colunas), '?');
    $sql = "INSERT INTO $tabela (" . implode(', ', $colunas) . ')'
        . ' VALUES (' . implode(', ', $marcas) . ')';
    if (BANCO === 'pgsql') {
        return (int) consulta($sql . ' RETURNING id', array_values($dados))->fetchColumn();
    }
    consulta($sql, array_values($dados));
    return (int) banco()->lastInsertId();
}

function atualiza(string $tabela, int $id, array $dados): int
{
    $partes = [];
    foreach (array_keys($dados) as $coluna) {
        $partes[] = "$coluna = ?";
    }
    $sql = "UPDATE $tabela SET " . implode(', ', $partes) . ' WHERE id = ?';
    $args = array_values($dados);
    $args[] = $id;
    return consulta($sql, $args)->rowCount();
}

// Sobe sempre que a estrutura muda; bancos antigos ganham as tabelas e colunas novas
// na primeira visita depois da atualização, sem perder nada.
const VERSAO_ESQUEMA = 5;

function criaEstrutura(PDO $pdo): void
{
    try {
        $versao = (int) $pdo->query('SELECT MAX(versao) FROM esquema')->fetchColumn();
    } catch (PDOException $e) {
        $versao = 0;
    }
    if ($versao >= VERSAO_ESQUEMA) {
        return;
    }
    $sql = estruturaSql(BANCO);
    foreach ($sql['tabelas'] as $comando) {
        $pdo->exec($comando);
    }
    $novasColunas = migraColunas($pdo, $sql['colunas']);
    foreach ($sql['indices'] as $comando) {
        try {
            $pdo->exec($comando);
        } catch (PDOException $e) {
        }
    }
    semeia($pdo, $novasColunas);
    if ($versao < 4) {
        // Importa os nomes já utilizados sem alterar o histórico financeiro.
        $nomes = $pdo->query("SELECT cliente FROM recebiveis WHERE cliente IS NOT NULL UNION SELECT cliente FROM notas_fiscais WHERE cliente IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($nomes as $nome) {
            $nome = trim((string) $nome);
            if ($nome === '' || $nome === 'Cliente não informado') continue;
            $existe = $pdo->prepare('SELECT id FROM clientes WHERE LOWER(nome) = LOWER(?)');
            $existe->execute([$nome]);
            if (!$existe->fetchColumn()) {
                $pdo->prepare('INSERT INTO clientes (nome, ativo, criado_em) VALUES (?, 1, ?)')->execute([$nome, date('Y-m-d H:i:s')]);
            }
        }
        $vinculos = $pdo->query("SELECT viagem_id, MIN(cliente) AS cliente FROM (
            SELECT viagem_id, cliente FROM recebiveis WHERE viagem_id IS NOT NULL AND cliente IS NOT NULL
            UNION SELECT viagem_id, cliente FROM notas_fiscais WHERE viagem_id IS NOT NULL AND cliente IS NOT NULL
        ) historico GROUP BY viagem_id HAVING COUNT(DISTINCT LOWER(cliente)) = 1")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($vinculos as $vinculo) {
            $pdo->prepare('UPDATE viagens SET cliente_id = (SELECT MIN(id) FROM clientes WHERE LOWER(nome) = LOWER(?)) WHERE id = ? AND cliente_id IS NULL')
                ->execute([trim($vinculo['cliente']), $vinculo['viagem_id']]);
        }
    }
    $pdo->exec('DELETE FROM esquema');
    $pdo->exec('INSERT INTO esquema (versao) VALUES (' . VERSAO_ESQUEMA . ')');
}

// Acrescenta nas tabelas que já existiam as colunas criadas depois. Devolve as que foram criadas agora.
function migraColunas(PDO $pdo, array $colunas): array
{
    $criadas = [];
    foreach ($colunas as [$tabela, $coluna, $definicao]) {
        try {
            $pdo->query("SELECT $coluna FROM $tabela WHERE 1 = 0");
            continue;
        } catch (PDOException $e) {
        }
        try {
            $pdo->exec("ALTER TABLE $tabela ADD COLUMN $coluna $definicao");
            $criadas[] = "$tabela.$coluna";
        } catch (PDOException $e) {
        }
    }
    return $criadas;
}

function estruturaSql(string $banco): array
{
    $tipos = [
        'mysql' => [
            'id' => 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY', 'ref' => 'INT UNSIGNED',
            'simNao' => 'TINYINT(1)', 'decimal' => 'DECIMAL(12,3)', 'dataHora' => 'DATETIME',
            'data' => 'DATE', 'dinheiro' => 'BIGINT',
            'fim' => ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        ],
        'sqlite' => [
            'id' => 'INTEGER PRIMARY KEY AUTOINCREMENT', 'ref' => 'INTEGER',
            'simNao' => 'INTEGER', 'decimal' => 'REAL', 'dataHora' => 'TEXT',
            'data' => 'TEXT', 'dinheiro' => 'INTEGER', 'fim' => '',
        ],
        'pgsql' => [
            'id' => 'SERIAL PRIMARY KEY', 'ref' => 'INTEGER',
            'simNao' => 'SMALLINT', 'decimal' => 'NUMERIC(12,3)', 'dataHora' => 'TIMESTAMP',
            'data' => 'DATE', 'dinheiro' => 'BIGINT', 'fim' => '',
        ],
    ][$banco];
    ['id' => $id, 'ref' => $ref, 'simNao' => $simNao, 'decimal' => $decimal,
     'dataHora' => $dataHora, 'data' => $data, 'dinheiro' => $dinheiro, 'fim' => $fim] = $tipos;

    $tabelas = [];

    $tabelas['usuarios'] = "
        id          $id,
        nome        VARCHAR(80)  NOT NULL,
        usuario     VARCHAR(40)  NOT NULL,
        senha_hash  VARCHAR(255) NOT NULL,
        papel       VARCHAR(12)  NOT NULL,
        telefone    VARCHAR(30)      NULL,
        caminhao_padrao_id    $ref      NULL,
        valor_diaria_centavos $dinheiro NULL,
        ativo       $simNao      NOT NULL,
        criado_em   $dataHora    NOT NULL,
        UNIQUE (usuario)";

    $tabelas['caminhoes'] = "
        id        $id,
        placa     VARCHAR(10) NOT NULL,
        apelido   VARCHAR(60)     NULL,
        ativo     $simNao     NOT NULL,
        criado_em $dataHora   NOT NULL,
        UNIQUE (placa)";

    $tabelas['categorias'] = "
        id             $id,
        nome           VARCHAR(40) NOT NULL,
        tipo           VARCHAR(10) NOT NULL,
        icone          VARCHAR(20) NOT NULL,
        pede_litros    $simNao     NOT NULL,
        pede_descricao $simNao     NOT NULL,
        oculta_motorista $simNao   NOT NULL DEFAULT 0,
        ordem          INT         NOT NULL,
        ativo          $simNao     NOT NULL,
        UNIQUE (nome, tipo)";

    $tabelas['clientes'] = "
        id $id,
        nome VARCHAR(90) NOT NULL UNIQUE,
        telefone VARCHAR(30) NULL,
        documento VARCHAR(30) NULL,
        email VARCHAR(120) NULL,
        observacao VARCHAR(500) NULL,
        ativo $simNao NOT NULL DEFAULT 1,
        criado_em $dataHora NOT NULL,
        atualizado_em $dataHora NULL";

    $tabelas['viagens'] = "
        id          $id,
        usuario_id  $ref        NOT NULL,
        caminhao_id $ref            NULL,
        origem      VARCHAR(80) NOT NULL,
        destino     VARCHAR(80) NOT NULL,
        inicio      $data       NOT NULL,
        fim         $data           NULL,
        km_inicial  INT             NULL,
        km_final    INT             NULL,
        status      VARCHAR(10) NOT NULL,
        observacao  VARCHAR(500)    NULL,
        criado_em   $dataHora   NOT NULL,
        FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
        FOREIGN KEY (caminhao_id) REFERENCES caminhoes(id)";

    $tabelas['lancamentos'] = "
        id             $id,
        tipo           VARCHAR(10)  NOT NULL,
        usuario_id     $ref         NOT NULL,
        viagem_id      $ref             NULL,
        caminhao_id    $ref             NULL,
        categoria_id   $ref         NOT NULL,
        descricao      VARCHAR(140)     NULL,
        valor_centavos $dinheiro    NOT NULL,
        litros         $decimal         NULL,
        km             INT              NULL,
        data           $data        NOT NULL,
        pagamento      VARCHAR(30)      NULL,
        lugar          VARCHAR(90)      NULL,
        cliente        VARCHAR(90)      NULL,
        observacao     VARCHAR(500)     NULL,
        comprovante    VARCHAR(120)     NULL,
        recebivel_id   $ref             NULL,
        criado_em      $dataHora    NOT NULL,
        criado_por     $ref             NULL,
        atualizado_em  $dataHora        NULL,
        atualizado_por $ref             NULL,
        FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (caminhao_id)  REFERENCES caminhoes(id),
        FOREIGN KEY (viagem_id)    REFERENCES viagens(id)";

    // Notas fiscais dos clientes (foto ou PDF), enviadas pelo proprietário ou pelos motoristas.
    $tabelas['notas_fiscais'] = "
        id             $id,
        usuario_id     $ref         NOT NULL,
        numero         VARCHAR(40)      NULL,
        cliente        VARCHAR(90)      NULL,
        data           $data        NOT NULL,
        valor_centavos $dinheiro        NULL,
        viagem_id      $ref             NULL,
        caminhao_id    $ref             NULL,
        arquivo        VARCHAR(120) NOT NULL,
        observacao     VARCHAR(500)     NULL,
        criado_em      $dataHora    NOT NULL,
        atualizado_em  $dataHora        NULL,
        FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
        FOREIGN KEY (viagem_id)   REFERENCES viagens(id),
        FOREIGN KEY (caminhao_id) REFERENCES caminhoes(id)";

    // Fretes a receber. Cada parte recebida é um lançamento de entrada com recebivel_id;
    // o que falta receber é sempre valor_centavos menos a soma dessas entradas.
    $tabelas['recebiveis'] = "
        id             $id,
        cliente        VARCHAR(90)  NOT NULL,
        descricao      VARCHAR(140)     NULL,
        categoria_id   $ref         NOT NULL,
        valor_centavos $dinheiro    NOT NULL,
        data           $data        NOT NULL,
        vencimento     $data            NULL,
        viagem_id      $ref             NULL,
        caminhao_id    $ref             NULL,
        nota_fiscal_id $ref             NULL,
        observacao     VARCHAR(500)     NULL,
        criado_em      $dataHora    NOT NULL,
        criado_por     $ref             NULL,
        FOREIGN KEY (categoria_id)   REFERENCES categorias(id),
        FOREIGN KEY (viagem_id)      REFERENCES viagens(id),
        FOREIGN KEY (caminhao_id)    REFERENCES caminhoes(id),
        FOREIGN KEY (nota_fiscal_id) REFERENCES notas_fiscais(id)";

    // Um dia trabalhado por motorista. Quando é pago, lancamento_id aponta para a saída do pagamento.
    $tabelas['diarias'] = "
        id             $id,
        usuario_id     $ref         NOT NULL,
        data           $data        NOT NULL,
        valor_centavos $dinheiro    NOT NULL,
        viagem_id      $ref             NULL,
        observacao     VARCHAR(200)     NULL,
        lancamento_id  $ref             NULL,
        criado_em      $dataHora    NOT NULL,
        criado_por     $ref             NULL,
        UNIQUE (usuario_id, data),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (viagem_id)  REFERENCES viagens(id)";

    $tabelas['avisos'] = "
        id            $id,
        usuario_id    $ref         NOT NULL,
        acao          VARCHAR(12)  NOT NULL,
        tipo          VARCHAR(10)  NOT NULL,
        lancamento_id $ref             NULL,
        resumo        VARCHAR(200) NOT NULL,
        para_usuario_id $ref           NULL,
        criado_em     $dataHora    NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)";

    $tabelas['esquema'] = '
        versao INT NOT NULL';

    $tabelas['avisos_vistos'] = "
        usuario_id $ref NOT NULL PRIMARY KEY,
        ultimo_id  INT  NOT NULL";

    $tabelas['tentativas_login'] = "
        chave VARCHAR(120) NOT NULL PRIMARY KEY,
        n     INT          NOT NULL,
        desde $dataHora    NOT NULL";

    // Aparelhos que recebem notificações push de cada usuário.
    $tabelas['inscricoes_push'] = "
        id            $id,
        usuario_id    $ref         NOT NULL,
        endpoint_hash VARCHAR(64)  NOT NULL,
        endpoint      TEXT         NOT NULL,
        p256dh        VARCHAR(120) NOT NULL,
        auth          VARCHAR(60)  NOT NULL,
        criado_em     $dataHora    NOT NULL,
        UNIQUE (endpoint_hash)";

    // Envios da fila do aparelho já gravados, para não gravar duas vezes (src/fila.php).
    $tabelas['envios_fila'] = "
        id         VARCHAR(40) NOT NULL PRIMARY KEY,
        usuario_id $ref        NOT NULL,
        resposta   TEXT            NULL,
        criado_em  $dataHora   NOT NULL";

    $tabelas['configuracoes'] = '
        chave VARCHAR(40) NOT NULL PRIMARY KEY,
        valor TEXT        NOT NULL';

    if ($banco === 'pgsql') {
        $tabelas['sessoes'] = '
            id     VARCHAR(128) NOT NULL PRIMARY KEY,
            dados  TEXT         NOT NULL,
            expira BIGINT       NOT NULL';
        $tabelas['comprovantes'] = "
            nome      VARCHAR(120) NOT NULL PRIMARY KEY,
            dados     BYTEA        NOT NULL,
            criado_em $dataHora    NOT NULL";
    }

    $comandos = ['tabelas' => [], 'indices' => []];
    foreach ($tabelas as $nome => $corpo) {
        $comandos['tabelas'][] = "CREATE TABLE IF NOT EXISTS $nome ($corpo)$fim";
    }
    foreach ([
        'idx_lanc_data' => 'lancamentos (data)',
        'idx_lanc_tipo' => 'lancamentos (tipo, data)',
        'idx_lanc_usuario' => 'lancamentos (usuario_id)',
        'idx_lanc_viagem' => 'lancamentos (viagem_id)',
        'idx_viagem_usuario' => 'viagens (usuario_id)',
        'idx_viagem_cliente' => 'viagens (cliente_id)',
        'idx_lanc_recebivel' => 'lancamentos (recebivel_id)',
        'idx_nota_usuario' => 'notas_fiscais (usuario_id)',
        'idx_diaria_data' => 'diarias (data)',
        'idx_push_usuario' => 'inscricoes_push (usuario_id)',
    ] as $nome => $alvo) {
        $comandos['indices'][] = "CREATE INDEX $nome ON $alvo";
    }
    $comandos['colunas'] = [
        ['clientes', 'cep', 'VARCHAR(12) NULL'],
        ['clientes', 'logradouro', 'VARCHAR(140) NULL'],
        ['clientes', 'numero', 'VARCHAR(20) NULL'],
        ['clientes', 'complemento', 'VARCHAR(90) NULL'],
        ['clientes', 'bairro', 'VARCHAR(80) NULL'],
        ['clientes', 'cidade', 'VARCHAR(80) NULL'],
        ['clientes', 'uf', 'VARCHAR(2) NULL'],
        ['viagens', 'criado_por', "$ref NULL"],
        ['viagens', 'cliente_id', "$ref NULL REFERENCES clientes(id)"],
        ['viagens', 'atualizado_em', "$dataHora NULL"],
        ['viagens', 'nota_fiscal_numero', 'VARCHAR(40) NULL'],
        ['categorias', 'criado_em', "$dataHora NULL"],
        ['usuarios', 'caminhao_padrao_id', "$ref NULL"],
        ['usuarios', 'valor_diaria_centavos', "$dinheiro NULL"],
        ['categorias', 'oculta_motorista', "$simNao NOT NULL DEFAULT 0"],
        ['lancamentos', 'recebivel_id', "$ref NULL"],
        ['avisos', 'para_usuario_id', "$ref NULL"],
    ];
    return $comandos;
}

function semeia(PDO $pdo, array $novasColunas = []): void
{
    $categorias = [
        ['Abastecimento',            'saida',   'fuel',     1, 0, 10],
        ['Salário do motorista',     'saida',   'salario',  0, 0, 20],
        ['Diárias de motorista',     'saida',   'salario',  0, 0, 25],
        ['Manutenção',               'saida',   'wrench',   0, 0, 30],
        ['Pneus',                    'saida',   'tire',     0, 0, 40],
        ['Pedágio',                  'saida',   'road',     0, 0, 50],
        ['Seguro',                   'saida',   'shield',   0, 0, 60],
        ['IPVA e licenciamento',     'saida',   'doc',      0, 0, 70],
        ['Peças e acessórios',       'saida',   'parts',    0, 0, 80],
        ['Alimentação',              'saida',   'food',     0, 0, 90],
        ['Hospedagem',               'saida',   'bed',      0, 0, 100],
        ['Lavagem',                  'saida',   'wash',     0, 0, 110],
        ['Multas',                   'saida',   'alert',    0, 0, 120],
        ['Outro gasto',              'saida',   'tag',      0, 1, 999],
        ['Frete de grãos',           'entrada', 'graos',    0, 0, 10],
        ['Frete de calcário',        'entrada', 'calcario', 0, 0, 20],
        ['Outro frete',              'entrada', 'truck',    0, 1, 30],
        ['Outra entrada',            'entrada', 'plus',     0, 1, 999],
    ];

    if ((int) $pdo->query('SELECT COUNT(*) FROM categorias')->fetchColumn() === 0) {
        $nova = $pdo->prepare(
            'INSERT INTO categorias (nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo)
             VALUES (?, ?, ?, ?, ?, ?, 1)'
        );
        foreach ($categorias as $c) {
            $nova->execute($c);
        }
    } else {
        $existe = $pdo->prepare('SELECT COUNT(*) FROM categorias WHERE nome = ? AND tipo = ?');
        $existe->execute(['Diárias de motorista', 'saida']);
        if ((int) $existe->fetchColumn() === 0) {
            $pdo->prepare(
                "INSERT INTO categorias (nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo)
                 VALUES ('Diárias de motorista', 'saida', 'salario', 0, 0, 25, 1)"
            )->execute();
        }
    }

    // Pagamento do motorista não aparece na lista de gastos dele.
    if (in_array('categorias.oculta_motorista', $novasColunas, true)
        || (int) $pdo->query('SELECT COUNT(*) FROM categorias WHERE oculta_motorista = 1')->fetchColumn() === 0) {
        $pdo->exec(
            "UPDATE categorias SET oculta_motorista = 1
              WHERE tipo = 'saida' AND nome IN ('Salário do motorista', 'Diárias de motorista')"
        );
    }

    $temAdmin = $pdo->query("SELECT COUNT(*) FROM usuarios WHERE papel = 'admin'")->fetchColumn();
    if ((int) $temAdmin === 0) {
        $pdo->prepare(
            "INSERT INTO usuarios (nome, usuario, senha_hash, papel, ativo, criado_em)
             VALUES (?, ?, ?, 'admin', 1, ?)"
        )->execute([
            ADMIN_NOME,
            strtolower(ADMIN_USUARIO),
            password_hash(ADMIN_SENHA, PASSWORD_DEFAULT),
            agora(),
        ]);
    }
}
