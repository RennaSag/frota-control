import { ErroDeUso, consulta, todas, umValor, insere, depois } from './contexto.js';
import { exigeLogin } from './sessao.js';
import { NOME_SISTEMA, conf, agora, time, b64u, deB64u, aleatorio, sha256Hex, corpoJson } from './util.js';
import { avisosNaoLidos } from './avisos.js';

// Notificações push (Web Push com VAPID, RFC 8291 e 8292), feitas com o WebCrypto do Worker.
// As chaves VAPID são as mesmas que o PHP criou (tabela "configuracoes"): os aparelhos que já
// tinham ativado as notificações continuam recebendo sem precisar ativar de novo.

const enc = new TextEncoder();

function junta(...partes) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

function pemParaBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesParaPem(bytes, rotulo) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  const linhas = btoa(s).match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${rotulo}-----\n${linhas}\n-----END ${rotulo}-----\n`;
}

// O PHP grava a chave privada em PEM (PKCS#8 ou SEC1, depende do OpenSSL). Nos dois formatos
// a parte secreta vem logo depois de "02 01 01 04 20" (versão 1 + texto de 32 bytes).
function segredoDaChave(pem) {
  const der = pemParaBytes(pem);
  for (let i = 0; i + 37 <= der.length; i++) {
    if (der[i] === 0x02 && der[i + 1] === 0x01 && der[i + 2] === 0x01 && der[i + 3] === 0x04 && der[i + 4] === 0x20) {
      return der.slice(i + 5, i + 37);
    }
  }
  throw new Error('Chave VAPID privada ilegível.');
}

async function configuracao(chave) {
  const valor = await umValor('SELECT valor FROM configuracoes WHERE chave = ?', [chave]);
  return valor === null ? null : String(valor);
}

// [chave pública em base64url, chave privada em PEM]
async function chavesVapid() {
  const publica = await configuracao('vapid_publica');
  const privada = await configuracao('vapid_privada');
  if (publica !== null && privada !== null) return [publica, privada];

  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const bruta = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
  try {
    await consulta('DELETE FROM configuracoes WHERE chave IN (?, ?)', ['vapid_publica', 'vapid_privada']);
    await consulta('INSERT INTO configuracoes (chave, valor) VALUES (?, ?), (?, ?)',
      ['vapid_publica', b64u(bruta), 'vapid_privada', bytesParaPem(pkcs8, 'PRIVATE KEY')]);
  } catch {
    // Outro pedido criou ao mesmo tempo: vale a que ficou gravada.
  }
  return [String(await configuracao('vapid_publica')), String(await configuracao('vapid_privada'))];
}

async function chaveDeAssinatura(publica, privadaPem) {
  const ponto = deB64u(publica);
  return crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    x: b64u(ponto.slice(1, 33)), y: b64u(ponto.slice(33, 65)), d: b64u(segredoDaChave(privadaPem)),
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function cabecalhoVapid(endpoint, chaves) {
  const [publica, privada] = chaves;
  const u = new URL(endpoint);
  const corpo = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.'
    + b64u(enc.encode(JSON.stringify({ aud: u.origin, exp: time() + 12 * 3600, sub: conf('PUSH_CONTATO', 'mailto:contato@controle-frota.app') })));
  // O WebCrypto já devolve r e s com 32 bytes cada, colados, como o JWT (ES256) pede.
  const assinatura = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await chaveDeAssinatura(publica, privada), enc.encode(corpo)
  ));
  return `vapid t=${corpo}.${b64u(assinatura)}, k=${publica}`;
}

async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}

// Cifra a mensagem para o aparelho (aes128gcm, RFC 8291): só ele consegue ler.
async function cifraPush(mensagem, p256dh, auth) {
  const publicaAparelho = deB64u(p256dh);
  const segredoAparelho = deB64u(auth);
  const chaveAparelho = await crypto.subtle.importKey('raw', publicaAparelho, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const minha = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const minhaPublica = new Uint8Array(await crypto.subtle.exportKey('raw', minha.publicKey));
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: chaveAparelho }, minha.privateKey, 256));

  const prkChave = await hmac(segredoAparelho, compartilhado);
  const ikm = await hmac(prkChave, junta(enc.encode('WebPush: info\0'), publicaAparelho, minhaPublica, new Uint8Array([1])));
  const sal = aleatorio(16);
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const chaveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // O resultado do AES-GCM já vem com a etiqueta (tag) de 16 bytes no fim.
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, chaveAes, junta(enc.encode(mensagem), new Uint8Array([2]))
  ));
  return junta(sal, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([minhaPublica.length]), minhaPublica, cifrado);
}

// Devolve o código HTTP do serviço de push (201 = entregue; 404/410 = inscrição morta).
async function enviaPush(inscricao, mensagem, chaves) {
  const corpo = await cifraPush(JSON.stringify(mensagem), inscricao.p256dh, inscricao.auth);
  try {
    const r = await fetch(inscricao.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Urgency: 'high',
        Authorization: await cabecalhoVapid(inscricao.endpoint, chaves),
      },
      body: corpo,
      signal: AbortSignal.timeout(8000),
    });
    return r.status;
  } catch {
    return 0;
  }
}

// Os pushes saem depois que a resposta já foi entregue ao aparelho de quem registrou,
// para ninguém esperar o serviço de push do Google ou da Apple.
export function agendaPush(usuarioIds, texto) {
  depois(() => notificaUsuarios(usuarioIds, texto));
}

export async function notificaUsuarios(usuarioIds, texto) {
  const ids = [...new Set(usuarioIds.map(Number))];
  if (!ids.length) return 0;
  let entregues = 0;
  try {
    const inscricoes = await todas(
      `SELECT p.*, u.papel FROM inscricoes_push p JOIN usuarios u ON u.id = p.usuario_id
        WHERE u.ativo = 1 AND p.usuario_id IN (${ids.map(() => '?').join(', ')})`,
      ids
    );
    if (!inscricoes.length) return 0;
    const chaves = await chavesVapid();
    for (const i of inscricoes) {
      try {
        const status = await enviaPush(i, {
          titulo: NOME_SISTEMA,
          corpo: texto,
          tag: 'frota-avisos',
          url: './?acao=avisos',
          nao_lidos: await avisosNaoLidos({ id: Number(i.usuario_id), papel: i.papel }),
        }, chaves);
        if (status === 404 || status === 410) {
          await consulta('DELETE FROM inscricoes_push WHERE id = ?', [i.id]);
        } else if (status >= 200 && status < 300) {
          entregues++;
        } else {
          console.error(`[frota] push recusado (${status}) para o usuário ${i.usuario_id}`);
        }
      } catch (e) {
        console.error('[frota] push:', e.message);
      }
    }
  } catch (e) {
    console.error('[frota] push:', e.message);
  }
  return entregues;
}

export async function rotaPushChave() {
  await exigeLogin();
  try {
    return { chave: (await chavesVapid())[0] };
  } catch (e) {
    console.error('[frota] VAPID:', e.message);
    return { chave: null };
  }
}

export async function rotaPushInscrever() {
  const eu = await exigeLogin();
  const corpo = await corpoJson();
  const endpoint = typeof corpo.endpoint === 'string' ? corpo.endpoint : '';
  const p256dh = String(corpo.keys?.p256dh ?? '');
  const auth = String(corpo.keys?.auth ?? '');
  if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000
    || deB64u(p256dh).length !== 65 || deB64u(auth).length !== 16) {
    throw new ErroDeUso('Inscrição de notificação inválida.');
  }
  const hash = await sha256Hex(endpoint);
  await consulta('DELETE FROM inscricoes_push WHERE endpoint_hash = ?', [hash]);
  await insere('inscricoes_push', {
    usuario_id: eu.id,
    endpoint_hash: hash,
    endpoint,
    p256dh,
    auth,
    criado_em: agora(),
  });
  return { ok: true };
}

export async function rotaPushCancelar() {
  await exigeLogin();
  const endpoint = String((await corpoJson()).endpoint ?? '');
  await consulta('DELETE FROM inscricoes_push WHERE endpoint_hash = ?', [await sha256Hex(endpoint)]);
  return { ok: true };
}

export async function rotaPushTeste() {
  const eu = await exigeLogin();
  const entregues = await notificaUsuarios([eu.id], 'Teste: as notificações deste aparelho estão funcionando.');
  if (entregues === 0) {
    throw new ErroDeUso('Nenhum aparelho recebeu. Ative as notificações de novo neste aparelho.');
  }
  return { entregues };
}
