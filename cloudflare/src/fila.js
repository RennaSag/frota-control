import { ctx, ErroDeUso, consulta, umaLinha } from './contexto.js';
import { exigeLogin } from './sessao.js';
import { agora, time, segundosDe } from './util.js';

// Envios que vêm da fila do aparelho (feitos sem internet) trazem o cabeçalho X-Fila-Id.
// Se o sinal cair depois de gravar e antes da resposta chegar, o aparelho manda de novo:
// aqui o repetido devolve a mesma resposta da primeira vez, sem gravar duas vezes.

export function idDoEnvio() {
  const req = ctx().req;
  if (req.method !== 'POST') return null;
  const id = req.headers.get('X-Fila-Id') || '';
  return /^[A-Za-z0-9-]{8,40}$/.test(id) ? id : null;
}

// Devolve a resposta guardada se o envio já foi feito; senão reserva o id e devolve null.
export async function reservaEnvio(id) {
  const eu = await exigeLogin();
  let linha = await umaLinha('SELECT usuario_id, resposta, criado_em FROM envios_fila WHERE id = ?', [id]);
  if (linha && linha.resposta === null && time() - segundosDe(linha.criado_em) > 120) {
    // Reserva abandonada (o pedido anterior morreu no meio): libera para gravar de novo.
    await consulta('DELETE FROM envios_fila WHERE id = ? AND resposta IS NULL', [id]);
    linha = null;
  }
  if (linha) {
    if (Number(linha.usuario_id) !== eu.id) {
      throw new ErroDeUso('Pedido inválido. Recarregue a página e tente de novo.');
    }
    if (linha.resposta === null) {
      throw new ErroDeUso('Este envio ainda está sendo gravado. Tente de novo em instantes.', 409);
    }
    return { resposta: JSON.parse(linha.resposta) };
  }
  try {
    await consulta('INSERT INTO envios_fila (id, usuario_id, resposta, criado_em) VALUES (?, ?, NULL, ?)',
      [id, eu.id, agora()]);
  } catch {
    throw new ErroDeUso('Este envio ainda está sendo gravado. Tente de novo em instantes.', 409);
  }
  if (Math.random() < 0.02) {
    await consulta('DELETE FROM envios_fila WHERE criado_em < ?', [agora(Date.now() - 30 * 86400000)]);
  }
  return null;
}

export async function guardaEnvio(id, resposta) {
  await consulta('UPDATE envios_fila SET resposta = ? WHERE id = ?', [JSON.stringify(resposta), id]);
}

export async function liberaEnvio(id) {
  try {
    await consulta('DELETE FROM envios_fila WHERE id = ? AND resposta IS NULL', [id]);
  } catch {
    // Sem banco: a reserva expira sozinha em 2 minutos.
  }
}
