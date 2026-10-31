import {ctx,ErroDeUso,consulta,umaLinha} from './contexto.js';
import {exigeLogin} from './sessao.js';
import {agora,time,segundosDe} from './util.js';
export function idDoEnvio(){const r=ctx().req,id=r.headers.get('X-Fila-Id')||'';return r.method==='POST'&&/^[A-Za-z0-9-]{8,40}$/.test(id)?id:null;}
export async function reservaEnvio(id){
 const eu=await exigeLogin();
 const inserted=await consulta('INSERT INTO envios_fila (id,usuario_id,resposta,criado_em) VALUES (?,?,NULL,?) ON CONFLICT (id) DO NOTHING RETURNING id',[id,eu.id,agora()]);
 if(inserted.rows.length)return null;
 const row=await umaLinha('SELECT usuario_id,resposta,criado_em FROM envios_fila WHERE id=?',[id]);
 if(!row || Number(row.usuario_id)!==Number(eu.id))throw new ErroDeUso('Pedido inválido.',403);
 if(row.resposta!==null)return {resposta:JSON.parse(row.resposta)};
 if(time()-segundosDe(row.criado_em)>120){await consulta('UPDATE envios_fila SET criado_em=? WHERE id=?',[agora(),id]);return null;}
 throw new ErroDeUso('Este envio ainda está sendo gravado. Tente novamente.',409);
}
export async function guardaEnvio(id,value){await consulta('UPDATE envios_fila SET resposta=? WHERE id=?',[JSON.stringify(value),id]);}
export async function liberaEnvio(id){await consulta('DELETE FROM envios_fila WHERE id=? AND resposta IS NULL',[id]);}
