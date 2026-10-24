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
    'background_color' => '#f4f6fb',
    'theme_color' => '#4338ca',
    'icons' => [
        ['src' => 'assets/logo.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
        ['src' => 'assets/logo-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
