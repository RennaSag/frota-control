// Ajudas da interface: contato de suporte, preenchimento de endereço e tour de primeiro acesso.

// Contato mostrado na tela de login. O WhatsApp vai só com DDD e número.
const SUPORTE = { email: 'emailteste@gmail.com', whatsapp: '64999999999' };

function contatoSuporte() {
  const fone = SUPORTE.whatsapp.replace(/\D/g, '');
  const legivel = fone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  return `<div class="contato-suporte">
    <p>Precisa de ajuda para entrar?</p>
    <div class="contato-suporte-links">
      <a href="https://wa.me/55${fone}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z"/><path d="M9 9.5c.3 2 2.2 4.2 4.6 5l1.3-1.3 2 1-.4 1.6c-3.4.3-7.6-3.6-7.9-7.1L10.2 8l1 2z"/></svg>
        <span>WhatsApp · ${esc(legivel)}</span>
      </a>
      <a href="mailto:${esc(SUPORTE.email)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
        <span>${esc(SUPORTE.email)}</span>
      </a>
    </div>
  </div>`;
}

// ---------- Endereço: CEP (ViaCEP) e cidades do IBGE ----------

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let promessaCidades = null;

// A lista (assets/cidades.js) só é baixada quando alguém digita uma cidade.
function carregaCidades() {
  promessaCidades ??= new Promise((ok, falha) => {
    const montar = () => ok(Object.entries(self.CIDADES_BR).flatMap(([uf, nomes]) =>
      nomes.split('|').map((nome) => ({ nome, uf, chave: semAcento(nome) }))));
    if (self.CIDADES_BR) return montar();
    const s = document.createElement('script');
    s.src = `assets/cidades.js?v=${encodeURIComponent(window.VERSAO_APP || '')}`;
    s.onload = montar;
    s.onerror = () => { promessaCidades = null; falha(new Error('Lista de cidades indisponível.')); };
    document.head.append(s);
  });
  return promessaCidades;
}

function buscaCidades(cidades, texto, limite = 12) {
  const alvo = semAcento(texto);
  if (alvo.length < 2) return [];
  const inicio = [], meio = [];
  for (const c of cidades) {
    if (c.chave.startsWith(alvo)) inicio.push(c);
    else if (meio.length < limite && c.chave.includes(alvo)) meio.push(c);
  }
  return [...inicio.sort((a, b) => a.nome.length - b.nome.length), ...meio].slice(0, limite);
}

// "Goiânia - GO" ou "Goiânia/GO" vira { nome, uf } quando a cidade existe.
function cidadeDoTexto(cidades, texto) {
  const m = /^(.+?)\s*(?:-|\/|,)\s*([a-z]{2})$/i.exec(String(texto).trim());
  if (!m) return null;
  const chave = semAcento(m[1]), uf = m[2].toUpperCase();
  return cidades.find((c) => c.uf === uf && c.chave === chave) || null;
}

// Sugere cidades enquanto digita. Com campo de UF, separa a cidade da UF ao escolher;
// sem ele (origem/destino), o texto fica como "Cidade - UF".
function ligaCidade(input, campoUf = null) {
  if (!input) return;
  const lista = document.createElement('datalist');
  lista.id = `${input.id || 'cidade'}-sugestoes`;
  input.setAttribute('list', lista.id);
  input.setAttribute('autocomplete', 'off');
  input.after(lista);
  input.addEventListener('input', async () => {
    const texto = input.value;
    let cidades;
    try { cidades = await carregaCidades(); } catch { return; }
    if (input.value !== texto) return;
    const escolhida = campoUf && cidadeDoTexto(cidades, texto);
    if (escolhida) {
      input.value = escolhida.nome;
      campoUf.value = escolhida.uf;
      lista.innerHTML = '';
      return;
    }
    lista.innerHTML = buscaCidades(cidades, texto).map((c) => `<option value="${esc(`${c.nome} - ${c.uf}`)}"></option>`).join('');
  });
  if (!campoUf) return;
  // Digitou o nome inteiro sem escolher: se só existe uma cidade com esse nome, completa a UF.
  input.addEventListener('change', async () => {
    let cidades;
    try { cidades = await carregaCidades(); } catch { return; }
    const chave = semAcento(input.value);
    const iguais = cidades.filter((c) => c.chave === chave);
    // Nome repetido em vários estados (ex.: Bom Jesus) só completa se a UF já bate.
    const c = iguais.length === 1 ? iguais[0] : iguais.find((x) => x.uf === campoUf.value.toUpperCase());
    if (c) { input.value = c.nome; campoUf.value = c.uf; }
  });
  campoUf.addEventListener('input', () => { campoUf.value = campoUf.value.toUpperCase(); });
}

// CEP com 8 dígitos preenche rua, bairro, cidade e UF; o número fica para a pessoa.
function ligaCep(form) {
  const cep = form.elements.cep;
  if (!cep) return;
  cep.setAttribute('inputmode', 'numeric');
  cep.setAttribute('placeholder', '00000-000');
  const aviso = document.createElement('small');
  aviso.className = 'ajuda aviso-cep';
  aviso.setAttribute('aria-live', 'polite');
  cep.after(aviso);
  let ultimo = '';
  cep.addEventListener('input', async () => {
    const digitos = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    if (digitos.length !== 8) { aviso.textContent = ''; ultimo = ''; return; }
    if (digitos === ultimo) return;
    ultimo = digitos;
    aviso.textContent = 'Buscando endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (ultimo !== digitos) return;
      if (!r.ok || d.erro) { aviso.textContent = 'CEP não encontrado. Preencha o endereço manualmente.'; return; }
      for (const [campo, valor] of [['logradouro', d.logradouro], ['bairro', d.bairro], ['cidade', d.localidade], ['uf', d.uf]]) {
        if (valor && form.elements[campo]) form.elements[campo].value = valor;
      }
      if (d.complemento && form.elements.complemento && !form.elements.complemento.value) form.elements.complemento.value = d.complemento;
      aviso.textContent = 'Endereço preenchido. Confira e informe o número.';
      form.elements.numero?.focus();
    } catch {
      if (ultimo === digitos) aviso.textContent = navigator.onLine ? 'Não foi possível consultar o CEP agora.' : 'Sem internet: preencha o endereço manualmente.';
    }
  });
}

function ligaEndereco(form) {
  ligaCep(form);
  ligaCidade(form.elements.cidade, form.elements.uf);
}

// ---------- Tour de primeiro acesso ----------
// Percorre a tela de verdade: abre cada aba, destaca o botão ou a área e explica num balão ao lado.

// Botão de uma aba, no menu lateral (computador) ou na barra de baixo (celular).
const botaoDaAba = (id) => [`.menu-navegacao [data-aba="${id}"]`, `.dock-flutuante [data-aba="${id}"]`, '#b-mais-abas'];
const abreMinhaConta = () => document.querySelector('[data-ajustes-painel="preferencias"]')?.click();

const PASSOS_TUTORIAL = {
  admin: [
    { titulo: 'Bem-vindo ao Controle da Frota', texto: 'Vamos dar uma volta rápida pelo sistema. Em cada passo, a parte da tela que importa fica destacada. Use os botões abaixo ou as setas do teclado.' },
    { aba: 'ajustes', alvo: ['#secao-usuarios'], titulo: 'Comece pela equipe', texto: 'Em Ajustes você cadastra os motoristas com usuário e senha. Depois é só passar o acesso para cada um entrar pelo celular.' },
    { aba: 'ajustes', alvo: ['.ajustes-navegacao'], titulo: 'Caminhões e categorias', texto: 'Nestas abas ficam os caminhões da frota e as categorias de gasto e de frete. Elas aparecem nos formulários de lançamento.' },
    { aba: 'clientes', alvo: ['#novo-cliente', ...botaoDaAba('clientes')], titulo: 'Clientes', texto: 'Cadastre os contratantes. Digite o CEP e o endereço se completa sozinho.' },
    { aba: 'viagens', alvo: ['#b-nova', ...botaoDaAba('viagens')], titulo: 'Viagens', texto: 'Registre cada viagem com origem, destino e valor combinado. Na chegada, use “Encerrar viagem” e acompanhe o que falta receber.' },
    { aba: 'lancamentos', alvo: ['#b-acao-rapida', '#b-novo-lancamento'], titulo: 'Lançamentos', texto: 'Aqui você registra fretes recebidos e gastos (abastecimento, manutenção, pedágio…) com foto do comprovante. Os gastos dos motoristas aparecem aqui também.' },
    { aba: 'diarias', alvo: botaoDaAba('diarias'), titulo: 'Diárias', texto: 'Controle as diárias de cada motorista e registre os pagamentos, de um dia ou de vários de uma vez.' },
    { aba: 'panorama', alvo: botaoDaAba('panorama'), titulo: 'Panorama', texto: 'O resumo do negócio: entradas, saídas, saldo, valores a receber e o desempenho de cada caminhão, com relatório em PDF.' },
    { alvo: ['#b-avisos'], titulo: 'Avisos', texto: 'O sino mostra o que os motoristas registraram. Com as notificações ativadas, o aviso chega até com o app fechado.' },
    { aba: 'ajustes', antes: abreMinhaConta, alvo: ['#cartao-instalar', '#cartao-push'], titulo: 'No celular e sem internet', texto: 'Instale o app na tela de início e ative as notificações. Sem sinal, o que for registrado fica guardado e é enviado sozinho quando a internet voltar.' },
    { aba: 'ajustes', antes: abreMinhaConta, alvo: ['#b-tutorial'], titulo: 'Pronto!', texto: 'Quando quiser rever este tour, é só tocar aqui, em Ajustes › Minha conta.' },
  ],
  motorista: [
    { titulo: 'Bem-vindo ao Controle da Frota', texto: 'Vamos dar uma volta rápida pelo app. Em cada passo, a parte da tela que importa fica destacada.' },
    { aba: 'meus', alvo: ['#b-acao-rapida', '#b-novo-lancamento', ...botaoDaAba('meus')], titulo: 'Registre seus gastos', texto: 'Toque aqui para lançar abastecimento, pedágio, alimentação e outros. Escolha a categoria, informe o valor e tire uma foto do comprovante.' },
    { aba: 'viagens', alvo: ['#b-nova', ...botaoDaAba('viagens')], titulo: 'Viagens', texto: 'Na saída, toque em “Nova viagem” com origem, destino e km do painel. Na chegada, abra a viagem e informe o dia e o km de chegada.' },
    { aba: 'diarias', alvo: botaoDaAba('diarias'), titulo: 'Minhas diárias', texto: 'Acompanhe as diárias que você tem a receber e as que já foram pagas.' },
    { alvo: ['.acoes-topo'], titulo: 'Sem internet também funciona', texto: 'Sem sinal, continue registrando normalmente. O app guarda tudo no celular e envia sozinho quando a internet voltar. Um relógio aparece aqui enquanto houver algo guardado.' },
    { aba: 'perfil', alvo: ['#cartao-instalar', '#cartao-push'], titulo: 'Instale e ative os avisos', texto: 'Instale o app na tela de início e ative as notificações. No Perfil você também troca sua senha e escolhe seu caminhão padrão.' },
    { aba: 'perfil', alvo: ['#b-tutorial'], titulo: 'Pronto!', texto: 'Quando quiser rever este tour, é só tocar aqui no seu Perfil.' },
  ],
};

const chaveTutorial = () => `frota-tutorial:${window.FROTA_AMBIENTE || 'padrao'}:${estado.usuario?.id}`;

function elementoVisivel(seletores = []) {
  for (const seletor of seletores) {
    for (const el of document.querySelectorAll(seletor)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]')) return el;
    }
  }
  return null;
}

let fechaTourAberto = null;

function abreTutorial() {
  fechaTourAberto?.();
  const passos = PASSOS_TUTORIAL[ehAdmin() ? 'admin' : 'motorista'];
  const abaInicial = estado.aba;
  const semAnimacao = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camada = document.createElement('div');
  camada.className = 'tour';
  camada.innerHTML = `
    <div class="tour-fundo"></div>
    <div class="tour-foco" hidden></div>
    <div class="tour-balao" role="dialog" aria-modal="true" aria-labelledby="tour-titulo" aria-describedby="tour-texto" tabindex="-1">
      <span class="tour-seta" aria-hidden="true"></span>
      <div class="tour-topo">
        <span class="tour-contagem"></span>
        <button type="button" class="tour-fechar" data-pular aria-label="Fechar o tour">${icone('fechar')}</button>
      </div>
      <h3 id="tour-titulo"></h3>
      <p id="tour-texto" aria-live="polite"></p>
      <div class="tour-rodape">
        <div class="tutorial-pontos" aria-hidden="true">${passos.map(() => '<span></span>').join('')}</div>
        <div class="tour-botoes">
          <button class="btn pequeno" type="button" data-voltar>Voltar</button>
          <button class="btn principal pequeno" type="button" data-avancar>Próximo</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(camada);
  const fundo = camada.querySelector('.tour-fundo');
  const foco = camada.querySelector('.tour-foco');
  const balao = camada.querySelector('.tour-balao');
  const seta = camada.querySelector('.tour-seta');
  const bVoltar = balao.querySelector('[data-voltar]');
  const bAvancar = balao.querySelector('[data-avancar]');
  let atual = 0, alvo = null, vez = 0, quadro = 0;

  // Destaca o alvo e põe o balão onde houver espaço: abaixo, acima, ao lado ou no rodapé da tela.
  const posiciona = () => {
    const vw = document.documentElement.clientWidth, vh = innerHeight, margem = 12;
    const largura = Math.min(360, vw - 32);
    balao.style.width = `${largura}px`;
    const altura = balao.offsetHeight;
    if (!alvo || !alvo.isConnected) {
      foco.hidden = true; fundo.classList.add('escuro'); seta.hidden = true;
      balao.dataset.lado = 'centro';
      balao.style.left = `${(vw - largura) / 2}px`;
      balao.style.top = `${Math.max(16, (vh - altura) / 2)}px`;
      return;
    }
    const r = alvo.getBoundingClientRect(), folga = 6;
    foco.hidden = false; fundo.classList.remove('escuro');
    Object.assign(foco.style, { left: `${r.left - folga}px`, top: `${r.top - folga}px`, width: `${r.width + folga * 2}px`, height: `${r.height + folga * 2}px` });
    const abaixo = vh - r.bottom - folga, acima = r.top - folga;
    let top, left, lado;
    if (abaixo >= altura + margem + 8) { lado = 'abaixo'; top = r.bottom + folga + margem; }
    else if (acima >= altura + margem + 8) { lado = 'acima'; top = r.top - folga - margem - altura; }
    else if (vw - r.right >= largura + margem * 2 + 16) { lado = 'direita'; left = r.right + folga + margem; top = r.top; }
    else if (r.left >= largura + margem * 2 + 16) { lado = 'esquerda'; left = r.left - folga - margem - largura; top = r.top; }
    else { lado = 'sobre'; top = vh - altura - 16; }
    if (left === undefined) left = r.left + r.width / 2 - largura / 2;
    left = Math.min(Math.max(16, left), vw - largura - 16);
    top = Math.min(Math.max(16, top), vh - altura - 16);
    balao.style.left = `${left}px`;
    balao.style.top = `${top}px`;
    balao.dataset.lado = lado;
    seta.hidden = lado === 'sobre';
    if (lado === 'abaixo' || lado === 'acima') {
      seta.style.left = `${Math.min(Math.max(18, r.left + r.width / 2 - left), largura - 18)}px`;
      seta.style.top = '';
    } else {
      seta.style.top = `${Math.min(Math.max(18, r.top + r.height / 2 - top), altura - 18)}px`;
      seta.style.left = '';
    }
  };
  const reposiciona = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(posiciona); };

  const teclas = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); avancar(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); voltar(); return; }
    if (e.key !== 'Tab') return;
    const botoes = [...balao.querySelectorAll('button')].filter((b) => !b.hidden);
    const i = botoes.indexOf(document.activeElement);
    e.preventDefault();
    botoes[(i + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length].focus();
  };

  const fechar = () => {
    vez++;
    fechaTourAberto = null;
    cancelAnimationFrame(quadro);
    removeEventListener('resize', reposiciona);
    removeEventListener('scroll', reposiciona, true);
    document.removeEventListener('keydown', teclas, true);
    camada.remove();
    if (estado.usuario && abaInicial && estado.aba !== abaInicial) abreAba(abaInicial);
  };
  fechaTourAberto = fechar;

  const mostra = async (indice) => {
    const minhaVez = ++vez;
    atual = indice;
    const passo = passos[atual];
    balao.classList.add('trocando');
    if (passo.aba && estado.aba !== passo.aba) await abreAba(passo.aba);
    if (minhaVez !== vez) return;
    passo.antes?.();
    alvo = elementoVisivel(passo.alvo);
    alvo?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: semAnimacao ? 'auto' : 'smooth' });
    const ultimo = atual === passos.length - 1;
    balao.querySelector('.tour-contagem').textContent = `${atual + 1} de ${passos.length}`;
    balao.querySelector('#tour-titulo').textContent = passo.titulo;
    balao.querySelector('#tour-texto').textContent = passo.texto;
    balao.querySelectorAll('.tutorial-pontos span').forEach((s, i) => s.classList.toggle('ativo', i === atual));
    bVoltar.hidden = atual === 0;
    bAvancar.textContent = ultimo ? 'Começar a usar' : atual === 0 ? 'Começar o tour' : 'Próximo';
    posiciona();
    // A rolagem suave termina depois: reposiciona quando ela acabar.
    setTimeout(() => {
      if (minhaVez !== vez) return;
      posiciona();
      balao.classList.remove('trocando');
    }, semAnimacao ? 0 : 380);
    bAvancar.focus({ preventScroll: true });
  };
  const avancar = () => (atual === passos.length - 1 ? fechar() : mostra(atual + 1));
  const voltar = () => { if (atual > 0) mostra(atual - 1); };

  balao.querySelector('[data-pular]').onclick = fechar;
  bVoltar.onclick = voltar;
  bAvancar.onclick = avancar;
  addEventListener('resize', reposiciona);
  addEventListener('scroll', reposiciona, true);
  document.addEventListener('keydown', teclas, true);
  mostra(0);
}

// Mostra uma vez por usuário em cada aparelho.
function tutorialPrimeiroAcesso() {
  if (!estado.usuario?.id) return;
  try {
    if (localStorage.getItem(chaveTutorial())) return;
    localStorage.setItem(chaveTutorial(), '1');
  } catch { return; }
  abreTutorial();
}
