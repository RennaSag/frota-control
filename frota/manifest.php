<?php
require __DIR__ . '/config.php';
header('Content-Type: application/manifest+json; charset=utf-8');
echo json_encode([
    'id' => './',
    'name' => NOME_SISTEMA,
    'short_name' => NOME_SISTEMA,
    'description' => 'Fretes, gastos, viagens e diárias da frota. Funciona sem internet.',
    'lang' => 'pt-BR',
    'dir' => 'ltr',
    'start_url' => './',
    'scope' => './',
    'display' => 'standalone',
    'orientation' => 'any',
    'background_color' => '#f4f6fb',
    'theme_color' => '#4338ca',
    'categories' => ['business', 'finance', 'productivity'],
    'icons' => [
        ['src' => 'assets/logo.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
        ['src' => 'assets/logo-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
        // Com fundo, para o Android recortar no formato do celular sem cortar a marca.
        ['src' => 'assets/icone-maskable-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'maskable'],
        ['src' => 'assets/icone-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
    ],
    // Segurar o ícone do app (Android e computador) mostra estes atalhos.
    'shortcuts' => [
        ['name' => 'Registrar gasto', 'short_name' => 'Gasto', 'url' => './?acao=gasto'],
        ['name' => 'Nova viagem', 'short_name' => 'Viagem', 'url' => './?acao=viagem'],
        ['name' => 'Enviar nota fiscal', 'short_name' => 'Nota', 'url' => './?acao=nota'],
        ['name' => 'Registrar dia trabalhado', 'short_name' => 'Diária', 'url' => './?acao=diaria'],
    ],
    // Android: "Compartilhar" uma foto ou PDF de outro app direto para cá (sw.js recebe).
    'share_target' => [
        'action' => './?compartilhar=1',
        'method' => 'POST',
        'enctype' => 'multipart/form-data',
        'params' => [
            'title' => 'titulo',
            'text' => 'texto',
            'files' => [['name' => 'arquivo', 'accept' => ['image/*', 'application/pdf']]],
        ],
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
