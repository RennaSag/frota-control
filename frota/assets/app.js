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
  const podeEsperar = metodo === 'POST' && Fila.ROTAS.includes(rota) && Boolean(estado.usuario);
  const filaId = podeEsperar ? Fila.novoId() : null;
  if (podeEsperar && (navigator.onLine === false || Fila.refsLocais([params, corpo]).size)) {
    return guardaNaFila(filaId, rota, params, corpo);
  }
  let resposta;
  try {
    resposta = await fetch(endereco(rota, params), {
      method: metodo,
      headers: {
        'X-App-Frota': '1',
        ...(filaId ? { 'X-Fila-Id': filaId } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      credentials: 'same-origin',
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: podeEsperar ? tempoLimite(20000) : undefined,
    });
  } catch {
    if (podeEsperar) return guardaNaFila(filaId, rota, params, corpo);
    marcaOffline(true);
    throw erroSemInternet();
  }
  const offline = resposta.headers.get('X-Frota-Offline');
  if (metodo === 'GET') marcaOffline(Boolean(offline));
  if (resposta.status === 401 && estado.usuario) {
    estado.usuario = null;
    telaLogin('Sua sessão expirou. Entre novamente.');
    throw new Error('Sessão expirada.');
  }
  const texto = await resposta.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error('O servidor respondeu de forma inesperada. Tente de novo em instantes.');
  }
  if (offline === 'vazio') throw erroSemInternet(dados?.erro);
  if (!resposta.ok) throw new Error(dados?.erro || 'Não foi possível concluir.');
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
const MINUTOS_PARA_CORRIGIR = 5;

function textoPrazo(segundos) {
  const min = Math.max(1, Math.ceil(Number(segundos) / 60));
  return `Você pode corrigir ou excluir por mais ${min} ${min === 1 ? 'minuto' : 'minutos'}. Depois, só o proprietário.`;
}

function avisoPrazo(registro) {
  if (ehAdmin()) return '';
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
  document.querySelector('.janela')?.remove();
  const fundo = document.createElement('div');
  fundo.className = 'janela';
  fundo.innerHTML = `
    <div class="conteudo" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <button class="fechar" type="button" aria-label="Fechar">${svg('fechar')}</button>
      <h2>${esc(titulo)}</h2>
      <div class="corpo-janela">${corpoHtml}</div>
    </div>`;
  const fechar = () => fundo.remove();
  fundo.querySelector('.fechar').onclick = fechar;
  fundo.onclick = (e) => { if (e.target === fundo) fechar(); };
  document.addEventListener('keydown', function escuta(e) {
    if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', escuta); }
  });
  document.body.appendChild(fundo);
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
      </form>
    </div>`;
  aoEnviar(app.querySelector('form'), async (dados) => {
    if (!dados.usuario?.trim() || !dados.senha) throw new Error('Preencha usuário e senha.');
    estado.usuario = await api('POST', 'login', {}, dados);
    // Dados guardados de outra conta neste aparelho não podem aparecer para quem entrou.
    try { await caches.delete(Fila.CACHE_DADOS); } catch { /* sem Cache Storage */ }
    await iniciaApp();
  });
}

// "curto" é o nome no menu do celular, onde o espaço é pequeno.
const ABAS_MOTORISTA = [
  { id: 'meus', ico: 'lista', nome: 'Meus gastos', curto: 'Gastos' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'notas', ico: 'nota', nome: 'Notas fiscais', curto: 'Notas' },
  { id: 'diarias', ico: 'calendario', nome: 'Minhas diárias', curto: 'Diárias' },
  { id: 'receita', ico: 'receita', nome: 'Receita da empresa', curto: 'Receita' },
  { id: 'perfil', ico: 'usuario', nome: 'Perfil' },
];
const ABAS_ADMIN = [
  { id: 'panorama', ico: 'panorama', nome: 'Panorama' },
  { id: 'lancamentos', ico: 'lista', nome: 'Lançamentos', curto: 'Lançam.' },
  { id: 'receber', ico: 'aReceber', nome: 'A receber' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'diarias', ico: 'calendario', nome: 'Diárias' },
  { id: 'notas', ico: 'nota', nome: 'Notas fiscais', curto: 'Notas' },
  { id: 'ajustes', ico: 'ajustes', nome: 'Ajustes' },
];
// No celular cabem 4 abas fixas; as outras ficam no botão "Mais".
const ABAS_NO_DOCK = 4;
const ehAdmin = () => estado.usuario?.papel === 'admin';
const abas = () => (ehAdmin() ? ABAS_ADMIN : ABAS_MOTORISTA);

async function iniciaApp() {
  document.body.classList.remove('tela-entrada');
  app.innerHTML = '<p class="carregando">Carregando…</p>';
  await recarregaBasico();
  if (!abas().some((a) => a.id === estado.aba)) estado.aba = abas()[0].id;
  desenhaEstrutura();
  await abreAba(estado.aba);
  Fila.defineMeta('usuario', estado.usuario.id).catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
  atualizaFila();
  sincroniza();
  sincronizaPush();
  executaAcaoDaUrl();
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
          <div class="usuario-card">
            <div class="avatar-circulo">${iniciais(estado.usuario.nome)}</div>
            <div class="usuario-dados">
              <strong>${esc(estado.usuario.nome)}</strong>
              <span>${ehAdmin() ? 'Administrador' : 'Motorista'}</span>
            </div>
          </div>
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
            <button class="sino fila-aparelho oculto" type="button" id="b-fila" aria-label="Guardado no aparelho">
              ${svg('relogio')}<span class="contador" aria-hidden="true"></span>
            </button>
            <button class="sino" type="button" id="b-avisos" aria-label="Notificações e Avisos">
              ${svg('sino')}<span class="contador oculto" aria-hidden="true"></span>
            </button>
            <button type="button" class="btn principal pequeno oculta-pc" id="b-acao-topo">
              ${svg('registrar')} <span>${ehAdmin() ? 'Novo Lançamento' : 'Novo Gasto'}</span>
            </button>
          </div>
        </header>

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
              ${svg('registrar')} Registrar Frete
            </button>
          </div>
        </div>`);
      document.getElementById('m-novo-gasto').onclick = () => {
        fechar();
        abreFormLancamento('saida', null, () => abreAba(estado.aba));
      };
      document.getElementById('m-novo-frete').onclick = () => {
        fechar();
        abreFormLancamento('entrada', null, () => abreAba(estado.aba));
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
  estado.categorias = categorias;
  estado.caminhoes = caminhoes;
  estado.usuarios = usuarios;
  estado.viagensAbertas = viagens;
}

// Viagens abertas no servidor mais as abertas sem internet que ainda estão na fila do aparelho.
async function carregaViagensAbertas() {
  const doServidor = await api('GET', 'viagens', { status: 'aberta', limite: 100 });
  let naFila = [];
  try {
    naFila = (await Fila.lista(estado.usuario.id))
      .filter((e) => e.rota === 'viagens' && !e.erro)
      .map((e) => ({ id: e.ref, origem: e.corpo.origem, destino: e.corpo.destino, inicio: e.corpo.inicio }));
  } catch { /* sem IndexedDB */ }
  return [...doServidor, ...naFila];
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
  return rota;
}

async function guardaNaFila(id, rota, params, corpo) {
  const envio = await Fila.adiciona({
    id, usuarioId: estado.usuario.id, rota, params, corpo, resumo: resumoDoEnvio(rota, corpo),
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
  try { await caches.delete(Fila.CACHE_DADOS); } catch { /* sem Cache Storage */ }
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
  const recarrega = () => abreAba(estado.aba);
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
    fechar();
    formNota(null, recarrega, { arquivo: ref });
  };
  elemento.querySelector('[data-gasto]').onclick = () => {
    fechar();
    abreFormLancamento('saida', null, recarrega, { comprovante: ref });
  };
}

const PAGAMENTOS = ['Dinheiro', 'Cartão da empresa', 'Pix', 'Cartão frete', 'Boleto', 'Do próprio bolso'];

function comOExtra(lista, extra) {
  if (extra?.id && !lista.some((x) => Number(x.id) === Number(extra.id))) {
    return [...lista, { ...extra, id: Number(extra.id) }];
  }
  return lista;
}

function opcoesCaminhao(selecionado, extra) {
  return [
    '<option value="">Selecione o caminhão</option>',
    ...comOExtra(estado.caminhoes, extra).map((c) => `
      <option value="${c.id}" ${Number(selecionado) === Number(c.id) ? 'selected' : ''}>
        ${esc(c.placa)}${c.apelido ? ` - ${esc(c.apelido)}` : ''}
      </option>`),
  ].join('');
}

function opcoesViagem(selecionado, extra) {
  return [
    '<option value="">Fora de viagem</option>',
    ...comOExtra(estado.viagensAbertas, extra).map((v) => `
      <option value="${esc(v.id)}" ${String(selecionado) === String(v.id) ? 'selected' : ''}>
        ${Fila.ehLocal(v.id) ? '⏳ ' : ''}${esc(v.origem)} → ${esc(v.destino)}${v.inicio ? ` (saída ${dataDiaMes(v.inicio)})` : ''}
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
      ${esc(r.cliente)}${r.descricao ? ` - ${esc(r.descricao)}` : ''}${r.restante_centavos != null
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
    ${ehAdmin() ? `
      <div class="campo">
        <label for="c-motorista">${entrada ? 'Lançado por' : 'Motorista'}</label>
        <select id="c-motorista" name="usuario_id">
          ${opcoesMotorista(l.usuario_id || estado.usuario.id)}
        </select>
      </div>` : ''}

    <div class="linha duas">
      <div class="campo">
        <label for="c-data">${entrada ? 'Dia do recebimento' : 'Dia do gasto'}</label>
        <input id="c-data" name="data" type="date" required value="${esc(l.data || hoje())}">
      </div>
      <div class="campo">
        <label for="c-caminhao">Caminhão</label>
        <select id="c-caminhao" name="caminhao_id">
          ${opcoesCaminhao(l.caminhao_id || (l.id ? null : (ehAdmin() ? (estado.usuarios.find((u) => Number(u.id) === Number(l.usuario_id || estado.usuario.id))?.caminhao_padrao_id || estado.usuario.caminhao_padrao_id) : estado.usuario.caminhao_padrao_id)), l.placa
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
            <input id="nv-origem" maxlength="80" placeholder="Cidade de saída">
          </div>
          <div class="campo">
            <label for="nv-destino">Indo para</label>
            <input id="nv-destino" maxlength="80" placeholder="Cidade de destino">
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
      <label>${entrada ? 'Tipo de frete' : 'Tipo de gasto'}</label>
      <p class="dica">Toque na opção.</p>
      <div class="categorias" role="group">
        ${lista.map((c) => `
          <button type="button" class="opcao-categoria" data-id="${c.id}"
                  data-litros="${c.pede_litros}" data-descricao="${c.pede_descricao}"
                  aria-pressed="${Number(l.categoria_id) === Number(c.id)}">
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
// no canvas (devolve PNG), então nesse caso vai em JPEG. Regravar também descarta os metadados
// (EXIF, GPS) — o servidor guarda a foto como chega —, por isso vai a regravada mesmo se ficar maior.
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
    if (!blob) return arquivo;
    const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `comprovante.${extensao}`, { type: blob.type });
  } catch {
    return arquivo;
  }
}

function ligaCamposLancamento(form) {
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
    const r = estado.recebiveisAbertos.find((x) => Number(x.id) === Number(form.elements.recebivel_id.value));
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
          <button type="button" class="btn-tipo-toggle ${tipoAtual === 'saida' ? 'ativo-saida' : ''}" data-tipo-opcao="saida">
            ${icone('gasto')} Gasto (Saída)
          </button>
          <button type="button" class="btn-tipo-toggle ${tipoAtual === 'entrada' ? 'ativo-entrada' : ''}" data-tipo-opcao="entrada">
            ${icone('receber')} Frete (Entrada)
          </button>
        </div>` : ''}
      ${camposLancamento(tipoAtual, lancamento || base)}
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${lancamento ? 'Salvar alterações' : 'Salvar lançamento'}</button>
      </div>`;
  }

  const titulo = lancamento
    ? (tipoAtual === 'entrada' ? 'Editar Entrada (Frete)' : 'Editar Gasto')
    : (tipoAtual === 'entrada' ? 'Novo Frete / Entrada' : 'Novo Gasto / Despesa');

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
          tipoAtual = novoTipo;
          const h2 = elemento.closest('.conteudo')?.querySelector('h2');
          if (h2) h2.textContent = tipoAtual === 'entrada' ? 'Novo Frete / Entrada' : 'Novo Gasto / Despesa';
          form.innerHTML = renderConteudo();
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
  const rota = l.viagem_origem ? `<span>${esc(l.viagem_origem)} → ${esc(l.viagem_destino)}</span>` : '';
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
      </div>
    </div>`;
}

function ligaItens(raiz) {
  raiz.querySelectorAll('[data-lancamento]').forEach((b) => {
    b.onclick = () => abreLancamento(Number(b.dataset.lancamento));
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abreLancamento(Number(b.dataset.lancamento));
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
            <input id="f-busca" type="search" placeholder="Buscar por descrição, motorista, placa ou cliente..."
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
        const cat = estado.categorias.find((c) => Number(c.id) === Number(estado.filtros.categoria_id));
        if (cat) itensChips.push(`<span class="chip-filtro">Cat: ${esc(cat.nome)} <button type="button" data-limpar-chip="categoria_id">×</button></span>`);
      }
      if (estado.filtros.caminhao_id) {
        const cam = estado.caminhoes.find((c) => Number(c.id) === Number(estado.filtros.caminhao_id));
        if (cam) itensChips.push(`<span class="chip-filtro">Caminhão: ${esc(cam.placa)} <button type="button" data-limpar-chip="caminhao_id">×</button></span>`);
      }
      if (estado.filtros.usuario_id) {
        const usr = estado.usuarios.find((u) => Number(u.id) === Number(estado.filtros.usuario_id));
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
    atualizaBadgeFiltros();
    const caixaLista = document.getElementById('lista');
    const caixaKpis = document.getElementById('resumo-kpis');
    caixaLista.innerHTML = '<p class="carregando">Carregando…</p>';

    const rotuloMes = document.getElementById('rotulo-mes');
    if (rotuloMes) rotuloMes.textContent = mesLongo(estado.mes);

    const r = await api('GET', 'lancamentos', filtrosAtuais());
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
      atualiza();
    }, 250);
  };

  // Single filter dialog opened by the filter button
  alvo.querySelector('#b-abrir-filtros').onclick = () => {
    let tipoTemp = estado.filtros.tipo || '';

    const { elemento, fechar } = janela('Filtros de Lançamentos', `
      <div class="pilha">
        <div class="campo">
          <label for="dlg-f-mes">Mês de referência</label>
          <input id="dlg-f-mes" type="month" value="${estado.mes}">
        </div>

        <div class="campo">
          <label>Tipo de lançamento</label>
          <div class="seletor-tipo-lancamento" role="group" aria-label="Filtrar por tipo" style="margin-bottom:0">
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

async function abreLancamento(id) {
  const l = await api('GET', 'lancamento', { id });
  const entrada = l.tipo === 'entrada';
  const linhas = [
    ['Tipo', l.categoria],
    [entrada ? 'Valor recebido' : 'Valor pago', dinheiro(l.valor_centavos)],
    ['Dia', dataCurta(l.data)],
    [entrada ? 'Lançado por' : 'Motorista', l.motorista],
    ['Caminhão', l.placa ? `${l.placa}${l.caminhao_apelido ? ` - ${l.caminhao_apelido}` : ''}` : '-'],
    ['Viagem', l.viagem_origem ? `${l.viagem_origem} → ${l.viagem_destino}` : 'Fora de viagem'],
    ['Litros', l.litros ? `${numero(l.litros)} L` : null],
    ['Preço por litro', l.litros ? dinheiro(l.valor_centavos / l.litros) : null],
    ['Km do painel', l.km ? numero(l.km) : null],
    ['Quem pagou', l.cliente],
    ['Frete a receber', l.recebivel_cliente
      ? `${l.recebivel_cliente}${l.recebivel_descricao ? ` - ${l.recebivel_descricao}` : ''}` : null],
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
    ${l.pode_alterar ? `
      <div class="acoes fim" style="margin-top:16px">
        <button class="btn perigo" type="button" data-excluir>Excluir</button>
        <button class="btn principal" type="button" data-editar>Editar</button>
      </div>` : ''}`);

  vigiaPrazo(elemento, l);
  const recarrega = () => abreAba(estado.aba);
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => {
    fechar();
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

async function telaViagens(alvo) {
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%">
          <div>
            <h1>Controle de Viagens</h1>
            <p>Gerenciamento completo das rotas, quilometragem, fretes e custos operacionais.</p>
          </div>
          <button class="btn principal" type="button" id="b-nova">${icone('adicionar')} Nova Viagem</button>
        </div>
      </div>
      <div id="lista-viagens"><p class="carregando">Carregando viagens…</p></div>
    </div>`;

  const atualiza = async () => {
    estado.viagensAbertas = await api('GET', 'viagens', { status: 'aberta', limite: 100 });
    const caixa = document.getElementById('lista-viagens');
    const viagens = await api('GET', 'viagens', { limite: 300 });
    if (!viagens.length) {
      caixa.innerHTML = `
        <div class="vazio">
          ${icone('caminhao')}
          <p style="margin-top:8px">Nenhuma viagem registrada ainda. Abra a primeira viagem para monitorar a rota!</p>
        </div>`;
      return;
    }

    caixa.innerHTML = `
      <div class="lista-viagens">
        ${viagens.map((v) => {
          const saldo = Number(v.entradas_centavos) - Number(v.saidas_centavos);
          const aberta = v.status === 'aberta';
          const km = v.km_final != null && v.km_inicial != null ? v.km_final - v.km_inicial : null;
          return `
          <div class="card-viagem ${aberta ? 'aberta' : ''}" data-viagem="${v.id}" role="button" tabindex="0">
            <div class="cabecalho-viagem">
              <div class="rota-viagem">
                <span class="ponto">${esc(v.origem)}</span>
                <span class="seta-rota">→</span>
                <span class="ponto">${esc(v.destino)}</span>
              </div>
              <span class="badge-status ${aberta ? 'aberta' : 'encerrada'}">
                ${aberta ? 'Em andamento' : 'Encerrada'}
              </span>
            </div>

            <div class="meta-viagem">
              <span>${dataCurta(v.inicio)}${v.fim ? ` até ${dataCurta(v.fim)}` : ''}</span>
              ${v.placa ? `<span class="separador-ponto">·</span><span class="badge-placa">${esc(v.placa)}</span>` : ''}
              ${ehAdmin() && v.motorista ? `<span class="separador-ponto">·</span><span>${esc(v.motorista)}</span>` : ''}
              ${km != null ? `<span class="separador-ponto">·</span><span>${numero(km)} km rodados</span>` : ''}
              ${seloPrazo(v)}
            </div>

            <div class="metricas-viagem">
              <div class="coluna-metrica">
                <div class="rotulo">Despesas</div>
                <div class="valor saida">${dinheiro(v.saidas_centavos)}</div>
              </div>
              ${ehAdmin() ? `
              <div class="coluna-metrica">
                <div class="rotulo">Frete Recebido</div>
                <div class="valor entrada">${dinheiro(v.entradas_centavos)}</div>
              </div>
              <div class="coluna-metrica">
                <div class="rotulo">Resultado</div>
                <div class="valor ${saldo >= 0 ? 'entrada' : 'saida'}">
                  ${saldo >= 0 ? '+' : '−'}${dinheiro(Math.abs(saldo))}
                </div>
              </div>` : `
              <div class="coluna-metrica">
                <div class="rotulo">Lançamentos</div>
                <div class="valor" style="color:var(--tinta-2)">${v.qtd_lancamentos || 0}</div>
              </div>`}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    caixa.querySelectorAll('[data-viagem]').forEach((b) => {
      const v = viagens.find((x) => Number(x.id) === Number(b.dataset.viagem));
      b.onclick = () => abreViagem(v, atualiza);
      b.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abreViagem(v, atualiza);
        }
      };
    });
  };

  alvo.querySelector('#b-nova').onclick = () => abreFormViagem(null, atualiza);
  await atualiza();
}

function camposViagem(v = {}) {
  return `
    ${ehAdmin() ? `
      <div class="campo">
        <label for="v-motorista">Motorista</label>
        <select id="v-motorista" name="usuario_id">
          ${opcoesMotorista(v.usuario_id || estado.usuario.id)}
        </select>
      </div>` : ''}
    <div class="linha duas">
      <div class="campo">
        <label for="v-origem">Saindo de</label>
        <input id="v-origem" name="origem" required maxlength="80" placeholder="Cidade de saída"
               value="${esc(v.origem || '')}">
      </div>
      <div class="campo">
        <label for="v-destino">Indo para</label>
        <input id="v-destino" name="destino" required maxlength="80" placeholder="Cidade de destino"
               value="${esc(v.destino || '')}">
      </div>
    </div>
    <div class="linha duas" style="margin-top:16px">
      <div class="campo">
        <label for="v-inicio">Dia da saída</label>
        <input id="v-inicio" name="inicio" type="date" required value="${esc(v.inicio || hoje())}">
      </div>
      <div class="campo">
        <label for="v-caminhao">Caminhão</label>
        <select id="v-caminhao" name="caminhao_id">
          ${opcoesCaminhao(v.caminhao_id, v.placa
            ? { id: v.caminhao_id, placa: v.placa, apelido: v.caminhao_apelido } : null)}
        </select>
      </div>
    </div>
    <div class="campo opcional" style="margin-top:16px">
      <label for="v-km">Km do painel na saída</label>
      <input id="v-km" name="km_inicial" inputmode="numeric" value="${esc(v.km_inicial ?? '')}">
    </div>
    <div class="campo opcional">
      <label for="v-obs">Observação</label>
      <input id="v-obs" name="observacao" maxlength="500" value="${esc(v.observacao || '')}">
    </div>`;
}

function abreFormViagem(viagem, aoConcluir) {
  const { elemento, fechar } = janela(viagem ? 'Editar viagem' : 'Nova viagem', `
    <form novalidate>
      ${camposViagem(viagem || {})}
      ${viagem ? `
        <div class="linha duas">
          <div class="campo opcional">
            <label for="v-fim">Dia da chegada</label>
            <input id="v-fim" name="fim" type="date" value="${esc(viagem.fim || '')}">
          </div>
          <div class="campo opcional">
            <label for="v-kmf">Km na chegada</label>
            <input id="v-kmf" name="km_final" inputmode="numeric" value="${esc(viagem.km_final ?? '')}">
          </div>
        </div>
        <div class="campo">
          <label for="v-status">Situação</label>
          <select id="v-status" name="status">
            <option value="aberta" ${viagem.status === 'aberta' ? 'selected' : ''}>Em andamento</option>
            <option value="encerrada" ${viagem.status === 'encerrada' ? 'selected' : ''}>Encerrada</option>
          </select>
        </div>` : ''}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${viagem ? 'Salvar alterações' : 'Abrir viagem'}</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    if (!dados.origem?.trim() || !dados.destino?.trim()) {
      throw new Error('Informe de onde está saindo e para onde vai.');
    }
    const r = viagem
      ? await api('PUT', 'viagem', { id: viagem.id }, dados)
      : await api('POST', 'viagens', {}, dados);
    fechar();
    if (r?.offline) recado(GUARDADO_OFFLINE);
    else recado(viagem ? 'Viagem atualizada.' : 'Viagem aberta.');
    estado.viagensAbertas = await carregaViagensAbertas().catch(() => estado.viagensAbertas);
    await aoConcluir?.();
  });
}

async function abreViagem(v, aoConcluir) {
  const r = await api('GET', 'lancamentos', { viagem_id: v.id, limite: 300 });
  const km = v.km_final != null && v.km_inicial != null ? v.km_final - v.km_inicial : null;
  const saldo = Number(v.entradas_centavos) - Number(v.saidas_centavos);

  const { elemento, fechar } = janela(`${v.origem} → ${v.destino}`, `
    <div class="cartao">
      <p style="margin:0 0 12px">
        <span class="etiqueta ${v.status === 'aberta' ? 'aberta' : ''}">
          ${v.status === 'aberta' ? 'Em andamento' : 'Encerrada'}
        </span>
      </p>
      <div class="grade">
        <div class="mini">
          <div class="rotulo">Gastos da viagem</div>
          <div class="numero saida">${dinheiro(v.saidas_centavos)}</div>
          <small>${v.qtd_lancamentos} ${Number(v.qtd_lancamentos) === 1 ? 'lançamento' : 'lançamentos'}</small>
        </div>
        ${ehAdmin() ? `
          <div class="mini">
            <div class="rotulo">Frete recebido</div>
            <div class="numero entrada">${dinheiro(v.entradas_centavos)}</div>
          </div>
          <div class="mini">
            <div class="rotulo">Saldo da viagem</div>
            <div class="numero ${saldo >= 0 ? 'entrada' : 'saida'}">
              ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
            </div>
          </div>` : ''}
        <div class="mini">
          <div class="rotulo">Período</div>
          <div class="numero" style="font-size:1rem">
            ${dataCurta(v.inicio)}${v.fim ? `<br>até ${dataCurta(v.fim)}` : ''}
          </div>
        </div>
        ${km != null ? `
          <div class="mini">
            <div class="rotulo">Km rodados</div>
            <div class="numero">${numero(km)}</div>
          </div>` : ''}
      </div>
      <p style="color:var(--tinta-3);font-size:.9rem;margin:12px 0 0">
        ${v.placa ? `Caminhão ${esc(v.placa)}` : 'Sem caminhão informado'}
        ${ehAdmin() ? ` • Motorista ${esc(v.motorista)}` : ''}
        ${v.observacao ? `<br>${esc(v.observacao)}` : ''}
      </p>
    </div>
    ${r.qtd ? `
      <div class="cartao" style="margin-top:14px">
        <h2>Lançamentos desta viagem</h2>
        <div class="lista">${r.itens.map((l) => itemLancamento(l)).join('')}</div>
      </div>` : `
      <div class="vazio" style="margin-top:14px">Nenhum lançamento nesta viagem ainda.</div>`}
    ${ehAdmin() ? '' : avisoPrazo(v)}
    <div class="acoes fim" style="margin-top:16px">
      ${ehAdmin() ? '<button class="btn perigo" type="button" data-excluir>Excluir</button>' : ''}
      ${ehAdmin() ? `
        <button class="btn" type="button" data-diarias-viagem title="Uma diária por dia da viagem para o motorista">
          ${icone('calendario')} Lançar diárias
        </button>` : ''}
      ${v.pode_alterar ? '<button class="btn" type="button" data-editar>Editar</button>' : ''}
      ${v.status === 'aberta' ? `
        <button class="btn principal" type="button" data-encerrar>Encerrar viagem</button>` : ''}
    </div>`);

  ligaItens(elemento);
  vigiaPrazo(elemento, v);
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => {
    fechar();
    abreFormViagem(v, aoConcluir);
  });
  elemento.querySelector('[data-diarias-viagem]')?.addEventListener('click', async () => {
    const ate = v.fim || hoje();
    if (!confirm(`Lançar uma diária para ${v.motorista} em cada dia de ${dataCurta(v.inicio)} a ${dataCurta(ate)}?\n`
      + 'Dias que já têm diária são pulados. O valor é a diária cadastrada para o motorista.')) return;
    try {
      const r2 = await api('POST', 'diarias', {}, {
        usuario_id: v.usuario_id, de: v.inicio, ate, viagem_id: v.id,
      });
      if (r2.offline) { recado(GUARDADO_OFFLINE); return; }
      recado(r2.criadas
        ? `${r2.criadas} ${r2.criadas === 1 ? 'diária lançada' : 'diárias lançadas'}${r2.ja_existiam ? ` (${r2.ja_existiam} já existiam)` : ''}.`
        : 'Todos esses dias já tinham diária.');
    } catch (erro) {
      recado(erro.message);
    }
  });
  elemento.querySelector('[data-encerrar]')?.addEventListener('click', () => {
    fechar();
    const j = janela('Encerrar viagem', `
      <form novalidate>
        <div class="campo">
          <label for="e-fim">Dia da chegada</label>
          <input id="e-fim" name="fim" type="date" required value="${hoje()}">
        </div>
        <div class="campo opcional">
          <label for="e-km">Km do painel na chegada</label>
          <input id="e-km" name="km_final" inputmode="numeric">
        </div>
        <div class="acoes fim">
          <button class="btn" type="button" data-cancelar>Cancelar</button>
          <button class="btn principal" type="submit">Encerrar</button>
        </div>
      </form>`);
    const form = j.elemento.querySelector('form');
    form.querySelector('[data-cancelar]').onclick = j.fechar;
    aoEnviar(form, async (dados) => {
      const r = await api('POST', 'viagem-encerrar', { id: v.id }, dados);
      j.fechar();
      recado(r?.offline ? GUARDADO_OFFLINE : 'Viagem encerrada.');
      await aoConcluir?.();
    });
  });
  elemento.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    if (!confirm('Excluir a viagem? Os lançamentos ficam salvos, mas sem viagem.')) return;
    await api('DELETE', 'viagem', { id: v.id });
    fechar();
    recado('Viagem excluída.');
    await aoConcluir?.();
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
    grafico.parentElement.scrollLeft = grafico.parentElement.scrollWidth;
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

function desenhaGraficoLinha(r, varios, de) {
  const dados = varios ? r.meses : r.por_dia;
  if (!dados || !dados.length) {
    return '<div class="vazio"><p>Sem dados suficientes para desenhar a linha do tempo.</p></div>';
  }

  const w = 640;
  const h = 220;
  const padL = 60;
  const padR = 25;
  const padT = 30;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  let pontosE = [];
  let pontosS = [];
  let labels = [];

  if (varios) {
    const maior = Math.max(1, ...r.meses.flatMap((m) => [Number(m.entradas_centavos), Number(m.saidas_centavos)]));
    const n = r.meses.length;
    r.meses.forEach((m, i) => {
      const x = n === 1 ? padL + chartW / 2 : padL + (i / (n - 1)) * chartW;
      const yE = padT + chartH - (Number(m.entradas_centavos) / maior) * chartH;
      const yS = padT + chartH - (Number(m.saidas_centavos) / maior) * chartH;
      pontosE.push({ x, y: yE, val: m.entradas_centavos, rotulo: mesCurto(m.mes) });
      pontosS.push({ x, y: yS, val: m.saidas_centavos, rotulo: mesCurto(m.mes) });
      labels.push({ x, rotulo: mesCurto(m.mes) });
    });
  } else {
    const [ano, m] = de.split('-').map(Number);
    const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    const mapa = new Map(r.por_dia.map((d) => [Number(String(d.data).slice(8, 10)), Number(d.saidas_centavos)]));
    const maior = Math.max(1, ...mapa.values(), r.atual.entradas_centavos > 0 ? r.atual.entradas_centavos / dias : 0);
    
    for (let d = 1; d <= dias; d++) {
      const x = padL + ((d - 1) / (dias - 1)) * chartW;
      const valS = mapa.get(d) || 0;
      const yS = padT + chartH - (valS / maior) * chartH;
      pontosS.push({ x, y: yS, val: valS, rotulo: `Dia ${d}` });
      if (d === 1 || d === Math.round(dias / 2) || d === dias) {
        labels.push({ x, rotulo: `Dia ${d}` });
      }
    }
  }

  const dLinha = (pts) => pts.length ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : '';
  const dArea = (pts) => {
    if (!pts.length) return '';
    const base = padT + chartH;
    return `${dLinha(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
  };

  return `
    <div class="area-desenho-grafico">
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-bottom:8px;font-size:0.78rem;font-weight:700">
        ${varios ? `<span style="color:#10b981;display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block"></i> Fretes (Receitas)</span>` : ''}
        <span style="color:#f43f5e;display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:50%;background:#f43f5e;display:inline-block"></i> Gastos (Custos)</span>
      </div>
      <svg viewBox="0 0 ${w} ${h}">
        <defs>
          <linearGradient id="grad-frete" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
          </linearGradient>
          <linearGradient id="grad-gasto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="#e2e8f0" stroke-dasharray="3 3"/>
        <line x1="${padL}" y1="${padT + chartH * 0.5}" x2="${w - padR}" y2="${padT + chartH * 0.5}" stroke="#e2e8f0" stroke-dasharray="3 3"/>
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#cbd5e1" stroke-width="1.5"/>

        ${pontosE.length ? `
          <path d="${dArea(pontosE)}" fill="url(#grad-frete)"/>
          <path d="${dLinha(pontosE)}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
          ${pontosE.map((p) => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#ffffff" stroke="#10b981" stroke-width="2.5">
              <title>${esc(p.rotulo)}: Receita ${dinheiro(p.val)}</title>
            </circle>`).join('')}
        ` : ''}

        ${pontosS.length ? `
          <path d="${dArea(pontosS)}" fill="url(#grad-gasto)"/>
          <path d="${dLinha(pontosS)}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
          ${pontosS.map((p) => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#ffffff" stroke="#f43f5e" stroke-width="2.5">
              <title>${esc(p.rotulo)}: Custo ${dinheiro(p.val)}</title>
            </circle>`).join('')}
        ` : ''}

        <!-- X Axis Labels -->
        ${labels.map((l) => `
          <text x="${l.x.toFixed(1)}" y="${h - 10}" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">
            ${esc(l.rotulo)}
          </text>`).join('')}
      </svg>
    </div>`;
}

function desenhaGraficoBarras(r, varios, de) {
  if (varios) {
    const meses = r.meses;
    const maior = Math.max(1, ...meses.flatMap((m) => [Number(m.entradas_centavos), Number(m.saidas_centavos)]));
    return `
      <div class="area-desenho-grafico">
        <div style="display:flex;align-items:flex-end;justify-content:space-around;gap:14px;min-height:190px;padding:16px 0 10px 0;width:100%">
          ${meses.map((m) => {
            const saldo = Number(m.saldo_centavos);
            const altE = Math.max(Number(m.entradas_centavos) / maior * 120, m.entradas_centavos > 0 ? 6 : 2);
            const altS = Math.max(Number(m.saidas_centavos) / maior * 120, m.saidas_centavos > 0 ? 6 : 2);
            return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:50px">
              <div style="display:flex;align-items:flex-end;gap:5px;height:120px">
                <div style="width:14px;height:${altE}px;background:#10b981;border-radius:4px 4px 0 0"
                     title="${mesCurto(m.mes)} - Receitas: ${dinheiro(m.entradas_centavos)}"></div>
                <div style="width:14px;height:${altS}px;background:#f43f5e;border-radius:4px 4px 0 0"
                     title="${mesCurto(m.mes)} - Gastos: ${dinheiro(m.saidas_centavos)}"></div>
              </div>
              <span class="badge-status ${saldo >= 0 ? 'aberta' : 'encerrada'}" style="font-size:0.7rem;padding:2px 6px">
                ${saldo >= 0 ? '+' : '−'}${dinheiroCurto(saldo)}
              </span>
              <span style="font-size:0.75rem;font-weight:700;color:var(--tinta-2)">${mesCurto(m.mes)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Single month day bars
  const [ano, m] = de.split('-').map(Number);
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const mapa = new Map(r.por_dia.map((d) => [Number(String(d.data).slice(8, 10)), Number(d.saidas_centavos)]));
  const maior = Math.max(1, ...mapa.values());
  let barrasHtml = '';

  for (let dia = 1; dia <= dias; dia++) {
    const val = mapa.get(dia) || 0;
    const altura = val ? Math.max((val / maior) * 110, 4) : 2;
    barrasHtml += `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:14px"
           title="Dia ${dia}: ${val ? dinheiro(val) : 'sem gastos'}">
        <div style="width:8px;height:${altura}px;background:${val ? '#f43f5e' : '#e2e8f0'};border-radius:3px 3px 0 0"></div>
        <span style="font-size:0.65rem;color:var(--tinta-3);margin-top:4px">${dia % 5 === 0 || dia === 1 ? dia : ''}</span>
      </div>`;
  }

  return `
    <div class="area-desenho-grafico">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;height:140px;padding-top:14px">
        ${barrasHtml}
      </div>
    </div>`;
}

function desenhaGraficoPizza(r) {
  const cats = r.saidas_por_categoria || [];
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
          ${fatiasSvg}
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
            <button class="btn-icone-filtro-panorama" type="button" id="p-btn-atalhos" title="Atalhos rápidos de período">
              ${icone('filtro')} <span>Atalhos</span>
            </button>
          </div>
        </div>
      </div>

      <div id="painel"><p class="carregando">Carregando indicadores da frota…</p></div>
    </div>`;

  const campoDe = alvo.querySelector('#p-de');
  const campoAte = alvo.querySelector('#p-ate');

  const atualiza = async () => {
    if (periodo.de > periodo.ate) [periodo.de, periodo.ate] = [periodo.ate, periodo.de];
    campoDe.value = periodo.de;
    campoAte.value = periodo.ate;

    const painel = document.getElementById('painel');
    painel.innerHTML = '<p class="carregando">Carregando indicadores da frota…</p>';
    const { de, ate } = periodo;
    const varios = de !== ate;
    document.getElementById('p-periodo').textContent = periodoLongo(de, ate);
    document.getElementById('p-pdf').href = endereco('pdf-panorama', { de, ate });

    let r;
    try {
      r = await api('GET', 'resumo', { de, ate });
    } catch (erro) {
      painel.innerHTML = `<div class="aviso erro">${esc(erro.message)}</div>`;
      return;
    }
    if (periodo.de !== de || periodo.ate !== ate) return;

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
              <span class="rotulo">A receber dos clientes ›</span>
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
              <span class="rotulo">Frete Faturado</span>
              <span class="valor entrada">${dinheiro(r.atual.entradas_centavos)}</span>
              <span class="subtexto">${r.viagens_abertas} ${r.viagens_abertas === 1 ? 'viagem em rota' : 'viagens em rota'}</span>
            </div>
          </div>

          <div class="card-kpi">
            <div class="icone-kpi vermelho">${icone('gasto')}</div>
            <div class="corpo-kpi">
              <span class="rotulo">Gastos Operacionais</span>
              <span class="valor saida">${dinheiro(r.atual.saidas_centavos)}</span>
              <span class="subtexto">${r.atual.qtd} despesas registradas</span>
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
              <h2 style="margin:0 0 4px">Evolução & Distribuição Financeira</h2>
              <p class="ajuda" style="margin:0 0 4px">Alterne entre visualização de Linha, Barras ou Distribuição em Pizza.</p>
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

    const kpiReceber = painel.querySelector('#kpi-a-receber');
    kpiReceber.onclick = () => abreAba('receber');
    kpiReceber.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abreAba('receber'); } };

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
    bAtalhos.onclick = () => {
      const atalhos = atalhosPeriodo();
      const { elemento, fechar } = janela('Atalhos de Período', `
        <div class="pilha">
          <p class="ajuda" style="margin-top:0">Selecione um período rápido para preencher o mês inicial e final:</p>
          <div class="lista-atalhos-periodo">
            ${atalhos.map((a, i) => {
              const ativo = a.de === periodo.de && a.ate === periodo.ate;
              return `
                <button type="button" class="item-atalho-periodo ${ativo ? 'ativo' : ''}" data-idx-atalho="${i}">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="ponto-atalho ${ativo ? 'ativo' : ''}"></span>
                    <strong>${esc(a.nome)}</strong>
                  </div>
                  <small style="color:var(--tinta-3)">${mesCurto(a.de)}${a.de !== a.ate ? ` → ${mesCurto(a.ate)}` : ''}</small>
                </button>`;
            }).join('')}
          </div>
        </div>`);

      elemento.querySelectorAll('[data-idx-atalho]').forEach((btn) => {
        btn.onclick = () => {
          const a = atalhos[Number(btn.dataset.idxAtalho)];
          periodo.de = a.de;
          periodo.ate = a.ate;
          fechar();
          atualiza();
        };
      });
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

async function telaAjustes(alvo) {
  const admin = ehAdmin();
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div>
          <h1>${admin ? 'Ajustes & Gestão da Frota' : 'Meu Perfil & Acesso'}</h1>
          <p>${esc(estado.usuario.nome)} - <strong style="color:var(--primaria)">${admin ? 'Proprietário' : 'Motorista'}</strong></p>
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

          <button type="button" class="btn-acordeon-categorias" id="b-toggle-categorias" aria-expanded="false">
            <div class="info-acordeon">
              <span class="icone-acordeon">${icone('lista')}</span>
              <span id="rotulo-acordeon-categorias">Categorias cadastradas</span>
            </div>
            <div class="seta-acordeon">
              <span class="texto-acao-acordeon" id="texto-estado-acordeon">Expandir</span>
              <span class="chevron-acordeon" id="icone-chevron-acordeon">▾</span>
            </div>
          </button>

          <div class="corpo-acordeon-categorias oculto" id="conteudo-acordeon-categorias" style="margin-top:14px">
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

      ${cartoesDoAparelho()}

      <div style="display:flex;justify-content:flex-end">
        <button class="btn perigo grande" type="button" id="b-sair">
          ${icone('fechar')} Encerrar Sessão e Sair
        </button>
      </div>
    </div>`;

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

      const filtradas = categorias.filter((c) => {
        if (filtroCategoriaAtivo === 'todos') return true;
        return c.tipo === filtroCategoriaAtivo;
      });

      if (!filtradas.length) {
        containerCats.innerHTML = '<div class="vazio" style="padding:24px 16px">Nenhuma categoria encontrada para este filtro.</div>';
        return;
      }

      containerCats.innerHTML = `
        <div class="grade-categorias-ajustes">
          ${filtradas.map((c) => {
            const qtd = Number(c.qtd_lancamentos) || 0;
            const ehEntrada = c.tipo === 'entrada';
            return `
            <div class="item-categoria-cartao ${Number(c.ativo) ? '' : 'inativa'}">
              <div class="cabecalho-categoria-cartao">
                <div class="icone-categoria-caixa ${c.tipo}">
                  ${icone(ehEntrada ? 'receber' : (c.pede_litros ? 'combustivel' : 'tag'))}
                </div>
                <div class="detalhes-categoria-cartao">
                  <strong>${esc(c.nome)}</strong>
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

      containerCats.querySelectorAll('[data-editar-categoria]').forEach((b) => {
        const c = categorias.find((x) => Number(x.id) === Number(b.dataset.editarCategoria));
        b.onclick = () => formCategoria(c, atualiza);
      });
      containerCats.querySelectorAll('[data-excluir-categoria]').forEach((b) => {
        const c = categorias.find((x) => Number(x.id) === Number(b.dataset.excluirCategoria));
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
      const u = usuarios.find((x) => Number(x.id) === Number(b.dataset.editarUsuario));
      b.onclick = () => formUsuario(u, atualiza);
    });
    alvo.querySelectorAll('[data-excluir-usuario]').forEach((b) => {
      const u = usuarios.find((x) => Number(x.id) === Number(b.dataset.excluirUsuario));
      b.onclick = () => excluiUsuario(u, atualiza);
    });

    // Wire Truck actions
    alvo.querySelectorAll('[data-editar-caminhao]').forEach((b) => {
      const c = caminhoes.find((x) => Number(x.id) === Number(b.dataset.editarCaminhao));
      b.onclick = () => formCaminhao(c, atualiza);
    });
    alvo.querySelectorAll('[data-excluir-caminhao]').forEach((b) => {
      const c = caminhoes.find((x) => Number(x.id) === Number(b.dataset.excluirCaminhao));
      b.onclick = () => excluiCaminhao(c, atualiza);
    });
  };

  alvo.querySelector('#b-usuario').onclick = () => formUsuario(null, atualiza);
  alvo.querySelector('#b-caminhao').onclick = () => formCaminhao(null, atualiza);
  alvo.querySelector('#b-categoria').onclick = () => formCategoria(null, atualiza);
  await atualiza();
}

function formUsuario(u, aoConcluir) {
  const novo = !u;
  const { elemento, fechar } = janela(novo ? 'Novo Motorista ou Acesso' : `Editar ${u.nome}`, `
    <form novalidate>
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
    <form novalidate>
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
  const { elemento, fechar } = janela(novo ? 'Nova Categoria Financeira' : `Editar Categoria ${c.nome}`, `
    <form novalidate>
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
      <div class="campo ${tipo === 'saida' ? '' : 'oculto'}" data-so-gasto>
        <label class="caixa-marcar">
          <input type="checkbox" name="oculta_motorista" value="1" ${Number(c?.oculta_motorista) ? 'checked' : ''}>
          <span>Esconder dos motoristas
            <small>Para gastos que só o escritório lança, como salário e diárias. O motorista não vê nem usa.</small>
          </span>
        </label>
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

  form.querySelectorAll('[data-tipo]').forEach((b) => {
    b.onclick = () => {
      form.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      form.elements.tipo.value = b.dataset.tipo;
      form.querySelector('[data-exemplo]').textContent = EXEMPLOS_CATEGORIA[b.dataset.tipo];
      form.querySelector('[data-so-gasto]').classList.toggle('oculto', b.dataset.tipo !== 'saida');
    };
  });

  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    dados.oculta_motorista = dados.oculta_motorista === '1';
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
  return `${v.origem} → ${v.destino}${v.inicio ? ` (saída ${dataDiaMes(v.inicio)})` : ''}`
    + `${ehAdmin() && v.motorista ? ` - ${v.motorista}` : ''}`;
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
    ['Caminhão', r.placa ? `${r.placa}${r.caminhao_apelido ? ` - ${r.caminhao_apelido}` : ''}` : null],
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
  elemento.querySelector('[data-editar]').onclick = () => { fechar(); formRecebivel(r, aoConcluir); };
  elemento.querySelector('[data-receber]')?.addEventListener('click', () => { fechar(); formRecebimento(r, aoConcluir); });
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
              <option value="${c.id}" ${Number(v.categoria_id) === Number(c.id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
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
              <option value="${x.id}" ${Number(v.viagem_id) === Number(x.id) ? 'selected' : ''}>${esc(rotuloViagem(x))}</option>`).join('')}
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
            <option value="${n.id}" ${Number(v.nota_fiscal_id) === Number(n.id) ? 'selected' : ''}>
              NF ${esc(n.numero || 'sem número')}${n.cliente ? ` - ${esc(n.cliente)}` : ''}${n.data ? ` (${dataCurta(n.data)})` : ''}
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
    const n = notas.find((x) => Number(x.id) === Number(form.elements.nota_fiscal_id.value));
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
    `<span>${dataCurta(n.data)}</span>`,
    n.viagem_origem ? `<span>${esc(n.viagem_origem)} → ${esc(n.viagem_destino)}</span>` : '',
    ehAdmin() || Number(n.usuario_id) !== Number(estado.usuario.id) ? `<span>enviada por ${esc(n.enviado_por)}</span>` : '',
  ].filter(Boolean).join('<span class="separador-ponto">·</span>');
  return `
    <div class="item-lancamento-moderno" data-nota="${n.id}" role="button" tabindex="0">
      <div class="icone-lancamento nota">${icone(ehPdf(n.arquivo) ? 'pdf' : 'nota')}</div>
      <div class="info-lancamento">
        <div class="topo-lancamento">
          <span class="nome-lancamento">NF ${esc(n.numero || 'sem número')}${n.cliente ? ` - ${esc(n.cliente)}` : ''}</span>
          ${n.placa ? `<span class="badge-placa">${esc(n.placa)}</span>` : ''}
          ${seloPrazo(n)}
          ${ehAdmin() && n.recebivel_id ? '<span class="tag-status-visivel">No a receber</span>' : ''}
        </div>
        <div class="meta-lancamento">${meta}</div>
      </div>
      <div class="valor-lancamento">
        ${n.valor_centavos != null ? `<span class="quantia">${dinheiro(n.valor_centavos)}</span>` : ''}
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
      abreNota(notas.find((n) => Number(n.id) === Number(el.dataset.nota)), atualiza);
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

function abreNota(n, aoConcluir) {
  const url = endereco('comprovante', { arquivo: n.arquivo });
  const pdf = ehPdf(n.arquivo);
  const linhas = [
    ['Número', n.numero || 'Sem número'],
    ['Cliente', n.cliente],
    ['Emissão', dataCurta(n.data)],
    ['Valor', n.valor_centavos != null ? dinheiro(n.valor_centavos) : null],
    ['Viagem', n.viagem_origem ? `${n.viagem_origem} → ${n.viagem_destino}` : null],
    ['Caminhão', n.placa ? `${n.placa}${n.caminhao_apelido ? ` - ${n.caminhao_apelido}` : ''}` : null],
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
      ${ehAdmin() ? (n.recebivel_id
        ? '<button class="btn principal" type="button" data-ver-receber>Ver frete a receber</button>'
        : `<button class="btn principal" type="button" data-criar-receber>${icone('aReceber')} Criar frete a receber</button>`) : ''}
    </div>`);

  vigiaPrazo(elemento, n);
  elemento.querySelector('[data-editar]')?.addEventListener('click', () => { fechar(); formNota(n, aoConcluir); });
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
  elemento.querySelector('[data-criar-receber]')?.addEventListener('click', () => {
    fechar();
    formRecebivel(null, aoConcluir, {
      cliente: n.cliente, valor_centavos: n.valor_centavos, data: n.data, viagem_id: n.viagem_id,
      caminhao_id: n.caminhao_id, nota_fiscal_id: n.id, nota_numero: n.numero, nota_cliente: n.cliente,
    });
  });
  elemento.querySelector('[data-ver-receber]')?.addEventListener('click', () => {
    fechar();
    abreRecebivel(n.recebivel_id, aoConcluir);
  });
}

// base: valores iniciais de uma nota nova (ex.: arquivo recebido pelo "Compartilhar").
function formNota(n, aoConcluir, base = {}) {
  const v = n || { data: hoje(), caminhao_id: estado.usuario.caminhao_padrao_id, ...base };
  const { elemento, fechar } = janela(n ? 'Editar nota fiscal' : 'Enviar nota fiscal', `
    <form class="form-pilha" novalidate>
      ${campoArquivo('nf-arquivo', 'Foto ou PDF da nota',
        'Tire uma foto nítida da nota inteira, ou escolha o PDF que o cliente mandou.',
        'arquivo', v.arquivo, n ? 'Manter o arquivo atual' : 'Nenhum arquivo escolhido')}
      <div class="linha duas">
        <div class="campo opcional">
          <label for="nf-numero">Número da nota</label>
          <input id="nf-numero" name="numero" maxlength="40" value="${esc(v.numero || '')}">
        </div>
        <div class="campo">
          <label for="nf-data">Data de emissão</label>
          <input id="nf-data" name="data" type="date" required value="${esc(v.data || hoje())}">
        </div>
      </div>
      <div class="campo opcional">
        <label for="nf-cliente">Cliente</label>
        <p class="dica">Nome da empresa ou pessoa da nota.</p>
        <input id="nf-cliente" name="cliente" maxlength="90" value="${esc(v.cliente || '')}">
      </div>
      <div class="linha duas">
        <div class="campo opcional">
          <label for="nf-valor">Valor da nota</label>
          <div class="valor-caixa">
            <span aria-hidden="true">R$</span>
            <input id="nf-valor" name="valor" inputmode="decimal" placeholder="0,00" value="${esc(valorParaCampo(v.valor_centavos))}">
          </div>
        </div>
        <div class="campo opcional">
          <label for="nf-caminhao">Caminhão</label>
          <select id="nf-caminhao" name="caminhao_id">
            ${opcoesCaminhao(v.caminhao_id, v.placa ? { id: v.caminhao_id, placa: v.placa, apelido: v.caminhao_apelido } : null)
              .replace('Selecione o caminhão', 'Sem caminhão')}
          </select>
        </div>
      </div>
      <div class="campo opcional">
        <label for="nf-viagem">Viagem</label>
        <select id="nf-viagem" name="viagem_id">
          ${opcoesViagem(v.viagem_id, v.viagem_origem
            ? { id: v.viagem_id, origem: v.viagem_origem, destino: v.viagem_destino } : null).replace('Fora de viagem', 'Sem viagem')}
        </select>
      </div>
      <div class="campo opcional">
        <label for="nf-obs">Observação</label>
        <textarea id="nf-obs" name="observacao" maxlength="500">${esc(v.observacao || '')}</textarea>
      </div>
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${n ? 'Salvar alterações' : 'Enviar nota'}</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  ligaArquivo(form, 'nf-arquivo', 'arquivo', n ? 'Manter o arquivo atual' : 'Nenhum arquivo escolhido');
  aoEnviar(form, async (dados) => {
    if (!dados.arquivo) throw new Error('Anexe a foto ou o PDF da nota fiscal.');
    const r = n ? await api('PUT', 'nota', { id: n.id }, dados) : await api('POST', 'notas', {}, dados);
    fechar();
    if (r?.offline) recado(GUARDADO_OFFLINE);
    else if (n) recado('Nota fiscal atualizada.');
    else if (ehAdmin()) recado('Nota fiscal guardada.');
    else recado(`Nota enviada ao escritório. Se errou algo, dá para corrigir nos próximos ${MINUTOS_PARA_CORRIGIR} minutos.`);
    await aoConcluir?.();
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
        <span class="quantia">${Number(d.valor_centavos) ? dinheiro(d.valor_centavos) : '<small>sem valor</small>'}</span>
        <span class="seta-acao">${icone('setaDireita')}</span>
      </div>
    </div>`;
}

async function telaDiarias(alvo) {
  const admin = ehAdmin();
  const filtro = { mes: hoje().slice(0, 7), usuario_id: '' };
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%">
          <div>
            <h1>${admin ? 'Diárias dos motoristas' : 'Minhas diárias'}</h1>
            <p>${admin
              ? 'Dias trabalhados por motorista, quanto vale a diária de cada um e o que falta pagar.'
              : 'Registre os dias que você trabalhou e acompanhe quanto tem para receber.'}</p>
          </div>
          <button class="btn principal" type="button" id="b-nova-diaria">
            ${icone('adicionar')} ${admin ? 'Lançar diárias' : 'Registrar dia trabalhado'}
          </button>
        </div>
      </div>

      <div class="cartao" style="padding:14px 16px">
        <div class="barra-filtros-tela">
          <div class="campo campo-mes">
            <label for="d-mes">Mês</label>
            <input id="d-mes" type="month" value="${filtro.mes}">
          </div>
          ${admin ? `
            <div class="campo">
              <label for="d-motorista">Motorista</label>
              <select id="d-motorista">
                <option value="">Todos os motoristas</option>
                ${motoristasAtivos().map((u) => `<option value="${u.id}">${esc(u.nome)}</option>`).join('')}
              </select>
            </div>` : ''}
        </div>
      </div>

      <div id="d-kpis"></div>
      <div id="d-motoristas"></div>
      <div id="d-lista"><p class="carregando">Carregando diárias…</p></div>
    </div>`;

  const atualiza = async () => {
    const r = await api('GET', 'diarias', filtro);
    const kpis = alvo.querySelector('#d-kpis');
    if (admin) {
      kpis.innerHTML = `
        <div class="grade-kpis">
          ${cartaoKpi('azul', 'calendario', 'Dias trabalhados', String(r.totais.dias),
            `${r.motoristas.filter((m) => m.dias).length} motorista(s) em ${mesCurto(r.mes)}`)}
          ${cartaoKpi('amarelo', 'saldo', 'Total do mês', dinheiro(r.totais.total_centavos), 'Soma das diárias do mês')}
          ${cartaoKpi('verde', 'check', 'Já pago', dinheiro(r.totais.pago_centavos), 'Diárias quitadas', 'entrada')}
          ${cartaoKpi('vermelho', 'gasto', 'Falta pagar', dinheiro(r.totais.pendente_centavos), 'Diárias pendentes do mês',
            r.totais.pendente_centavos ? 'saida' : '')}
        </div>`;
    } else {
      const m = r.motoristas[0] || { dias: 0, total_centavos: 0, pago_centavos: 0, pendente_centavos: 0 };
      const deOutrosMeses = (m.pendente_geral_centavos || 0) - m.pendente_centavos;
      kpis.innerHTML = `
        <div class="grade-kpis">
          ${cartaoKpi('azul', 'calendario', 'Dias trabalhados', String(m.dias), mesLongo(r.mes))}
          ${cartaoKpi('amarelo', 'saldo', 'Valor da diária',
            m.valor_diaria_centavos ? dinheiro(m.valor_diaria_centavos) : 'A combinar', 'Combinado com o escritório')}
          ${cartaoKpi('verde', 'receber', 'Total do mês', dinheiro(m.total_centavos),
            `${dinheiro(m.pago_centavos)} já pago`, 'entrada')}
          ${cartaoKpi('vermelho', 'relogio', 'A receber', dinheiro(m.pendente_centavos), 'Diárias do mês ainda não pagas')}
        </div>
        ${deOutrosMeses > 0 ? `
          <div class="aviso info" style="margin:12px 0 0">
            Você ainda tem ${dinheiro(deOutrosMeses)} de diárias de outros meses para receber.
          </div>` : ''}`;
    }

    const caixaMotoristas = alvo.querySelector('#d-motoristas');
    if (admin && r.motoristas.length) {
      caixaMotoristas.innerHTML = `
        <div class="cartao">
          <div class="secao-card-topo"><h2>Por motorista</h2></div>
          <div class="lista-ajustes-entidades">
            ${r.motoristas.map((m) => {
              const outros = m.pendente_geral_centavos - m.pendente_centavos;
              return `
              <div class="item-ajustes-entidade">
                <div style="display:flex;align-items:center;gap:12px;min-width:0">
                  <div class="avatar-usuario-ajustes">${iniciais(m.nome)}</div>
                  <div class="dados-entidade-ajustes">
                    <strong>${esc(m.nome)}</strong>
                    <small>${m.valor_diaria_centavos ? `Diária de ${dinheiro(m.valor_diaria_centavos)}` : 'Diária sem valor definido'}
                      • ${m.dias} ${m.dias === 1 ? 'dia' : 'dias'} • ${dinheiro(m.total_centavos)}</small>
                    <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                      ${m.pago_centavos ? `<span class="tag-status-visivel">Pago ${dinheiro(m.pago_centavos)}</span>` : ''}
                      ${m.pendente_centavos ? `<span class="tag-status-pendente">A pagar ${dinheiro(m.pendente_centavos)}</span>` : ''}
                      ${outros > 0 ? `<span class="tag-status-oculta">+ ${dinheiro(outros)} de outros meses</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="acoes-entidade-ajustes">
                  <button class="btn pequeno" type="button" data-valor-diaria="${m.usuario_id}">
                    ${icone('editar')} Editar diária
                  </button>
                  ${m.pendente_centavos ? `
                    <button class="btn principal pequeno" type="button" data-pagar="${m.usuario_id}">
                      ${icone('check')} Pagar ${dinheiro(m.pendente_centavos)}
                    </button>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      caixaMotoristas.querySelectorAll('[data-pagar]').forEach((b) => {
        const m = r.motoristas.find((x) => Number(x.usuario_id) === Number(b.dataset.pagar));
        const dias = r.itens.filter((d) => Number(d.usuario_id) === m.usuario_id && !d.pago).length;
        b.onclick = () => formPagamentoDiarias(m, r.mes, dias, atualiza);
      });
      caixaMotoristas.querySelectorAll('[data-valor-diaria]').forEach((b) => {
        const m = r.motoristas.find((x) => Number(x.usuario_id) === Number(b.dataset.valorDiaria));
        b.onclick = () => formValorDiaria(m, atualiza);
      });
    } else {
      caixaMotoristas.innerHTML = '';
    }

    const caixa = alvo.querySelector('#d-lista');
    caixa.innerHTML = r.itens.length ? `
      <div class="cartao" style="padding:12px 14px">
        <div class="secao-card-topo" style="padding:4px 6px 0"><h2>Dias registrados</h2></div>
        <div class="lista">${r.itens.map(itemDiaria).join('')}</div>
      </div>` : `
      <div class="vazio">
        ${icone('calendario')}
        <p style="margin-top:8px">Nenhuma diária registrada em ${mesLongo(r.mes)}.</p>
      </div>`;
    aoTocar(caixa, '[data-diaria]', (el) => {
      abreDiaria(r.itens.find((d) => Number(d.id) === Number(el.dataset.diaria)), atualiza);
    });
  };

  alvo.querySelector('#d-mes').onchange = (e) => { filtro.mes = e.target.value || hoje().slice(0, 7); atualiza(); };
  alvo.querySelector('#d-motorista')?.addEventListener('change', (e) => { filtro.usuario_id = e.target.value; atualiza(); });
  alvo.querySelector('#b-nova-diaria').onclick = () => formDiaria(null, atualiza);
  await atualiza();
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

function formDiaria(d, aoConcluir) {
  const admin = ehAdmin();
  const novo = !d;
  const motoristas = motoristasAtivos();
  if (admin && novo && !motoristas.length) {
    recado('Cadastre um motorista em Ajustes antes de lançar diárias.');
    return;
  }
  const diariaDe = (id) => {
    const u = admin ? estado.usuarios.find((x) => Number(x.id) === Number(id)) : estado.usuario;
    return u?.valor_diaria_centavos || null;
  };
  const padrao = diariaDe(d?.usuario_id || motoristas[0]?.id);

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
                 value="${esc(d?.data || hoje())}" ${admin ? '' : `max="${hoje()}"`}>
        </div>
        ${novo ? `
          <div class="campo opcional">
            <label for="df-ate">Até o dia</label>
            <input id="df-ate" name="ate" type="date" ${admin ? '' : `max="${hoje()}"`}>
            <p class="dica">Para registrar vários dias seguidos de uma vez.</p>
          </div>` : ''}
      </div>
      <div class="campo opcional">
        <label for="df-viagem">Viagem</label>
        <select id="df-viagem" name="viagem_id">
          ${opcoesViagem(d?.viagem_id, d?.viagem_origem
            ? { id: d.viagem_id, origem: d.viagem_origem, destino: d.viagem_destino } : null)}
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
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${novo ? 'Registrar' : 'Salvar alterações'}</button>
      </div>
    </form>`);

  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  form.elements.usuario_id?.addEventListener('change', () => {
    const valor = diariaDe(form.elements.usuario_id.value);
    form.elements.valor.placeholder = valorParaCampo(valor) || '0,00';
    form.querySelector('[data-dica-valor]').textContent = valor
      ? `Em branco, usa a diária cadastrada do motorista (${dinheiro(valor)}).`
      : 'Este motorista ainda não tem diária cadastrada em Ajustes.';
  });
  aoEnviar(form, async (dados) => {
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
            <option value="${c.id}" ${padrao && Number(padrao.id) === Number(c.id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
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
  const atual = hoje().slice(0, 7);
  const periodo = { de: atual, ate: atual };
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>Receita da empresa</h1>
        <p>Quanto a empresa recebeu de fretes. Aqui é só consulta: quem lança e corrige os valores é o proprietário.</p>
      </div>

      <div class="cartao painel-filtro-panorama-cartao">
        <div class="grade-filtro-panorama-limpo">
          <div class="campo campo-mes-de">
            <label for="rc-de">Mês inicial</label>
            <input id="rc-de" type="month" value="${periodo.de}">
          </div>
          <div class="campo campo-mes-ate">
            <label for="rc-ate">Mês final</label>
            <input id="rc-ate" type="month" value="${periodo.ate}">
          </div>
          <div class="campo acao-filtro-atalhos">
            <label class="rotulo-invisivel-alinhamento">&nbsp;</label>
            <button class="btn-icone-filtro-panorama" type="button" id="rc-atalhos" title="Atalhos rápidos de período">
              ${icone('filtro')} <span>Atalhos</span>
            </button>
          </div>
        </div>
      </div>

      <div id="rc-painel"><p class="carregando">Carregando receita…</p></div>
    </div>`;

  const campoDe = alvo.querySelector('#rc-de');
  const campoAte = alvo.querySelector('#rc-ate');

  const atualiza = async () => {
    if (periodo.de > periodo.ate) [periodo.de, periodo.ate] = [periodo.ate, periodo.de];
    campoDe.value = periodo.de;
    campoAte.value = periodo.ate;
    const { de, ate } = periodo;
    const painel = alvo.querySelector('#rc-painel');
    painel.innerHTML = '<p class="carregando">Carregando receita…</p>';
    const r = await api('GET', 'receita', { de, ate });
    if (periodo.de !== de || periodo.ate !== ate) return;

    const varios = de !== ate;
    const diferenca = r.total_centavos - r.anterior_centavos;
    const qtd = r.meses.reduce((s, m) => s + m.qtd, 0);
    const comMovimento = r.meses.filter((m) => m.qtd > 0).length || 1;
    painel.innerHTML = `
      <div class="pilha">
        <div class="card-hero-destaque">
          <div class="cabecalho-hero">
            <span class="subtitulo-hero">Receita recebida · ${esc(periodoLongo(de, ate))}</span>
            <span class="tag-hero positivo">Somente consulta</span>
          </div>
          <div class="valor-hero positivo">${dinheiro(r.total_centavos)}</div>
          <div class="variacao-hero">
            ${r.anterior_centavos
              ? `${diferenca >= 0 ? '▲' : '▼'} <strong>${dinheiro(Math.abs(diferenca))}</strong> ${diferenca >= 0 ? 'a mais' : 'a menos'} que em ${esc(periodoLongo(r.anterior_de, r.anterior_ate))}`
              : `Sem receita em ${esc(periodoLongo(r.anterior_de, r.anterior_ate))} para comparar.`}
          </div>
          <div class="mini-grid-hero">
            <div class="item-mini-hero">
              <span class="rotulo">A receber dos clientes</span>
              <span class="valor" style="color:#93c5fd">${dinheiro(r.a_receber.a_receber_centavos)}</span>
            </div>
            <div class="item-mini-hero">
              <span class="rotulo">Fretes recebidos</span>
              <span class="valor">${qtd}</span>
            </div>
            ${varios ? `
              <div class="item-mini-hero">
                <span class="rotulo">Média por mês</span>
                <span class="valor" style="color:#34d399">${dinheiro(Math.round(r.total_centavos / comMovimento))}</span>
              </div>` : ''}
          </div>
        </div>

        ${varios ? `
          <div class="cartao">
            <h2 style="margin:0 0 12px">Mês a mês</h2>
            ${barras(r.meses.map((m) => ({ ...m, nome: mesCurto(m.mes) })), (i) => esc(i.nome), 'entrada')}
          </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
          <div class="cartao">
            <h2 style="margin:0 0 12px">Por tipo de frete</h2>
            ${barras(r.por_categoria, (i) => esc(i.nome), 'entrada')}
          </div>
          <div class="cartao">
            <h2 style="margin:0 0 12px">Por caminhão</h2>
            ${barras(r.por_caminhao, (i) => esc(i.nome), 'entrada')}
          </div>
        </div>

        <div class="cartao" style="padding:12px 14px">
          <div class="secao-card-topo" style="padding:4px 6px 0"><h2>Fretes recebidos no período</h2></div>
          ${r.itens.length
            ? `<div class="lista">${r.itens.map((l) => itemLancamento({ ...l, tipo: 'entrada' }, true)).join('')}</div>`
            : '<div class="vazio" style="padding:20px">Nenhum frete recebido no período.</div>'}
        </div>
      </div>`;
  };

  campoDe.onchange = () => { periodo.de = campoDe.value || atual; atualiza(); };
  campoAte.onchange = () => { periodo.ate = campoAte.value || atual; atualiza(); };
  alvo.querySelector('#rc-atalhos').onclick = () => {
    const atalhos = atalhosPeriodo();
    const { elemento, fechar } = janela('Atalhos de Período', `
      <div class="lista-atalhos-periodo">
        ${atalhos.map((a, i) => `
          <button type="button" class="item-atalho-periodo ${a.de === periodo.de && a.ate === periodo.ate ? 'ativo' : ''}" data-idx-atalho="${i}">
            <strong>${esc(a.nome)}</strong>
            <small style="color:var(--tinta-3)">${mesCurto(a.de)}${a.de !== a.ate ? ` → ${mesCurto(a.ate)}` : ''}</small>
          </button>`).join('')}
      </div>`);
    elemento.querySelectorAll('[data-idx-atalho]').forEach((b) => {
      b.onclick = () => {
        Object.assign(periodo, atalhos[Number(b.dataset.idxAtalho)]);
        fechar();
        atualiza();
      };
    });
  };
  await atualiza();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(`sw.js?v=${encodeURIComponent(window.VERSAO_APP || '')}`, { updateViaCache: 'none' })
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
