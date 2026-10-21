<?php
/**
 * Conexão com o banco e criação automática das tabelas.
 * Funciona no MySQL do XAMPP e também em SQLite (arquivo), sem mudar o resto do
 * sistema: todas as consultas usam SQL comum aos dois.
 */

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
        } else {
            $base = 'mysql:host=' . MYSQL_HOST . ';port=' . MYSQL_PORTA . ';charset=utf8mb4';
            try {
                // Cria o banco no primeiro acesso (no XAMPP o "root" tem permissão para isso).
                $servidor = new PDO($base, MYSQL_USUARIO, MYSQL_SENHA, $opcoes);
                $servidor->exec(
                    'CREATE DATABASE IF NOT EXISTS `' . MYSQL_BANCO . '`'
                    . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
                );
                $servidor = null;
            } catch (PDOException $e) {
                // Sem permissão para criar: segue em frente, o banco pode já existir.
            }
            $pdo = new PDO($base . ';dbname=' . MYSQL_BANCO, MYSQL_USUARIO, MYSQL_SENHA, $opcoes);
        }
    } catch (PDOException $e) {
        throw new ErroDeUso(mensagemDeConexao($e), 500);
    }

    criaEstrutura($pdo);
    return $pdo;
}

function mensagemDeConexao(PDOException $e): string
{
    if (BANCO === 'sqlite') {
        return 'Não foi possível abrir o arquivo do banco em "dados/". '
            . 'Verifique se a pasta existe e tem permissão de escrita. (' . $e->getMessage() . ')';
    }
    return 'Não foi possível conectar no MySQL. Abra o Painel de Controle do XAMPP e '
        . 'clique em "Start" no MySQL. Se o seu MySQL tem senha, ajuste o arquivo '
        . 'config.php. (' . $e->getMessage() . ')';
}

/** Trecho de SQL que agrupa por mês (AAAA-MM) — muda de banco para banco. */
function sqlMes(string $coluna): string
{
    return BANCO === 'sqlite'
        ? "strftime('%Y-%m', $coluna)"
        : "DATE_FORMAT($coluna, '%Y-%m')";
}

// ---------------------------------------------------------------- consultas
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

// ---------------------------------------------------------------- estrutura
function criaEstrutura(PDO $pdo): void
{
    $sql = estruturaSql(BANCO !== 'sqlite');
    foreach ($sql['tabelas'] as $comando) {
        $pdo->exec($comando);
    }
    foreach ($sql['indices'] as $comando) {
        try {
            $pdo->exec($comando);
        } catch (PDOException $e) {
            // o índice já existe (MySQL antigo não aceita "IF NOT EXISTS" aqui)
        }
    }
    semeia($pdo);
}

/** Comandos de criação das tabelas, separados por banco (função pura, fácil de revisar). */
function estruturaSql(bool $mysql): array
{
    // Tipos que mudam entre os dois bancos
    $id = $mysql
        ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY'
        : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $ref = $mysql ? 'INT UNSIGNED' : 'INTEGER';
    $simNao = $mysql ? 'TINYINT(1)' : 'INTEGER';
    $decimal = $mysql ? 'DECIMAL(12,3)' : 'REAL';
    $dataHora = $mysql ? 'DATETIME' : 'TEXT';
    $data = $mysql ? 'DATE' : 'TEXT';
    $dinheiro = $mysql ? 'BIGINT' : 'INTEGER';
    $fim = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';

    $tabelas = [];

    $tabelas['usuarios'] = "
        id          $id,
        nome        VARCHAR(80)  NOT NULL,
        usuario     VARCHAR(40)  NOT NULL,
        senha_hash  VARCHAR(255) NOT NULL,
        papel       VARCHAR(12)  NOT NULL,
        telefone    VARCHAR(30)      NULL,
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
        ordem          INT         NOT NULL,
        ativo          $simNao     NOT NULL,
        UNIQUE (nome, tipo)";

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
        criado_em      $dataHora    NOT NULL,
        criado_por     $ref             NULL,
        atualizado_em  $dataHora        NULL,
        atualizado_por $ref             NULL,
        FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (caminhao_id)  REFERENCES caminhoes(id),
        FOREIGN KEY (viagem_id)    REFERENCES viagens(id)";

    $tabelas['tentativas_login'] = "
        chave VARCHAR(120) NOT NULL PRIMARY KEY,
        n     INT          NOT NULL,
        desde $dataHora    NOT NULL";

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
    ] as $nome => $alvo) {
        $comandos['indices'][] = "CREATE INDEX $nome ON $alvo";
    }
    return $comandos;
}

function semeia(PDO $pdo): void
{
    $categorias = [
        // nome,                     tipo,      ícone,      litros, descrição, ordem
        ['Abastecimento',            'saida',   'fuel',     1, 0, 10],
        ['Salário do motorista',     'saida',   'salario',  0, 0, 20],
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

    $existe = $pdo->prepare('SELECT id FROM categorias WHERE nome = ? AND tipo = ?');
    $nova = $pdo->prepare(
        'INSERT INTO categorias (nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo)
         VALUES (?, ?, ?, ?, ?, ?, 1)'
    );
    foreach ($categorias as $c) {
        $existe->execute([$c[0], $c[1]]);
        if ($existe->fetchColumn() === false) {
            $nova->execute($c);
        }
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
