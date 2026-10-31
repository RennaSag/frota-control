// Viagens reúnem cliente, documentos e recebimentos em um único fluxo.
function contatoEmail(email){return `<a class="contato-email" href="mailto:${encodeURIComponent(String(email).trim())}" aria-label="Enviar e-mail para ${esc(email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg><span>${esc(email)}</span></a>`;}
function contatoWhatsapp(c){let numero=String(c.telefone||'').replace(/\D/g,'');if(numero.length===10||numero.length===11)numero='55'+numero;if(numero.length<12||numero.length>15)return '';return `<a class="cliente-whatsapp" href="https://wa.me/${numero}" target="_blank" rel="noopener noreferrer" title="Conversar no WhatsApp" aria-label="WhatsApp de ${esc(c.nome)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/><path d="M9 7.5c-.8 1-.4 2.4.9 3.8s2.9 2.5 4.2 2.1l1-1.2-2-1-.7.7c-1.1-.5-1.8-1.3-2.3-2.3l.6-.7-.9-1.4Z"/></svg></a>`;}

function seloCadastro(registro) {
  if (!registro.criado_em) return '';
  const valor = String(registro.criado_em).replace('T', ' ');
  return `<small class="registro-hora" title="Data e hora do cadastro">${registro.offline ? 'No aparelho · ' : ''}Cadastrado em ${dataCurta(valor)} às ${esc(valor.slice(11, 16))}</small>`;
}

function pendenteViagem(v) {
  return Math.max(0, Number(v.valor_frete_centavos || 0) - Number(v.recebido_centavos || 0));
}

function resumoViagemCard(v) {
  const pendente=pendenteViagem(v), aberta=v.status==='aberta';
  return `<article class="card-viagem viagem-card-v7 ${aberta?'aberta':''}">
    <button class="viagem-abrir" type="button" data-viagem="${esc(v.id)}" aria-label="Consultar viagem de ${esc(v.cliente || v.origem)}">
      <div class="viagem-card-topo"><strong class="viagem-card-cliente">${esc(v.cliente || 'Cliente não informado')}</strong><span class="badge-status ${aberta?'aberta':'encerrada'}">${aberta?'Em andamento':'Encerrada'}</span></div>
      <div class="viagem-card-rota"><div><small>Origem</small><span>${esc(localViagem(v.origem))}</span></div><div><small>Destino</small><span>${esc(localViagem(v.destino))}</span></div></div>
      <div class="viagem-card-equipe"><span>${icone('usuario')}${esc(v.motorista || estado.usuario.nome)}</span>${v.placa?`<span>${icone('caminhao')}${esc(v.placa)}</span>`:''}</div>
      <div class="viagem-card-saldo ${pendente?'pendente':'quitado'}"><span>${!Number(v.valor_frete_centavos)?'Valor a definir':pendente?'Pendente a receber':'Serviço quitado'}</span>${pendente?`<strong>${dinheiro(pendente)}</strong>`:''}</div>
    </button>
    <div class="viagem-card-acoes"><button class="btn pequeno" type="button" data-nota-viagem="${esc(v.id)}">${icone('nota')}${Number(v.qtd_notas)?`${v.qtd_notas} ${Number(v.qtd_notas)===1?'nota':'notas'} · anexar`:'Anexar nota'}</button>${aberta?`<button class="btn pequeno botao-encerrar-card" type="button" data-encerrar-card="${esc(v.id)}">${icone('check')} Encerrar viagem</button>`:''}${ehAdmin()&&!aberta&&pendente?`<button class="btn pequeno botao-quitar" type="button" data-quitar="${esc(v.id)}">${icone('check')} Quitar serviço</button>`:''}</div>
    <time class="viagem-data" datetime="${esc(v.inicio)}">${dataCurta(v.inicio)}${v.fim?` a ${dataCurta(v.fim)}`:''}</time>
  </article>`;
}


function ligaCardsViagem(raiz, viagens, atualizar) {
  raiz.querySelectorAll('.viagem-card-v7').forEach((card)=>card.onclick=(e)=>{if(!e.target.closest('button,a'))card.querySelector('[data-viagem]').click();});
  const encontra = (id) => viagens.find((v) => String(v.id) === String(id));
  raiz.querySelectorAll('[data-viagem]').forEach((b) => { b.onclick = () => abreViagem(encontra(b.dataset.viagem), atualizar).catch((e) => recado(e.message)); });
  raiz.querySelectorAll('[data-nota-viagem]').forEach((b) => { b.onclick = () => abreNotasViagem(encontra(b.dataset.notaViagem), atualizar).catch((e)=>recado(e.message)); });
  raiz.querySelectorAll('[data-encerrar-card]').forEach((b) => { b.onclick = () => formPagamentoViagem(encontra(b.dataset.encerrarCard), atualizar, true); });
  raiz.querySelectorAll('[data-quitar]').forEach((b) => { b.onclick = () => formPagamentoViagem(encontra(b.dataset.quitar), atualizar); });
}

async function telaViagens(alvo) {
  const filtro = { busca: '', status: '', mes: hoje().slice(0, 7), pendentes: Boolean(estado.viagensSomentePendentes) };
  estado.viagensSomentePendentes = false;
  alvo.innerHTML = `<div class="pilha">
    <div class="titulo-secao"><div class="cabecalho-secao"><div><span class="sobre-titulo">OPERAÇÃO E RECEBIMENTOS</span><h1>Viagens</h1><p>Da saída à quitação. Tudo em um só lugar.</p></div><button class="btn principal" id="b-nova" type="button">${icone('adicionar')} Nova viagem</button></div></div>
    ${ehAdmin() ? '<div id="viagens-resumo" class="resumo-viagens"></div>' : ''}
    <div class="cartao busca-viagens"><div class="campo"><label for="v-busca">Buscar viagem</label><div class="busca-com-filtro"><input id="v-busca" type="search" placeholder="Cliente, local ou placa"><button class="btn" type="button" id="v-filtros" aria-label="Filtros de viagens" title="Filtros de viagens">${icone('filtro')}<span>Filtros</span></button></div></div><small id="v-filtros-ativos"></small></div>
    <div id="lista-viagens"></div>
    ${ehAdmin() ? '<button class="btn pequeno" type="button" id="cobrancas-antigas" hidden>Cobranças anteriores e fretes sem viagem</button>' : ''}</div>`;
  let todasViagens = [], pagina = 0, haMais = false;
  const desenha = () => {
    const busca = filtro.busca;
    const itens = todasViagens.filter((v) => (!filtro.status || v.status === filtro.status)
      && (!filtro.pendentes || pendenteViagem(v) > 0)
      && (filtro.pendentes || !filtro.mes || v.inicio.slice(0, 7) === filtro.mes)
      && combinaBusca(busca,[v.cliente,v.origem,v.destino,v.placa,v.motorista,v.observacao]));
    const caixa = alvo.querySelector('#lista-viagens');
    caixa.innerHTML = itens.length ? `<p class="ajuda">${itens.length} viagem(ns) encontrada(s)</p><div class="lista-viagens">${itens.map(resumoViagemCard).join('')}</div>`
      : '<div class="vazio">Nenhuma viagem neste filtro. Altere o período ou cadastre uma nova viagem.</div>';
    ligaCardsViagem(caixa, itens, atualiza);
    if (haMais) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Carregar viagens anteriores';
      b.onclick = async () => { try { b.disabled = true; const mais = await api('GET', 'viagens', { limite: 300, pagina: pagina + 2 }); pagina++; haMais = mais.length === 300; todasViagens.push(...mais); desenha(); } catch(e) { recado(e.message); } };
      caixa.append(b);
    }
  };
  const resumo = async () => {
    if (!ehAdmin()) return;
    const r = await api('GET', 'viagens-financeiro', { mes: filtro.mes || hoje().slice(0, 7) });
    alvo.querySelector('#cobrancas-antigas').hidden = !r.cobrancas_anteriores;
    alvo.querySelector('#viagens-resumo').innerHTML = `<div class="pendente-total"><span>${icone('aReceber')} Pendente a receber</span><strong>${dinheiro(r.a_receber_centavos)}</strong><small>${dinheiro(r.pendente_mes_centavos)} deste mês · ${dinheiro(r.pendente_anterior_centavos)} de meses anteriores</small></div>`;
  };
  const atualiza = async () => {
    pagina = 0;
    todasViagens = await api('GET', 'viagens', { limite: 300 });
    haMais = todasViagens.length === 300;
    estado.viagensAbertas = todasViagens.filter((v) => v.status === 'aberta');
    estado.clientes = await api('GET', 'clientes');
    await resumo(); desenha();
  };
  const rotula=()=>{alvo.querySelector('#v-filtros-ativos').textContent=[filtro.pendentes ? 'Pagamentos pendentes · todos os meses' : filtro.mes ? mesLongo(filtro.mes):'Todos os meses',filtro.status==='aberta'?'Em andamento':filtro.status==='encerrada'?'Encerradas':''].filter(Boolean).join(' · ');};
  alvo.querySelector('#b-nova').onclick=()=>abreFormViagem(null,atualiza);
  alvo.querySelector('#v-busca').oninput=(e)=>{filtro.busca=e.target.value;desenha();};
  alvo.querySelector('#v-filtros').onclick=()=>{
    const {elemento,fechar}=janela('Filtros de viagens',`<form class="form-pilha"><div class="campo"><label for="v-mes-filtro">Mês de saída</label><input id="v-mes-filtro" type="month" name="mes" value="${filtro.mes}"><small>Deixe em branco para consultar todos os meses.</small></div><div class="campo"><label for="v-situacao">Situação</label><select id="v-situacao" name="status"><option value="">Todas</option><option value="aberta">Em andamento</option><option value="encerrada">Encerradas</option><option value="pendente">Pagamento pendente · todos os meses</option></select></div><div class="acoes fim"><button type="button" class="btn" data-limpar>Limpar</button><button type="submit" class="btn principal">Aplicar filtros</button></div></form>`);
    const form=elemento.querySelector('form');form.elements.status.value=filtro.pendentes?'pendente':filtro.status;
    form.querySelector('[data-limpar]').onclick=()=>{form.elements.mes.value='';form.elements.status.value='';};
    aoEnviar(form,async(dados)=>{filtro.mes=dados.mes;filtro.pendentes=dados.status==='pendente';filtro.status=filtro.pendentes?'':dados.status;rotula();desenha();fechar();await resumo();});
  };
  rotula();
  alvo.querySelector('#cobrancas-antigas')?.addEventListener('click', () => abreAba('receber'));
  await atualiza();
}

function campoDinheiroViagem(nome, rotulo, valor = '') {
  return `<div class="campo"><label for="v-${nome}">${rotulo}</label><div class="valor-caixa"><span>R$</span><input id="v-${nome}" name="${nome}" inputmode="decimal" placeholder="0,00" value="${esc(valor)}"></div></div>`;
}

function camposViagem(v = {}) {
  const recentes = clientesRecentes();
  const selecionado = estado.clientes.find((c) => String(c.id) === String(v.cliente_id));
  const clientes = selecionado && !recentes.some((c) => String(c.id) === String(selecionado.id)) ? [selecionado, ...recentes] : recentes;
  return `<section class="form-bloco form-compacto"><h2>Cliente e viagem</h2>
    <div class="campo"><label for="v-cliente">Cliente · 10 mais recentes</label><div class="seletor-cliente"><select id="v-cliente" name="cliente_id"><option value="">Selecionar cliente (opcional)</option>${clientes.map((c) => `<option value="${c.id}" ${String(c.id) === String(v.cliente_id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}<option value="novo">+ Cadastrar novo cliente</option></select><button class="btn" type="button" data-buscar-cliente aria-label="Pesquisar cliente">${icone('busca')}</button></div></div>
    <div class="campo oculto" id="v-novo-cliente"><label for="v-cliente-novo">Nome do novo cliente</label><input id="v-cliente-novo" name="cliente_novo" maxlength="90" placeholder="Nome da empresa ou pessoa"></div>
    <div class="linha duas"><div class="campo"><label for="v-origem">Origem</label><input id="v-origem" name="origem" maxlength="80" required placeholder="Local de saída, fazenda, empresa…" value="${esc(v.origem || '')}"></div><div class="campo"><label for="v-destino">Destino</label><input id="v-destino" name="destino" maxlength="80" required placeholder="Local de entrega, obra, armazém…" value="${esc(v.destino || '')}"></div></div></section>
    <section class="form-bloco form-compacto">
    <div class="linha duas"><div class="campo"><label for="v-inicio">Data de saída</label><input id="v-inicio" name="inicio" type="date" required value="${esc(v.inicio || hoje())}"></div><div class="campo"><label for="v-caminhao">Caminhão</label><select id="v-caminhao" name="caminhao_id">${opcoesCaminhao(v.id ? v.caminhao_id : (v.caminhao_id ?? estado.usuario.caminhao_padrao_id), v.placa ? { id: v.caminhao_id, placa: v.placa } : null)}</select></div></div>
    ${ehAdmin() ? `<div class="campo"><label for="v-motorista">Motorista / responsável</label><select id="v-motorista" name="usuario_id">${opcoesMotorista(v.usuario_id || estado.usuario.id)}</select></div>` : ''}
    <div class="campo"><label for="v-km">Km do painel na saída</label><input id="v-km" name="km_inicial" inputmode="numeric" value="${esc(v.km_inicial ?? '')}"></div><div class="campo"><label for="v-obs">Observações da viagem</label><textarea id="v-obs" name="observacao" maxlength="500">${esc(v.observacao || '')}</textarea></div></section>
    <section class="form-bloco form-compacto"><h2>Valores</h2><div class="linha duas">${campoDinheiroViagem('valor_viagem', 'Valor combinado da viagem', valorParaCampo(v.valor_frete_centavos))}
    ${v.id ? `<div class="campo"><label>Já recebido</label><strong>${dinheiro(v.recebido_centavos)}</strong><small>Recebimentos são registrados separadamente.</small></div>` : campoDinheiroViagem('valor_entrada', 'Entrada paga pelo cliente (opcional)')}</div>
    <p class="ajuda">${v.id ? 'O saldo pendente é recalculado ao salvar.' : 'Sem entrada? Deixe em branco. O valor restante fica pendente até o pagamento.'}</p>
    ${!v.id ? `<div class="campo"><label for="v-data-pagamento">Data do recebimento da entrada</label><input id="v-data-pagamento" name="data_pagamento" type="date" value="${hoje()}"></div>` : ''}</section>
    <details class="form-bloco form-compacto"><summary>Nota fiscal (opcional)</summary>
    ${campoArquivo('v-nota-arquivo', 'Foto ou PDF da nota fiscal', '', 'nota_arquivo', null, 'Anexar depois')}
    <div class="campo"><label for="v-nota-numero">Número da nota fiscal</label><input id="v-nota-numero" name="nota_numero" maxlength="40" value="${esc(v.nota_fiscal_numero || '')}"></div></details>`;
}

function abreFormViagem(viagem, aoConcluir, base = {}) {
  const v = viagem || { ...base, cliente_id: base.cliente_id ?? clientesRecentes()[0]?.id, usuario_id: estado.usuario.id };
  const { elemento, fechar } = janela(viagem ? 'Editar viagem' : 'Nova viagem', `<form class="form-pilha" novalidate>${camposViagem(v)}
    ${viagem ? `<section class="form-bloco"><h2>Chegada</h2><div class="linha duas"><div class="campo"><label for="v-fim">Dia da chegada</label><input id="v-fim" name="fim" type="date" value="${esc(v.fim || '')}"></div><div class="campo"><label for="v-kmf">Km na chegada</label><input id="v-kmf" name="km_final" inputmode="numeric" value="${esc(v.km_final ?? '')}"></div></div><input type="hidden" name="status" value="${esc(v.status)}"><p class="ajuda">Use “Encerrar viagem” para finalizar e registrar o pagamento.</p></section>` : ''}
    <div class="acoes fim"><button class="btn" type="button" data-cancelar>Cancelar</button><button class="btn principal" type="submit">${viagem ? 'Salvar alterações' : 'Cadastrar viagem'}</button></div></form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  form.querySelector('[data-buscar-cliente]').onclick = () => pesquisaCliente(form);
  form.elements.cliente_id.onchange = () => {
    const novo = form.elements.cliente_id.value === 'novo';
    form.querySelector('#v-novo-cliente').classList.toggle('oculto', !novo);
    form.elements.cliente_novo.required = novo;
    if (!novo) form.elements.cliente_novo.value = '';
    else form.elements.cliente_novo.focus();
  };
  organizaEtapasViagem(form);
  ligaCidade(form.elements.origem); ligaCidade(form.elements.destino);
  ligaArquivo(form, 'v-nota-arquivo', 'nota_arquivo', 'Anexar depois');
  aoEnviar(form, async (dados) => {
    if (!dados.origem.trim() || !dados.destino.trim()) throw new Error('Informe a origem e o destino.');
    if (dados.cliente_id === 'novo') { if (!dados.cliente_novo.trim()) throw new Error('Informe o nome do novo cliente.'); dados.cliente_id = ''; }
    const r = viagem ? await api('PUT', 'viagem', { id: viagem.id }, dados) : await api('POST', 'viagens', {}, dados);
    fechar(); recado(r?.offline ? GUARDADO_OFFLINE : 'Viagem salva.');
    await aoConcluir?.();
  });
}

async function abreNotasViagem(v,atualizar){
 const notas=await api('GET','notas',{viagem_id:v.id,limite:1000});
 if(!notas.length){anexaNotaViagem(v,atualizar);return;}
 const {elemento}=janela('Notas fiscais da viagem',`<div class="notas-viagem-topo"><div><strong>${esc(v.cliente || 'Cliente não informado')}</strong><p class="ajuda">${dataCurta(v.inicio)} · ${esc(localViagem(v.origem))} → ${esc(localViagem(v.destino))}</p></div><button type="button" class="btn principal pequeno" data-nova-nota>${icone('adicionar')} Anexar nota</button></div><div data-lista-notas></div>`);
 const carregar=async()=>{const lista=await api('GET','notas',{viagem_id:v.id,limite:1000});elemento.querySelector('[data-lista-notas]').innerHTML=lista.length?lista.map(n=>`<button type="button" class="linha-detalhe" data-documento="${esc(n.id)}"><span><strong>NF ${esc(n.numero||'sem número')}</strong><small>${dataCurta(n.data)}</small></span>${icone('setaDireita')}</button>`).join(''):'<p class="ajuda">Nenhuma nota anexada.</p>';elemento.querySelectorAll('[data-documento]').forEach(b=>b.onclick=()=>abreNota(lista.find(n=>String(n.id)===b.dataset.documento),atualizar));};
 elemento.querySelector('[data-nova-nota]').onclick=()=>anexaNotaViagem({...v,nota_fiscal_numero:''},async()=>{await carregar();await atualizar?.();});
 elemento.closest('.janela').addEventListener('retomar-janela',()=>carregar().catch(e=>recado(e.message)));await carregar();
}

function anexaNotaViagem(v, atualizar) {
  formNota(null, atualizar, { viagem_id: v.id, viagem_origem: v.origem, viagem_destino: v.destino,
    cliente: v.cliente, numero: v.nota_fiscal_numero, caminhao_id: v.caminhao_id, placa: v.placa });
}

function formPagamentoViagem(v, atualizar, encerrar = false) {
  const pendente = pendenteViagem(v);
  const { elemento, fechar } = janela(encerrar ? 'Encerrar viagem' : 'Pagamento da viagem', `<form class="form-pilha" novalidate>
    <div class="pagamento-destaque"><span>${esc(v.cliente || 'Cliente não informado')}</span><strong>${dinheiro(pendente)}</strong><small>Saldo pendente · recebido ${dinheiro(v.recebido_centavos)} de ${dinheiro(v.valor_frete_centavos)}</small></div>
    ${encerrar ? `<div class="linha duas"><div class="campo"><label for="e-fim">Data de chegada</label><input id="e-fim" name="fim" type="date" min="${esc(v.inicio)}" value="${hoje()}" required></div><div class="campo"><label for="e-km">Km na chegada (opcional)</label><input id="e-km" name="km_final" inputmode="numeric"></div></div>` : ''}
    ${pendente ? `${campoDinheiroViagem('valor_pago', 'Valor recebido agora (além da entrada)')}
    <label class="opcao-integral"><input type="checkbox" name="integral" value="1"> ${encerrar ? 'Valor pago integralmente' : 'Serviço quitado · receber todo o saldo'}</label>
    <div class="campo"><label for="e-data-pg">Data do recebimento</label><input id="e-data-pg" name="data_pagamento" type="date" value="${hoje()}"></div>
    <p class="ajuda">${encerrar ? 'Se ficar em branco, a viagem será encerrada com pagamento pendente. Valores parciais abatem apenas o que foi recebido.' : 'A quitação registra uma receita no saldo pendente. Você também pode informar apenas um pagamento parcial.'}</p>` : `<p class="ajuda">${Number(v.valor_frete_centavos) ? 'Esta viagem já está paga.' : 'O valor da viagem ainda não foi definido. Você pode informá-lo em Editar viagem.'}</p>`}
    <div class="acoes fim"><button class="btn" type="button" data-cancelar>Cancelar</button><button class="btn principal" type="submit">${encerrar ? 'Encerrar viagem' : 'Registrar pagamento'}</button></div></form>`);
  const form = elemento.querySelector('form');
  form.querySelector('[data-cancelar]').onclick = fechar;
  if (form.elements.integral) {
    form.elements.integral.checked = !encerrar;
    const alterna = () => { form.elements.valor_pago.disabled = form.elements.integral.checked; };
    form.elements.integral.onchange = alterna; alterna();
  }
  aoEnviar(form, async (dados) => {
    const r = await api('POST', encerrar ? 'viagem-encerrar' : 'viagem-pagamento', { id: v.id }, dados);
    fechar(); recado(r?.offline ? GUARDADO_OFFLINE : encerrar ? 'Viagem encerrada. Saldo atualizado.' : 'Pagamento registrado.');
    await atualizar?.();
  });
}

async function telaClientes(alvo) {
  alvo.innerHTML = `<div class="pilha"><div class="titulo-secao"><div class="cabecalho-secao"><div><span class="sobre-titulo">RELACIONAMENTOS</span><h1>Clientes</h1><p>Contatos, viagens e documentos sempre à mão.</p></div><button class="btn principal" id="novo-cliente" type="button">${icone('adicionar')} Novo cliente</button></div></div>
    <div class="cartao"><div class="campo"><label for="cliente-busca">Buscar cliente</label><input id="cliente-busca" type="search" placeholder="Nome, cidade, contato ou documento" list="clientes-keywords"></div><label class="opcao-integral"><input id="clientes-arquivados" type="checkbox"> Mostrar também clientes arquivados</label></div><div id="clientes-lista"></div></div>`;
  let clientes = [];
  const desenha = () => {
    const busca = alvo.querySelector('#cliente-busca').value;
    const mostrar = alvo.querySelector('#clientes-arquivados').checked;
    const lista = clientes.filter((c) => (mostrar || Number(c.ativo)) && combinaBusca(busca,palavrasCliente(c)));
    const caixa = alvo.querySelector('#clientes-lista');
    caixa.innerHTML = lista.length ? `<div class="lista-clientes">${lista.map((c) => `<article class="cartao cliente-card" data-cliente-card="${esc(c.id)}">
      <div class="cliente-card-topo"><span class="cliente-marca" aria-hidden="true">${icone('usuario')}</span><span class="cliente-situacao ${Number(c.ativo)?'':'arquivado'}">${Number(c.ativo)?'Ativo':'Arquivado'}</span><button class="btn pequeno cliente-editar" type="button" data-editar-cliente="${esc(c.id)}" ${Fila.ehLocal(c.id)?'disabled':''} aria-label="Editar ${esc(c.nome)}">${icone('editar')}</button></div>
      <div class="cliente-identidade"><div class="cliente-nome-contato"><h2><button type="button" class="cliente-titulo" data-historico="${esc(c.id)}">${esc(c.nome)}</button></h2>${contatoWhatsapp(c)}</div><p class="cliente-documento">${c.documento?`CPF/CNPJ ${esc(c.documento)}`:'Documento não informado'}</p></div>
      <dl class="cliente-card-contatos"><div><dt>Telefone</dt><dd>${esc(c.telefone || 'Não informado')}</dd></div><div><dt>Localização</dt><dd>${esc([c.cidade,c.uf].filter(Boolean).join(' / ') || 'Não informada')}</dd></div>${c.email?`<div class="cliente-email"><dt>E-mail</dt><dd>${contatoEmail(c.email)}</dd></div>`:''}</dl>
      <div class="cliente-card-base"><span class="cliente-viagens"><strong>${Number(c.qtd_viagens)||0}</strong> ${(Number(c.qtd_viagens)||0)===1?'viagem':'viagens'}<small>Toque para ver o histórico</small></span>${Number(c.ativo)?`<button class="btn pequeno cliente-nova-viagem" type="button" data-nova-cliente="${esc(c.id)}">${icone('adicionar')} Nova viagem</button>`:''}</div>${seloCadastro(c)}</article>`).join('')}</div>` : '<div class="vazio">Nenhum cliente encontrado. Cadastre o primeiro cliente para começar.</div>';
    caixa.querySelectorAll('[data-cliente-card]').forEach((card)=>{const abrir=()=>historicoCliente(clientes.find((c)=>String(c.id)===card.dataset.clienteCard)).catch((e)=>recado(e.message));card.onclick=(e)=>{if(!e.target.closest('button,a,input'))abrir();};card.onkeydown=(e)=>{if(e.target===card && ['Enter',' '].includes(e.key)){e.preventDefault();abrir();}};});
    caixa.querySelectorAll('[data-historico]').forEach((b) => { b.onclick = () => historicoCliente(clientes.find((c) => String(c.id) === String(b.dataset.historico))).catch((e) => recado(e.message)); });
    caixa.querySelectorAll('[data-nova-cliente]').forEach((b) => { b.onclick = () => abreFormViagem(null, atualiza, { cliente_id: b.dataset.novaCliente }); });
    caixa.querySelectorAll('[data-editar-cliente]').forEach((b) => { b.onclick = () => formCliente(clientes.find((c) => String(c.id) === String(b.dataset.editarCliente)), atualiza); });
  };
  const atualiza = async () => { clientes = await api('GET', 'clientes'); estado.clientes = clientes; alvo.querySelector('#clientes-keywords')?.remove(); alvo.insertAdjacentHTML('beforeend',sugestoesBusca('clientes-keywords',clientes.flatMap((c)=>[c.nome,c.cidade,c.documento]))); desenha(); };
  alvo.querySelector('#cliente-busca').oninput = desenha;
  alvo.querySelector('#clientes-arquivados').onchange = desenha;
  alvo.querySelector('#novo-cliente').onclick = () => formCliente(null, atualiza);
  await atualiza();
}

function formCliente(c, atualizar) {
  const v = c || {};
  const { elemento, fechar } = janela(c ? 'Editar cliente' : 'Novo cliente', `<form class="form-pilha" novalidate>
    ${[['nome', 'Nome do cliente', 90], ['telefone', 'Telefone / WhatsApp', 30], ['documento', 'CPF/CNPJ (opcional)', 30], ['email', 'E-mail (opcional)', 120]].map(([nome, label, max]) => `<div class="campo"><label for="c-${nome}">${label}</label><input id="c-${nome}" name="${nome}" maxlength="${max}" ${nome === 'nome' ? 'required' : ''} ${nome === 'email' ? 'type="email"' : nome === 'telefone' ? 'type="tel"' : ''} value="${esc(v[nome] || '')}"></div>`).join('')}
    <details class="form-bloco form-compacto"><summary>Endereço (opcional)</summary><div class="endereco-grade">${[['cep','CEP',12],['logradouro','Rua / endereço',140],['numero','Número',20],['complemento','Complemento',90],['bairro','Bairro',80],['cidade','Cidade',80],['uf','UF',2]].map(([nome,label,max]) => `<div class="campo"><label for="c-${nome}">${label}</label><input id="c-${nome}" name="${nome}" maxlength="${max}" value="${esc(v[nome] || '')}"></div>`).join('')}</div></details>
    <div class="campo"><label for="c-obs">Observações</label><textarea id="c-obs" name="observacao" maxlength="500">${esc(v.observacao || '')}</textarea></div>
    ${c ? `<div class="campo"><label for="c-ativo">Situação</label><select id="c-ativo" name="ativo"><option value="1" ${Number(c.ativo) ? 'selected' : ''}>Ativo</option><option value="0" ${!Number(c.ativo) ? 'selected' : ''}>Arquivado · manter histórico</option></select></div>` : ''}
    <div class="acoes fim"><button class="btn" type="button" data-cancelar>Cancelar</button><button class="btn principal" type="submit">Salvar cliente</button></div></form>`);
  const form = elemento.querySelector('form'); form.querySelector('[data-cancelar]').onclick = fechar;
  ligaEndereco(form);
  aoEnviar(form, async (dados) => { const r=await api(c ? 'PUT' : 'POST', c ? 'cliente' : 'clientes', c ? { id: c.id } : {}, dados); fechar(); recado(r?.offline ? GUARDADO_OFFLINE : 'Cliente salvo.'); await atualizar(); });
}

async function historicoCliente(c) {
  const contato=[['Telefone',c.telefone],['E-mail',c.email],['Documento',c.documento],['Endereço',[c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.uf,c.cep].filter(Boolean).join(', ')]].filter(([,v])=>v);
  const { elemento, fechar } = janela(c.nome, `<dl class="historico-cliente-contato">${contato.map(([rotulo,valor])=>`<div><dt>${esc(rotulo)}</dt><dd>${rotulo==='E-mail'?contatoEmail(valor):esc(valor)}</dd></div>`).join('')}</dl>${c.observacao ? `<p class="historico-cliente-observacao">${esc(c.observacao)}</p>` : ''}<div class="historico-cliente-acoes">${Number(c.ativo) ? `<button class="btn principal" id="historico-nova" type="button">${icone('adicionar')} Nova viagem</button>` : ''}</div><h3>Viagens deste cliente</h3><div id="historico-lista"></div>`);
  let viagens = [], pagina = 0;
  const carrega = async (reiniciar = false) => {
    if (reiniciar) { viagens = []; pagina = 0; }
    const lote = await api('GET', 'viagens', { cliente_id: c.id, limite: 300, pagina: pagina + 1 });
    viagens.push(...lote); pagina++;
    const caixa = elemento.querySelector('#historico-lista');
    caixa.innerHTML = viagens.length ? `<div class="lista-viagens">${viagens.map(resumoViagemCard).join('')}</div>${lote.length === 300 ? '<button class="btn" type="button" data-mais>Carregar mais viagens</button>' : ''}` : '<div class="vazio">Este cliente ainda não tem viagens.</div>';
    ligaCardsViagem(caixa, viagens, () => carrega(true));
    caixa.querySelector('[data-mais]')?.addEventListener('click', () => carrega().catch((e) => recado(e.message)));
  };
  elemento.querySelector('#historico-nova')?.addEventListener('click', () => { abreFormViagem(null, () => carrega(true), { cliente_id: c.id }); });
  elemento.closest('.janela').addEventListener('retomar-janela', () => carrega(true).catch((e) => recado(e.message)));
  await carrega();
}

function clientesRecentes() {
  return estado.clientes.filter((c) => Number(c.ativo)).sort((a,b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')) || (Number(b.id)||0) - (Number(a.id)||0)).slice(0,10);
}
function pesquisaCliente(form) {
  const {elemento, fechar} = janela('Pesquisar cliente', '<div class="campo"><label for="pesquisa-cliente">Palavras-chave do cliente</label><input id="pesquisa-cliente" type="search" placeholder="Nome, cidade, telefone ou documento"></div><div data-resultados-clientes></div>');
  const desenha = () => {
    const texto = elemento.querySelector('input').value;
    const itens = estado.clientes.filter((c) => Number(c.ativo) && combinaBusca(texto,palavrasCliente(c)));
    const caixa = elemento.querySelector('[data-resultados-clientes]');
    caixa.innerHTML = (itens.length>50 ? '<p class="ajuda">Mostrando 50 resultados. Digite mais letras para refinar.</p>':'') + itens.slice(0,50).map((c) => `<button type="button" class="resultado-cliente" data-escolher-cliente="${esc(c.id)}">${esc(c.nome)} ${icone('setaDireita')}</button>`).join('') || '<p class="ajuda">Nenhum cliente encontrado.</p>';
    caixa.querySelectorAll('[data-escolher-cliente]').forEach((b) => b.onclick = () => {
      const c = estado.clientes.find((c) => String(c.id) === b.dataset.escolherCliente);
      if (![...form.elements.cliente_id.options].some((o) => o.value === String(c.id))) form.elements.cliente_id.add(new Option(c.nome,c.id),1);
      form.elements.cliente_id.value = c.id; form.elements.cliente_id.dispatchEvent(new Event('change')); fechar();
    });
  };
  elemento.querySelector('input').oninput = desenha; desenha(); elemento.querySelector('input').focus();
}

async function abreViagem(inicial, aoConcluir) {
  let v = inicial;
  const {elemento, fechar} = janela('Detalhes da viagem', '<p class="carregando">Carregando viagem…</p>');
  elemento.closest('.conteudo').classList.add('modal-detalhe-viagem');
  const atualizar = async () => {
    let notas = [], itens = [];
    if (Fila.ehLocal(v.id)) {
      notas=await api('GET','notas',{viagem_id:v.id,limite:1000});
    }
    if (!Fila.ehLocal(v.id)) {
      const [viagens, movimentos, documentos] = await Promise.all([
        api('GET','viagens',{id:v.id}), api('GET','lancamentos',{viagem_id:v.id,limite:1000}), api('GET','notas',{viagem_id:v.id,limite:1000})
      ]);
      v = viagens.find((x) => String(x.id) === String(v.id)) || v;
      itens = movimentos.itens; notas = documentos;
    }
    elemento.innerHTML = `<div class="detalhe-viagem-compacto"><header class="viagem-detalhe-cabecalho"><div class="detalhe-identidade"><span class="sobre-titulo">CLIENTE</span><span class="badge-status ${v.status === 'aberta' ? 'aberta' : 'encerrada'}">${v.status === 'aberta' ? 'Em andamento' : 'Encerrada'}</span></div><h3>${esc(v.cliente || 'Cliente não informado')}</h3>
      <div class="viagem-detalhe-rota"><div><span class="rota-ponto partida"></span><div><small>Origem</small><strong>${esc(localViagem(v.origem))}</strong></div></div><div><span class="rota-ponto chegada"></span><div><small>Destino</small><strong>${esc(localViagem(v.destino))}</strong></div></div></div></header>
      <dl class="viagem-detalhe-operacao"><div><dt>Saída</dt><dd>${dataCurta(v.inicio)}</dd></div><div><dt>Chegada</dt><dd>${v.fim?dataCurta(v.fim):'Em andamento'}</dd></div><div><dt>Motorista</dt><dd>${esc(v.motorista || estado.usuario.nome)}</dd></div><div><dt>Caminhão</dt><dd>${esc(v.placa || 'Não informado')}</dd></div>${v.km_inicial!=null?`<div><dt>Km inicial</dt><dd>${esc(v.km_inicial)}</dd></div>`:''}${v.km_final!=null?`<div><dt>Km final</dt><dd>${esc(v.km_final)}</dd></div>`:''}</dl>
      <section class="viagem-detalhe-financeiro" aria-label="Resumo financeiro"><h3>Resumo financeiro</h3><div class="detalhe-numeros">${[['Valor combinado',v.valor_frete_centavos,'combinado'],['Recebido',v.recebido_centavos,'recebido'],['Pendente a receber',pendenteViagem(v),'pendente'],['Despesas',v.saidas_centavos,'despesas']].map(([label,valor,classe]) => `<div class="numero-${classe}"><small>${label}</small><strong>${dinheiro(valor)}</strong></div>`).join('')}</div></section>
      ${v.observacao ? `<section class="viagem-detalhe-observacao"><h3>Observações</h3><p>${esc(v.observacao)}</p></section>` : ''}
      <section class="detalhe-secao"><div class="cabecalho-secao"><h3>Notas fiscais <small>(${notas.length})</small></h3><button type="button" class="btn pequeno" data-anexar>${icone('nota')} Anexar</button></div>
        ${v.nota_fiscal_numero ? `<p class="ajuda">Número informado: ${esc(v.nota_fiscal_numero)}</p>` : ''}
        ${notas.length ? notas.map((n) => `<button class="linha-detalhe" type="button" data-nota="${esc(n.id)}"><span><strong>NF ${esc(n.numero || 'sem número')}</strong><small>${dataCurta(n.data)}</small></span>${icone('setaDireita')}</button>`).join('') : '<p class="ajuda">Nenhum arquivo anexado.</p>'}</section>
      <section class="detalhe-secao"><div class="cabecalho-secao"><h3>Lançamentos <small>(${itens.length})</small></h3><button type="button" class="btn pequeno botao-adicionar-movimento" data-gasto>${icone('adicionar')} Adicionar</button></div>
        ${itens.length ? itens.map((l) => `<button type="button" class="linha-detalhe movimento-detalhe" data-movimento="${esc(l.id)}"><span><strong>${esc(l.descricao || l.categoria)}</strong><small>${dataCurta(l.data)}${l.categoria && l.descricao ? ` · ${esc(l.categoria)}` : ''}${l.pagamento ? ` · ${esc(l.pagamento)}` : ''}</small></span><strong class="${l.tipo === 'entrada' ? 'entrada':'saida'}">${l.tipo === 'entrada' ? '+':'−'} ${dinheiro(l.valor_centavos)}</strong></button>`).join('') : '<p class="ajuda">Nenhum lançamento nesta viagem.</p>'}</section>
      ${Fila.ehLocal(v.id) ? '<p class="aviso info">Viagem guardada no aparelho. Ela será enviada quando houver conexão.</p>' : ''}
      ${!ehAdmin() ? avisoPrazo(v) : ''}
      <div class="acoes detalhe-acoes"><span class="detalhe-acoes-titulo">Gerenciar viagem</span>
        ${!Fila.ehLocal(v.id) && v.pode_alterar ? '<button class="btn pequeno" type="button" data-editar>Editar</button><button class="btn pequeno perigo" type="button" data-excluir>Excluir</button>' : ''}

        ${v.status === 'aberta' ? '<button class="btn principal pequeno" type="button" data-encerrar>Encerrar viagem</button>' : ehAdmin() && pendenteViagem(v) ? '<button class="btn principal pequeno" type="button" data-quitar>Registrar pagamento</button>' : ''}
      </div></div>`;
    const mudou = async () => { await atualizar(); await aoConcluir?.(); };
    elemento.querySelector('[data-anexar]').onclick = () => anexaNotaViagem(v, mudou);
    elemento.querySelector('[data-gasto]').onclick = () => abreFormLancamento('saida',null,mudou,{viagem_id:v.id,viagem_origem:v.origem,viagem_destino:v.destino,caminhao_id:v.caminhao_id,usuario_id:v.usuario_id});
    elemento.querySelector('[data-editar]')?.addEventListener('click', () => abreFormViagem(v,mudou));
    elemento.querySelector('[data-encerrar]')?.addEventListener('click', () => formPagamentoViagem(v,mudou,true));
    elemento.querySelector('[data-quitar]')?.addEventListener('click', () => formPagamentoViagem(v,mudou));
    elemento.querySelector('[data-diarias]')?.addEventListener('click', () => formDiaria(null,mudou,{usuario_id:v.usuario_id,viagem_id:v.id,viagem_origem:v.origem,viagem_destino:v.destino,de:v.inicio,ate:v.fim || hoje()}));
    elemento.querySelectorAll('[data-nota]').forEach((b) => b.onclick = () => abreNota(notas.find((n) => String(n.id) === b.dataset.nota),mudou));
    elemento.querySelectorAll('[data-movimento]').forEach((b) => b.onclick = () => abreLancamento(b.dataset.movimento,mudou).catch((e) => recado(e.message)));
    elemento.querySelector('[data-excluir]')?.addEventListener('click',async () => {
      if (!confirm('Excluir a viagem? Os lançamentos serão mantidos no histórico.')) return;
      try { await api('DELETE','viagem',{id:v.id}); fechar(); await aoConcluir?.(); } catch(e) { recado(e.message); }
    });
    vigiaPrazo(elemento,v);
  };
  elemento.closest('.janela').addEventListener('retomar-janela', () => atualizar().catch((e) => recado(e.message)));
  await atualizar();
}

function organizaEtapasViagem(form) {
  const secoes=[...form.children].filter((el)=>el.matches('section,details'));
  const grupos=[[secoes[0]],[secoes[1],secoes[4]],[secoes[2],secoes[3]]];
  const titulos=['Cliente e rota','Operação','Valores e nota'];
  const topo=document.createElement('div');topo.className='passos-viagem';topo.setAttribute('aria-label','Etapas do cadastro');form.prepend(topo);
  const paginas=grupos.map((grupo,i)=>{const pagina=document.createElement('div');pagina.className='pagina-viagem';pagina.dataset.pagina=i;grupo.filter(Boolean).forEach((s)=>pagina.append(s));topo.after(pagina);return pagina;});
  paginas.forEach((p)=>form.insertBefore(p,form.querySelector('.acoes.fim')));
  let etapa=0;
  const salvar=form.querySelector('button[type="submit"]'), rotuloSalvar=salvar.textContent;
  const voltar=document.createElement('button');voltar.type='button';voltar.className='btn';voltar.textContent='Voltar';salvar.before(voltar);
  const mostrar=(i)=>{etapa=i;paginas.forEach((p,n)=>p.hidden=n!==i);topo.innerHTML=titulos.map((t,n)=>`<span class="${n===i?'atual':n<i?'concluida':''}" ${n===i?'aria-current="step"':''}><b>${n+1}</b>${t}</span>`).join('');voltar.hidden=i===0;salvar.textContent=i===2?rotuloSalvar:'Continuar';form.closest('.conteudo')?.scrollTo({top:0});};
  voltar.onclick=()=>mostrar(Math.max(0,etapa-1));
  form.addEventListener('submit',(e)=>{
    const campos=etapa===2?[...form.elements]:[...paginas[etapa].querySelectorAll('input,select,textarea')];
    const invalido=campos.find((el)=>el.willValidate && !el.checkValidity());
    if(invalido){e.preventDefault();e.stopImmediatePropagation();const i=paginas.findIndex((p)=>p.contains(invalido));if(i>=0)mostrar(i);invalido.reportValidity();return;}
    if(etapa<2){e.preventDefault();e.stopImmediatePropagation();mostrar(etapa+1);}
  },true);
  mostrar(0);
}
