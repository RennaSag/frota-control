import { consulta, todas, umValor, insere } from './contexto.js';
import { exigeLogin } from './sessao.js';
import { agora, time, segundosDe } from './util.js';
import { agendaPush } from './push.js';

// Avisos: o que os motoristas fazem fica registrado para o proprietário acompanhar.
// Com "para", o aviso vai só para aquele motorista (ex.: viagem aberta para ele, diárias pagas).
export async function registraAviso(eu, acao, tipo, lancamentoId, resumo, para = null) {
  if (para === null ? eu.papel === 'admin' : para === eu.id) return;
  await insere('avisos', {
    usuario_id: eu.id,
    acao,
    tipo,
    lancamento_id: lancamentoId,
    resumo: [...resumo].slice(0, 200).join(''),
    para_usuario_id: para,
    criado_em: agora(),
  });
  const destinos = para !== null ? [para] : (await todas(
    "SELECT id FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?",
    [eu.id]
  )).map((u) => u.id);
  agendaPush(destinos, `${eu.nome} ${ACOES_AVISO[acao]?.[tipo] ?? acao}: ${resumo}`);
}

// Mesmo texto da tela (ACOES_AVISO em assets/app.js), usado nas notificações push.
const ACOES_AVISO = {
  criou: { saida: 'registrou um gasto', entrada: 'registrou uma entrada' },
  editou: { saida: 'editou um gasto', entrada: 'editou uma entrada', nota: 'editou uma nota fiscal' },
  excluiu: {
    saida: 'excluiu um gasto', entrada: 'excluiu uma entrada',
    nota: 'excluiu uma nota fiscal', diaria: 'excluiu uma diária',
  },
  abriu: { viagem: 'abriu uma viagem' },
  enviou: { nota: 'enviou uma nota fiscal' },
  registrou: { diaria: 'registrou dias trabalhados' },
  pagou: { diaria: 'pagou suas diárias' },
};

function filtroAvisos(eu) {
  return eu.papel === 'admin'
    ? ['a.para_usuario_id IS NULL', []]
    : ['a.para_usuario_id = ?', [eu.id]];
}

async function ultimoAvisoVisto(usuarioId) {
  let visto = await umValor('SELECT ultimo_id FROM avisos_vistos WHERE usuario_id = ?', [usuarioId]);
  if (visto === null) {
    // Primeiro acesso: começa do zero, sem acusar o histórico antigo como novidade.
    visto = Number(await umValor('SELECT COALESCE(MAX(id), 0) FROM avisos'));
    await consulta('INSERT INTO avisos_vistos (usuario_id, ultimo_id) VALUES (?, ?)', [usuarioId, visto]);
  }
  return Number(visto);
}

export async function rotaAvisos() {
  const eu = await exigeLogin();
  const visto = await ultimoAvisoVisto(eu.id);
  const [cond, args] = filtroAvisos(eu);
  const itens = await todas(
    `SELECT a.id, a.acao, a.tipo, a.lancamento_id, a.resumo, a.criado_em, u.nome AS motorista
       FROM avisos a JOIN usuarios u ON u.id = a.usuario_id
      WHERE ${cond}
      ORDER BY a.id DESC LIMIT 40`,
    args
  );
  for (const a of itens) {
    a.novo = Number(a.id) > visto;
    a.segundos = Math.max(0, time() - segundosDe(a.criado_em));
    // Motorista não abre lançamentos de outras pessoas a partir do aviso.
    if (eu.papel !== 'admin') a.lancamento_id = null;
  }
  return {
    nao_lidos: await avisosNaoLidos(eu),
    ultimo_id: Number(await umValor(`SELECT COALESCE(MAX(a.id), 0) FROM avisos a WHERE ${cond}`, args)),
    itens,
  };
}

export async function avisosNaoLidos(eu) {
  const visto = await ultimoAvisoVisto(eu.id);
  const [cond, args] = filtroAvisos(eu);
  return Number(await umValor(`SELECT COUNT(*) FROM avisos a WHERE ${cond} AND a.id > ?`, [...args, visto]));
}

export async function rotaAvisosLidos() {
  const eu = await exigeLogin();
  await ultimoAvisoVisto(eu.id);
  const ultimo = Number(await umValor('SELECT COALESCE(MAX(id), 0) FROM avisos'));
  await consulta('UPDATE avisos_vistos SET ultimo_id = ? WHERE usuario_id = ?', [ultimo, eu.id]);
  return { ok: true };
}
