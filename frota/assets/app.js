const app = document.getElementById('app');

const estado = {
  usuario: null,
  aba: null,
  categorias: [],
  caminhoes: [],
  usuarios: [],
  viagensAbertas: [],
  mes: hoje().slice(0, 7),
  filtros: {},
  meses: 12,
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

const TRACOS = {
  registrar: '<path d="M12 5v14M5 12h14"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  rota: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/>'
    + '<path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  panorama: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-8"/>',
  relatorio: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/>'
    + '<circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const svg = (nome) => `<svg class="ico-linha" viewBox="0 0 24 24" aria-hidden="true">${TRACOS[nome]}</svg>`;

const LOGO = '<img src="assets/logo.png" alt="" width="192" height="192">';

function endereco(rota, params = {}) {
  const p = new URLSearchParams({ r: rota });
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') p.set(chave, valor);
  }
  return `api.php?${p}`;
}

async function api(metodo, rota, params = {}, corpo = null) {
  const resposta = await fetch(endereco(rota, params), {
    method: metodo,
    headers: {
      'X-App-Frota': '1',
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
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
    throw new Error('O servidor respondeu de forma inesperada. Veja se o PHP está rodando.');
  }
  if (!resposta.ok) throw new Error(dados?.erro || 'Não foi possível concluir.');
  return dados;
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
          <input id="senha" name="senha" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn principal grande" type="submit">Entrar</button>
      </form>
    </div>`;
  aoEnviar(app.querySelector('form'), async (dados) => {
    if (!dados.usuario?.trim() || !dados.senha) throw new Error('Preencha usuário e senha.');
    estado.usuario = await api('POST', 'login', {}, dados);
    await iniciaApp();
  });
}

const ABAS_MOTORISTA = [
  { id: 'novo', ico: 'registrar', nome: 'Registrar' },
  { id: 'meus', ico: 'lista', nome: 'Meus gastos' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'perfil', ico: 'usuario', nome: 'Perfil' },
];
const ABAS_ADMIN = [
  { id: 'panorama', ico: 'panorama', nome: 'Panorama' },
  { id: 'lancamentos', ico: 'lista', nome: 'Lançamentos' },
  { id: 'relatorios', ico: 'relatorio', nome: 'Relatórios' },
  { id: 'viagens', ico: 'rota', nome: 'Viagens' },
  { id: 'ajustes', ico: 'ajustes', nome: 'Ajustes' },
];
const ehAdmin = () => estado.usuario?.papel === 'admin';
const abas = () => (ehAdmin() ? ABAS_ADMIN : ABAS_MOTORISTA);

async function iniciaApp() {
  document.body.classList.remove('tela-entrada');
  app.innerHTML = '<p class="carregando">Carregando…</p>';
  const [categorias, caminhoes, usuarios, viagens] = await Promise.all([
    api('GET', 'categorias'),
    api('GET', 'caminhoes'),
    api('GET', 'usuarios'),
    api('GET', 'viagens', { status: 'aberta', limite: 100 }),
  ]);
  estado.categorias = categorias;
  estado.caminhoes = caminhoes;
  estado.usuarios = usuarios;
  estado.viagensAbertas = viagens;
  estado.aba = estado.aba || abas()[0].id;
  desenhaEstrutura();
  await abreAba(estado.aba);
}

function desenhaEstrutura() {
  app.innerHTML = `
    <header class="topo">
      <div class="logo">${LOGO}</div>
      <div class="marca">
        <strong>${esc(window.NOME_SISTEMA || 'Controle da Frota')}</strong>
        <span>${esc(estado.usuario.nome)}</span>
      </div>
      <div class="espaco"></div>
      <div class="selo">${ehAdmin() ? 'Proprietário' : 'Motorista'}</div>
    </header>
    <nav class="nav" aria-label="Seções">
      ${abas().map((a) => `
        <button type="button" data-aba="${a.id}" aria-current="${a.id === estado.aba}">
          ${svg(a.ico)}<span>${esc(a.nome)}</span>
        </button>`).join('')}
    </nav>
    <main id="conteudo"><p class="carregando">Carregando…</p></main>`;
  app.querySelectorAll('.nav button').forEach((b) => {
    b.onclick = () => abreAba(b.dataset.aba);
  });
}

async function abreAba(id) {
  estado.aba = id;
  app.querySelectorAll('.nav button').forEach((b) => {
    b.setAttribute('aria-current', String(b.dataset.aba === id));
  });
  const alvo = document.getElementById('conteudo');
  alvo.innerHTML = '<p class="carregando">Carregando…</p>';
  window.scrollTo({ top: 0 });
  const telas = {
    novo: telaNovoGasto,
    meus: telaLancamentos,
    lancamentos: telaLancamentos,
    viagens: telaViagens,
    panorama: telaPanorama,
    relatorios: telaRelatorios,
    ajustes: telaAjustes,
    perfil: telaAjustes,
  };
  try {
    await telas[id](alvo);
  } catch (erro) {
    alvo.innerHTML = `<div class="aviso erro">${esc(erro.message)}</div>`;
  }
}

async function recarregaBasico() {
  const [categorias, caminhoes, usuarios, viagens] = await Promise.all([
    api('GET', 'categorias'),
    api('GET', 'caminhoes'),
    api('GET', 'usuarios'),
    api('GET', 'viagens', { status: 'aberta', limite: 100 }),
  ]);
  estado.categorias = categorias;
  estado.caminhoes = caminhoes;
  estado.usuarios = usuarios;
  estado.viagensAbertas = viagens;
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
        ${esc(c.placa)}${c.apelido ? ` — ${esc(c.apelido)}` : ''}
      </option>`),
  ].join('');
}

function opcoesViagem(selecionado, extra) {
  return [
    '<option value="">Fora de viagem</option>',
    ...comOExtra(estado.viagensAbertas, extra).map((v) => `
      <option value="${v.id}" ${Number(selecionado) === Number(v.id) ? 'selected' : ''}>
        ${esc(v.origem)} → ${esc(v.destino)}${v.inicio ? ` (saída ${dataDiaMes(v.inicio)})` : ''}
      </option>`),
  ].join('');
}

function opcoesMotorista(selecionado) {
  return estado.usuarios.filter((u) => Number(u.ativo)).map((u) => `
    <option value="${u.id}" ${Number(selecionado) === Number(u.id) ? 'selected' : ''}>
      ${esc(u.nome)}${u.papel === 'admin' ? ' (proprietário)' : ''}
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
          ${opcoesCaminhao(l.caminhao_id, l.placa
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
      <input id="c-foto" type="file" accept="image/*,application/pdf" capture="environment">
      <input type="hidden" name="comprovante" value="${esc(l.comprovante || '')}">
      <p class="aviso ok oculto" data-se="foto"></p>
    </div>`;
}

async function reduzFoto(arquivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 400 * 1024) return arquivo;
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(imagem.width, imagem.height));
    const tela = document.createElement('canvas');
    tela.width = Math.round(imagem.width * escala);
    tela.height = Math.round(imagem.height * escala);
    tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
    const blob = await new Promise((pronto) => tela.toBlob(pronto, 'image/jpeg', 0.8));
    return blob && blob.size < arquivo.size
      ? new File([blob], 'comprovante.jpg', { type: 'image/jpeg' })
      : arquivo;
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
  campoFoto.addEventListener('change', async () => {
    if (!campoFoto.files?.[0]) return;
    avisoFoto.textContent = 'Enviando foto…';
    avisoFoto.classList.remove('oculto');
    const arquivo = await reduzFoto(campoFoto.files[0]);
    if (arquivo.size > 8 * 1024 * 1024) {
      avisoFoto.classList.add('oculto');
      mostraErro(form, 'A foto é muito grande (máximo 8 MB).');
      campoFoto.value = '';
      return;
    }
    try {
      const corpo = new FormData();
      corpo.append('foto', arquivo);
      const resposta = await fetch(endereco('comprovante'), {
        method: 'POST',
        headers: { 'X-App-Frota': '1' },
        body: corpo,
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro);
      form.elements.comprovante.value = dados.comprovante;
      avisoFoto.textContent = 'Comprovante anexado.';
    } catch (erro) {
      avisoFoto.classList.add('oculto');
      mostraErro(form, erro.message || 'Não foi possível enviar a foto.');
      campoFoto.value = '';
    }
  });

  if (form.elements.comprovante.value) {
    avisoFoto.textContent = 'Comprovante já anexado.';
    avisoFoto.classList.remove('oculto');
  }
}

function validaLancamento(dados, tipo) {
  if (!dados.categoria_id) {
    throw new Error(tipo === 'entrada' ? 'Escolha o tipo de frete.' : 'Escolha o tipo de gasto.');
  }
  if (!String(dados.valor || '').trim()) throw new Error('Informe o valor.');
  return dados;
}

function abreFormLancamento(tipo, lancamento, aoConcluir) {
  const titulo = lancamento
    ? (tipo === 'entrada' ? 'Editar entrada' : 'Editar gasto')
    : (tipo === 'entrada' ? 'Nova entrada (frete)' : 'Novo gasto');
  const { elemento, fechar } = janela(titulo, `
    <form novalidate>
      ${camposLancamento(tipo, lancamento || {})}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${lancamento ? 'Salvar alterações' : 'Salvar'}</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  ligaCamposLancamento(form);
  aoEnviar(form, async (dados) => {
    validaLancamento(dados, tipo);
    if (lancamento) await api('PUT', 'lancamento', { id: lancamento.id }, dados);
    else await api('POST', 'lancamentos', {}, dados);
    fechar();
    recado(lancamento ? 'Lançamento atualizado.' : 'Lançamento salvo.');
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
    await api('POST', 'lancamentos', {}, dados);
    localStorage.setItem('ultimo_caminhao', dados.caminhao_id || '');
    recado('Gasto salvo.');
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
  const r = await api('GET', 'lancamentos', { de: hoje(), ate: hoje(), limite: 5 });
  if (!r.qtd) { caixa.innerHTML = ''; return; }
  caixa.innerHTML = `
    <div class="cartao">
      <h2>Registrado hoje</h2>
      <p class="ajuda">${r.qtd} ${r.qtd === 1 ? 'gasto' : 'gastos'} — total ${dinheiro(r.saidas_centavos)}</p>
      <div class="lista">${r.itens.map(itemLancamento).join('')}</div>
    </div>`;
  ligaItens(caixa);
}

function itemLancamento(l) {
  const entrada = l.tipo === 'entrada';
  const detalhes = [
    l.placa || null,
    ehAdmin() ? l.motorista : null,
    l.viagem_origem ? `${l.viagem_origem} → ${l.viagem_destino}` : null,
    l.litros ? `${numero(l.litros)} L` : null,
    l.cliente || null,
  ].filter(Boolean).join(' • ');
  return `
    <button class="item" type="button" data-lancamento="${l.id}">
      <span class="corpo">
        <strong>${esc(l.descricao || l.categoria)}</strong>
        <small>${dataCurta(l.data)}${detalhes ? ` • ${esc(detalhes)}` : ''}</small>
      </span>
      <span class="dinheiro ${entrada ? 'entrada' : ''}">
        ${entrada ? '+' : '−'} ${dinheiro(l.valor_centavos)}
      </span>
      <span class="seta" aria-hidden="true">›</span>
    </button>`;
}

function ligaItens(raiz) {
  raiz.querySelectorAll('[data-lancamento]').forEach((b) => {
    b.onclick = () => abreLancamento(Number(b.dataset.lancamento));
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
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>${admin ? 'Lançamentos' : 'Meus gastos'}</h1>
        <p id="rotulo-mes">${mesLongo(estado.mes)}</p>
      </div>
      ${admin ? `
        <div class="acoes duas">
          <button class="btn principal" type="button" id="b-gasto">Novo gasto</button>
          <button class="btn principal" type="button" id="b-entrada">Nova entrada</button>
        </div>` : ''}
      <div class="cartao">
        <div class="filtros">
          <div class="campo">
            <label for="f-mes">Mês</label>
            <input id="f-mes" type="month" value="${estado.mes}">
          </div>
          ${admin ? `
            <div class="campo">
              <label for="f-tipo">Mostrar</label>
              <select id="f-tipo">
                <option value="">Entradas e saídas</option>
                <option value="saida" ${estado.filtros.tipo === 'saida' ? 'selected' : ''}>Somente saídas</option>
                <option value="entrada" ${estado.filtros.tipo === 'entrada' ? 'selected' : ''}>Somente entradas</option>
              </select>
            </div>
            <div class="campo">
              <label for="f-motorista">Motorista</label>
              <select id="f-motorista">
                <option value="">Todos</option>
                ${opcoesMotorista(estado.filtros.usuario_id)}
              </select>
            </div>
            <div class="campo">
              <label for="f-caminhao">Caminhão</label>
              <select id="f-caminhao">
                <option value="">Todos</option>
                ${estado.caminhoes.map((c) => `
                  <option value="${c.id}" ${String(estado.filtros.caminhao_id) === String(c.id) ? 'selected' : ''}>
                    ${esc(c.placa)}</option>`).join('')}
              </select>
            </div>` : ''}
          <div class="campo">
            <label for="f-categoria">Categoria</label>
            <select id="f-categoria">
              <option value="">Todas</option>
              ${[['saida', 'Saídas'], ['entrada', 'Entradas']].map(([tipo, grupo]) => {
                const lista = categoriasDoTipo(tipo);
                return lista.length ? `<optgroup label="${grupo}">${lista.map((c) => `
                  <option value="${c.id}" ${String(estado.filtros.categoria_id) === String(c.id) ? 'selected' : ''}>
                    ${esc(c.nome)}</option>`).join('')}</optgroup>` : '';
              }).join('')}
            </select>
          </div>
        </div>
        ${admin ? `
          <div class="acoes" style="margin-top:14px">
            <a class="btn" id="b-csv" href="#">Baixar planilha do filtro</a>
          </div>` : ''}
      </div>
      <div id="lista"><p class="carregando">Carregando…</p></div>
    </div>`;

  const atualiza = async () => {
    const caixa = document.getElementById('lista');
    caixa.innerHTML = '<p class="carregando">Carregando…</p>';
    const r = await api('GET', 'lancamentos', filtrosAtuais());
    const csv = document.getElementById('b-csv');
    if (csv) csv.href = endereco('csv', filtrosAtuais());
    if (!r.qtd) {
      caixa.innerHTML = `
        <div class="vazio">
          Nenhum lançamento neste mês.
        </div>`;
      return;
    }
    const saldo = r.saldo_centavos;
    caixa.innerHTML = `
      <div class="cartao">
        <div class="grade" style="margin-bottom:14px">
          ${admin ? `
            <div class="mini">
              <div class="rotulo">Entradas</div>
              <div class="numero entrada">${dinheiro(r.entradas_centavos)}</div>
            </div>` : ''}
          <div class="mini">
            <div class="rotulo">${admin ? 'Saídas' : 'Total gasto'}</div>
            <div class="numero ${admin ? 'saida' : ''}">${dinheiro(r.saidas_centavos)}</div>
            <small>${r.qtd} ${r.qtd === 1 ? 'lançamento' : 'lançamentos'}</small>
          </div>
          ${admin ? `
            <div class="mini">
              <div class="rotulo">Saldo</div>
              <div class="numero ${saldo >= 0 ? 'entrada' : 'saida'}">
                ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
              </div>
            </div>` : ''}
        </div>
        <div class="lista">${r.itens.map(itemLancamento).join('')}</div>
      </div>`;
    ligaItens(caixa);
  };

  alvo.querySelector('#f-mes').onchange = (e) => {
    estado.mes = e.target.value || hoje().slice(0, 7);
    document.getElementById('rotulo-mes').textContent = mesLongo(estado.mes);
    atualiza();
  };
  alvo.querySelector('#f-categoria').onchange = (e) => {
    estado.filtros.categoria_id = e.target.value;
    atualiza();
  };
  if (admin) {
    alvo.querySelector('#f-tipo').onchange = (e) => {
      estado.filtros.tipo = e.target.value;
      atualiza();
    };
    alvo.querySelector('#f-motorista').onchange = (e) => {
      estado.filtros.usuario_id = e.target.value;
      atualiza();
    };
    alvo.querySelector('#f-caminhao').onchange = (e) => {
      estado.filtros.caminhao_id = e.target.value;
      atualiza();
    };
    alvo.querySelector('#b-gasto').onclick = () => abreFormLancamento('saida', null, atualiza);
    alvo.querySelector('#b-entrada').onclick = () => abreFormLancamento('entrada', null, atualiza);
  }
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
    ['Caminhão', l.placa ? `${l.placa}${l.caminhao_apelido ? ` — ${l.caminhao_apelido}` : ''}` : '—'],
    ['Viagem', l.viagem_origem ? `${l.viagem_origem} → ${l.viagem_destino}` : 'Fora de viagem'],
    ['Litros', l.litros ? `${numero(l.litros)} L` : null],
    ['Preço por litro', l.litros ? dinheiro(l.valor_centavos / l.litros) : null],
    ['Km do painel', l.km ? numero(l.km) : null],
    ['Quem pagou', l.cliente],
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
    <div class="acoes fim" style="margin-top:16px">
      <button class="btn perigo" type="button" data-excluir>Excluir</button>
      <button class="btn principal" type="button" data-editar>Editar</button>
    </div>`);

  const recarrega = () => abreAba(estado.aba);
  elemento.querySelector('[data-editar]').onclick = () => {
    fechar();
    abreFormLancamento(l.tipo, l, recarrega);
  };
  elemento.querySelector('[data-excluir]').onclick = async () => {
    if (!confirm('Excluir este lançamento? Não dá para desfazer.')) return;
    await api('DELETE', 'lancamento', { id: l.id });
    fechar();
    recado('Lançamento excluído.');
    await recarrega();
  };
}

async function telaViagens(alvo) {
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>Viagens</h1>
        <p>Abra uma viagem para somar os gastos e o frete dela.</p>
      </div>
      <button class="btn principal grande" type="button" id="b-nova">Nova viagem</button>
      <div id="lista-viagens"><p class="carregando">Carregando…</p></div>
    </div>`;

  const atualiza = async () => {
    estado.viagensAbertas = await api('GET', 'viagens', { status: 'aberta', limite: 100 });
    const caixa = document.getElementById('lista-viagens');
    const viagens = await api('GET', 'viagens', { limite: 300 });
    if (!viagens.length) {
      caixa.innerHTML = `
        <div class="vazio">
          Nenhuma viagem registrada ainda.
        </div>`;
      return;
    }
    caixa.innerHTML = `
      <div class="cartao">
        <div class="lista">
          ${viagens.map((v) => {
            const saldo = Number(v.entradas_centavos) - Number(v.saidas_centavos);
            return `
            <button class="item" type="button" data-viagem="${v.id}">
              <span class="corpo">
                <strong>${esc(v.origem)} → ${esc(v.destino)}</strong>
                <small>
                  ${dataCurta(v.inicio)}${v.fim ? ` a ${dataCurta(v.fim)}` : ''}
                  ${v.placa ? ` • ${esc(v.placa)}` : ''}
                  ${ehAdmin() ? ` • ${esc(v.motorista)}` : ''}
                  • gastos ${dinheiro(v.saidas_centavos)}
                </small>
              </span>
              ${v.status === 'aberta' ? '<span class="etiqueta aberta">Em andamento</span>' : ''}
              ${ehAdmin() ? `
                <span class="dinheiro ${saldo >= 0 ? 'entrada' : ''}">
                  ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
                </span>` : ''}
              <span class="seta" aria-hidden="true">›</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    caixa.querySelectorAll('[data-viagem]').forEach((b) => {
      const v = viagens.find((x) => Number(x.id) === Number(b.dataset.viagem));
      b.onclick = () => abreViagem(v, atualiza);
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
    if (viagem) await api('PUT', 'viagem', { id: viagem.id }, dados);
    else await api('POST', 'viagens', {}, dados);
    fechar();
    recado(viagem ? 'Viagem atualizada.' : 'Viagem aberta.');
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
        <div class="lista">${r.itens.map(itemLancamento).join('')}</div>
      </div>` : `
      <div class="vazio" style="margin-top:14px">Nenhum lançamento nesta viagem ainda.</div>`}
    <div class="acoes fim" style="margin-top:16px">
      ${ehAdmin() ? '<button class="btn perigo" type="button" data-excluir>Excluir</button>' : ''}
      <button class="btn" type="button" data-editar>Editar</button>
      ${v.status === 'aberta' ? `
        <button class="btn principal" type="button" data-encerrar>Encerrar viagem</button>` : ''}
    </div>`);

  ligaItens(elemento);
  elemento.querySelector('[data-editar]').onclick = () => {
    fechar();
    abreFormViagem(v, aoConcluir);
  };
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
      await api('POST', 'viagem-encerrar', { id: v.id }, dados);
      j.fechar();
      recado('Viagem encerrada.');
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

function barras(itens, rotulo = (i) => esc(i.nome)) {
  if (!itens.length) return '<p class="ajuda">Sem lançamentos neste período.</p>';
  const maior = Math.max(...itens.map((i) => Number(i.total_centavos)));
  return `
    <div class="barras">
      ${itens.map((i) => `
        <div class="linha-barra">
          <div class="rotulo-barra">
            <span>${rotulo(i)}</span>
            <b>${dinheiro(i.total_centavos)}</b>
          </div>
          <div class="trilha">
            <div class="preenche"
                 style="width:${Math.max((Number(i.total_centavos) / maior) * 100, 1.5)}%"></div>
          </div>
          <div class="qtd">${i.qtd} ${Number(i.qtd) === 1 ? 'lançamento' : 'lançamentos'}</div>
        </div>`).join('')}
    </div>`;
}

function colunasPorDia(mes, porDia) {
  const [ano, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const mapa = new Map(porDia.map((d) => [Number(String(d.data).slice(8, 10)), Number(d.saidas_centavos)]));
  const maior = Math.max(1, ...mapa.values());
  let colunas = '';
  for (let dia = 1; dia <= dias; dia += 1) {
    const valor = mapa.get(dia) || 0;
    const altura = valor ? Math.max((valor / maior) * 100, 3) : 1.5;
    colunas += `
      <div class="col ${valor ? '' : 'zero'}"
           title="Dia ${dia}: ${valor ? dinheiro(valor) : 'sem gastos'}">
        <i style="height:${altura}%"></i>
      </div>`;
  }
  return `
    <div class="colunas" role="img"
         aria-label="Gastos por dia de ${mesLongo(mes)}. Maior dia: ${dinheiro(maior)}.">
      ${colunas}
    </div>
    <div class="eixo">
      <span>dia 1</span><span>dia ${Math.round(dias / 2)}</span><span>dia ${dias}</span>
    </div>`;
}

function graficoMeses(meses) {
  const maior = Math.max(1, ...meses.flatMap((m) => [
    Number(m.entradas_centavos), Number(m.saidas_centavos),
  ]));
  return `
    <div class="legenda">
      <span><i class="marca-entrada"></i> Entradas</span>
      <span><i class="marca-saida"></i> Saídas</span>
    </div>
    <div class="tabela-rolagem">
      <div class="grafico-meses">
        ${meses.map((m) => {
          const saldo = Number(m.saldo_centavos);
          const alturaE = Math.max((Number(m.entradas_centavos) / maior) * 100, m.entradas_centavos > 0 ? 3 : 1);
          const alturaS = Math.max((Number(m.saidas_centavos) / maior) * 100, m.saidas_centavos > 0 ? 3 : 1);
          return `
          <div class="mes-grupo">
            <div class="par">
              <i class="entrada" style="height:${alturaE}%"
                 title="${mesCurto(m.mes)} — entradas ${dinheiro(m.entradas_centavos)}"></i>
              <i class="saida" style="height:${alturaS}%"
                 title="${mesCurto(m.mes)} — saídas ${dinheiro(m.saidas_centavos)}"></i>
            </div>
            <div class="saldo-mes ${saldo >= 0 ? 'positivo' : 'negativo'}"
                 title="Saldo de ${mesCurto(m.mes)}: ${dinheiro(saldo)}">
              ${saldo >= 0 ? '+' : ''}${dinheiroCurto(saldo)}
            </div>
            <div class="rotulo-mes">${mesCurto(m.mes)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function telaPanorama(alvo) {
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>Panorama do mês</h1>
        <p id="p-mes">${mesLongo(estado.mes)}</p>
      </div>
      <div class="cartao">
        <div class="filtros">
          <div class="campo">
            <label for="p-seletor">Mês</label>
            <input id="p-seletor" type="month" value="${estado.mes}">
          </div>
          <div class="acoes">
            <a class="btn" id="p-csv" href="#">Baixar planilha do mês</a>
          </div>
        </div>
      </div>
      <div id="painel"><p class="carregando">Carregando…</p></div>
    </div>`;

  const atualiza = async () => {
    const painel = document.getElementById('painel');
    painel.innerHTML = '<p class="carregando">Carregando…</p>';
    document.getElementById('p-mes').textContent = mesLongo(estado.mes);
    document.getElementById('p-csv').href = endereco('csv', { mes: estado.mes });
    const r = await api('GET', 'resumo', { mes: estado.mes });

    const saldo = r.atual.saldo_centavos;
    const saldoAnterior = r.anterior.saldo_centavos;
    const diferenca = saldo - saldoAnterior;
    const precoLitro = r.litros > 0 ? r.combustivel_centavos / r.litros : null;
    const comparacao = r.anterior.qtd
      ? `${diferenca >= 0 ? '▲' : '▼'} <b>${dinheiro(Math.abs(diferenca))}</b>
         ${diferenca >= 0 ? 'melhor' : 'pior'} que ${mesLongo(r.mes_anterior)}
         (saldo de ${dinheiro(saldoAnterior)})`
      : `Sem lançamentos em ${mesLongo(r.mes_anterior)} para comparar.`;

    painel.innerHTML = `
      <div class="pilha">
        <div class="destaque">
          <div class="rotulo">Saldo de ${mesLongo(estado.mes)}</div>
          <div class="numero ${saldo >= 0 ? 'positivo' : 'negativo'}">
            ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
          </div>
          <div class="variacao">${comparacao}</div>
        </div>

        <div class="grade">
          <div class="mini">
            <div class="rotulo">Entradas (fretes)</div>
            <div class="numero entrada">${dinheiro(r.atual.entradas_centavos)}</div>
          </div>
          <div class="mini">
            <div class="rotulo">Saídas (gastos)</div>
            <div class="numero saida">${dinheiro(r.atual.saidas_centavos)}</div>
          </div>
          <div class="mini">
            <div class="rotulo">Combustível</div>
            <div class="numero">${dinheiro(r.combustivel_centavos)}</div>
            <small>${r.atual.saidas_centavos
              ? `${Math.round((r.combustivel_centavos / r.atual.saidas_centavos) * 100)}% das saídas`
              : 'sem gastos'}</small>
          </div>
          <div class="mini">
            <div class="rotulo">Litros</div>
            <div class="numero">${numero(r.litros)}</div>
            <small>${precoLitro ? `${dinheiro(precoLitro)} por litro` : 'sem abastecimentos'}</small>
          </div>
          <div class="mini">
            <div class="rotulo">Lançamentos</div>
            <div class="numero">${r.atual.qtd}</div>
            <small>${r.viagens_abertas} ${r.viagens_abertas === 1 ? 'viagem aberta' : 'viagens abertas'}</small>
          </div>
        </div>

        <div class="cartao">
          <h2>Gastos por dia</h2>
          <p class="ajuda">Cada coluna é um dia do mês.</p>
          ${colunasPorDia(estado.mes, r.por_dia)}
        </div>

        <div class="cartao">
          <h2>Saídas por categoria</h2>
          ${barras(r.saidas_por_categoria, (i) => esc(i.nome))}
        </div>

        <div class="cartao">
          <h2>Entradas por tipo de frete</h2>
          ${barras(r.entradas_por_categoria, (i) => esc(i.nome))}
        </div>

        <div class="cartao">
          <h2>Por caminhão</h2>
          <div class="tabela-rolagem">
            <table class="dados">
              <thead>
                <tr><th>Caminhão</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr>
              </thead>
              <tbody>
                ${r.por_caminhao.length ? r.por_caminhao.map((c) => {
                  const s = Number(c.entradas_centavos) - Number(c.saidas_centavos);
                  return `
                  <tr>
                    <td>${esc(c.placa)}${c.apelido ? `<br><small style="color:var(--tinta-3)">${esc(c.apelido)}</small>` : ''}</td>
                    <td>${dinheiro(c.entradas_centavos)}</td>
                    <td>${dinheiro(c.saidas_centavos)}</td>
                    <td class="${s >= 0 ? 'positivo' : 'negativo'}">${s >= 0 ? '' : '−'}${dinheiro(Math.abs(s))}</td>
                  </tr>`;
                }).join('') : '<tr><td colspan="4">Sem lançamentos neste mês.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="cartao">
          <h2>Gastos por motorista</h2>
          ${barras(r.por_motorista, (i) => esc(i.nome))}
        </div>
      </div>`;
  };

  alvo.querySelector('#p-seletor').onchange = (e) => {
    estado.mes = e.target.value || hoje().slice(0, 7);
    atualiza();
  };
  await atualiza();
}

async function telaRelatorios(alvo) {
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>Relatórios</h1>
        <p id="r-periodo"></p>
      </div>
      <div class="cartao">
        <div class="filtros">
          <div class="campo">
            <label for="r-meses">Período</label>
            <select id="r-meses">
              <option value="3">Últimos 3 meses</option>
              <option value="6">Últimos 6 meses</option>
              <option value="12" selected>Últimos 12 meses</option>
              <option value="24">Últimos 24 meses</option>
            </select>
          </div>
          <div class="acoes">
            <a class="btn" id="r-csv" href="#">Baixar planilha do período</a>
          </div>
        </div>
      </div>
      <div id="painel-relatorio"><p class="carregando">Carregando…</p></div>
    </div>`;

  const atualiza = async () => {
    const painel = document.getElementById('painel-relatorio');
    painel.innerHTML = '<p class="carregando">Carregando…</p>';
    const meses = estado.meses;
    const de = (() => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (meses - 1));
      return d.toISOString().slice(0, 10);
    })();
    const ate = hoje();

    const [historico, relatorio] = await Promise.all([
      api('GET', 'historico', { meses }),
      api('GET', 'relatorio', { de, ate }),
    ]);

    document.getElementById('r-periodo').textContent =
      `${mesLongo(de.slice(0, 7))} até ${mesLongo(ate.slice(0, 7))}`;
    document.getElementById('r-csv').href = endereco('csv', { de, ate, limite: 1000 });

    const totalEntradas = historico.meses.reduce((s, m) => s + Number(m.entradas_centavos), 0);
    const totalSaidas = historico.meses.reduce((s, m) => s + Number(m.saidas_centavos), 0);
    const saldo = totalEntradas - totalSaidas;
    const comMovimento = historico.meses.filter((m) => m.qtd > 0).length || 1;

    painel.innerHTML = `
      <div class="pilha">
        <div class="destaque">
          <div class="rotulo">Saldo do período</div>
          <div class="numero ${saldo >= 0 ? 'positivo' : 'negativo'}">
            ${saldo >= 0 ? '' : '−'}${dinheiro(Math.abs(saldo))}
          </div>
          <div class="variacao">
            Entradas <b>${dinheiro(totalEntradas)}</b> · Saídas <b>${dinheiro(totalSaidas)}</b>
            · média de <b>${dinheiro(Math.round(saldo / comMovimento))}</b> por mês
          </div>
        </div>

        <div class="cartao">
          <h2>Entradas e saídas mês a mês</h2>
          <p class="ajuda">O número embaixo de cada mês é o saldo (entradas menos saídas).</p>
          ${graficoMeses(historico.meses)}
        </div>

        <div class="cartao">
          <h2>Mês a mês em números</h2>
          <div class="tabela-rolagem">
            <table class="dados">
              <thead>
                <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Lanç.</th></tr>
              </thead>
              <tbody>
                ${[...historico.meses].reverse().map((m) => `
                  <tr>
                    <td>${mesCurto(m.mes)}</td>
                    <td>${dinheiro(m.entradas_centavos)}</td>
                    <td>${dinheiro(m.saidas_centavos)}</td>
                    <td class="${m.saldo_centavos >= 0 ? 'positivo' : 'negativo'}">
                      ${m.saldo_centavos >= 0 ? '' : '−'}${dinheiro(Math.abs(m.saldo_centavos))}
                    </td>
                    <td>${m.qtd}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="cartao">
          <h2>Cada caminhão no período</h2>
          <div class="tabela-rolagem">
            <table class="dados">
              <thead>
                <tr>
                  <th>Caminhão</th><th>Entradas</th><th>Saídas</th><th>Saldo</th>
                  <th>Combustível</th><th>Litros</th><th>R$/litro</th><th>Km</th><th>Km/litro</th>
                </tr>
              </thead>
              <tbody>
                ${relatorio.por_caminhao.length ? relatorio.por_caminhao.map((c) => {
                  const litros = Number(c.litros);
                  const km = Number(c.km_rodados);
                  const precoLitro = litros > 0 ? Number(c.combustivel_centavos) / litros : null;
                  return `
                  <tr>
                    <td>${esc(c.placa)}${c.apelido ? `<br><small style="color:var(--tinta-3)">${esc(c.apelido)}</small>` : ''}</td>
                    <td>${dinheiro(c.entradas_centavos)}</td>
                    <td>${dinheiro(c.saidas_centavos)}</td>
                    <td class="${c.saldo_centavos >= 0 ? 'positivo' : 'negativo'}">
                      ${c.saldo_centavos >= 0 ? '' : '−'}${dinheiro(Math.abs(c.saldo_centavos))}
                    </td>
                    <td>${dinheiro(c.combustivel_centavos)}</td>
                    <td>${litros ? numero(litros) : '—'}</td>
                    <td>${precoLitro ? dinheiro(precoLitro) : '—'}</td>
                    <td>${km ? numero(km) : '—'}</td>
                    <td>${km && litros ? numero(km / litros) : '—'}</td>
                  </tr>`;
                }).join('') : '<tr><td colspan="9">Nenhum caminhão cadastrado.</td></tr>'}
              </tbody>
            </table>
          </div>
          <p class="ajuda" style="margin:12px 0 0">
            Km e km/litro só aparecem quando as viagens têm o km de saída e de chegada preenchidos.
          </p>
        </div>

        <div class="cartao">
          <h2>Saídas por categoria no período</h2>
          ${barras(relatorio.saidas_por_categoria, (i) => esc(i.nome))}
        </div>

        <div class="cartao">
          <h2>Entradas por tipo de frete no período</h2>
          ${barras(relatorio.entradas_por_categoria, (i) => esc(i.nome))}
        </div>

        <div class="cartao">
          <h2>Gastos por motorista no período</h2>
          ${barras(relatorio.por_motorista, (i) => esc(i.nome))}
        </div>
      </div>`;
  };

  const seletor = alvo.querySelector('#r-meses');
  seletor.value = String(estado.meses);
  seletor.onchange = (e) => {
    estado.meses = Number(e.target.value) || 12;
    atualiza();
  };
  await atualiza();
}

async function telaAjustes(alvo) {
  const admin = ehAdmin();
  alvo.innerHTML = `
    <div class="pilha">
      <div class="titulo-secao">
        <h1>${admin ? 'Ajustes' : 'Meu perfil'}</h1>
        <p>${esc(estado.usuario.nome)} — ${admin ? 'proprietário' : 'motorista'}</p>
      </div>
      ${admin ? `
        <div class="cartao">
          <h2>Motoristas e acessos</h2>
          <p class="ajuda">O motorista só consegue lançar gastos e ver os próprios lançamentos.</p>
          <div class="lista" id="lista-usuarios"></div>
          <div class="acoes" style="margin-top:14px">
            <button class="btn principal" type="button" id="b-usuario">Novo usuário</button>
          </div>
        </div>
        <div class="cartao">
          <h2>Caminhões</h2>
          <div class="lista" id="lista-caminhoes"></div>
          <div class="acoes" style="margin-top:14px">
            <button class="btn principal" type="button" id="b-caminhao">Novo caminhão</button>
          </div>
        </div>
        <div class="cartao">
          <h2>Categorias</h2>
          <p class="ajuda">Além das que já vêm prontas, você pode criar outras.</p>
          <div class="lista" id="lista-categorias"></div>
          <div class="acoes" style="margin-top:14px">
            <button class="btn principal" type="button" id="b-cat-saida">Nova categoria de gasto</button>
            <button class="btn principal" type="button" id="b-cat-entrada">Nova categoria de entrada</button>
          </div>
        </div>` : ''}
      <form class="cartao" novalidate>
        <h2>Alterar senha</h2>
        <p class="ajuda">Use uma senha que você lembre com facilidade.</p>
        <div class="campo">
          <label for="s-atual">Senha atual</label>
          <input id="s-atual" name="senha_atual" type="password" required autocomplete="current-password">
        </div>
        <div class="campo">
          <label for="s-nova">Nova senha</label>
          <input id="s-nova" name="senha_nova" type="password" required autocomplete="new-password">
        </div>
        <button class="btn principal" type="submit">Salvar nova senha</button>
      </form>
      <div class="cartao">
        <h2>Instalar no celular</h2>
        <p class="ajuda" style="margin-bottom:0">
          No celular, abra o menu do navegador e toque em
          <b>“Adicionar à tela de início”</b>. O site abre como um aplicativo.
        </p>
      </div>
      <button class="btn perigo grande" type="button" id="b-sair">Sair da conta</button>
    </div>`;

  aoEnviar(alvo.querySelector('form'), async (dados) => {
    await api('POST', 'trocar-senha', {}, dados);
    alvo.querySelector('form').reset();
    recado('Senha alterada.');
  });
  alvo.querySelector('#b-sair').onclick = async () => {
    await api('POST', 'logout');
    estado.usuario = null;
    estado.aba = null;
    telaLogin('Você saiu da conta.');
  };
  if (!admin) return;

  const atualiza = async () => {
    const [usuarios, caminhoes, categorias] = await Promise.all([
      api('GET', 'usuarios'),
      api('GET', 'caminhoes', { todos: 1 }),
      api('GET', 'categorias', { todos: 1 }),
    ]);
    estado.usuarios = usuarios;
    estado.caminhoes = caminhoes.filter((c) => Number(c.ativo));
    estado.categorias = categorias.filter((c) => Number(c.ativo));

    document.getElementById('lista-usuarios').innerHTML = usuarios.map((u) => `
      <button class="item" type="button" data-usuario="${u.id}">
        <span class="corpo">
          <strong>${esc(u.nome)}</strong>
          <small>usuário: ${esc(u.usuario)} • ${u.papel === 'admin' ? 'proprietário' : 'motorista'}</small>
        </span>
        ${Number(u.ativo) ? '' : '<span class="etiqueta inativo">sem acesso</span>'}
        <span class="seta" aria-hidden="true">›</span>
      </button>`).join('');

    document.getElementById('lista-caminhoes').innerHTML = caminhoes.length
      ? caminhoes.map((c) => `
        <button class="item" type="button" data-caminhao="${c.id}">
          <span class="corpo">
            <strong>${esc(c.placa)}</strong>
            <small>${esc(c.apelido || 'sem apelido')}</small>
          </span>
          ${Number(c.ativo) ? '' : '<span class="etiqueta inativo">inativo</span>'}
          <span class="seta" aria-hidden="true">›</span>
        </button>`).join('')
      : '<div class="vazio">Nenhum caminhão cadastrado.</div>';

    document.getElementById('lista-categorias').innerHTML = categorias.map((c) => `
      <button class="item" type="button" data-categoria="${c.id}">
        <span class="corpo">
          <strong>${esc(c.nome)}</strong>
          <small>${c.tipo === 'entrada' ? 'entrada (dinheiro que entra)' : 'gasto (dinheiro que sai)'}</small>
        </span>
        ${Number(c.ativo) ? '' : '<span class="etiqueta inativo">escondida</span>'}
        <span class="seta" aria-hidden="true">›</span>
      </button>`).join('');

    alvo.querySelectorAll('[data-usuario]').forEach((b) => {
      const u = usuarios.find((x) => Number(x.id) === Number(b.dataset.usuario));
      b.onclick = () => formUsuario(u, atualiza);
    });
    alvo.querySelectorAll('[data-caminhao]').forEach((b) => {
      const c = caminhoes.find((x) => Number(x.id) === Number(b.dataset.caminhao));
      b.onclick = () => formCaminhao(c, atualiza);
    });
    alvo.querySelectorAll('[data-categoria]').forEach((b) => {
      const c = categorias.find((x) => Number(x.id) === Number(b.dataset.categoria));
      b.onclick = () => formCategoria(c, null, atualiza);
    });
  };

  alvo.querySelector('#b-usuario').onclick = () => formUsuario(null, atualiza);
  alvo.querySelector('#b-caminhao').onclick = () => formCaminhao(null, atualiza);
  alvo.querySelector('#b-cat-saida').onclick = () => formCategoria(null, 'saida', atualiza);
  alvo.querySelector('#b-cat-entrada').onclick = () => formCategoria(null, 'entrada', atualiza);
  await atualiza();
}

function formUsuario(u, aoConcluir) {
  const novo = !u;
  const { elemento, fechar } = janela(novo ? 'Novo usuário' : `Editar ${u.nome}`, `
    <form novalidate>
      <div class="campo">
        <label for="u-nome">Nome ou apelido</label>
        <input id="u-nome" name="nome" required maxlength="80" value="${esc(u?.nome || '')}">
      </div>
      <div class="campo">
        <label for="u-usuario">Usuário para entrar</label>
        <p class="dica">Sem espaços e sem acento. Ex.: joao</p>
        <input id="u-usuario" name="usuario" ${novo ? 'required' : 'disabled'}
               autocapitalize="none" spellcheck="false" value="${esc(u?.usuario || '')}">
      </div>
      <div class="campo">
        <label for="u-senha">${novo ? 'Senha' : 'Nova senha'}</label>
        ${novo ? '' : '<p class="dica">Deixe em branco para manter a senha atual.</p>'}
        <input id="u-senha" name="${novo ? 'senha' : 'senha_nova'}" ${novo ? 'required' : ''}
               autocomplete="new-password">
      </div>
      <div class="linha duas">
        <div class="campo">
          <label for="u-papel">Nível de acesso</label>
          <select id="u-papel" name="papel">
            <option value="motorista" ${u?.papel !== 'admin' ? 'selected' : ''}>
              Motorista (só lança gastos)
            </option>
            <option value="admin" ${u?.papel === 'admin' ? 'selected' : ''}>
              Proprietário (vê e edita tudo)
            </option>
          </select>
        </div>
        <div class="campo opcional">
          <label for="u-telefone">Telefone</label>
          <input id="u-telefone" name="telefone" type="tel" value="${esc(u?.telefone || '')}">
        </div>
      </div>
      ${novo ? '' : `
        <div class="campo">
          <label for="u-ativo">Acesso ao sistema</label>
          <select id="u-ativo" name="ativo">
            <option value="1" ${Number(u.ativo) ? 'selected' : ''}>Liberado</option>
            <option value="0" ${Number(u.ativo) ? '' : 'selected'}>Bloqueado</option>
          </select>
        </div>`}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">Salvar</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    if (novo) await api('POST', 'usuarios', {}, dados);
    else await api('PUT', 'usuario', { id: u.id }, dados);
    fechar();
    recado('Usuário salvo.');
    await aoConcluir?.();
  });
}

function formCaminhao(c, aoConcluir) {
  const novo = !c;
  const { elemento, fechar } = janela(novo ? 'Novo caminhão' : `Editar ${c.placa}`, `
    <form novalidate>
      <div class="campo">
        <label for="t-placa">Placa</label>
        <input id="t-placa" name="placa" required maxlength="10" autocapitalize="characters"
               value="${esc(c?.placa || '')}">
      </div>
      <div class="campo opcional">
        <label for="t-apelido">Apelido</label>
        <p class="dica">Ajuda o motorista a reconhecer. Ex.: Scania branca</p>
        <input id="t-apelido" name="apelido" maxlength="60" value="${esc(c?.apelido || '')}">
      </div>
      ${novo ? '' : `
        <div class="campo">
          <label for="t-ativo">Situação</label>
          <select id="t-ativo" name="ativo">
            <option value="1" ${Number(c.ativo) ? 'selected' : ''}>Em uso</option>
            <option value="0" ${Number(c.ativo) ? '' : 'selected'}>Fora de uso</option>
          </select>
        </div>`}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">Salvar</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    if (novo) await api('POST', 'caminhoes', {}, dados);
    else await api('PUT', 'caminhao', { id: c.id }, dados);
    fechar();
    recado('Caminhão salvo.');
    await aoConcluir?.();
  });
}

function formCategoria(c, tipoNovo, aoConcluir) {
  const novo = !c;
  const tipo = c?.tipo || tipoNovo || 'saida';
  const { elemento, fechar } = janela(
    novo ? (tipo === 'entrada' ? 'Nova categoria de entrada' : 'Nova categoria de gasto')
      : `Editar ${c.nome}`,
    `<form novalidate>
      <div class="campo">
        <label for="k-nome">Nome da categoria</label>
        <p class="dica">${tipo === 'entrada'
          ? 'Ex.: frete de madeira, aluguel de carreta.'
          : 'Ex.: rastreador, contador, estacionamento.'}</p>
        <input id="k-nome" name="nome" required maxlength="40" value="${esc(c?.nome || '')}">
      </div>
      <input type="hidden" name="tipo" value="${tipo}">
      ${novo ? '' : `
        <div class="campo">
          <label for="k-ativo">Situação</label>
          <select id="k-ativo" name="ativo">
            <option value="1" ${Number(c.ativo) ? 'selected' : ''}>Aparece na hora de lançar</option>
            <option value="0" ${Number(c.ativo) ? '' : 'selected'}>Escondida</option>
          </select>
        </div>`}
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">Salvar</button>
      </div>
    </form>`
  );
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  aoEnviar(form, async (dados) => {
    dados.ativo = dados.ativo === undefined ? true : dados.ativo === '1';
    if (novo) await api('POST', 'categorias', {}, dados);
    else await api('PUT', 'categoria', { id: c.id }, dados);
    fechar();
    recado('Categoria salva.');
    await aoConcluir?.();
  });
}

(async function inicia() {
  try {
    estado.usuario = await api('GET', 'eu');
    await iniciaApp();
  } catch (erro) {
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
