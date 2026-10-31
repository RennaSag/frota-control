import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/index.js';

test('Workers: contrato atual, permissões, arquivos e pagamentos atômicos',async(t)=>{
  const pg=new PGlite();await pg.waitReady;
  const adapter={async query(sql,args=[]){
    const r=await pg.query(sql,args);
    for(const row of r.rows||[])for(const field of r.fields||[]){const v=row[field.name];if(v instanceof Date)row[field.name]=field.dataTypeID===1082?v.toISOString().slice(0,10):`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}${field.dataTypeID===1082?'':` ${String(v.getHours()).padStart(2,'0')}:${String(v.getMinutes()).padStart(2,'0')}:${String(v.getSeconds()).padStart(2,'0')}`}`;else if(typeof v==='bigint')row[field.name]=Number(v);else if(v instanceof Uint8Array)row[field.name]='\\x'+Buffer.from(v).toString('hex');}
    return {rows:r.rows||[],rowCount:r.affectedRows??r.rows?.length??0};
  },async end(){}};
  const env={FROTA_AMBIENTE:'teste',FROTA_ADMIN_SENHA:'TesteAdmin!2026',FROTA_ADM_USUARIO:'suporte.adm',FROTA_ADM_SENHA:'SuporteAdm!2026',__TEST_DB:adapter,ASSETS:{async fetch(req){const file=new URL(req.url).pathname;try{return new Response(await fs.readFile(new URL('../public'+file,import.meta.url)));}catch{return new Response('Não encontrado',{status:404});}}}};
  async function api(method,route,body=null,{cookie='',params={},id=null,registered=null}={}){
    const headers={'X-App-Frota':'1'};if(cookie)headers.Cookie=cookie;if(id)headers['X-Fila-Id']=id;if(registered)headers['X-Registrado-Em']=String(registered);
    if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
    const req=new Request('https://frota.test/api.php?'+new URLSearchParams({r:route,...params}),{method,headers,body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});
    const pending=[],res=await worker.fetch(req,env,{waitUntil(p){pending.push(p);}});await Promise.all(pending);
    const data=res.headers.get('Content-Type')?.includes('json')?await res.json():await res.arrayBuffer();
    return {status:res.status,data,cookie:res.headers.get('Set-Cookie')?.split(';')[0]};
  }
  const ok=(r)=>{assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
  let owner,driver,uid,truck,client,trip,categories,category,dailyIds,payment;
  await t.test('Inicialização sem banco externo e acesso por sessão',async()=>{
    owner=(await api('POST','login',{usuario:'admin',senha:'TesteAdmin!2026'})).cookie;assert.ok(owner);
    categories=ok(await api('GET','categorias',null,{cookie:owner}));category=categories.find(c=>c.nome==='Diárias de motorista').id;
    truck=ok(await api('POST','caminhoes',{placa:'TST9A99',apelido:'Scania de teste'},{cookie:owner})).id;
    uid=ok(await api('POST','usuarios',{nome:'João da Silva',usuario:'joao.teste',senha:'TesteMotorista26',papel:'motorista',ativo:true,valor_diaria:'150,00',caminhao_padrao_id:truck},{cookie:owner})).id;
    const login=await api('POST','login',{usuario:'joao.teste',senha:'TesteMotorista26'});ok(login);driver=login.cookie;
    assert.equal(ok(await api('POST','meu-caminhao',{caminhao_padrao_id:truck},{cookie:driver})).caminhao_padrao_id,truck);
    assert.equal((await api('GET','clientes')).status,401);
  });
  await t.test('Clientes e viagem com entrada, quitação e rollback',async()=>{
    client=ok(await api('POST','clientes',{nome:'Fazenda Estrela do Vale',cidade:'São João',uf:'SP',logradouro:'Estrada de teste',numero:'120',email:'teste@example.com'},{cookie:owner})).id;
    const body={usuario_id:uid,caminhao_id:truck,cliente_id:client,origem:'Fazenda A',destino:'Armazém B',inicio:'2026-10-20',km_inicial:'120000',valor_viagem:'1000',valor_entrada:'200'};
    trip=ok(await api('POST','viagens',body,{cookie:owner,id:'worker-trip-0001'})).id;
    assert.equal(ok(await api('POST','viagens',body,{cookie:owner,id:'worker-trip-0001'})).id,trip);
    let v=ok(await api('GET','viagens',null,{cookie:owner,params:{id:trip}}))[0];assert.equal(Number(v.recebido_centavos),20000);assert.equal(Number(v.valor_frete_centavos),100000);
    assert.equal((await api('PUT','viagem',{...body},{cookie:driver,params:{id:trip}})).status,403);
    ok(await api('POST','viagem-encerrar',{fim:'2026-10-21',valor_pago:'100',km_final:'120900'},{cookie:driver,params:{id:trip}}));
    v=ok(await api('POST','viagem-pagamento',{integral:'1'},{cookie:owner,params:{id:trip}}));assert.equal(v.pendente_centavos,0);
    const failed=await api('POST','viagens',{...body,cliente_id:'',cliente_novo:'Cliente rollback',valor_entrada:'9999'},{cookie:owner,id:'worker-rollback-01'});assert.equal(failed.status,400);
    assert.equal(Number((await pg.query("SELECT COUNT(*) AS n FROM clientes WHERE nome='Cliente rollback'")).rows[0].n),0);
  });
  await t.test('Busca por várias palavras, acentos, placa e filtros combinados',async()=>{
    const cat=categories.find(c=>c.nome==='Abastecimento').id;
    const e=ok(await api('POST','lancamentos',{categoria_id:cat,usuario_id:uid,caminhao_id:truck,viagem_id:trip,descricao:'Diesel S10 São João',valor:'300',litros:'50',data:'2026-10-20',pagamento:'Pix'},{cookie:owner}));
    assert.equal(ok(await api('GET','lancamentos',null,{cookie:owner,params:{busca:'joao diesel tst9',categoria_id:cat,caminhao_id:truck}})).qtd,1);
    assert.equal(ok(await api('GET','lancamentos',null,{cookie:owner,params:{busca:'joao diesel tst9',tipo:'entrada'}})).qtd,0);
    ok(await api('PUT','lancamento',{categoria_id:cat,usuario_id:uid,caminhao_id:truck,viagem_id:trip,descricao:'Diesel corrigido',valor:'310',litros:'50',data:'2026-10-20'},{cookie:owner,params:{id:e.id}}));
    ok(await api('DELETE','lancamento',null,{cookie:owner,params:{id:e.id}}));
  });
  await t.test('Pagamento selecionado, reenvio, correção e exclusão das diárias',async()=>{
    const body={usuario_id:uid,de:'2026-10-05',ate:'2026-10-11',dias_semana:[1,2,3,4,5],valor:'150'};
    const d=ok(await api('POST','diarias',body,{cookie:owner,id:'worker-daily-0001'}));assert.equal(d.criadas,5);dailyIds=Object.values(d.ids_por_data);
    const pay={usuario_id:uid,categoria_id:category,data:'2026-10-20',ids:dailyIds.slice(0,2),pagamento:'Pix'};
    payment=ok(await api('POST','diarias-pagar',pay,{cookie:owner,id:'worker-pay-0001'}));assert.equal(payment.total_centavos,30000);
    assert.equal(ok(await api('POST','diarias-pagar',pay,{cookie:owner,id:'worker-pay-0001'})).lancamento_id,payment.lancamento_id);
    assert.equal((await api('POST','diarias-pagar',pay,{cookie:driver})).status,403);
    assert.equal((await api('POST','diarias-pagar',pay,{cookie:owner,id:'worker-pay-0002'})).status,400);
    ok(await api('PUT','diaria',{data:'2026-10-05',valor:'180'},{cookie:owner,params:{id:dailyIds[0]}}));
    assert.equal(Number((await pg.query('SELECT valor_centavos FROM lancamentos WHERE id=$1',[payment.lancamento_id])).rows[0].valor_centavos),33000);
    ok(await api('DELETE','diaria',null,{cookie:owner,params:{id:dailyIds[0]}}));
    assert.equal(Number((await pg.query('SELECT valor_centavos FROM lancamentos WHERE id=$1',[payment.lancamento_id])).rows[0].valor_centavos),15000);
    ok(await api('DELETE','lancamento',null,{cookie:owner,params:{id:payment.lancamento_id}}));
    const list=ok(await api('GET','diarias',null,{cookie:owner,params:{mes:'2026-10',escopo:'pendentes',usuario_id:uid}}));assert.equal(list.itens.length,4);assert.ok(list.pagamentos);
  });
  await t.test('Arquivo autenticado, nota simplificada e metadados preservados',async()=>{
    const f=new FormData();f.append('foto',new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'}),'nota.pdf');
    const filename=ok(await api('POST','comprovante',f,{cookie:driver})).comprovante;
    const n=ok(await api('POST','notas',{arquivo:filename,numero:'TST-001',viagem_id:trip},{cookie:driver}));assert.equal(Number(n.viagem_id),trip);assert.equal(n.cliente,'Fazenda Estrela do Vale');
    const edited=ok(await api('PUT','nota',{arquivo:filename,numero:'TST-002'},{cookie:driver,params:{id:n.id}}));assert.equal(Number(edited.viagem_id),trip);assert.equal(edited.data,n.data);
    const downloaded=await api('GET','comprovante',null,{cookie:owner,params:{arquivo:filename}});assert.equal(downloaded.status,200);assert.ok(downloaded.data.byteLength);
  });
  await t.test('Categorias configuráveis, ordenação atômica e filtros do Panorama',async()=>{
    const nova=ok(await api('POST','categorias',{nome:'Controle diesel teste',tipo:'saida',icone:'combustivel',pede_litros:true,pede_descricao:true},{cookie:owner}));
    let cats=ok(await api('GET','categorias',null,{cookie:owner,params:{todos:'1'}}));
    const registro=cats.find(c=>Number(c.id)===Number(nova.id));assert.equal(Number(registro.pede_litros),1);assert.equal(Number(registro.pede_descricao),1);
    const ids=cats.filter(c=>c.tipo==='saida').map(c=>Number(c.id)).reverse();
    ok(await api('PUT','categorias-ordem',{tipo:'saida',ids},{cookie:owner}));
    cats=ok(await api('GET','categorias',null,{cookie:owner,params:{todos:'1'}}));
    for(const c of cats.filter(c=>c.tipo==='saida'))assert.equal(Number(c.ordem),ids.indexOf(Number(c.id))+1);
    assert.equal((await api('PUT','categorias-ordem',{tipo:'saida',ids:[ids[0],ids[0]]},{cookie:owner})).status,400);
    assert.equal((await api('PUT','categorias-ordem',{tipo:'saida',ids:ids.slice(1)},{cookie:owner})).status,409);
    assert.equal((await api('PUT','categorias-ordem',{tipo:'saida',ids},{cookie:driver})).status,403);
    assert.deepEqual(ok(await api('GET','categorias',null,{cookie:owner,params:{todos:'1'}})),cats);
    const vazio=ok(await api('GET','resumo',null,{cookie:owner,params:{de:'2026-10',ate:'2026-10',usuario_id:999999}}));
    assert.equal(vazio.atual.qtd,0);assert.equal(vazio.por_dia.length,0);assert.equal(vazio.por_caminhao.length,0);
    const filtrado=ok(await api('GET','resumo',null,{cookie:owner,params:{de:'2026-10',ate:'2026-10',categoria_id:cats.find(c=>c.tipo==='entrada').id}}));
    assert.equal(filtrado.atual.saidas_centavos,0);assert.equal(filtrado.saidas_por_categoria.length,0);
    assert.equal((await api('GET','resumo',null,{cookie:owner,params:{usuario_id:'1 OR 1=1'}})).status,400);
  });
  await t.test('Motorista: prazo de dois minutos e Receita limitada',async()=>{
    const cat=categories.find(c=>c.nome==='Alimentação').id;
    const e=ok(await api('POST','lancamentos',{categoria_id:cat,descricao:'Refeição',valor:'50',data:'2026-10-20'},{cookie:driver,registered:Date.now()-181000}));
    assert.equal(e.pode_alterar,false,JSON.stringify(e));assert.equal((await api('DELETE','lancamento',null,{cookie:driver,params:{id:e.id}})).status,403);
    ok(await api('GET','receita',null,{cookie:driver}));
    assert.equal((await api('GET','receita',null,{cookie:driver,params:{mes:'2020-01'}})).status,403);
    assert.equal((await api('GET','resumo',null,{cookie:driver})).status,403);
    assert.equal((await api('GET','pdf',null,{cookie:driver})).status,403);
    const report=await api('GET','pdf-panorama',null,{cookie:owner,params:{de:'2026-10',ate:'2026-10'}});assert.equal(report.status,200);assert.ok(report.data.byteLength>100);
  });
  await t.test('Migração do histórico: dados preservados e clientes sem duplicação por caixa',async()=>{
    const cat=categories.find(c=>c.tipo==='entrada').id;
    await pg.query("INSERT INTO recebiveis (cliente,categoria_id,valor_centavos,data,criado_em) VALUES ('Cliente histórico',$1,12300,'2026-09-01','2026-09-01 08:00:00')",[cat]);
    await pg.query("INSERT INTO notas_fiscais (usuario_id,cliente,data,arquivo,criado_em) VALUES ($1,'CLIENTE HISTÓRICO','2026-09-01','historico-teste.pdf','2026-09-01 08:00:00')",[uid]);
    const before=Number((await pg.query('SELECT COUNT(*) AS n FROM lancamentos')).rows[0].n);
    await pg.query('UPDATE esquema SET versao=3');
    const clients=ok(await api('GET','clientes',null,{cookie:owner}));
    assert.equal(clients.filter(c=>c.nome.toLowerCase()==='cliente histórico').length,1);
    assert.equal(Number((await pg.query('SELECT COUNT(*) AS n FROM lancamentos')).rows[0].n),before);
    assert.equal(Number((await pg.query('SELECT MAX(versao) AS v FROM esquema')).rows[0].v),6);
  });
  await t.test('ADM: invisível, restrito e capaz de redefinir senhas',async()=>{
    assert.equal((await api('POST','login',{usuario:'suporte.adm',senha:'errada-123'})).status,401);
    const adm=(await api('POST','login',{usuario:'suporte.adm',senha:'SuporteAdm!2026'})).cookie;assert.ok(adm);
    assert.equal(ok(await api('GET','eu',null,{cookie:adm})).papel,'sistema');
    const lista=ok(await api('GET','adm-usuarios',null,{cookie:adm}));assert.ok(lista.some(u=>u.usuario==='joao.teste'));assert.ok(!lista.some(u=>u.papel==='sistema'));
    const doDono=ok(await api('GET','usuarios',null,{cookie:owner}));assert.ok(!doDono.some(u=>u.usuario==='suporte.adm'));
    const admId=Number((await pg.query("SELECT id FROM usuarios WHERE usuario='suporte.adm'")).rows[0].id);
    assert.equal((await api('PUT','usuario',{nome:'x',papel:'motorista',ativo:true},{cookie:owner,params:{id:admId}})).status,404);
    assert.equal((await api('DELETE','usuario',null,{cookie:owner,params:{id:admId}})).status,404);
    assert.equal((await api('POST','usuarios',{nome:'Clone',usuario:'suporte.adm',senha:'12345678'},{cookie:owner})).status,400);
    for(const [m,r] of [['GET','lancamentos'],['GET','clientes'],['GET','usuarios'],['POST','trocar-senha']])assert.equal((await api(m,r,m==='GET'?null:{},{cookie:adm})).status,403,r);
    assert.equal((await api('GET','adm-usuarios',null,{cookie:owner})).status,404);
    assert.equal((await api('PUT','adm-usuario',{senha_nova:'1234'},{cookie:driver,params:{id:uid}})).status,404);
    ok(await api('PUT','adm-usuario',{senha_nova:'NovaSenha26'},{cookie:adm,params:{id:uid}}));
    assert.equal((await api('GET','eu',null,{cookie:driver})).status,401);
    const relogin=await api('POST','login',{usuario:'joao.teste',senha:'NovaSenha26'});ok(relogin);driver=relogin.cookie;
    const ownerId=Number((await pg.query("SELECT id FROM usuarios WHERE usuario='admin'")).rows[0].id);
    assert.equal((await api('PUT','adm-usuario',{ativo:false},{cookie:adm,params:{id:ownerId}})).status,400);
    assert.equal((await api('PUT','adm-usuario',{senha_nova:'x'},{cookie:adm,params:{id:admId}})).status,404);
  });
  await t.test('Pacote público sem PHP, SQLite, uploads ou segredos',async()=>{
    const promises=[],response=await worker.fetch(new Request('https://frota.test/'),env,{waitUntil(p){promises.push(p);}});const html=await response.text();assert.ok(html.includes('busca.js'));assert.ok(html.includes('viagens.js'));assert.ok(!html.includes('<?'));assert.ok(!html.includes('__FROTA_AMBIENTE__'));
    for(const name of ['/config.php','/src/banco.php','/dados/frota.sqlite','/uploads/teste.png'])assert.equal((await worker.fetch(new Request('https://frota.test'+name),env,{waitUntil(){}})).status,404);
    assert.equal((await worker.fetch(new Request('https://frota.test/manifest.php'),env,{waitUntil(){}})).status,200);
  });
  await pg.close();
});
