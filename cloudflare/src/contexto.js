import { AsyncLocalStorage } from 'node:async_hooks';
import { Client } from '@neondatabase/serverless';
import pg from 'pg';

// Cada pedido roda dentro do seu próprio contexto (conexão com o banco, sessão, parâmetros),
// assim as funções das rotas ficam como no PHP, sem precisar passar tudo de mão em mão.
const armazem = new AsyncLocalStorage();

export function rodaNoContexto(contexto, funcao) {
  return armazem.run(contexto, funcao);
}

export function ctx() {
  const c = armazem.getStore();
  if (!c) throw new Error('Fora de um pedido.');
  return c;
}

export class ErroDeUso extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// Os tipos voltam como no PDO do PHP: inteiros viram número; NUMERIC, datas e horários
// continuam texto ("2026-10-29", "2026-10-29 14:05:00"), sem conversão de fuso.
const comoTexto = (v) => v;
const comoInteiro = (v) => parseInt(v, 10);
const PARSERS = {
  20: comoInteiro, 21: comoInteiro, 23: comoInteiro,
  1700: comoTexto, 1082: comoTexto, 1114: comoTexto, 1184: comoTexto, 1083: comoTexto,
  17: comoTexto,
};
const TIPOS = {
  getTypeParser(id, formato) {
    if (PARSERS[id]) return PARSERS[id];
    if (id === 16) return (v) => v === 't';
    if (id === 700 || id === 701) return (v) => parseFloat(v);
    return comoTexto;
  },
};

export async function abreBanco(env) {
  if(env.FROTA_AMBIENTE==='teste' && env.__TEST_DB)return env.__TEST_DB;
  // Com o Hyperdrive ligado (binding HYPERDRIVE no wrangler.toml), a conexão sai de um pool já
  // aberto perto do banco: o pedido não paga mais TLS + autenticação do zero a cada vez.
  if (env.HYPERDRIVE?.connectionString) {
    const cliente = new pg.Client({ connectionString: env.HYPERDRIVE.connectionString, types: TIPOS });
    try {
      await cliente.connect();
    } catch (e) {
      throw new ErroDeUso('Não foi possível conectar ao banco. Confira a configuração do servidor.',500);
    }
    return cliente;
  }
  const url = env.DATABASE_URL || '';
  if (!url) {
    throw new ErroDeUso('Não foi possível conectar no PostgreSQL. Confira a variável DATABASE_URL.', 500);
  }
  const cliente = new Client({ connectionString: url, types: TIPOS });
  try {
    await cliente.connect();
  } catch (e) {
    throw new ErroDeUso('Não foi possível conectar ao banco. Confira a configuração do servidor.',500);
  }
  return cliente;
}

// O código das rotas usa "?" como no PDO; o PostgreSQL quer $1, $2...
function marcadores(sql) {
  let n = 0;
  let saida = '';
  let aspas = false;
  for (const ch of sql) {
    if (ch === "'") aspas = !aspas;
    saida += !aspas && ch === '?' ? `$${++n}` : ch;
  }
  return saida;
}

export async function consulta(sql, args = []) {
  const r = await ctx().db.query(marcadores(sql), args.map((v) => (v === undefined ? null : v)));
  return { rows: r.rows, rowCount: r.rowCount ?? 0 };
}

export async function todas(sql, args = []) {
  return (await consulta(sql, args)).rows;
}

export async function umaLinha(sql, args = []) {
  return (await consulta(sql, args)).rows[0] ?? null;
}

export async function umValor(sql, args = []) {
  const linha = (await consulta(sql, args)).rows[0];
  if (!linha) return null;
  const valor = Object.values(linha)[0];
  return valor === undefined ? null : valor;
}

export async function insere(tabela, dados) {
  const colunas = Object.keys(dados);
  const sql = `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')}) RETURNING id`;
  return Number(await umValor(sql, Object.values(dados)));
}

export async function atualiza(tabela, id, dados) {
  const partes = Object.keys(dados).map((coluna) => `${coluna} = ?`);
  const sql = `UPDATE ${tabela} SET ${partes.join(', ')} WHERE id = ?`;
  return (await consulta(sql, [...Object.values(dados), id])).rowCount;
}

export function sqlMes(coluna) {
  return `to_char(${coluna}, 'YYYY-MM')`;
}

// Tarefas que rodam depois que a resposta já saiu (notificações push).
export function depois(tarefa) {
  ctx().depois.push(tarefa);
}
