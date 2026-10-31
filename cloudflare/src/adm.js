import { ErroDeUso, consulta, todas, umaLinha, umValor, insere, atualiza } from './contexto.js';
import { conf, time, segundosDe, tamanho, corpoJson, instanteCadastro, hex, aleatorio } from './util.js';
import { exigeLogin } from './sessao.js';
import { hashSenha } from './banco.js';

// Acesso ADM (suporte): entra com FROTA_ADM_USUARIO / FROTA_ADM_SENHA, só gerencia senhas e acessos
// e nunca aparece para o proprietário nem para os motoristas. No banco ele é o papel "sistema".
export const PAPEL_ADM = 'sistema';
export const ROTAS_ADM = new Set(['POST login', 'POST logout', 'GET eu', 'GET adm-usuarios', 'PUT adm-usuario']);
const LIMITE_TENTATIVAS = 10;

export function loginDoAdm() {
  const login = conf('ADM_USUARIO', '').trim().toLowerCase();
  return login && conf('ADM_SENHA', '').length >= 8 ? login : '';
}

async function resumo(texto) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(texto)));
  return hex(new Uint8Array(d));
}

// Devolve o id do ADM quando usuário e senha conferem com a configuração; null quando não é o ADM.
export async function entraComoAdm(usuario, senha) {
  const login = loginDoAdm();
  if (!login || usuario !== login) return null;
  if (await resumo(senha) !== await resumo(conf('ADM_SENHA', ''))) {
    throw new ErroDeUso('Usuário ou senha incorretos.', 401);
  }
  const u = await umaLinha('SELECT id, papel, ativo FROM usuarios WHERE usuario = ?', [login]);
  if (u && u.papel !== PAPEL_ADM) {
    throw new ErroDeUso('Já existe um usuário comum com o login do ADM. Escolha outro FROTA_ADM_USUARIO.', 409);
  }
  if (u) {
    if (!Number(u.ativo)) await atualiza('usuarios', u.id, { ativo: 1 });
    return Number(u.id);
  }
  // A senha de verdade fica só na configuração; o hash gravado é aleatório e nunca confere.
  return insere('usuarios', {
    nome: 'ADM', usuario: login, senha_hash: await hashSenha(hex(aleatorio(24))),
    papel: PAPEL_ADM, ativo: 1, criado_em: instanteCadastro(),
  });
}

async function exigeAdm() {
  const eu = await exigeLogin();
  if (eu.papel !== PAPEL_ADM) throw new ErroDeUso('Endereço não encontrado.', 404);
  return eu;
}

async function travados() {
  const desde = time() - 10 * 60;
  const linhas = await todas('SELECT chave, n, desde FROM tentativas_login WHERE n > ?', [LIMITE_TENTATIVAS - 1]);
  return new Set(linhas.filter((l) => segundosDe(l.desde) >= desde).map((l) => String(l.chave).split('|')[0]));
}

export async function rotaAdmUsuarios() {
  await exigeAdm();
  const presos = await travados();
  const lista = await todas(
    `SELECT id, nome, usuario, papel, telefone, ativo, criado_em
       FROM usuarios WHERE papel <> ? ORDER BY ativo DESC, papel, nome`,
    [PAPEL_ADM]
  );
  return lista.map((u) => ({ ...u, login_travado: presos.has(u.usuario) }));
}

async function encerraSessoesDe(id) {
  await consulta('DELETE FROM sessoes WHERE dados LIKE ?', [`%usuario_id|i:${Number(id)};%`]);
}

async function destravaLogin(usuario) {
  for (const { chave } of await todas('SELECT chave FROM tentativas_login')) {
    if (String(chave).split('|')[0] === usuario) await consulta('DELETE FROM tentativas_login WHERE chave = ?', [chave]);
  }
}

export async function rotaAdmEditaUsuario(id) {
  await exigeAdm();
  const corpo = await corpoJson();
  const u = await umaLinha('SELECT id, usuario, papel, ativo FROM usuarios WHERE id = ?', [id]);
  if (!u || u.papel === PAPEL_ADM) throw new ErroDeUso('Usuário não encontrado.', 404);

  const nova = String(corpo.senha_nova ?? '');
  if (nova !== '') {
    if (tamanho(nova) < 4) throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
    await atualiza('usuarios', id, { senha_hash: await hashSenha(nova) });
    await encerraSessoesDe(id);
    await destravaLogin(u.usuario);
  }
  if (corpo.ativo !== undefined && corpo.ativo !== null && corpo.ativo !== '') {
    const ativo = [true, 1, '1', 'true', 'sim', 'on'].includes(corpo.ativo) ? 1 : 0;
    if (!ativo && u.papel === 'admin' && Number(u.ativo)) {
      const outros = Number(await umValor(
        "SELECT COUNT(*) FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?", [id]
      ));
      if (outros === 0) throw new ErroDeUso('É preciso manter ao menos um proprietário ativo.');
    }
    await atualiza('usuarios', id, { ativo });
    if (!ativo) await encerraSessoesDe(id);
  }
  if (corpo.destravar) await destravaLogin(u.usuario);
  return { ok: true };
}

