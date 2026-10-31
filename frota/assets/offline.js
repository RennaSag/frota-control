// Cópias por usuário e projeção dos cadastros ainda não enviados.
function chaveOffline(rota, params = {}) {
  return `dados:${estado.usuario?.id || 'sessao'}:${rota}:${JSON.stringify(Object.entries(params).filter(([,v]) => v !== '' && v != null).sort())}`;
}

async function memorizaDados(rota, params, dados) {
  if (rota === 'eu') {
    await Fila.defineMeta('sessao-offline',{usuario:dados,ate:Date.now()+30*86400000});
    return;
  }
  if (!estado.usuario) return;
  if(rota==='diarias' && !params.usuario_id){await Fila.defineMeta(`base:${estado.usuario.id}:diarias:${dados.mes}:${params.escopo==='pendentes'?'pendentes':'mes'}`,dados);if(params.escopo==='pendentes')await Fila.defineMeta(`base:${estado.usuario.id}:diarias-pendentes`,dados);}
  await Fila.defineMeta(chaveOffline(rota,params),dados);
  if (rota==='lancamentos' && dados?.itens && !params.viagem_id && !params.de && !params.ate && !params.tipo) await Fila.defineMeta(`base:${estado.usuario.id}:lancamentos`,dados);
  if (Array.isArray(dados) && !['id','cliente_id','viagem_id','status','usuario_id','busca','mes'].some((k) => params[k])) {
    await Fila.defineMeta(`base:${estado.usuario.id}:${rota}`,dados);
  }
}

function filtraOffline(rota, itens, p) {
  const busca = p.busca || '';
  return itens.filter((v) => (!p.id || String(v.id)===String(p.id))
    && (!p.cliente_id || String(v.cliente_id)===String(p.cliente_id))
    && (!p.viagem_id || String(v.viagem_id)===String(p.viagem_id))
    && (!p.usuario_id || String(v.usuario_id)===String(p.usuario_id))
    && (!p.status || v.status===p.status)
    && (!p.tipo || v.tipo===p.tipo)
    && (!p.categoria_id || String(v.categoria_id)===String(p.categoria_id))
    && (!p.caminhao_id || String(v.caminhao_id)===String(p.caminhao_id))
    && (!p.de || String(v.data || v.inicio)>=p.de)
    && (!p.ate || String(v.data || v.inicio)<=p.ate)
    && (!p.mes || String(v.data || v.inicio).startsWith(p.mes))
    && (!busca || combinaBusca(busca,[v.cliente,v.cliente_atual,v.numero,v.observacao,v.nome,v.descricao,v.categoria,v.motorista,v.placa,v.viagem_origem,v.viagem_destino,v.lugar])));
}

async function dadosOffline(rota, params = {}) {
  if (rota === 'eu') {
    const s=await Fila.meta('sessao-offline');
    if (s?.ate > Date.now()) return s.usuario;
    return null;
  }
  let dados=await Fila.meta(chaveOffline(rota,params));
  if (dados == null && ['clientes','caminhoes','categorias','usuarios','viagens','notas'].includes(rota)) {
    const base=await Fila.meta(`base:${estado.usuario?.id}:${rota}`);
    if (base) dados=filtraOffline(rota,base,params);
  }
  if(dados==null && rota==='diarias'){const base=await Fila.meta(`base:${estado.usuario?.id}:diarias:${params.mes || estado.mes}:${params.escopo==='pendentes'?'pendentes':'mes'}`) || (params.escopo==='pendentes'?await Fila.meta(`base:${estado.usuario?.id}:diarias-pendentes`):null);if(base){dados=structuredClone(base);if(params.mes && dados.mes!==params.mes){dados.mes=params.mes;dados.pagamentos=[];dados.pagamentos_disponiveis=false;}if(params.usuario_id){for(const k of ['itens','motoristas','pagamentos'])dados[k]=(dados[k]||[]).filter((d)=>String(d.usuario_id)===String(params.usuario_id));}}}
  if (dados == null && rota==='lancamentos') {
    const base=await Fila.meta(`base:${estado.usuario?.id}:lancamentos`);
    if(base) { const itens=filtraOffline(rota,base.itens,params);dados={...base,itens,qtd:itens.length}; }
  }
  if (dados == null && rota==='lancamento' && Fila.ehLocal(params.id)) {
    const fila=await Fila.lista(estado.usuario.id);
    const e=fila.find((e) => e.ref===params.id && e.rota==='lancamentos');
    if(e) return projetaRegistro(e);
  }
  if (dados == null && ['clientes','caminhoes','categorias','viagens','notas'].includes(rota)) dados=[];
  return dados == null ? null : incorporaCadastros(rota,dados,params);
}

function dinheiroDigitado(valor) {
  let s=String(valor || '').trim().replace(/R\$|\s/g,'');
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  return Math.round((Number(s)||0)*100);
}

function projetaRegistro(e) {
  const c=e.corpo || {}, categoria=estado.categorias.find((x) => String(x.id)===String(c.categoria_id));
  const motorista=estado.usuarios.find((x) => String(x.id)===String(c.usuario_id || estado.usuario.id));
  const cliente=estado.clientes.find((x) => String(x.id)===String(c.cliente_id));
  return {...c,id:e.ref,ativo:1,offline:true,pode_alterar:false,
    usuario_id:c.usuario_id || estado.usuario.id,criado_em:new Date(e.criadoEm-new Date(e.criadoEm).getTimezoneOffset()*60000).toISOString().slice(0,19).replace('T',' '),
    motorista:motorista?.nome || estado.usuario.nome,categoria:categoria?.nome || 'Lançamento',tipo:c.tipo || categoria?.tipo,
    cliente:c.cliente_novo || cliente?.nome || c.cliente,valor_centavos:dinheiroDigitado(c.valor),
    valor_frete_centavos:dinheiroDigitado(c.valor_viagem),recebido_centavos:dinheiroDigitado(c.valor_entrada),saidas_centavos:0,
    status:e.rota==='viagens'?'aberta':c.status,qtd_notas:c.nota_arquivo?1:0,nota_fiscal_numero:c.nota_numero,
    qtd_viagens:0,pede_litros:0,pede_descricao:0,icone:'tag',oculta_motorista:Number(c.oculta_motorista || 0)};
}

async function incorporaCadastros(rota, dados, params = {}) {
  if (!estado.usuario) return dados;
  dados=structuredClone(dados);
  const fila=(await Fila.lista(estado.usuario.id)).filter((e) => !e.erro);
  const novos=fila.filter((e) => e.rota===rota && e.metodo==='POST').map(projetaRegistro);
  if(rota==='notas') novos.push(...fila.filter((e)=>e.rota==='viagens' && e.corpo?.nota_arquivo).map((e)=>projetaRegistro({...e,corpo:{arquivo:e.corpo.nota_arquivo,numero:e.corpo.nota_numero,data:e.corpo.nota_data,viagem_id:e.ref,cliente:e.corpo.cliente_novo},rota:'notas'})));
  if (Array.isArray(dados)) {
    const base=[...dados,...novos.filter((n) => !dados.some((d) => String(d.id)===String(n.id)))];
    if(rota==='viagens') {
      for(const e of fila.filter((e) => ['viagem-encerrar','viagem-pagamento'].includes(e.rota))) {
        const v=base.find((v) => String(v.id)===String(e.params.id));
        if(v) { if(e.rota==='viagem-encerrar') {v.status='encerrada';v.fim=e.corpo.fim;} v.recebido_centavos=Number(v.recebido_centavos || 0)+(e.corpo.integral==='1'?Math.max(0,Number(v.valor_frete_centavos || 0)-Number(v.recebido_centavos || 0)):dinheiroDigitado(e.corpo.valor_pago)); }
      }
    }
    return filtraOffline(rota,base,params);
  }
  if(rota==='diarias' && dados?.itens) {
    const itens=[...dados.itens];
    for(const e of fila.filter((e)=>e.rota==='diarias')) {
      const c=e.corpo, usuario=c.usuario_id || estado.usuario.id, u=estado.usuarios.find((u)=>String(u.id)===String(usuario)) || estado.usuario;
      const semana=(c.dias_semana || [0,1,2,3,4,5,6]).map(Number);
      const fim=new Date((c.ate || c.de)+'T12:00:00');
      for(let dia=new Date(c.de+'T12:00:00'),i=0;dia<=fim && i<62;dia.setDate(dia.getDate()+1),i++) {
        if(!semana.includes(dia.getDay())) continue;
        const data=new Date(dia.getTime()-dia.getTimezoneOffset()*60000).toISOString().slice(0,10);
        if(params.usuario_id && String(params.usuario_id)!==String(usuario)) continue;
        if(params.escopo!=='pendentes' && params.mes && !data.startsWith(params.mes)) continue;
        if(itens.some((d)=>String(d.usuario_id)===String(usuario) && d.data===data)) continue;
        const valor=c.valor ? dinheiroDigitado(c.valor) : Number(u.valor_diaria_centavos || 0);
        itens.push({...projetaRegistro(e),id:e.ref+'@'+data,data,usuario_id:usuario,motorista:u.nome,valor_centavos:valor,pago:false});
        let m=dados.motoristas.find((m)=>String(m.usuario_id)===String(usuario));
        if(!m) {m={usuario_id:usuario,nome:u.nome,valor_diaria_centavos:u.valor_diaria_centavos,dias:0,total_centavos:0,pago_centavos:0,pendente_centavos:0,pendente_geral_centavos:0,dias_pendentes_geral:0};dados.motoristas.push(m);}
        m.dias++;m.total_centavos+=valor;m.pendente_centavos+=valor;m.pendente_geral_centavos+=valor;m.dias_pendentes_geral++;
      }
    }
    const pendentesGuardados=await Fila.meta(`base:${estado.usuario.id}:diarias-pendentes`);
    const catalogo=new Map([...(pendentesGuardados?.itens||[]),...itens].map((d)=>[String(d.id),d]));
    const pagosLocais=new Set();
    dados.pagamentos=[...(dados.pagamentos||[])];
    for(const envio of fila.filter((e)=>e.rota==='diarias-pagar')){
      const c=envio.corpo, ids=new Set((c.ids||[]).map(String));
      const selecionados=[...catalogo.values()].filter((d)=>!d.pago && !pagosLocais.has(String(d.id)) && String(d.usuario_id)===String(c.usuario_id) && (ids.size?ids.has(String(d.id)):String(d.data).startsWith(c.mes||params.mes)));
      if(!selecionados.length)continue;
      const total=selecionados.reduce((s,d)=>s+Number(d.valor_centavos),0), m=dados.motoristas.find((m)=>String(m.usuario_id)===String(c.usuario_id));
      if(m){m.pendente_geral_centavos=Math.max(0,Number(m.pendente_geral_centavos)-total);m.dias_pendentes_geral=Math.max(0,Number(m.dias_pendentes_geral)-selecionados.length);}
      for(const d of selecionados){pagosLocais.add(String(d.id));const item=itens.find((v)=>String(v.id)===String(d.id));if(item)Object.assign(item,{pago:true,pago_em:c.data,lancamento_id:envio.ref,pode_alterar:false,pagamento_offline:true});}
      if(String(c.data||'').startsWith(params.mes||dados.mes) && (!params.usuario_id || String(params.usuario_id)===String(c.usuario_id)))dados.pagamentos.push({id:envio.ref,usuario_id:c.usuario_id,motorista:selecionados[0].motorista,valor_centavos:total,data:c.data,pagamento:c.pagamento,dias:selecionados.length,offline:true});
    }
    const visiveis=itens.filter((d)=>!params.usuario_id || String(d.usuario_id)===String(params.usuario_id)).filter((d)=>params.escopo!=='pendentes' || !d.pago);
    for(const m of dados.motoristas){const dias=visiveis.filter((d)=>String(d.usuario_id)===String(m.usuario_id));m.dias=dias.length;m.total_centavos=dias.reduce((s,d)=>s+Number(d.valor_centavos),0);m.pago_centavos=dias.filter((d)=>d.pago).reduce((s,d)=>s+Number(d.valor_centavos),0);m.pendente_centavos=m.total_centavos-m.pago_centavos;}
    dados.totais=Object.fromEntries(['dias','total_centavos','pago_centavos','pendente_centavos'].map((k)=>[k,dados.motoristas.reduce((s,m)=>s+Number(m[k]||0),0)]));
    return {...dados,itens:visiveis};
  }
  if(rota==='lancamentos' && dados?.itens) {
    const itens=filtraOffline(rota,[...dados.itens,...novos],params);
    return {...dados,itens,qtd:Math.max(dados.qtd || 0,itens.length)};
  }
  return dados;
}

async function preparaOffline() {
  if(!estado.usuario || navigator.onLine===false) return;
  const mes=hoje().slice(0,7);
  const consultas=[['eu',{}],['clientes',{}],['caminhoes',{}],['categorias',{}],['usuarios',{}],['viagens',{limite:1000}],['notas',{limite:1000}],
    ['diarias',{mes,escopo:'pendentes'}],['diarias',{mes,usuario_id:'',escopo:'pendentes'}],['diarias',{mes,usuario_id:'',escopo:''}],['lancamentos',{limite:1000}]];
  if(ehAdmin()) consultas.push(['viagens-financeiro',{mes}],['resumo',{de:mes,ate:mes}]);
  else { const anterior=new Date(Number(mes.slice(0,4)),Number(mes.slice(5,7))-2,1);const ant=`${anterior.getFullYear()}-${String(anterior.getMonth()+1).padStart(2,'0')}`;consultas.push(['receita',{mes}],['receita',{mes:ant}]); }
  // Pouca concorrência evita saturar o servidor PHP local e a rede móvel.
  for(let i=0;i<consultas.length;i+=3) await Promise.allSettled(consultas.slice(i,i+3).map(([r,p]) => api('GET',r,p)));
  await Fila.defineMeta('offline-preparado',Date.now());
}
