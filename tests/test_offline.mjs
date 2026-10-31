// Exercita a fila real com IndexedDB em memória e uma API que perde uma resposta.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const stores=new Map();
const db={
  createObjectStore(name) {stores.set(name,new Map());},
  transaction(name) {
    const tx={objectStore() {
      const s=stores.get(name);
      return {
        get(k) {return {result:structuredClone(s.get(k))};},
        getAll() {return {result:structuredClone([...s.values()])};},
        put(v) {s.set(v.id ?? v.chave,structuredClone(v));return {result:v.id ?? v.chave};},
        delete(k) {s.delete(k);return {};}
      };
    }};
    queueMicrotask(()=>tx.oncomplete?.());
    return tx;
  }
};
const indexedDB={open() {
  const request={result:db};
  queueMicrotask(()=>{if(!stores.size) request.onupgradeneeded?.();request.onsuccess?.();});
  return request;
}};
const receipts=new Map(), written=new Map();
let loseTripResponse=true, uploads=0;
const fetch=async (url,options) => {
  const route=new URL(url).searchParams.get('r');
  const key=options.headers['X-Fila-Id'];
  if(receipts.has(key)) return Response.json(receipts.get(key));
  let response;
  if(route==='comprovante') {assert.ok(options.body.get('foto'));uploads++;response={comprovante:'nota-teste.pdf'};}
  else {
    assert.ok(Number(options.headers['X-Registrado-Em'])>0);
    const body=JSON.parse(options.body);
    if(route==='clientes') response={id:11};
    if(route==='viagens') {assert.equal(body.cliente_id,11);assert.equal(body.nota_arquivo,'nota-teste.pdf');response={id:22};}
    if(route==='notas') {assert.equal(body.viagem_id,22);assert.equal(body.arquivo,'nota-teste.pdf');response={id:33};}
    if(route==='diarias') {assert.equal(body.viagem_id,22);response={criadas:1,ids_por_data:{'2026-10-29':44}};}
    if(route==='diarias-pagar') {assert.deepEqual(body.ids,[44]);response={lancamento_id:55,total_centavos:15000,dias:1};}
    assert.ok(response,route);
  }
  receipts.set(key,response);written.set(route,(written.get(route)||0)+1);
  if(route==='viagens' && loseTripResponse) {loseTripResponse=false;throw new Error('Resposta perdida depois de gravar');}
  return Response.json(response);
};
const context=vm.createContext({indexedDB,fetch,Response,FormData,Blob,URL,URLSearchParams,AbortController,crypto:webcrypto,setTimeout,clearTimeout,queueMicrotask,structuredClone,
  navigator:{},location:{href:'http://localhost/frota/'},
  estado:{usuario:{id:1,nome:'Proprietário'},clientes:[],usuarios:[{id:3,nome:'Motorista',valor_diaria_centavos:15000}],categorias:[]}
});
context.self=context;
await vm.runInContext(await fs.readFile(new URL('../frota/assets/busca.js',import.meta.url),'utf8'),context);
await vm.runInContext(await fs.readFile(new URL('../frota/assets/fila.js',import.meta.url),'utf8'),context);
await vm.runInContext(await fs.readFile(new URL('../frota/assets/offline.js',import.meta.url),'utf8'),context);
const {Fila}=context;
const customer=await Fila.adiciona({usuarioId:1,rota:'clientes',corpo:{nome:'Cliente offline'}});
const file=await Fila.guardaArquivo(new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'}),'nota.pdf');
const trip=await Fila.adiciona({usuarioId:1,rota:'viagens',corpo:{cliente_id:customer.ref,nota_arquivo:file,origem:'Fazenda A',destino:'Armazém 3',inicio:'2026-10-29',valor_viagem:'1.000,00',valor_entrada:'200'}});
await Fila.adiciona({usuarioId:1,rota:'notas',corpo:{viagem_id:trip.ref,arquivo:file,data:'2026-10-29'}});
const daily=await Fila.adiciona({usuarioId:1,rota:'diarias',corpo:{usuario_id:3,de:'2026-10-29',viagem_id:trip.ref}});
await Fila.adiciona({usuarioId:1,rota:'diarias-pagar',corpo:{usuario_id:3,data:'2026-10-29',ids:[daily.ref+'@2026-10-29']}});
const localCustomers=await context.incorporaCadastros('clientes',[],{});
assert.equal(localCustomers[0].nome,'Cliente offline');
context.estado.clientes=localCustomers;
const localTrips=await context.incorporaCadastros('viagens',[],{});
assert.equal(localTrips[0].cliente,'Cliente offline');
assert.equal(localTrips[0].valor_frete_centavos,100000);
assert.equal(localTrips[0].recebido_centavos,20000);
const localDaily=await context.incorporaCadastros('diarias',{itens:[],motoristas:[]},{mes:'2026-10',escopo:'pendentes'});
assert.equal(localDaily.itens.length,0,'Pagamento offline sai da lista de pendentes');
assert.equal(localDaily.motoristas[0].pendente_geral_centavos,0);
const paidDaily=await context.incorporaCadastros('diarias',{itens:[],motoristas:[],mes:'2026-10'},{mes:'2026-10',escopo:''});
assert.equal(paidDaily.itens[0].id,daily.ref+'@2026-10-29');
assert.equal(paidDaily.itens[0].valor_centavos,15000);
assert.equal(paidDaily.itens[0].pago,true);
assert.equal(paidDaily.pagamentos[0].offline,true);
const first=await Fila.processa(1);
assert.equal(first.semRede,true);
assert.equal((await Fila.lista(1)).length,4);
const second=await Fila.processa(1);
assert.equal(second.enviados,4);
assert.equal((await Fila.lista(1)).length,0);
assert.equal(written.get('viagens'),1);
assert.equal(written.get('diarias-pagar'),1);
assert.equal(uploads,1);
assert.equal((await Fila.meta('mapa'))[daily.ref+'@2026-10-29'],44);
// Rascunhos de outra conta nunca entram na fila deste usuário.
await Fila.adiciona({usuarioId:2,rota:'clientes',corpo:{nome:'Outra conta'}});
assert.equal((await Fila.lista(1)).length,0);
assert.equal((await Fila.processa(1)).enviados,0);
// Dependência inválida permanece visível para revisão, sem perder o registro.
await Fila.adiciona({usuarioId:1,rota:'notas',corpo:{viagem_id:'local:inexistente',arquivo:'teste.pdf'}});
assert.equal((await Fila.processa(1)).erros,1);
assert.match((await Fila.lista(1))[0].erro,/Depende/);
await vm.runInContext(await fs.readFile(new URL('../frota/assets/viagens.js',import.meta.url),'utf8'),context);
context.estado.clientes=Array.from({length:12},(_,i)=>({id:i+1,nome:`Cliente ${i+1}`,ativo:1,criado_em:`2026-10-${String(i+1).padStart(2,'0')} 09:00:00`}));
context.estado.clientes.push({id:13,nome:'Arquivado',ativo:0,criado_em:'2026-10-29 09:00:00'});
const recent=context.clientesRecentes();
assert.equal(recent.length,10);
assert.equal(recent[0].id,12);
assert.equal(recent[9].id,3);
await Fila.defineMeta('sessao-offline',{usuario:{id:1}});
const other=vm.createContext({indexedDB,fetch,Response,FormData,Blob,URL,URLSearchParams,AbortController,crypto:webcrypto,setTimeout,clearTimeout,queueMicrotask,structuredClone,navigator:{},location:{href:'http://localhost/frota/'},FROTA_AMBIENTE:'outro-banco'});
other.self=other;
await vm.runInContext(await fs.readFile(new URL('../frota/assets/fila.js',import.meta.url),'utf8'),other);
assert.equal((await other.Fila.lista(1)).length,0);
assert.equal(await other.Fila.meta('sessao-offline'),null);
assert.equal(await other.Fila.meta('mapa'),null);
await other.Fila.adiciona({usuarioId:1,rota:'clientes',corpo:{nome:'Somente outro ambiente'}});
assert.equal((await other.Fila.lista(1)).length,1);
assert.equal((await Fila.lista(1)).length,1);
// Consultar um motorista offline usa a lista completa já guardada; quitar remove
// só os dias selecionados e não diminui o saldo outra vez ao abrir a tela de novo.
const pendingModel={mes:'2026-10',pagamentos:[],itens:[
  {id:501,usuario_id:3,motorista:'João da Silva',data:'2026-09-25',valor_centavos:15000,pago:false,lancamento_id:null},
  {id:502,usuario_id:3,motorista:'João da Silva',data:'2026-10-25',valor_centavos:15000,pago:false,lancamento_id:null},
  {id:503,usuario_id:4,motorista:'Pedro Lima',data:'2026-10-26',valor_centavos:20000,pago:false,lancamento_id:null}],
 motoristas:[{usuario_id:3,nome:'João da Silva',dias:2,total_centavos:30000,pago_centavos:0,pendente_centavos:30000,pendente_geral_centavos:30000,dias_pendentes_geral:2},{usuario_id:4,nome:'Pedro Lima',dias:1,total_centavos:20000,pago_centavos:0,pendente_centavos:20000,pendente_geral_centavos:20000,dias_pendentes_geral:1}]};
await context.memorizaDados('diarias',{mes:'2026-10',escopo:'pendentes'},pendingModel);
assert.equal((await context.dadosOffline('diarias',{mes:'2026-10',escopo:'pendentes',usuario_id:'3'})).itens.length,2);
await Fila.adiciona({usuarioId:1,rota:'diarias-pagar',corpo:{usuario_id:3,data:'2026-10-29',ids:[501],pagamento:'Pix'}});
for(let i=0;i<2;i++){
 const result=await context.dadosOffline('diarias',{mes:'2026-10',escopo:'pendentes',usuario_id:'3'});
 assert.equal(result.itens.length,1);assert.equal(result.itens[0].id,502);
 assert.equal(result.motoristas[0].pendente_geral_centavos,15000);
 assert.equal(result.pagamentos[0].valor_centavos,15000);
}
assert.equal((await context.dadosOffline('diarias',{mes:'2026-10',escopo:'pendentes',usuario_id:'4'})).motoristas[0].pendente_geral_centavos,20000);
assert.equal(pendingModel.motoristas[0].pendente_geral_centavos,30000);
assert.equal(context.combinaBusca('verde mariana',['Cerealista Vale Dourado','Rio Verde','Contato Mariana Costa']),true);
assert.equal(context.combinaBusca('sao joao',['São João']),true);
assert.equal(context.combinaBusca('11900001101',['(11) 90000-1101']),true);
assert.equal(context.filtraOffline('lancamentos',[{id:1,tipo:'saida',categoria_id:2,caminhao_id:3,data:'2026-10-29',descricao:'Diesel S10',motorista:'João Silva',placa:'TST1A01'}],{tipo:'entrada'}).length,0);
assert.equal(context.filtraOffline('lancamentos',[{id:1,tipo:'saida',categoria_id:2,caminhao_id:3,data:'2026-10-29',descricao:'Diesel S10',motorista:'João Silva',placa:'TST1A01'}],{tipo:'saida',categoria_id:2,caminhao_id:3,busca:'tst1 joao diesel'}).length,1);
console.log('OK: fila, pagamentos offline por seleção, filtros, palavras-chave, isolamento e reenvio sem duplicação.');
