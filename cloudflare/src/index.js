import {rodaNoContexto,abreBanco,ErroDeUso} from './contexto.js';
import {criaEstrutura} from './banco.js';
import {exigePedidoDoApp} from './sessao.js';
import {idDoEnvio,reservaEnvio,guardaEnvio} from './fila.js';
import {despacha} from './rotas.js';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export default {async fetch(request,env,execution){
  const url=new URL(request.url);
  if(url.pathname==='/api.php')return api(request,env,execution);
  if(url.pathname==='/manifest.php')return manifest();
  if(['/','/index.html','/index.php'].includes(url.pathname)){
    const response=await env.ASSETS.fetch(new Request(new URL('/index.html',url)));
    if(!response.ok)return response;
    const destination=env.DATABASE_URL?new URL(env.DATABASE_URL):null;
    const key=destination?`pgsql:${destination.hostname}:${destination.pathname}`:'cloudflare-local';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
    const environment=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('').slice(0,16);
    return new Response((await response.text()).replaceAll('__FROTA_AMBIENTE__',environment),{headers:{...security,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
  }
  if(request.method!=='GET' && request.method!=='HEAD')return json({erro:'Método não permitido.'},405);
  return env.ASSETS.fetch(request);
}};
async function api(req,env,execution){
  const context={req,env,q:Object.fromEntries(new URL(req.url).searchParams),db:null,cookies:[],depois:[]};
  return rodaNoContexto(context,async()=>{
    let response,transaction=false;
    try{
      exigePedidoDoApp();context.db=await abreBanco(env);await criaEstrutura(context.db,env.FROTA_AMBIENTE==='teste'?'':env.DATABASE_URL);
      if(!['GET','HEAD'].includes(req.method)){await context.db.query('BEGIN');transaction=true;}
      const id=idDoEnvio(), repeated=id?await reservaEnvio(id):null;
      if(repeated)response=json(repeated.resposta);
      else{const data=await despacha(String(context.q.r||''),req.method);if(id && !(data instanceof Response))await guardaEnvio(id,data);response=data instanceof Response?data:json(data);}
      if(transaction){await context.db.query('COMMIT');transaction=false;}
    }catch(error){
      if(transaction)await context.db.query('ROLLBACK').catch(()=>{});context.depois=[];
      if(error instanceof ErroDeUso)response=json({erro:error.message},error.status>=400&&error.status<600?error.status:400);
      else{console.error('[frota]',env.FROTA_AMBIENTE==='teste'?error:error.code||error.name);response=json({erro:'Não foi possível concluir. Tente novamente.'},500);}
    }
    const headers=new Headers(response.headers);Object.entries(security).forEach(([k,v])=>headers.set(k,v));context.cookies.forEach(c=>headers.append('Set-Cookie',c));
    execution.waitUntil((async()=>{try{for(const task of context.depois)await task().catch(()=>{});}finally{await context.db?.end().catch(()=>{});}})());
    return new Response(response.body,{status:response.status,headers});
  });
}
function manifest(){return new Response(JSON.stringify({
  id:'./',name:'Controle da Frota',short_name:'Controle da Frota',lang:'pt-BR',start_url:'./',scope:'./',display:'standalone',orientation:'any',background_color:'#f4f6fb',theme_color:'#4338ca',
  icons:[['logo.png','192x192','any'],['logo-512.png','512x512','any'],['icone-maskable-192.png','192x192','maskable'],['icone-maskable-512.png','512x512','maskable']].map(([src,sizes,purpose])=>({src:'assets/'+src,sizes,purpose,type:'image/png'})),
  shortcuts:[['Registrar gasto','gasto'],['Nova viagem','viagem'],['Enviar nota fiscal','nota'],['Registrar diária','diaria']].map(([name,acao])=>({name,url:`./?acao=${acao}`})),
  share_target:{action:'./?compartilhar=1',method:'POST',enctype:'multipart/form-data',params:{title:'titulo',text:'texto',files:[{name:'arquivo',accept:['image/*','application/pdf']}]}}
}),{headers:{'Content-Type':'application/manifest+json; charset=utf-8'}});}
