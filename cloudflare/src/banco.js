import bcrypt from 'bcryptjs';
import esquema from './esquema.json' with {type:'json'};
import {conf,agora,ADMIN_NOME,ADMIN_USUARIO} from './util.js';
// Bancos já conferidos nesta instância do Worker: evita 2 consultas extras em todo pedido.
const estruturaPronta=new Set();
export async function criaEstrutura(db,chave=''){
  if(chave && estruturaPronta.has(chave))return;
  await criaEstruturaAgora(db);
  if(chave)estruturaPronta.add(chave);
}
async function criaEstruturaAgora(db){
  let version=0;
  const exists=(await db.query("SELECT to_regclass('public.esquema') AS tabela")).rows[0]?.tabela;
  if(exists)version=Number((await db.query('SELECT MAX(versao) AS versao FROM esquema')).rows[0]?.versao||0);
  if(version>=5)return;
  await db.query('SELECT pg_advisory_lock(619704201)');
  try{
    await db.query('BEGIN');
    for(const sql of esquema.tabelas)await db.query(sql);
    version=Number((await db.query('SELECT MAX(versao) AS versao FROM esquema')).rows[0]?.versao||0);
    if(version>=5){await db.query('COMMIT');return;}
    for(const [table,column,definition] of esquema.colunas)await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    for(const sql of esquema.indices)await db.query(sql.replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS '));
    const cats=[['Abastecimento','saida','fuel',1,0,10],['Salário do motorista','saida','salario',0,0,20],['Diárias de motorista','saida','salario',0,0,25],['Manutenção','saida','wrench',0,0,30],['Pneus','saida','tire',0,0,40],['Pedágio','saida','road',0,0,50],['Seguro','saida','shield',0,0,60],['IPVA e licenciamento','saida','doc',0,0,70],['Peças e acessórios','saida','parts',0,0,80],['Alimentação','saida','food',0,0,90],['Hospedagem','saida','bed',0,0,100],['Lavagem','saida','wash',0,0,110],['Multas','saida','alert',0,0,120],['Outro gasto','saida','tag',0,1,999],['Frete de grãos','entrada','graos',0,0,10],['Frete de calcário','entrada','calcario',0,0,20],['Outro frete','entrada','truck',0,1,30],['Outra entrada','entrada','plus',0,1,999]];
    if(!Number((await db.query('SELECT COUNT(*) AS n FROM categorias')).rows[0].n))for(const c of cats)await db.query('INSERT INTO categorias (nome,tipo,icone,pede_litros,pede_descricao,ordem,ativo) VALUES ($1,$2,$3,$4,$5,$6,1)',c);
    await db.query("INSERT INTO categorias (nome,tipo,icone,pede_litros,pede_descricao,ordem,ativo,oculta_motorista) VALUES ('Diárias de motorista','saida','salario',0,0,25,1,1) ON CONFLICT (nome,tipo) DO NOTHING");
    if(!Number((await db.query('SELECT COUNT(*) AS n FROM categorias WHERE oculta_motorista=1')).rows[0].n))await db.query("UPDATE categorias SET oculta_motorista=1 WHERE nome IN ('Diárias de motorista','Salário do motorista')");
    if(!Number((await db.query("SELECT COUNT(*) AS n FROM usuarios WHERE papel='admin'")).rows[0].n)){
      const password=conf('ADMIN_SENHA','');if(password.length<8)throw new Error('Configure FROTA_ADMIN_SENHA para inicializar o proprietário.');
      await db.query("INSERT INTO usuarios (nome,usuario,senha_hash,papel,ativo,criado_em) VALUES ($1,$2,$3,'admin',1,$4)",[ADMIN_NOME,ADMIN_USUARIO,await hashSenha(password),agora()]);
    }
    if(version<4){
      await db.query("INSERT INTO clientes (nome,ativo,criado_em) SELECT DISTINCT ON (LOWER(TRIM(cliente))) TRIM(cliente),1,$1::timestamp FROM (SELECT cliente FROM recebiveis UNION SELECT cliente FROM notas_fiscais) nomes WHERE cliente IS NOT NULL AND TRIM(cliente) NOT IN ('','Cliente não informado') AND NOT EXISTS (SELECT 1 FROM clientes c WHERE LOWER(c.nome)=LOWER(TRIM(nomes.cliente))) ORDER BY LOWER(TRIM(cliente)),TRIM(cliente) ON CONFLICT (nome) DO NOTHING",[agora()]);
      await db.query("UPDATE viagens v SET cliente_id=(SELECT MIN(c.id) FROM clientes c WHERE LOWER(c.nome)=LOWER(TRIM(h.cliente))) FROM (SELECT viagem_id,MIN(cliente) AS cliente FROM (SELECT viagem_id,cliente FROM recebiveis UNION SELECT viagem_id,cliente FROM notas_fiscais) nomes WHERE viagem_id IS NOT NULL AND cliente IS NOT NULL GROUP BY viagem_id HAVING COUNT(DISTINCT LOWER(cliente))=1) h WHERE h.viagem_id=v.id AND v.cliente_id IS NULL");
    }
    await db.query('DELETE FROM esquema');await db.query('INSERT INTO esquema (versao) VALUES (5)');await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.query('SELECT pg_advisory_unlock(619704201)');}
}
export const hashSenha=(senha)=>bcrypt.hash(senha,10);
export function confereSenha(senha,hash){const h=String(hash||'');return /^\$2[aby]\$/.test(h)?bcrypt.compare(senha,h.replace(/^\$2y\$/,'$2b$')):Promise.resolve(false);}
