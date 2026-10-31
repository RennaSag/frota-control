import { ctx, ErroDeUso, consulta, umaLinha } from './contexto.js';
import { DIAS_LOGADO, agora, time, hex, aleatorio, segundosDe } from './util.js';

// Sessões na tabela "sessoes", no mesmo formato do PHP: quem já estava logado continua logado.
const COOKIE = 'frota';
const DURACAO = DIAS_LOGADO * 24 * 60 * 60;

function idDoCookie() {
  const cabecalho = ctx().req.headers.get('Cookie') || '';
  for (const parte of cabecalho.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome === COOKIE) {
      const valor = resto.join('=');
      return /^[A-Za-z0-9,-]{22,128}$/.test(valor) ? valor : null;
    }
  }
  return null;
}

function mandaCookie(id, segundos) {
  const c = ctx();
  const seguro = new URL(c.req.url).protocol === 'https:' ? '; Secure' : '';
  const validade = segundos > 0
    ? `; Max-Age=${segundos}; Expires=${new Date(Date.now() + segundos * 1000).toUTCString()}`
    : '; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  c.cookies.push(`${COOKIE}=${id}${validade}; Path=/; HttpOnly; SameSite=Lax${seguro}`);
}

// Os dados ficam serializados como no PHP ("usuario_id|i:5;entrou_em|i:1730000000;").
function lePhp(dados) {
  const m = /(?:^|;)usuario_id\|i:(\d+);/.exec(String(dados || ''));
  return m ? Number(m[1]) : null;
}

async function idDaSessao() {
  const c = ctx();
  if (c.sessao !== undefined) return c.sessao;
  c.sessao = null;
  const id = idDoCookie();
  if (!id) return null;
  const linha = await umaLinha('SELECT dados, expira FROM sessoes WHERE id = ? AND expira > ?', [id, time()]);
  if (!linha) return null;
  const usuarioId = lePhp(linha.dados);
  if (!usuarioId) return null;
  // Renova o prazo de 30 dias, no máximo uma vez por hora.
  if (Number(linha.expira) - time() < DURACAO - 3600) {
    await consulta('UPDATE sessoes SET expira = ? WHERE id = ?', [time() + DURACAO, id]);
    mandaCookie(id, DURACAO);
  }
  c.sessao = { id, usuarioId };
  return c.sessao;
}

export async function usuarioAtual() {
  const c = ctx();
  if (c.usuario !== undefined) return c.usuario;
  const sessao = await idDaSessao();
  if (!sessao) {
    c.usuario = null;
    return null;
  }
  const u = await umaLinha(
    `SELECT id, nome, usuario, papel, telefone, caminhao_padrao_id, valor_diaria_centavos
       FROM usuarios WHERE id = ? AND ativo = 1`,
    [sessao.usuarioId]
  );
  if (!u) {
    await encerraSessao();
    c.usuario = null;
    return null;
  }
  c.usuario = u;
  return u;
}

export async function exigeLogin() {
  const u = await usuarioAtual();
  if (!u) throw new ErroDeUso('Sua sessão expirou. Entre novamente.', 401);
  return u;
}

export async function exigeAdmin() {
  const u = await exigeLogin();
  if (u.papel !== 'admin') throw new ErroDeUso('Somente o proprietário pode fazer isso.', 403);
  return u;
}

export async function ehAdmin() {
  const u = await usuarioAtual();
  return u !== null && u.papel === 'admin';
}

export async function criaSessao(usuarioId) {
  const c = ctx();
  const antiga = idDoCookie();
  if (antiga) await consulta('DELETE FROM sessoes WHERE id = ?', [antiga]);
  const id = hex(aleatorio(24));
  const dados = `usuario_id|i:${usuarioId};entrou_em|i:${time()};`;
  await consulta('INSERT INTO sessoes (id, dados, expira) VALUES (?, ?, ?)', [id, dados, time() + DURACAO]);
  mandaCookie(id, DURACAO);
  c.sessao = { id, usuarioId };
  c.usuario = undefined;
  if (Math.random() < 0.02) {
    await consulta('DELETE FROM sessoes WHERE expira < ?', [time()]);
  }
}

export async function encerraSessao() {
  const c = ctx();
  const id = idDoCookie();
  if (id) await consulta('DELETE FROM sessoes WHERE id = ?', [id]);
  mandaCookie('', 0);
  c.sessao = null;
  c.usuario = null;
}

export function exigePedidoDoApp() {
  const req = ctx().req;
  if (['GET', 'HEAD'].includes(req.method)) return;
  if (req.headers.get('X-App-Frota') !== '1') {
    throw new ErroDeUso('Pedido inválido. Recarregue a página e tente de novo.', 400);
  }
}

export async function podeTentarLogin(chave) {
  const limite = 10;
  const minutos = 10;
  const linha = await umaLinha('SELECT n, desde FROM tentativas_login WHERE chave = ?', [chave]);
  if (!linha) {
    await consulta('INSERT INTO tentativas_login (chave, n, desde) VALUES (?, 1, ?)', [chave, agora()]);
    return true;
  }
  if (time() - segundosDe(linha.desde) > minutos * 60) {
    await consulta('UPDATE tentativas_login SET n = 1, desde = ? WHERE chave = ?', [agora(), chave]);
    return true;
  }
  await consulta('UPDATE tentativas_login SET n = n + 1 WHERE chave = ?', [chave]);
  return Number(linha.n) + 1 <= limite;
}

export async function limpaTentativas(chave) {
  await consulta('DELETE FROM tentativas_login WHERE chave = ?', [chave]);
  await consulta('DELETE FROM tentativas_login WHERE desde < ?', [agora(Date.now() - 86400000)]);
}
