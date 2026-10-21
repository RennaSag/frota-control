<?php
require __DIR__ . '/config.php';
$nome = htmlspecialchars(NOME_SISTEMA, ENT_QUOTES, 'UTF-8');
$v = '1.4.0';
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?= $nome ?></title>
  <meta name="description" content="Controle de entradas e gastos de uma frota de caminhões.">
  <meta name="theme-color" content="#ffffff">
  <link rel="manifest" href="manifest.php">
  <link rel="icon" href="assets/icone.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/icone.svg">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="<?= $nome ?>">
  <link rel="stylesheet" href="assets/estilo.css?v=<?= $v ?>">
</head>
<body>
  <div id="app"><p class="carregando">Carregando…</p></div>
  <script>window.NOME_SISTEMA = <?= json_encode(NOME_SISTEMA) ?>;</script>
  <script src="assets/app.js?v=<?= $v ?>"></script>
</body>
</html>
