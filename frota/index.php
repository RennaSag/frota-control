<?php
require __DIR__ . '/config.php';
$nome = htmlspecialchars(NOME_SISTEMA, ENT_QUOTES, 'UTF-8');
// Subir a versão renova o cache do app nos aparelhos (o sw.js usa este número).
$v = '3.2.0';
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?= $nome ?></title>
  <meta name="description" content="Controle financeiro, fretes, gastos, viagens e diárias de uma frota de caminhões.">
  <meta name="theme-color" content="#4338ca">
  <link rel="manifest" href="manifest.php">
  <link rel="icon" href="assets/logo-64.png?v=<?= $v ?>" type="image/png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="<?= $nome ?>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/estilo.css?v=<?= $v ?>">
</head>
<body>
  <div id="app"><p class="carregando">Carregando…</p></div>
  <script>window.NOME_SISTEMA = <?= json_encode(NOME_SISTEMA) ?>; window.VERSAO_APP = <?= json_encode($v) ?>;</script>
  <script src="assets/fila.js?v=<?= $v ?>"></script>
  <script src="assets/app.js?v=<?= $v ?>"></script>
</body>
</html>
