// Ajudas da interface: contato de suporte, preenchimento de endereço e tutorial de primeiro acesso.

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

// ---------- Tutorial de primeiro acesso ----------

const PASSOS_TUTORIAL = {
  admin: [
    ['Bem-vindo ao Controle da Frota', 'Em poucos passos você vê onde fica cada parte do sistema. Dá para rever este tutorial depois em Ajustes › Minha conta.'],
    ['1. Cadastre a equipe e os caminhões', 'Em Ajustes (seu nome no menu ou o ícone de perfil no topo, no celular) cadastre os motoristas com usuário e senha, os caminhões e as categorias de gasto. Passe o usuário e a senha para cada motorista entrar.'],
    ['2. Clientes e viagens', 'Na aba Clientes ficam os contratantes, com endereço completado pelo CEP. Em Viagens, use “Nova viagem” para registrar origem, destino e valor combinado, e “Encerrar viagem” na chegada.'],
    ['3. Lançamentos', 'O botão “Novo Lançamento” registra entradas (fretes) e gastos (abastecimento, manutenção, pedágio…), com foto do comprovante. Os gastos dos motoristas aparecem aqui também.'],
    ['4. Diárias', 'Na aba Diárias você controla as diárias de cada motorista e registra os pagamentos.'],
    ['5. Panorama', 'O Panorama resume entradas, saídas, saldo, valores a receber e o desempenho de cada caminhão, com relatório em PDF.'],
    ['6. No celular e sem internet', 'Instale o app pela opção “Aplicativo no celular” em Ajustes › Minha conta e ative as notificações. Sem sinal, o que for registrado fica guardado e é enviado sozinho quando a internet voltar.'],
  ],
  motorista: [
    ['Bem-vindo ao Controle da Frota', 'Este app serve para registrar seus gastos, viagens e diárias. Dá para rever este tutorial depois em Perfil.'],
    ['1. Registre seus gastos', 'Use “Novo Gasto” ou “Registrar Gasto” para lançar abastecimento, pedágio, alimentação e outros. Escolha a categoria, informe o valor e tire uma foto do comprovante.'],
    ['2. Viagens', 'Na aba Viagens, toque em “Nova viagem” na saída, com origem, destino e km do painel. Na chegada, abra a viagem e informe o dia e o km de chegada.'],
    ['3. Minhas diárias', 'Em Diárias você acompanha as diárias que tem a receber e as que já foram pagas.'],
    ['4. Sem internet também funciona', 'Sem sinal, continue registrando normalmente. O app guarda tudo no celular e envia sozinho quando a internet voltar. O relógio no topo mostra o que ainda está guardado.'],
    ['5. Instale e ative os avisos', 'Em Perfil, instale o app na tela de início e ative as notificações. Lá você também troca sua senha e escolhe seu caminhão padrão.'],
  ],
};

const chaveTutorial = () => `frota-tutorial:${window.FROTA_AMBIENTE || 'padrao'}:${estado.usuario?.id}`;

function abreTutorial() {
  const passos = PASSOS_TUTORIAL[ehAdmin() ? 'admin' : 'motorista'];
  const { elemento, fechar } = janela('Primeiros passos', '<div class="tutorial" aria-live="polite"></div>');
  const caixa = elemento.querySelector('.tutorial');
  let atual = 0;
  const desenha = () => {
    const [titulo, texto] = passos[atual];
    const ultimo = atual === passos.length - 1;
    caixa.innerHTML = `<p class="tutorial-contagem">Passo ${atual + 1} de ${passos.length}</p>
      <h3>${esc(titulo)}</h3><p>${esc(texto)}</p>
      <div class="tutorial-pontos" aria-hidden="true">${passos.map((_, i) => `<span class="${i === atual ? 'ativo' : ''}"></span>`).join('')}</div>
      <div class="acoes fim">
        ${atual ? '<button class="btn" type="button" data-voltar>Voltar</button>' : '<button class="btn" type="button" data-pular>Pular</button>'}
        <button class="btn principal" type="button" data-avancar>${ultimo ? 'Começar a usar' : 'Próximo'}</button>
      </div>`;
    caixa.querySelector('[data-pular]')?.addEventListener('click', fechar);
    caixa.querySelector('[data-voltar]')?.addEventListener('click', () => { atual--; desenha(); });
    caixa.querySelector('[data-avancar]').onclick = () => { if (ultimo) fechar(); else { atual++; desenha(); } };
    caixa.querySelector('[data-avancar]').focus();
  };
  desenha();
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
