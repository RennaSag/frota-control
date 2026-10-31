// Fila de envios feitos sem internet (gastos, viagens, notas, diárias e as fotos deles).
// Fica no IndexedDB do aparelho e é enviada quando o sinal volta: pela página aberta
// ou, no Android, pelo service worker mesmo com o app fechado (Background Sync).
// É um script comum (sem import/export) porque o sw.js também carrega este arquivo.
(function (global) {
  const NOME_BANCO = 'frota-offline';
  const AMBIENTE=global.FROTA_AMBIENTE || new URL(global.location.href).searchParams.get('ambiente') || 'padrao';
  const LOCAL = 'local:';
  // Rotas que podem esperar na fila. Editar e excluir precisam de internet.
  const ROTAS = ['lancamentos', 'viagens', 'viagem-encerrar', 'viagem-pagamento', 'notas', 'diarias', 'clientes', 'caminhoes', 'categorias', 'diarias-pagar', 'recebiveis', 'recebivel-receber', 'meu-caminhao'];
  const API = new URL('api.php', global.location.href).href;

  let conexao = null;

  function abre() {
    if (conexao) return conexao;
    conexao = new Promise((pronto, falha) => {
      const pedido = indexedDB.open(NOME_BANCO, 1);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        db.createObjectStore('envios', { keyPath: 'id' });
        db.createObjectStore('arquivos', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'chave' });
      };
      pedido.onsuccess = () => pronto(pedido.result);
      pedido.onerror = () => { conexao = null; falha(pedido.error); };
    });
    return conexao;
  }

  async function usa(loja, modo, acao) {
    const db = await abre();
    return new Promise((pronto, falha) => {
      const t = db.transaction(loja, modo);
      const resultado = acao(t.objectStore(loja));
      t.oncomplete = () => pronto(resultado?.result);
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error);
    });
  }

  const pega = (loja, id) => usa(loja, 'readonly', (s) => s.get(id));
  const grava = (loja, valor) => usa(loja, 'readwrite', (s) => s.put(valor));
  const apaga = (loja, id) => usa(loja, 'readwrite', (s) => s.delete(id));
  const todos = (loja) => usa(loja, 'readonly', (s) => s.getAll());

  let legadoPromise;
  function ambienteLegado() {
    if(!legadoPromise) legadoPromise=(async()=>{const atual=await pega('meta','ambiente-legado');if(atual)return atual.valor;await grava('meta',{chave:'ambiente-legado',valor:AMBIENTE});return AMBIENTE;})();
    return legadoPromise;
  }
  async function meta(chave, padrao = null) {
    let linha=await pega('meta',AMBIENTE+':'+chave);
    if(!linha && await ambienteLegado()===AMBIENTE) linha=await pega('meta',chave);
    return linha ? linha.valor:padrao;
  }
  const defineMeta=(chave,valor)=>grava('meta',{chave:AMBIENTE+':'+chave,valor});

  function novoId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    const b = global.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  const ehLocal = (v) => typeof v === 'string' && v.startsWith(LOCAL);

  function refsLocais(valor, achadas = new Set()) {
    if (ehLocal(valor)) achadas.add(valor);
    else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => refsLocais(v, achadas));
    return achadas;
  }

  function troca(valor, mapa) {
    if (ehLocal(valor)) return mapa[valor] ?? valor;
    if (Array.isArray(valor)) return valor.map((v) => troca(v, mapa));
    if (valor && typeof valor === 'object') {
      return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, troca(v, mapa)]));
    }
    return valor;
  }

  // Guarda uma foto ou PDF no aparelho e devolve a referência "local:..." que vai no formulário.
  // O id pode vir de um envio que falhou no meio, para o servidor reconhecer o repetido.
  async function guardaArquivo(blob, nome, id = novoId()) {
    await grava('arquivos', { id, blob, nome: nome || blob.name || 'arquivo', criadoEm: Date.now() });
    return LOCAL + id;
  }

  async function arquivo(ref) {
    return ehLocal(ref) ? pega('arquivos', ref.slice(LOCAL.length)) : null;
  }

  async function adiciona({ id, usuarioId, metodo = 'POST', rota, params = {}, corpo = null, resumo = '', criadoEm = Date.now() }) {
    const envio = {
      id: id || novoId(), usuarioId, metodo, rota, params, corpo, resumo,
      criadoEm, ambiente:AMBIENTE, erro: null,
    };
    envio.ref = LOCAL + envio.id;
    await grava('envios', envio);
    return envio;
  }

  async function lista(usuarioId) {
    const envios = await todos('envios');
    const legado=await ambienteLegado();
    return envios
      .filter((e)=>(e.ambiente || legado)===AMBIENTE)
      .filter((e) => usuarioId == null || e.usuarioId === usuarioId)
      .sort((a, b) => a.criadoEm - b.criadoEm);
  }

  // Descarta um envio e as fotos que só ele usava.
  async function remove(id) {
    const envio = await pega('envios', id);
    if (!envio) return;
    await apaga('envios', id);
    const outros = refsLocais((await todos('envios')).map((e) => [e.params, e.corpo]));
    for (const ref of refsLocais([envio.params, envio.corpo])) {
      if (!outros.has(ref)) await apaga('arquivos', ref.slice(LOCAL.length));
    }
  }

  async function marcaErro(id, erro) {
    const envio = await pega('envios', id);
    if (envio) await grava('envios', { ...envio, erro });
  }

  async function tentaDeNovo(usuarioId) {
    for (const e of await lista(usuarioId)) {
      if (e.erro) await grava('envios', { ...e, erro: null });
    }
  }

  // Fotos escolhidas mas nunca usadas (formulário cancelado) somem depois de 3 dias.
  async function limpaArquivosSoltos() {
    const usados = refsLocais((await todos('envios')).map((e) => [e.params, e.corpo]));
    const limite = Date.now() - 3 * 86400000;
    for (const a of await todos('arquivos')) {
      if (a.criadoEm < limite && !usados.has(LOCAL + a.id)) await apaga('arquivos', a.id);
    }
  }

  function endereco(rota, params = {}) {
    const p = new URLSearchParams({ r: rota });
    for (const [chave, valor] of Object.entries(params || {})) {
      if (valor !== undefined && valor !== null && valor !== '') p.set(chave, valor);
    }
    return `${API}?${p}`;
  }

  class SemRede extends Error {}

  async function pedido(url, opcoes) {
    let resposta;
    const controle = new AbortController();
    const tempo = setTimeout(()=>controle.abort(),25000);
    try {
      resposta = await fetch(url, { credentials: 'same-origin', ...opcoes, signal:controle.signal });
    } catch {
      clearTimeout(tempo); throw new SemRede('Sem internet.');
    }
    let dados = null;
    try { dados = await resposta.json(); } catch { if(resposta.ok) throw new SemRede('Resposta incompleta.'); } finally { clearTimeout(tempo); }
    return { status: resposta.status, ok: resposta.ok, dados };
  }

  async function enviaArquivo(ref, mapa) {
    const a = await arquivo(ref);
    if (!a) return null;
    const corpo = new FormData();
    corpo.append('foto', a.blob, a.nome);
    const r = await pedido(endereco('comprovante'), {
      method: 'POST',
      headers: { 'X-App-Frota': '1', 'X-Fila-Id': ref.slice(LOCAL.length) },
      body: corpo,
    });
    if (!r.ok) return r;
    mapa[ref] = r.dados.comprovante;
    return r;
  }

  // Envia, em ordem, o que está na fila deste usuário. Duas abas (ou a aba e o service worker)
  // não enviam ao mesmo tempo graças ao Web Locks; e o servidor ignora repetidos pelo X-Fila-Id.
  async function processa(usuarioId) {
    const executa = () => processaAgora(usuarioId);
    if (global.navigator?.locks?.request) {
      return global.navigator.locks.request('frota-fila', { ifAvailable: true }, (trava) => (
        trava ? executa() : { enviados: 0, ocupado: true, respostas: {} }
      ));
    }
    return executa();
  }

  async function processaAgora(usuarioId) {
    const resultado = { enviados: 0, erros: 0, semRede: false, sessao: false, respostas: {} };
    if (usuarioId == null) return resultado;
    const mapa = await meta('mapa', {});
    for (const envio of await lista(usuarioId)) {
      if (envio.erro) { resultado.erros++; continue; }
      try {
        let falhou = null;
        for (const ref of refsLocais([envio.params, envio.corpo])) {
          if (mapa[ref] !== undefined) continue;
          const r = await enviaArquivo(ref, mapa);
          if (r === null) {
            falhou = { status: 400, dados: { erro: 'Depende de outro envio que não foi feito (veja acima).' } };
            break;
          }
          if (!r.ok) { falhou = r; break; }
          await defineMeta('mapa', mapa);
        }
        const r = falhou || await pedido(endereco(envio.rota, troca(envio.params, mapa)), {
          method: envio.metodo,
          headers: { 'X-App-Frota': '1', 'X-Fila-Id': envio.id, 'X-Registrado-Em': String(envio.criadoEm), 'Content-Type': 'application/json' },
          body: envio.corpo ? JSON.stringify(troca(envio.corpo, mapa)) : undefined,
        });
        if (r.status === 401) { resultado.sessao = true; break; }
        // 409: o mesmo envio ainda está sendo gravado; 5xx: problema passageiro. Tenta depois.
        if (r.status === 409 || r.status >= 500) break;
        if (!r.ok) {
          await marcaErro(envio.id, r.dados?.erro || 'O servidor não aceitou este envio.');
          resultado.erros++;
          continue;
        }
        if (r.dados && r.dados.id !== undefined) {
          mapa[envio.ref] = r.dados.id;
          await defineMeta('mapa', mapa);
        }
        if(r.dados?.ids_por_data) { for(const [dia,id] of Object.entries(r.dados.ids_por_data)) mapa[envio.ref+'@'+dia]=id; await defineMeta('mapa',mapa); }
        resultado.respostas[envio.id] = r.dados;
        await remove(envio.id);
        resultado.enviados++;
      } catch (erro) {
        if (erro instanceof SemRede) { resultado.semRede = true; break; }
        throw erro;
      }
    }
    return resultado;
  }

  global.Fila = {
    LOCAL, ROTAS, CACHE_DADOS: 'frota-dados-'+AMBIENTE,
    novoId, ehLocal, refsLocais, guardaArquivo, arquivo, adiciona, lista, remove, tentaDeNovo,
    processa, limpaArquivosSoltos, meta, defineMeta,
  };
})(self);
