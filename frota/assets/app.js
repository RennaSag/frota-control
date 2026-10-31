let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; });

const app = document.getElementById('app');

const estado = {
  usuario: null,
  aba: null,
  categorias: [],
  caminhoes: [],
  usuarios: [],
  viagensAbertas: [],
  recebiveisAbertos: [],
  clientes: [],
  mes: hoje().slice(0, 7),
  filtros: {
    de: `${hoje().slice(0, 7)}-01`,
    ate: hoje(),
  },
  versaoAba: 0,
  modoGrafico: 'linha', // 'linha' | 'barras' | 'pizza'
};

function hoje() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const dinheiro = (centavos) => BRL.format((Number(centavos) || 0) / 100);
const numero = (n) => NUM.format(Number(n) || 0);

function dinheiroCurto(centavos) {
  const v = (Number(centavos) || 0) / 100;
  const sinal = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1000000) return `${sinal}${NUM.format(Math.round(a / 100000) / 10)} mi`;
  if (a >= 1000) return `${sinal}${NUM.format(Math.round(a / 100) / 10)} mil`;
  return `${sinal}${NUM.format(Math.round(a))}`;
}

function dataCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function dataDiaMes(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}
function mesLongo(mes) {
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}
function mesCurto(mes) {
  const [a, m] = mes.split('-');
  return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`;
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const ICONES_SVG = {
  registrar: '<path d="M12 5v14M5 12h14"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  rota: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  panorama: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-8"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  busca: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  caminhao: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  combustivel: '<path d="M3 22h12M4 9h10M4 4h10a2 2 0 0 1 2 2v16H4V6a2 2 0 0 1 2-2zM16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-3-3"/>',
  receber: '<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8 12l4-4 4 4"/>',
  gasto: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12l4 4 4-4"/>',
  saldo: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M15 9.5a2.5 2.5 0 0 0-2.5-2.5H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4h-3a2.5 2.5 0 0 1-2.5-2.5"/>',
  setaDireita: '<path d="M9 18l6-6-6-6"/>',
  adicionar: '<path d="M12 5v14M5 12h14"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  linhaGrafico: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  pizzaGrafico: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  barrasGrafico: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  lixeira: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  olhoOculto: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  cadeado: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  gota: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  aviso: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  filtro: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  telefone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  celular: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  nota: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  receita: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  aReceber: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  maisOpcoes: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};

function icone(nome, extraClasse = '') {
  const caminho = ICONES_SVG[nome] || ICONES_SVG.lista;
  return `<svg class="ico-linha ${extraClasse}" viewBox="0 0 24 24" aria-hidden="true">${caminho}</svg>`;
}

const svg = (nome) => icone(nome);

// Safe Proxy so that accessing TRACOS[chave] or TRACOS.anything ALWAYS returns valid SVG and never undefined
const TRACOS = new Proxy(ICONES_SVG, {
  get(target, prop) {
    if (typeof prop === 'string') {
      return icone(prop);
    }
    return '';
  }
});

function iniciais(nome) {
  if (!nome) return 'CF';
  const p = String(nome).trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
}

const LOGO = '<img src="assets/logo.png" alt="" width="192" height="192">';

function endereco(rota, params = {}) {
  const p = new URLSearchParams({ r: rota });
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') p.set(chave, valor);
  }
  return `api.php?${p}`;
}

const SEM_INTERNET = 'Sem internet. Tente de novo quando o sinal voltar.';
const GUARDADO_OFFLINE = 'Sem internet: ficou guardado no aparelho e será enviado sozinho quando o sinal voltar.';

function erroSemInternet(mensagem = SEM_INTERNET) {
  const erro = new Error(mensagem);
  erro.offline = true;
  return erro;
}

function tempoLimite(ms) {
  if (AbortSignal.timeout) return AbortSignal.timeout(ms);
  const controle = new AbortController();
  setTimeout(() => controle.abort(), ms);
  return controle.signal;
}

// Gastos, viagens, notas e diárias feitos sem internet vão para a fila do aparelho (assets/fila.js)
// e a tela recebe { offline: true, id: 'local:...' }. Cada envio leva um X-Fila-Id: se a resposta
// se perder no caminho, o reenvio pela fila não grava duas vezes.
async function api(metodo, rota, params = {}, corpo = null) {
  const registradoEm = Date.now();
  if (metodo === 'GET' && (navigator.onLine === false || Fila.refsLocais(params).size)) {
    const guardados = await dadosOffline(rota,params);
    if (guardados != null) { marcaOffline(true); return guardados; }
  }
  const podeEsperar = metodo === 'POST' && Fila.ROTAS.includes(rota) && Boolean(estado.usuario);
  const filaId = podeEsperar ? Fila.novoId() : null;
  if (podeEsperar && (navigator.onLine === false || Fila.refsLocais([params, corpo]).size)) {
    return guardaNaFila(filaId, rota, params, corpo, registradoEm);
  }
  let resposta;
  try {
    resposta = await fetch(endereco(rota, params), {
      method: metodo,
      headers: {
        'X-App-Frota': '1',
        ...(estado.usuario ? {'X-App-Usuario':String(estado.usuario.id)}:{}),
        ...(filaId ? { 'X-Fila-Id': filaId, 'X-Registrado-Em': String(registradoEm) } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      credentials: 'same-origin',
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: podeEsperar ? tempoLimite(20000) : undefined,
    });
  } catch {
    if (podeEsperar) return guardaNaFila(filaId, rota, params, corpo, registradoEm);
    if(metodo === 'GET') { const copia=await dadosOffline(rota,params); if(copia != null) { marcaOffline(true);return copia; } }
    marcaOffline(true);
    throw erroSemInternet();
  }
  const offline = resposta.headers.get('X-Frota-Offline');
  if (metodo === 'GET') marcaOffline(Boolean(offline));
  if (resposta.status === 401 && estado.usuario) {
    await Fila.defineMeta('sessao-offline',null);
    estado.usuario = null;
    telaLogin('Sua sessão expirou. Entre novamente.');
    throw new Error('Sessão expirada.');
  }
  let texto;
  try { texto=await resposta.text(); } catch { if(podeEsperar) return guardaNaFila(filaId,rota,params,corpo,registradoEm); throw erroSemInternet(); }
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error('Não foi possível ler a resposta do servidor. Recarregue a página e tente novamente.');
  }
  if (offline === 'vazio') { const copia=await dadosOffline(rota,params); if(copia != null) return copia; throw erroSemInternet(dados?.erro); }
  if (podeEsperar && (resposta.status >= 500 || resposta.status === 409)) return guardaNaFila(filaId,rota,params,corpo,registradoEm);
  if (!resposta.ok) throw new Error(dados?.erro || 'Não foi possível concluir.');
  if(metodo === 'GET') { if(!offline) await memorizaDados(rota,params,dados).catch(()=>{}); return incorporaCadastros(rota,dados,params); }
  return dados;
}

// Envia foto ou PDF (nota, cupom, comprovante) e devolve o nome guardado no servidor.
// Sem internet, o arquivo fica no aparelho e o retorno é uma referência "local:..." que a fila troca
// pelo nome verdadeiro na hora de enviar.
async function enviaArquivo(arquivo) {
  const reduzido = await reduzFoto(arquivo);
  if (reduzido.size > 8 * 1024 * 1024) throw new Error('O arquivo é muito grande (máximo 8 MB).');
  const id = Fila.novoId();
  if (navigator.onLine === false) return Fila.guardaArquivo(reduzido, reduzido.name, id);
  const corpo = new FormData();
  corpo.append('foto', reduzido);
  let resposta;
  try {
    resposta = await fetch(endereco('comprovante'), {
      method: 'POST',
      headers: { 'X-App-Frota': '1', 'X-Fila-Id': id },
      credentials: 'same-origin',
      body: corpo,
      signal: tempoLimite(45000),
    });
  } catch {
    return Fila.guardaArquivo(reduzido, reduzido.name, id);
  }
  let dados = null;
  try { dados = await resposta.json(); } catch { /* resposta vazia */ }
  if (!resposta.ok) throw new Error(dados?.erro || 'Não foi possível enviar o arquivo.');
  return dados.comprovante;
}

// Liga um <input type="file"> a um campo escondido que guarda o nome do arquivo enviado.
function ligaArquivo(form, idCampo, nomeOculto, textoVazio) {
  const campo = form.querySelector(`#${idCampo}`);
  const nome = form.querySelector(`[data-nome-arquivo="${idCampo}"]`);
  const aviso = form.querySelector(`[data-aviso-arquivo="${idCampo}"]`);
  const oculto = form.elements[nomeOculto];
  if (oculto.value) {
    aviso.textContent = 'Arquivo já anexado.';
    aviso.classList.remove('oculto');
  }
  campo.addEventListener('change', async () => {
    const arquivo = campo.files?.[0];
    if (!arquivo) return;
    form.querySelector('.aviso.erro')?.remove();
    nome.textContent = arquivo.name;
    aviso.textContent = 'Enviando…';
    aviso.classList.remove('oculto');
    try {
      oculto.value = await enviaArquivo(arquivo);
      aviso.textContent = Fila.ehLocal(oculto.value)
        ? 'Sem internet: arquivo guardado no aparelho. Vai junto quando o sinal voltar.'
        : 'Arquivo anexado.';
    } catch (erro) {
      aviso.classList.add('oculto');
      campo.value = '';
      nome.textContent = textoVazio;
      mostraErro(form, erro.message);
    }
  });
}

function campoArquivo(id, rotulo, dica, oculto, valor, textoVazio = 'Nenhum arquivo escolhido') {
  return `
    <div class="campo">
      <label for="${id}">${esc(rotulo)}</label>
      <p class="dica">${esc(dica)}</p>
      <label class="arquivo" for="${id}">
        <span class="btn pequeno" aria-hidden="true">Escolher arquivo</span>
        <span data-nome-arquivo="${id}">${esc(textoVazio)}</span>
      </label>
      <input id="${id}" class="escondido" type="file" accept="image/*,application/pdf">
      <input type="hidden" name="${oculto}" value="${esc(valor || '')}">
      <p class="aviso ok oculto" data-aviso-arquivo="${id}"></p>
    </div>`;
}

// Prazo do motorista para corrigir o que registrou (o servidor é quem decide; aqui só mostra).
const MINUTOS_PARA_CORRIGIR = 2;

function textoPrazo(segundos) {
  const min = Math.max(1, Math.ceil(Number(segundos) / 60));
  return `Você pode corrigir ou excluir por mais ${min} ${min === 1 ? 'minuto' : 'minutos'}. Depois, só o proprietário.`;
}

function avisoPrazo(registro) {
  if (ehAdmin()) return '';
  if (registro.offline) return '<p class="aviso info">Guardado no aparelho · aguardando sincronização.</p>';
  if (registro.pode_alterar) {
    return `<p class="aviso info" data-prazo>${icone('relogio')} ${esc(textoPrazo(registro.segundos_para_alterar))}</p>`;
  }
  return `<p class="ajuda-tempo-expirado" data-prazo>${icone('cadeado')}&nbsp;Passou o prazo de ${MINUTOS_PARA_CORRIGIR} minutos para corrigir. Se precisar mudar algo, fale com o proprietário.</p>`;
}

// Esconde os botões de editar/excluir quando o prazo acaba com a janela aberta.
function vigiaPrazo(elemento, registro) {
  if (ehAdmin() || !registro.pode_alterar) return;
  setTimeout(() => {
    if (!elemento.isConnected) return;
    elemento.querySelectorAll('[data-editar], [data-excluir]').forEach((b) => b.remove());
    const aviso = elemento.querySelector('[data-prazo]');
    if (aviso) aviso.outerHTML = avisoPrazo({ pode_alterar: false });
  }, Number(registro.segundos_para_alterar) * 1000);
}

function seloPrazo(registro) {
  if (ehAdmin() || !registro.pode_alterar) return '';
  const min = Math.max(1, Math.ceil(Number(registro.segundos_para_alterar) / 60));
  return `<span class="selo-prazo" title="Ainda dá para corrigir">${icone('relogio')} ${min} min</span>`;
}

function recado(mensagem) {
  document.querySelector('.recado')?.remove();
  const div = document.createElement('div');
  div.className = 'recado';
  div.setAttribute('role', 'status');
  div.textContent = mensagem;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

function janela(titulo, corpoHtml) {
  const anterior = [...document.querySelectorAll('.janela')].findLast((j) => !j.hidden);
  if (anterior) { anterior.hidden = true; anterior.inert = true; }
  const focoAnterior = document.activeElement;
  const fundo = document.createElement('div');
  fundo.className = 'janela';
  fundo.innerHTML = `
    <div class="conteudo" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <button class="fechar" type="button" aria-label="Fechar">${svg('fechar')}</button>
      <h2>${esc(titulo)}</h2>
      <div class="corpo-janela">${corpoHtml}</div>
    </div>`;
  const fechar = () => {
    document.removeEventListener('keydown', escuta);
    fundo.remove(); fundo.dispatchEvent(new Event('janela-fechada'));
    if (anterior?.isConnected) { anterior.hidden = false; anterior.inert = false; anterior.dispatchEvent(new Event('retomar-janela')); }
    if (focoAnterior?.isConnected) focoAnterior.focus();
  };
  const escuta = (e) => {
    if (fundo.hidden || !fundo.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    if (e.key !== 'Tab') return;
    const campos = [...fundo.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
      .filter((el) => !el.disabled && el.getClientRects().length && el.type !== 'hidden');
    const primeiro = campos[0], ultimo = campos[campos.length - 1];
    if (!primeiro) return;
    if (e.shiftKey && (document.activeElement === primeiro || !campos.includes(document.activeElement))) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && (document.activeElement === ultimo || !campos.includes(document.activeElement))) {
      e.preventDefault(); primeiro.focus();
    }
  };
  fundo.addEventListener('fechar-janela', fechar, { once: true });
  fundo.querySelector('.fechar').onclick = fechar;
  fundo.onclick = (e) => { if (e.target === fundo) fechar(); };
  document.addEventListener('keydown', escuta);
  document.body.appendChild(fundo);
  const dialogo = fundo.querySelector('[role="dialog"]');
  dialogo.tabIndex = -1;
  dialogo.focus({ preventScroll: true });
  return { elemento: fundo.querySelector('.corpo-janela'), fechar };
}

// Campo de senha com o botão do olho para mostrar ou esconder o que foi digitado.
function campoSenha(id, nome, atributos = '') {
  return `
    <div class="caixa-senha">
      <input id="${id}" name="${nome}" type="password" ${atributos}>
      <button type="button" class="revelar-senha" data-revelar="${id}" aria-label="Mostrar senha" title="Mostrar senha">
        ${icone('olho')}
      </button>
    </div>`;
}

document.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-revelar]');
  if (!botao) return;
  const campo = document.getElementById(botao.dataset.revelar);
  const mostrar = campo.type === 'password';
  campo.type = mostrar ? 'text' : 'password';
  botao.innerHTML = icone(mostrar ? 'olhoOculto' : 'olho');
  botao.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
  botao.title = botao.getAttribute('aria-label');
  campo.focus();
});

function mostraErro(form, mensagem) {
  let caixa = form.querySelector('.aviso.erro');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'aviso erro';
    caixa.setAttribute('role', 'alert');
    form.prepend(caixa);
  }
  caixa.textContent = mensagem;
  caixa.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

function aoEnviar(form, acao) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalido=[...form.elements].find((el)=>el.willValidate && el.getClientRects().length && !el.checkValidity());
    if(invalido) { invalido.reportValidity(); return; }
    const botao = form.querySelector('button[type="submit"]');
    const rotulo = botao?.textContent;
    form.querySelector('.aviso.erro')?.remove();
    if (botao) { botao.disabled = true; botao.textContent = 'Salvando…'; }
    try {
      await acao(Object.fromEntries(new FormData(form)));
    } catch (erro) {
      mostraErro(form, erro.message);
    } finally {
      if (botao) { botao.disabled = false; botao.textContent = rotulo; }
    }
  });
}

function telaLogin(mensagem) {
  clearInterval(avisos.timer);
  avisos.timer = null;
  document.body.classList.add('tela-entrada');
  app.innerHTML = `
    <div class="tela-login">
      <form class="cartao" novalidate>
        <div class="logo">${LOGO}</div>
        <h1>${esc(window.NOME_SISTEMA || 'Controle da Frota')}</h1>
        <p class="ajuda">Entre com o usuário que a empresa te passou.</p>
        ${mensagem ? `<div class="aviso info">${esc(mensagem)}</div>` : ''}
        <div class="campo">
          <label for="usuario">Usuário</label>
          <input id="usuario" name="usuario" autocomplete="username"
                 autocapitalize="none" spellcheck="false" required>
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          ${campoSenha('senha', 'senha', 'autocomplete="current-password" required')}
        </div>
        <button class="btn principal grande botao-entrar" type="submit">Entrar</button>
        ${contatoSuporte()}
      </form>
    </div>`;
  aoEnviar(app.querySelector('form'), async (dados) => {
    if (!dados.usuario?.trim() || !dados.senha) throw new Error('Preencha usuário e senha.');
    estado.usuario = await api('POST', 'login', {}, dados);
    await memorizaDados('eu',{},estado.usuario);
    // Dados guardados de outra conta neste aparelho não podem aparecer para quem entrou.
    try { await Promise.all((await caches.keys()).filter((k)=>k.startsWith(Fila.CACHE_DADOS)).map((k)=>caches.delete(k))); } catch { /* sem Cache Storage */ }
    await iniciaApp();
  });
}

// "curto" é o nome no menu do celular, onde o espaço é pequeno.
const ABAS_MOTORISTA = [
  { id: 'meus', ico: 'lista', nome: 'Meus gastos', curto: 'Gastos' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'diarias', ico: 'calendario', nome: 'Minhas diárias', curto: 'Diárias' },
  { id: 'receita', ico: 'receita', nome: 'Receita da empresa', curto: 'Receita' },
  { id: 'perfil', ico: 'usuario', nome: 'Perfil' },
];
const ABAS_ADMIN = [
  { id: 'panorama', ico: 'panorama', nome: 'Panorama' },
  { id: 'lancamentos', ico: 'lista', nome: 'Lançamentos', curto: 'Lançam.' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'clientes', ico: 'usuario', nome: 'Clientes' },
  { id: 'diarias', ico: 'calendario', nome: 'Diárias' },
];
// No celular cabem 4 abas fixas; as outras ficam no botão "Mais".
const ABAS_NO_DOCK = 4;
const ehAdmin = () => estado.usuario?.papel === 'admin';
const abas = () => (ehAdmin() ? ABAS_ADMIN : ABAS_MOTORISTA);

async function iniciaApp() {
  document.body.classList.remove('tela-entrada');
  app.innerHTML = '<p class="carregando">Carregando…</p>';
  // O ADM tem uma tela própria, só de senhas e acessos, sem os dados da frota.
  if (ehAdm()) {
    await telaAdm();
    return;
  }
  await recarregaBasico();
  if (!abas().some((a) => a.id === estado.aba)) estado.aba = abas()[0].id;
  desenhaEstrutura();
  await abreAba(estado.aba);
  tutorialPrimeiroAcesso();
  Fila.defineMeta('usuario', estado.usuario.id).catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
  atualizaFila();
  sincroniza();
  sincronizaPush();
  executaAcaoDaUrl();
  preparaOffline().catch(()=>{});
}

function desenhaEstrutura() {
  app.innerHTML = `
    <div class="painel-layout">
      <aside class="barra-lateral">
        <div class="logo-marca">
          <div class="icone-frota">${LOGO}</div>
          <div class="info-marca">
            <strong>${esc(window.NOME_SISTEMA || 'Controle da Frota')}</strong>
            <span>${ehAdmin() ? 'Proprietário' : 'Motorista'}</span>
          </div>
        </div>
        <div class="acao-rapida">
          <button type="button" class="btn-lancar-rapido" id="b-acao-rapida">
            ${svg('registrar')} <span>${ehAdmin() ? 'Novo Lançamento' : 'Novo Gasto'}</span>
          </button>
        </div>
        <nav class="menu-navegacao" aria-label="Menu Principal">
          ${abas().map((a) => `
            <button type="button" class="menu-item" data-aba="${a.id}" aria-current="${a.id === estado.aba}">
              ${svg(a.ico)} <span>${esc(a.nome)}</span>
            </button>`).join('')}
        </nav>
        <div class="usuario-rodape">
          <button type="button" class="usuario-card botao-perfil" id="b-perfil-lateral" aria-label="Perfil e ajustes">
            <div class="avatar-circulo">${iniciais(estado.usuario.nome)}</div>
            <div class="usuario-dados">
              <strong>${esc(estado.usuario.nome)}</strong>
              <span class="perfil-acesso">${svg('ajustes')} Perfil e ajustes ${svg('setaDireita')}</span>
            </div>
          </button>
          <button type="button" class="btn-sair-lateral" id="b-sair-sidebar" title="Sair da conta">
            ${svg('sair')}
          </button>
        </div>
      </aside>

      <div class="area-principal">
        <header class="barra-superior">
          <div class="titulo-contexto">
            <div class="logo-movel">
              <div class="icone-frota icone-frota-movel">${LOGO}</div>
              <strong>${esc(window.NOME_SISTEMA || 'Controle da Frota')}</strong>
            </div>
          </div>
          <div class="acoes-topo">
            ${ehAdmin() ? `<button class="sino perfil-movel" type="button" id="b-perfil" aria-label="Perfil e ajustes" title="Perfil e ajustes">${svg('usuario')}</button>` : ''}
            <button class="sino fila-aparelho oculto" type="button" id="b-fila" aria-label="Guardado no aparelho">
              ${svg('relogio')}<span class="contador" aria-hidden="true"></span>
            </button>
            <button class="sino" type="button" id="b-avisos" aria-label="Notificações e Avisos">
              ${svg('sino')}<span class="contador oculto" aria-hidden="true"></span>
            </button>

          </div>
        </header>

        ${window.AMBIENTE_DEMO ? '<div class="faixa-demonstracao" role="status">Prévia de demonstração · alterações salvas apenas neste ambiente.</div>' : ''}
        <div class="faixa-offline" role="status">
          Sem internet. Mostrando os últimos dados salvos; o que você registrar fica guardado e é enviado quando o sinal voltar.
        </div>
        <main id="conteudo"><p class="carregando">Carregando…</p></main>
      </div>

      <nav class="dock-flutuante" aria-label="Navegação Rápida">
        ${abasDoDock().fixas.map((a) => `
          <button type="button" data-aba="${a.id}" aria-current="${a.id === estado.aba}">
            ${svg(a.ico)}<span>${esc(a.curto || a.nome)}</span>
          </button>`).join('')}
        ${abasDoDock().extras.length ? `
          <button type="button" id="b-mais-abas" aria-haspopup="dialog"
                  aria-current="${abasDoDock().extras.some((a) => a.id === estado.aba)}">
            ${svg('maisOpcoes')}<span>Mais</span>
          </button>` : ''}
      </nav>
    </div>`;

  app.querySelectorAll('[data-aba]').forEach((b) => {
    b.onclick = () => abreAba(b.dataset.aba);
  });

  const bMais = document.getElementById('b-mais-abas');
  if (bMais) {
    bMais.onclick = () => {
      const { elemento, fechar } = janela('Mais opções', `
        <div class="lista-atalhos-periodo">
          ${abasDoDock().extras.map((a) => `
            <button type="button" class="item-atalho-periodo ${a.id === estado.aba ? 'ativo' : ''}" data-ir-aba="${a.id}">
              <div style="display:flex;align-items:center;gap:10px">${svg(a.ico)}<strong>${esc(a.nome)}</strong></div>
              ${icone('setaDireita')}
            </button>`).join('')}
        </div>`);
      elemento.querySelectorAll('[data-ir-aba]').forEach((b) => {
        b.onclick = () => { fechar(); abreAba(b.dataset.irAba); };
      });
    };
  }

  document.getElementById('b-perfil')?.addEventListener('click',()=>abreAba('ajustes'));
  document.getElementById('b-perfil-lateral').onclick = () => abreAba('ajustes');
  const sino = document.getElementById('b-avisos');
  if (sino) sino.onclick = abreAvisos;
  document.getElementById('b-fila').onclick = abreFila;

  const bSair = document.getElementById('b-sair-sidebar');
  if (bSair) {
    bSair.onclick = async () => {
      if (!confirm('Tem certeza de que deseja sair da conta?')) return;
      await saiDaConta();
    };
  }

  const aoLancarRapido = () => {
    if (ehAdmin()) {
      const { fechar } = janela('O que deseja registrar?', `
        <div class="pilha">
          <p class="ajuda" style="margin:0 0 14px 0;">Escolha o tipo de operação para lançar:</p>
          <div class="acoes duas">
            <button class="btn principal grande" type="button" id="m-novo-gasto">
              ${svg('lista')} Registrar Gasto
            </button>
            <button class="btn principal grande" type="button" id="m-novo-frete" style="background:var(--verde);border-color:var(--verde);">
              ${svg('rota')} Nova viagem
            </button>
          </div>
        </div>`);
      document.getElementById('m-novo-gasto').onclick = () => {
        abreFormLancamento('saida', null, () => abreAba(estado.aba));
      };
      document.getElementById('m-novo-frete').onclick = () => {
        abreFormViagem(null, () => abreAba(estado.aba));
      };
    } else {
      abreFormLancamento('saida', null, () => abreAba(estado.aba));
    }
  };

  const bRapido = document.getElementById('b-acao-rapida');
  if (bRapido) bRapido.onclick = aoLancarRapido;
  const bTopo = document.getElementById('b-acao-topo');
  if (bTopo) bTopo.onclick = aoLancarRapido;

  iniciaAvisos();
}

function abasDoDock() {
  const todas = abas();
  if (todas.length <= ABAS_NO_DOCK + 1) return { fixas: todas, extras: [] };
  return { fixas: todas.slice(0, ABAS_NO_DOCK), extras: todas.slice(ABAS_NO_DOCK) };
}

async function abreAba(id) {
  estado.observadorGrafico?.disconnect();
  [...document.querySelectorAll('.janela')].reverse().forEach((j) => j.dispatchEvent(new Event('fechar-janela')));
  estado.aba = id;
  app.querySelectorAll('[data-aba]').forEach((b) => {
    b.setAttribute('aria-current', String(b.dataset.aba === id));
  });
  document.getElementById('b-mais-abas')?.setAttribute('aria-current',
    String(abasDoDock().extras.some((a) => a.id === id)));
  const vez = ++estado.versaoAba;
  const alvo = document.createElement('div');
  alvo.innerHTML = '<p class="carregando">Carregando…</p>';
  document.getElementById('conteudo').replaceChildren(alvo);
  window.scrollTo({ top: 0 });
  const telas = {
    novo: telaNovoGasto,
    meus: telaLancamentos,
    lancamentos: telaLancamentos,
    viagens: telaViagens,
    clientes: telaClientes,
    panorama: telaPanorama,
    receber: telaReceber,
    diarias: telaDiarias,
    notas: telaNotas,
    receita: telaReceita,
    ajustes: telaAjustes,
    perfil: telaAjustes,
  };
  try {
    await telas[id](alvo);
    ajustaPainel(alvo);
  } catch (erro) {
    if (vez !== estado.versaoAba) return;
    alvo.innerHTML = `<div class="aviso erro">${esc(erro.message)}</div>`;
  }
}

async function recarregaBasico() {
  const [categorias, caminhoes, usuarios, viagens] = await Promise.all([
    api('GET', 'categorias'),
    api('GET', 'caminhoes'),
    api('GET', 'usuarios'),
    carregaViagensAbertas(),
    ehAdmin() ? recarregaRecebiveisAbertos() : null,
  ]);
  estado.clientes = await api('GET', 'clientes');
  estado.categorias = categorias;
  estado.caminhoes = caminhoes;
  estado.usuarios = usuarios;
  estado.viagensAbertas = viagens;
}

// Viagens abertas no servidor mais as abertas sem internet que ainda estão na fila do aparelho.
async function carregaViagensAbertas() {
  return api('GET','viagens',{status:'aberta',limite:1000});
}

// Fretes em aberto, para o proprietário ligar uma entrada ao frete que está sendo pago.
async function recarregaRecebiveisAbertos() {
  try {
    estado.recebiveisAbertos = (await api('GET', 'recebiveis', { status: 'abertos' })).itens;
  } catch {
    estado.recebiveisAbertos = [];
  }
}

const avisos = { ultimoId: null, timer: null };

const ACOES_AVISO = {
  criou: { saida: 'registrou um gasto', entrada: 'registrou uma entrada' },
  editou: { saida: 'editou um gasto', entrada: 'editou uma entrada', nota: 'editou uma nota fiscal' },
  excluiu: {
    saida: 'excluiu um gasto', entrada: 'excluiu uma entrada',
    nota: 'excluiu uma nota fiscal', diaria: 'excluiu uma diária',
  },
  abriu: { viagem: 'abriu uma viagem' },
  enviou: { nota: 'enviou uma nota fiscal' },
  registrou: { diaria: 'registrou dias trabalhados' },
  pagou: { diaria: 'pagou suas diárias' },
};

function textoAviso(a) {
  return `${a.motorista} ${ACOES_AVISO[a.acao]?.[a.tipo] || a.acao}`;
}

function quandoAviso(segundos) {
  const s = Number(segundos) || 0;
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const dias = Math.floor(s / 86400);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

function mostraContador(n) {
  const contador = document.querySelector('#b-avisos .contador');
  if (!contador) return;
  contador.textContent = n > 99 ? '99+' : String(n);
  contador.classList.toggle('oculto', !n);
  document.getElementById('b-avisos').setAttribute('aria-label',
    n ? `Avisos: ${n} ${n === 1 ? 'novo' : 'novos'}` : 'Avisos');
  // Número no ícone do app instalado (Android, computador e iPhone com notificações ativas).
  if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

async function notificaAparelho(texto) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Com push ativo, o aviso já chega pelo service worker; não repete.
  try { if (await inscricaoPush()) return; } catch { /* segue com o aviso local */ }
  const titulo = window.NOME_SISTEMA || 'Controle da Frota';
  const opcoes = { body: texto, icon: 'assets/logo.png', tag: 'frota-avisos' };
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) await registro.showNotification(titulo, opcoes);
    else new Notification(titulo, opcoes);
  } catch {
    // Alguns celulares não deixam mostrar; o aviso dentro do app continua aparecendo.
  }
}

async function verificaAvisos() {
  if (!estado.usuario) return null;
  let r;
  try {
    r = await api('GET', 'avisos');
  } catch {
    return null;
  }
  mostraContador(r.nao_lidos);
  if (avisos.ultimoId !== null && r.ultimo_id > avisos.ultimoId) {
    const novos = r.itens.filter((a) => Number(a.id) > avisos.ultimoId);
    if (novos.length) {
      const texto = novos.length === 1
        ? `${textoAviso(novos[0])}: ${novos[0].resumo}`
        : `${novos.length} novas movimentações registradas na frota.`;
      recado(texto);
      notificaAparelho(texto);
    }
  }
  avisos.ultimoId = r.ultimo_id;
  return r;
}

function iniciaAvisos() {
  clearInterval(avisos.timer);
  avisos.timer = null;
  avisos.ultimoId = null;
  if (!estado.usuario) return;
  verificaAvisos();
  avisos.timer = setInterval(() => { if (!document.hidden) verificaAvisos(); }, 35000);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && avisos.timer) verificaAvisos();
});

async function abreAvisos() {
  const r = await verificaAvisos();
  if (!r) {
    recado('Não foi possível carregar as notificações.');
    return;
  }
  const podePedir = (await situacaoPush()) === 'inativo';
  if (podePedir) buscaChaveVapid().catch(() => {});
  const naoLidosOriginais = new Set(r.itens.filter((a) => a.novo).map((a) => a.id));
  let filtroAvisos = 'todos';

  function iconeAviso(a) {
    if (a.tipo === 'entrada') return icone('receber');
    if (a.tipo === 'viagem') return icone('caminhao');
    if (a.tipo === 'nota') return icone('nota');
    if (a.tipo === 'diaria') return icone('calendario');
    if (a.acao === 'editou') return icone('editar');
    if (a.acao === 'excluiu') return icone('lixeira');
    if (a.resumo && /diesel|litro|abastec/i.test(a.resumo)) return icone('combustivel');
    return icone('gasto');
  }

  function renderItens() {
    const filtrados = r.itens.filter((a) => {
      if (filtroAvisos === 'nao_lidos') return naoLidosOriginais.has(a.id);
      return true;
    });

    if (!filtrados.length) {
      return `
        <div class="vazio" style="padding:28px 16px;text-align:center">
          <div style="margin-bottom:8px;color:var(--primaria)">${icone('sino')}</div>
          <p style="font-weight:600;margin:0 0 4px">Tudo limpo por aqui!</p>
          <small style="color:var(--tinta-3)">${filtroAvisos === 'nao_lidos' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação registrada recentemente.'}</small>
        </div>`;
    }

    return `
      <div class="lista-notificacoes-elevada">
        ${filtrados.map((a) => {
          const ehEntrada = a.tipo === 'entrada';
          const ehViagem = ['viagem', 'nota', 'diaria'].includes(a.tipo);
          const ehExclusao = a.acao === 'excluiu';
          const corClasse = ehEntrada ? 'entrada' : (ehViagem ? 'viagem' : (ehExclusao ? 'exclusao' : 'saida'));
          const eNova = naoLidosOriginais.has(a.id);
          return `
            <div class="card-notificacao ${eNova ? 'nao-lida' : ''} ${a.lancamento_id ? 'interativa' : ''}"
                 ${a.lancamento_id ? `data-lancamento="${a.lancamento_id}"` : ''}
                 role="${a.lancamento_id ? 'button' : 'article'}" tabindex="${a.lancamento_id ? '0' : '-1'}">
              <div class="icone-notificacao ${corClasse}">
                ${iconeAviso(a)}
              </div>
              <div class="corpo-notificacao">
                <div class="topo-notificacao">
                  <strong>${esc(textoAviso(a))}</strong>
                  ${eNova ? '<span class="badge-notificacao-nova">Nova</span>' : ''}
                </div>
                <div class="resumo-notificacao">${esc(a.resumo)}</div>
                <div class="meta-notificacao">
                  <span class="tempo-notificacao">${icone('relogio')} ${quandoAviso(a.segundos)}</span>
                  ${a.lancamento_id ? '<span class="dica-toque-notificacao">Toque para ver lançamento ›</span>' : ''}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  const { elemento, fechar } = janela('Central de Notificações', `
    <div class="painel-notificacoes-modal">
      <div class="topo-acoes-notificacoes">
        <div class="filtro-pills-ajustes" role="group" aria-label="Filtrar notificações" style="margin:0">
          <button type="button" id="tab-notif-todas" class="tab-notif" data-filtro="todos" aria-pressed="true">
            Todas (${r.itens.length})
          </button>
          <button type="button" id="tab-notif-novas" class="tab-notif" data-filtro="nao_lidos" aria-pressed="false">
            Não lidas (${r.nao_lidos})
          </button>
        </div>
        ${r.nao_lidos > 0 ? `
          <button class="btn pequeno" type="button" id="b-marcar-todas-lidas" style="font-size:0.75rem">
            ${icone('check')} Marcar lidas
          </button>` : ''}
      </div>

      ${podePedir ? `
        <div class="aviso info" style="margin:12px 0 8px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="font-size:0.82rem">Receber alertas na tela deste celular?</span>
          <button class="btn pequeno principal" type="button" data-permitir style="margin:0;padding:4px 10px;font-size:0.75rem">
            Ativar Alertas
          </button>
        </div>` : ''}

      <div id="container-lista-notificacoes" style="margin-top:12px">
        ${renderItens()}
      </div>
    </div>`);

  const container = elemento.querySelector('#container-lista-notificacoes');

  function atualizaLista() {
    container.innerHTML = renderItens();
    ligaItens(container);
  }

  elemento.querySelectorAll('.tab-notif').forEach((b) => {
    b.onclick = () => {
      filtroAvisos = b.dataset.filtro;
      elemento.querySelectorAll('.tab-notif').forEach((tb) => {
        tb.setAttribute('aria-pressed', String(tb === b));
      });
      atualizaLista();
    };
  });

  const bMarcar = elemento.querySelector('#b-marcar-todas-lidas');
  if (bMarcar) {
    bMarcar.onclick = async () => {
      try {
        await api('POST', 'avisos-lidos');
        mostraContador(0);
        naoLidosOriginais.clear();
        r.itens.forEach((a) => { a.novo = false; });
        r.nao_lidos = 0;
        bMarcar.remove();
        const tabNovas = elemento.querySelector('#tab-notif-novas');
        if (tabNovas) tabNovas.textContent = 'Não lidas (0)';
        atualizaLista();
        recado('Notificações marcadas como lidas.');
      } catch {}
    };
  }

  elemento.querySelector('[data-permitir]')?.addEventListener('click', async (e) => {
    const caixa = e.target.closest('.aviso');
    try {
      await ativaPush();
      caixa.textContent = 'Notificações ativadas neste aparelho, mesmo com o app fechado.';
    } catch (erro) {
      caixa.textContent = `${erro.message} Os avisos continuam aparecendo aqui.`;
    }
  });

  ligaItens(container);

  if (r.nao_lidos) {
    try {
      await api('POST', 'avisos-lidos');
      mostraContador(0);
      r.nao_lidos = 0;
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Sem internet: fila do aparelho, faixa de aviso e envio quando o sinal volta
// ---------------------------------------------------------------------------

const fila = { timer: null, sincronizando: null };

function marcaOffline(semInternet) {
  document.body.classList.toggle('sem-internet', Boolean(semInternet));
}

window.addEventListener('offline', () => marcaOffline(true));
window.addEventListener('online', () => {
  marcaOffline(false);
  sincroniza();
});

function resumoDoEnvio(rota, corpo = {}) {
  const c = corpo || {};
  if (rota === 'lancamentos') {
    const cat = estado.categorias.find((x) => String(x.id) === String(c.categoria_id));
    return [cat?.nome || 'Lançamento', c.valor ? `R$ ${c.valor}` : '', c.data ? dataCurta(c.data) : '']
      .filter(Boolean).join(' · ');
  }
  if (rota === 'viagens') return `Viagem ${c.origem || ''} → ${c.destino || ''}`;
  if (rota === 'viagem-encerrar') return `Encerrar viagem${c.fim ? ` (chegada ${dataCurta(c.fim)})` : ''}`;
  if (rota === 'notas') return `Nota fiscal${c.numero ? ` nº ${c.numero}` : ''}${c.cliente ? ` · ${c.cliente}` : ''}`;
  if (rota === 'diarias') {
    return `Dia trabalhado ${dataCurta(c.de)}${c.ate && c.ate !== c.de ? ` a ${dataCurta(c.ate)}` : ''}`;
  }
  if (rota === 'diarias-pagar') {
    const motorista=estado.usuarios.find((u)=>String(u.id)===String(c.usuario_id));
    return ['Pagamento de diárias',motorista?.nome,c.ids?.length?`${c.ids.length} dia(s)`:c.mes?mesCurto(c.mes):''].filter(Boolean).join(' · ');
  }
  const nomes={clientes:'Cadastro de cliente',caminhoes:'Cadastro de caminhão',categorias:'Cadastro de categoria','viagem-pagamento':'Pagamento de viagem','meu-caminhao':'Caminhão padrão',recebiveis:'Cobrança de cliente','recebivel-receber':'Recebimento de cliente'};
  if(nomes[rota])return [nomes[rota],c.nome||c.placa||''].filter(Boolean).join(' · ');
  return rota;
}

async function guardaNaFila(id, rota, params, corpo, criadoEm = Date.now()) {
  const envio = await Fila.adiciona({
    id, criadoEm, usuarioId: estado.usuario.id, rota, params, corpo, resumo: resumoDoEnvio(rota, corpo),
  });
  pedeSincronizacao();
  // Com internet (só a foto tinha ficado no aparelho): tenta enviar agora mesmo.
  if (navigator.onLine !== false) {
    const r = await sincroniza({ silencioso: true });
    if (r?.respostas?.[envio.id]) return r.respostas[envio.id];
    const recusado = (await Fila.lista(estado.usuario.id)).find((e) => e.id === envio.id && e.erro);
    if (recusado) {
      await Fila.remove(envio.id);
      await atualizaFila();
      throw new Error(recusado.erro);
    }
  }
  await atualizaFila();
  return { offline: true, id: envio.ref };
}

// Android: pede ao navegador para enviar a fila quando a internet voltar, mesmo com o app fechado.
function pedeSincronizacao() {
  navigator.serviceWorker?.ready
    .then((registro) => registro.sync?.register('frota-fila'))
    .catch(() => {});
}

async function sincroniza({ silencioso = false } = {}) {
  if (!estado.usuario) return null;
  if (fila.sincronizando) return fila.sincronizando;
  fila.sincronizando = (async () => {
    let r = null;
    try {
      r = await Fila.processa(estado.usuario.id);
    } catch {
      return null;
    }
    if (silencioso) await atualizaFila();
    else await aoSincronizar(r);
    return r;
  })();
  try {
    return await fila.sincronizando;
  } finally {
    fila.sincronizando = null;
  }
}

async function aoSincronizar(r) {
  await atualizaFila();
  if (!r || !estado.usuario) return;
  if (r.sessao) {
    estado.usuario = null;
    telaLogin('Sua sessão expirou. Entre de novo para enviar o que ficou guardado no aparelho.');
    return;
  }
  if (r.enviados) {
    recado(r.enviados === 1
      ? 'O registro guardado sem internet foi enviado.'
      : `${r.enviados} registros guardados sem internet foram enviados.`);
    try { await recarregaBasico(); } catch { /* fica com o que já tinha */ }
    if (!document.querySelector('.janela')) abreAba(estado.aba);
  }
  if (r.erros) recado('Algum registro guardado no aparelho não foi aceito. Toque no relógio, no topo, para ver.');
}

async function atualizaFila() {
  const botao = document.getElementById('b-fila');
  if (!botao || !estado.usuario) return;
  let itens = [];
  try { itens = await Fila.lista(estado.usuario.id); } catch { /* sem IndexedDB */ }
  botao.classList.toggle('oculto', !itens.length);
  botao.classList.toggle('com-erro', itens.some((e) => e.erro));
  botao.querySelector('.contador').textContent = itens.length > 99 ? '99+' : String(itens.length);
  botao.setAttribute('aria-label', `${itens.length} ${itens.length === 1 ? 'registro guardado' : 'registros guardados'} no aparelho`);
  if (itens.length && !fila.timer) {
    fila.timer = setInterval(() => {
      if (navigator.onLine !== false && !document.hidden) sincroniza();
    }, 45000);
  } else if (!itens.length && fila.timer) {
    clearInterval(fila.timer);
    fila.timer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && estado.usuario && navigator.onLine !== false) sincroniza();
});

async function abreFila() {
  const itens = await Fila.lista(estado.usuario.id);
  const { elemento, fechar } = janela('Guardado no aparelho', `
    <p class="ajuda" style="margin-top:0">
      Registrado sem internet. É enviado sozinho quando o sinal voltar; não feche a conta antes disso.
    </p>
    ${itens.length ? `
      <div class="lista-fila">
        ${itens.map((e) => `
          <div class="item-fila ${e.erro ? 'com-erro' : ''}">
            <div>
              <strong>${esc(e.resumo)}</strong>
              <small>Guardado ${quandoAviso((Date.now() - e.criadoEm) / 1000)}</small>
              ${e.erro ? `<p class="aviso erro">${esc(e.erro)}</p>` : ''}
            </div>
            <button class="btn pequeno perigo" type="button" data-descartar="${esc(e.id)}">Descartar</button>
          </div>`).join('')}
      </div>
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn principal" type="button" data-enviar>Enviar agora</button>
      </div>` : '<div class="vazio">Nada esperando envio.</div>'}`);

  elemento.querySelector('[data-enviar]')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Enviando…';
    await Fila.tentaDeNovo(estado.usuario.id);
    const r = await sincroniza();
    fechar();
    if (r?.semRede) recado('Ainda sem internet. Fica guardado e vai sozinho quando o sinal voltar.');
    if ((await Fila.lista(estado.usuario.id)).length) abreFila();
  });
  elemento.querySelectorAll('[data-descartar]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Descartar este registro? Ele não será enviado.')) return;
      await Fila.remove(b.dataset.descartar);
      await atualizaFila();
      fechar();
      estado.viagensAbertas = await carregaViagensAbertas().catch(() => estado.viagensAbertas);
      if ((await Fila.lista(estado.usuario.id)).length) abreFila();
    };
  });
}

// Sair apaga deste aparelho os dados guardados e desliga as notificações desta conta.
async function saiDaConta() {
  if (navigator.onLine === false) {
    recado('Para sair da conta, conecte-se à internet.');
    return;
  }
  const pendentes = await Fila.lista(estado.usuario.id).catch(() => []);
  if (pendentes.length && !confirm(
    `${pendentes.length === 1 ? 'Há 1 registro guardado' : `Há ${pendentes.length} registros guardados`} no aparelho `
    + 'que ainda não foram enviados. Se sair agora, eles serão perdidos. Sair mesmo assim?'
  )) return;
  try {
    const inscricao = await inscricaoPush();
    if (inscricao) await api('POST', 'push-cancelar', {}, { endpoint: inscricao.endpoint });
  } catch { /* segue saindo */ }
  try {
    await api('POST', 'logout');
  } catch (erro) {
    recado(erro.message);
    return;
  }
  for (const e of pendentes) await Fila.remove(e.id).catch(() => {});
  await Fila.defineMeta('usuario', null).catch(() => {});
  await Fila.defineMeta('sessao-offline',null).catch(()=>{});
  try { await Promise.all((await caches.keys()).filter((k)=>k.startsWith(Fila.CACHE_DADOS)).map((k)=>caches.delete(k))); } catch { /* sem Cache Storage */ }
  navigator.clearAppBadge?.().catch(() => {});
  estado.usuario = null;
  estado.aba = null;
  telaLogin('Você saiu da conta.');
}

// ---------------------------------------------------------------------------
// Instalação e notificações push (Android, computador e iPhone)
// ---------------------------------------------------------------------------

const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const appInstalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let chaveVapid = null;

async function buscaChaveVapid() {
  if (chaveVapid === null) chaveVapid = (await api('GET', 'push-chave')).chave || '';
  return chaveVapid;
}

function bytesDaChave(b64) {
  const texto = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

async function inscricaoPush() {
  if (!pushSuportado()) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro ? registro.pushManager.getSubscription() : null;
}

// 'ativo' | 'inativo' | 'bloqueado' | 'instalar-ios' | 'sem-https' | 'sem-suporte'
async function situacaoPush() {
  if (!window.isSecureContext) return 'sem-https';
  // No iPhone o push só existe com o app aberto pelo ícone da tela de início (iOS 16.4+).
  if (!pushSuportado()) return ehIOS && !appInstalado() ? 'instalar-ios' : 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  try {
    return (await inscricaoPush()) ? 'ativo' : 'inativo';
  } catch {
    return 'inativo';
  }
}

// Precisa vir de um toque na tela (exigência do iPhone): o pedido de permissão vem primeiro.
async function ativaPush() {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new Error('As notificações foram bloqueadas. Libere nas configurações do celular ou do navegador.');
  }
  const chave = await buscaChaveVapid();
  if (!chave) throw new Error('O servidor ainda não consegue enviar notificações (falta o OpenSSL no PHP).');
  const registro = await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) });
  }
  await api('POST', 'push-inscrever', {}, inscricao.toJSON());
}

async function desativaPush() {
  const inscricao = await inscricaoPush();
  if (!inscricao) return;
  try { await api('POST', 'push-cancelar', {}, { endpoint: inscricao.endpoint }); } catch { /* sai do aparelho mesmo assim */ }
  await inscricao.unsubscribe();
}

// Ao abrir o app: o servidor fica sabendo que este aparelho é de quem entrou. Se a chave do
// servidor mudou (banco novo), refaz a inscrição com a chave nova.
async function sincronizaPush() {
  try {
    let inscricao = await inscricaoPush();
    if (!inscricao || Notification.permission !== 'granted' || navigator.onLine === false) return;
    const chave = await buscaChaveVapid();
    const atual = inscricao.options?.applicationServerKey;
    if (chave && atual && new Uint8Array(atual).join() !== bytesDaChave(chave).join()) {
      await inscricao.unsubscribe();
      const registro = await navigator.serviceWorker.ready;
      inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) });
    }
    await api('POST', 'push-inscrever', {}, inscricao.toJSON());
  } catch { /* tenta de novo na próxima abertura */ }
}

function cartoesDoAparelho() {
  return `
    <div class="cartao" id="cartao-instalar">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="icone-kpi azul icone-instalar">${icone('celular')}</div>
        <div>
          <h2 style="margin:0 0 2px">Aplicativo no celular</h2>
          <p class="ajuda" style="margin:0" data-texto-instalar></p>
        </div>
      </div>
      <div class="acoes" style="margin-top:12px" data-acoes-instalar></div>
    </div>

    <div class="cartao" id="cartao-push">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="icone-kpi azul icone-instalar">${icone('sino')}</div>
        <div>
          <h2 style="margin:0 0 2px">Notificações neste aparelho</h2>
          <p class="ajuda" style="margin:0" data-texto-push></p>
        </div>
      </div>
      <div class="acoes" style="margin-top:12px" data-acoes-push></div>
    </div>`;
}

function ligaCartoesDoAparelho(alvo) {
  const instalar = alvo.querySelector('#cartao-instalar');
  const push = alvo.querySelector('#cartao-push');
  if (!instalar || !push) return;

  const textoInstalar = instalar.querySelector('[data-texto-instalar]');
  const acoesInstalar = instalar.querySelector('[data-acoes-instalar]');
  if (appInstalado()) {
    textoInstalar.textContent = 'O app está instalado neste aparelho e funciona mesmo sem internet.';
  } else if (!window.isSecureContext) {
    textoInstalar.textContent = 'Para instalar e usar sem internet, o site precisa abrir com https:// (na hospedagem).';
  } else if (deferredInstallPrompt) {
    textoInstalar.textContent = 'Instale para abrir pelo ícone, em tela cheia, e registrar gastos mesmo sem sinal.';
    acoesInstalar.innerHTML = `<button class="btn principal" type="button" data-instalar>${icone('adicionar')} Instalar agora</button>`;
    acoesInstalar.querySelector('[data-instalar]').onclick = async () => {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      acoesInstalar.innerHTML = '';
      if (outcome === 'accepted') textoInstalar.textContent = 'Pronto! Abra pelo ícone na tela de início.';
    };
  } else if (ehIOS) {
    textoInstalar.innerHTML = 'No iPhone: abra este site no <b>Safari</b>, toque em <b>Compartilhar</b> '
      + '(o quadrado com a seta para cima) e depois em <b>“Adicionar à Tela de Início”</b>. '
      + 'Depois, abra sempre pelo ícone.';
  } else {
    textoInstalar.innerHTML = 'No menu do navegador, toque em <b>“Instalar app”</b> ou '
      + '<b>“Adicionar à tela de início”</b> para usar como aplicativo, mesmo sem internet.';
  }

  const textoPush = push.querySelector('[data-texto-push]');
  const acoesPush = push.querySelector('[data-acoes-push]');
  const paraQue = ehAdmin()
    ? 'Receba um aviso quando um motorista registrar algo, mesmo com o app fechado.'
    : 'Receba um aviso quando o escritório abrir uma viagem para você ou pagar suas diárias.';

  async function desenhaPush() {
    const situacao = await situacaoPush();
    acoesPush.innerHTML = '';
    if (situacao === 'ativo') {
      textoPush.textContent = 'Ativas: os avisos chegam neste aparelho mesmo com o app fechado.';
      acoesPush.innerHTML = `
        <button class="btn" type="button" data-testar>${icone('sino')} Enviar teste</button>
        <button class="btn" type="button" data-desativar>Desativar</button>`;
      acoesPush.querySelector('[data-testar]').onclick = async () => {
        try {
          await api('POST', 'push-teste');
          recado('Teste enviado. Deve chegar em alguns segundos.');
        } catch (erro) {
          recado(erro.message);
        }
      };
      acoesPush.querySelector('[data-desativar]').onclick = async () => {
        await desativaPush().catch(() => {});
        desenhaPush();
      };
    } else if (situacao === 'inativo') {
      textoPush.textContent = paraQue;
      buscaChaveVapid().catch(() => {});
      acoesPush.innerHTML = `<button class="btn principal" type="button" data-ativar>${icone('sino')} Ativar notificações</button>`;
      acoesPush.querySelector('[data-ativar]').onclick = async () => {
        try {
          await ativaPush();
          recado('Notificações ativadas neste aparelho.');
        } catch (erro) {
          recado(erro.message);
        }
        desenhaPush();
      };
    } else {
      textoPush.textContent = {
        bloqueado: 'Bloqueadas. Libere as notificações deste site nas configurações do celular ou do navegador.',
        'instalar-ios': 'No iPhone, as notificações só funcionam com o app instalado na tela de início '
          + '(iOS 16.4 ou mais novo). Instale como explicado acima e abra pelo ícone.',
        'sem-https': 'As notificações precisam do site em https:// (na hospedagem).',
        'sem-suporte': 'Este navegador não recebe notificações. No Android use o Chrome; no iPhone, o Safari.',
      }[situacao];
    }
  }
  desenhaPush();
}

// Atalhos do ícone (manifest.php), notificação tocada e arquivo compartilhado chegam como ?acao=...
function executaAcaoDaUrl() {
  const p = new URLSearchParams(location.search);
  const acao = p.get('acao');
  if (!acao) return;
  history.replaceState(null, '', location.pathname);
  const recarrega = async () => { if (aoConcluir) await aoConcluir(); else if (!document.querySelector('.janela')) await abreAba(estado.aba); };
  if (acao === 'gasto') abreFormLancamento('saida', null, recarrega);
  else if (acao === 'viagem') abreFormViagem(null, recarrega);
  else if (acao === 'nota') formNota(null, recarrega);
  else if (acao === 'diaria') formDiaria(null, recarrega);
  else if (acao === 'avisos') abreAvisos();
  else if (acao === 'compartilhado' && Fila.ehLocal(p.get('arquivo'))) escolheDestinoDoArquivo(p.get('arquivo'), recarrega);
}

function escolheDestinoDoArquivo(ref, recarrega) {
  const { elemento, fechar } = janela('Arquivo recebido', `
    <p class="ajuda" style="margin-top:0">O que é este arquivo?</p>
    <div class="acoes duas">
      <button class="btn principal grande" type="button" data-nota>${icone('nota')} Nota fiscal</button>
      <button class="btn grande" type="button" data-gasto>${icone('gasto')} Comprovante de gasto</button>
    </div>`);
  elemento.querySelector('[data-nota]').onclick = () => {
    formNota(null, recarrega, { arquivo: ref });
  };
  elemento.querySelector('[data-gasto]').onclick = () => {
    abreFormLancamento('saida', null, recarrega, { comprovante: ref });
  };
}

const PAGAMENTOS = ['Dinheiro', 'Cartão da empresa', 'Pix', 'Cartão frete', 'Boleto', 'Do próprio bolso'];

function comOExtra(lista, extra) {
  if (extra?.id && !lista.some((x) => String(x.id) === String(extra.id))) {
    return [...lista, { ...extra, id: extra.id }];
  }
  return lista;
}

function opcoesCaminhao(selecionado, extra) {
  return [
    '<option value="">Selecione o caminhão</option>',
    ...comOExtra(estado.caminhoes, extra).map((c) => `
      <option value="${c.id}" ${String(selecionado) === String(c.id) ? 'selected' : ''}>
        ${esc(c.placa)}${c.apelido ? ` · ${esc(c.apelido)}` : ''}
      </option>`),
  ].join('');
}

function opcoesViagem(selecionado, extra) {
  return [
    '<option value="">Fora de viagem</option>',
    ...comOExtra(estado.viagensAbertas, extra).map((v) => `
      <option value="${esc(v.id)}" ${String(selecionado) === String(v.id) ? 'selected' : ''}>
        ${Fila.ehLocal(v.id) ? '⏳ ' : ''}${esc(localViagem(v.origem))} → ${esc(localViagem(v.destino))}${v.inicio ? ` (saída ${dataDiaMes(v.inicio)})` : ''}
      </option>`),
  ].join('');
}

function opcoesMotorista(selecionado) {
  return estado.usuarios.filter((u) => Number(u.ativo)).map((u) => `
    <option value="${u.id}" ${Number(selecionado) === Number(u.id) ? 'selected' : ''}>
      ${esc(u.nome)}${u.papel === 'admin' ? ' (proprietário)' : ''}
    </option>`).join('');
}

function opcoesRecebivel(selecionado, extra) {
  return comOExtra(estado.recebiveisAbertos, extra).map((r) => `
    <option value="${r.id}" ${Number(selecionado) === Number(r.id) ? 'selected' : ''}>
      ${esc(r.cliente)}${r.descricao ? ` · ${esc(r.descricao)}` : ''}${r.restante_centavos != null
        ? ` (falta ${dinheiro(r.restante_centavos)})` : ''}
    </option>`).join('');
}

function categoriasDoTipo(tipo) {
  return estado.categorias.filter((c) => c.tipo === tipo);
}

function camposLancamento(tipo, l = {}) {
  const entrada = tipo === 'entrada';
  const valorInicial = l.valor_centavos
    ? (l.valor_centavos / 100).toFixed(2).replace('.', ',')
    : '';
  const lista = comOExtra(categoriasDoTipo(tipo), l.categoria_id ? {
    id: l.categoria_id,
    nome: l.categoria,
    pede_litros: l.litros ? 1 : 0,
    pede_descricao: l.descricao ? 1 : 0,
  } : null);

  return `
    <input type="hidden" name="usuario_id" value="${esc(l.usuario_id || estado.usuario.id)}">

    <div class="linha duas">
      <div class="campo">
        <label for="c-data">${entrada ? 'Dia do recebimento' : 'Dia do gasto'}</label>
        <input id="c-data" name="data" type="date" required value="${esc(l.data || hoje())}">
      </div>
      <div class="campo">
        <label for="c-caminhao">Caminhão</label>
        <select id="c-caminhao" name="caminhao_id">
          ${opcoesCaminhao(l.caminhao_id || (l.id ? null : (ehAdmin() ? (estado.usuarios.find((u) => String(u.id) === String(l.usuario_id || estado.usuario.id))?.caminhao_padrao_id || estado.usuario.caminhao_padrao_id) : estado.usuario.caminhao_padrao_id)), l.placa
            ? { id: l.caminhao_id, placa: l.placa, apelido: l.caminhao_apelido } : null)}
        </select>
      </div>
    </div>

    <div class="campo opcional" style="margin-top:16px">
      <label for="c-viagem">Viagem</label>
      <p class="dica">${entrada
        ? 'Se este frete é de uma viagem aberta, escolha ela.'
        : 'Se o gasto foi numa viagem, escolha ela aqui.'}</p>
      <select id="c-viagem" name="viagem_id">
        ${opcoesViagem(l.viagem_id, l.viagem_origem
          ? { id: l.viagem_id, origem: l.viagem_origem, destino: l.viagem_destino } : null)}
      </select>
      <button class="btn pequeno botao-nova-viagem" type="button" data-nova-viagem>+ Registrar nova viagem</button>
      <div class="caixa-viagem oculto" data-se="nova-viagem">
        <strong>Nova viagem</strong>
        <div class="linha duas">
          <div class="campo">
            <label for="nv-origem">Saindo de</label>
            <input id="nv-origem" maxlength="80" placeholder="Local de saída">
          </div>
          <div class="campo">
            <label for="nv-destino">Indo para</label>
            <input id="nv-destino" maxlength="80" placeholder="Local de destino">
          </div>
        </div>
        <div class="linha duas">
          <div class="campo">
            <label for="nv-inicio">Dia da saída</label>
            <input id="nv-inicio" type="date">
          </div>
          <div class="campo opcional">
            <label for="nv-km">Km do painel na saída</label>
            <input id="nv-km" inputmode="numeric">
          </div>
        </div>
        <p class="dica">A viagem fica com o mesmo caminhão${ehAdmin() ? ' e motorista' : ''} deste lançamento.</p>
        <div class="acoes fim">
          <button class="btn" type="button" data-nv-cancelar>Cancelar</button>
          <button class="btn principal" type="button" data-nv-salvar>Abrir viagem</button>
        </div>
      </div>
    </div>

    <div class="campo">
      <label>${entrada ? 'Categoria da entrada' : 'Categoria do gasto'}</label>
      <p class="dica">Selecione a categoria que melhor descreve o lançamento.</p>
      <div class="categorias" role="group">
        ${lista.map((c) => `
          <button type="button" class="opcao-categoria" data-id="${c.id}"
                  data-litros="${Number(c.pede_litros)||0}" data-descricao="${Number(c.pede_descricao)||0}"
                  aria-pressed="${String(l.categoria_id) === String(c.id)}">
            ${esc(c.nome)}
          </button>`).join('')}
      </div>
      <input type="hidden" name="categoria_id" value="${esc(l.categoria_id || '')}">
    </div>

    <div class="campo oculto" data-se="descricao">
      <label for="c-descricao">${entrada ? 'Do que foi essa entrada?' : 'O que foi esse gasto?'}</label>
      <p class="dica">${entrada
        ? 'Ex.: frete de adubo, venda de pneu usado.'
        : 'Ex.: chapa para descarga, guincho, cafezinho da equipe.'}</p>
      <input id="c-descricao" name="descricao" maxlength="140" value="${esc(l.descricao || '')}">
    </div>

    <div class="campo">
      <label for="c-valor">${entrada ? 'Valor recebido' : 'Valor pago'}</label>
      <div class="valor-caixa">
        <span aria-hidden="true">R$</span>
        <input id="c-valor" name="valor" inputmode="decimal" required placeholder="0,00"
               value="${esc(valorInicial)}" aria-label="Valor em reais">
      </div>
    </div>

    <div class="linha duas oculto" data-se="litros">
      <div class="campo">
        <label for="c-litros">Litros abastecidos</label>
        <input id="c-litros" name="litros" inputmode="decimal" placeholder="0"
               value="${esc(l.litros ?? '')}">
      </div>
      <div class="campo opcional">
        <label for="c-km">Km do painel</label>
        <input id="c-km" name="km" inputmode="numeric" placeholder="0" value="${esc(l.km ?? '')}">
      </div>
    </div>
    <p class="aviso info oculto" data-se="preco-litro"></p>

    ${entrada && ehAdmin() ? `
      <div class="campo opcional">
        <label for="c-recebivel">É pagamento de um frete a receber?</label>
        <p class="dica">Escolha o frete para abater do que o cliente ainda deve.</p>
        <select id="c-recebivel" name="recebivel_id">
          <option value="">Não, é uma entrada avulsa</option>
          ${opcoesRecebivel(l.recebivel_id, l.recebivel_id
            ? { id: l.recebivel_id, cliente: l.recebivel_cliente, descricao: l.recebivel_descricao } : null)}
        </select>
      </div>` : ''}

    ${entrada ? `
      <div class="campo opcional">
        <label for="c-cliente">Quem pagou</label>
        <p class="dica">Nome do cliente, cooperativa ou empresa.</p>
        <input id="c-cliente" name="cliente" maxlength="90" value="${esc(l.cliente || '')}">
      </div>` : ''}

    <div class="linha duas">
      <div class="campo opcional">
        <label for="c-lugar">${entrada ? 'Cidade / local' : 'Onde foi'}</label>
        <input id="c-lugar" name="lugar" maxlength="90"
               placeholder="${entrada ? 'Cidade da carga' : 'Posto, cidade, oficina…'}"
               value="${esc(l.lugar || '')}">
      </div>
      <div class="campo opcional">
        <label for="c-pagamento">${entrada ? 'Como recebeu' : 'Como pagou'}</label>
        <select id="c-pagamento" name="pagamento">
          <option value="">Não informar</option>
          ${PAGAMENTOS.map((p) => `
            <option value="${p}" ${l.pagamento === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="campo opcional" style="margin-top:16px">
      <label for="c-observacao">Observação</label>
      <textarea id="c-observacao" name="observacao" maxlength="500"
                placeholder="Algo que o escritório precise saber">${esc(l.observacao || '')}</textarea>
    </div>

    <div class="campo opcional">
      <label for="c-foto">${entrada ? 'Foto do comprovante' : 'Foto da nota'}</label>
      <p class="dica">Tire a foto do cupom, nota ou comprovante.</p>
      <label class="arquivo" for="c-foto">
        <span class="btn pequeno" aria-hidden="true">Escolher foto</span>
        <span data-nome-arquivo>Nenhuma foto escolhida</span>
      </label>
      <input id="c-foto" class="escondido" type="file" accept="image/*,application/pdf" capture="environment">
      <input type="hidden" name="comprovante" value="${esc(l.comprovante || '')}">
      <p class="aviso ok oculto" data-se="foto"></p>
    </div>`;
}

// Reduz a foto antes do envio (lado maior até 1600px) e grava em WebP. O Safari não gera WebP
// no canvas (devolve PNG), então nesse caso vai em JPEG; o servidor converte para WebP de todo jeito.
async function reduzFoto(arquivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo;
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(imagem.width, imagem.height));
    const tela = document.createElement('canvas');
    tela.width = Math.round(imagem.width * escala);
    tela.height = Math.round(imagem.height * escala);
    tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
    const gera = (tipo) => new Promise((pronto) => tela.toBlob(pronto, tipo, 0.8));
    let blob = await gera('image/webp');
    if (blob?.type !== 'image/webp') blob = await gera('image/jpeg');
    if (!blob || blob.size >= arquivo.size) return arquivo;
    const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `comprovante.${extensao}`, { type: blob.type });
  } catch {
    return arquivo;
  }
}

function organizaFormularioLancamento(form) {
  if (form.querySelector('.registro-principal')) return;
  form.classList.add('form-lancamento-organizado','registro-simples');
  const antes=[...form.children].find((el)=>el.matches('.acoes.fim')) || null;
  const principal=document.createElement('div');principal.className='registro-principal';
  const mover=(seletor,destino)=>{const campo=form.querySelector(seletor);if(!campo)return;const item=campo.matches('[data-se]')?campo:campo.closest('.linha.duas')||campo.closest('.campo');if(item)destino.append(item);};
  ['#c-valor','.categorias','[data-se="descricao"]','[data-se="litros"]','[data-se="preco-litro"]','#c-data','#c-viagem'].forEach((seletor)=>mover(seletor,principal));
  form.insertBefore(principal,antes);
  const lista=form.querySelector('.categorias');
  if(lista){
    const select=document.createElement('select');select.id='c-categoria-simples';select.required=true;select.setAttribute('aria-label','Categoria');
    select.add(new Option('Selecione uma categoria',''));
    lista.querySelectorAll('button').forEach((b)=>select.add(new Option(b.textContent.trim(),b.dataset.id,false,b.getAttribute('aria-pressed')==='true')));
    lista.before(select);lista.classList.add('oculto');
    const label=lista.closest('.campo').querySelector('label');label.htmlFor=select.id;label.textContent='Categoria';
    select.onchange=()=>{const botao=[...lista.querySelectorAll('button')].find((b)=>b.dataset.id===select.value);if(botao)botao.click();else {form.elements.categoria_id.value='';lista.querySelectorAll('button').forEach((b)=>b.setAttribute('aria-pressed','false'));['litros','descricao','preco-litro'].forEach((chave)=>form.querySelector('[data-se="'+chave+'"]')?.classList.add('oculto'));}};
  }
  const extras=document.createElement('details');extras.className='registro-extras';
  const preenchido=['cliente','recebivel_id','lugar','pagamento','observacao','comprovante'].some((nome)=>form.elements[nome]?.value);
  extras.open=preenchido;
  extras.innerHTML='<summary>Adicionar detalhes ou comprovante <small>Opcional</small></summary><div class="registro-extras-corpo"></div>';
  const corpo=extras.querySelector('div');
  ['#c-cliente','#c-recebivel','#c-lugar','#c-observacao','#c-foto'].forEach((seletor)=>mover(seletor,corpo));
  form.insertBefore(extras,antes);
  form.querySelectorAll('.dica').forEach((d)=>{if(!d.closest('[data-se="nova-viagem"]'))d.hidden=true;});
  const viagem=form.querySelector('#c-viagem');if(viagem)viagem.closest('.campo').querySelector('label').textContent='Vincular a uma viagem';
  const cliente=form.querySelector('label[for="c-cliente"]');if(cliente)cliente.textContent='Cliente (entrada avulsa)';
  const pendente=form.querySelector('label[for="c-recebivel"]');if(pendente)pendente.textContent='Abater cobrança anterior';
  const novo=form.querySelector('[data-nova-viagem]');if(novo)novo.textContent='+ Nova viagem';
}

function ligaCamposLancamento(form) {
  organizaFormularioLancamento(form);
  ligaCidade(form.elements.lugar);
  const campoCategoria = form.elements.categoria_id;
  const blocoLitros = form.querySelector('[data-se="litros"]');
  const blocoDescricao = form.querySelector('[data-se="descricao"]');
  const avisoPreco = form.querySelector('[data-se="preco-litro"]');
  const avisoFoto = form.querySelector('[data-se="foto"]');

  const soNumero = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));

  function atualizaPrecoLitro() {
    const litros = soNumero(form.elements.litros?.value);
    const valor = soNumero(form.elements.valor.value);
    if (litros > 0 && valor > 0 && !blocoLitros.classList.contains('oculto')) {
      avisoPreco.textContent = `Deu ${BRL.format(valor / litros)} por litro.`;
      avisoPreco.classList.remove('oculto');
    } else {
      avisoPreco.classList.add('oculto');
    }
  }

  function selecionaCategoria(botao) {
    form.querySelectorAll('.opcao-categoria').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === botao));
    });
    campoCategoria.value = botao.dataset.id;
    const seletor=form.querySelector('#c-categoria-simples');if(seletor)seletor.value=botao.dataset.id;
    blocoLitros.classList.toggle('oculto', botao.dataset.litros !== '1');
    blocoDescricao.classList.toggle('oculto', botao.dataset.descricao !== '1');
    form.elements.descricao.required = botao.dataset.descricao === '1';
    atualizaPrecoLitro();
  }

  form.querySelectorAll('.opcao-categoria').forEach((b) => {
    b.onclick = () => selecionaCategoria(b);
    if (b.getAttribute('aria-pressed') === 'true') selecionaCategoria(b);
  });

  form.elements.valor.addEventListener('blur', () => {
    const n = soNumero(form.elements.valor.value);
    if (Number.isFinite(n) && n > 0) form.elements.valor.value = n.toFixed(2).replace('.', ',');
    atualizaPrecoLitro();
  });
  form.elements.litros?.addEventListener('input', atualizaPrecoLitro);

  const campoFoto = form.querySelector('#c-foto');
  const nomeFoto = form.querySelector('[data-nome-arquivo]');
  const limpaFoto = () => {
    campoFoto.value = '';
    nomeFoto.textContent = 'Nenhuma foto escolhida';
  };
  campoFoto.addEventListener('change', async () => {
    if (!campoFoto.files?.[0]) return;
    nomeFoto.textContent = campoFoto.files[0].name;
    avisoFoto.textContent = 'Enviando foto…';
    avisoFoto.classList.remove('oculto');
    try {
      form.elements.comprovante.value = await enviaArquivo(campoFoto.files[0]);
      avisoFoto.textContent = Fila.ehLocal(form.elements.comprovante.value)
        ? 'Sem internet: foto guardada no aparelho. Vai junto quando o sinal voltar.'
        : 'Comprovante anexado.';
    } catch (erro) {
      avisoFoto.classList.add('oculto');
      mostraErro(form, erro.message || 'Não foi possível enviar a foto.');
      limpaFoto();
    }
  });

  if (form.elements.comprovante.value) {
    avisoFoto.textContent = 'Comprovante já anexado.';
    avisoFoto.classList.remove('oculto');
  }

  // Ao escolher o frete a receber, já preenche quem pagou e o tipo de frete.
  form.elements.recebivel_id?.addEventListener('change', () => {
    const r = estado.recebiveisAbertos.find((x) => String(x.id) === String(form.elements.recebivel_id.value));
    if (!r) return;
    if (form.elements.cliente && !form.elements.cliente.value) form.elements.cliente.value = r.cliente;
    const botao = form.querySelector(`.opcao-categoria[data-id="${r.categoria_id}"]`);
    if (botao) selecionaCategoria(botao);
    if (!form.elements.valor.value && r.restante_centavos) {
      form.elements.valor.value = (r.restante_centavos / 100).toFixed(2).replace('.', ',');
    }
  });

  ligaNovaViagem(form);
}

function ligaNovaViagem(form) {
  const caixa = form.querySelector('[data-se="nova-viagem"]');
  const abrir = form.querySelector('[data-nova-viagem]');
  const salvar = caixa.querySelector('[data-nv-salvar]');
  const campo = (id) => caixa.querySelector(`#nv-${id}`);

  const fecha = () => {
    caixa.classList.add('oculto');
    abrir.classList.remove('oculto');
    ['origem', 'destino', 'km'].forEach((id) => { campo(id).value = ''; });
  };

  abrir.onclick = () => {
    caixa.classList.remove('oculto');
    abrir.classList.add('oculto');
    campo('inicio').value = form.elements.data.value || hoje();
    campo('origem').focus();
  };
  caixa.querySelector('[data-nv-cancelar]').onclick = fecha;

  salvar.onclick = async () => {
    form.querySelector('.aviso.erro')?.remove();
    const origem = campo('origem').value.trim();
    const destino = campo('destino').value.trim();
    if (!origem || !destino) {
      mostraErro(form, 'Informe de onde a viagem está saindo e para onde vai.');
      return;
    }
    salvar.disabled = true;
    salvar.textContent = 'Abrindo…';
    try {
      const inicio = campo('inicio').value || hoje();
      const r = await api('POST', 'viagens', {}, {
        origem,
        destino,
        inicio,
        km_inicial: campo('km').value,
        caminhao_id: form.elements.caminhao_id.value,
        usuario_id: form.elements.usuario_id?.value,
      });
      estado.viagensAbertas = await carregaViagensAbertas().catch(() => (
        r.offline ? [...estado.viagensAbertas, { id: r.id, origem, destino, inicio }] : estado.viagensAbertas
      ));
      form.elements.viagem_id.innerHTML = opcoesViagem(r.id);
      fecha();
      recado(r.offline
        ? 'Sem internet: viagem guardada no aparelho e já escolhida neste lançamento.'
        : 'Viagem aberta e escolhida neste lançamento.');
    } catch (erro) {
      mostraErro(form, erro.message);
    } finally {
      salvar.disabled = false;
      salvar.textContent = 'Abrir viagem';
    }
  };

  caixa.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); salvar.click(); }
    });
  });
}

function validaLancamento(dados, tipo) {
  if (!dados.categoria_id) {
    throw new Error(tipo === 'entrada' ? 'Escolha o tipo de frete.' : 'Escolha o tipo de gasto.');
  }
  if (!String(dados.valor || '').trim()) throw new Error('Informe o valor.');
  return dados;
}

// base: valores iniciais de um lançamento novo (ex.: foto recebida pelo "Compartilhar").
function abreFormLancamento(tipoInicial, lancamento, aoConcluir, base = {}) {
  let tipoAtual = tipoInicial || 'saida';
  const ehNovo = !lancamento;

  function renderConteudo() {
    return `
      ${ehAdmin() && ehNovo ? `
        <div class="seletor-tipo-lancamento" role="group" aria-label="Tipo de Lançamento">
          <button type="button" class="btn-tipo-toggle ${tipoAtual === 'saida' ? 'ativo-saida' : ''}" data-tipo-opcao="saida" aria-pressed="${tipoAtual === 'saida'}">
            ${icone('gasto')} Gasto
          </button>
          <button type="button" class="btn-tipo-toggle ${tipoAtual === 'entrada' ? 'ativo-entrada' : ''}" data-tipo-opcao="entrada" aria-pressed="${tipoAtual === 'entrada'}">
            ${icone('receber')} Entrada
          </button>
        </div>` : ''}
      ${camposLancamento(tipoAtual, lancamento || base)}
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${lancamento ? 'Salvar alterações' : tipoAtual === 'entrada' ? 'Salvar entrada' : 'Salvar gasto'}</button>
      </div>`;
  }

  const titulo = lancamento
    ? (tipoAtual === 'entrada' ? 'Editar Entrada (Frete)' : 'Editar Gasto')
    : (tipoAtual === 'entrada' ? 'Registrar entrada' : 'Registrar gasto');

  const { elemento, fechar } = janela(titulo, `
    <form novalidate id="form-registro-lancamento">
      ${renderConteudo()}
    </form>`);

  const form = elemento.querySelector('form');

  function ligaEventosForm() {
    form.querySelector('[data-cancelar]').onclick = fechar;
    ligaCamposLancamento(form);

    if (ehAdmin() && ehNovo) {
      form.querySelectorAll('[data-tipo-opcao]').forEach((btn) => {
        btn.onclick = () => {
          const novoTipo = btn.dataset.tipoOpcao;
          if (novoTipo === tipoAtual) return;
          const valoresAtuais = Object.fromEntries(new FormData(form));
          tipoAtual = novoTipo;
          const h2 = elemento.closest('.conteudo')?.querySelector('h2');
          if (h2) { h2.textContent = tipoAtual === 'entrada' ? 'Registrar entrada' : 'Registrar gasto'; h2.closest('[role="dialog"]')?.setAttribute('aria-label',h2.textContent); }
          form.classList.remove('registro-simples');
          form.innerHTML = renderConteudo();
          for(const nome of ['usuario_id','data','caminhao_id','viagem_id','valor','lugar','pagamento','observacao','comprovante']) {
            if(form.elements[nome] && valoresAtuais[nome]!=null)form.elements[nome].value=valoresAtuais[nome];
          }
          ligaEventosForm();
        };
      });
    }
  }

  ligaEventosForm();

  aoEnviar(form, async (dados) => {
    validaLancamento(dados, tipoAtual);
    const r = lancamento
      ? await api('PUT', 'lancamento', { id: lancamento.id }, dados)
      : await api('POST', 'lancamentos', {}, dados);
    fechar();
    if (r?.offline) recado(GUARDADO_OFFLINE);
    else if (lancamento) recado('Lançamento atualizado.');
    else if (ehAdmin()) recado('Lançamento registrado com sucesso!');
    else recado(`Gasto salvo. Se errou algo, dá para corrigir nos próximos ${MINUTOS_PARA_CORRIGIR} minutos.`);
    if (ehAdmin() && tipoAtual === 'entrada') await recarregaRecebiveisAbertos();
    await aoConcluir?.();
  });
}

async function telaNovoGasto(alvo) {
  const ultimoCaminhao = localStorage.getItem('ultimo_caminhao') || '';
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>Registrar gasto</h1>
        <p>Preencha os campos e toque em salvar.</p>
      </div>
      ${estado.caminhoes.length === 0 ? `
        <div class="aviso info">Nenhum caminhão cadastrado ainda. Fale com o escritório.</div>` : ''}
      <form class="cartao" novalidate>
        ${camposLancamento('saida', { caminhao_id: ultimoCaminhao })}
        <button class="btn principal grande" type="submit">Salvar gasto</button>
      </form>
      <div id="resumo-hoje"></div>
    </div>`;

  const form = alvo.querySelector('form');
  ligaCamposLancamento(form);
  aoEnviar(form, async (dados) => {
    validaLancamento(dados, 'saida');
    const r = await api('POST', 'lancamentos', {}, dados);
    localStorage.setItem('ultimo_caminhao', dados.caminhao_id || '');
    recado(r?.offline
      ? GUARDADO_OFFLINE
      : `Gasto salvo. Se errou algo, dá para corrigir nos próximos ${MINUTOS_PARA_CORRIGIR} minutos.`);
    const guardar = {
      data: dados.data,
      caminhao_id: dados.caminhao_id,
      viagem_id: dados.viagem_id,
    };
    form.innerHTML = `${camposLancamento('saida', guardar)}
      <button class="btn principal grande" type="submit">Salvar gasto</button>`;
    ligaCamposLancamento(form);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await mostraResumoHoje();
  });
  await mostraResumoHoje();
}

async function mostraResumoHoje() {
  const caixa = document.getElementById('resumo-hoje');
  if (!caixa) return;
  let r;
  try {
    r = await api('GET', 'lancamentos', { de: hoje(), ate: hoje(), limite: 5 });
  } catch {
    return;
  }
  if (!r.qtd) { caixa.innerHTML = ''; return; }
  caixa.innerHTML = `
    <div class="cartao">
      <h2>Registrado hoje</h2>
      <p class="ajuda">${r.qtd} ${r.qtd === 1 ? 'gasto' : 'gastos'} - total ${dinheiro(r.saidas_centavos)}</p>
      <div class="lista">${r.itens.map((l) => itemLancamento(l)).join('')}</div>
    </div>`;
  ligaItens(caixa);
}

// somenteLeitura: linha sem clique (ex.: receita da empresa vista pelo motorista).
function itemLancamento(l, somenteLeitura = false) {
  const entrada = l.tipo === 'entrada';
  const dataFormatada = dataCurta(l.data);
  const placa = l.placa ? `<span class="badge-placa">${esc(l.placa)}</span>` : '';
  const motorista = ehAdmin() && l.motorista ? `<span>${esc(l.motorista)}</span>` : '';
  const rota = l.viagem_origem ? `<span>${esc(localViagem(l.viagem_origem))} → ${esc(localViagem(l.viagem_destino))}</span>` : '';
  const litros = l.litros ? `<span>${numero(l.litros)} L</span>` : '';
  const precoLitro = l.litros && l.valor_centavos ? `<span>${dinheiro(l.valor_centavos / l.litros)}/L</span>` : '';
  const cliente = l.cliente ? `<span>${esc(l.cliente)}</span>` : '';

  const metaDetalhes = [motorista, rota, litros, precoLitro, cliente].filter(Boolean).join('<span class="separador-ponto">·</span>');

  return `
    <div class="item-lancamento-moderno ${somenteLeitura ? 'somente-leitura' : ''}"
         ${somenteLeitura ? '' : `data-lancamento="${l.id}" role="button" tabindex="0"`}>
      <div class="icone-lancamento ${entrada ? 'entrada' : 'saida'}">
        ${entrada ? icone('receber') : (l.litros ? icone('combustivel') : icone('gasto'))}
      </div>
      <div class="info-lancamento">
        <div class="topo-lancamento">
          <span class="nome-lancamento">${esc(l.descricao || l.categoria)}</span>
          ${placa}
          ${seloPrazo(l)}
        </div>
        <div class="meta-lancamento">
          <span>${dataFormatada}</span>
          ${metaDetalhes ? `<span class="separador-ponto">·</span>${metaDetalhes}` : ''}
        </div>
      </div>
      <div class="valor-lancamento">
        <span class="quantia ${entrada ? 'entrada' : 'saida'}">
          ${entrada ? '+' : '−'}&nbsp;${dinheiro(l.valor_centavos)}
        </span>
        ${somenteLeitura ? '' : `<span class="seta-acao">${icone('setaDireita')}</span>`}
        ${seloCadastro(l)}
      </div>
    </div>`;
}

function ligaItens(raiz) {
  raiz.querySelectorAll('[data-lancamento]').forEach((b) => {
    b.onclick = () => abreLancamento(b.dataset.lancamento);
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abreLancamento(b.dataset.lancamento);
      }
    };
  });
}

function filtrosAtuais() {
  const f = { mes: estado.mes, limite: 300 };
  for (const chave of ['usuario_id', 'caminhao_id', 'categoria_id', 'tipo', 'busca']) {
    if (estado.filtros[chave]) f[chave] = estado.filtros[chave];
  }
  return f;
}

async function telaLancamentos(alvo) {
  const admin = ehAdmin();
  let itensCarregados = [];

  function totalFiltrosAtivos() {
    let cont = 0;
    if (estado.filtros.tipo) cont++;
    if (estado.filtros.categoria_id) cont++;
    if (estado.filtros.usuario_id) cont++;
    if (estado.filtros.caminhao_id) cont++;
    if (estado.mes !== hoje().slice(0, 7)) cont++;
    return cont;
  }

  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <h1>${admin ? 'Lançamentos' : 'Meus gastos'}</h1>
            <p id="rotulo-mes" style="font-weight:600;color:var(--tinta-2)">${mesLongo(estado.mes)}</p>
          </div>
          <div class="acoes" style="margin:0">
            ${admin ? `
              <a class="btn pequeno" id="b-pdf" href="#" target="_blank" title="Relatório PDF">
                ${icone('pdf')} <span class="oculta-celular">PDF</span>
              </a>` : ''}
            <button class="btn principal pequeno" type="button" id="b-novo-lancamento">
              ${icone('adicionar')} <span>Novo Lançamento</span>
            </button>
          </div>
        </div>
      </div>

      <div class="cartao" style="padding:14px 16px">
        <div class="barra-lancamentos-controles">
          <div class="busca-com-icone" style="flex:1;position:relative">
            <span class="lupa-icone">${icone('busca')}</span>
            <input id="f-busca" type="search" aria-label="Buscar lançamentos" list="lancamentos-keywords" placeholder="Palavras-chave: gasto, cliente, motorista ou placa"
                   value="${esc(estado.filtros.busca || '')}" style="padding-left:38px;width:100%">
          </div>
          <button class="btn-filtro-unico" type="button" id="b-abrir-filtros" title="Filtros avançados" aria-haspopup="dialog">
            ${icone('filtro')}
            <span>Filtros</span>
            <span class="badge-cont-filtros" id="cont-filtros-ativos" style="display:none">0</span>
          </button>
        </div>

        <div class="chips-filtros-ativos" id="chips-filtros-ativos" style="display:none;margin-top:10px"></div>
      </div>

      <div id="resumo-kpis"></div>
      <div id="lista"><p class="carregando">Carregando lançamentos…</p></div>
    </div>`;

  alvo.insertAdjacentHTML('beforeend',sugestoesBusca('lancamentos-keywords',[...estado.categorias.map((c)=>c.nome),...estado.usuarios.map((u)=>u.nome),...estado.caminhoes.map((c)=>c.placa),...estado.clientes.map((c)=>c.nome)]));
  let versaoConsulta=0;
  function atualizaBadgeFiltros() {
    const cont = totalFiltrosAtivos();
    const badge = alvo.querySelector('#cont-filtros-ativos');
    if (badge) {
      badge.textContent = String(cont);
      badge.style.display = cont > 0 ? 'inline-flex' : 'none';
    }

    const chips = alvo.querySelector('#chips-filtros-ativos');
    if (chips) {
      const itensChips = [];
      if (estado.mes !== hoje().slice(0, 7)) {
        itensChips.push(`<span class="chip-filtro">Mês: ${mesCurto(estado.mes)} <button type="button" data-limpar-chip="mes">×</button></span>`);
      }
      if (estado.filtros.tipo) {
        itensChips.push(`<span class="chip-filtro">Tipo: ${estado.filtros.tipo === 'entrada' ? 'Entradas' : 'Saídas'} <button type="button" data-limpar-chip="tipo">×</button></span>`);
      }
      if (estado.filtros.categoria_id) {
        const cat = estado.categorias.find((c) => String(c.id) === String(estado.filtros.categoria_id));
        if (cat) itensChips.push(`<span class="chip-filtro">Cat: ${esc(cat.nome)} <button type="button" data-limpar-chip="categoria_id">×</button></span>`);
      }
      if (estado.filtros.caminhao_id) {
        const cam = estado.caminhoes.find((c) => String(c.id) === String(estado.filtros.caminhao_id));
        if (cam) itensChips.push(`<span class="chip-filtro">Caminhão: ${esc(cam.placa)} <button type="button" data-limpar-chip="caminhao_id">×</button></span>`);
      }
      if (estado.filtros.usuario_id) {
        const usr = estado.usuarios.find((u) => String(u.id) === String(estado.filtros.usuario_id));
        if (usr) itensChips.push(`<span class="chip-filtro">Motorista: ${esc(usr.nome)} <button type="button" data-limpar-chip="usuario_id">×</button></span>`);
      }

      if (itensChips.length) {
        chips.innerHTML = `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <small style="font-weight:700;color:var(--tinta-3);font-size:0.75rem">Filtros:</small>
          ${itensChips.join('')}
          <button type="button" class="btn-limpar-todos-chips" id="b-limpar-todos-chips">Limpar todos</button>
        </div>`;
        chips.style.display = 'block';

        chips.querySelectorAll('[data-limpar-chip]').forEach((btn) => {
          btn.onclick = () => {
            const campo = btn.dataset.limparChip;
            if (campo === 'mes') estado.mes = hoje().slice(0, 7);
            else estado.filtros[campo] = '';
            atualiza();
          };
        });

        chips.querySelector('#b-limpar-todos-chips')?.addEventListener('click', () => {
          estado.mes = hoje().slice(0, 7);
          estado.filtros.tipo = '';
          estado.filtros.categoria_id = '';
          estado.filtros.caminhao_id = '';
          estado.filtros.usuario_id = '';
          atualiza();
        });
      } else {
        chips.style.display = 'none';
        chips.innerHTML = '';
      }
    }
  }

  const atualiza = async () => {
    const versaoAtual=++versaoConsulta;
    atualizaBadgeFiltros();
    const caixaLista = document.getElementById('lista');
    const caixaKpis = document.getElementById('resumo-kpis');
    caixaLista.innerHTML = '<p class="carregando">Carregando…</p>';

    const rotuloMes = document.getElementById('rotulo-mes');
    if (rotuloMes) rotuloMes.textContent = mesLongo(estado.mes);

    const r = await api('GET', 'lancamentos', filtrosAtuais());
    if(versaoAtual!==versaoConsulta || !alvo.isConnected)return;
    itensCarregados = r.itens || [];
    const pdfLink = document.getElementById('b-pdf');
    if (pdfLink) pdfLink.href = endereco('pdf', filtrosAtuais());

    if (!r.qtd) {
      if (caixaKpis) caixaKpis.innerHTML = '';
      caixaLista.innerHTML = `
        <div class="vazio">
          ${icone('busca')}
          <p style="margin-top:8px">Nenhum lançamento encontrado para os filtros selecionados.</p>
        </div>`;
      return;
    }

    const saldo = r.saldo_centavos;
    if (caixaKpis) {
      caixaKpis.innerHTML = `
        <div class="grade-kpis">
          ${admin ? `
          <div class="card-kpi">
            <div class="icone-kpi verde">${icone('receber')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Total Entradas</span>
              <span class="valor entrada">${dinheiro(r.entradas_centavos)}</span>
              <span class="subtexto">Fretes confirmados</span>
            </div>
          </div>` : ''}
          <div class="card-kpi">
            <div class="icone-kpi vermelho">${icone('gasto')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">${admin ? 'Total Saídas' : 'Seus Gastos'}</span>
              <span class="valor saida">${dinheiro(r.saidas_centavos)}</span>
              <span class="subtexto">${r.qtd} ${r.qtd === 1 ? 'registro' : 'registros'}</span>
            </div>
          </div>
          ${admin ? `
          <div class="card-kpi">
            <div class="icone-kpi azul">${icone('saldo')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Saldo Líquido</span>
              <span class="valor ${saldo >= 0 ? 'entrada' : 'saida'}">
                ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
              </span>
              <span class="subtexto">${saldo >= 0 ? 'Resultado positivo' : 'Atenção aos custos'}</span>
            </div>
          </div>` : ''}
        </div>`;
    }

    caixaLista.innerHTML = `
      <div class="cartao" style="padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px 10px;border-bottom:1px solid var(--borda);color:var(--tinta-3);font-size:0.75rem;font-weight:700;letter-spacing:0.04em">
          <span>LANÇAMENTO & DETALHES</span>
          <span>VALOR (R$)</span>
        </div>
        <div class="lista" id="itens-container">
          ${itensCarregados.map((l) => itemLancamento(l)).join('')}
        </div>
      </div>`;
    ligaItens(caixaLista);
  };

  let debounceBusca;
  alvo.querySelector('#f-busca').oninput = (e) => {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(() => {
      estado.filtros.busca = e.target.value.trim();
      atualiza().catch((erro)=>recado(erro.message));
    }, 250);
  };

  // Single filter dialog opened by the filter button
  alvo.querySelector('#b-abrir-filtros').onclick = () => {
    let tipoTemp = admin ? estado.filtros.tipo || '' : '';

    const { elemento, fechar } = janela('Filtros de Lançamentos', `
      <div class="pilha">
        <div class="campo">
          <label for="dlg-f-mes">Mês de referência</label>
          <input id="dlg-f-mes" type="month" value="${estado.mes}">
        </div>

        <div class="campo">
          <label ${admin?'':'hidden'}>Tipo de lançamento</label>
          <div class="seletor-tipo-lancamento" role="group" aria-label="Filtrar por tipo" style="margin-bottom:0;${admin?'':'display:none'}">
            <button type="button" class="btn-tipo-toggle ${!tipoTemp ? 'ativo-saida' : ''}" data-dlg-tipo="">
              Todos
            </button>
            <button type="button" class="btn-tipo-toggle ${tipoTemp === 'entrada' ? 'ativo-entrada' : ''}" data-dlg-tipo="entrada">
              ${icone('receber')} Entradas
            </button>
            <button type="button" class="btn-tipo-toggle ${tipoTemp === 'saida' ? 'ativo-saida' : ''}" data-dlg-tipo="saida">
              ${icone('gasto')} Saídas
            </button>
          </div>
        </div>

        <div class="campo">
          <label for="dlg-f-categoria">Categoria</label>
          <select id="dlg-f-categoria">
            <option value="">Todas as categorias</option>
            ${[['saida', 'Saídas (Despesas)'], ['entrada', 'Entradas (Fretes)']].map(([tipo, grupo]) => {
              const lista = categoriasDoTipo(tipo);
              return lista.length ? `<optgroup label="${grupo}">${lista.map((c) => `
                <option value="${c.id}" ${String(estado.filtros.categoria_id) === String(c.id) ? 'selected' : ''}>
                  ${esc(c.nome)}
                </option>`).join('')}</optgroup>` : '';
            }).join('')}
          </select>
        </div>

        ${admin ? `
        <div class="linha duas">
          <div class="campo">
            <label for="dlg-f-motorista">Motorista</label>
            <select id="dlg-f-motorista">
              <option value="">Todos os motoristas</option>
              ${opcoesMotorista(estado.filtros.usuario_id)}
            </select>
          </div>
          <div class="campo">
            <label for="dlg-f-caminhao">Caminhão</label>
            <select id="dlg-f-caminhao">
              <option value="">Todos os caminhões</option>
              ${estado.caminhoes.map((c) => `
                <option value="${c.id}" ${String(estado.filtros.caminhao_id) === String(c.id) ? 'selected' : ''}>
                  ${esc(c.placa)}
                </option>`).join('')}
            </select>
          </div>
        </div>` : ''}

        <div class="acoes fim" style="margin-top:16px">
          <button class="btn" type="button" id="dlg-limpar-filtros">Limpar Tudo</button>
          <button class="btn principal" type="button" id="dlg-aplicar-filtros">Aplicar Filtros</button>
        </div>
      </div>`);

    elemento.querySelectorAll('[data-dlg-tipo]').forEach((btn) => {
      btn.onclick = () => {
        tipoTemp = btn.dataset.dlgTipo;
        const categoria=estado.categorias.find((c)=>String(c.id)===String(elemento.querySelector('#dlg-f-categoria').value));
        if(tipoTemp && categoria && categoria.tipo!==tipoTemp)elemento.querySelector('#dlg-f-categoria').value='';
        elemento.querySelectorAll('[data-dlg-tipo]').forEach((b) => {
          b.className = `btn-tipo-toggle ${b.dataset.dlgTipo === tipoTemp ? (tipoTemp === 'entrada' ? 'ativo-entrada' : 'ativo-saida') : ''}`;
        });
      };
    });

    elemento.querySelector('#dlg-limpar-filtros').onclick = () => {
      estado.mes = hoje().slice(0, 7);
      estado.filtros.tipo = '';
      estado.filtros.categoria_id = '';
      estado.filtros.caminhao_id = '';
      estado.filtros.usuario_id = '';
      fechar();
      atualiza();
    };

    elemento.querySelector('#dlg-aplicar-filtros').onclick = () => {
      estado.mes = elemento.querySelector('#dlg-f-mes').value || hoje().slice(0, 7);
      estado.filtros.tipo = tipoTemp;
      estado.filtros.categoria_id = elemento.querySelector('#dlg-f-categoria').value || '';
      if (admin) {
        estado.filtros.usuario_id = elemento.querySelector('#dlg-f-motorista').value || '';
        estado.filtros.caminhao_id = elemento.querySelector('#dlg-f-caminhao').value || '';
      }
      fechar();
      atualiza();
    };
  };

  alvo.querySelector('#b-novo-lancamento').onclick = () => {
    abreFormLancamento('saida', null, atualiza);
  };

  await atualiza();
}

async function abreLancamento(id, aoConcluir) {
  const l = await api('GET', 'lancamento', { id });
  const entrada = l.tipo === 'entrada';
  const linhas = [
    ['Tipo', l.categoria],
    [entrada ? 'Valor recebido' : 'Valor pago', dinheiro(l.valor_centavos)],
    ['Dia', dataCurta(l.data)],
    [entrada ? 'Lançado por' : 'Motorista', l.motorista],
    ['Caminhão', l.placa ? `${l.placa}${l.caminhao_apelido ? ` · ${l.caminhao_apelido}` : ''}` : '-'],
    ['Viagem', l.viagem_origem ? `${l.viagem_origem} → ${l.viagem_destino}` : 'Fora de viagem'],
    ['Litros', l.litros ? `${numero(l.litros)} L` : null],
    ['Preço por litro', l.litros ? dinheiro(l.valor_centavos / l.litros) : null],
    ['Km do painel', l.km ? numero(l.km) : null],
    ['Quem pagou', l.cliente],
    ['Frete a receber', l.recebivel_cliente
      ? `${l.recebivel_cliente}${l.recebivel_descricao ? ` · ${l.recebivel_descricao}` : ''}` : null],
    [entrada ? 'Cidade / local' : 'Onde foi', l.lugar],
    [entrada ? 'Como recebeu' : 'Como pagou', l.pagamento],
    ['Observação', l.observacao],
  ].filter(([, v]) => v);

  const { elemento, fechar } = janela(l.descricao || l.categoria, `
    <div class="cartao">
      <p style="margin:0 0 10px">
        <span class="etiqueta ${entrada ? 'aberta' : ''}">
          ${entrada ? 'Entrada' : 'Saída'}
        </span>
      </p>
      <table class="simples">
        ${linhas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
      ${l.comprovante ? `
        <p style="margin:14px 0 0">
          <a class="btn pequeno" href="${endereco('comprovante', { arquivo: l.comprovante })}"
             target="_blank" rel="noopener">Ver comprovante</a>
        </p>` : ''}
    </div>
    ${avisoPrazo(l)}
    ${(ehAdmin() || l.pode_alterar) && !l.offline ? `
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn perigo" type="button" data-excluir>Excluir</button>
        <button class="btn principal" type="button" data-editar>Editar</button>
      </div>` : ''}`);

  vigiaPrazo(elemento, l);
  const recarrega = async () => { if (aoConcluir) await aoConcluir(); else if (!document.querySelector('.janela')) await abreAba(estado.aba); };
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => {
    abreFormLancamento(l.tipo, l, recarrega);
  });
  elemento.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    const pagamentoDeDiarias = /^Diárias de /.test(l.descricao || '');
    if (!confirm(pagamentoDeDiarias
      ? 'Excluir este pagamento? As diárias pagas por ele voltam a ficar pendentes.'
      : 'Excluir este lançamento? Não dá para desfazer.')) return;
    try {
      await api('DELETE', 'lancamento', { id: l.id });
    } catch (erro) {
      recado(erro.message);
      return;
    }
    fechar();
    recado('Lançamento excluído.');
    if (ehAdmin()) await recarregaRecebiveisAbertos();
    await recarrega();
  });
}

function ajustaPainel(raiz) {
  raiz.querySelectorAll('table.dados').forEach((tabela) => {
    const titulos = [...tabela.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    tabela.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => { if (titulos[i]) td.dataset.rotulo = titulos[i]; });
    });
  });
  raiz.querySelectorAll('.grafico-meses').forEach((grafico) => {
    grafico.parentElement.scrollLeft = 0;
  });
}

function desenhaGraficoPorModo(r, varios, de, ate, modo = 'linha') {
  if (modo === 'pizza') {
    return desenhaGraficoPizza(r);
  } else if (modo === 'barras') {
    return desenhaGraficoBarras(r, varios, de);
  }
  return desenhaGraficoLinha(r, varios, de);
}

function serieGrafico(r,varios,de){
 if(varios)return r.meses.map(m=>({rotulo:mesCurto(m.mes),entrada:Number(m.entradas_centavos),saida:Number(m.saidas_centavos)}));
 const [ano,mes]=de.split('-').map(Number),dias=new Date(Date.UTC(ano,mes,0)).getUTCDate(),mapa=new Map(r.por_dia.map(d=>[Number(String(d.data).slice(8,10)),d]));
 const passo=window.innerWidth<600?7:1,serie=[];
 for(let dia=1;dia<=dias;dia+=passo){let entrada=0,saida=0;const fim=Math.min(dias,dia+passo-1);for(let i=dia;i<=fim;i++){entrada+=Number(mapa.get(i)?.entradas_centavos||0);saida+=Number(mapa.get(i)?.saidas_centavos||0);}serie.push({rotulo:passo===1?String(dia):`${dia}–${fim}`,entrada,saida});}return serie;
}
function graficoFluxo(r,varios,de,modo){
 const serie=serieGrafico(r,varios,de),maximo=Math.max(1,...serie.flatMap(d=>[d.entrada,d.saida]));
 if(!serie.some(d=>d.entrada||d.saida))return '<div class="vazio">Nenhuma movimentação neste período e filtros.</div>';
 const w=Math.max(320,Math.min(900,(document.getElementById('conteudo')?.clientWidth||700)-80)),h=270,l=58,t=18,b=40,largura=w-l-18,altura=h-t-b;
 const y=v=>t+altura-v/maximo*altura,x=i=>l+(i+.5)*largura/serie.length;
 const grade=[0,.25,.5,.75,1].map(f=>`<line x1="${l}" y1="${y(f*maximo)}" x2="${w-18}" y2="${y(f*maximo)}" stroke="#e2e8f0" stroke-dasharray="3 4"/><text x="${l-8}" y="${y(f*maximo)+4}" text-anchor="end" font-size="11" fill="#64748b">${esc(dinheiroCurto(f*maximo))}</text>`).join('');
 const salto=Math.max(1,Math.ceil(serie.length/6));
 const labels=serie.map((d,i)=>i%salto===0||i===serie.length-1?`<text x="${x(i)}" y="${h-15}" text-anchor="middle" font-size="11" fill="#64748b">${esc(d.rotulo)}</text>`:'').join('');
 const cores={entrada:'#059669',saida:'#e11d48'};
 const desenho=['entrada','saida'].map((tipo,k)=>{
  if(modo==='barras'){const barra=Math.min(25,largura/serie.length*.3);return serie.map((d,i)=>`<rect x="${x(i)+(k===0?-barra-1:1)}" y="${y(d[tipo])}" width="${barra}" height="${Math.max(0,t+altura-y(d[tipo]))}" rx="2" fill="${cores[tipo]}"><title>${esc(d.rotulo)} · ${tipo==='entrada'?'Entradas':'Saídas'}: ${dinheiro(d[tipo])}</title></rect>`).join('');}
  const pontos=serie.map((d,i)=>`${x(i)},${y(d[tipo])}`).join(' ');
  return `<polygon points="${x(0)},${t+altura} ${pontos} ${x(serie.length-1)},${t+altura}" fill="${cores[tipo]}" opacity=".06"/><polyline points="${pontos}" stroke="${cores[tipo]}" stroke-width="2.5" fill="none" stroke-linejoin="round"/>`+serie.map((d,i)=>d[tipo]?`<circle cx="${x(i)}" cy="${y(d[tipo])}" r="3.5" fill="white" stroke="${cores[tipo]}" stroke-width="2"><title>${esc(d.rotulo)} · ${tipo==='entrada'?'Entradas':'Saídas'}: ${dinheiro(d[tipo])}</title></circle>`:'').join('');
 }).join('');
 return `<div class="grafico-fluxo"><div class="grafico-legenda"><span class="legenda-entrada">● Entradas</span><span class="legenda-saida">● Saídas</span><small>Valores em R$ · ${varios?'Totais por mês':window.innerWidth<600?'Totais por semana do mês':'Totais por dia do mês'}</small></div><svg role="img" aria-label="${modo==='barras'?'Barras':'Linhas'} de entradas e saídas no período" viewBox="0 0 ${w} ${h}">${grade}${desenho}${labels}</svg><details class="grafico-dados"><summary>Consultar valores do gráfico</summary><div class="grafico-dados-lista">${serie.filter(d=>d.entrada||d.saida).map(d=>`<div><strong>${esc(d.rotulo)}</strong><span class="legenda-entrada">${dinheiro(d.entrada)}</span><span class="legenda-saida">${dinheiro(d.saida)}</span></div>`).join('')}</div></details></div>`;
}
function desenhaGraficoLinha(r,varios,de){return graficoFluxo(r,varios,de,'linha');}
function desenhaGraficoBarras(r,varios,de){return graficoFluxo(r,varios,de,'barras');}

function desenhaGraficoPizza(r) {
  const todasCats = r.saidas_por_categoria || [];
  const cats=todasCats.length>8?[...todasCats.slice(0,7),{nome:'Outras categorias',total_centavos:todasCats.slice(7).reduce((s,c)=>s+Number(c.total_centavos),0)}]:todasCats;
  const total = Number(r.atual.saidas_centavos) || 0;

  if (!cats.length || total <= 0) {
    return `
      <div class="vazio" style="padding:32px 16px">
        ${icone('pizzaGrafico')}
        <p style="margin-top:8px">Nenhum gasto categorizado no período para exibir o gráfico de pizza.</p>
      </div>`;
  }

  const CORES = ['#4338ca', '#0284c7', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
  let anguloAtual = 0;
  const cx = 110;
  const cy = 110;
  const rExt = 82;
  const rInt = 50;

  const fatiasSvg = cats.map((c, i) => {
    const val = Number(c.total_centavos) || 0;
    const pct = val / total;
    const sweep = pct * 360;
    const startAng = anguloAtual;
    const endAng = anguloAtual + sweep;
    anguloAtual = endAng;

    const toRad = (graus) => (graus - 90) * (Math.PI / 180);
    const x1 = cx + rExt * Math.cos(toRad(startAng));
    const y1 = cy + rExt * Math.sin(toRad(startAng));
    const x2 = cx + rExt * Math.cos(toRad(endAng));
    const y2 = cy + rExt * Math.sin(toRad(endAng));
    const x3 = cx + rInt * Math.cos(toRad(endAng));
    const y3 = cy + rInt * Math.sin(toRad(endAng));
    const x4 = cx + rInt * Math.cos(toRad(startAng));
    const y4 = cy + rInt * Math.sin(toRad(startAng));
    const largeArc = sweep > 180 ? 1 : 0;
    const cor = CORES[i % CORES.length];

    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rExt} ${rExt} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInt} ${rInt} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

    return `
      <path d="${d}" fill="${cor}">
        <title>${esc(c.nome)}: ${dinheiro(val)} (${(pct * 100).toFixed(1)}%)</title>
      </path>`;
  }).join('');

  return `
    <div class="layout-pizza">
      <div class="donut-svg-caixa">
        <svg viewBox="0 0 220 220" width="220" height="220" style="min-width:0">
          ${cats.length===1?`<circle cx="110" cy="110" r="66" fill="none" stroke="#4338ca" stroke-width="32"/>`:fatiasSvg}
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#94a3b8">TOTAL GASTOS</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="14" font-weight="800" fill="#0f172a">${dinheiroCurto(total)}</text>
        </svg>
      </div>

      <div class="tabela-pizza-legenda">
        ${cats.map((c, i) => {
          const val = Number(c.total_centavos) || 0;
          const pct = Math.round((val / total) * 100);
          const cor = CORES[i % CORES.length];
          return `
          <div class="item-pizza-legenda">
            <div style="display:flex;align-items:center">
              <span class="ponto-cor" style="background:${cor}"></span>
              <span class="nome">${esc(c.nome)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:0.75rem;font-weight:700;color:var(--tinta-3)">${pct}%</span>
              <span class="valor">${dinheiro(val)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function somaMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function periodoLongo(de, ate) {
  return de === ate ? mesLongo(de) : `${mesLongo(de)} até ${mesLongo(ate)}`;
}

function atalhosPeriodo() {
  const atual = hoje().slice(0, 7);
  return [
    { nome: 'Este mês', de: atual, ate: atual },
    { nome: 'Mês passado', de: somaMeses(atual, -1), ate: somaMeses(atual, -1) },
    { nome: 'Últimos 3 meses', de: somaMeses(atual, -2), ate: atual },
    { nome: 'Últimos 6 meses', de: somaMeses(atual, -5), ate: atual },
    { nome: 'Últimos 12 meses', de: somaMeses(atual, -11), ate: atual },
    { nome: 'Este ano', de: `${atual.slice(0, 4)}-01`, ate: atual },
  ];
}

function tabelaCaminhoes(lista) {
  return `
    <div class="tabela-rolagem">
      <table class="dados">
        <thead>
          <tr>
            <th>Caminhão</th><th>Entradas</th><th>Saídas</th><th>Saldo</th>
            <th>Combustível</th><th>Litros</th><th>R$/litro</th><th>Km</th><th>Km/litro</th>
          </tr>
        </thead>
        <tbody>
          ${lista.length ? lista.map((c) => {
            const litros = Number(c.litros);
            const km = Number(c.km_rodados);
            const precoLitro = litros > 0 ? Number(c.combustivel_centavos) / litros : null;
            return `
            <tr>
              <td><span class="badge-placa">${esc(c.placa)}</span>${c.apelido ? `<br><small style="color:var(--tinta-3)">${esc(c.apelido)}</small>` : ''}</td>
              <td>${dinheiro(c.entradas_centavos)}</td>
              <td>${dinheiro(c.saidas_centavos)}</td>
              <td class="${c.saldo_centavos >= 0 ? 'positivo' : 'negativo'}">
                ${c.saldo_centavos >= 0 ? '+' : '−'}${dinheiro(Math.abs(c.saldo_centavos))}
              </td>
              <td>${dinheiro(c.combustivel_centavos)}</td>
              <td>${litros ? numero(litros) : '-'}</td>
              <td>${precoLitro ? dinheiro(precoLitro) : '-'}</td>
              <td>${km ? numero(km) : '-'}</td>
              <td>${km && litros ? numero(km / litros) : '-'}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="9">Sem lançamentos neste período.</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="ajuda" style="margin:12px 0 0">
      Km e km/litro só aparecem quando as viagens têm o km de saída e de chegada preenchidos.
    </p>`;
}

function barras(itens, rotulo = (i) => esc(i.nome), tipo = 'saida') {
  if (!itens || !itens.length) {
    return `<div class="vazio" style="padding:16px 8px;font-size:0.875rem">Nenhum lançamento registrado neste período.</div>`;
  }
  const max = Math.max(...itens.map((i) => Number(i.total_centavos) || 0), 1);
  return `
    <div class="barras ${tipo}">
      ${itens.map((i) => {
        const val = Number(i.total_centavos) || 0;
        const pct = Math.max(3, Math.round((val / max) * 100));
        return `
        <div class="linha-barra">
          <div class="rotulo-barra">
            <span>${rotulo(i)} ${i.qtd ? `<span class="qtd">(${i.qtd}x)</span>` : ''}</span>
            <b>${dinheiro(val)}</b>
          </div>
          <div class="trilha">
            <div class="preenche" style="width:${pct}%"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function telaPanorama(alvo) {
  const atual = hoje().slice(0, 7);
  const periodo = { de: atual, ate: atual };
  const filtrosPanorama={usuario_id:"",caminhao_id:"",categoria_id:""},rotulosPanorama={};let geracaoPanorama=0;

  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%">
          <div>
            <h1>Panorama Financeiro & Operacional</h1>
            <p id="p-periodo"></p>
          </div>
          <div class="acoes" style="margin:0">
            <a class="btn pequeno" id="p-pdf" href="#" target="_blank">${icone('pdf')} Relatório PDF</a>
          </div>
        </div>
      </div>

      <div class="cartao painel-filtro-panorama-cartao">
        <div class="grade-filtro-panorama-limpo">
          <div class="campo campo-mes-de">
            <label for="p-de">Mês inicial</label>
            <input id="p-de" type="month" value="${periodo.de}">
          </div>
          <div class="campo campo-mes-ate">
            <label for="p-ate">Mês final</label>
            <input id="p-ate" type="month" value="${periodo.ate}">
          </div>
          <div class="campo acao-filtro-atalhos">
            <label class="rotulo-invisivel-alinhamento">&nbsp;</label>
            <button class="btn-icone-filtro-panorama" type="button" id="p-btn-atalhos" title="Filtros do Panorama" aria-label="Filtros do Panorama">
              ${icone('filtro')} <span>Filtros</span>
            </button>
          </div>
        </div>
      </div>

      <p class="ajuda" id="panorama-filtros-ativos"></p><div id="painel"><p class="carregando">Carregando indicadores da frota…</p></div>
    </div>`;

  const campoDe = alvo.querySelector('#p-de');
  const campoAte = alvo.querySelector('#p-ate');

  const atualiza = async () => {
    const geracao=++geracaoPanorama;const filtros=Object.fromEntries(Object.entries(filtrosPanorama).filter(([,v])=>v));
    if (periodo.de > periodo.ate) [periodo.de, periodo.ate] = [periodo.ate, periodo.de];
    campoDe.value = periodo.de;
    campoAte.value = periodo.ate;

    const painel = document.getElementById('painel');
    painel.innerHTML = '<p class="carregando">Carregando indicadores da frota…</p>';
    const { de, ate } = periodo;
    const varios = de !== ate;
    document.getElementById('p-periodo').textContent = periodoLongo(de, ate);
    document.getElementById('p-pdf').href = endereco('pdf-panorama', { de, ate,...filtros });

    let r;
    try {
      r = await api('GET', 'resumo', { de, ate,...filtros });
    } catch (erro) {
      painel.innerHTML = `<div class="aviso erro">${esc(erro.message)}</div>`;
      return;
    }
    if (geracao!==geracaoPanorama) return;
    alvo.querySelector("#panorama-filtros-ativos").textContent=Object.values(filtros).filter(Boolean).length ? Object.values(rotulosPanorama).filter(Boolean).join(" · ")+". Valores e PDF filtrados. Pendente: geral da frota. Km: viagens do motorista/caminhão." : "Todos os motoristas, caminhões e categorias.";

    const saldo = r.atual.saldo_centavos;
    const saldoAnterior = r.anterior.saldo_centavos;
    const diferenca = saldo - saldoAnterior;
    const periodoAnterior = periodoLongo(r.anterior_de, r.anterior_ate);
    const precoLitro = r.litros > 0 ? r.combustivel_centavos / r.litros : null;
    const comMovimento = r.meses.filter((m) => m.qtd > 0).length || 1;
    const margemLucro = r.atual.entradas_centavos > 0
      ? Math.round((saldo / r.atual.entradas_centavos) * 100)
      : null;

    const comparacaoTexto = r.anterior.qtd
      ? `${diferenca >= 0 ? '▲' : '▼'} <strong>${dinheiro(Math.abs(diferenca))}</strong> ${diferenca >= 0 ? 'superior' : 'inferior'} ao período anterior (${periodoAnterior})`
      : `Sem movimentações em ${periodoAnterior} para comparação direta.`;

    const pctCombustivel = r.atual.saidas_centavos > 0
      ? Math.round((r.combustivel_centavos / r.atual.saidas_centavos) * 100)
      : 0;

    painel.innerHTML = `
      <div class="pilha">
        <!-- Card Hero de Destaque Escuro (Estilo SaaS Executivo) -->
        <div class="card-hero-destaque">
          <div class="cabecalho-hero">
            <span class="subtitulo-hero">Resultado Líquido Operacional</span>
            ${margemLucro !== null ? `
              <span class="tag-hero ${margemLucro >= 0 ? 'positivo' : 'negativo'}">
                Margem: ${margemLucro}%
              </span>` : ''}
          </div>

          <div class="valor-hero ${saldo >= 0 ? 'positivo' : 'negativo'}">
            ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
          </div>

          <div class="variacao-hero">
            ${comparacaoTexto}
          </div>

          <div class="mini-grid-hero">
            <div class="item-mini-hero">
              <span class="rotulo">Receita Bruta (Fretes)</span>
              <span class="valor" style="color:#34d399">${dinheiro(r.atual.entradas_centavos)}</span>
            </div>
            <div class="item-mini-hero">
              <span class="rotulo">Custos & Gastos Totais</span>
              <span class="valor" style="color:#fb7185">${dinheiro(r.atual.saidas_centavos)}</span>
            </div>
            <div class="item-mini-hero clicavel" id="kpi-a-receber" role="button" tabindex="0" title="Ver fretes a receber">
              <span class="rotulo">A receber · geral da frota ›</span>
              <span class="valor" style="color:#fcd34d">${dinheiro(r.a_receber.a_receber_centavos)}</span>
              ${r.a_receber.vencido_centavos
                ? `<span class="rotulo" style="color:#fda4af">${dinheiro(r.a_receber.vencido_centavos)} vencido</span>` : ''}
            </div>
            <div class="item-mini-hero">
              <span class="rotulo">Total de Lançamentos</span>
              <span class="valor" style="color:#93c5fd">${r.atual.qtd}</span>
            </div>
            ${varios ? `
            <div class="item-mini-hero">
              <span class="rotulo">Média Mensal</span>
              <span class="valor">${dinheiro(Math.round(saldo / comMovimento))}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Grade de KPIs Secundários -->
        <div class="grade-kpis">
          <div class="card-kpi">
            <div class="icone-kpi verde">${icone('receber')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Fretes recebidos</span>
              <span class="valor entrada">${dinheiro(r.atual.entradas_centavos)}</span>
              <span class="subtexto">${r.viagens_abertas} ${r.viagens_abertas === 1 ? 'viagem em rota' : 'viagens em rota'}</span>
            </div>
          </div>

          <div class="card-kpi">
            <div class="icone-kpi vermelho">${icone('gasto')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Gastos Operacionais</span>
              <span class="valor saida">${dinheiro(r.atual.saidas_centavos)}</span>
              <span class="subtexto">${r.atual.qtd} lançamentos no período</span>
            </div>
          </div>

          <div class="card-kpi">
            <div class="icone-kpi amarelo">${icone('combustivel')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Combustível (Diesel)</span>
              <span class="valor">${dinheiro(r.combustivel_centavos)}</span>
              <span class="subtexto">${pctCombustivel}% das despesas totais</span>
            </div>
          </div>

          <div class="card-kpi">
            <div class="icone-kpi azul">${icone('caminhao')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Volume Abastecido</span>
              <span class="valor">${numero(r.litros)} L</span>
              <span class="subtexto">${precoLitro ? `${dinheiro(precoLitro)} por litro` : 'Sem abastecimentos'}</span>
            </div>
          </div>
        </div>

        <!-- Bloco de Gráficos com Alternador (Linha, Barras, Pizza) -->
        <div class="cartao painel-grafico" id="bloco-grafico-panorama">
          <div class="topo-grafico">
            <div>
              <h2 style="margin:0 0 4px">Entradas e saídas</h2>
              <p class="ajuda" style="margin:0 0 4px">Compare o fluxo financeiro ou consulte a composição das despesas.</p>
            </div>
            <div class="seletor-grafico" role="group" aria-label="Visualização do gráfico">
              <button type="button" data-modo-grafico="linha" aria-pressed="${estado.modoGrafico === 'linha'}">
                ${icone('linhaGrafico')} Linha
              </button>
              <button type="button" data-modo-grafico="barras" aria-pressed="${estado.modoGrafico === 'barras'}">
                ${icone('barrasGrafico')} Barras
              </button>
              <button type="button" data-modo-grafico="pizza" aria-pressed="${estado.modoGrafico === 'pizza'}">
                ${icone('pizzaGrafico')} Pizza
              </button>
            </div>
          </div>
          <div id="conteudo-grafico-ativo">
            ${desenhaGraficoPorModo(r, varios, de, ate, estado.modoGrafico)}
          </div>
        </div>

        ${varios ? `
          <div class="cartao">
            <h2 style="margin:0 0 4px">Detalhamento Mensal em Números</h2>
            <div class="tabela-rolagem" style="margin-top:12px">
              <table class="dados">
                <thead>
                  <tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo Líquido</th><th>Margem</th><th>Lanç.</th></tr>
                </thead>
                <tbody>
                  ${[...r.meses].reverse().map((m) => {
                    const mSaldo = Number(m.saldo_centavos);
                    const mMargem = Number(m.entradas_centavos) > 0 ? Math.round((mSaldo / Number(m.entradas_centavos)) * 100) : null;
                    return `
                    <tr${m.qtd ? '' : ' class="sem-movimento"'}>
                      <td><strong>${mesCurto(m.mes)}</strong></td>
                      <td>${dinheiro(m.entradas_centavos)}</td>
                      <td>${dinheiro(m.saidas_centavos)}</td>
                      <td class="${mSaldo >= 0 ? 'positivo' : 'negativo'}">
                        <strong>${mSaldo >= 0 ? '+' : '−'}${dinheiro(Math.abs(mSaldo))}</strong>
                      </td>
                      <td>${mMargem !== null ? `${mMargem}%` : '-'}</td>
                      <td>${m.qtd}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>` : ''}

        <div class="cartao">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px">
            <h2 style="margin:0">Performance por Caminhão</h2>
            <span class="badge-status encerrada">${r.por_caminhao.length} veículos avaliados</span>
          </div>
          ${tabelaCaminhoes(r.por_caminhao)}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:16px">
          <div class="cartao">
            <h2 style="margin:0 0 12px">Saídas por Categoria</h2>
            ${barras(r.saidas_por_categoria, (i) => esc(i.nome))}
          </div>

          <div class="cartao">
            <h2 style="margin:0 0 12px">Entradas por Frete</h2>
            ${barras(r.entradas_por_categoria, (i) => esc(i.nome), 'entrada')}
          </div>
        </div>

        <div class="cartao">
          <h2 style="margin:0 0 12px">Gastos por Motorista</h2>
          ${barras(r.por_motorista, (i) => esc(i.nome))}
        </div>
      </div>`;

    estado.observadorGrafico?.disconnect();
    const areaGrafico=painel.querySelector('#conteudo-grafico-ativo');let tamanhoGrafico='';
    if(window.ResizeObserver && areaGrafico){
      const observador=new ResizeObserver(()=>{
        if(!areaGrafico.isConnected){observador.disconnect();return;}
        const tamanho=areaGrafico.clientWidth+'|'+(window.innerWidth<600);
        if(tamanho===tamanhoGrafico)return;tamanhoGrafico=tamanho;
        areaGrafico.innerHTML=desenhaGraficoPorModo(r,varios,de,ate,estado.modoGrafico);
      });observador.observe(areaGrafico);estado.observadorGrafico=observador;
    }
    const kpiReceber = painel.querySelector('#kpi-a-receber');
    ajustaPainel(painel);
    kpiReceber.onclick = () => { estado.viagensSomentePendentes = true; abreAba('viagens'); };
    kpiReceber.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); estado.viagensSomentePendentes = true; abreAba('viagens'); } };

    // Connect Chart Switcher Buttons (Linha, Barras, Pizza)
    painel.querySelectorAll('[data-modo-grafico]').forEach((btn) => {
      btn.onclick = () => {
        estado.modoGrafico = btn.dataset.modoGrafico;
        painel.querySelectorAll('[data-modo-grafico]').forEach((b) => {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        const container = painel.querySelector('#conteudo-grafico-ativo');
        if (container) {
          container.innerHTML = desenhaGraficoPorModo(r, varios, de, ate, estado.modoGrafico);
        }
      };
    });
  };

  campoDe.onchange = () => {
    periodo.de = campoDe.value || atual;
    atualiza();
  };
  campoAte.onchange = () => {
    periodo.ate = campoAte.value || atual;
    atualiza();
  };
  const bAtalhos = alvo.querySelector('#p-btn-atalhos');
  if (bAtalhos) {
    bAtalhos.onclick = async () => {
      try {
        const [motoristas,caminhoes,categorias]=await Promise.all([api('GET','usuarios'),api('GET','caminhoes',{todos:1}),api('GET','categorias',{todos:1})]);
        const opcoes=(itens,valor,nome)=>itens.map(i=>`<option value="${esc(i.id)}" ${String(i.id)===String(valor)?'selected':''}>${esc(nome(i))}</option>`).join('');
        const atalhos=atalhosPeriodo();
        const {elemento,fechar}=janela('Filtros do Panorama',`<form class="form-pilha"><div class="linha duas"><div class="campo"><label for="pf-de">Mês inicial</label><input type="month" id="pf-de" name="de" value="${periodo.de}" required></div><div class="campo"><label for="pf-ate">Mês final</label><input type="month" id="pf-ate" name="ate" value="${periodo.ate}" required></div></div><div class="atalhos-panorama">${atalhos.map((a,i)=>`<button type="button" class="btn pequeno" data-atalho="${i}">${esc(a.nome)}</button>`).join('')}</div><div class="campo"><label for="pf-motorista">Motorista / responsável</label><select id="pf-motorista" name="usuario_id"><option value="">Todos</option>${opcoes(motoristas,filtrosPanorama.usuario_id,i=>i.nome)}</select></div><div class="campo"><label for="pf-caminhao">Caminhão</label><select id="pf-caminhao" name="caminhao_id"><option value="">Todos</option>${opcoes(caminhoes,filtrosPanorama.caminhao_id,i=>[i.placa,i.apelido].filter(Boolean).join(' · '))}</select></div><div class="campo"><label for="pf-categoria">Categoria</label><select id="pf-categoria" name="categoria_id"><option value="">Todas</option>${opcoes(categorias,filtrosPanorama.categoria_id,i=>(i.tipo==='entrada'?'Entrada: ':'Gasto: ')+i.nome)}</select></div><div class="acoes fim"><button type="button" class="btn" data-limpar>Limpar</button><button type="submit" class="btn principal">Aplicar filtros</button></div></form>`);
        const form=elemento.querySelector('form');
        form.querySelectorAll('[data-atalho]').forEach(b=>b.onclick=()=>{const a=atalhos[Number(b.dataset.atalho)];form.elements.de.value=a.de;form.elements.ate.value=a.ate;});
        form.querySelector('[data-limpar]').onclick=()=>{form.elements.de.value=atual;form.elements.ate.value=atual;['usuario_id','caminhao_id','categoria_id'].forEach(k=>form.elements[k].value='');};
        aoEnviar(form,async(dados)=>{periodo.de=dados.de;periodo.ate=dados.ate;for(const k of Object.keys(filtrosPanorama)){filtrosPanorama[k]=dados[k]||'';rotulosPanorama[k]=dados[k]?form.elements[k].selectedOptions[0].textContent:'';}fechar();await atualiza();});
      }catch(e){recado(e.message);}
    };
  }

  await atualiza();
}

async function excluiUsuario(u, aoConcluir) {
  if (u.papel === 'admin') {
    recado('Usuários administradores não podem ser removidos.');
    return;
  }
  if (u.id === estado.usuario?.id) {
    recado('Você não pode remover seu próprio usuário.');
    return;
  }
  if (!confirm(`Deseja realmente remover o motorista "${u.nome}" (@${u.usuario})?\n\nEsta ação excluirá o cadastro de acesso do motorista.`)) {
    return;
  }
  try {
    await api('DELETE', 'usuario', { id: u.id });
    recado(`Motorista "${u.nome}" removido.`);
    await aoConcluir?.();
  } catch (erro) {
    recado(erro.message);
  }
}

async function excluiCaminhao(c, aoConcluir) {
  if (!confirm(`Deseja realmente remover o caminhão com placa "${c.placa}"${c.apelido ? ` (${c.apelido})` : ''}?\n\nEsta ação não poderá ser desfeita.`)) {
    return;
  }
  try {
    await api('DELETE', 'caminhao', { id: c.id });
    recado(`Caminhão "${c.placa}" removido.`);
    await aoConcluir?.();
  } catch (erro) {
    recado(erro.message);
  }
}

function organizaPainelAjustes(alvo, admin) {
  const raiz=alvo.querySelector('.ajustes-organizados');
  if(!admin)return;
  const secoes=[['usuarios','Motoristas','usuario'],['caminhoes','Caminhões','caminhao'],['categorias','Categorias','lista'],['preferencias','Minha conta','ajustes']];
  const nav=document.createElement('div');nav.className='ajustes-navegacao';nav.setAttribute('role','group');nav.setAttribute('aria-label','Seções dos ajustes');
  nav.innerHTML=secoes.map(([id,nome,ico])=>`<button type="button" data-ajustes-painel="${id}" aria-pressed="false">${icone(ico)}${nome}</button>`).join('');
  const preferencia=document.createElement('div');preferencia.id='secao-preferencias';preferencia.className='pilha';
  for(const filho of [...raiz.children])if(!filho.classList.contains('titulo-secao') && !['secao-usuarios','secao-caminhoes','secao-categorias'].includes(filho.id))preferencia.append(filho);
  raiz.append(preferencia);raiz.querySelector('.titulo-secao').after(nav);
  const abrir=(id)=>{nav.querySelectorAll('button').forEach((b)=>b.setAttribute('aria-pressed',String(b.dataset.ajustesPainel===id)));secoes.forEach(([chave])=>{const painel=raiz.querySelector('#secao-'+chave);painel.classList.add('ajustes-painel');painel.hidden=chave!==id;});};
  nav.querySelectorAll('button').forEach((b)=>b.onclick=()=>abrir(b.dataset.ajustesPainel));abrir('usuarios');
}

async function telaAjustes(alvo) {
  const admin = ehAdmin();
  alvo.innerHTML = `
    <div class="pilha ajustes-organizados">
      <div class="titulo-secao">
        <div>
          <h1>${admin ? 'Ajustes' : 'Meu perfil'}</h1>
          <p>${admin ? 'Equipe, veículos, categorias e preferências em um só lugar.' : 'Suas preferências e informações de acesso.'}</p>
        </div>
      </div>

      ${admin ? `
        <!-- Motoristas e Acessos -->
        <div class="cartao" id="secao-usuarios">
          <div class="secao-card-topo">
            <div>
              <h2>Motoristas e Acessos</h2>
              <p class="ajuda" style="margin:2px 0 0">Cadastre e gerencie motoristas com acesso ao sistema.</p>
            </div>
            <button class="btn principal pequeno" type="button" id="b-usuario">
              ${icone('adicionar')} Novo Motorista
            </button>
          </div>
          <div class="lista-ajustes-entidades" id="lista-usuarios">
            <p class="carregando">Carregando motoristas…</p>
          </div>
        </div>

        <!-- Caminhões da Frota -->
        <div class="cartao" id="secao-caminhoes">
          <div class="secao-card-topo">
            <div>
              <h2>Caminhões da Frota</h2>
              <p class="ajuda" style="margin:2px 0 0">Veículos cadastrados para controle de fretes, gastos e médias.</p>
            </div>
            <button class="btn principal pequeno" type="button" id="b-caminhao">
              ${icone('adicionar')} Novo Caminhão
            </button>
          </div>
          <div class="lista-ajustes-entidades" id="lista-caminhoes">
            <p class="carregando">Carregando caminhões…</p>
          </div>
        </div>

        <!-- Categorias Financeiras -->
        <div class="cartao" id="secao-categorias">
          <div class="secao-card-topo">
            <div>
              <h2>Categorias Financeiras</h2>
              <p class="ajuda" style="margin:2px 0 0">Organize os tipos de despesas operacionais e fontes de receita.</p>
            </div>
            <button class="btn principal pequeno" type="button" id="b-categoria">
              ${icone('adicionar')} Nova Categoria
            </button>
          </div>

          <button type="button" class="btn-acordeon-categorias" id="b-toggle-categorias" aria-expanded="true">
            <div class="info-acordeon">
              <span class="icone-acordeon">${icone('lista')}</span>
              <span id="rotulo-acordeon-categorias">Categorias cadastradas</span>
            </div>
            <div class="seta-acordeon">
              <span class="texto-acao-acordeon" id="texto-estado-acordeon">Recolher</span>
              <span class="chevron-acordeon" id="icone-chevron-acordeon">▴</span>
            </div>
          </button>

          <div class="corpo-acordeon-categorias" id="conteudo-acordeon-categorias" style="margin-top:14px">
            <div class="filtro-pills-ajustes" role="group" aria-label="Filtrar categorias" id="filtro-categorias-ajustes">
              <button type="button" data-filtro-cat="todos" aria-pressed="true">Todas</button>
              <button type="button" data-filtro-cat="saida" aria-pressed="false">Gastos / Despesas</button>
              <button type="button" data-filtro-cat="entrada" aria-pressed="false">Entradas / Fretes</button>
            </div>

            <div id="lista-categorias">
              <p class="carregando">Carregando categorias…</p>
            </div>
          </div>
        </div>` : ''}

      <form class="cartao form-pilha" id="form-meu-caminhao"><div><h2>Meu caminhão padrão</h2><p class="ajuda">Ele fica selecionado nos novos formulários. Você pode escolher outro em cada registro.</p></div><div class="campo"><label for="meu-caminhao">Caminhão</label><select id="meu-caminhao" name="caminhao_padrao_id">${opcoesCaminhao(estado.usuario.caminhao_padrao_id).replace('Selecione o caminhão','Sem caminhão padrão')}</select></div><div class="acoes"><button type="submit" class="btn principal">${icone('check')} Salvar preferência</button></div></form>
      <!-- Alterar Senha -->
      <form class="cartao" novalidate id="form-alterar-senha">
        <h2>Segurança & Senha de Acesso</h2>
        <p class="ajuda">Mantenha sua conta protegida com uma senha segura e fácil de lembrar.</p>
        <div class="linha duas">
          <div class="campo">
            <label for="s-atual">Senha atual</label>
            ${campoSenha('s-atual', 'senha_atual', 'required autocomplete="current-password" placeholder="Digite sua senha atual"')}
          </div>
          <div class="campo">
            <label for="s-nova">Nova senha</label>
            ${campoSenha('s-nova', 'senha_nova', 'required autocomplete="new-password" placeholder="Digite a nova senha"')}
          </div>
        </div>
        <div class="acoes" style="margin-top:14px">
          <button class="btn principal" type="submit">${icone('check')} Atualizar Minha Senha</button>
        </div>
      </form>

      <div class="cartao">
        <div class="secao-card-topo" style="margin-bottom:0">
          <div>
            <h2>Primeiros passos</h2>
            <p class="ajuda" style="margin:2px 0 0">Refaça o tour guiado pelas principais funções do app.</p>
          </div>
          <button class="btn pequeno" type="button" id="b-tutorial">${icone('lista')} Fazer o tour</button>
        </div>
      </div>

      ${cartoesDoAparelho()}

      <div style="display:flex;justify-content:flex-end">
        <button class="btn perigo grande" type="button" id="b-sair">
          ${icone('fechar')} Encerrar Sessão e Sair
        </button>
      </div>
    </div>`;

  organizaPainelAjustes(alvo, admin);
  alvo.querySelector('#b-tutorial').onclick = abreTutorial;

  aoEnviar(alvo.querySelector('#form-meu-caminhao'),async (dados)=>{
    const r=await api('POST','meu-caminhao',{},dados);
    estado.usuario=r?.offline ? {...estado.usuario,caminhao_padrao_id:dados.caminhao_padrao_id || null} : r;
    await memorizaDados('eu',{},estado.usuario);
    recado(r?.offline ? GUARDADO_OFFLINE : 'Caminhão padrão atualizado.');
  });
  const formSenha = alvo.querySelector('#form-alterar-senha');
  if (formSenha) {
    aoEnviar(formSenha, async (dados) => {
      await api('POST', 'trocar-senha', {}, dados);
      formSenha.reset();
      recado('Senha atualizada com sucesso.');
    });
  }

  alvo.querySelector('#b-sair').onclick = () => saiDaConta();
  ligaCartoesDoAparelho(alvo);

  if (!admin) return;

  let filtroCategoriaAtivo = 'todos';

  const atualiza = async () => {
    const [usuarios, caminhoes, categorias] = await Promise.all([
      api('GET', 'usuarios'),
      api('GET', 'caminhoes', { todos: 1 }),
      api('GET', 'categorias', { todos: 1 }),
    ]);
    estado.usuarios = usuarios;
    estado.caminhoes = caminhoes.filter((c) => Number(c.ativo));
    estado.categorias = categorias.filter((c) => Number(c.ativo));

    // Render Users
    const containerUsuarios = document.getElementById('lista-usuarios');
    if (containerUsuarios) {
      if (!usuarios.length) {
        containerUsuarios.innerHTML = '<div class="vazio">Nenhum motorista cadastrado.</div>';
      } else {
        containerUsuarios.innerHTML = usuarios.map((u) => {
          const ehProprio = u.id === estado.usuario?.id;
          const isAdmin = u.papel === 'admin';
          return `
            <div class="item-ajustes-entidade ${Number(u.ativo) ? '' : 'inativo'}">
              <div style="display:flex;align-items:center;gap:12px;min-width:0">
                <div class="avatar-usuario-ajustes">${iniciais(u.nome)}</div>
                <div class="dados-entidade-ajustes">
                  <strong>${esc(u.nome)} ${ehProprio ? '<small style="color:var(--primaria)">(Você)</small>' : ''}</strong>
                  <small>@${esc(u.usuario)}${u.telefone ? ` • Tel. ${esc(u.telefone)}` : ''}${u.valor_diaria_centavos
                    ? ` • Diária ${dinheiro(u.valor_diaria_centavos)}` : ''}</small>
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                    <span class="badge-status ${isAdmin ? 'aberta' : 'encerrada'}">
                      ${isAdmin ? 'Proprietário' : 'Motorista'}
                    </span>
                    ${Number(u.ativo) ? '<span class="tag-status-visivel">Acesso Ativo</span>' : '<span class="tag-status-oculta">Bloqueado</span>'}
                  </div>
                </div>
              </div>
              <div class="acoes-entidade-ajustes">
                ${seloCadastro(u)}
                <button class="btn pequeno" type="button" data-editar-usuario="${u.id}">
                  ${icone('editar')} Editar
                </button>
                ${!isAdmin ? `
                  <button class="btn pequeno perigo" type="button" data-excluir-usuario="${u.id}" title="Remover motorista">
                    ${icone('lixeira')} Excluir
                  </button>` : ''}
              </div>
            </div>`;
        }).join('');
      }
    }

    // Render Trucks
    const containerCaminhoes = document.getElementById('lista-caminhoes');
    if (containerCaminhoes) {
      if (!caminhoes.length) {
        containerCaminhoes.innerHTML = '<div class="vazio">Nenhum caminhão cadastrado na frota.</div>';
      } else {
        containerCaminhoes.innerHTML = caminhoes.map((c) => `
          <div class="item-ajustes-entidade ${Number(c.ativo) ? '' : 'inativo'}">
            <div style="display:flex;align-items:center;gap:12px;min-width:0">
              <div class="avatar-caminhao-ajustes">${icone('caminhao')}</div>
              <div class="dados-entidade-ajustes">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="badge-placa">${esc(c.placa)}</span>
                  <strong>${esc(c.apelido || 'Sem apelido')}</strong>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                  ${Number(c.ativo) ? '<span class="tag-status-visivel">Em Operação</span>' : '<span class="tag-status-oculta">Inativo / Parado</span>'}
                </div>
              </div>
            </div>
            <div class="acoes-entidade-ajustes">
              ${seloCadastro(c)}
              <button class="btn pequeno" type="button" data-editar-caminhao="${c.id}">
                ${icone('editar')} Editar
              </button>
              <button class="btn pequeno perigo" type="button" data-excluir-caminhao="${c.id}" title="Remover caminhão">
                ${icone('lixeira')} Excluir
              </button>
            </div>
          </div>`).join('');
      }
    }

    // Render Categories
    const renderCategorias = () => {
      const containerCats = document.getElementById('lista-categorias');
      if (!containerCats) return;

      categorias.sort((a,b)=>a.tipo.localeCompare(b.tipo)||Number(b.ativo)-Number(a.ativo)||Number(a.ordem)-Number(b.ordem)||a.nome.localeCompare(b.nome));
      const filtradas = categorias.filter((c) => {
        if (filtroCategoriaAtivo === 'todos') return true;
        return c.tipo === filtroCategoriaAtivo;
      });

      if (!filtradas.length) {
        containerCats.innerHTML = '<div class="vazio" style="padding:24px 16px">Nenhuma categoria encontrada para este filtro.</div>';
        return;
      }

      containerCats.innerHTML = `
        <p class="ajuda">Arraste pela alça para ordenar. No celular, segure a alça; no teclado, use as setas. Gastos e entradas mantêm ordens independentes.</p><div class="grade-categorias-ajustes categorias-ordenaveis">
          ${filtradas.map((c,indice) => {
            const qtd = Number(c.qtd_lancamentos) || 0;
            const ehEntrada = c.tipo === 'entrada';
            return `
            ${indice===0||filtradas[indice-1].tipo!==c.tipo?`<h3 class="categoria-grupo-titulo">${c.tipo==='entrada'?'Entradas':'Gastos e despesas'} <small>${filtradas.filter(item=>item.tipo===c.tipo).length} categorias</small></h3>`:''}
            <div data-categoria-ordem="${esc(c.id)}" class="item-categoria-cartao ${Number(c.ativo) ? '' : 'inativa'}">
              <button class="alca-categoria" draggable="true" type="button" data-arrastar="${esc(c.id)}" aria-label="Ordenar ${esc(c.nome)}. Use as setas para mover.">⠿</button><div class="cabecalho-categoria-cartao">
                <div class="icone-categoria-caixa ${c.tipo}">
                  ${icone(ICONES_SVG[c.icone]?c.icone:ehEntrada?'receber':Number(c.pede_litros)?'combustivel':'tag')}
                </div>
                <div class="detalhes-categoria-cartao">
                  <strong>${esc(c.nome)}</strong>${seloCadastro(c)}
                  <div class="badges-categoria-linha">
                    <span class="tag-meta ${c.tipo}">
                      ${ehEntrada ? 'Receita / Frete' : 'Despesa'}
                    </span>
                    ${c.pede_litros ? `<span class="tag-meta combustivel">${icone('combustivel')} Pede Litros</span>` : ''}
                    ${c.pede_descricao ? `<span class="tag-meta">${icone('editar')} Pede Descrição</span>` : ''}
                    ${Number(c.oculta_motorista) ? `<span class="tag-meta">${icone('olhoOculto')} Só o escritório vê</span>` : ''}
                    <span class="tag-meta">
                      ${qtd ? `${qtd} ${qtd === 1 ? 'lançamento' : 'lançamentos'}` : 'Sem lançamentos'}
                    </span>
                    ${Number(c.ativo) ? '<span class="tag-status-visivel">Visível</span>' : '<span class="tag-status-oculta">Oculta</span>'}
                  </div>
                </div>
              </div>
              <div class="acoes-categoria-cartao">
                <button class="btn pequeno" type="button" data-editar-categoria="${c.id}">
                  ${icone('editar')} Editar
                </button>
                <button class="btn pequeno perigo" type="button" data-excluir-categoria="${c.id}" title="Excluir categoria">
                  ${icone('lixeira')} Excluir
                </button>
              </div>
            </div>`;
          }).join('')}
        </div>`;

      let movendo=null,ocupado=false;
      const mover=async(origem,destino)=>{
        if(ocupado||String(origem)===String(destino))return;
        if(categorias.some(c=>Fila.ehLocal(c.id))){recado('Sincronize as novas categorias antes de organizar a ordem.');return;}
        const item=categorias.find(c=>String(c.id)===String(origem)),alvo=categorias.find(c=>String(c.id)===String(destino));
        if(!item||!alvo||item.tipo!==alvo.tipo||Number(item.ativo)!==Number(alvo.ativo)){recado('Mova dentro do mesmo tipo e situação da categoria.');return;}
        const lista=categorias.filter(c=>c.tipo===item.tipo),de=lista.indexOf(item),ate=lista.indexOf(alvo);lista.splice(de,1);lista.splice(ate,0,item);
        ocupado=true;containerCats.setAttribute('aria-busy','true');
        try{await api('PUT','categorias-ordem',{}, {tipo:item.tipo,ids:lista.map(c=>c.id)});await atualiza();containerCats.querySelector('[data-arrastar="'+item.id+'"]')?.focus({preventScroll:true});recado('Ordem das categorias salva.');}catch(e){recado(e.message);}finally{ocupado=false;containerCats.removeAttribute('aria-busy');}
      };
      containerCats.querySelectorAll('[data-categoria-ordem]').forEach(card=>{
        card.ondragover=e=>{e.preventDefault();card.classList.add('categoria-destino');};card.ondragleave=()=>card.classList.remove('categoria-destino');
        card.ondrop=e=>{e.preventDefault();containerCats.querySelectorAll('.categoria-destino').forEach(c=>c.classList.remove('categoria-destino'));mover(movendo,card.dataset.categoriaOrdem);};
      });
      containerCats.querySelectorAll('[data-arrastar]').forEach(alca=>{
        alca.ondragstart=e=>{movendo=alca.dataset.arrastar;e.dataTransfer.setData('text/plain',movendo);e.dataTransfer.effectAllowed='move';};
        alca.ondragend=()=>containerCats.querySelectorAll('.categoria-destino').forEach(c=>c.classList.remove('categoria-destino'));
        alca.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const c=categorias.find(c=>String(c.id)===alca.dataset.arrastar),lista=categorias.filter(x=>x.tipo===c.tipo&&Number(x.ativo)===Number(c.ativo)),i=lista.indexOf(c),alvo=lista[i+(e.key==='ArrowUp'?-1:1)];if(alvo)mover(c.id,alvo.id);};
        let destino=null;
        alca.onpointerdown=e=>{if(e.pointerType==='mouse')return;e.preventDefault();movendo=alca.dataset.arrastar;destino=null;alca.setPointerCapture(e.pointerId);alca.classList.add('arrastando');};
        alca.onpointermove=e=>{if(!alca.hasPointerCapture(e.pointerId))return;if(e.clientY>window.innerHeight-100)window.scrollBy(0,20);else if(e.clientY<120)window.scrollBy(0,-20);containerCats.querySelectorAll('.categoria-destino').forEach(c=>c.classList.remove('categoria-destino'));const card=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-categoria-ordem]');if(card){destino=card.dataset.categoriaOrdem;card.classList.add('categoria-destino');}};
        alca.onpointerup=e=>{if(!alca.hasPointerCapture(e.pointerId))return;alca.releasePointerCapture(e.pointerId);alca.classList.remove('arrastando');containerCats.querySelectorAll('.categoria-destino').forEach(c=>c.classList.remove('categoria-destino'));if(destino)mover(movendo,destino);};
        alca.onpointercancel=()=>{alca.classList.remove('arrastando');containerCats.querySelectorAll('.categoria-destino').forEach(c=>c.classList.remove('categoria-destino'));};
      });
      containerCats.querySelectorAll('[data-editar-categoria]').forEach((b) => {
        const c = categorias.find((x) => String(x.id) === String(b.dataset.editarCategoria));
        b.onclick = () => formCategoria(c, atualiza);
      });
      containerCats.querySelectorAll('[data-excluir-categoria]').forEach((b) => {
        const c = categorias.find((x) => String(x.id) === String(b.dataset.excluirCategoria));
        b.onclick = () => excluiCategoria(c, atualiza);
      });
    };

    renderCategorias();

    const rotuloAcordeon = alvo.querySelector('#rotulo-acordeon-categorias');
    if (rotuloAcordeon) {
      rotuloAcordeon.textContent = `Categorias Cadastradas (${categorias.length})`;
    }

    const bToggle = alvo.querySelector('#b-toggle-categorias');
    const corpoCats = alvo.querySelector('#conteudo-acordeon-categorias');
    const txtEstado = alvo.querySelector('#texto-estado-acordeon');
    const chevron = alvo.querySelector('#icone-chevron-acordeon');
    if (bToggle && corpoCats) {
      bToggle.onclick = () => {
        const estaOculto = corpoCats.classList.contains('oculto');
        corpoCats.classList.toggle('oculto', !estaOculto);
        bToggle.setAttribute('aria-expanded', String(estaOculto));
        if (txtEstado) txtEstado.textContent = estaOculto ? 'Recolher' : 'Expandir';
        if (chevron) chevron.textContent = estaOculto ? '▴' : '▾';
      };
    }

    // Setup Category Filter Buttons
    const botoesFiltro = alvo.querySelectorAll('[data-filtro-cat]');
    botoesFiltro.forEach((b) => {
      b.onclick = () => {
        botoesFiltro.forEach((btn) => btn.setAttribute('aria-pressed', String(btn === b)));
        filtroCategoriaAtivo = b.dataset.filtroCat;
        renderCategorias();
      };
    });

    // Wire User actions
    alvo.querySelectorAll('[data-editar-usuario]').forEach((b) => {
      const u = usuarios.find((x) => String(x.id) === String(b.dataset.editarUsuario));
      b.onclick = () => formUsuario(u, atualiza);
    });
    alvo.querySelectorAll('[data-excluir-usuario]').forEach((b) => {
      const u = usuarios.find((x) => String(x.id) === String(b.dataset.excluirUsuario));
      b.onclick = () => excluiUsuario(u, atualiza);
    });

    // Wire Truck actions
    alvo.querySelectorAll('[data-editar-caminhao]').forEach((b) => {
      const c = caminhoes.find((x) => String(x.id) === String(b.dataset.editarCaminhao));
      b.onclick = () => formCaminhao(c, atualiza);
    });
    alvo.querySelectorAll('[data-excluir-caminhao]').forEach((b) => {
      const c = caminhoes.find((x) => String(x.id) === String(b.dataset.excluirCaminhao));
      b.onclick = () => excluiCaminhao(c, atualiza);
    });
  };

  alvo.querySelector('#b-usuario').onclick = () => formUsuario(null, atualiza);
  alvo.querySelector('#b-caminhao').onclick = () => formCaminhao(null, atualiza);
  alvo.querySelector('#b-categoria').onclick = () => formCategoria(null, atualiza);
  await atualiza();
}

function organizaCadastroMotorista(form) {
  const antes=[...form.children].find((el)=>el.matches('.acoes.fim'));
  for(const [titulo,ids] of [['Dados pessoais',['u-nome','u-telefone']],['Acesso ao sistema',['u-usuario','u-senha','u-papel','u-ativo']],['Rotina de trabalho',['u-diaria','u-caminhao']]]) {
    const bloco=document.createElement('fieldset');bloco.className='registro-secao cadastro-grade';
    const legenda=document.createElement('legend');legenda.textContent=titulo;bloco.append(legenda);
    ids.forEach((id)=>{const campo=form.querySelector('#'+id)?.closest('.campo');if(campo)bloco.append(campo);});
    form.insertBefore(bloco,antes);
  }
  form.querySelectorAll(':scope > .linha').forEach((linha)=>{if(!linha.children.length)linha.remove();});
}

function formUsuario(u, aoConcluir) {
  const novo = !u;
  const { elemento, fechar } = janela(novo ? 'Novo Motorista ou Acesso' : `Editar ${u.nome}`, `
    <form class="form-pilha form-cadastro-ajustes" novalidate>
      <div class="campo">
        <label for="u-nome">Nome completo ou apelido</label>
        <input id="u-nome" name="nome" required maxlength="80" value="${esc(u?.nome || '')}" placeholder="Ex.: Carlos Eduardo">
      </div>
      <div class="campo">
        <label for="u-usuario">Usuário para login</label>
        <p class="dica">Sem espaços e sem acento. Ex.: carloseduardo</p>
        <input id="u-usuario" name="usuario" ${novo ? 'required' : 'disabled'}
               autocapitalize="none" spellcheck="false" value="${esc(u?.usuario || '')}" placeholder="carloseduardo">
      </div>
      <div class="campo">
        <label for="u-senha">${novo ? 'Senha de acesso' : 'Nova senha'}</label>
        ${novo ? '' : '<p class="dica">Deixe em branco para manter a senha cadastrada.</p>'}
        ${campoSenha('u-senha', novo ? 'senha' : 'senha_nova',
          `${novo ? 'required' : ''} autocomplete="new-password" placeholder="${novo ? 'Mínimo de 4 dígitos' : 'Digite para redefinir'}"`)}
      </div>
      <div class="linha duas">
        <div class="campo">
          <label for="u-papel">Nível de acesso</label>
          <select id="u-papel" name="papel">
            <option value="motorista" ${u?.papel !== 'admin' ? 'selected' : ''}>
              Motorista (lança despesas e acompanha viagens)
            </option>
            <option value="admin" ${u?.papel === 'admin' ? 'selected' : ''}>
              Proprietário (vê relatórios e administra tudo)
            </option>
          </select>
        </div>
        <div class="campo opcional">
          <label for="u-telefone">Telefone / WhatsApp</label>
          <input id="u-telefone" name="telefone" type="tel" value="${esc(u?.telefone || '')}" placeholder="(00) 00000-0000">
        </div>
      </div>
      <div class="linha duas">
        <div class="campo opcional">
          <label for="u-diaria">Valor da diária</label>
          <p class="dica">Quanto o motorista recebe por dia trabalhado.</p>
          <div class="valor-caixa">
            <span aria-hidden="true">R$</span>
            <input id="u-diaria" name="valor_diaria" inputmode="decimal" placeholder="0,00"
                   value="${u?.valor_diaria_centavos ? esc((u.valor_diaria_centavos / 100).toFixed(2).replace('.', ',')) : ''}">
          </div>
        </div>
        <div class="campo opcional">
          <label for="u-caminhao">Caminhão padrão</label>
          <p class="dica">Já vem escolhido quando ele lança um gasto.</p>
          <select id="u-caminhao" name="caminhao_padrao_id">
            ${opcoesCaminhao(u?.caminhao_padrao_id).replace('Selecione o caminhão', 'Nenhum')}
          </select>
        </div>
      </div>
      ${novo ? '' : `
        <div class="campo">
          <label for="u-ativo">Situação do acesso</label>
          <select id="u-ativo" name="ativo">
            <option value="1" ${Number(u.ativo) ? 'selected' : ''}>Liberado (consegue entrar no sistema)</option>
            <option value="0" ${Number(u.ativo) ? '' : 'selected'}>Bloqueado (acesso temporariamente suspenso)</option>
          </select>
        </div>`}
      <div class="acoes fim">
        ${!novo && u?.papel !== 'admin' ? `
          <button class="btn perigo" type="button" data-remover-usuario style="margin-right:auto">
            ${icone('lixeira')} Excluir Motorista
          </button>` : ''}
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${icone('check')} Salvar</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  organizaCadastroMotorista(form);
  form.querySelector('[data-cancelar]').onclick = fechar;

  const btnRemover = form.querySelector('[data-remover-usuario]');
  if (btnRemover) {
    btnRemover.onclick = () => {
      fechar();
      excluiUsuario(u, aoConcluir);
    };
  }

  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    if (novo) await api('POST', 'usuarios', {}, dados);
    else await api('PUT', 'usuario', { id: u.id }, dados);
    fechar();
    recado('Usuário salvo com sucesso.');
    await aoConcluir?.();
  });
}

function formCaminhao(c, aoConcluir) {
  const novo = !c;
  const { elemento, fechar } = janela(novo ? 'Novo Caminhão' : `Editar Caminhão ${c.placa}`, `
    <form class="form-pilha form-cadastro-ajustes" novalidate>
      <div class="campo">
        <label for="t-placa">Placa do veículo</label>
        <input id="t-placa" name="placa" required maxlength="10" autocapitalize="characters"
               value="${esc(c?.placa || '')}" placeholder="Ex.: ABC1D23">
      </div>
      <div class="campo opcional">
        <label for="t-apelido">Apelido ou modelo do caminhão</label>
        <p class="dica">Ajuda o motorista e o gestor a reconhecer. Ex.: Scania R450 Vermelha</p>
        <input id="t-apelido" name="apelido" maxlength="60" value="${esc(c?.apelido || '')}" placeholder="Scania R450">
      </div>
      ${novo ? '' : `
        <div class="campo">
          <label for="t-ativo">Situação operacional</label>
          <select id="t-ativo" name="ativo">
            <option value="1" ${Number(c.ativo) ? 'selected' : ''}>Em uso ativo na frota</option>
            <option value="0" ${Number(c.ativo) ? '' : 'selected'}>Fora de operação / Inativo</option>
          </select>
        </div>`}
      <div class="acoes fim">
        ${!novo ? `
          <button class="btn perigo" type="button" data-remover-caminhao style="margin-right:auto">
            ${icone('lixeira')} Excluir Caminhão
          </button>` : ''}
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${icone('check')} Salvar</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;

  const btnRemover = form.querySelector('[data-remover-caminhao]');
  if (btnRemover) {
    btnRemover.onclick = () => {
      fechar();
      excluiCaminhao(c, aoConcluir);
    };
  }

  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    if (novo) await api('POST', 'caminhoes', {}, dados);
    else await api('PUT', 'caminhao', { id: c.id }, dados);
    fechar();
    recado('Caminhão salvo com sucesso.');
    await aoConcluir?.();
  });
}

const EXEMPLOS_CATEGORIA = {
  saida: 'Ex.: Combustível, Pedágio, Mecânica, Troca de Óleo, Pneus, Alimentação, Diária.',
  entrada: 'Ex.: Frete de Grãos, Frete de Madeira, Retorno de Carga, Aluguel de Carreta.',
};

function formCategoria(c, aoConcluir) {
  const novo = !c;
  const tipo = c?.tipo || 'saida';
  const travada = !novo && Number(c.qtd_lancamentos) > 0;
  const { elemento, fechar } = janela(novo ? 'Nova categoria' : `Editar categoria ${c.nome}`, `
    <form class="form-pilha form-categoria form-cadastro-ajustes" novalidate>
      ${novo?'<div class="categoria-modelos"><small>Começar com um modelo</small><div><button type="button" data-modelo="Combustível">Combustível</button><button type="button" data-modelo="Manutenção">Manutenção</button><button type="button" data-modelo="Pedágio">Pedágio</button><button type="button" data-modelo="Frete">Frete</button></div></div>':''}
      <div class="campo">
        <label>Tipo de movimentação</label>
        ${travada ? '<p class="dica">Já possui lançamentos associados, por isso o tipo não pode ser alterado.</p>' : ''}
        <div class="escolha" role="group">
          ${[['saida', 'Gasto / Despesa', 'Dinheiro que sai da frota'], ['entrada', 'Entrada / Frete', 'Dinheiro que entra na frota']].map(([v, nome, dica]) => `
            <button type="button" data-tipo="${v}" aria-pressed="${tipo === v}" ${travada ? 'disabled' : ''}>
              ${nome}<small>${dica}</small>
            </button>`).join('')}
        </div>
        <input type="hidden" name="tipo" value="${tipo}">
      </div>
      <div class="campo">
        <label for="k-nome">Nome da categoria</label>
        <p class="dica" data-exemplo>${EXEMPLOS_CATEGORIA[tipo]}</p>
        <input id="k-nome" name="nome" required maxlength="40" value="${esc(c?.nome || '')}" placeholder="Ex.: Manutenção Preventiva">
      </div>
      <div class="campo"><label for="k-icone">Ícone</label><select id="k-icone" name="icone">${[['tag','Etiqueta'],['combustivel','Combustível'],['caminhao','Caminhão'],['rota','Viagem'],['receber','Recebimento'],['nota','Documento'],['usuario','Equipe'],['ajustes','Serviço'],...[c?.icone && !['tag','combustivel','caminhao','rota','receber','nota','usuario','ajustes'].includes(c.icone)?[c.icone,'Ícone atual']:null].filter(Boolean)].map(([id,nome])=>`<option value="${esc(id)}" ${c?.icone===id?'selected':''}>${nome}</option>`).join('')}</select></div>
      <fieldset class="categoria-regras"><legend>Campos ao lançar</legend><label><input type="checkbox" name="pede_descricao" value="1" ${Number(c?.pede_descricao)?'checked':''}> Solicitar uma descrição</label><label><input type="checkbox" name="pede_litros" value="1" ${Number(c?.pede_litros)?'checked':''} ${travada||tipo==='entrada'?'disabled':''}> Registrar litros e quilometragem (gastos)</label>${travada?'<small>O controle de abastecimento é preservado porque a categoria já possui lançamentos.</small>':''}</fieldset>
      <div class="campo ${tipo === 'saida' ? '' : 'oculto'}" data-so-gasto>
        <label for="k-visivel">Visível aos motoristas?</label><select id="k-visivel" name="visivel_motorista"><option value="1" ${!Number(c?.oculta_motorista) ? 'selected' : ''}>Sim</option><option value="0" ${Number(c?.oculta_motorista) ? 'selected' : ''}>Não</option></select><small>Quando não estiver visível, apenas o proprietário poderá usar esta categoria.</small>
      </div>
      ${novo ? '' : `
        <div class="campo">
          <label for="k-ativo">Visibilidade ao lançar</label>
          <select id="k-ativo" name="ativo">
            <option value="1" ${Number(c.ativo) ? 'selected' : ''}>Visível (aparece no formulário de lançamentos)</option>
            <option value="0" ${Number(c.ativo) ? '' : 'selected'}>Oculta (não aparece para novos lançamentos, mantém histórico)</option>
          </select>
        </div>`}
      <div class="acoes fim">
        ${!novo ? `
          <button class="btn perigo" type="button" data-remover-categoria style="margin-right:auto">
            ${icone('lixeira')} Excluir Categoria
          </button>` : ''}
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${icone('check')} Salvar Categoria</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;

  const btnRemover = form.querySelector('[data-remover-categoria]');
  if (btnRemover) {
    btnRemover.onclick = () => {
      fechar();
      excluiCategoria(c, aoConcluir);
    };
  }

  form.querySelectorAll('[data-modelo]').forEach(b=>b.onclick=()=>{const nome=b.dataset.modelo;form.querySelector('[data-tipo="'+(nome==='Frete'?'entrada':'saida')+'"]').click();form.elements.nome.value=nome;form.elements.icone.value=nome==='Combustível'?'combustivel':nome==='Frete'?'receber':nome==='Manutenção'?'ajustes':'tag';form.elements.pede_litros.checked=nome==='Combustível';});
  form.querySelectorAll('[data-tipo]').forEach((b) => {
    b.onclick = () => {
      form.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      form.elements.tipo.value = b.dataset.tipo;
      form.querySelector('[data-exemplo]').textContent = EXEMPLOS_CATEGORIA[b.dataset.tipo];
      form.querySelector('[data-so-gasto]').classList.toggle('oculto', b.dataset.tipo !== 'saida');
      form.elements.pede_litros.disabled=travada||b.dataset.tipo==='entrada';if(b.dataset.tipo==='entrada')form.elements.pede_litros.checked=false;
    };
  });

  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    dados.oculta_motorista = dados.tipo === 'saida' && dados.visivel_motorista === '0';
    delete dados.visivel_motorista;
    dados.pede_descricao=dados.pede_descricao==='1';
    dados.pede_litros=travada?Boolean(Number(c.pede_litros)):dados.tipo==='saida' && dados.pede_litros==='1';
    if (novo) await api('POST', 'categorias', {}, dados);
    else await api('PUT', 'categoria', { id: c.id }, dados);
    fechar();
    recado('Categoria salva com sucesso.');
    await aoConcluir?.();
  });
}

async function excluiCategoria(c, aoConcluir) {
  const qtd = Number(c.qtd_lancamentos) || 0;
  if (qtd > 0) {
    const { elemento, fechar } = janela('Não é possível excluir', `
      <div class="aviso info">
        A categoria "${esc(c.nome)}" tem ${qtd} ${qtd === 1 ? 'lançamento' : 'lançamentos'}
        e não pode ser apagada sem perder esse histórico.
      </div>
      ${Number(c.ativo) ? `
        <p class="ajuda">Você pode escondê-la: ela some da hora de lançar, mas os lançamentos
        antigos continuam nos relatórios.</p>` : '<p class="ajuda">Ela já está escondida.</p>'}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>${Number(c.ativo) ? 'Cancelar' : 'Fechar'}</button>
        ${Number(c.ativo) ? '<button class="btn principal" type="button" data-esconder>Esconder categoria</button>' : ''}
      </div>`);
    elemento.querySelector('[data-cancelar]').onclick = fechar;
    elemento.querySelector('[data-esconder]')?.addEventListener('click', async () => {
      await api('PUT', 'categoria', { id: c.id }, { nome: c.nome, tipo: c.tipo, ativo: false });
      fechar();
      recado('Categoria escondida.');
      await aoConcluir?.();
    });
    return;
  }
  if (!confirm(`Excluir a categoria "${c.nome}"? Não dá para desfazer.`)) return;
  try {
    await api('DELETE', 'categoria', { id: c.id });
    recado('Categoria excluída.');
    await aoConcluir?.();
  } catch (erro) {
    recado(erro.message);
  }
}

// ---------------------------------------------------------------------------
// Utilidades das telas de fretes a receber, notas fiscais, diárias e receita
// ---------------------------------------------------------------------------

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function diaDaSemana(iso) {
  return DIAS_SEMANA[new Date(`${String(iso).slice(0, 10)}T12:00:00`).getDay()];
}

const valorParaCampo = (centavos) => (centavos ? (centavos / 100).toFixed(2).replace('.', ',') : '');

function opcoesPagamento(selecionado) {
  return `<option value="">Não informar</option>${PAGAMENTOS.map((p) => `
    <option value="${p}" ${selecionado === p ? 'selected' : ''}>${p}</option>`).join('')}`;
}

function rotuloViagem(v) {
  return `${localViagem(v.origem)} → ${localViagem(v.destino)}${v.inicio ? ` (saída ${dataDiaMes(v.inicio)})` : ''}`
    + `${ehAdmin() && v.motorista ? ` · ${v.motorista}` : ''}`;
}

function cartaoKpi(cor, ico, rotulo, valor, subtexto, classeValor = '') {
  return `
    <div class="card-kpi">
      <div class="icone-kpi ${cor}">${icone(ico)}</div>
      <div class="corpo-kpi">
        <span class="rotulo">${esc(rotulo)}</span>
        <span class="valor ${classeValor}">${valor}</span>
        <span class="subtexto">${subtexto}</span>
      </div>
    </div>`;
}

function aoTocar(raiz, seletor, acao) {
  raiz.querySelectorAll(seletor).forEach((el) => {
    el.onclick = () => acao(el);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); acao(el); }
    };
  });
}

// ---------------------------------------------------------------------------
// Fretes a receber (proprietário)
// ---------------------------------------------------------------------------

function seloSituacao(r) {
  if (r.situacao === 'recebido') return '<span class="badge-status aberta">Recebido</span>';
  if (r.vencido) {
    return `<span class="badge-status vencido">${r.situacao === 'parcial' ? 'Parte recebida · ' : ''}Vencido</span>`;
  }
  if (r.situacao === 'parcial') return '<span class="badge-status parcial">Recebido em parte</span>';
  return '<span class="badge-status pendente">A receber</span>';
}

function barraRecebido(r) {
  const pct = r.valor_centavos ? Math.min(100, Math.round((r.recebido_centavos / r.valor_centavos) * 100)) : 0;
  return `
    <div class="progresso-receber" title="${pct}% recebido">
      <div class="trilha"><div class="preenche" style="width:${pct}%"></div></div>
      <small>${pct}% recebido</small>
    </div>`;
}

async function telaReceber(alvo) {
  const filtro = { mes: hoje().slice(0, 7), status: 'abertos', busca: '' };
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%">
          <div>
            <h1>Fretes a receber</h1>
            <p>O que entrou no mês, o que os clientes ainda devem e quem pagou só uma parte.</p>
          </div>
          <button class="btn principal" type="button" id="b-novo-receber">${icone('adicionar')} Novo frete a receber</button>
        </div>
      </div>

      <div class="cartao" style="padding:14px 16px">
        <div class="barra-filtros-tela">
          <div class="campo campo-mes">
            <label for="r-mes">Mês do resumo</label>
            <input id="r-mes" type="month" value="${filtro.mes}">
          </div>
          <div class="campo">
            <label for="r-busca">Buscar</label>
            <input id="r-busca" type="search" placeholder="Cliente, descrição ou nº da nota">
          </div>
        </div>
        <div class="filtro-pills-ajustes" role="group" aria-label="Situação" style="margin:12px 0 0">
          <button type="button" data-status="abertos" aria-pressed="true">Em aberto</button>
          <button type="button" data-status="recebidos" aria-pressed="false">Recebidos</button>
          <button type="button" data-status="todos" aria-pressed="false">Todos</button>
        </div>
      </div>

      <div id="r-kpis"></div>
      <div id="r-lista"><p class="carregando">Carregando fretes…</p></div>
    </div>`;

  const atualiza = async () => {
    const caixa = alvo.querySelector('#r-lista');
    caixa.innerHTML = '<p class="carregando">Carregando fretes…</p>';
    const r = await api('GET', 'recebiveis', filtro);

    alvo.querySelector('#r-kpis').innerHTML = `
      <div class="grade-kpis">
        ${cartaoKpi('verde', 'receber', `Recebido em ${mesCurto(r.mes)}`, dinheiro(r.recebido_mes_centavos),
          `${dinheiro(r.recebido_cobrancas_mes_centavos)} veio de fretes a receber`, 'entrada')}
        ${cartaoKpi('azul', 'aReceber', 'Falta receber', dinheiro(r.a_receber_centavos),
          `${r.qtd_abertos} ${r.qtd_abertos === 1 ? 'frete em aberto' : 'fretes em aberto'}`)}
        ${cartaoKpi('vermelho', 'aviso', 'Vencido', dinheiro(r.vencido_centavos),
          r.vencido_centavos ? 'Passou do vencimento' : 'Nada vencido', r.vencido_centavos ? 'saida' : '')}
        ${cartaoKpi('amarelo', 'caminhao', `Fretes de ${mesCurto(r.mes)}`, dinheiro(r.faturado_mes_centavos),
          'Valor combinado dos fretes do mês')}
      </div>`;

    if (!r.itens.length) {
      caixa.innerHTML = `
        <div class="vazio">
          ${icone('aReceber')}
          <p style="margin-top:8px">${filtro.status === 'abertos'
            ? 'Nenhum frete em aberto. Quando fechar um frete com o cliente, registre aqui o valor combinado.'
            : 'Nenhum frete encontrado.'}</p>
        </div>`;
      return;
    }

    caixa.innerHTML = `
      <div class="lista-viagens">
        ${r.itens.map((x) => `
          <div class="card-viagem ${x.vencido ? 'vencido' : ''}" data-recebivel="${x.id}" role="button" tabindex="0">
            <div class="cabecalho-viagem">
              <div class="rota-viagem"><span class="ponto">${esc(x.cliente)}</span></div>
              ${seloSituacao(x)}
            </div>
            <div class="meta-viagem">
              <span>${esc(x.descricao || x.categoria)}</span>
              <span class="separador-ponto">·</span><span>${dataCurta(x.data)}</span>
              ${x.vencimento ? `<span class="separador-ponto">·</span><span>vence ${dataCurta(x.vencimento)}</span>` : ''}
              ${x.nota_fiscal_id ? `<span class="separador-ponto">·</span><span>NF ${esc(x.nota_numero || 's/ nº')}</span>` : ''}
              ${x.placa ? `<span class="separador-ponto">·</span><span class="badge-placa">${esc(x.placa)}</span>` : ''}
            </div>
            ${barraRecebido(x)}
            <div class="metricas-viagem">
              <div class="coluna-metrica">
                <div class="rotulo">Valor do frete</div>
                <div class="valor">${dinheiro(x.valor_centavos)}</div>
              </div>
              <div class="coluna-metrica">
                <div class="rotulo">Recebido</div>
                <div class="valor entrada">${dinheiro(x.recebido_centavos)}</div>
              </div>
              <div class="coluna-metrica">
                <div class="rotulo">Falta</div>
                <div class="valor ${x.restante_centavos ? 'saida' : ''}">${dinheiro(x.restante_centavos)}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
    aoTocar(caixa, '[data-recebivel]', (el) => abreRecebivel(Number(el.dataset.recebivel), atualiza));
  };

  alvo.querySelector('#r-mes').onchange = (e) => { filtro.mes = e.target.value || hoje().slice(0, 7); atualiza(); };
  let espera;
  alvo.querySelector('#r-busca').oninput = (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtro.busca = e.target.value.trim(); atualiza(); }, 250);
  };
  alvo.querySelectorAll('[data-status]').forEach((b) => {
    b.onclick = () => {
      alvo.querySelectorAll('[data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      filtro.status = b.dataset.status;
      atualiza();
    };
  });
  alvo.querySelector('#b-novo-receber').onclick = () => formRecebivel(null, atualiza);
  await atualiza();
}

async function abreRecebivel(id, aoConcluir) {
  const r = await api('GET', 'recebivel', { id });
  const linhas = [
    ['Tipo de frete', r.categoria],
    ['Descrição', r.descricao],
    ['Data do frete', dataCurta(r.data)],
    ['Vencimento', r.vencimento ? dataCurta(r.vencimento) : null],
    ['Viagem', r.viagem_origem ? `${r.viagem_origem} → ${r.viagem_destino}` : null],
    ['Caminhão', r.placa ? `${r.placa}${r.caminhao_apelido ? ` · ${r.caminhao_apelido}` : ''}` : null],
    ['Nota fiscal', r.nota_fiscal_id ? `NF ${r.nota_numero || 'sem número'}` : null],
    ['Último recebimento', r.ultimo_recebimento ? dataCurta(r.ultimo_recebimento) : null],
    ['Observação', r.observacao],
  ].filter(([, v]) => v);

  const { elemento, fechar } = janela(r.cliente, `
    <div class="cartao">
      <p style="margin:0 0 12px">${seloSituacao(r)}</p>
      <div class="grade">
        <div class="mini">
          <div class="rotulo">Valor do frete</div>
          <div class="numero">${dinheiro(r.valor_centavos)}</div>
        </div>
        <div class="mini">
          <div class="rotulo">Já recebido</div>
          <div class="numero entrada">${dinheiro(r.recebido_centavos)}</div>
          <small>${r.qtd_recebimentos} ${Number(r.qtd_recebimentos) === 1 ? 'pagamento' : 'pagamentos'}</small>
        </div>
        <div class="mini">
          <div class="rotulo">Falta receber</div>
          <div class="numero ${r.restante_centavos ? 'saida' : ''}">${dinheiro(r.restante_centavos)}</div>
        </div>
      </div>
      <div style="margin:14px 0">${barraRecebido(r)}</div>
      <table class="simples">
        ${linhas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
      ${r.nota_arquivo ? `
        <p style="margin:14px 0 0">
          <a class="btn pequeno" href="${endereco('comprovante', { arquivo: r.nota_arquivo })}" target="_blank" rel="noopener">
            ${icone('nota')} Ver nota fiscal
          </a>
        </p>` : ''}
    </div>
    <div class="cartao" style="margin-top:14px">
      <h2>Pagamentos recebidos</h2>
      ${r.recebimentos.length
        ? `<div class="lista">${r.recebimentos.map((l) => itemLancamento(l)).join('')}</div>`
        : '<p class="ajuda" style="margin:0">Nada recebido ainda.</p>'}
    </div>
    <div class="acoes fim" style="margin-top:16px">
      <button class="btn perigo" type="button" data-excluir>Excluir</button>
      <button class="btn" type="button" data-editar>Editar</button>
      ${r.restante_centavos > 0 ? `
        <button class="btn principal" type="button" data-receber>${icone('receber')} Registrar pagamento</button>` : ''}
    </div>`);

  ligaItens(elemento);
  elemento.querySelector('[data-editar]').onclick = () => { formRecebivel(r, aoConcluir); };
  elemento.querySelector('[data-receber]')?.addEventListener('click', () => { formRecebimento(r, aoConcluir); });
  elemento.querySelector('[data-excluir]').onclick = async () => {
    if (!confirm('Excluir este frete a receber? O que já foi recebido continua em Lançamentos como entrada.')) return;
    try {
      await api('DELETE', 'recebivel', { id: r.id });
    } catch (erro) {
      recado(erro.message);
      return;
    }
    fechar();
    recado('Frete a receber excluído.');
    await recarregaRecebiveisAbertos();
    await aoConcluir?.();
  };
}

// base: dados para já vir preenchido (ex.: criado a partir de uma nota fiscal).
async function formRecebivel(r, aoConcluir, base = {}) {
  const [notas, viagens] = await Promise.all([
    api('GET', 'notas', { sem_cobranca: 1, limite: 200 }),
    api('GET', 'viagens', { limite: 150 }),
  ]);
  const v = r || base;
  const notaAtual = v.nota_fiscal_id
    ? { id: v.nota_fiscal_id, numero: v.nota_numero, cliente: v.nota_cliente || null } : null;
  const listaNotas = comOExtra(notas, notaAtual);
  const tipos = categoriasDoTipo('entrada');

  const { elemento, fechar } = janela(r ? 'Editar frete a receber' : 'Novo frete a receber', `
    <form class="form-pilha" novalidate>
      <div class="campo">
        <label for="rb-cliente">Cliente</label>
        <p class="dica">Quem vai pagar o frete: empresa, cooperativa ou pessoa.</p>
        <input id="rb-cliente" name="cliente" required maxlength="90" value="${esc(v.cliente || '')}">
      </div>
      <div class="linha duas">
        <div class="campo">
          <label for="rb-categoria">Tipo de frete</label>
          <select id="rb-categoria" name="categoria_id" required>
            ${comOExtra(tipos, v.categoria_id ? { id: v.categoria_id, nome: v.categoria } : null).map((c) => `
              <option value="${c.id}" ${String(v.categoria_id) === String(c.id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="rb-valor">Valor combinado</label>
          <div class="valor-caixa">
            <span aria-hidden="true">R$</span>
            <input id="rb-valor" name="valor" inputmode="decimal" required placeholder="0,00"
                   value="${esc(valorParaCampo(v.valor_centavos))}">
          </div>
        </div>
      </div>
      <div class="campo opcional">
        <label for="rb-descricao">Descrição</label>
        <p class="dica">Ex.: 45 t de soja, Rondonópolis → Santos.</p>
        <input id="rb-descricao" name="descricao" maxlength="140" value="${esc(v.descricao || '')}">
      </div>
      <div class="linha duas">
        <div class="campo">
          <label for="rb-data">Data do frete</label>
          <input id="rb-data" name="data" type="date" required value="${esc(v.data || hoje())}">
        </div>
        <div class="campo opcional">
          <label for="rb-vencimento">Vencimento</label>
          <input id="rb-vencimento" name="vencimento" type="date" value="${esc(v.vencimento || '')}">
        </div>
      </div>
      <div class="linha duas">
        <div class="campo opcional">
          <label for="rb-viagem">Viagem</label>
          <select id="rb-viagem" name="viagem_id">
            <option value="">Sem viagem</option>
            ${viagens.map((x) => `
              <option value="${x.id}" ${String(v.viagem_id) === String(x.id) ? 'selected' : ''}>${esc(rotuloViagem(x))}</option>`).join('')}
          </select>
        </div>
        <div class="campo opcional">
          <label for="rb-caminhao">Caminhão</label>
          <select id="rb-caminhao" name="caminhao_id">
            ${opcoesCaminhao(v.caminhao_id, v.placa ? { id: v.caminhao_id, placa: v.placa, apelido: v.caminhao_apelido } : null)
              .replace('Selecione o caminhão', 'Sem caminhão')}
          </select>
        </div>
      </div>
      <div class="campo opcional">
        <label for="rb-nota">Nota fiscal</label>
        <p class="dica">Notas enviadas pela equipe que ainda não estão em outro frete.</p>
        <select id="rb-nota" name="nota_fiscal_id">
          <option value="">Sem nota</option>
          ${listaNotas.map((n) => `
            <option value="${n.id}" ${String(v.nota_fiscal_id) === String(n.id) ? 'selected' : ''}>
              NF ${esc(n.numero || 'sem número')}${(n.cliente_atual || n.cliente) ? ` · ${esc(n.cliente_atual || n.cliente)}` : ''}${n.data ? ` (${dataCurta(n.data)})` : ''}
            </option>`).join('')}
        </select>
      </div>
      <div class="campo opcional">
        <label for="rb-obs">Observação</label>
        <textarea id="rb-obs" name="observacao" maxlength="500">${esc(v.observacao || '')}</textarea>
      </div>
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${r ? 'Salvar alterações' : 'Salvar frete'}</button>
      </div>
    </form>`);

  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  form.elements.valor.addEventListener('blur', () => {
    const n = Number(String(form.elements.valor.value).replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) form.elements.valor.value = n.toFixed(2).replace('.', ',');
  });
  // Escolher a nota preenche o que estiver em branco.
  form.elements.nota_fiscal_id.onchange = () => {
    const n = notas.find((x) => String(x.id) === String(form.elements.nota_fiscal_id.value));
    if (!n) return;
    if (!form.elements.cliente.value && n.cliente) form.elements.cliente.value = n.cliente;
    if (!form.elements.valor.value && n.valor_centavos) form.elements.valor.value = valorParaCampo(n.valor_centavos);
    if (!form.elements.viagem_id.value && n.viagem_id) form.elements.viagem_id.value = n.viagem_id;
    if (!form.elements.caminhao_id.value && n.caminhao_id) form.elements.caminhao_id.value = n.caminhao_id;
  };

  aoEnviar(form, async (dados) => {
    if (!dados.cliente?.trim()) throw new Error('Informe o cliente.');
    if (!String(dados.valor || '').trim()) throw new Error('Informe o valor combinado do frete.');
    if (r) await api('PUT', 'recebivel', { id: r.id }, dados);
    else await api('POST', 'recebiveis', {}, dados);
    fechar();
    recado(r ? 'Frete a receber atualizado.' : 'Frete a receber registrado.');
    await recarregaRecebiveisAbertos();
    await aoConcluir?.();
  });
}

function formRecebimento(r, aoConcluir) {
  const { elemento, fechar } = janela(`Pagamento - ${r.cliente}`, `
    <form class="form-pilha" novalidate>
      <p class="aviso info" style="margin:0">
        Falta receber <strong>${dinheiro(r.restante_centavos)}</strong> de ${dinheiro(r.valor_centavos)}.
      </p>
      <div class="linha duas">
        <div class="campo">
          <label for="rc-valor">Valor recebido</label>
          <div class="valor-caixa">
            <span aria-hidden="true">R$</span>
            <input id="rc-valor" name="valor" inputmode="decimal" required value="${esc(valorParaCampo(r.restante_centavos))}">
          </div>
          <p class="dica">Se o cliente pagou só uma parte, digite só o que entrou.</p>
        </div>
        <div class="campo">
          <label for="rc-data">Dia do recebimento</label>
          <input id="rc-data" name="data" type="date" required value="${hoje()}">
        </div>
      </div>
      <div class="campo opcional">
        <label for="rc-pagamento">Como recebeu</label>
        <select id="rc-pagamento" name="pagamento">${opcoesPagamento('')}</select>
      </div>
      <div class="campo opcional">
        <label for="rc-obs">Observação</label>
        <textarea id="rc-obs" name="observacao" maxlength="500"></textarea>
      </div>
      ${campoArquivo('rc-arquivo', 'Comprovante', 'Foto ou PDF do Pix, depósito ou boleto pago.', 'comprovante', '')}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">Registrar pagamento</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  ligaArquivo(form, 'rc-arquivo', 'comprovante', 'Nenhum arquivo escolhido');
  aoEnviar(form, async (dados) => {
    const atualizado = await api('POST', 'recebivel-receber', { id: r.id }, dados);
    fechar();
    recado(atualizado.situacao === 'recebido'
      ? 'Frete quitado! Tudo recebido.'
      : `Pagamento registrado. Ainda falta ${dinheiro(atualizado.restante_centavos)}.`);
    await recarregaRecebiveisAbertos();
    await aoConcluir?.();
  });
}

// ---------------------------------------------------------------------------
// Notas fiscais dos clientes (proprietário e motoristas)
// ---------------------------------------------------------------------------

const ehPdf = (arquivo) => /\.pdf$/i.test(String(arquivo || ''));

function itemNota(n) {
  const meta = [
    `<span>Emissão ${dataCurta(n.data)}</span>`,
    n.viagem_inicio ? `<span>Viagem ${dataCurta(n.viagem_inicio)}${n.viagem_fim ? ` a ${dataCurta(n.viagem_fim)}` : ''}</span>` : '',
    n.viagem_origem ? `<span>${esc(n.viagem_origem)} → ${esc(n.viagem_destino)}</span>` : '',
    ehAdmin() || Number(n.usuario_id) !== Number(estado.usuario.id) ? `<span>enviada por ${esc(n.enviado_por)}</span>` : '',
  ].filter(Boolean).join('<span class="separador-ponto">·</span>');
  return `
    <div class="item-lancamento-moderno" data-nota="${n.id}" role="button" tabindex="0">
      <div class="icone-lancamento nota">${icone(ehPdf(n.arquivo) ? 'pdf' : 'nota')}</div>
      <div class="info-lancamento">
        <div class="topo-lancamento">
          <span class="nome-lancamento">NF ${esc(n.numero || 'sem número')}${(n.cliente_atual || n.cliente) ? ` · ${esc(n.cliente_atual || n.cliente)}` : ''}</span>
          ${n.placa ? `<span class="badge-placa">${esc(n.placa)}</span>` : ''}
          ${seloPrazo(n)}

        </div>
        <div class="meta-lancamento">${meta}</div>
      </div>
      <div class="valor-lancamento">
        ${n.valor_centavos != null ? `<span class="quantia">${dinheiro(n.valor_centavos)}</span>` : ''}
        ${seloCadastro(n)}
        <span class="seta-acao">${icone('setaDireita')}</span>
      </div>
    </div>`;
}

async function telaNotas(alvo) {
  const admin = ehAdmin();
  const filtro = { mes: '', busca: '', usuario_id: '', limite: 300 };
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%">
          <div>
            <h1>Notas fiscais</h1>
            <p>${admin
              ? 'Notas dos clientes enviadas por você e pelos motoristas, em foto ou PDF.'
              : 'Envie a foto ou o PDF da nota fiscal do cliente. O escritório recebe na hora.'}</p>
          </div>
          <button class="btn principal" type="button" id="b-nova-nota">${icone('adicionar')} Enviar nota fiscal</button>
        </div>
      </div>

      <div class="cartao" style="padding:14px 16px">
        <div class="barra-filtros-tela">
          <div class="campo campo-mes">
            <label for="n-mes">Mês de emissão</label>
            <input id="n-mes" type="month">
          </div>
          ${admin ? `
            <div class="campo">
              <label for="n-usuario">Enviada por</label>
              <select id="n-usuario">
                <option value="">Todos</option>
                ${opcoesMotorista('')}
              </select>
            </div>` : ''}
          <div class="campo">
            <label for="n-busca">Buscar</label>
            <input id="n-busca" type="search" placeholder="Número, cliente ou observação">
          </div>
        </div>
      </div>

      <div id="n-lista"><p class="carregando">Carregando notas…</p></div>
    </div>`;

  const atualiza = async () => {
    const caixa = alvo.querySelector('#n-lista');
    caixa.innerHTML = '<p class="carregando">Carregando notas…</p>';
    const notas = await api('GET', 'notas', filtro);
    if (!notas.length) {
      caixa.innerHTML = `
        <div class="vazio">
          ${icone('nota')}
          <p style="margin-top:8px">${filtro.mes || filtro.busca || filtro.usuario_id
            ? 'Nenhuma nota encontrada com esses filtros.'
            : 'Nenhuma nota fiscal enviada ainda. Toque em "Enviar nota fiscal" para mandar a primeira.'}</p>
        </div>`;
      return;
    }
    caixa.innerHTML = `
      <div class="cartao" style="padding:12px 14px">
        <div class="lista">${notas.map(itemNota).join('')}</div>
      </div>`;
    aoTocar(caixa, '[data-nota]', (el) => {
      abreNota(notas.find((n) => String(n.id) === String(el.dataset.nota)), atualiza);
    });
  };

  alvo.querySelector('#n-mes').onchange = (e) => { filtro.mes = e.target.value; atualiza(); };
  alvo.querySelector('#n-usuario')?.addEventListener('change', (e) => { filtro.usuario_id = e.target.value; atualiza(); });
  let espera;
  alvo.querySelector('#n-busca').oninput = (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtro.busca = e.target.value.trim(); atualiza(); }, 250);
  };
  alvo.querySelector('#b-nova-nota').onclick = () => formNota(null, atualiza);
  await atualiza();
}

async function abreNota(n, aoConcluir) {
  const local = Fila.ehLocal(n.arquivo) ? await Fila.arquivo(n.arquivo) : null;
  const url = local ? URL.createObjectURL(local.blob) : endereco('comprovante', { arquivo: n.arquivo });
  const pdf = ehPdf(local?.nome || n.arquivo);
  const linhas = [
    ['Número', n.numero || 'Sem número'],
    ['Cliente', n.cliente_atual || n.cliente],
    ['Período da viagem', n.viagem_inicio ? `${dataCurta(n.viagem_inicio)}${n.viagem_fim ? ` a ${dataCurta(n.viagem_fim)}` : ''}` : null],
    ['Emissão', dataCurta(n.data)],
    ['Valor', n.valor_centavos != null ? dinheiro(n.valor_centavos) : null],
    ['Viagem', n.viagem_origem ? `${n.viagem_origem} → ${n.viagem_destino}` : null],
    ['Caminhão', n.placa ? `${n.placa}${n.caminhao_apelido ? ` · ${n.caminhao_apelido}` : ''}` : null],
    ['Enviada por', n.enviado_por],
    ['Observação', n.observacao],
  ].filter(([, v]) => v);

  const { elemento, fechar } = janela(`NF ${n.numero || 'sem número'}`, `
    <div class="cartao">
      ${pdf ? '' : `
        <a class="previa-nota" href="${url}" target="_blank" rel="noopener" title="Abrir a foto inteira">
          <img src="${url}" alt="Foto da nota fiscal">
        </a>`}
      <table class="simples">
        ${linhas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
      <p style="margin:14px 0 0">
        <a class="btn pequeno" href="${url}" target="_blank" rel="noopener">
          ${icone(pdf ? 'pdf' : 'olho')} ${pdf ? 'Abrir PDF' : 'Abrir foto'}
        </a>
      </p>
    </div>
    ${avisoPrazo(n)}
    <div class="acoes fim" style="margin-top:16px">
      ${n.pode_alterar ? `
        <button class="btn perigo" type="button" data-excluir>Excluir</button>
        <button class="btn" type="button" data-editar>Editar</button>` : ''}
      ${n.viagem_id ? '<button class="btn principal" type="button" data-ver-viagem>Ver viagem</button>' : ''}
    </div>`);

  if(local) elemento.closest('.janela').addEventListener('janela-fechada',()=>URL.revokeObjectURL(url),{once:true});
  vigiaPrazo(elemento, n);
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => { formNota(n, aoConcluir); });
  elemento.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta nota fiscal? O arquivo também é apagado.')) return;
    try {
      await api('DELETE', 'nota', { id: n.id });
    } catch (erro) {
      recado(erro.message);
      return;
    }
    fechar();
    recado('Nota fiscal excluída.');
    await aoConcluir?.();
  });
  elemento.querySelector('[data-ver-viagem]')?.addEventListener('click', async () => {
    try {
      const viagens = await api('GET', 'viagens', { id: n.viagem_id });
      const v = viagens.find((v) => String(v.id) === String(n.viagem_id));
      if (!v) throw new Error('Viagem não encontrada.');
      abreViagem(v, aoConcluir);
    } catch (e) { recado(e.message); }
  });
}

// base: valores iniciais de uma nota nova (ex.: arquivo recebido pelo "Compartilhar").
function formNota(n, aoConcluir, base = {}) {
  const v = n || { data:hoje(),caminhao_id:estado.usuario.caminhao_padrao_id,...base };
  const {elemento,fechar}=janela(n ? 'Editar nota fiscal':'Anexar nota fiscal',`<form class="form-pilha form-nota-simples" novalidate>
    ${campoArquivo('nf-arquivo','Foto ou PDF da nota','', 'arquivo',v.arquivo,n ? 'Manter arquivo atual':'Selecionar nota')}
    <div class="campo"><label for="nf-numero">Número da nota (opcional)</label><input id="nf-numero" name="numero" maxlength="40" value="${esc(v.numero || '')}" placeholder="Número impresso na nota"></div>
    <div class="acoes fim"><button class="btn" type="button" data-cancelar>Cancelar</button><button class="btn principal" type="submit">${n ? 'Salvar alterações':'Anexar nota'}</button></div></form>`);
  const form=elemento.querySelector('form');form.querySelector('[data-cancelar]').onclick=fechar;
  ligaArquivo(form,'nf-arquivo','arquivo',n ? 'Manter arquivo atual':'Selecionar nota');
  aoEnviar(form,async (dados)=>{
    if(!dados.arquivo) throw new Error('Escolha a foto ou o PDF da nota.');
    const contexto={...dados,data:v.data || hoje(),cliente:v.cliente || '',viagem_id:v.viagem_id || '',caminhao_id:v.caminhao_id || '',valor:v.valor_centavos == null ? '' : valorParaCampo(v.valor_centavos),observacao:v.observacao || ''};
    const r=n ? await api('PUT','nota',{id:n.id},contexto) : await api('POST','notas',{},contexto);
    fechar();recado(r?.offline ? GUARDADO_OFFLINE:'Nota fiscal salva.');await aoConcluir?.();
  });
}

// ---------------------------------------------------------------------------
// Diárias dos motoristas
// ---------------------------------------------------------------------------

const motoristasAtivos = () => estado.usuarios.filter((u) => Number(u.ativo) && u.papel === 'motorista');

function itemDiaria(d) {
  const meta = [
    ehAdmin() ? `<span>${esc(d.motorista)}</span>` : '',
    d.viagem_origem ? `<span>${esc(d.viagem_origem)} → ${esc(d.viagem_destino)}</span>` : '',
    d.observacao ? `<span>${esc(d.observacao)}</span>` : '',
  ].filter(Boolean).join('<span class="separador-ponto">·</span>');
  return `
    <div class="item-lancamento-moderno" data-diaria="${d.id}" role="button" tabindex="0">
      <div class="icone-lancamento diaria">${icone('calendario')}</div>
      <div class="info-lancamento">
        <div class="topo-lancamento">
          <span class="nome-lancamento">${diaDaSemana(d.data)}, ${dataCurta(d.data)}</span>
          ${d.pago ? '<span class="tag-status-visivel">Paga</span>' : '<span class="tag-status-pendente">A pagar</span>'}
          ${seloPrazo(d)}
        </div>
        ${meta ? `<div class="meta-lancamento">${meta}</div>` : ''}
      </div>
      <div class="valor-lancamento">
        <span class="quantia">${Number(d.valor_centavos) ? dinheiro(d.valor_centavos) : '<small>sem valor</small>'}</span>${seloCadastro(d)}
        <span class="seta-acao">${icone('setaDireita')}</span>
      </div>
    </div>`;
}

function abreDiaria(d, aoConcluir) {
  const linhas = [
    ['Motorista', ehAdmin() ? d.motorista : null],
    ['Dia', `${diaDaSemana(d.data)}, ${dataCurta(d.data)}`],
    ['Valor', Number(d.valor_centavos) ? dinheiro(d.valor_centavos) : 'Sem valor definido'],
    ['Viagem', d.viagem_origem ? `${d.viagem_origem} → ${d.viagem_destino}` : 'Fora de viagem'],
    ['Situação', d.pago ? `Paga${d.pago_em ? ` em ${dataCurta(d.pago_em)}` : ''}` : 'A pagar'],
    ['Observação', d.observacao],
  ].filter(([, v]) => v);
  const { elemento, fechar } = janela('Diária', `
    <div class="cartao">
      <table class="simples">
        ${linhas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
    </div>
    ${d.pago
      ? `<p class="aviso ok" style="margin-top:14px">Esta diária já foi paga.${ehAdmin()
        ? ' Para mudar, exclua antes o pagamento em Lançamentos; as diárias voltam a ficar pendentes.' : ''}</p>`
      : avisoPrazo(d)}
    ${d.pode_alterar ? `
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn perigo" type="button" data-excluir>Excluir</button>
        <button class="btn principal" type="button" data-editar>Editar</button>
      </div>` : ''}`);
  vigiaPrazo(elemento, d);
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => { fechar(); formDiaria(d, aoConcluir); });
  elemento.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta diária?')) return;
    try {
      await api('DELETE', 'diaria', { id: d.id });
    } catch (erro) {
      recado(erro.message);
      return;
    }
    fechar();
    recado('Diária excluída.');
    await aoConcluir?.();
  });
}

function formDiaria(d, aoConcluir, base = {}) {
  const admin = ehAdmin();
  const novo = !d;
  const motoristas = motoristasAtivos();
  if(base.usuario_id && !motoristas.some((u)=>String(u.id)===String(base.usuario_id))) { const pessoa=estado.usuarios.find((u)=>String(u.id)===String(base.usuario_id)); if(pessoa) motoristas.unshift(pessoa); }
  if (admin && novo && !motoristas.length) {
    recado('Cadastre um motorista em Ajustes antes de lançar diárias.');
    return;
  }
  const diariaDe = (id) => {
    const u = admin ? estado.usuarios.find((x) => String(x.id) === String(id)) : estado.usuario;
    return u?.valor_diaria_centavos || null;
  };
  const padrao = diariaDe(d?.usuario_id || base.usuario_id || motoristas[0]?.id);

  const { elemento, fechar } = janela(novo ? (admin ? 'Lançar diárias' : 'Registrar dia trabalhado') : 'Editar diária', `
    <form class="form-pilha" novalidate>
      ${admin && novo ? `
        <div class="campo">
          <label for="df-motorista">Motorista</label>
          <select id="df-motorista" name="usuario_id">
            ${motoristas.map((u) => `<option value="${u.id}">${esc(u.nome)}</option>`).join('')}
          </select>
        </div>` : ''}
      <div class="linha duas">
        <div class="campo">
          <label for="df-de">${novo ? 'Dia trabalhado' : 'Dia'}</label>
          <input id="df-de" name="${novo ? 'de' : 'data'}" type="date" required
                 value="${esc(d?.data || base.de || hoje())}" ${admin ? '' : `max="${hoje()}"`}>
        </div>
        ${novo ? `
          <div class="campo opcional">
            <label for="df-ate">Até o dia</label>
            <input id="df-ate" name="ate" type="date" value="${esc(base.ate || '')}" ${admin ? '' : `max="${hoje()}"`}>
            <p class="dica">Para registrar vários dias seguidos de uma vez.</p>
          </div>` : ''}
      </div>
      <div class="campo opcional">
        <label for="df-viagem">Viagem</label>
        <select id="df-viagem" name="viagem_id">
          ${opcoesViagem(d?.viagem_id || base.viagem_id, d?.viagem_origem
            ? { id: d.viagem_id, origem: d.viagem_origem, destino: d.viagem_destino } : base.viagem_id ? {id:base.viagem_id,origem:base.viagem_origem || 'Viagem selecionada',destino:base.viagem_destino || ''}:null)}
        </select>
      </div>
      ${admin ? `
        <div class="campo opcional">
          <label for="df-valor">Valor da diária</label>
          <div class="valor-caixa">
            <span aria-hidden="true">R$</span>
            <input id="df-valor" name="valor" inputmode="decimal" placeholder="${esc(valorParaCampo(padrao) || '0,00')}"
                   value="${esc(novo ? '' : valorParaCampo(d.valor_centavos))}">
          </div>
          <p class="dica" data-dica-valor>${novo
            ? (padrao ? `Em branco, usa a diária cadastrada do motorista (${dinheiro(padrao)}).`
              : 'Este motorista ainda não tem diária cadastrada em Ajustes.')
            : 'Valor desta diária.'}</p>
        </div>` : `
        <p class="ajuda" style="margin:0">${padrao
          ? `Cada dia vale ${dinheiro(padrao)}, como combinado com o escritório.`
          : 'O valor da diária é definido pelo escritório.'}</p>`}
      <div class="campo opcional">
        <label for="df-obs">Observação</label>
        <input id="df-obs" name="observacao" maxlength="200" value="${esc(d?.observacao || '')}"
               placeholder="Ex.: carregamento, espera na fila, folga trabalhada">
      </div>
      ${novo ? `<details><summary>Escolher dias da semana</summary><div class="dias-semana">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((nome,i) => `<label><input type="checkbox" name="dias_semana" value="${i}" checked>${nome}</label>`).join('')}</div></details><div class="resumo-lote" data-estimativa></div>`:''}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${novo ? 'Registrar' : 'Salvar alterações'}</button>
      </div>
    </form>`);

  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  if (base.usuario_id && form.elements.usuario_id) form.elements.usuario_id.value=base.usuario_id;
  const estimativa = () => {
    if (!novo) return;
    const de=form.elements.de.value, ate=form.elements.ate.value || de;
    const semana=[...form.querySelectorAll('[name=dias_semana]:checked')].map((c) => Number(c.value));
    let dias=0; const fim=new Date(ate+'T12:00:00');
    for(let d=new Date(de+'T12:00:00');d<=fim && dias<63;d.setDate(d.getDate()+1)) { if(semana.includes(d.getDay())) dias++; if(!semana.length) break; }
    const valor=form.elements.valor?.value ? Number(form.elements.valor.value.replace(/\./g,'').replace(',','.'))*100 : diariaDe(form.elements.usuario_id?.value || estado.usuario.id);
    form.querySelector('[data-estimativa]').textContent=`${dias} dia(s) selecionado(s)${valor ? ' · estimativa '+dinheiro(dias*valor):''}. Dias já cadastrados serão ignorados.`;
  };
  form.addEventListener('input',estimativa); estimativa();
  form.elements.usuario_id?.addEventListener('change', () => {
    const valor = diariaDe(form.elements.usuario_id.value);
    form.elements.valor.placeholder = valorParaCampo(valor) || '0,00';
    form.querySelector('[data-dica-valor]').textContent = valor
      ? `Em branco, usa a diária cadastrada do motorista (${dinheiro(valor)}).`
      : 'Este motorista ainda não tem diária cadastrada em Ajustes.';
  });
  aoEnviar(form, async (dados) => {
    if (novo) dados.dias_semana=[...form.querySelectorAll('[name=dias_semana]:checked')].map((c) => c.value);
    if (novo) {
      const r = await api('POST', 'diarias', {}, dados);
      if (r.offline) {
        fechar();
        recado(GUARDADO_OFFLINE);
        await aoConcluir?.();
        return;
      }
      if (!r.criadas) throw new Error(r.ja_existiam === 1 ? 'Esse dia já está registrado.' : 'Esses dias já estão registrados.');
      fechar();
      const texto = `${r.criadas} ${r.criadas === 1 ? 'dia registrado' : 'dias registrados'}`
        + `${r.ja_existiam ? ` (${r.ja_existiam} já existia${r.ja_existiam === 1 ? '' : 'm'})` : ''}.`;
      recado(admin ? texto : `${texto} Dá para corrigir nos próximos ${MINUTOS_PARA_CORRIGIR} minutos.`);
    } else {
      await api('PUT', 'diaria', { id: d.id }, dados);
      fechar();
      recado('Diária atualizada.');
    }
    await aoConcluir?.();
  });
}

function formValorDiaria(m, aoConcluir) {
  const pendentes = m.dias_pendentes_geral || 0;
  const { elemento, fechar } = janela(`Diária - ${m.nome}`, `
    <form class="form-pilha" novalidate>
      <div class="campo">
        <label for="vd-valor">Valor da diária</label>
        <div class="valor-caixa">
          <span aria-hidden="true">R$</span>
          <input id="vd-valor" name="valor_diaria" inputmode="decimal" placeholder="0,00"
                 value="${esc(valorParaCampo(m.valor_diaria_centavos))}">
        </div>
        <p class="dica">Vale para os próximos dias lançados. Em branco, fica sem valor definido.</p>
      </div>
      ${pendentes ? `
        <div class="campo">
          <label class="caixa-marcar">
            <input type="checkbox" name="aplicar_pendentes" value="1">
            <span>Usar este valor também nas ${pendentes === 1 ? 'diária' : `${pendentes} diárias`} ainda não ${pendentes === 1 ? 'paga' : 'pagas'}
              <small>Inclui as de outros meses. As já pagas não mudam.</small>
            </span>
          </label>
        </div>` : ''}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">Salvar</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    const r = await api('PUT', 'diaria-valor', { usuario_id: m.usuario_id }, dados);
    estado.usuarios = await api('GET', 'usuarios');
    fechar();
    recado(r.atualizadas
      ? `Diária atualizada (${r.atualizadas} ${r.atualizadas === 1 ? 'dia pendente ajustado' : 'dias pendentes ajustados'}).`
      : 'Diária atualizada.');
    await aoConcluir?.();
  });
}

function formPagamentoDiarias(m, mes, dias, aoConcluir) {
  const gastos = categoriasDoTipo('saida');
  const padrao = gastos.find((c) => /di[aá]ria/i.test(c.nome)) || gastos.find((c) => /sal[aá]rio/i.test(c.nome));
  const { elemento, fechar } = janela(`Pagar diárias - ${m.nome}`, `
    <form class="form-pilha" novalidate>
      <div class="grade">
        <div class="mini">
          <div class="rotulo">Dias a pagar</div>
          <div class="numero">${dias}</div>
          <small>${mesLongo(mes)}</small>
        </div>
        <div class="mini">
          <div class="rotulo">Total</div>
          <div class="numero saida">${dinheiro(m.pendente_centavos)}</div>
        </div>
      </div>
      <p class="ajuda" style="margin:0">
        O pagamento entra como um gasto em Lançamentos. Se você excluir esse lançamento depois,
        as diárias voltam a ficar pendentes.
      </p>
      <div class="linha duas">
        <div class="campo">
          <label for="pg-data">Dia do pagamento</label>
          <input id="pg-data" name="data" type="date" required value="${hoje()}">
        </div>
        <div class="campo opcional">
          <label for="pg-forma">Como pagou</label>
          <select id="pg-forma" name="pagamento">${opcoesPagamento('Pix')}</select>
        </div>
      </div>
      <div class="campo">
        <label for="pg-categoria">Categoria do gasto</label>
        <select id="pg-categoria" name="categoria_id">
          ${gastos.map((c) => `
            <option value="${c.id}" ${padrao && String(padrao.id) === String(c.id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="campo opcional">
        <label for="pg-obs">Observação</label>
        <input id="pg-obs" name="observacao" maxlength="500">
      </div>
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${icone('check')} Confirmar pagamento</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    const r = await api('POST', 'diarias-pagar', {}, { ...dados, usuario_id: m.usuario_id, mes });
    fechar();
    recado(`Pagamento de ${dinheiro(r.total_centavos)} registrado (${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}).`);
    await aoConcluir?.();
  });
}

// ---------------------------------------------------------------------------
// Receita da empresa (motoristas só consultam)
// ---------------------------------------------------------------------------

async function telaReceita(alvo) {
  const atual=hoje().slice(0,7), d=new Date(Number(atual.slice(0,4)),Number(atual.slice(5,7))-2,1);
  const anterior=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  let mes=atual, modo='linha', resposta, versao=0;
  alvo.innerHTML=`<div class="pilha"><div class="titulo-secao"><h1>Receita da empresa</h1><p>Panorama financeiro da frota. Disponível somente para consulta.</p></div><div class="periodos-receita" role="group" aria-label="Mês da receita"><button type="button" class="btn" data-receita-mes="${atual}" aria-pressed="true">Mês atual · ${mesCurto(atual)}</button><button type="button" class="btn" data-receita-mes="${anterior}" aria-pressed="false">Mês anterior · ${mesCurto(anterior)}</button></div><div id="receita-painel"></div></div>`;
  const desenha=()=>{
    const r=resposta, p=alvo.querySelector('#receita-painel');
    p.innerHTML=`<div class="pilha"><div class="card-hero-destaque"><div class="cabecalho-hero"><span class="subtitulo-hero">Receita recebida · ${mesLongo(mes)}</span><span class="tag-hero positivo">Somente leitura</span></div><div class="valor-hero positivo">${dinheiro(r.atual.entradas_centavos)}</div><div class="mini-grid-hero"><div class="item-mini-hero"><span class="rotulo">Despesas</span><span class="valor">${dinheiro(r.atual.saidas_centavos)}</span></div><div class="item-mini-hero"><span class="rotulo">Saldo do mês</span><span class="valor">${dinheiro(r.atual.saldo_centavos)}</span></div><div class="item-mini-hero"><span class="rotulo">Pendente a receber</span><span class="valor">${dinheiro(r.a_receber.a_receber_centavos)}</span><small>Todos os meses</small></div></div></div>
    <div class="grade-kpis">${cartaoKpi('azul','caminhao','Viagens em andamento',String(r.viagens_abertas),'Operação atual')}${cartaoKpi('amarelo','combustivel','Combustível',dinheiro(r.combustivel_centavos),`${numero(r.litros)} litros no mês`)}</div>
    <div class="cartao painel-grafico"><div class="topo-grafico"><h2>Movimentação do mês</h2><div class="seletor-grafico" role="group" aria-label="Visualização do gráfico">${[['linha','Linha'],['barras','Barras'],['pizza','Pizza']].map(([id,nome])=>`<button type="button" data-modo-receita="${id}" aria-pressed="${id===modo}">${nome}</button>`).join('')}</div></div>${desenhaGraficoPorModo(r,false,mes,mes,modo)}</div>
    <div class="cartao"><h2>Performance por caminhão</h2>${tabelaCaminhoes(r.por_caminhao)}</div><div class="cartao"><h2>Entradas por frete</h2>${barras(r.entradas_por_categoria,(i)=>esc(i.nome),'entrada')}</div></div>`;
    ajustaPainel(p);
    p.querySelectorAll('[data-modo-receita]').forEach((b)=>b.onclick=()=>{modo=b.dataset.modoReceita;desenha();});
  };
  const carrega=async()=>{const vez=++versao;alvo.querySelector('#receita-painel').innerHTML='<p class="carregando">Carregando panorama…</p>';const r=await api('GET','receita',{mes});if(vez!==versao)return;resposta=r;desenha();};
  alvo.querySelectorAll('[data-receita-mes]').forEach((b)=>b.onclick=()=>{mes=b.dataset.receitaMes;alvo.querySelectorAll('[data-receita-mes]').forEach((x)=>x.setAttribute('aria-pressed',String(x===b)));carrega().catch((e)=>recado(e.message));});
  await carrega();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(`sw.js?v=${encodeURIComponent(window.VERSAO_APP || '')}&ambiente=${encodeURIComponent(window.FROTA_AMBIENTE || 'padrao')}`, { updateViaCache: 'none' })
    .catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!estado.usuario) return;
    if (e.data?.tipo === 'fila') aoSincronizar(e.data);
    if (e.data?.tipo === 'push') verificaAvisos();
    if (e.data?.tipo === 'abrir-avisos') abreAvisos();
  });
}

(async function inicia() {
  try {
    estado.usuario = await api('GET', 'eu');
    await iniciaApp();
  } catch (erro) {
    if (erro.offline) {
      telaLogin('Sem internet. Para entrar pela primeira vez neste aparelho, conecte-se à internet.');
      return;
    }
    if (/PHP|inesperada|conectar|MySQL/i.test(erro.message)) {
      document.body.classList.add('tela-entrada');
      app.innerHTML = `<div class="tela-login"><div class="cartao">
        <div class="logo">${LOGO}</div>
        <h1>Quase lá</h1>
        <div class="aviso erro">${esc(erro.message)}</div>
        <p class="ajuda">Corrija o item acima e recarregue a página.</p>
      </div></div>`;
      return;
    }
    telaLogin();
  }
})();
