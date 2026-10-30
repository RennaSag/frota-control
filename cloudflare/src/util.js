import { ctx, ErroDeUso } from './contexto.js';

export const NOME_SISTEMA = 'Controle da Frota';
export const ADMIN_NOME = 'Proprietário';
export const ADMIN_USUARIO = 'admin';
export const DIAS_LOGADO = 30;

export function conf(nome, padrao) {
  const valor = ctx().env['FROTA_' + nome];
  return valor === undefined || valor === null || valor === '' ? padrao : String(valor);
}

// ---------------------------------------------------------------------------
// Datas no horário de Brasília (o servidor do Cloudflare roda em UTC).
// ---------------------------------------------------------------------------

const FORMATO_SP = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// "AAAA-MM-DD HH:MM:SS" em Brasília.
export function agora(ms = Date.now()) {
  return FORMATO_SP.format(new Date(ms)).replace('T', ' ');
}

export function hoje() {
  return agora().slice(0, 10);
}

export function mesAtual() {
  return agora().slice(0, 7);
}

export function time() {
  return Math.floor(Date.now() / 1000);
}

// Horário gravado no banco (Brasília, sem fuso) em segundos desde 1970.
export function segundosDe(texto) {
  const s = String(texto ?? '').slice(0, 19);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return 0;
  const iso = s.length > 10 ? s.replace(' ', 'T') : `${s}T00:00:00`;
  // O Brasil não tem horário de verão desde 2019: Brasília é sempre UTC-3.
  return Math.floor(Date.parse(`${iso}-03:00`) / 1000);
}

function dataUtc(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function formataUtc(data) {
  return data.toISOString().slice(0, 10);
}

export function somaDias(texto, dias) {
  const d = dataUtc(texto);
  d.setUTCDate(d.getUTCDate() + dias);
  return formataUtc(d);
}

export function diasEntre(de, ate) {
  return Math.round((dataUtc(ate) - dataUtc(de)) / 86400000);
}

// "AAAA-MM" mais (ou menos) n meses.
export function somaMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Conversões no jeito do PHP.
// ---------------------------------------------------------------------------

export function phpTrim(s) {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

function escalar(valor) {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  if (typeof valor === 'boolean') return valor ? '1' : '';
  return null;
}

export function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return escalar(valor) ?? String(valor);
}

export function tamanho(s) {
  return [...s].length;
}

export function ehNumerico(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'string') return false;
  return /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/.test(valor);
}

export function inteiro(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.trunc(valor) : 0;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  const n = parseFloat(String(valor ?? '').trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function arredonda(n, casas = 0) {
  const f = 10 ** casas;
  return (Math.sign(n) * Math.round(Math.abs(n) * f + 1e-9)) / f;
}

// empty() do PHP.
export function vazio(valor) {
  return valor === undefined || valor === null || valor === '' || valor === '0' || valor === 0
    || valor === false || (Array.isArray(valor) && valor.length === 0);
}

// ---------------------------------------------------------------------------
// Leitura e validação dos campos (mesmas regras e mensagens do PHP).
// ---------------------------------------------------------------------------

export async function corpoJson() {
  const c = ctx();
  if (c.corpo !== undefined) return c.corpo;
  const bruto = await c.req.text();
  if (bruto === '') {
    c.corpo = {};
    return c.corpo;
  }
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    dados = null;
  }
  if (dados === null || typeof dados !== 'object') {
    throw new ErroDeUso('Não foi possível ler os dados enviados.');
  }
  c.corpo = dados;
  return dados;
}

export function campoTexto(valor, campo, obrigatorio = false, max = 300) {
  const e = escalar(valor);
  const v = e === null ? '' : phpTrim(e);
  if (v === '') {
    if (obrigatorio) throw new ErroDeUso(`Preencha o campo "${campo}".`);
    return null;
  }
  if (tamanho(v) > max) {
    throw new ErroDeUso(`O campo "${campo}" é muito longo (máximo ${max} caracteres).`);
  }
  return v;
}

export function campoCentavos(valor, campo = 'Valor') {
  if (valor === null || valor === undefined || valor === '') {
    throw new ErroDeUso('Informe o valor.');
  }
  let s = texto(valor).replace(/\s|R\$/giu, '');
  const virgula = s.lastIndexOf(',');
  const ponto = s.lastIndexOf('.');
  if (virgula !== -1 && ponto !== -1) {
    const separador = virgula > ponto ? ',' : '.';
    const outro = separador === ',' ? '.' : ',';
    s = s.split(outro).join('').split(separador).join('.');
  } else if (virgula !== -1) {
    s = s.split(',').join('.');
  }
  if (!ehNumerico(s)) {
    throw new ErroDeUso(`${campo} inválido. Use apenas números, como 1250,90.`);
  }
  const centavos = arredonda(parseFloat(s) * 100);
  if (centavos <= 0) throw new ErroDeUso(`${campo} deve ser maior que zero.`);
  if (centavos > 100000000000) throw new ErroDeUso(`${campo} acima do limite permitido.`);
  return centavos;
}

export function campoCentavosOpcional(valor, campo = 'Valor') {
  if (valor === null || valor === undefined || phpTrim(texto(valor)) === '') return null;
  return campoCentavos(valor, campo);
}

export function campoNumero(valor, campo, max = 10000000, ehInteiro = false) {
  if (valor === null || valor === undefined || valor === '') return null;
  const s = texto(valor).split(',').join('.');
  if (!ehNumerico(s)) throw new ErroDeUso(`O campo "${campo}" deve ser um número.`);
  const n = parseFloat(s);
  if (n < 0 || n > max) throw new ErroDeUso(`O campo "${campo}" está fora do intervalo permitido.`);
  return ehInteiro ? arredonda(n) : arredonda(n, 3);
}

export function campoId(valor, campo, obrigatorio = false) {
  if (valor === null || valor === undefined || valor === '' || valor === 'null') {
    if (obrigatorio) throw new ErroDeUso(`Selecione o campo "${campo}".`);
    return null;
  }
  if (!ehNumerico(valor) || inteiro(valor) <= 0) {
    throw new ErroDeUso(`O campo "${campo}" é inválido.`);
  }
  return inteiro(valor);
}

export function campoData(valor, campo = 'Data', obrigatorio = true) {
  const e = escalar(valor);
  const v = e === null ? '' : phpTrim(e).slice(0, 10);
  if (v === '') {
    if (obrigatorio) throw new ErroDeUso(`Informe a ${campo.toLowerCase()}.`);
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m || formataUtc(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) !== v) {
    throw new ErroDeUso(`${campo} inválida.`);
  }
  return v;
}

export function campoSimNao(valor, padrao = true) {
  if (valor === null || valor === undefined) return padrao ? 1 : 0;
  if (valor === false || valor === 0 || valor === '0' || valor === 'false') return 0;
  return 1;
}

export function mesValido(valor) {
  const v = phpTrim(texto(valor));
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : mesAtual();
}

export function limitesDoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${mes}-01`, `${mes}-${String(ultimo).padStart(2, '0')}`];
}

export function mesAnterior(mes) {
  return somaMeses(mes, -1);
}

export function paginacao(query) {
  const limite = Math.max(1, Math.min(inteiro(query.limite ?? 100), 1000));
  const pagina = Math.max(1, inteiro(query.pagina ?? 1));
  return [limite, (pagina - 1) * limite, pagina];
}

// ---------------------------------------------------------------------------
// Bytes e base64url (sessão, push, comprovantes).
// ---------------------------------------------------------------------------

export function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64u(textoB64) {
  try {
    const s = atob(String(textoB64).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

export function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function deHex(texto) {
  const s = texto.startsWith('\\x') ? texto.slice(2) : texto;
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(s.substr(i * 2, 2), 16);
  return bytes;
}

export function aleatorio(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function sha256Hex(texto) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))));
}
