<?php
/**
 * Configuração do sistema.
 * Em um XAMPP recém-instalado não precisa mudar nada: o banco e as tabelas
 * são criados sozinhos no primeiro acesso.
 */

/** Lê uma configuração do ambiente do servidor; se não existir, usa o padrão. */
function conf(string $nome, string $padrao): string
{
    $valor = getenv('FROTA_' . $nome);
    return ($valor === false || $valor === '') ? $padrao : $valor;
}

// 'mysql' (padrão do XAMPP) ou 'sqlite' (banco em arquivo, sem precisar ligar o MySQL)
define('BANCO', conf('BANCO', 'mysql'));

// --- Dados do MySQL (painel do XAMPP: usuário "root" e senha em branco) ---
define('MYSQL_HOST', conf('MYSQL_HOST', '127.0.0.1'));
define('MYSQL_PORTA', conf('MYSQL_PORTA', '3306'));
define('MYSQL_BANCO', conf('MYSQL_BANCO', 'frota'));
define('MYSQL_USUARIO', conf('MYSQL_USUARIO', 'root'));
define('MYSQL_SENHA', conf('MYSQL_SENHA', ''));

// --- Usado apenas quando BANCO = 'sqlite' ---
define('SQLITE_ARQUIVO', conf('SQLITE_ARQUIVO', __DIR__ . '/dados/frota.sqlite'));

// --- Administrador criado automaticamente no primeiro acesso ---
define('ADMIN_NOME', 'Proprietário');
define('ADMIN_USUARIO', 'admin');
define('ADMIN_SENHA', 'admin123');

// Nome que aparece no topo do site e no ícone do celular
define('NOME_SISTEMA', 'Controle da Frota');

// Quantos dias o motorista fica logado sem precisar digitar a senha de novo
define('DIAS_LOGADO', 30);

// Deixe false no uso normal. Coloque true apenas para investigar um erro:
// os avisos do PHP passam a aparecer na resposta (e podem atrapalhar as telas).
define('MOSTRAR_ERROS', false);
