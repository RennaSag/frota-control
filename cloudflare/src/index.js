import { rodaNoContexto, abreBanco, ErroDeUso } from './contexto.js';
import { criaEstrutura } from './banco.js';
import { exigePedidoDoApp } from './sessao.js';
import { idDoEnvio, reservaEnvio, guardaEnvio, liberaEnvio } from './fila.js';
import { despacha } from './rotas.js';
import { NOME_SISTEMA } from './util.js';

// Subir a versão renova o cache do app nos aparelhos (o sw.js usa este número).
const VERSAO = '3.3.0';

// Os endereços continuam os do PHP (api.php, manifest.php, index.php): o app instalado nos
// celulares e o service worker não precisam mudar nada. O resto (assets/, sw.js) sai direto
// da pasta frota/ como arquivo estático.
export default {
  async fetch(req, env, execucao) {
    const caminho = new URL(req.url).pathname;
    if (caminho === '/api.php') return api(req, env, execucao);
    if (caminho === '/manifest.php') return manifesto();
    // Também atende POST: o "Compartilhar" do Android cai aqui se o service worker ainda não estiver ativo.
    if (caminho === '/' || caminho === '/index.php' || caminho === '/index.html') return pagina();
    return env.ASSETS.fetch(req);
  },
};

const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function api(req, env, execucao) {
  const contexto = {
    req,
    env,
    q: Object.fromEntries(new URL(req.url).searchParams),
    db: null,
    cookies: [],
    depois: [],
  };
  return rodaNoContexto(contexto, async () => {
    let resposta;
    try {
      contexto.db = await abreBanco(env);
      await criaEstrutura(contexto.db);
      exigePedidoDoApp();
      const envio = idDoEnvio();
      const repetido = envio !== null ? await reservaEnvio(envio) : null;
      if (repetido) {
        resposta = json(repetido.resposta);
      } else {
        let dados;
        try {
          dados = await despacha(String(contexto.q.r ?? ''), req.method.toUpperCase());
        } catch (e) {
          if (envio !== null) await liberaEnvio(envio);
          throw e;
        }
        if (envio !== null && !(dados instanceof Response)) await guardaEnvio(envio, dados);
        resposta = dados instanceof Response ? dados : json(dados);
      }
    } catch (e) {
      if (e instanceof ErroDeUso) {
        resposta = json({ erro: e.message }, e.status >= 400 && e.status < 600 ? e.status : 400);
      } else {
        console.error('[frota]', e?.stack || e);
        resposta = json({ erro: 'Não foi possível concluir. Tente novamente.' }, 500);
      }
    }

    const cabecalhos = new Headers(resposta.headers);
    for (const [nome, valor] of Object.entries(SEGURANCA)) cabecalhos.set(nome, valor);
    for (const cookie of contexto.cookies) cabecalhos.append('Set-Cookie', cookie);

    // Os pushes saem depois que a resposta já foi entregue; só então a conexão com o banco fecha.
    execucao.waitUntil((async () => {
      for (const tarefa of contexto.depois) {
        try {
          await tarefa();
        } catch (e) {
          console.error('[frota] depois:', e?.message || e);
        }
      }
      await contexto.db?.end().catch(() => {});
    })());

    return new Response(resposta.body, { status: resposta.status, headers: cabecalhos });
  });
}

function esc(texto) {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}

function pagina() {
  const nome = esc(NOME_SISTEMA);
  const v = VERSAO;
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${nome}</title>
  <meta name="description" content="Controle financeiro, fretes, gastos, viagens e diárias de uma frota de caminhões.">
  <meta name="theme-color" content="#4338ca">
  <link rel="manifest" href="manifest.php">
  <link rel="icon" href="assets/logo-64.png?v=${v}" type="image/png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="${nome}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/estilo.css?v=${v}">
</head>
<body>
  <div id="app"><p class="carregando">Carregando…</p></div>
  <script>window.NOME_SISTEMA = ${JSON.stringify(NOME_SISTEMA)}; window.VERSAO_APP = ${JSON.stringify(v)};</script>
  <script src="assets/fila.js?v=${v}"></script>
  <script src="assets/app.js?v=${v}"></script>
</body>
</html>
`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}

function manifesto() {
  return new Response(JSON.stringify({
    id: './',
    name: NOME_SISTEMA,
    short_name: NOME_SISTEMA,
    description: 'Fretes, gastos, viagens e diárias da frota. Funciona sem internet.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f4f6fb',
    theme_color: '#4338ca',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: 'assets/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'assets/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Com fundo, para o Android recortar no formato do celular sem cortar a marca.
      { src: 'assets/icone-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'assets/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Segurar o ícone do app (Android e computador) mostra estes atalhos.
    shortcuts: [
      { name: 'Registrar gasto', short_name: 'Gasto', url: './?acao=gasto' },
      { name: 'Nova viagem', short_name: 'Viagem', url: './?acao=viagem' },
      { name: 'Enviar nota fiscal', short_name: 'Nota', url: './?acao=nota' },
      { name: 'Registrar dia trabalhado', short_name: 'Diária', url: './?acao=diaria' },
    ],
    // Android: "Compartilhar" uma foto ou PDF de outro app direto para cá (sw.js recebe).
    share_target: {
      action: './?compartilhar=1',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'titulo',
        text: 'texto',
        files: [{ name: 'arquivo', accept: ['image/*', 'application/pdf'] }],
      },
    },
  }), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } });
}
