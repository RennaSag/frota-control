// Service worker: deixa o app abrir e funcionar sem internet, envia a fila de lançamentos
// quando o sinal volta e mostra as notificações push (mesmo com o app fechado).
// A versão vem do index.php (sw.js?v=...): trocou a versão, o cache da casca é refeito.
const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev';
const AMBIENTE = new URL(self.location.href).searchParams.get('ambiente') || 'padrao';
importScripts(`assets/fila.js?v=${encodeURIComponent(VERSAO)}&ambiente=${encodeURIComponent(AMBIENTE)}`);

const CACHE = `controle-frota-${AMBIENTE}-${VERSAO}`;
const CACHE_FONTES = 'frota-fontes';
const ESTATICOS = [
  './', 'assets/estilo.css', 'assets/app.js', 'assets/viagens.js', 'assets/diarias.js', 'assets/offline.js', 'assets/fila.js', 'assets/busca.js', 'assets/ajudas.js', 'assets/adm.js', 'assets/cidades.js',
  'assets/logo.png', 'assets/logo-64.png', 'assets/logo-512.png', 'assets/icone-maskable-192.png', 'assets/icone-maskable-512.png', 'assets/apple-touch-icon.png', 'manifest.php',
];
// Respostas da API que não vale guardar: arquivos grandes e PDFs gerados na hora.
const NAO_GUARDAR = ['comprovante', 'pdf', 'pdf-panorama', 'push-chave', 'eu'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => { await c.addAll(ESTATICOS); await self.skipWaiting(); }));
});

self.addEventListener('activate', (e) => {
  const manter = [CACHE, CACHE_FONTES, Fila.CACHE_DADOS];
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => !manter.includes(k) && !k.startsWith(Fila.CACHE_DADOS+'-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  const url = new URL(pedido.url);

  if (pedido.method === 'POST' && url.origin === self.location.origin && url.searchParams.has('compartilhar')) {
    e.respondWith(recebeCompartilhado(pedido));
    return;
  }
  if (pedido.method !== 'GET') return;

  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(primeiroCache(pedido, CACHE_FONTES));
    return;
  }
  if (url.pathname.endsWith('/api.php')) {
    if (!NAO_GUARDAR.includes(url.searchParams.get('r'))) e.respondWith(dadosDaRede(pedido));
    return;
  }
  if (pedido.mode === 'navigate') {
    e.respondWith(primeiroRede(pedido, () => caches.match('./', { cacheName: CACHE })));
    return;
  }
  e.respondWith(primeiroRede(pedido, () => caches.match(pedido, { ignoreSearch: true })));
});

// Casca do app: sempre tenta a versão nova e guarda; sem rede, usa a guardada.
async function primeiroRede(pedido, alternativa) {
  const controle=new AbortController();
  const limite=setTimeout(()=>controle.abort(),5000);
  try {
    const resposta = await fetch(pedido,{signal:controle.signal});
    if(resposta.status >= 500) throw new Error('Servidor indisponível');
    if (resposta.ok && resposta.type === 'basic') {
      const copia = resposta.clone();
      await caches.open(CACHE).then((c) => c.put(pedido, copia)).catch(() => {});
    }
    return resposta;
  } catch (erro) {
    const guardada = await alternativa();
    if (guardada) return guardada;
    throw erro;
  } finally {clearTimeout(limite);}
}

async function primeiroCache(pedido, nomeCache) {
  const guardada = await caches.match(pedido, { cacheName: nomeCache });
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  if (resposta.ok || resposta.type === 'opaque') {
    const copia = resposta.clone();
    caches.open(nomeCache).then((c) => c.put(pedido, copia)).catch(() => {});
  }
  return resposta;
}

// Dados da API: vêm sempre da rede; a última resposta fica guardada para quando faltar sinal.
// A resposta guardada volta com o cabeçalho X-Frota-Offline, para a tela avisar que é antiga.
// Com sinal fraco, depois de 8 s usa a guardada (se houver) em vez de deixar a tela esperando.
async function dadosDaRede(pedido) {
  const usuario=pedido.headers.get('X-App-Usuario') || 'sessao';
  const cache = await caches.open(Fila.CACHE_DADOS+'-'+usuario);
  const daRede = fetch(pedido).then(async (resposta) => {
    if(resposta.status >= 500) throw new Error('Servidor indisponível');
    if (resposta.ok) await cache.put(pedido, resposta.clone()).catch(() => {});
    return resposta;
  });
  const guardada = () => cache.match(pedido).then((r) => (r ? marcaOffline(r) : null));
  const espera = new Promise((pronto) => setTimeout(pronto, 8000)).then(guardada);
  try {
    const primeira = await Promise.race([daRede, espera]);
    if (primeira) return primeira;
    return await daRede;
  } catch {
    return (await guardada()) || new Response(
      JSON.stringify({ erro: 'Sem internet e sem dados guardados desta tela. Tente quando o sinal voltar.', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Frota-Offline': 'vazio' } }
    );
  }
}

function marcaOffline(resposta) {
  const cabecalhos = new Headers(resposta.headers);
  cabecalhos.set('X-Frota-Offline', 'cache');
  return new Response(resposta.body, { status: resposta.status, headers: cabecalhos });
}

// Foto ou PDF compartilhado de outro app (Android: Compartilhar → Controle da Frota).
// O arquivo fica guardado no aparelho e o app abre perguntando o que ele é.
async function recebeCompartilhado(pedido) {
  try {
    const dados = await pedido.formData();
    const arquivo = dados.getAll('arquivo').find((a) => a && typeof a === 'object' && a.size);
    if (arquivo) {
      const ref = await Fila.guardaArquivo(arquivo, arquivo.name);
      return Response.redirect(`./?acao=compartilhado&arquivo=${encodeURIComponent(ref)}`, 303);
    }
  } catch {
    // Sem arquivo legível: abre o app normalmente.
  }
  return Response.redirect('./', 303);
}

// Android: o navegador chama isto quando a internet volta, mesmo com o app fechado.
self.addEventListener('sync', (e) => {
  if (e.tag === 'frota-fila') e.waitUntil(enviaFila());
});

async function enviaFila() {
  // Quem está logado: o app grava isso no IndexedDB ao entrar.
  const usuarioId = await Fila.meta('usuario');
  const r = await Fila.processa(usuarioId);
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  janelas.forEach((j) => j.postMessage({ tipo: 'fila', ...r, respostas: undefined }));
  if (r.enviados && !janelas.some((j) => j.visibilityState === 'visible')) {
    await self.registration.showNotification('Controle da Frota', {
      body: r.enviados === 1
        ? 'O lançamento guardado sem internet foi enviado.'
        : `${r.enviados} lançamentos guardados sem internet foram enviados.`,
      icon: 'assets/logo.png',
      badge: 'assets/logo-64.png',
      tag: 'frota-fila',
    });
  }
  // Sem rede de novo: falha o sync para o navegador tentar mais tarde.
  if (r.semRede) throw new Error('Ainda sem internet.');
}

self.addEventListener('push', (e) => {
  let dados = {};
  try { dados = e.data ? e.data.json() : {}; } catch { dados = { corpo: e.data?.text() }; }
  const tarefas = [
    self.registration.showNotification(dados.titulo || 'Controle da Frota', {
      body: dados.corpo || 'Há novidades na frota.',
      icon: 'assets/logo.png',
      badge: 'assets/logo-64.png',
      tag: dados.tag || 'frota-avisos',
      renotify: true,
      data: { url: dados.url || './?acao=avisos' },
    }),
  ];
  if (typeof dados.nao_lidos === 'number' && self.navigator.setAppBadge) {
    tarefas.push(self.navigator.setAppBadge(dados.nao_lidos).catch(() => {}));
  }
  self.clients.matchAll({ type: 'window' }).then((janelas) => {
    janelas.forEach((j) => j.postMessage({ tipo: 'push' }));
  });
  e.waitUntil(Promise.all(tarefas));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let destino=new URL(e.notification.data?.url || './',self.location.href);
  if(destino.origin!==self.location.origin || !destino.href.startsWith(self.registration.scope)) destino=new URL('./',self.location.href);
  destino=destino.href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      if (!janelas.length) return self.clients.openWindow(destino);
      const janela = janelas[0];
      if (destino.includes('acao=avisos')) janela.postMessage({ tipo: 'abrir-avisos' });
      return janela.focus();
    })
  );
});
