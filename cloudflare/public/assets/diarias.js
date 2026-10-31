async function telaDiarias(alvo) {
  const admin = ehAdmin();
  const filtro = { mes: hoje().slice(0,7), usuario_id:'', escopo:'pendentes', busca:'' };
  let dados, selecionadas = new Set(), versaoConsulta=0;
  alvo.innerHTML = `<div class="pilha"><div class="cabecalho-secao"><div><h1>${admin ? 'Diárias dos motoristas' : 'Minhas diárias'}</h1><p class="ajuda">Dias trabalhados, pendências e pagamentos em um só lugar.</p></div><button class="btn principal" type="button" data-registrar>${icone('adicionar')} Registrar dias</button></div>
    <div class="cartao"><div class="campo"><label for="diaria-busca">${admin?'Pesquisar motorista':'Pesquisar diárias'}</label><div class="busca-com-filtro"><input type="search" id="diaria-busca" list="diarias-keywords" placeholder="${admin?'Nome, telefone ou usuário do motorista':'Data, viagem ou observação'}"><button class="btn" type="button" data-filtros-diarias aria-label="Filtros de diárias">${icone('filtro')}<span>Filtros</span></button></div></div><small data-filtros-rotulo></small>${sugestoesBusca('diarias-keywords',estado.usuarios.filter((u)=>u.papel==='motorista').map((u)=>u.nome))}</div>
    <div class="diarias-resumo" data-resumo></div><div data-motoristas></div><div data-dias></div></div>`;
  const atualiza = async () => {
    const consultaAtual=++versaoConsulta;
    dados = await api('GET','diarias',{mes:filtro.mes,usuario_id:filtro.usuario_id,escopo:filtro.escopo === 'pendentes' ? 'pendentes':''});
    if(consultaAtual!==versaoConsulta || !alvo.querySelector('[data-dias]'))return;
    const combina=(d)=>{const u=estado.usuarios.find((u)=>String(u.id)===String(d.usuario_id));return combinaBusca(filtro.busca,[d.nome,d.motorista,d.observacao,d.data,d.viagem_origem,d.viagem_destino,u?.nome,u?.usuario,u?.telefone]);};
    dados={...dados,motoristas:dados.motoristas.filter(combina),itens:dados.itens.filter(combina),pagamentos:(dados.pagamentos||[]).filter(combina)};
    alvo.querySelector('[data-filtros-rotulo]').textContent=[filtro.escopo==='pendentes'?'Pendentes de todos os meses':filtro.escopo==='pagamentos'?'Histórico de pagamentos':'Dias registrados',mesLongo(filtro.mes),filtro.usuario_id?estado.usuarios.find((u)=>String(u.id)===String(filtro.usuario_id))?.nome:''].filter(Boolean).join(' · ');
    selecionadas.clear();
    const pendente = dados.motoristas.reduce((s,m) => s + Number(m.pendente_geral_centavos),0);
    const pago = (dados.pagamentos || []).reduce((s,p) => s + Number(p.valor_centavos),0);
    alvo.querySelector('[data-resumo]').innerHTML = `<div class="cartao diaria-resumo-pendente"><small>Pendente · todos os meses</small><strong>${dinheiro(pendente)}</strong></div><div class="cartao diaria-resumo-pago"><small>Pago em ${mesCurto(filtro.mes)}</small><strong>${dados.pagamentos_disponiveis===false?'Consultar online':dinheiro(pago)}</strong></div>`;
    const pessoas = alvo.querySelector('[data-motoristas]');
    pessoas.innerHTML = admin && filtro.escopo !== 'pagamentos' ? `<div class="lista-clientes">${dados.motoristas.filter((m) => m.pendente_geral_centavos || m.dias).map((m) => `<div class="cartao diaria-motorista"><div><strong>${esc(m.nome)}</strong><small>${m.dias_pendentes_geral} dia(s) pendente(s) · ${dinheiro(m.pendente_geral_centavos)}</small><small>Diária: ${m.valor_diaria_centavos ? dinheiro(m.valor_diaria_centavos) : 'definir valor'}</small></div><div class="acoes"><button type="button" class="btn pequeno" data-registrar-motorista="${m.usuario_id}">Registrar</button><button type="button" class="btn pequeno" data-ajustar="${m.usuario_id}">Valor da diária</button><button type="button" class="btn principal pequeno" data-pagar-motorista="${m.usuario_id}" ${m.pendente_geral_centavos ? '':'disabled'}>Pagar pendentes</button></div></div>`).join('')}</div>` : '';
    pessoas.querySelectorAll('[data-registrar-motorista]').forEach((b) => b.onclick = () => formDiaria(null,atualiza,{usuario_id:b.dataset.registrarMotorista}));
    pessoas.querySelectorAll('[data-ajustar]').forEach((b) => b.onclick = () => formValorDiaria(dados.motoristas.find((m) => String(m.usuario_id) === b.dataset.ajustar),atualiza));
    pessoas.querySelectorAll('[data-pagar-motorista]').forEach((b) => b.onclick = async () => {
      try {
        const r = await api('GET','diarias',{escopo:'pendentes',usuario_id:b.dataset.pagarMotorista,mes:filtro.mes});
        formQuitaDiarias(r.itens,atualiza);
      } catch(e) { recado(e.message); }
    });
    const lista = alvo.querySelector('[data-dias]');
    if (filtro.escopo === 'pagamentos') {
      lista.innerHTML = `<div class="cartao"><h2>Pagamentos de ${mesLongo(filtro.mes)}</h2>${dados.pagamentos?.length ? dados.pagamentos.map((p) => `<button class="linha-detalhe" type="button" data-pagamento="${p.id}" ${p.offline?'disabled':''}><span><strong>${esc(p.motorista)}</strong><small>${dataCurta(p.data)} · ${p.dias} diária(s) · ${p.offline?'Aguardando sincronização':esc(p.pagamento || 'Forma não informada')}</small></span><strong class="entrada">${dinheiro(p.valor_centavos)}</strong></button>`).join('') : '<p class="ajuda">Nenhum pagamento neste mês.</p>'}</div>`;
      lista.querySelectorAll('[data-pagamento]').forEach((b) => b.onclick = () => abreLancamento(b.dataset.pagamento,atualiza));
      return;
    }
    lista.innerHTML = `<div class="cartao"><div class="cabecalho-secao"><h2>${filtro.escopo === 'pendentes' ? 'Dias pendentes' : 'Dias registrados'}</h2>${admin ? '<button class="btn principal pequeno" type="button" data-pagar-selecao disabled>Pagar selecionadas</button>':''}</div>
      ${admin && dados.itens.some((d) => !d.pago) ? '<label class="seleciona-diarias"><input type="checkbox" data-todas> Selecionar pendentes deste filtro</label>':''}
      ${dados.itens.length ? dados.itens.map((d) => `<div class="diaria-linha ${d.pago?'paga':'pendente'}">${admin && !d.pago ? `<input type="checkbox" data-selecionar="${esc(d.id)}" aria-label="Selecionar diária de ${esc(d.motorista)} em ${dataCurta(d.data)}">`:''}<button type="button" class="linha-detalhe" data-dia="${esc(d.id)}"><span><strong>${dataCurta(d.data)} · ${esc(d.motorista)}</strong><small>${esc(d.viagem_origem ? `${d.viagem_origem} → ${d.viagem_destino}` : d.observacao || 'Dia trabalhado')} · ${d.pago ? `Paga em ${dataCurta(d.pago_em)}` : 'Pendente'}</small></span><strong>${Number(d.valor_centavos) ? dinheiro(d.valor_centavos) : 'Sem valor'}</strong></button></div>`).join('') : '<p class="ajuda">Nenhuma diária neste filtro.</p>'}</div>`;
    lista.querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => abreDiaria(dados.itens.find((d) => String(d.id) === b.dataset.dia),atualiza));
    const atualizaSelecao = () => {
      selecionadas = new Set([...lista.querySelectorAll('[data-selecionar]:checked')].map((b) => b.dataset.selecionar));
      const b = lista.querySelector('[data-pagar-selecao]');
      if (b) { b.disabled = !selecionadas.size; b.textContent = selecionadas.size ? `Pagar ${selecionadas.size} selecionada(s)` : 'Pagar selecionadas'; }
    };
    lista.querySelectorAll('[data-selecionar]').forEach((b) => b.onchange = atualizaSelecao);
    lista.querySelector('[data-todas]')?.addEventListener('change',(e) => { lista.querySelectorAll('[data-selecionar]').forEach((b) => b.checked=e.target.checked); atualizaSelecao(); });
    lista.querySelector('[data-pagar-selecao]')?.addEventListener('click',() => formQuitaDiarias(dados.itens.filter((d) => selecionadas.has(String(d.id))),atualiza));
  };
  alvo.querySelector('[data-registrar]').onclick = () => formDiaria(null,atualiza,{usuario_id:filtro.usuario_id});
  let buscaTimer;
  alvo.querySelector('#diaria-busca').oninput=(e)=>{filtro.busca=e.target.value;clearTimeout(buscaTimer);buscaTimer=setTimeout(()=>atualiza().catch((e)=>recado(e.message)),150);};
  alvo.querySelector('[data-filtros-diarias]').onclick=()=>{
    const {elemento,fechar}=janela('Filtros de diárias',`<form class="form-pilha"><div class="campo"><label for="df-visao">Visualização</label><select name="escopo" id="df-visao"><option value="pendentes">Pendentes · todos os meses</option><option value="mes">Dias do mês</option><option value="pagamentos">Histórico de pagamentos</option></select></div><div class="campo"><label for="df-mes">Mês</label><input type="month" name="mes" id="df-mes" value="${filtro.mes}" required></div>${admin?`<div class="campo"><label for="df-motorista">Motorista</label><select id="df-motorista" name="usuario_id"><option value="">Todos os motoristas</option>${opcoesMotorista(filtro.usuario_id)}</select></div>`:''}<div class="acoes fim"><button type="button" class="btn" data-limpar>Limpar</button><button type="submit" class="btn principal">Aplicar filtros</button></div></form>`);
    const form=elemento.querySelector('form');form.elements.escopo.value=filtro.escopo;
    form.querySelector('[data-limpar]').onclick=()=>{form.elements.escopo.value='pendentes';form.elements.mes.value=hoje().slice(0,7);if(form.elements.usuario_id)form.elements.usuario_id.value='';filtro.busca='';alvo.querySelector('#diaria-busca').value='';};
    aoEnviar(form,async(v)=>{Object.assign(filtro,{escopo:v.escopo,mes:v.mes,usuario_id:v.usuario_id||''});fechar();await atualiza();});
  };
  await atualiza();
}

function formQuitaDiarias(itens, atualizar) {
  if (!itens.length) { recado('Nenhuma diária pendente.'); return; }
  if (new Set(itens.map((d) => String(d.usuario_id))).size > 1) { recado('Selecione diárias de um motorista por pagamento. Use o filtro Motorista.'); return; }
  if (itens.some((d) => !Number(d.valor_centavos))) { recado('Defina o valor das diárias antes de pagar.'); return; }
  const total = itens.reduce((s,d) => s+Number(d.valor_centavos),0);
  const categorias = categoriasDoTipo('saida');
  const diaria = categorias.find((c) => /di[aá]ria/i.test(c.nome));
  const {elemento,fechar} = janela('Pagar diárias', `<form class="form-pilha"><div class="pagamento-destaque"><span>${esc(itens[0].motorista)}</span><strong>${dinheiro(total)}</strong><small>${itens.length} diária(s) selecionada(s)</small></div><details><summary>Conferir dias do pagamento</summary><p class="ajuda">${itens.map((d) => `${dataCurta(d.data)}: ${dinheiro(d.valor_centavos)}`).join('<br>')}</p></details>
    <div class="linha duas"><div class="campo"><label for="qd-data">Data do pagamento</label><input type="date" id="qd-data" name="data" value="${hoje()}" required></div><div class="campo"><label for="qd-forma">Forma de pagamento</label><select id="qd-forma" name="pagamento">${opcoesPagamento('Pix')}</select></div></div>
    <div class="campo"><label for="qd-categoria">Categoria</label><select id="qd-categoria" name="categoria_id">${categorias.map((c) => `<option value="${esc(c.id)}" ${String(c.id) === String(diaria?.id) ? 'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="campo"><label for="qd-obs">Observação (opcional)</label><input name="observacao" id="qd-obs" maxlength="500"></div><p class="ajuda">O pagamento será registrado em Lançamentos e estas diárias passarão para o histórico de pagas.</p><div class="acoes fim"><button class="btn" type="button" data-cancelar>Cancelar</button><button class="btn principal" type="submit">Confirmar pagamento</button></div></form>`);
  const form=elemento.querySelector('form'); form.querySelector('[data-cancelar]').onclick=fechar;
  aoEnviar(form,async (dados) => {
    const r=await api('POST','diarias-pagar',{}, {...dados,usuario_id:itens[0].usuario_id,ids:itens.map((d) => d.id)});
    fechar(); recado(r?.offline ? GUARDADO_OFFLINE:'Pagamento registrado.'); await atualizar();
  });
}
