import { ctx, ErroDeUso, consulta, todas, umaLinha, umValor, insere, atualiza, sqlMes } from './contexto.js';
import {
  NOME_SISTEMA, agora, hoje, time, segundosDe, somaDias, diasEntre, somaMeses, inteiro, vazio, tamanho,
  corpoJson, campoTexto, campoCentavos, campoCentavosOpcional, campoNumero, campoId, campoData, campoSimNao,
  mesValido, limitesDoMes, mesAnterior, paginacao, hex, aleatorio, deHex, instanteCadastro, normalizaBusca,
} from './util.js';
import {
  exigeLogin, exigeAdmin, ehAdmin, usuarioAtual, criaSessao, encerraSessao, podeTentarLogin, limpaTentativas,
} from './sessao.js';
import { hashSenha, confereSenha } from './banco.js';
import { PAPEL_ADM, ROTAS_ADM, loginDoAdm, entraComoAdm, rotaAdmUsuarios, rotaAdmEditaUsuario } from './adm.js';
import { registraAviso, rotaAvisos, rotaAvisosLidos } from './avisos.js';
import { rotaPushChave, rotaPushInscrever, rotaPushCancelar, rotaPushTeste } from './push.js';
import {
  Pdf, PDF_ALTURA, PDF_LARGURA, PDF_MARGEM, PDF_VERDE, PDF_VERMELHO, PDF_CINZA, PDF_TINTA,
  pdfReais, pdfNumero, pdfData, pdfCorSaldo,
} from './pdf.js';

const SQL_LANCAMENTO = `
    SELECT l.*, c.nome AS categoria, c.icone, c.tipo AS categoria_tipo,
           c.pede_litros, c.pede_descricao,
           u.nome AS motorista, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino,
           rb.cliente AS recebivel_cliente, rb.descricao AS recebivel_descricao
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      JOIN usuarios u ON u.id = l.usuario_id
      LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
      LEFT JOIN viagens v ON v.id = l.viagem_id
      LEFT JOIN recebiveis rb ON rb.id = l.recebivel_id`;

const SQL_VIAGEM = "\r\n    SELECT v.*, cl.nome AS cliente, u.nome AS motorista, cm.placa, cm.apelido AS caminhao_apelido,\r\n           (SELECT COALESCE(SUM(rb.valor_centavos), 0) FROM recebiveis rb WHERE rb.viagem_id = v.id) AS valor_frete_centavos,\r\n           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l WHERE l.tipo = 'entrada'\r\n             AND (l.viagem_id = v.id OR l.recebivel_id IN (SELECT rb.id FROM recebiveis rb WHERE rb.viagem_id = v.id))) AS recebido_centavos,\r\n           (SELECT COUNT(*) FROM notas_fiscais n WHERE n.viagem_id = v.id) AS qtd_notas,\r\n           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l\r\n             WHERE l.viagem_id = v.id AND l.tipo = 'saida') AS saidas_centavos,\r\n           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l\r\n             WHERE l.viagem_id = v.id AND l.tipo = 'entrada') AS entradas_centavos,\r\n           (SELECT COUNT(*) FROM lancamentos l WHERE l.viagem_id = v.id) AS qtd_lancamentos\r\n      FROM viagens v\r\n      JOIN usuarios u ON u.id = v.usuario_id\r\n      LEFT JOIN caminhoes cm ON cm.id = v.caminhao_id\r\n      LEFT JOIN clientes cl ON cl.id = v.cliente_id";

const ARQUIVO_VALIDO = /^[A-Za-z0-9._-]+$/;

export async function despacha(r, metodo) {
  const q = ctx().q;
  if(metodo==='GET' && ['resumo','pdf','pdf-panorama'].includes(r))await exigeAdmin();
  // O ADM só cuida de senhas e acessos; o resto do sistema fica fechado para ele.
  if (!ROTAS_ADM.has(`${metodo} ${r}`) && (await usuarioAtual())?.papel === PAPEL_ADM) {
    throw new ErroDeUso('O acesso ADM só gerencia senhas e acessos.', 403);
  }

  switch (`${metodo} ${r}`) {
case 'GET adm-usuarios':return rotaAdmUsuarios();
case 'PUT adm-usuario':return rotaAdmEditaUsuario(campoId(q.id??null,'Usuário',true));
case 'GET clientes':return rotaClientes();
case 'POST clientes':return salvaCliente();
case 'PUT cliente':return salvaCliente(campoId(q.id??null,'Cliente',true));
case 'DELETE cliente':return excluiCliente(campoId(q.id??null,'Cliente',true));
case 'POST meu-caminhao':return rotaMeuCaminhao();
case 'POST viagens':return viagemComCadastro();
case 'PUT viagem':return viagemComEdicao(campoId(q.id??null,'Viagem',true));
case 'POST viagem-encerrar':return viagemComEncerramento(campoId(q.id??null,'Viagem',true));
case 'POST viagem-pagamento':return viagemComPagamento(campoId(q.id??null,'Viagem',true));
case 'GET viagens-financeiro':return resumoFinanceiroViagens();
case 'DELETE viagem':{
      const id=campoId(q.id??null,'Viagem',true),eu=await exigeLogin(),v=await viagemAcessivel(id);
      exigePrazoDoMotorista(eu,v,'criado_por','esta viagem');
      for(const tabela of ['lancamentos','recebiveis','notas_fiscais','diarias'])await consulta('UPDATE '+tabela+' SET viagem_id=NULL WHERE viagem_id=?',[id]);
      await consulta('DELETE FROM viagens WHERE id=?',[id]);return {ok:true};
    }
case 'POST login':
      return rotaLogin();
case 'POST logout':
      await encerraSessao();
      return { ok: true };
case 'GET eu':
      return exigeLogin();
case 'POST trocar-senha':
      return rotaTrocarSenha();
case 'GET usuarios':
      return rotaUsuarios();
case 'POST usuarios':
      return rotaNovoUsuario();
case 'PUT usuario':
      return rotaEditaUsuario(campoId(q.id ?? null, 'Usuário', true));
case 'DELETE usuario':
      return rotaExcluiUsuario(campoId(q.id ?? null, 'Usuário', true));
case 'GET caminhoes': {
      await exigeLogin();
      const todos = (await ehAdmin()) && (q.todos ?? '') === '1';
      return todas(
        'SELECT id, placa, apelido, ativo FROM caminhoes '
        + (todos ? '' : 'WHERE ativo = 1 ') + 'ORDER BY ativo DESC, placa'
      );
    }
case 'POST caminhoes':
      return rotaNovoCaminhao();
case 'PUT caminhao':
      return rotaEditaCaminhao(campoId(q.id ?? null, 'Caminhão', true));
case 'DELETE caminhao':
      return rotaExcluiCaminhao(campoId(q.id ?? null, 'Caminhão', true));
case 'GET categorias':
      return rotaCategorias();
case 'POST categorias':
      return rotaNovaCategoria();
case 'PUT categorias-ordem':
 return rotaOrdemCategorias();
case 'PUT categoria':
      return rotaEditaCategoria(campoId(q.id ?? null, 'Categoria', true));
case 'DELETE categoria':
      return rotaExcluiCategoria(campoId(q.id ?? null, 'Categoria', true));
case 'GET viagens':
      return rotaViagens();
case 'GET lancamentos':
      return rotaLancamentos();
case 'GET lancamento':
      return rotaUmLancamento(campoId(q.id ?? null, 'Lançamento', true));
case 'POST lancamentos':
      return rotaNovoLancamento();
case 'PUT lancamento':
      return rotaEditaLancamento(campoId(q.id ?? null, 'Lançamento', true));
case 'DELETE lancamento':
      return rotaExcluiLancamento(campoId(q.id ?? null, 'Lançamento', true));
case 'GET resumo':
      return rotaResumo();
case 'GET avisos':
      return rotaAvisos();
case 'POST avisos-lidos':
      return rotaAvisosLidos();
case 'GET push-chave':
      return rotaPushChave();
case 'POST push-inscrever':
      return rotaPushInscrever();
case 'POST push-cancelar':
      return rotaPushCancelar();
case 'POST push-teste':
      return rotaPushTeste();
case 'GET pdf':
      return rotaPdf();
case 'GET pdf-panorama':
      return rotaPdfPanorama();
case 'POST comprovante':
      return rotaEnviaComprovante();
case 'GET comprovante':
      return rotaBaixaComprovante();
case 'GET receita':
      return rotaReceita();
case 'GET notas':
      return rotaNotas();
case 'POST notas':
      return rotaNovaNota();
case 'PUT nota':
      return rotaEditaNota(campoId(q.id ?? null, 'Nota fiscal', true));
case 'DELETE nota':
      return rotaExcluiNota(campoId(q.id ?? null, 'Nota fiscal', true));
case 'GET recebiveis':
      return rotaRecebiveis();
case 'GET recebivel':
      return rotaUmRecebivel(campoId(q.id ?? null, 'Frete a receber', true));
case 'POST recebiveis':
      return rotaNovoRecebivel();
case 'PUT recebivel':
      return rotaEditaRecebivel(campoId(q.id ?? null, 'Frete a receber', true));
case 'DELETE recebivel':
      return rotaExcluiRecebivel(campoId(q.id ?? null, 'Frete a receber', true));
case 'POST recebivel-receber':
      return rotaRecebeParte(campoId(q.id ?? null, 'Frete a receber', true));
case 'GET diarias':
      return rotaDiarias();
case 'POST diarias':
      return rotaNovasDiarias();
case 'PUT diaria':
      return rotaEditaDiaria(campoId(q.id ?? null, 'Diária', true));
case 'DELETE diaria':
      return rotaExcluiDiaria(campoId(q.id ?? null, 'Diária', true));
case 'POST diarias-pagar':
      return rotaPagaDiarias();
case 'PUT diaria-valor':
      return rotaValorDiaria(campoId(q.usuario_id ?? null, 'Motorista', true));
  }
  throw new ErroDeUso('Endereço não encontrado.', 404);
}

async function rotaLogin() {
  const corpo = await corpoJson();
  const usuario = campoTexto(corpo.usuario ?? null, 'Usuário', true, 40).toLowerCase();
  const senha = String(corpo.senha ?? '');
  const ip = ctx().req.headers.get('CF-Connecting-IP') || '?';
  const chave = `${usuario}|${ip}`.slice(0, 120);

  if (!(await podeTentarLogin(chave))) {
    throw new ErroDeUso('Muitas tentativas de senha. Espere alguns minutos e tente de novo.', 429);
  }
  const adm = await entraComoAdm(usuario, senha);
  if (adm) {
    await limpaTentativas(chave);
    await criaSessao(adm);
    return exigeLogin();
  }
  const u = await umaLinha('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  if (!u || u.papel === PAPEL_ADM || !Number(u.ativo) || !(await confereSenha(senha, u.senha_hash))) {
    throw new ErroDeUso('Usuário ou senha incorretos.', 401);
  }
  await limpaTentativas(chave);
  await criaSessao(Number(u.id));
  return exigeLogin();
}

async function rotaTrocarSenha() {
  const eu = await exigeLogin();
  const corpo = await corpoJson();
  const atual = String(corpo.senha_atual ?? '');
  const nova = String(corpo.senha_nova ?? '');
  if (tamanho(nova) < 4) throw new ErroDeUso('A nova senha deve ter ao menos 4 caracteres.');
  const u = await umaLinha('SELECT senha_hash FROM usuarios WHERE id = ?', [eu.id]);
  if (!(await confereSenha(atual, u.senha_hash))) throw new ErroDeUso('Senha atual incorreta.');
  await atualiza('usuarios', eu.id, { senha_hash: await hashSenha(nova) });
  return { ok: true };
}

async function rotaUsuarios() {
  const eu = await exigeLogin();
  if (eu.papel !== 'admin') {
    return [{
      id: eu.id, nome: eu.nome, papel: eu.papel, ativo: 1,
      caminhao_padrao_id: eu.caminhao_padrao_id,
      valor_diaria_centavos: eu.valor_diaria_centavos,
    }];
  }
  return todas(
    `SELECT id, nome, usuario, papel, telefone, caminhao_padrao_id, valor_diaria_centavos, ativo, criado_em
       FROM usuarios WHERE papel <> ? ORDER BY ativo DESC, papel, nome`,
    [PAPEL_ADM]
  );
}

async function camposExtrasUsuario(corpo) {
  const caminhaoId = campoId(corpo.caminhao_padrao_id ?? null, 'Caminhão padrão');
  if (caminhaoId !== null && await umValor('SELECT id FROM caminhoes WHERE id = ?', [caminhaoId]) === null) {
    throw new ErroDeUso('Caminhão padrão não encontrado.');
  }
  return {
    caminhao_padrao_id: caminhaoId,
    valor_diaria_centavos: campoCentavosOpcional(corpo.valor_diaria ?? null, 'Valor da diária'),
  };
}

async function rotaNovoUsuario() {
  await exigeAdmin();
  const corpo = await corpoJson();
  const nome = campoTexto(corpo.nome ?? null, 'Nome', true, 80);
  const usuario = campoTexto(corpo.usuario ?? null, 'Usuário', true, 40).replace(/\s+/g, '').toLowerCase();
  const senha = String(corpo.senha ?? '');
  const papel = (corpo.papel ?? '') === 'admin' ? 'admin' : 'motorista';

  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new ErroDeUso('O usuário deve ter de 3 a 40 caracteres: letras, números, ponto ou -.');
  }
  if (tamanho(senha) < 4) throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
  if (usuario === loginDoAdm() || await umValor('SELECT id FROM usuarios WHERE usuario = ?', [usuario]) !== null) {
    throw new ErroDeUso('Já existe um usuário com esse login.');
  }
  const id = await insere('usuarios', {
    nome,
    usuario,
    senha_hash: await hashSenha(senha),
    papel,
    telefone: campoTexto(corpo.telefone ?? null, 'Telefone', false, 30),
    ativo: 1,
    criado_em: instanteCadastro(),
    ...(await camposExtrasUsuario(corpo)),
  });
  return { id };
}

async function rotaEditaUsuario(id) {
  const eu = await exigeAdmin();
  const corpo = await corpoJson();
  const u = await umaLinha('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!u || u.papel === PAPEL_ADM) throw new ErroDeUso('Usuário não encontrado.', 404);
  const papel = (corpo.papel ?? '') === 'admin' ? 'admin' : 'motorista';
  const ativo = campoSimNao(corpo.ativo ?? null);

  if (Number(u.id) === eu.id && (papel !== 'admin' || !ativo)) {
    throw new ErroDeUso('Você não pode remover o seu próprio acesso de proprietário.');
  }
  if (u.papel === 'admin' && papel !== 'admin') {
    const outros = Number(await umValor(
      "SELECT COUNT(*) FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?",
      [id]
    ));
    if (outros === 0) throw new ErroDeUso('É preciso manter ao menos um proprietário ativo.');
  }
  const nova = String(corpo.senha_nova ?? '');
  if (nova !== '' && tamanho(nova) < 4) throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
  await atualiza('usuarios', id, {
    nome: campoTexto(corpo.nome ?? null, 'Nome', true, 80),
    telefone: campoTexto(corpo.telefone ?? null, 'Telefone', false, 30),
    papel,
    ativo,
    ...(await camposExtrasUsuario(corpo)),
  });
  if (nova !== '') await atualiza('usuarios', id, { senha_hash: await hashSenha(nova) });
  return { ok: true };
}

// Só apaga quem nunca lançou nada; quem tem histórico deve ser bloqueado, para os relatórios não perderem o nome.
async function rotaExcluiUsuario(id) {
  const eu = await exigeAdmin();
  const u = await umaLinha('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!u || u.papel === PAPEL_ADM) throw new ErroDeUso('Usuário não encontrado.', 404);
  if (Number(u.id) === eu.id) throw new ErroDeUso('Você não pode excluir o seu próprio acesso.');
  if (u.papel === 'admin') {
    throw new ErroDeUso('Acessos de proprietário não podem ser excluídos. Mude para motorista ou bloqueie.');
  }
  let historico = 0;
  for (const tabela of ['lancamentos', 'viagens', 'diarias', 'notas_fiscais']) {
    historico += Number(await umValor(`SELECT COUNT(*) FROM ${tabela} WHERE usuario_id = ?`, [id]));
  }
  if (historico > 0) {
    throw new ErroDeUso(
      'Este motorista já tem lançamentos, viagens, diárias ou notas no sistema e não pode ser '
      + 'excluído sem perder esse histórico. Bloqueie o acesso dele em "Editar".',
      409
    );
  }
  await consulta('DELETE FROM avisos WHERE usuario_id = ? OR para_usuario_id = ?', [id, id]);
  await consulta('DELETE FROM avisos_vistos WHERE usuario_id = ?', [id]);
  await consulta('DELETE FROM inscricoes_push WHERE usuario_id = ?', [id]);
  await consulta('DELETE FROM envios_fila WHERE usuario_id = ?', [id]);
  await consulta('DELETE FROM usuarios WHERE id = ?', [id]);
  return { ok: true };
}

async function rotaNovoCaminhao() {
  await exigeAdmin();
  const corpo = await corpoJson();
  const placa = campoTexto(corpo.placa ?? null, 'Placa', true, 10).toUpperCase();
  if (await umValor('SELECT id FROM caminhoes WHERE placa = ?', [placa]) !== null) {
    throw new ErroDeUso('Essa placa já está cadastrada.');
  }
  return {
    id: await insere('caminhoes', {
      placa,
      apelido: campoTexto(corpo.apelido ?? null, 'Apelido', false, 60),
      ativo: 1,
      criado_em: instanteCadastro(),
    }),
  };
}

async function rotaEditaCaminhao(id) {
  await exigeAdmin();
  const corpo = await corpoJson();
  const placa = campoTexto(corpo.placa ?? null, 'Placa', true, 10).toUpperCase();
  if (await umValor('SELECT id FROM caminhoes WHERE placa = ? AND id <> ?', [placa, id]) !== null) {
    throw new ErroDeUso('Essa placa já está cadastrada em outro caminhão.');
  }
  const mudou = await atualiza('caminhoes', id, {
    placa,
    apelido: campoTexto(corpo.apelido ?? null, 'Apelido', false, 60),
    ativo: campoSimNao(corpo.ativo ?? null),
  });
  if (!mudou && await umValor('SELECT id FROM caminhoes WHERE id = ?', [id]) === null) {
    throw new ErroDeUso('Caminhão não encontrado.', 404);
  }
  return { ok: true };
}

async function rotaExcluiCaminhao(id) {
  await exigeAdmin();
  const placa = await umValor('SELECT placa FROM caminhoes WHERE id = ?', [id]);
  if (placa === null) throw new ErroDeUso('Caminhão não encontrado.', 404);
  let historico = 0;
  for (const tabela of ['lancamentos', 'viagens', 'recebiveis', 'notas_fiscais']) {
    historico += Number(await umValor(`SELECT COUNT(*) FROM ${tabela} WHERE caminhao_id = ?`, [id]));
  }
  if (historico > 0) {
    throw new ErroDeUso(
      `O caminhão ${placa} já tem lançamentos ou viagens e não pode ser excluído sem perder esse `
      + 'histórico. Marque-o como "Fora de operação" em "Editar".',
      409
    );
  }
  await consulta('UPDATE usuarios SET caminhao_padrao_id = NULL WHERE caminhao_padrao_id = ?', [id]);
  await consulta('DELETE FROM caminhoes WHERE id = ?', [id]);
  return { ok: true };
}

async function rotaCategorias() {
  const eu = await exigeLogin();
  const q = ctx().q;
  const cond = [];
  const args = [];
  if (eu.papel !== 'admin') {
    cond.push("tipo = 'saida'", 'ativo = 1', 'oculta_motorista = 0');
  } else if ((q.todos ?? '') !== '1') {
    cond.push('ativo = 1');
  }
  if (['entrada', 'saida'].includes(q.tipo ?? '')) {
    cond.push('tipo = ?');
    args.push(q.tipo);
  }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const qtd = eu.papel === 'admin'
    ? ', (SELECT COUNT(*) FROM lancamentos l WHERE l.categoria_id = categorias.id) AS qtd_lancamentos'
    : '';
  return todas(
    `SELECT id, nome, tipo, icone, pede_litros, pede_descricao, oculta_motorista, ordem, ativo ${qtd}
       FROM categorias ${where} ORDER BY tipo, ativo DESC, ordem, nome`,
    args
  );
}

async function qtdLancamentosDaCategoria(id) {
  return Number(await umValor('SELECT COUNT(*) FROM lancamentos WHERE categoria_id = ?', [id]));
}

async function rotaNovaCategoria() {
  await exigeAdmin();
  const corpo = await corpoJson();
  const nome = campoTexto(corpo.nome ?? null, 'Nome', true, 40);
  const tipo = (corpo.tipo ?? '') === 'entrada' ? 'entrada' : 'saida';
  if (await umValor('SELECT id FROM categorias WHERE nome = ? AND tipo = ?', [nome, tipo]) !== null) {
    throw new ErroDeUso('Já existe uma categoria com esse nome.');
  }
  return {
    id: await insere('categorias', {
      nome,
      tipo,
      icone: campoTexto(corpo.icone ?? 'tag','Ícone',true,40),
      pede_litros: tipo==='saida' ? campoSimNao(corpo.pede_litros ?? null,false) : 0,
      pede_descricao: campoSimNao(corpo.pede_descricao ?? null,false),
      oculta_motorista: tipo === 'saida' ? campoSimNao(corpo.oculta_motorista ?? null, false) : 0,
      ordem: 500,
      ativo: 1,
      criado_em: instanteCadastro(),
    }),
  };
}

async function rotaEditaCategoria(id) {
  await exigeAdmin();
  const corpo = await corpoJson();
  const cat = await umaLinha('SELECT * FROM categorias WHERE id = ?', [id]);
  if (!cat) throw new ErroDeUso('Categoria não encontrada.', 404);
  const nome = campoTexto(corpo.nome ?? null, 'Nome', true, 40);
  const tipo = ['entrada', 'saida'].includes(corpo.tipo ?? '') ? corpo.tipo : cat.tipo;
  if (tipo !== cat.tipo && await qtdLancamentosDaCategoria(id) > 0) {
    throw new ErroDeUso(
      'Esta categoria já tem lançamentos, por isso não pode mudar entre gasto e entrada. '
      + 'Crie uma categoria nova do outro tipo.'
    );
  }
  const igual = await umValor('SELECT id FROM categorias WHERE nome = ? AND tipo = ? AND id <> ?', [nome, tipo, id]);
  if (igual !== null) throw new ErroDeUso('Já existe uma categoria com esse nome.');
  const litros=tipo==='saida'?campoSimNao(corpo.pede_litros ?? null,Boolean(Number(cat.pede_litros))):0;
  if(Number(litros)!==Number(cat.pede_litros) && await qtdLancamentosDaCategoria(id)>0)throw new ErroDeUso('O controle de abastecimento não pode mudar em uma categoria com lançamentos.');
  await atualiza('categorias', id, {
    icone: campoTexto(corpo.icone ?? cat.icone,'Ícone',true,40),
    pede_litros: litros,
    pede_descricao: campoSimNao(corpo.pede_descricao ?? null,Boolean(Number(cat.pede_descricao))),
    nome,
    tipo,
    ativo: campoSimNao(corpo.ativo ?? null),
    oculta_motorista: tipo === 'saida'
      ? campoSimNao(corpo.oculta_motorista ?? null, Boolean(Number(cat.oculta_motorista)))
      : 0,
  });
  return { ok: true };
}

async function rotaOrdemCategorias(){
 await exigeAdmin();const corpo=await corpoJson(),tipo=corpo.tipo;
 if(!['entrada','saida'].includes(tipo)||!Array.isArray(corpo.ids)||!corpo.ids.length||corpo.ids.length>500)throw new ErroDeUso('Informe a ordem das categorias.');
 const ids=corpo.ids.map(id=>campoId(id,'Categoria',true));
 if(new Set(ids).size!==ids.length)throw new ErroDeUso('A ordem contém categorias repetidas.');
 const linhas=await todas('SELECT id FROM categorias WHERE tipo = ? FOR UPDATE',[tipo]);
 const atuais=linhas.map(c=>Number(c.id)).sort((a,b)=>a-b),comparar=[...ids].sort((a,b)=>a-b);
 if(JSON.stringify(atuais)!==JSON.stringify(comparar))throw new ErroDeUso('As categorias mudaram. Atualize a lista e tente novamente.',409);
 for(let i=0;i<ids.length;i++)await atualiza('categorias',ids[i],{ordem:i+1});
 return {ok:true};
}

async function rotaExcluiCategoria(id) {
  await exigeAdmin();
  if (await umValor('SELECT id FROM categorias WHERE id = ?', [id]) === null) {
    throw new ErroDeUso('Categoria não encontrada.', 404);
  }
  const qtd = await qtdLancamentosDaCategoria(id);
  if (qtd > 0) {
    throw new ErroDeUso(
      `Esta categoria tem ${qtd} ` + (qtd === 1 ? 'lançamento' : 'lançamentos')
      + ' e não pode ser apagada sem perder esse histórico. Você pode escondê-la: '
      + 'ela some da hora de lançar, mas os lançamentos antigos continuam.',
      409
    );
  }
  await consulta('DELETE FROM categorias WHERE id = ?', [id]);
  return { ok: true };
}

// O motorista só pode corrigir ou apagar o que ele mesmo registrou, e só nos primeiros minutos.
// Depois disso, só o proprietário altera.
const MINUTOS_PARA_CORRIGIR = 2;

function segundosParaCorrigir(criadoEm) {
  if (!criadoEm) return 0;
  const passou = time() - segundosDe(criadoEm);
  return Math.max(0, MINUTOS_PARA_CORRIGIR * 60 - passou);
}

function podeCorrigir(eu, registro, campoDono) {
  if (eu.papel === 'admin') return true;
  return Number(registro[campoDono]) === eu.id && segundosParaCorrigir(registro.criado_em) > 0;
}

function exigePrazoDoMotorista(eu, registro, campoDono, oQue) {
  if (eu.papel === 'admin') return;
  if (Number(registro[campoDono]) !== eu.id) {
    throw new ErroDeUso('Você só pode alterar o que você mesmo registrou.', 403);
  }
  if (segundosParaCorrigir(registro.criado_em) <= 0) {
    throw new ErroDeUso(
      `O prazo de ${MINUTOS_PARA_CORRIGIR} minutos para corrigir ${oQue} terminou. `
      + 'Agora só o proprietário pode alterar ou excluir.',
      403
    );
  }
}

// Diz para a tela se o botão de editar/excluir aparece e por quanto tempo.
function anotaPrazo(eu, registro, campoDono) {
  const pode = podeCorrigir(eu, registro, campoDono);
  registro.pode_alterar = pode;
  registro.segundos_para_alterar = eu.papel === 'admin' ? null
    : (pode ? segundosParaCorrigir(registro.criado_em) : 0);
  return registro;
}

async function viagemAcessivel(id) {
  const eu = await exigeLogin();
  const v = await umaLinha('SELECT * FROM viagens WHERE id = ?', [id]);
  if (!v) throw new ErroDeUso('Viagem não encontrada.', 404);
  if (eu.papel !== 'admin' && Number(v.usuario_id) !== eu.id) {
    throw new ErroDeUso('Essa viagem não é sua.', 403);
  }
  return v;
}

async function rotaViagens(){const eu=await exigeLogin(),q=ctx().q,cond=[],args=[];if(eu.papel!=='admin'){cond.push('v.usuario_id=?');args.push(eu.id);}for(const key of ['id','cliente_id','caminhao_id',...(eu.papel==='admin'?['usuario_id']:[])])if(q[key]){cond.push('v.'+key+'=?');args.push(campoId(q[key],key));}if(['aberta','encerrada'].includes(q.status)){cond.push('v.status=?');args.push(q.status);}const [limit,offset]=paginacao(q);return (await todas(SQL_VIAGEM+(cond.length?' WHERE '+cond.join(' AND '):'')+` ORDER BY CASE WHEN v.status='aberta' THEN 0 ELSE 1 END,v.inicio DESC,v.id DESC LIMIT ${limit} OFFSET ${offset}`,args)).map(v=>anotaPrazo(eu,v,'criado_por'));}

async function rotaNovaViagem() {
  const eu = await exigeLogin();
  const corpo = await corpoJson();
  const usuarioId = eu.papel === 'admin' && !vazio(corpo.usuario_id)
    ? campoId(corpo.usuario_id, 'Motorista')
    : eu.id;
  const dados = {
    usuario_id: usuarioId,
    caminhao_id: campoId(corpo.caminhao_id ?? null, 'Caminhão'),
    origem: campoTexto(corpo.origem ?? null, 'Saindo de', true, 80),
    destino: campoTexto(corpo.destino ?? null, 'Indo para', true, 80),
    inicio: campoData(corpo.inicio ?? null, 'Data de saída'),
    km_inicial: campoNumero(corpo.km_inicial ?? null, 'Km inicial', 9999999, true),
    status: 'aberta',
    criado_por: eu.id,
    observacao: campoTexto(corpo.observacao ?? null, 'Observação', false, 500),
    criado_em: instanteCadastro(),
  };
  const id = await insere('viagens', dados);
  const resumo = `${dados.origem} → ${dados.destino} · saída ${pdfData(dados.inicio)}`;
  await registraAviso(eu, 'abriu', 'viagem', null, resumo);
  if (eu.papel === 'admin') {
    await registraAviso(eu, 'abriu', 'viagem', null, 'Nova viagem para você: ' + resumo, usuarioId);
  }
  return { id };
}

async function rotaEditaViagem(id) {
  const eu = await exigeLogin();
  const atual = await viagemAcessivel(id);
  exigePrazoDoMotorista(eu, atual, 'criado_por', 'esta viagem');
  const corpo = await corpoJson();
  const inicio = campoData(corpo.inicio ?? null, 'Data de saída');
  const fim = campoData(corpo.fim ?? null, 'Data de chegada', false);
  const kmInicial = campoNumero(corpo.km_inicial ?? null, 'Km inicial', 9999999, true);
  const kmFinal = campoNumero(corpo.km_final ?? null, 'Km final', 9999999, true);
  if (fim !== null && fim < inicio) throw new ErroDeUso('A chegada não pode ser antes da saída.');
  if (kmFinal !== null && kmInicial !== null && kmFinal < kmInicial) {
    throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
  }
  await atualiza('viagens', id, {
    usuario_id: eu.papel === 'admin' && !vazio(corpo.usuario_id)
      ? campoId(corpo.usuario_id, 'Motorista')
      : Number(atual.usuario_id),
    caminhao_id: campoId(corpo.caminhao_id ?? null, 'Caminhão'),
    origem: campoTexto(corpo.origem ?? null, 'Saindo de', true, 80),
    destino: campoTexto(corpo.destino ?? null, 'Indo para', true, 80),
    inicio,
    fim,
    km_inicial: kmInicial,
    km_final: kmFinal,
    observacao: campoTexto(corpo.observacao ?? null, 'Observação', false, 500),
    status: (corpo.status ?? '') === 'encerrada' ? 'encerrada' : 'aberta',
  });
  return { ok: true };
}

async function rotaEncerraViagem(id) {
  const v = await viagemAcessivel(id);
  if (v.status === 'encerrada' && !(await ehAdmin())) {
    throw new ErroDeUso('Esta viagem já foi encerrada. Para corrigir, fale com o proprietário.', 403);
  }
  const corpo = await corpoJson();
  const fim = campoData(corpo.fim ?? hoje(), 'Data de chegada');
  const kmFinal = campoNumero(corpo.km_final ?? null, 'Km final', 9999999, true);
  if (fim < v.inicio) throw new ErroDeUso('A chegada não pode ser antes da saída.');
  if (kmFinal !== null && v.km_inicial !== null && kmFinal < Number(v.km_inicial)) {
    throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
  }
  await atualiza('viagens', id, { status: 'encerrada', fim, km_final: kmFinal });
  return { ok: true };
}

async function filtrosLancamento(){
 const eu=await exigeLogin(),q=ctx().q,cond=[],args=[];
 if(eu.papel!=='admin'){cond.push("l.usuario_id=? AND l.tipo='saida' AND l.categoria_id NOT IN (SELECT id FROM categorias WHERE oculta_motorista=1)");args.push(eu.id);}else{if(q.usuario_id){cond.push('l.usuario_id=?');args.push(campoId(q.usuario_id,'Motorista'));}if(['entrada','saida'].includes(q.tipo)){cond.push('l.tipo=?');args.push(q.tipo);}}
 if(q.mes){const [de,ate]=limitesDoMes(mesValido(q.mes));cond.push('l.data BETWEEN ? AND ?');args.push(de,ate);}for(const [k,op] of [['de','>='],['ate','<=']])if(q[k]){cond.push(`l.data ${op} ?`);args.push(campoData(q[k],'Data'));}
 for(const k of ['categoria_id','caminhao_id','viagem_id','recebivel_id'])if(q[k]){cond.push('l.'+k+'=?');args.push(campoId(q[k],k));}
 const busca=campoTexto(q.busca??null,'Busca',false,120);
 if(busca){const campos=['l.descricao','l.observacao','l.lugar','l.cliente','(SELECT nome FROM usuarios WHERE id=l.usuario_id)','(SELECT nome FROM categorias WHERE id=l.categoria_id)','(SELECT placa FROM caminhoes WHERE id=l.caminhao_id)','(SELECT apelido FROM caminhoes WHERE id=l.caminhao_id)','(SELECT cl.nome FROM clientes cl JOIN viagens v ON v.cliente_id=cl.id WHERE v.id=l.viagem_id)','(SELECT origem FROM viagens WHERE id=l.viagem_id)','(SELECT destino FROM viagens WHERE id=l.viagem_id)'];let texto="translate(LOWER("+campos.map(c=>`COALESCE(${c},'')`).join(" || ' ' || ")+"),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')";for(const sinal of ['-','.','/','(',')',',','_'])texto=`REPLACE(${texto},'${sinal}',' ')`;for(const palavra of [...new Set(normalizaBusca(busca).split(' '))].filter(Boolean).slice(0,12)){cond.push(texto+' LIKE ?');args.push('%'+palavra+'%');}}
 return [cond.length?'WHERE '+cond.join(' AND '):'',args];
}

async function rotaLancamentos() {
  const [where, args] = await filtrosLancamento();
  const [limite, offset, pagina] = paginacao(ctx().q);
  const eu = await exigeLogin();
  const itens = (await todas(
    `${SQL_LANCAMENTO} ${where} ORDER BY l.data DESC, l.id DESC LIMIT ${limite} OFFSET ${offset}`, args
  )).map((l) => anotaPrazo(eu, l, 'criado_por'));
  const totais = await umaLinha(
    `SELECT COUNT(*) AS qtd,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos
       FROM lancamentos l ${where}`,
    args
  );
  return {
    itens,
    qtd: inteiro(totais.qtd),
    entradas_centavos: inteiro(totais.entradas_centavos),
    saidas_centavos: inteiro(totais.saidas_centavos),
    saldo_centavos: inteiro(totais.entradas_centavos) - inteiro(totais.saidas_centavos),
    pagina,
  };
}

async function rotaUmLancamento(id) {
  const eu = await exigeLogin();
  const l = await umaLinha(SQL_LANCAMENTO + ' WHERE l.id = ?', [id]);
  if (!l) throw new ErroDeUso('Lançamento não encontrado.', 404);
  if (eu.papel !== 'admin'
    && (Number(l.usuario_id) !== eu.id || l.tipo !== 'saida' || await categoriaOculta(Number(l.categoria_id)))) {
    throw new ErroDeUso('Sem acesso a este lançamento.', 403);
  }
  return anotaPrazo(eu, l, 'criado_por');
}

async function categoriaOculta(id) {
  return Boolean(inteiro(await umValor('SELECT oculta_motorista FROM categorias WHERE id = ?', [id])));
}

async function dadosLancamento(eu, atual = null) {
  const corpo = await corpoJson();
  const categoriaId = campoId(corpo.categoria_id ?? null, 'Categoria', true);
  const cat = await umaLinha('SELECT * FROM categorias WHERE id = ?', [categoriaId]);
  if (!cat) throw new ErroDeUso('Categoria inválida.');
  if (eu.papel !== 'admin' && cat.tipo !== 'saida') {
    throw new ErroDeUso('Somente o proprietário lança entradas.', 403);
  }
  if (eu.papel !== 'admin' && Number(cat.oculta_motorista)) throw new ErroDeUso('Categoria inválida.');
  let recebivelId = null;
  if (eu.papel === 'admin' && cat.tipo === 'entrada') {
    recebivelId = campoId(corpo.recebivel_id ?? null, 'Frete a receber');
    if (recebivelId !== null && await umValor('SELECT id FROM recebiveis WHERE id = ?', [recebivelId]) === null) {
      throw new ErroDeUso('Frete a receber não encontrado.');
    }
  }
  const viagemId = campoId(corpo.viagem_id ?? null, 'Viagem');
  if (viagemId !== null) await viagemAcessivel(viagemId);
  const comprovante = campoTexto(corpo.comprovante ?? null, 'Comprovante', false, 120);
  if (comprovante !== null && !ARQUIVO_VALIDO.test(comprovante)) throw new ErroDeUso('Comprovante inválido.');
  const usuarioId = eu.papel === 'admin' && !vazio(corpo.usuario_id)
    ? campoId(corpo.usuario_id, 'Motorista')
    : (atual !== null ? Number(atual.usuario_id) : eu.id);

  return {
    tipo: cat.tipo,
    usuario_id: usuarioId,
    viagem_id: viagemId,
    caminhao_id: campoId(corpo.caminhao_id ?? null, 'Caminhão'),
    categoria_id: categoriaId,
    descricao: campoTexto(
      corpo.descricao ?? null,
      cat.tipo === 'entrada' ? 'Descrição da entrada' : 'Descrição do gasto',
      Boolean(Number(cat.pede_descricao)),
      140
    ),
    valor_centavos: campoCentavos(corpo.valor ?? null),
    litros: campoNumero(corpo.litros ?? null, 'Litros', 5000),
    km: campoNumero(corpo.km ?? null, 'Km', 9999999, true),
    data: campoData(corpo.data ?? null, 'Data'),
    pagamento: campoTexto(corpo.pagamento ?? null, 'Forma de pagamento', false, 30),
    lugar: campoTexto(corpo.lugar ?? null, 'Onde foi', false, 90),
    cliente: campoTexto(corpo.cliente ?? null, 'Quem pagou', false, 90),
    observacao: campoTexto(corpo.observacao ?? null, 'Observação', false, 500),
    comprovante,
    recebivel_id: recebivelId,
  };
}

function resumoDoLancamento(l) {
  return l.categoria + (l.descricao ? ' - ' + l.descricao : '')
    + ' · ' + pdfReais(inteiro(l.valor_centavos)) + ' · ' + pdfData(l.data);
}

async function rotaNovoLancamento() {
  const eu = await exigeLogin();
  const dados = await dadosLancamento(eu);
  dados.criado_em = instanteCadastro();
  dados.criado_por = eu.id;
  const id = await insere('lancamentos', dados);
  const novo = await umaLinha(SQL_LANCAMENTO + ' WHERE l.id = ?', [id]);
  await registraAviso(eu, 'criou', novo.tipo, id, resumoDoLancamento(novo));
  return anotaPrazo(eu, novo, 'criado_por');
}

async function rotaEditaLancamento(id) {
  const eu = await exigeLogin();
  const atual = await umaLinha('SELECT * FROM lancamentos WHERE id = ?', [id]);
  if (!atual) throw new ErroDeUso('Lançamento não encontrado.', 404);
  exigePrazoDoMotorista(eu, atual, 'criado_por', 'este lançamento');
  const dados = await dadosLancamento(eu, atual);
  dados.atualizado_em = agora();
  dados.atualizado_por = eu.id;
  await atualiza('lancamentos', id, dados);
  const editado = await umaLinha(SQL_LANCAMENTO + ' WHERE l.id = ?', [id]);
  await registraAviso(eu, 'editou', editado.tipo, id, resumoDoLancamento(editado));
  return anotaPrazo(eu, editado, 'criado_por');
}

async function rotaExcluiLancamento(id) {
  const eu = await exigeLogin();
  const atual = await umaLinha('SELECT * FROM lancamentos WHERE id = ?', [id]);
  if (!atual) throw new ErroDeUso('Lançamento não encontrado.', 404);
  exigePrazoDoMotorista(eu, atual, 'criado_por', 'este lançamento');
  const completo = await umaLinha(SQL_LANCAMENTO + ' WHERE l.id = ?', [id]);
  await consulta('DELETE FROM lancamentos WHERE id = ?', [id]);
  await consulta('UPDATE avisos SET lancamento_id = NULL WHERE lancamento_id = ?', [id]);
  // Se era o pagamento de diárias, elas voltam a ficar pendentes.
  await consulta('UPDATE diarias SET lancamento_id = NULL WHERE lancamento_id = ?', [id]);
  await registraAviso(eu, 'excluiu', atual.tipo, null, resumoDoLancamento(completo));
  if (atual.comprovante && ARQUIVO_VALIDO.test(atual.comprovante) && !(await arquivoEmUso(atual.comprovante))) {
    await apagaComprovante(atual.comprovante);
  }
  return { ok: true };
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesPorExtenso(mes) {
  const [ano, m] = mes.split('-');
  return `${MESES_PT[Number(m) - 1]} de ${ano}`;
}

function periodoPorExtenso(deMes, ateMes) {
  return deMes === ateMes ? mesPorExtenso(deMes) : `${mesPorExtenso(deMes)} a ${mesPorExtenso(ateMes)}`;
}

function mesesEntre(deMes, ateMes) {
  const lista = [];
  for (let m = deMes; m <= ateMes; m = somaMeses(m, 1)) lista.push(m);
  return lista;
}

// Período do panorama em meses (AAAA-MM). Sem nada informado, é o mês atual.
function periodoPanorama() {
  const q = ctx().q;
  let deMes;
  let ateMes;
  if (!vazio(q.mes)) {
    deMes = ateMes = mesValido(q.mes);
  } else {
    deMes = mesValido(q.de ?? '');
    ateMes = mesValido(q.ate ?? '');
  }
  if (deMes > ateMes) [deMes, ateMes] = [ateMes, deMes];
  if (mesesEntre(deMes, ateMes).length > 36) throw new ErroDeUso('Escolha um período de até 36 meses.');
  return [deMes, ateMes];
}

async function dadosPanorama(deMes, ateMes) {
  let extra='',viagemExtra='';
  if(await ehAdmin())for(const [campo,nome] of Object.entries({usuario_id:'Motorista',caminhao_id:'Caminhão',categoria_id:'Categoria'})){
   if(ctx().q[campo]){const id=campoId(ctx().q[campo],nome,true);extra+=` AND ${campo} = ${id}`;if(campo!=='categoria_id')viagemExtra+=` AND ${campo} = ${id}`;}
  }
  const fonte=`(SELECT * FROM lancamentos WHERE 1=1 ${extra})`;
  const meses = mesesEntre(deMes, ateMes);
  const de = limitesDoMes(deMes)[0];
  const ate = limitesDoMes(ateMes)[1];
  const antAteMes = mesAnterior(deMes);
  const antDeMes = somaMeses(deMes, -meses.length);

  // Período atual e anterior numa consulta só (uma ida ao banco em vez de duas).
  const antDe = limitesDoMes(antDeMes)[0];
  const antAte = limitesDoMes(antAteMes)[1];
  const t = await umaLinha(
    `SELECT COUNT(*) FILTER (WHERE data BETWEEN ? AND ?) AS a_qtd,
            COALESCE(SUM(valor_centavos) FILTER (WHERE tipo = 'entrada' AND data BETWEEN ? AND ?), 0) AS a_entradas,
            COALESCE(SUM(valor_centavos) FILTER (WHERE tipo = 'saida'   AND data BETWEEN ? AND ?), 0) AS a_saidas,
            COUNT(*) FILTER (WHERE data BETWEEN ? AND ?) AS p_qtd,
            COALESCE(SUM(valor_centavos) FILTER (WHERE tipo = 'entrada' AND data BETWEEN ? AND ?), 0) AS p_entradas,
            COALESCE(SUM(valor_centavos) FILTER (WHERE tipo = 'saida'   AND data BETWEEN ? AND ?), 0) AS p_saidas
       FROM ${fonte} l WHERE data BETWEEN ? AND ? OR data BETWEEN ? AND ?`,
    [de, ate, de, ate, de, ate, antDe, antAte, antDe, antAte, antDe, antAte, de, ate, antDe, antAte]
  );
  const totais = (p) => ({
    qtd: inteiro(t[`${p}_qtd`]),
    entradas_centavos: inteiro(t[`${p}_entradas`]),
    saidas_centavos: inteiro(t[`${p}_saidas`]),
    saldo_centavos: inteiro(t[`${p}_entradas`]) - inteiro(t[`${p}_saidas`]),
  });

  const combustivel = await umaLinha(
    `SELECT COALESCE(SUM(l.litros), 0) AS litros,
            COALESCE(SUM(l.valor_centavos), 0) AS centavos
       FROM ${fonte} l JOIN categorias c ON c.id = l.categoria_id
      WHERE c.pede_litros = 1 AND l.data BETWEEN ? AND ?`,
    [de, ate]
  );

  const categoriasDoPeriodo = await todas(
    `SELECT l.tipo, c.nome, c.icone, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
       FROM ${fonte} l JOIN categorias c ON c.id = l.categoria_id
      WHERE l.tipo IN ('saida', 'entrada') AND l.data BETWEEN ? AND ?
      GROUP BY l.tipo, c.id, c.nome, c.icone ORDER BY total_centavos DESC`,
    [de, ate]
  );
  const porCategoria = (tipo) => categoriasDoPeriodo
    .filter((linha) => linha.tipo === tipo)
    .map(({ tipo: _tipo, ...linha }) => linha);

  const coluna = sqlMes('data');
  const porMes = {};
  for (const l of await todas(
    `SELECT ${coluna} AS mes,
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE 0 END), 0) AS entradas_centavos,
            COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor_centavos ELSE 0 END), 0) AS saidas_centavos,
            COUNT(*) AS qtd
       FROM ${fonte} l WHERE data BETWEEN ? AND ?
      GROUP BY ${coluna}`,
    [de, ate]
  )) {
    porMes[l.mes] = l;
  }
  const serie = meses.map((mes) => {
    const entradas = inteiro(porMes[mes]?.entradas_centavos ?? 0);
    const saidas = inteiro(porMes[mes]?.saidas_centavos ?? 0);
    return {
      mes,
      entradas_centavos: entradas,
      saidas_centavos: saidas,
      saldo_centavos: entradas - saidas,
      qtd: inteiro(porMes[mes]?.qtd ?? 0),
    };
  });

  const caminhoes = await todas(
    `SELECT cm.id, COALESCE(cm.placa, 'Sem caminhão') AS placa, cm.apelido,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos,
            COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.litros ELSE 0 END), 0) AS litros,
            COALESCE(SUM(CASE WHEN c.pede_litros = 1 THEN l.valor_centavos ELSE 0 END), 0) AS combustivel_centavos,
            COUNT(*) AS qtd
       FROM ${fonte} l
       JOIN categorias c ON c.id = l.categoria_id
       LEFT JOIN caminhoes cm ON cm.id = l.caminhao_id
      WHERE l.data BETWEEN ? AND ?
      GROUP BY cm.id, cm.placa, cm.apelido ORDER BY saidas_centavos DESC`,
    [de, ate]
  );
  const kmPorCaminhao = {};
  if (caminhoes.some((cm) => cm.id)) {
    for (const k of await todas(
      `SELECT caminhao_id, COALESCE(SUM(km_final - km_inicial), 0) AS km FROM viagens
        WHERE caminhao_id IS NOT NULL AND km_final IS NOT NULL AND km_inicial IS NOT NULL
          AND inicio BETWEEN ? AND ? ${viagemExtra}
        GROUP BY caminhao_id`,
      [de, ate]
    )) kmPorCaminhao[k.caminhao_id] = k.km;
  }
  for (const cm of caminhoes) {
    cm.km_rodados = cm.id ? inteiro(kmPorCaminhao[cm.id] ?? 0) : 0;
    cm.saldo_centavos = inteiro(cm.entradas_centavos) - inteiro(cm.saidas_centavos);
  }

  return {
    de: deMes,
    ate: ateMes,
    anterior_de: antDeMes,
    anterior_ate: antAteMes,
    atual: totais('a'),
    anterior: totais('p'),
    litros: parseFloat(combustivel.litros),
    combustivel_centavos: inteiro(combustivel.centavos),
    meses: serie,
    saidas_por_categoria: porCategoria('saida'),
    entradas_por_categoria: porCategoria('entrada'),
    por_caminhao: caminhoes,
    por_motorista: await todas(
      // Salário e diárias são pagos ao motorista, não gastos feitos por ele na estrada.
      `SELECT u.nome, COUNT(*) AS qtd, SUM(l.valor_centavos) AS total_centavos
         FROM ${fonte} l JOIN usuarios u ON u.id = l.usuario_id
        WHERE l.tipo = 'saida' AND l.data BETWEEN ? AND ?
          AND l.categoria_id NOT IN (SELECT id FROM categorias WHERE oculta_motorista = 1)
        GROUP BY u.id, u.nome ORDER BY total_centavos DESC`,
      [de, ate]
    ),
    por_dia: await todas(
      `SELECT l.data,
              COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE 0 END), 0) AS entradas_centavos,
              COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos ELSE 0 END), 0) AS saidas_centavos
         FROM ${fonte} l WHERE l.data BETWEEN ? AND ?
        GROUP BY l.data ORDER BY l.data`,
      [de, ate]
    ),
    viagens_abertas: inteiro(await umValor(`SELECT COUNT(*) FROM viagens WHERE status = 'aberta' ${viagemExtra}`)),
    a_receber: await totaisAReceber(),
  };
}

async function rotaResumo() {
  await exigeAdmin();
  return dadosPanorama(...periodoPanorama());
}

function pdfTabelaLancamentos(pdf, itens) {
  pdf.tabela(
    [
      ['Data', 44], ['Tipo', 32], ['Categoria', 64], ['Descrição', 90], ['Valor', 54, true],
      ['Caminhão', 44], ['Motorista', 58], ['Viagem', 72], ['Litros', 30, true], ['Km', 34, true],
      ['Onde foi', 60], ['Quem pagou', 58], ['Pagamento', 52], ['Observação', 94],
    ],
    itens.map((l) => [
      pdfData(l.data),
      l.tipo === 'entrada' ? 'Entrada' : 'Saída',
      String(l.categoria ?? ''),
      String(l.descricao ?? ''),
      [pdfReais(inteiro(l.valor_centavos)), l.tipo === 'entrada' ? PDF_VERDE : PDF_VERMELHO],
      String(l.placa ?? ''),
      String(l.motorista ?? ''),
      l.viagem_origem ? `${l.viagem_origem} > ${l.viagem_destino}` : '',
      l.litros !== null && l.litros !== '' ? pdfNumero(parseFloat(l.litros), 2) : '',
      l.km !== null && l.km !== '' ? pdfNumero(parseFloat(l.km)) : '',
      String(l.lugar ?? ''),
      String(l.cliente ?? ''),
      String(l.pagamento ?? ''),
      String(l.observacao ?? ''),
    ]),
    'Nenhum lançamento encontrado.'
  );
}

async function enviaPdf(pdf, nome) {
  const geradoEm = agora().slice(0, 16).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
  pdf.emCadaPagina((p, n, total) => {
    const y = PDF_ALTURA - PDF_MARGEM + 6;
    p.texto(PDF_MARGEM, y, `Gerado em ${geradoEm}`, 7, false, PDF_CINZA);
    p.celula(PDF_MARGEM, y, PDF_LARGURA - 2 * PDF_MARGEM, `Página ${n} de ${total}`, 7, false, true, PDF_CINZA);
  });
  return new Response(await pdf.gera(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function rotaPdf() {
  await exigeAdmin();
  const q = ctx().q;
  const [where, args] = await filtrosLancamento();
  const itens = await todas(`${SQL_LANCAMENTO} ${where} ORDER BY l.data, l.id`, args);

  let de;
  let ate;
  if (!vazio(q.mes)) {
    [de, ate] = limitesDoMes(mesValido(q.mes));
  } else {
    de = q.de ?? (itens[0]?.data ?? '');
    ate = q.ate ?? (itens.length ? itens[itens.length - 1].data : '');
  }
  const periodo = de || ate ? `  ·  Período: ${pdfData(de)} a ${pdfData(ate)}` : '';

  let entradas = 0;
  let saidas = 0;
  for (const l of itens) {
    if (l.tipo === 'entrada') entradas += inteiro(l.valor_centavos);
    else saidas += inteiro(l.valor_centavos);
  }

  const pdf = new Pdf();
  pdf.novaPagina();
  pdf.cabecalho('Lançamentos', NOME_SISTEMA + periodo);
  pdf.indicadores([
    ['Entradas', pdfReais(entradas), PDF_VERDE],
    ['Saídas', pdfReais(saidas), PDF_VERMELHO],
    ['Saldo', pdfReais(entradas - saidas), pdfCorSaldo(entradas - saidas)],
    ['Lançamentos', String(itens.length), PDF_TINTA],
  ]);
  pdf.y += 6;
  pdfTabelaLancamentos(pdf, itens);
  return enviaPdf(pdf, `lancamentos-${hoje()}.pdf`);
}

async function rotaPdfPanorama() {
  await exigeAdmin();
  const [deMes, ateMes] = periodoPanorama();
  const d = await dadosPanorama(deMes, ateMes);
  const a = d.atual;
  const varios = d.meses.length > 1;

  const pdf = new Pdf();
  pdf.novaPagina();
  pdf.cabecalho('Panorama', `${NOME_SISTEMA}  ·  ${periodoPorExtenso(deMes, ateMes)}`);

  pdf.indicadores([
    ['Entradas (fretes)', pdfReais(a.entradas_centavos), PDF_VERDE],
    ['Saídas (gastos)', pdfReais(a.saidas_centavos), PDF_VERMELHO],
    ['Saldo', pdfReais(a.saldo_centavos), pdfCorSaldo(a.saldo_centavos)],
    ['Lançamentos', String(a.qtd), PDF_TINTA],
    ['Viagens abertas hoje', String(d.viagens_abertas), PDF_TINTA],
  ]);
  const litros = d.litros;
  const comMovimento = d.meses.filter((m) => m.qtd > 0).length || 1;
  pdf.indicadores([
    ['Combustível', pdfReais(d.combustivel_centavos), PDF_TINTA],
    ['Litros', pdfNumero(litros, 2), PDF_TINTA],
    ['Preço médio do litro', litros > 0 ? pdfReais(Math.round(d.combustivel_centavos / litros)) : '-', PDF_TINTA],
    ['A receber hoje', pdfReais(d.a_receber.a_receber_centavos), PDF_TINTA],
    ...(varios ? [['Saldo médio por mês', pdfReais(Math.round(a.saldo_centavos / comMovimento)),
      pdfCorSaldo(a.saldo_centavos)]] : []),
  ]);

  const periodoAnterior = periodoPorExtenso(d.anterior_de, d.anterior_ate);
  const diferenca = a.saldo_centavos - d.anterior.saldo_centavos;
  pdf.texto(PDF_MARGEM, pdf.y + 4, d.anterior.qtd
    ? `Comparado a ${periodoAnterior} (saldo de ${pdfReais(d.anterior.saldo_centavos)}): `
      + pdfReais(Math.abs(diferenca)) + (diferenca >= 0 ? ' melhor.' : ' pior.')
    : `Sem lançamentos em ${periodoAnterior} para comparar.`, 8, false, PDF_CINZA);
  pdf.y += 10;

  if (varios) {
    pdf.secao('Mês a mês');
    pdf.tabela(
      [['Mês', 130], ['Entradas', 100, true], ['Saídas', 100, true], ['Saldo', 100, true], ['Lançamentos', 70, true]],
      d.meses.map((m) => [
        mesPorExtenso(m.mes),
        pdfReais(m.entradas_centavos),
        pdfReais(m.saidas_centavos),
        [pdfReais(m.saldo_centavos), pdfCorSaldo(m.saldo_centavos)],
        String(m.qtd),
      ])
    );
  }

  pdf.secao('Por caminhão');
  pdf.tabela(
    [['Caminhão', 150], ['Entradas', 85, true], ['Saídas', 85, true], ['Saldo', 85, true],
      ['Combustível', 85, true], ['Litros', 60, true], ['R$/litro', 60, true], ['Km', 60, true], ['Km/litro', 60, true]],
    d.por_caminhao.map((c) => {
      const lt = parseFloat(c.litros);
      const km = inteiro(c.km_rodados);
      return [
        c.placa + (c.apelido ? ' - ' + c.apelido : ''),
        pdfReais(inteiro(c.entradas_centavos)),
        pdfReais(inteiro(c.saidas_centavos)),
        [pdfReais(c.saldo_centavos), pdfCorSaldo(c.saldo_centavos)],
        pdfReais(inteiro(c.combustivel_centavos)),
        lt ? pdfNumero(lt, 2) : '-',
        lt ? pdfReais(Math.round(inteiro(c.combustivel_centavos) / lt)) : '-',
        km ? pdfNumero(km) : '-',
        km && lt ? pdfNumero(km / lt, 2) : '-',
      ];
    })
  );

  const porCategoria = (itens, total, rotulo) => {
    pdf.tabela(
      [[rotulo, 200], ['Lançamentos', 70, true], ['Total', 100, true], ['% do total', 70, true]],
      itens.map((i) => [
        String(i.nome),
        String(i.qtd),
        pdfReais(inteiro(i.total_centavos)),
        total ? pdfNumero(inteiro(i.total_centavos) / total * 100, 1) + '%' : '-',
      ])
    );
  };
  pdf.secao('Saídas por categoria');
  porCategoria(d.saidas_por_categoria, a.saidas_centavos, 'Categoria');
  pdf.secao('Entradas por tipo de frete');
  porCategoria(d.entradas_por_categoria, a.entradas_centavos, 'Tipo de frete');

  pdf.secao('Gastos por motorista');
  pdf.tabela(
    [['Motorista', 200], ['Lançamentos', 70, true], ['Total', 100, true]],
    d.por_motorista.map((i) => [String(i.nome), String(i.qtd), pdfReais(inteiro(i.total_centavos))])
  );

  pdf.novaPagina();
  pdf.secao('Lançamentos do período');
  pdfTabelaLancamentos(pdf, await todas(
    SQL_LANCAMENTO + ' WHERE l.data BETWEEN ? AND ? ORDER BY l.data, l.id',
    [limitesDoMes(deMes)[0], limitesDoMes(ateMes)[1]]
  ));

  return enviaPdf(pdf, `panorama-${deMes === ateMes ? deMes : `${deMes}-a-${ateMes}`}.pdf`);
}

// ---------------------------------------------------------------------------
// Comprovantes e notas (foto ou PDF), guardados no banco como no PHP com PostgreSQL.
// ---------------------------------------------------------------------------

async function guardaComprovante(nome, bytes) {
  await consulta('INSERT INTO comprovantes (nome, dados, criado_em) VALUES (?, decode(?, \'hex\'), ?)',
    [nome, hex(bytes), agora()]);
}

async function leComprovante(nome) {
  const dados = await umValor("SELECT encode(dados, 'hex') FROM comprovantes WHERE nome = ?", [nome]);
  return dados === null ? null : deHex(String(dados));
}

async function apagaComprovante(nome) {
  await consulta('DELETE FROM comprovantes WHERE nome = ?', [nome]);
}

function tipoDoArquivo(b) {
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
    && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png';
  const ascii = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (b.length >= 4 && ascii(0, 4) === '%PDF') return 'pdf';
  return null;
}

// A foto já chega reduzida (lado maior até 1600px) e regravada pelo app (assets/app.js),
// o que também descarta os metadados (EXIF, GPS). Aqui só confere o tipo e guarda.
async function rotaEnviaComprovante() {
  await exigeLogin();
  let arquivo = null;
  try {
    arquivo = (await ctx().req.formData()).get('foto');
  } catch {
    arquivo = null;
  }
  if (!arquivo || typeof arquivo === 'string') {
    throw new ErroDeUso('Não foi possível receber a foto. Tente de novo.');
  }
  if (arquivo.size > 8 * 1024 * 1024) throw new ErroDeUso('A foto é muito grande (máximo 8 MB).');
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const extensao = tipoDoArquivo(bytes);
  if (extensao === null) throw new ErroDeUso('Envie uma foto (JPG, PNG, WEBP) ou um PDF.');

  const nome = agora().replace(/\D/g, '') + '-' + hex(aleatorio(5)) + '.' + extensao;
  await guardaComprovante(nome, bytes);
  return { comprovante: nome };
}

// O arquivo é do motorista se está num lançamento dele, numa nota que ele enviou ou numa nota
// de viagem dele. Arquivo recém-enviado, ainda sem lançamento, fica visível (o nome é aleatório).
async function motoristaVeArquivo(eu, arquivo) {
  const donos = [
    ...await todas('SELECT usuario_id AS dono, NULL AS motorista FROM lancamentos WHERE comprovante = ?', [arquivo]),
    ...await todas(
      `SELECT n.usuario_id AS dono, v.usuario_id AS motorista
         FROM notas_fiscais n LEFT JOIN viagens v ON v.id = n.viagem_id
        WHERE n.arquivo = ?`,
      [arquivo]
    ),
  ];
  if (!donos.length) return true;
  return donos.some((d) => inteiro(d.dono) === eu.id || inteiro(d.motorista) === eu.id);
}

async function arquivoEmUso(arquivo) {
  return Number(await umValor('SELECT COUNT(*) FROM lancamentos WHERE comprovante = ?', [arquivo]))
    + Number(await umValor('SELECT COUNT(*) FROM notas_fiscais WHERE arquivo = ?', [arquivo])) > 0;
}

async function rotaBaixaComprovante() {
  const eu = await exigeLogin();
  const arquivo = String(ctx().q.arquivo ?? '');
  if (!ARQUIVO_VALIDO.test(arquivo) || arquivo.includes('..')) throw new ErroDeUso('Arquivo inválido.');
  if (eu.papel !== 'admin' && !(await motoristaVeArquivo(eu, arquivo))) {
    throw new ErroDeUso('Sem acesso a este comprovante.', 403);
  }
  const conteudo = await leComprovante(arquivo);
  if (conteudo === null) throw new ErroDeUso('Comprovante não encontrado.', 404);
  const tipos = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
  const extensao = arquivo.includes('.') ? arquivo.split('.').pop().toLowerCase() : '';
  return new Response(conteudo, {
    headers: {
      'Content-Type': tipos[extensao] ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${arquivo}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ---------------------------------------------------------------------------
// Receita do negócio: todos consultam; só o proprietário lança e altera (em Lançamentos).
// ---------------------------------------------------------------------------

async function rotaReceita(){const eu=await exigeLogin(),q=ctx().q;if(eu.papel==='admin')return dadosPanorama(...periodoPanorama());const atual=hoje().slice(0,7),anterior=mesAnterior(atual),mes=mesValido(q.mes||q.de||atual);if(![atual,anterior].includes(mes)||['mes','de','ate'].some(k=>q[k]&&q[k]!==mes))throw new ErroDeUso('Disponível somente para o mês atual e anterior.',403);const r=await dadosPanorama(mes,mes);delete r.por_motorista;if(mes===anterior){delete r.anterior;delete r.anterior_de;delete r.anterior_ate;}return r;}

// ---------------------------------------------------------------------------
// Notas fiscais dos clientes (foto ou PDF).
// ---------------------------------------------------------------------------

const SQL_NOTA = "\r\n    SELECT n.*, u.nome AS enviado_por, cm.placa, cm.apelido AS caminhao_apelido,\r\n           v.origem AS viagem_origem, v.destino AS viagem_destino, v.inicio AS viagem_inicio, v.fim AS viagem_fim,\r\n           COALESCE(cl.nome, n.cliente) AS cliente_atual,\r\n           (SELECT MIN(rb.id) FROM recebiveis rb WHERE rb.nota_fiscal_id = n.id) AS recebivel_id\r\n      FROM notas_fiscais n\r\n      JOIN usuarios u ON u.id = n.usuario_id\r\n      LEFT JOIN caminhoes cm ON cm.id = n.caminhao_id\r\n      LEFT JOIN viagens v ON v.id = n.viagem_id\r\n      LEFT JOIN clientes cl ON cl.id = v.cliente_id";

async function rotaNotas() {
  const eu = await exigeLogin();
  const q = ctx().q;
  const cond = [];
  const args = [];
  if (eu.papel !== 'admin') {
    cond.push('(n.usuario_id = ? OR v.usuario_id = ?)');
    args.push(eu.id, eu.id);
  } else if (!vazio(q.usuario_id)) {
    cond.push('n.usuario_id = ?');
    args.push(campoId(q.usuario_id, 'Enviada por'));
  }
  if (!vazio(q.mes)) {
    const [de, ate] = limitesDoMes(mesValido(q.mes));
    cond.push('n.data BETWEEN ? AND ?');
    args.push(de, ate);
  }
  if (!vazio(q.viagem_id)) {
    cond.push('n.viagem_id = ?');
    args.push(campoId(q.viagem_id, 'Viagem'));
  }
  if ((q.sem_cobranca ?? '') === '1') {
    cond.push('NOT EXISTS (SELECT 1 FROM recebiveis rb WHERE rb.nota_fiscal_id = n.id)');
  }
  const busca = campoTexto(q.busca ?? null, 'Busca', false, 60);
  if (busca !== null) {
    cond.push('(n.numero ILIKE ? OR n.cliente ILIKE ? OR n.observacao ILIKE ?)');
    args.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  const [limite, offset] = paginacao(q);
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  return (await todas(`${SQL_NOTA} ${where} ORDER BY n.data DESC, n.id DESC LIMIT ${limite} OFFSET ${offset}`, args))
    .map((n) => anotaPrazo(eu, n, 'usuario_id'));
}

async function notaAlteravel(id) {
  const eu = await exigeLogin();
  const n = await umaLinha(SQL_NOTA + ' WHERE n.id = ?', [id]);
  if (!n) throw new ErroDeUso('Nota fiscal não encontrada.', 404);
  exigePrazoDoMotorista(eu, n, 'usuario_id', 'esta nota');
  return n;
}

async function dadosNota(c){const arquivo=campoTexto(c.arquivo??null,'Arquivo da nota',false,120);if(!arquivo||!ARQUIVO_VALIDO.test(arquivo)||arquivo.includes('..'))throw new ErroDeUso('Anexe uma foto ou PDF válido.');const viagem_id=campoId(c.viagem_id??null,'Viagem'),v=viagem_id?await viagemAcessivel(viagem_id):null,eu=await exigeLogin(),cliente=v?.cliente_id?await umValor('SELECT nome FROM clientes WHERE id=?',[v.cliente_id]):null;return {arquivo,numero:campoTexto(c.numero??null,'Número da nota',false,40),cliente:campoTexto(c.cliente??cliente,'Cliente',false,90),data:campoData(c.data??hoje(),'Data de emissão'),valor_centavos:campoCentavosOpcional(c.valor??null,'Valor da nota'),viagem_id,caminhao_id:campoId(c.caminhao_id??v?.caminhao_id??eu.caminhao_padrao_id,'Caminhão'),observacao:campoTexto(c.observacao??null,'Observação',false,500)};}

function resumoDaNota(n) {
  return 'NF ' + (n.numero || 'sem número') + (n.cliente ? ' - ' + n.cliente : '')
    + (n.valor_centavos !== null && n.valor_centavos !== undefined ? ' · ' + pdfReais(inteiro(n.valor_centavos)) : '')
    + ' · ' + pdfData(n.data);
}

async function rotaNovaNota() {
  const eu = await exigeLogin();
  const dados = await dadosNota(await corpoJson());
  dados.usuario_id = eu.id;
  dados.criado_em = instanteCadastro();
  const id = await insere('notas_fiscais', dados);
  await registraAviso(eu, 'enviou', 'nota', null, resumoDaNota(dados));
  return anotaPrazo(eu, await umaLinha(SQL_NOTA + ' WHERE n.id = ?', [id]), 'usuario_id');
}

async function rotaEditaNota(id){const eu=await exigeLogin(),atual=await notaAlteravel(id),c=await corpoJson();const d=await dadosNota({...atual,valor:atual.valor_centavos==null?'':(Number(atual.valor_centavos)/100).toFixed(2),...c});d.atualizado_em=agora();await atualiza('notas_fiscais',id,d);if(d.arquivo!==atual.arquivo&&!await arquivoEmUso(atual.arquivo))await apagaComprovante(atual.arquivo);await registraAviso(eu,'editou','nota',null,resumoDaNota(d));return anotaPrazo(eu,await umaLinha(SQL_NOTA+' WHERE n.id=?',[id]),'usuario_id');}

async function rotaExcluiNota(id) {
  const eu = await exigeLogin();
  const atual = await notaAlteravel(id);
  await consulta('UPDATE recebiveis SET nota_fiscal_id = NULL WHERE nota_fiscal_id = ?', [id]);
  await consulta('DELETE FROM notas_fiscais WHERE id = ?', [id]);
  if (!(await arquivoEmUso(atual.arquivo))) await apagaComprovante(atual.arquivo);
  await registraAviso(eu, 'excluiu', 'nota', null, resumoDaNota(atual));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fretes a receber: valor combinado com o cliente e as partes já recebidas.
// ---------------------------------------------------------------------------

const SQL_RECEBIDO = "(SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l WHERE l.recebivel_id = r.id)";

const SQL_RECEBIVEL = `
    SELECT r.*, c.nome AS categoria, cm.placa, cm.apelido AS caminhao_apelido,
           v.origem AS viagem_origem, v.destino AS viagem_destino,
           n.numero AS nota_numero, n.arquivo AS nota_arquivo,
           ${SQL_RECEBIDO} AS recebido_centavos,
           (SELECT COUNT(*) FROM lancamentos l WHERE l.recebivel_id = r.id) AS qtd_recebimentos,
           (SELECT MAX(l.data) FROM lancamentos l WHERE l.recebivel_id = r.id) AS ultimo_recebimento
      FROM recebiveis r
      JOIN categorias c ON c.id = r.categoria_id
      LEFT JOIN caminhoes cm ON cm.id = r.caminhao_id
      LEFT JOIN viagens v ON v.id = r.viagem_id
      LEFT JOIN notas_fiscais n ON n.id = r.nota_fiscal_id`;

function situacaoRecebivel(r) {
  const total = inteiro(r.valor_centavos);
  const recebido = inteiro(r.recebido_centavos);
  r.valor_centavos = total;
  r.recebido_centavos = recebido;
  r.restante_centavos = Math.max(0, total - recebido);
  r.situacao = recebido <= 0 ? 'pendente' : (recebido >= total ? 'recebido' : 'parcial');
  r.vencido = r.situacao !== 'recebido' && !vazio(r.vencimento)
    && String(r.vencimento).slice(0, 10) < hoje();
  return r;
}

async function totaisAReceber() {
  const totais = { a_receber_centavos: 0, vencido_centavos: 0, qtd_abertos: 0 };
  const linhas = await todas(`SELECT r.valor_centavos, r.vencimento, ${SQL_RECEBIDO} AS recebido_centavos FROM recebiveis r`);
  for (const linha of linhas) {
    const r = situacaoRecebivel(linha);
    if (r.situacao === 'recebido') continue;
    totais.qtd_abertos++;
    totais.a_receber_centavos += r.restante_centavos;
    if (r.vencido) totais.vencido_centavos += r.restante_centavos;
  }
  return totais;
}

async function rotaRecebiveis() {
  await exigeAdmin();
  const q = ctx().q;
  const mes = mesValido(q.mes ?? '');
  const [de, ate] = limitesDoMes(mes);
  const cond = [];
  const args = [];
  const busca = campoTexto(q.busca ?? null, 'Busca', false, 60);
  if (busca !== null) {
    cond.push('(r.cliente ILIKE ? OR r.descricao ILIKE ? OR n.numero ILIKE ?)');
    args.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const status = q.status ?? 'abertos';
  const itens = (await todas(`${SQL_RECEBIVEL} ${where} ORDER BY r.data DESC, r.id DESC`, args))
    .map(situacaoRecebivel)
    .filter((r) => status === 'todos'
      || (status === 'recebidos' ? r.situacao === 'recebido' : r.situacao !== 'recebido'));
  const somaEntradas = async (extra) => inteiro(await umValor(
    `SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
      WHERE tipo = 'entrada' AND data BETWEEN ? AND ? ${extra}`,
    [de, ate]
  ));
  return {
    mes,
    itens,
    recebido_mes_centavos: await somaEntradas(''),
    recebido_cobrancas_mes_centavos: await somaEntradas('AND recebivel_id IS NOT NULL'),
    faturado_mes_centavos: inteiro(await umValor(
      'SELECT COALESCE(SUM(valor_centavos), 0) FROM recebiveis WHERE data BETWEEN ? AND ?',
      [de, ate]
    )),
    ...(await totaisAReceber()),
  };
}

async function recebivelExistente(id) {
  const r = await umaLinha(SQL_RECEBIVEL + ' WHERE r.id = ?', [id]);
  if (!r) throw new ErroDeUso('Frete a receber não encontrado.', 404);
  return situacaoRecebivel(r);
}

async function rotaUmRecebivel(id) {
  const eu = await exigeAdmin();
  const r = await recebivelExistente(id);
  r.recebimentos = (await todas(SQL_LANCAMENTO + ' WHERE l.recebivel_id = ? ORDER BY l.data, l.id', [id]))
    .map((l) => anotaPrazo(eu, l, 'criado_por'));
  return r;
}

async function dadosRecebivel(corpo, id = null) {
  const categoriaId = campoId(corpo.categoria_id ?? null, 'Tipo de frete', true);
  const cat = await umaLinha('SELECT * FROM categorias WHERE id = ?', [categoriaId]);
  if (!cat || cat.tipo !== 'entrada') throw new ErroDeUso('Escolha um tipo de frete (categoria de entrada).');
  const viagemId = campoId(corpo.viagem_id ?? null, 'Viagem');
  if (viagemId !== null && await umValor('SELECT id FROM viagens WHERE id = ?', [viagemId]) === null) {
    throw new ErroDeUso('Viagem não encontrada.');
  }
  const notaId = campoId(corpo.nota_fiscal_id ?? null, 'Nota fiscal');
  if (notaId !== null) {
    if (await umValor('SELECT id FROM notas_fiscais WHERE id = ?', [notaId]) === null) {
      throw new ErroDeUso('Nota fiscal não encontrada.');
    }
    const outro = await umValor('SELECT id FROM recebiveis WHERE nota_fiscal_id = ? AND id <> ?', [notaId, id ?? 0]);
    if (outro !== null) throw new ErroDeUso('Essa nota fiscal já está em outro frete a receber.');
  }
  const data = campoData(corpo.data ?? null, 'Data do frete');
  const vencimento = campoData(corpo.vencimento ?? null, 'Vencimento', false);
  if (vencimento !== null && vencimento < data) {
    throw new ErroDeUso('O vencimento não pode ser antes da data do frete.');
  }
  return {
    cliente: campoTexto(corpo.cliente ?? null, 'Cliente', true, 90),
    descricao: campoTexto(corpo.descricao ?? null, 'Descrição', Boolean(Number(cat.pede_descricao)), 140),
    categoria_id: categoriaId,
    valor_centavos: campoCentavos(corpo.valor ?? null, 'Valor do frete'),
    data,
    vencimento,
    viagem_id: viagemId,
    caminhao_id: campoId(corpo.caminhao_id ?? null, 'Caminhão'),
    nota_fiscal_id: notaId,
    observacao: campoTexto(corpo.observacao ?? null, 'Observação', false, 500),
  };
}

async function rotaNovoRecebivel() {
  const eu = await exigeAdmin();
  const dados = await dadosRecebivel(await corpoJson());
  dados.criado_em = instanteCadastro();
  dados.criado_por = eu.id;
  return recebivelExistente(await insere('recebiveis', dados));
}

async function rotaEditaRecebivel(id) {
  await exigeAdmin();
  const atual = await recebivelExistente(id);
  const dados = await dadosRecebivel(await corpoJson(), id);
  if (dados.valor_centavos < atual.recebido_centavos) {
    throw new ErroDeUso(
      `O valor do frete não pode ficar menor que o já recebido (${pdfReais(atual.recebido_centavos)}).`
    );
  }
  await atualiza('recebiveis', id, dados);
  return recebivelExistente(id);
}

// Os recebimentos continuam como entradas; só deixam de apontar para este frete.
async function rotaExcluiRecebivel(id) {
  await exigeAdmin();
  await recebivelExistente(id);
  await consulta('UPDATE lancamentos SET recebivel_id = NULL WHERE recebivel_id = ?', [id]);
  await consulta('DELETE FROM recebiveis WHERE id = ?', [id]);
  return { ok: true };
}

// Registra uma parte (ou o total) recebida: vira um lançamento de entrada ligado ao frete.
async function rotaRecebeParte(id) {
  await exigeAdmin();await consulta('SELECT id FROM recebiveis WHERE id=? FOR UPDATE',[id]);
  const eu = await exigeAdmin();
  const r = await recebivelExistente(id);
  const corpo = await corpoJson();
  const valor = campoCentavos(corpo.valor ?? null, 'Valor recebido');
  if (valor > r.restante_centavos) {
    throw new ErroDeUso(
      `O valor é maior do que falta receber (${pdfReais(r.restante_centavos)}). `
      + 'Se o cliente pagou a mais, aumente antes o valor do frete.'
    );
  }
  const comprovante = campoTexto(corpo.comprovante ?? null, 'Comprovante', false, 120);
  if (comprovante !== null && !ARQUIVO_VALIDO.test(comprovante)) throw new ErroDeUso('Comprovante inválido.');
  await insere('lancamentos', {
    tipo: 'entrada',
    usuario_id: eu.id,
    viagem_id: r.viagem_id,
    caminhao_id: r.caminhao_id,
    categoria_id: r.categoria_id,
    descricao: r.descricao,
    valor_centavos: valor,
    data: campoData(corpo.data ?? hoje(), 'Dia do recebimento'),
    pagamento: campoTexto(corpo.pagamento ?? null, 'Forma de pagamento', false, 30),
    cliente: r.cliente,
    observacao: campoTexto(corpo.observacao ?? null, 'Observação', false, 500),
    comprovante,
    recebivel_id: id,
    criado_em: instanteCadastro(),
    criado_por: eu.id,
  });
  return recebivelExistente(id);
}

// ---------------------------------------------------------------------------
// Diárias dos motoristas: um registro por dia trabalhado.
// ---------------------------------------------------------------------------

const SQL_DIARIA = "\r\n    SELECT d.*, u.nome AS motorista, v.origem AS viagem_origem, v.destino AS viagem_destino,\r\n           l.data AS pago_em\r\n      FROM diarias d\r\n      JOIN usuarios u ON u.id = d.usuario_id\r\n      LEFT JOIN viagens v ON v.id = d.viagem_id\r\n      LEFT JOIN lancamentos l ON l.id = d.lancamento_id";

function anotaDiaria(eu, d) {
  anotaPrazo(eu, d, 'criado_por');
  d.pago = d.lancamento_id !== null;
  if (d.pago) {
    d.pode_alterar = false;
    d.segundos_para_alterar = eu.papel === 'admin' ? null : 0;
  }
  return d;
}

async function rotaDiarias(){
 const eu=await exigeLogin(),q=ctx().q,mes=mesValido(q.mes??''),[de,ate]=limitesDoMes(mes),pending=q.escopo==='pendentes',user=eu.papel!=='admin'?eu.id:campoId(q.usuario_id??null,'Motorista'),cond=pending?['d.lancamento_id IS NULL']:['d.data BETWEEN ? AND ?'],args=pending?[]:[de,ate];
 if(user){cond.push('d.usuario_id=?');args.push(user);}
 const itens=(await todas(SQL_DIARIA+' WHERE '+cond.join(' AND ')+' ORDER BY d.data DESC,u.nome',args)).map(d=>anotaDiaria(eu,d));
 const people=user?await todas('SELECT id,nome,valor_diaria_centavos FROM usuarios WHERE id=?',[user]):await todas("SELECT id,nome,valor_diaria_centavos FROM usuarios WHERE (papel='motorista' AND ativo=1) OR id IN (SELECT usuario_id FROM diarias WHERE data BETWEEN ? AND ? OR lancamento_id IS NULL) ORDER BY nome",[de,ate]);
 const motoristas=people.map(p=>({usuario_id:Number(p.id),nome:p.nome,valor_diaria_centavos:p.valor_diaria_centavos==null?null:Number(p.valor_diaria_centavos),dias:0,total_centavos:0,pago_centavos:0,pendente_centavos:0,pendente_geral_centavos:0,dias_pendentes_geral:0}));
 for(const d of itens){const m=motoristas.find(m=>m.usuario_id===Number(d.usuario_id));if(!m)continue;m.dias++;m.total_centavos+=Number(d.valor_centavos);m[d.pago?'pago_centavos':'pendente_centavos']+=Number(d.valor_centavos);}
 for(const r of await todas('SELECT usuario_id,COUNT(*) AS dias,SUM(valor_centavos) AS total FROM diarias WHERE lancamento_id IS NULL GROUP BY usuario_id')){const m=motoristas.find(m=>m.usuario_id===Number(r.usuario_id));if(m){m.pendente_geral_centavos=Number(r.total);m.dias_pendentes_geral=Number(r.dias);}}
 const totais={dias:0,total_centavos:0,pago_centavos:0,pendente_centavos:0};for(const m of motoristas)for(const k in totais)totais[k]+=m[k];
 const pagamentos=await todas('SELECT l.id,l.usuario_id,u.nome AS motorista,l.valor_centavos,l.data,l.pagamento,l.criado_em,(SELECT COUNT(*) FROM diarias d WHERE d.lancamento_id=l.id) AS dias FROM lancamentos l JOIN usuarios u ON u.id=l.usuario_id WHERE l.data BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM diarias d WHERE d.lancamento_id=l.id)'+(user?' AND l.usuario_id=?':'')+' ORDER BY l.data DESC,l.id DESC',user?[de,ate,user]:[de,ate]);
 return {mes,itens,motoristas,totais,pagamentos};
}

function diaPermitido(eu,data){if(eu.papel!=='admin' && data>hoje())throw new ErroDeUso('Não dá para registrar diária de um dia que ainda não chegou.');}

async function rotaNovasDiarias(){
 const eu=await exigeLogin(),c=await corpoJson(),user=eu.papel==='admin'&&c.usuario_id?campoId(c.usuario_id,'Motorista'):eu.id,m=await umaLinha('SELECT id,nome,valor_diaria_centavos FROM usuarios WHERE id=? AND ativo=1',[user]);if(!m)throw new ErroDeUso('Motorista não encontrado.');
 const de=campoData(c.de??null,'Dia trabalhado'),ate=campoData(c.ate??null,'Até o dia',false)||de,dias=diasEntre(de,ate)+1;if(dias<1||dias>62)throw new ErroDeUso('Registre no máximo 62 dias, em ordem de datas.');diaPermitido(eu,ate);
 const valor=(eu.papel==='admin'?campoCentavosOpcional(c.valor??null,'Valor da diária'):null)??Number(m.valor_diaria_centavos||0),viagem=campoId(c.viagem_id??null,'Viagem');if(viagem)await viagemAcessivel(viagem);
 const obs=campoTexto(c.observacao??null,'Observação',false,200),semana=c.dias_semana??[0,1,2,3,4,5,6];if(!Array.isArray(semana)||!semana.length||semana.some(d=>!/^\d$/.test(String(d))||Number(d)>6))throw new ErroDeUso('Escolha os dias da semana trabalhados.');
 let criadas=0,consideradas=0;const ids_por_data={};for(let i=0;i<dias;i++){const data=somaDias(de,i);if(!semana.map(Number).includes(new Date(data+'T12:00:00Z').getUTCDay()))continue;consideradas++;const r=await consulta('INSERT INTO diarias (usuario_id,data,valor_centavos,viagem_id,observacao,criado_em,criado_por) VALUES (?,?,?,?,?,?,?) ON CONFLICT (usuario_id,data) DO NOTHING RETURNING id',[user,data,valor,viagem,obs,instanteCadastro(),eu.id]);if(r.rowCount)criadas++;ids_por_data[data]=Number(await umValor('SELECT id FROM diarias WHERE usuario_id=? AND data=?',[user,data]));}
 if(criadas)await registraAviso(eu,'registrou','diaria',null,`${criadas} diária(s) · ${pdfData(de)}`);return {criadas,ja_existiam:consideradas-criadas,ids_por_data};
}

async function diariaAlteravel(id){const eu=await exigeLogin(),d=await umaLinha('SELECT * FROM diarias WHERE id=?',[id]);if(!d)throw new ErroDeUso('Diária não encontrada.',404);exigePrazoDoMotorista(eu,d,'criado_por','esta diária');if(d.lancamento_id!==null&&eu.papel!=='admin')throw new ErroDeUso('Esta diária já foi paga. Solicite a correção ao proprietário.');return d;}

async function rotaEditaDiaria(id){const eu=await exigeLogin(),d=await diariaAlteravel(id),c=await corpoJson(),data=campoData(c.data??null,'Dia trabalhado');diaPermitido(eu,data);if(await umValor('SELECT id FROM diarias WHERE usuario_id=? AND data=? AND id<>?',[d.usuario_id,data,id]))throw new ErroDeUso('Já existe uma diária deste motorista nesse dia.');const viagem=campoId(c.viagem_id??null,'Viagem');if(viagem)await viagemAcessivel(viagem);const campos={data,viagem_id:viagem,observacao:campoTexto(c.observacao??null,'Observação',false,200)};if(eu.papel==='admin')campos.valor_centavos=campoCentavosOpcional(c.valor??null,'Valor da diária')??Number(d.valor_centavos);await atualiza('diarias',id,campos);if(d.lancamento_id)await recalculaPagamentoDiarias(d.lancamento_id);return {ok:true};}

// Muda a diária combinada do motorista direto pela aba Diárias; pode levar junto as que ainda não foram pagas.
async function rotaValorDiaria(usuarioId) {
  await exigeAdmin();
  const corpo = await corpoJson();
  if (await umValor('SELECT id FROM usuarios WHERE id = ?', [usuarioId]) === null) {
    throw new ErroDeUso('Motorista não encontrado.', 404);
  }
  const valor = campoCentavosOpcional(corpo.valor_diaria ?? null, 'Valor da diária');
  await atualiza('usuarios', usuarioId, { valor_diaria_centavos: valor });
  let atualizadas = 0;
  if (valor !== null && campoSimNao(corpo.aplicar_pendentes ?? null, false)) {
    atualizadas = (await consulta(
      'UPDATE diarias SET valor_centavos = ? WHERE usuario_id = ? AND lancamento_id IS NULL', [valor, usuarioId]
    )).rowCount;
  }
  return { ok: true, atualizadas };
}

async function rotaExcluiDiaria(id){const eu=await exigeLogin(),d=await diariaAlteravel(id);await consulta('DELETE FROM diarias WHERE id=?',[id]);if(d.lancamento_id)await recalculaPagamentoDiarias(d.lancamento_id);await registraAviso(eu,'excluiu','diaria',null,'Diária de '+pdfData(d.data));return {ok:true};}

// Paga de uma vez as diárias pendentes do motorista no mês: vira uma saída em Lançamentos.
async function rotaPagaDiarias(){
 const eu=await exigeAdmin(),c=await corpoJson(),user=campoId(c.usuario_id??null,'Motorista',true);if(!await umValor('SELECT id FROM usuarios WHERE id=? FOR UPDATE',[user]))throw new ErroDeUso('Motorista não encontrado.');
 const category=campoId(c.categoria_id??null,'Categoria do pagamento',true);if(!await umValor("SELECT id FROM categorias WHERE id=? AND tipo='saida'",[category]))throw new ErroDeUso('Escolha uma categoria de gasto para o pagamento.');
 const mes=mesValido(c.mes??''),[de,ate]=limitesDoMes(mes);let where=' AND data BETWEEN ? AND ?',args=[user,de,ate],ids=null;
 if(c.ids!==undefined){if(!Array.isArray(c.ids)||!c.ids.length||c.ids.length>1000)throw new ErroDeUso('Selecione as diárias que serão pagas.');ids=[...new Set(c.ids.map(v=>campoId(v,'Diária',true)))];where=' AND id IN ('+ids.map(()=>'?').join(',')+')';args=[user,...ids];}
 const pending=await todas('SELECT id,valor_centavos FROM diarias WHERE usuario_id=? AND lancamento_id IS NULL'+where,args);if(ids&&pending.length!==ids.length)throw new ErroDeUso('Uma das diárias já foi paga ou pertence a outro motorista. Atualize a lista.');if(!pending.length)throw new ErroDeUso('Nenhuma diária pendente deste motorista.');if(pending.some(d=>Number(d.valor_centavos)<=0))throw new ErroDeUso('Defina o valor das diárias antes de pagar.');
 const total=pending.reduce((s,d)=>s+Number(d.valor_centavos),0),descricao=`Diárias de motorista (${pending.length} dias)`,id=await insere('lancamentos',{tipo:'saida',usuario_id:user,categoria_id:category,descricao,valor_centavos:total,data:campoData(c.data??hoje(),'Dia do pagamento'),pagamento:campoTexto(c.pagamento??null,'Forma de pagamento',false,30),observacao:campoTexto(c.observacao??null,'Observação',false,500),criado_em:instanteCadastro(),criado_por:eu.id});
 await consulta('UPDATE diarias SET lancamento_id=? WHERE id IN ('+pending.map(()=>'?').join(',')+')',[id,...pending.map(d=>d.id)]);await registraAviso(eu,'pagou','diaria',null,descricao+' · '+pdfReais(total),user);return {lancamento_id:id,total_centavos:total,dias:pending.length};
}



async function rotaClientes(){const eu=await exigeLogin();return eu.papel==='admin'?todas('SELECT c.*,(SELECT COUNT(*) FROM viagens v WHERE v.cliente_id=c.id) AS qtd_viagens FROM clientes c ORDER BY c.ativo DESC,c.nome'):todas('SELECT id,nome,ativo,criado_em FROM clientes WHERE ativo=1 ORDER BY nome');}

async function salvaCliente(id=null){
  await exigeAdmin();const c=await corpoJson(),d={};
  for(const [key,label,max] of [['nome','Nome do cliente',90],['cep','CEP',12],['logradouro','Endereço',140],['numero','Número',20],['complemento','Complemento',90],['bairro','Bairro',80],['cidade','Cidade',80],['uf','UF',2],['telefone','Telefone',30],['documento','CPF/CNPJ',30],['email','E-mail',120],['observacao','Observação',500]])d[key]=campoTexto(c[key]??null,label,key==='nome',max);
  if(d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))throw new ErroDeUso('Informe um e-mail válido.');
  if(await umValor('SELECT id FROM clientes WHERE LOWER(nome)=LOWER(?) AND id<>?',[d.nome,id||0]))throw new ErroDeUso('Já existe um cliente com esse nome.');
  d.ativo=String(c.ativo??'1')==='0'?0:1;
  if(id){if(!await umValor('SELECT id FROM clientes WHERE id=?',[id]))throw new ErroDeUso('Cliente não encontrado.',404);d.atualizado_em=agora();await atualiza('clientes',id,d);}
  else{id=await insere('clientes',{...d,criado_em:instanteCadastro()});}
  return umaLinha('SELECT * FROM clientes WHERE id=?',[id]);
}

async function excluiCliente(id){
  await exigeAdmin();
  const nome=await umValor('SELECT nome FROM clientes WHERE id=?',[id]);
  if(nome===null)throw new ErroDeUso('Cliente não encontrado.',404);
  if(Number(await umValor('SELECT COUNT(*) FROM viagens WHERE cliente_id=?',[id]))>0)throw new ErroDeUso(`O cliente ${nome} já tem viagens e não pode ser excluído sem perder esse histórico. Marque-o como "Arquivado" na situação do cadastro.`,409);
  await consulta('DELETE FROM clientes WHERE id=?',[id]);
  return {ok:true};
}

async function clienteDaViagem(c,atual=null){
  const nome=campoTexto(c.cliente_novo??null,'Novo cliente',false,90);
  if(nome){const existente=await umaLinha('SELECT id,ativo FROM clientes WHERE LOWER(nome)=LOWER(?)',[nome]);if(existente){if(!Number(existente.ativo))throw new ErroDeUso('Este cliente está arquivado. Reative em Clientes.');return Number(existente.id);}return insere('clientes',{nome,ativo:1,criado_em:instanteCadastro()});}
  const id=campoId(c.cliente_id??null,'Cliente');if(id){const row=await umaLinha('SELECT id,ativo FROM clientes WHERE id=?',[id]);if(!row || !Number(row.ativo)&&id!==Number(atual))throw new ErroDeUso('Escolha um cliente ativo.');}return id;
}

function valorOpcionalZero(v,label){if(v==null || String(v).trim()==='' || /^0+([,.]0+)?$/.test(String(v).trim()))return 0;return campoCentavos(v,label);}

async function financeiroViagem(id){const v=await umaLinha(SQL_VIAGEM+' WHERE v.id=?',[id]);if(!v)throw new ErroDeUso('Viagem não encontrada.',404);v.pendente_centavos=Math.max(0,Number(v.valor_frete_centavos)-Number(v.recebido_centavos));return v;}

async function bloqueiaViagem(id){await viagemAcessivel(id);return umaLinha('SELECT * FROM viagens WHERE id=? FOR UPDATE',[id]);}

async function defineFreteViagem(id,c){
  if(!Object.hasOwn(c,'valor_viagem'))return;
  const valor=valorOpcionalZero(c.valor_viagem,'Valor da viagem'),v=await financeiroViagem(id),fretes=await todas('SELECT * FROM recebiveis WHERE viagem_id=? ORDER BY id',[id]);
  if(fretes.length>1){if(valor!==Number(v.valor_frete_centavos))throw new ErroDeUso('Ajuste os fretes antigos individualmente.');return;}
  if(valor<Number(v.recebido_centavos))throw new ErroDeUso('O valor da viagem não pode ser menor que o valor já recebido.');
  let recebivel=fretes[0]?.id;
  if(recebivel)await atualiza('recebiveis',recebivel,{valor_centavos:valor,cliente:v.cliente||'Cliente não informado',data:v.inicio,caminhao_id:v.caminhao_id});
  else if(valor>0){const categoria=await umValor("SELECT id FROM categorias WHERE tipo='entrada' ORDER BY CASE WHEN nome='Outro frete' THEN 0 ELSE 1 END,id LIMIT 1");if(!categoria)throw new ErroDeUso('Cadastre uma categoria de entrada em Ajustes.');recebivel=await insere('recebiveis',{cliente:v.cliente||'Cliente não informado',descricao:(v.origem+' → '+v.destino).slice(0,140),categoria_id:categoria,valor_centavos:valor,data:v.inicio,viagem_id:id,caminhao_id:v.caminhao_id,criado_em:instanteCadastro(),criado_por:(await exigeLogin()).id});}
  if(recebivel)await consulta("UPDATE lancamentos SET recebivel_id=? WHERE viagem_id=? AND tipo='entrada' AND recebivel_id IS NULL",[recebivel,id]);
}

async function recebeNaViagem(id,c,campo='valor_pago'){
  const v=await financeiroViagem(id),eu=await exigeLogin();let valor=String(c.integral||'')==='1'?v.pendente_centavos:valorOpcionalZero(c[campo], 'Valor recebido');
  if(!valor)return;if(valor>v.pendente_centavos)throw new ErroDeUso('O pagamento ultrapassa o saldo pendente da viagem.');
  const data=campoData(c.data_pagamento??hoje(),'Dia do recebimento');
  for(const f of await todas('SELECT id FROM recebiveis WHERE viagem_id=? ORDER BY id',[id])){await consulta('SELECT id FROM recebiveis WHERE id=? FOR UPDATE',[f.id]);const r=await recebivelExistente(Number(f.id)),parte=Math.min(valor,Number(r.restante_centavos));if(parte<=0)continue;await insere('lancamentos',{tipo:'entrada',usuario_id:v.usuario_id,viagem_id:id,caminhao_id:v.caminhao_id,categoria_id:r.categoria_id,descricao:'Pagamento de viagem',valor_centavos:parte,data,cliente:r.cliente,recebivel_id:r.id,criado_em:instanteCadastro(),criado_por:eu.id});valor-=parte;if(!valor)break;}
  if(valor)throw new ErroDeUso('Confira os recebimentos antigos desta viagem antes de registrar o pagamento.');
  await atualiza('viagens',id,{atualizado_em:agora()});await registraAviso(eu,'criou','entrada',null,'Pagamento da viagem '+v.origem+' → '+v.destino);
}

async function notaInicialViagem(id,c){if(!c.nota_arquivo)return;const v=await financeiroViagem(id),d=await dadosNota({arquivo:c.nota_arquivo,numero:c.nota_numero,data:c.nota_data||v.inicio,cliente:v.cliente,viagem_id:id,caminhao_id:v.caminhao_id});await insere('notas_fiscais',{...d,usuario_id:(await exigeLogin()).id,criado_em:instanteCadastro()});}

async function viagemComCadastro(){const c=await corpoJson(),cliente=await clienteDaViagem(c),r=await rotaNovaViagem();await atualiza('viagens',r.id,{cliente_id:cliente,nota_fiscal_numero:campoTexto(c.nota_numero??null,'Número da nota fiscal',false,40)});await defineFreteViagem(r.id,c);await recebeNaViagem(r.id,c,'valor_entrada');await notaInicialViagem(r.id,c);return r;}

async function viagemComEdicao(id){const v=await bloqueiaViagem(id),r=await rotaEditaViagem(id),c=await corpoJson(),d={atualizado_em:agora()};if(Object.hasOwn(c,'cliente_id')||c.cliente_novo)d.cliente_id=await clienteDaViagem(c,v.cliente_id);if(Object.hasOwn(c,'nota_numero'))d.nota_fiscal_numero=campoTexto(c.nota_numero,'Número da nota fiscal',false,40);await atualiza('viagens',id,d);await defineFreteViagem(id,c);await notaInicialViagem(id,c);return r;}

async function viagemComEncerramento(id){const v=await bloqueiaViagem(id);if(v.status==='encerrada')return {ok:true,ja_encerrada:true};const r=await rotaEncerraViagem(id);await recebeNaViagem(id,await corpoJson());await atualiza('viagens',id,{atualizado_em:agora()});return r;}

async function viagemComPagamento(id){await exigeAdmin();const v=await bloqueiaViagem(id);if(v.status!=='encerrada')throw new ErroDeUso('Encerre a viagem antes de registrar a quitação.');await recebeNaViagem(id,await corpoJson());return financeiroViagem(id);}

async function resumoFinanceiroViagens(){await exigeAdmin();const mes=mesValido(ctx().q.mes??''),[de,ate]=limitesDoMes(mes),r={mes,pendente_mes_centavos:0,pendente_anterior_centavos:0,pendente_futuro_centavos:0};for(const row of await todas('SELECT r.data,r.valor_centavos,r.vencimento,'+SQL_RECEBIDO+' AS recebido_centavos FROM recebiveis r')){const saldo=situacaoRecebivel(row);r[row.data<de?'pendente_anterior_centavos':row.data>ate?'pendente_futuro_centavos':'pendente_mes_centavos']+=saldo.restante_centavos;}r.recebido_mes_centavos=Number(await umValor("SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='entrada' AND data BETWEEN ? AND ? AND (viagem_id IS NOT NULL OR recebivel_id IS NOT NULL)",[de,ate]));r.cobrancas_anteriores=Number(await umValor('SELECT COUNT(*) FROM recebiveis WHERE viagem_id IS NULL'))+Number(await umValor('SELECT COUNT(*) FROM (SELECT viagem_id FROM recebiveis WHERE viagem_id IS NOT NULL GROUP BY viagem_id HAVING COUNT(*)>1) grupos'));return {...r,...await totaisAReceber()};}

async function rotaMeuCaminhao(){const eu=await exigeLogin(),c=await corpoJson(),id=campoId(c.caminhao_padrao_id??null,'Caminhão padrão');if(id&&!await umValor('SELECT id FROM caminhoes WHERE id=? AND ativo=1',[id]))throw new ErroDeUso('Escolha um caminhão em operação.');await atualiza('usuarios',eu.id,{caminhao_padrao_id:id});return {...eu,caminhao_padrao_id:id};}

async function recalculaPagamentoDiarias(id){const total=Number(await umValor('SELECT COALESCE(SUM(valor_centavos),0) FROM diarias WHERE lancamento_id=?',[id])),dias=Number(await umValor('SELECT COUNT(*) FROM diarias WHERE lancamento_id=?',[id]));if(!dias){await consulta('UPDATE avisos SET lancamento_id=NULL WHERE lancamento_id=?',[id]);await consulta('DELETE FROM lancamentos WHERE id=?',[id]);return;}await atualiza('lancamentos',id,{valor_centavos:total,descricao:`Diárias de motorista (${dias} dias)`,atualizado_em:agora(),atualizado_por:(await exigeLogin()).id});}
