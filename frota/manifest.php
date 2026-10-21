<?php
require __DIR__ . '/config.php';
header('Content-Type: application/manifest+json; charset=utf-8');
echo json_encode([
    'name' => NOME_SISTEMA,
    'short_name' => NOME_SISTEMA,
    'lang' => 'pt-BR',
    'start_url' => './',
    'scope' => './',
    'display' => 'standalone',
    'background_color' => '#f4f5f7',
    'theme_color' => '#16263b',
    'icons' => [[
        'src' => 'assets/icone.svg',
        'sizes' => 'any',
        'type' => 'image/svg+xml',
        'purpose' => 'any',
    ]],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
