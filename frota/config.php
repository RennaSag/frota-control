<?php

function conf(string $nome, string $padrao): string
{
    $valor = getenv('FROTA_' . $nome);
    return ($valor === false || $valor === '') ? $padrao : $valor;
}

define('PG_URL', (string) (getenv('DATABASE_URL') ?: conf('PG_URL', '')));

define('BANCO', conf('BANCO', PG_URL !== '' ? 'pgsql' : 'mysql'));

define('MYSQL_HOST', conf('MYSQL_HOST', '127.0.0.1'));
define('MYSQL_PORTA', conf('MYSQL_PORTA', '3306'));
define('MYSQL_BANCO', conf('MYSQL_BANCO', 'frota'));
define('MYSQL_USUARIO', conf('MYSQL_USUARIO', 'root'));
define('MYSQL_SENHA', conf('MYSQL_SENHA', ''));

define('SQLITE_ARQUIVO', conf('SQLITE_ARQUIVO', __DIR__ . '/dados/frota.sqlite'));

define('ADMIN_NOME', 'Proprietário');
define('ADMIN_USUARIO', 'admin');
define('ADMIN_SENHA', conf('ADMIN_SENHA', 'admin123'));

define('NOME_SISTEMA', 'Controle da Frota');

define('DIAS_LOGADO', 30);

// Contato que vai junto das notificações push (exigido pelo Google e pela Apple).
// Pode ser "mailto:seu@email.com" ou o endereço https do site.
define('PUSH_CONTATO', conf('PUSH_CONTATO', 'mailto:contato@controle-frota.app'));

define('MOSTRAR_ERROS', false);
