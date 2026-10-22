import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { db } from './src/db.js';
import { Usuario } from './src/types.js';
import {
  Pdf,
  PDF_LARGURA,
  PDF_ALTURA,
  PDF_MARGEM,
  PDF_VERDE,
  PDF_VERMELHO,
  PDF_CINZA,
  PDF_TINTA,
} from './src/pdf.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const NOME_SISTEMA = process.env.NOME_SISTEMA || 'Controle da Frota';

// Multer for receipt uploads
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1) || 'jpg';
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const rand = crypto.randomBytes(5).toString('hex');
    cb(null, `${timestamp}-${rand}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Envie uma foto (JPG, PNG, WEBP) ou um PDF.'));
    }
  },
});

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper: Custom Error
class ErroDeUso extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Helper: Session Auth
interface AuthRequest extends Request {
  usuario?: Usuario;
}

function getUsuario(req: Request): Usuario | null {
  let token = req.cookies?.frota;
  if (!token && req.headers.authorization) {
    const auth = req.headers.authorization;
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7).trim();
    } else {
      token = auth.trim();
    }
  }
  if (!token && req.headers['x-frota-token']) {
    token = String(req.headers['x-frota-token']).trim();
  }
  if (!token && req.query.token) {
    token = String(req.query.token).trim();
  }
  if (!token) return null;
  const session = db.sessoes.get(token);
  if (!session) return null;
  if (session.expira < Date.now()) {
    db.sessoes.delete(token);
    return null;
  }
  const user = db.usuarios.find((u) => u.id === session.usuarioId && u.ativo === 1);
  return user || null;
}

function exigeLogin(req: Request): Usuario {
  const user = getUsuario(req);
  if (!user) {
    throw new ErroDeUso('Sua sessão expirou. Entre novamente.', 401);
  }
  return user;
}

function exigeAdmin(req: Request): Usuario {
  const user = exigeLogin(req);
  if (user.papel !== 'admin') {
    throw new ErroDeUso('Somente o proprietário pode fazer isso.', 403);
  }
  return user;
}

function exigePedidoDoApp(req: Request) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return;
  // If X-App-Frota header is present or request comes from browser
  // We allow requests with X-App-Frota: 1
  if (req.headers['x-app-frota'] !== '1' && !req.headers['content-type']?.includes('multipart/form-data')) {
    // permissive for form-data or strict
  }
}

// Helpers for dates & currency
function pdfReais(centavos: number): string {
  const v = Math.abs(centavos) / 100;
  const formatado = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (centavos < 0 ? '-' : '') + 'R$ ' + formatado;
}

function pdfNumero(n: number, casas = 0): string {
  return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function pdfData(d: string | null): string {
  if (!d) return '';
  const [ano, mes, dia] = d.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} de ${ano}`;
}

function periodoPorExtenso(deMes: string, ateMes: string): string {
  return deMes === ateMes ? mesPorExtenso(deMes) : `${mesPorExtenso(deMes)} a ${mesPorExtenso(ateMes)}`;
}

function mesesEntre(deMes: string, ateMes: string): string[] {
  const lista: string[] = [];
  let [ano, mes] = deMes.split('-').map(Number);
  const [fimAno, fimMes] = ateMes.split('-').map(Number);

  while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
    lista.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return lista;
}

function limitesDoMes(mesStr: string): [string, string] {
  const [ano, mes] = mesStr.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return [`${mesStr}-01`, `${mesStr}-${String(ultimoDia).padStart(2, '0')}`];
}

function mesAnterior(mesStr: string): string {
  const [ano, mes] = mesStr.split('-').map(Number);
  const prevDate = new Date(ano, mes - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

// Manifest handler
const handleManifest = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.json({
    name: NOME_SISTEMA,
    short_name: NOME_SISTEMA,
    lang: 'pt-BR',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#ffffff',
    icons: [
      {
        src: 'assets/icone.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  });
};

app.get('/manifest.php', handleManifest);
app.get('/frota/manifest.php', handleManifest);
app.get('/manifest.json', handleManifest);

// API Dispatcher
async function despacha(req: Request, res: Response) {
  const r = (req.query.r as string) || '';
  const metodo = req.method.toUpperCase();
  const rota = `${metodo} ${r}`;

  switch (rota) {
    case 'POST login': {
      const { usuario, senha } = req.body || {};
      const uStr = String(usuario || '').trim().toLowerCase();
      const sStr = String(senha || '');
      const ip = req.ip || '127.0.0.1';
      const chave = `${uStr}|${ip}`.slice(0, 120);

      const agora = Date.now();
      const tentativa = db.tentativasLogin.get(chave);
      if (tentativa) {
        if (agora - tentativa.desde < 10 * 60 * 1000 && tentativa.n >= 10) {
          throw new ErroDeUso('Muitas tentativas de senha. Espere alguns minutos e tente de novo.', 429);
        }
      }

      const u = db.usuarios.find((x) => x.usuario.toLowerCase() === uStr);
      if (!u || !u.ativo || !bcrypt.compareSync(sStr, u.senha_hash)) {
        if (!tentativa || agora - tentativa.desde > 10 * 60 * 1000) {
          db.tentativasLogin.set(chave, { n: 1, desde: agora });
        } else {
          tentativa.n++;
        }
        throw new ErroDeUso('Usuário ou senha incorretos.', 401);
      }

      db.tentativasLogin.delete(chave);
      const token = crypto.randomBytes(32).toString('hex');
      const dias = 30;
      const expira = Date.now() + dias * 24 * 60 * 60 * 1000;
      db.sessoes.set(token, { usuarioId: u.id, expira });

      res.cookie('frota', token, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: dias * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return {
        id: u.id,
        nome: u.nome,
        usuario: u.usuario,
        papel: u.papel,
        token,
      };
    }

    case 'POST logout': {
      let token = req.cookies?.frota;
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7).trim();
      }
      if (!token && req.headers['x-frota-token']) {
        token = String(req.headers['x-frota-token']).trim();
      }
      if (!token && req.query.token) {
        token = String(req.query.token).trim();
      }
      if (token) db.sessoes.delete(token);
      res.clearCookie('frota', { path: '/', sameSite: 'none', secure: true });
      return { ok: true };
    }

    case 'GET eu': {
      const u = exigeLogin(req);
      return {
        id: u.id,
        nome: u.nome,
        usuario: u.usuario,
        papel: u.papel,
        telefone: u.telefone,
      };
    }

    case 'POST trocar-senha': {
      const eu = exigeLogin(req);
      const { senha_atual, senha_nova } = req.body || {};
      const nova = String(senha_nova || '');
      if (nova.length < 4) {
        throw new ErroDeUso('A nova senha deve ter ao menos 4 caracteres.');
      }
      const u = db.usuarios.find((x) => x.id === eu.id);
      if (!u || !bcrypt.compareSync(String(senha_atual || ''), u.senha_hash)) {
        throw new ErroDeUso('Senha atual incorreta.');
      }
      u.senha_hash = bcrypt.hashSync(nova, 10);
      return { ok: true };
    }

    case 'GET usuarios': {
      const eu = exigeLogin(req);
      if (eu.papel !== 'admin') {
        return [{ id: eu.id, nome: eu.nome, papel: eu.papel, ativo: 1 }];
      }
      return [...db.usuarios]
        .sort((a, b) => b.ativo - a.ativo || a.papel.localeCompare(b.papel) || a.nome.localeCompare(b.nome))
        .map((u) => ({
          id: u.id,
          nome: u.nome,
          usuario: u.usuario,
          papel: u.papel,
          telefone: u.telefone,
          ativo: u.ativo,
          criado_em: u.criado_em,
        }));
    }

    case 'POST usuarios': {
      exigeAdmin(req);
      const { nome, usuario, senha, papel, telefone } = req.body || {};
      const nStr = String(nome || '').trim();
      const uStr = String(usuario || '').trim().toLowerCase().replace(/\s+/g, '');
      const sStr = String(senha || '');
      const pStr = papel === 'admin' ? 'admin' : 'motorista';

      if (!nStr) throw new ErroDeUso('Preencha o campo "Nome".');
      if (!/^[a-z0-9._-]{3,40}$/.test(uStr)) {
        throw new ErroDeUso('O usuário deve ter de 3 a 40 caracteres: letras, números, ponto ou -.');
      }
      if (sStr.length < 4) {
        throw new ErroDeUso('A senha deve ter ao menos 4 caracteres.');
      }
      if (db.usuarios.some((x) => x.usuario.toLowerCase() === uStr)) {
        throw new ErroDeUso('Já existe um usuário com esse login.');
      }

      const id = db.addUsuario({
        nome: nStr,
        usuario: uStr,
        senha_hash: bcrypt.hashSync(sStr, 10),
        papel: pStr,
        telefone: telefone ? String(telefone).trim() : null,
        ativo: 1,
      });
      return { id };
    }

    case 'PUT usuario': {
      const eu = exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const { nome, telefone, papel, ativo, senha_nova } = req.body || {};
      const u = db.usuarios.find((x) => x.id === id);
      if (!u) throw new ErroDeUso('Usuário não encontrado.', 404);

      const pStr = papel === 'admin' ? 'admin' : 'motorista';
      const atv = ativo === 0 || ativo === false ? 0 : 1;

      if (u.id === eu.id && (pStr !== 'admin' || !atv)) {
        throw new ErroDeUso('Você não pode remover o seu próprio acesso de proprietário.');
      }
      if (u.papel === 'admin' && pStr !== 'admin') {
        const outros = db.usuarios.filter((x) => x.papel === 'admin' && x.ativo === 1 && x.id !== id).length;
        if (outros === 0) {
          throw new ErroDeUso('É preciso manter ao menos um proprietário ativo.');
        }
      }

      db.updateUsuario(id, {
        nome: String(nome || '').trim(),
        telefone: telefone ? String(telefone).trim() : null,
        papel: pStr,
        ativo: atv,
      });

      if (senha_nova && String(senha_nova).length >= 4) {
        db.updateUsuario(id, {
          senha_hash: bcrypt.hashSync(String(senha_nova), 10),
        });
      }
      return { ok: true };
    }

    case 'DELETE usuario': {
      const eu = exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const u = db.usuarios.find((x) => x.id === id);
      if (!u) throw new ErroDeUso('Usuário não encontrado.', 404);

      if (u.papel === 'admin') {
        throw new ErroDeUso('Usuários com perfil proprietário (admin) não podem ser excluídos.');
      }
      if (u.id === eu.id) {
        throw new ErroDeUso('Você não pode remover a si próprio.');
      }

      const viagensAbertas = db.viagens.filter((v) => v.usuario_id === id && v.status === 'aberta').length;
      if (viagensAbertas > 0) {
        throw new ErroDeUso(`Este motorista possui ${viagensAbertas} ${viagensAbertas === 1 ? 'viagem' : 'viagens'} em andamento. Conclua-as antes de remover.`);
      }

      db.deleteUsuario(id);
      return { ok: true };
    }

    case 'GET caminhoes': {
      const eu = exigeLogin(req);
      const todos = eu.papel === 'admin' && req.query.todos === '1';
      let lista = db.caminhoes;
      if (!todos) {
        lista = lista.filter((c) => c.ativo === 1);
      }
      return [...lista]
        .sort((a, b) => b.ativo - a.ativo || a.placa.localeCompare(b.placa))
        .map((c) => ({
          id: c.id,
          placa: c.placa,
          apelido: c.apelido,
          ativo: c.ativo,
        }));
    }

    case 'POST caminhoes': {
      exigeAdmin(req);
      const { placa, apelido } = req.body || {};
      const pStr = String(placa || '').trim().toUpperCase();
      if (!pStr) throw new ErroDeUso('Preencha o campo "Placa".');
      if (db.caminhoes.some((c) => c.placa.toUpperCase() === pStr)) {
        throw new ErroDeUso('Essa placa já está cadastrada.');
      }
      const id = db.addCaminhao({
        placa: pStr,
        apelido: apelido ? String(apelido).trim() : null,
        ativo: 1,
      });
      return { id };
    }

    case 'PUT caminhao': {
      exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const { placa, apelido, ativo } = req.body || {};
      const c = db.caminhoes.find((x) => x.id === id);
      if (!c) throw new ErroDeUso('Caminhão não encontrado.', 404);

      const pStr = String(placa || '').trim().toUpperCase();
      if (!pStr) throw new ErroDeUso('Preencha o campo "Placa".');
      if (db.caminhoes.some((x) => x.placa.toUpperCase() === pStr && x.id !== id)) {
        throw new ErroDeUso('Essa placa já está cadastrada em outro caminhão.');
      }

      db.updateCaminhao(id, {
        placa: pStr,
        apelido: apelido ? String(apelido).trim() : null,
        ativo: ativo === 0 || ativo === false ? 0 : 1,
      });
      return { ok: true };
    }

    case 'DELETE caminhao': {
      exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const c = db.caminhoes.find((x) => x.id === id);
      if (!c) throw new ErroDeUso('Caminhão não encontrado.', 404);

      const viagensAbertas = db.viagens.filter((v) => v.caminhao_id === id && v.status === 'aberta').length;
      if (viagensAbertas > 0) {
        throw new ErroDeUso(`O caminhão ${c.placa} possui uma viagem em andamento. Conclua ou encerre a viagem antes de remover o veículo.`);
      }

      db.deleteCaminhao(id);
      return { ok: true };
    }

    case 'GET categorias': {
      const eu = exigeLogin(req);
      let lista = db.categorias;
      if (eu.papel !== 'admin') {
        lista = lista.filter((c) => c.tipo === 'saida' && c.ativo === 1);
      } else if (req.query.todos !== '1') {
        lista = lista.filter((c) => c.ativo === 1);
      }
      if (req.query.tipo === 'entrada' || req.query.tipo === 'saida') {
        lista = lista.filter((c) => c.tipo === req.query.tipo);
      }

      return [...lista]
        .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.ativo - a.ativo || a.ordem - b.ordem || a.nome.localeCompare(b.nome))
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          tipo: c.tipo,
          icone: c.icone,
          pede_litros: c.pede_litros,
          pede_descricao: c.pede_descricao,
          ordem: c.ordem,
          ativo: c.ativo,
          ...(eu.papel === 'admin'
            ? { qtd_lancamentos: db.lancamentos.filter((l) => l.categoria_id === c.id).length }
            : {}),
        }));
    }

    case 'POST categorias': {
      exigeAdmin(req);
      const { nome, tipo } = req.body || {};
      const nStr = String(nome || '').trim();
      const tStr = tipo === 'entrada' ? 'entrada' : 'saida';
      if (!nStr) throw new ErroDeUso('Preencha o campo "Nome".');
      if (db.categorias.some((c) => c.nome.toLowerCase() === nStr.toLowerCase() && c.tipo === tStr)) {
        throw new ErroDeUso('Já existe uma categoria com esse nome.');
      }
      const id = db.addCategoria({
        nome: nStr,
        tipo: tStr,
        icone: tStr === 'entrada' ? 'plus' : 'tag',
        pede_litros: 0,
        pede_descricao: 0,
        ordem: 500,
        ativo: 1,
      });
      return { id };
    }

    case 'PUT categoria': {
      exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const { nome, tipo, ativo } = req.body || {};
      const cat = db.categorias.find((c) => c.id === id);
      if (!cat) throw new ErroDeUso('Categoria não encontrada.', 404);

      const nStr = String(nome || '').trim();
      const tStr = tipo === 'entrada' || tipo === 'saida' ? tipo : cat.tipo;
      const temLancamentos = db.lancamentos.some((l) => l.categoria_id === id);

      if (tStr !== cat.tipo && temLancamentos) {
        throw new ErroDeUso(
          'Esta categoria já tem lançamentos, por isso não pode mudar entre gasto e entrada. Crie uma categoria nova do outro tipo.'
        );
      }
      if (db.categorias.some((c) => c.nome.toLowerCase() === nStr.toLowerCase() && c.tipo === tStr && c.id !== id)) {
        throw new ErroDeUso('Já existe uma categoria com esse nome.');
      }

      db.updateCategoria(id, {
        nome: nStr,
        tipo: tStr,
        ativo: ativo === 0 || ativo === false ? 0 : 1,
      });
      return { ok: true };
    }

    case 'DELETE categoria': {
      exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      const cat = db.categorias.find((c) => c.id === id);
      if (!cat) throw new ErroDeUso('Categoria não encontrada.', 404);

      const qtd = db.lancamentos.filter((l) => l.categoria_id === id).length;
      if (qtd > 0) {
        throw new ErroDeUso(
          `Esta categoria tem ${qtd} ${qtd === 1 ? 'lançamento' : 'lançamentos'} e não pode ser apagada sem perder esse histórico. Você pode escondê-la: ela some da hora de lançar, mas os lançamentos antigos continuam.`,
          409
        );
      }
      db.deleteCategoria(id);
      return { ok: true };
    }

    case 'GET viagens': {
      const eu = exigeLogin(req);
      let lista = db.viagens;
      if (eu.papel !== 'admin') {
        lista = lista.filter((v) => v.usuario_id === eu.id);
      } else if (req.query.usuario_id) {
        const uid = parseInt(req.query.usuario_id as string, 10);
        lista = lista.filter((v) => v.usuario_id === uid);
      }
      if (req.query.status === 'aberta' || req.query.status === 'encerrada') {
        lista = lista.filter((v) => v.status === req.query.status);
      }

      const limite = Math.max(1, Math.min(1000, parseInt(req.query.limite as string, 10) || 100));
      const pagina = Math.max(1, parseInt(req.query.pagina as string, 10) || 1);
      const offset = (pagina - 1) * limite;

      const ordenados = [...lista]
        .sort((a, b) => {
          if (a.status === 'aberta' && b.status !== 'aberta') return -1;
          if (a.status !== 'aberta' && b.status === 'aberta') return 1;
          return b.inicio.localeCompare(a.inicio) || b.id - a.id;
        })
        .slice(offset, offset + limite);

      return ordenados.map((v) => db.joinViagem(v));
    }

    case 'POST viagens': {
      const eu = exigeLogin(req);
      const { caminhao_id, origem, destino, inicio, km_inicial, observacao, usuario_id } = req.body || {};
      const targetUserId = eu.papel === 'admin' && usuario_id ? parseInt(usuario_id, 10) : eu.id;

      const origStr = String(origem || '').trim();
      const destStr = String(destino || '').trim();
      const iniStr = String(inicio || '').trim();

      if (!origStr) throw new ErroDeUso('Preencha o campo "Saindo de".');
      if (!destStr) throw new ErroDeUso('Preencha o campo "Indo para".');
      if (!iniStr) throw new ErroDeUso('Informe a data de saída.');

      const id = db.addViagem({
        usuario_id: targetUserId,
        caminhao_id: caminhao_id ? parseInt(caminhao_id, 10) : null,
        origem: origStr,
        destino: destStr,
        inicio: iniStr,
        fim: null,
        km_inicial: km_inicial !== undefined && km_inicial !== null && km_inicial !== '' ? parseInt(km_inicial, 10) : null,
        km_final: null,
        status: 'aberta',
        observacao: observacao ? String(observacao).trim() : null,
      });

      if (eu.papel !== 'admin') {
        db.addAviso(eu.id, 'abriu', 'viagem', null, `${origStr} → ${destStr} · saída ${pdfData(iniStr)}`);
      }
      return { id };
    }

    case 'PUT viagem': {
      const eu = exigeLogin(req);
      const id = parseInt(req.query.id as string, 10);
      const v = db.viagens.find((x) => x.id === id);
      if (!v) throw new ErroDeUso('Viagem não encontrada.', 404);
      if (eu.papel !== 'admin' && v.usuario_id !== eu.id) {
        throw new ErroDeUso('Essa viagem não é sua.', 403);
      }

      const { origem, destino, inicio, fim, km_inicial, km_final, status, observacao, caminhao_id, usuario_id } = req.body || {};
      const iniStr = String(inicio || v.inicio).trim();
      const fimStr = fim ? String(fim).trim() : null;
      const kmIni = km_inicial !== undefined && km_inicial !== null && km_inicial !== '' ? parseInt(km_inicial, 10) : null;
      const kmFim = km_final !== undefined && km_final !== null && km_final !== '' ? parseInt(km_final, 10) : null;

      if (fimStr && fimStr < iniStr) {
        throw new ErroDeUso('A chegada não pode ser antes da saída.');
      }
      if (kmFim !== null && kmIni !== null && kmFim < kmIni) {
        throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
      }

      db.updateViagem(id, {
        origem: String(origem || v.origem).trim(),
        destino: String(destino || v.destino).trim(),
        inicio: iniStr,
        fim: fimStr,
        km_inicial: kmIni,
        km_final: kmFim,
        status: status === 'encerrada' ? 'encerrada' : 'aberta',
        observacao: observacao ? String(observacao).trim() : null,
        caminhao_id: caminhao_id ? parseInt(caminhao_id, 10) : null,
        usuario_id: eu.papel === 'admin' && usuario_id ? parseInt(usuario_id, 10) : v.usuario_id,
      });
      return { ok: true };
    }

    case 'POST viagem-encerrar': {
      const eu = exigeLogin(req);
      const id = parseInt(req.query.id as string, 10);
      const v = db.viagens.find((x) => x.id === id);
      if (!v) throw new ErroDeUso('Viagem não encontrada.', 404);
      if (eu.papel !== 'admin' && v.usuario_id !== eu.id) {
        throw new ErroDeUso('Essa viagem não é sua.', 403);
      }

      const { fim, km_final } = req.body || {};
      const fimStr = fim ? String(fim).trim() : new Date().toISOString().slice(0, 10);
      const kmFim = km_final !== undefined && km_final !== null && km_final !== '' ? parseInt(km_final, 10) : null;

      if (fimStr < v.inicio) {
        throw new ErroDeUso('A chegada não pode ser antes da saída.');
      }
      if (kmFim !== null && v.km_inicial !== null && kmFim < v.km_inicial) {
        throw new ErroDeUso('O km final não pode ser menor que o km inicial.');
      }

      db.updateViagem(id, {
        status: 'encerrada',
        fim: fimStr,
        km_final: kmFim,
      });
      return { ok: true };
    }

    case 'DELETE viagem': {
      exigeAdmin(req);
      const id = parseInt(req.query.id as string, 10);
      if (!db.deleteViagem(id)) {
        throw new ErroDeUso('Viagem não encontrada.', 404);
      }
      return { ok: true };
    }

    case 'GET lancamentos': {
      const eu = exigeLogin(req);
      let lista = db.lancamentos;

      if (eu.papel !== 'admin') {
        lista = lista.filter((l) => l.usuario_id === eu.id && l.tipo === 'saida');
      } else {
        if (req.query.usuario_id) {
          const uid = parseInt(req.query.usuario_id as string, 10);
          lista = lista.filter((l) => l.usuario_id === uid);
        }
        if (req.query.tipo === 'entrada' || req.query.tipo === 'saida') {
          lista = lista.filter((l) => l.tipo === req.query.tipo);
        }
      }

      if (req.query.mes) {
        const [de, ate] = limitesDoMes(req.query.mes as string);
        lista = lista.filter((l) => l.data >= de && l.data <= ate);
      }
      if (req.query.de) {
        lista = lista.filter((l) => l.data >= (req.query.de as string));
      }
      if (req.query.ate) {
        lista = lista.filter((l) => l.data <= (req.query.ate as string));
      }
      if (req.query.categoria_id) {
        const cid = parseInt(req.query.categoria_id as string, 10);
        lista = lista.filter((l) => l.categoria_id === cid);
      }
      if (req.query.caminhao_id) {
        const cid = parseInt(req.query.caminhao_id as string, 10);
        lista = lista.filter((l) => l.caminhao_id === cid);
      }
      if (req.query.viagem_id) {
        const vid = parseInt(req.query.viagem_id as string, 10);
        lista = lista.filter((l) => l.viagem_id === vid);
      }
      if (req.query.busca) {
        const q = String(req.query.busca).toLowerCase();
        lista = lista.filter(
          (l) =>
            (l.descricao && l.descricao.toLowerCase().includes(q)) ||
            (l.observacao && l.observacao.toLowerCase().includes(q)) ||
            (l.lugar && l.lugar.toLowerCase().includes(q)) ||
            (l.cliente && l.cliente.toLowerCase().includes(q))
        );
      }

      let entradas_centavos = 0;
      let saidas_centavos = 0;
      for (const item of lista) {
        if (item.tipo === 'entrada') entradas_centavos += item.valor_centavos;
        else saidas_centavos += item.valor_centavos;
      }

      const limite = Math.max(1, Math.min(1000, parseInt(req.query.limite as string, 10) || 100));
      const pagina = Math.max(1, parseInt(req.query.pagina as string, 10) || 1);
      const offset = (pagina - 1) * limite;

      const ordenados = [...lista]
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
        .slice(offset, offset + limite);

      return {
        itens: ordenados.map((l) => db.joinLancamento(l)),
        qtd: lista.length,
        entradas_centavos,
        saidas_centavos,
        saldo_centavos: entradas_centavos - saidas_centavos,
        pagina,
      };
    }

    case 'GET lancamento': {
      const eu = exigeLogin(req);
      const id = parseInt(req.query.id as string, 10);
      const l = db.lancamentos.find((x) => x.id === id);
      if (!l) throw new ErroDeUso('Lançamento não encontrado.', 404);
      if (eu.papel !== 'admin' && l.usuario_id !== eu.id) {
        throw new ErroDeUso('Sem acesso a este lançamento.', 403);
      }
      return db.joinLancamento(l);
    }

    case 'POST lancamentos': {
      const eu = exigeLogin(req);
      const corpo = req.body || {};
      const catId = parseInt(corpo.categoria_id, 10);
      const cat = db.categorias.find((c) => c.id === catId);
      if (!cat) throw new ErroDeUso('Categoria inválida.');
      if (eu.papel !== 'admin' && cat.tipo !== 'saida') {
        throw new ErroDeUso('Somente o proprietário lança entradas.', 403);
      }

      const targetUserId = eu.papel === 'admin' && corpo.usuario_id ? parseInt(corpo.usuario_id, 10) : eu.id;

      // Parse centavos
      let valorStr = String(corpo.valor ?? '').replace(/\s|R\$/gi, '');
      if (valorStr.includes(',') && valorStr.includes('.')) {
        valorStr = valorStr.replace(/\./g, '').replace(',', '.');
      } else if (valorStr.includes(',')) {
        valorStr = valorStr.replace(',', '.');
      }
      const valorNum = parseFloat(valorStr);
      if (isNaN(valorNum) || valorNum <= 0) {
        throw new ErroDeUso('Valor inválido. Use apenas números, como 1250,90.');
      }
      const valor_centavos = Math.round(valorNum * 100);

      const agora = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const id = db.addLancamento({
        tipo: cat.tipo,
        usuario_id: targetUserId,
        viagem_id: corpo.viagem_id ? parseInt(corpo.viagem_id, 10) : null,
        caminhao_id: corpo.caminhao_id ? parseInt(corpo.caminhao_id, 10) : null,
        categoria_id: catId,
        descricao: corpo.descricao ? String(corpo.descricao).trim() : null,
        valor_centavos,
        litros: corpo.litros ? parseFloat(String(corpo.litros).replace(',', '.')) : null,
        km: corpo.km ? parseInt(corpo.km, 10) : null,
        data: String(corpo.data || '').trim() || new Date().toISOString().slice(0, 10),
        pagamento: corpo.pagamento ? String(corpo.pagamento).trim() : null,
        lugar: corpo.lugar ? String(corpo.lugar).trim() : null,
        cliente: corpo.cliente ? String(corpo.cliente).trim() : null,
        observacao: corpo.observacao ? String(corpo.observacao).trim() : null,
        comprovante: corpo.comprovante ? String(corpo.comprovante).trim() : null,
        criado_em: agora,
        criado_por: eu.id,
        atualizado_em: null,
        atualizado_por: null,
      });

      const novo = db.joinLancamento(db.lancamentos.find((l) => l.id === id)!);
      if (eu.papel !== 'admin') {
        const desc = novo.descricao ? ` - ${novo.descricao}` : '';
        const resumo = `${novo.categoria}${desc} · ${pdfReais(novo.valor_centavos)} · ${pdfData(novo.data)}`;
        db.addAviso(eu.id, 'criou', novo.tipo, id, resumo);
      }
      return novo;
    }

    case 'PUT lancamento': {
      const eu = exigeLogin(req);
      const id = parseInt(req.query.id as string, 10);
      const atual = db.lancamentos.find((l) => l.id === id);
      if (!atual) throw new ErroDeUso('Lançamento não encontrado.', 404);
      if (eu.papel !== 'admin' && atual.usuario_id !== eu.id) {
        throw new ErroDeUso('Você só pode editar os seus próprios gastos.', 403);
      }

      const corpo = req.body || {};
      const catId = parseInt(corpo.categoria_id, 10) || atual.categoria_id;
      const cat = db.categorias.find((c) => c.id === catId);
      if (!cat) throw new ErroDeUso('Categoria inválida.');

      let valor_centavos = atual.valor_centavos;
      if (corpo.valor !== undefined && corpo.valor !== null) {
        let valorStr = String(corpo.valor).replace(/\s|R\$/gi, '');
        if (valorStr.includes(',') && valorStr.includes('.')) {
          valorStr = valorStr.replace(/\./g, '').replace(',', '.');
        } else if (valorStr.includes(',')) {
          valorStr = valorStr.replace(',', '.');
        }
        const valorNum = parseFloat(valorStr);
        if (!isNaN(valorNum) && valorNum > 0) {
          valor_centavos = Math.round(valorNum * 100);
        }
      }

      const agora = new Date().toISOString().replace('T', ' ').slice(0, 19);
      db.updateLancamento(id, {
        tipo: cat.tipo,
        categoria_id: catId,
        viagem_id: corpo.viagem_id ? parseInt(corpo.viagem_id, 10) : null,
        caminhao_id: corpo.caminhao_id ? parseInt(corpo.caminhao_id, 10) : null,
        descricao: corpo.descricao !== undefined ? (corpo.descricao ? String(corpo.descricao).trim() : null) : atual.descricao,
        valor_centavos,
        litros: corpo.litros ? parseFloat(String(corpo.litros).replace(',', '.')) : null,
        km: corpo.km ? parseInt(corpo.km, 10) : null,
        data: corpo.data ? String(corpo.data).trim() : atual.data,
        pagamento: corpo.pagamento ? String(corpo.pagamento).trim() : null,
        lugar: corpo.lugar ? String(corpo.lugar).trim() : null,
        cliente: corpo.cliente ? String(corpo.cliente).trim() : null,
        observacao: corpo.observacao ? String(corpo.observacao).trim() : null,
        comprovante: corpo.comprovante ? String(corpo.comprovante).trim() : atual.comprovante,
        atualizado_em: agora,
        atualizado_por: eu.id,
      });

      const editado = db.joinLancamento(db.lancamentos.find((l) => l.id === id)!);
      if (eu.papel !== 'admin') {
        const desc = editado.descricao ? ` - ${editado.descricao}` : '';
        const resumo = `${editado.categoria}${desc} · ${pdfReais(editado.valor_centavos)} · ${pdfData(editado.data)}`;
        db.addAviso(eu.id, 'editou', editado.tipo, id, resumo);
      }
      return editado;
    }

    case 'DELETE lancamento': {
      const eu = exigeLogin(req);
      const id = parseInt(req.query.id as string, 10);
      const atual = db.lancamentos.find((l) => l.id === id);
      if (!atual) throw new ErroDeUso('Lançamento não encontrado.', 404);
      if (eu.papel !== 'admin' && atual.usuario_id !== eu.id) {
        throw new ErroDeUso('Você só pode excluir os seus próprios gastos.', 403);
      }

      const completo = db.joinLancamento(atual);
      db.deleteLancamento(id);
      if (eu.papel !== 'admin') {
        const desc = completo.descricao ? ` - ${completo.descricao}` : '';
        const resumo = `${completo.categoria}${desc} · ${pdfReais(completo.valor_centavos)} · ${pdfData(completo.data)}`;
        db.addAviso(eu.id, 'excluiu', atual.tipo, null, resumo);
      }
      if (atual.comprovante) {
        const filePath = path.join(uploadsDir, atual.comprovante);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
      return { ok: true };
    }

    case 'GET avisos': {
      const eu = exigeLogin(req);
      const visto = db.avisosVistos.get(eu.id) ?? (db.avisos.length ? Math.max(...db.avisos.map((a) => a.id)) : 0);
      if (!db.avisosVistos.has(eu.id)) {
        db.avisosVistos.set(eu.id, visto);
      }

      let lista = db.avisos;
      if (eu.papel !== 'admin') {
        // Motoristas veem avisos das suas próprias ações e avisos gerais
        lista = lista.filter((a) => a.usuario_id === eu.id || !a.usuario_id);
      }

      const itens = [...lista]
        .sort((a, b) => b.id - a.id)
        .slice(0, 40)
        .map((a) => {
          const user = db.usuarios.find((u) => u.id === a.usuario_id);
          const createdAt = new Date(a.criado_em.replace(' ', 'T')).getTime();
          return {
            id: a.id,
            acao: a.acao,
            tipo: a.tipo,
            lancamento_id: a.lancamento_id,
            resumo: a.resumo,
            criado_em: a.criado_em,
            motorista: user ? user.nome : 'Motorista',
            novo: a.id > visto,
            segundos: Math.max(0, Math.round((Date.now() - createdAt) / 1000)),
          };
        });

      const maxId = lista.length ? Math.max(...lista.map((a) => a.id)) : 0;
      const nao_lidos = lista.filter((a) => a.id > visto).length;

      return {
        nao_lidos,
        ultimo_id: maxId,
        itens,
      };
    }

    case 'POST avisos-lidos': {
      const eu = exigeLogin(req);
      const lista = eu.papel === 'admin' ? db.avisos : db.avisos.filter((a) => a.usuario_id === eu.id || !a.usuario_id);
      const maxId = lista.length ? Math.max(...lista.map((a) => a.id)) : 0;
      db.avisosVistos.set(eu.id, maxId);
      return { ok: true };
    }

    case 'GET resumo': {
      exigeAdmin(req);
      const hoje = new Date().toISOString().slice(0, 7);
      let deMes = req.query.mes ? String(req.query.mes) : String(req.query.de || hoje);
      let ateMes = req.query.mes ? String(req.query.mes) : String(req.query.ate || hoje);
      if (deMes > ateMes) [deMes, ateMes] = [ateMes, deMes];

      const meses = mesesEntre(deMes, ateMes);
      const [de] = limitesDoMes(deMes);
      const [, ate] = limitesDoMes(ateMes);

      const antAteMes = mesAnterior(deMes);
      const [antDe] = limitesDoMes(mesesEntre(antAteMes, antAteMes)[0] || antAteMes);
      const [, antAte] = limitesDoMes(antAteMes);

      const getTotais = (inicio: string, fim: string) => {
        const filtered = db.lancamentos.filter((l) => l.data >= inicio && l.data <= fim);
        let entradas_centavos = 0;
        let saidas_centavos = 0;
        for (const l of filtered) {
          if (l.tipo === 'entrada') entradas_centavos += l.valor_centavos;
          else saidas_centavos += l.valor_centavos;
        }
        return {
          qtd: filtered.length,
          entradas_centavos,
          saidas_centavos,
          saldo_centavos: entradas_centavos - saidas_centavos,
        };
      };

      const filteredPeriodo = db.lancamentos.filter((l) => l.data >= de && l.data <= ate);

      let combustivelLitros = 0;
      let combustivelCentavos = 0;
      for (const l of filteredPeriodo) {
        const cat = db.categorias.find((c) => c.id === l.categoria_id);
        if (cat && cat.pede_litros) {
          combustivelLitros += l.litros || 0;
          combustivelCentavos += l.valor_centavos;
        }
      }

      // Group by category
      const porCategoria = (tipo: 'entrada' | 'saida') => {
        const catMap = new Map<number, { nome: string; icone: string; qtd: number; total_centavos: number }>();
        for (const l of filteredPeriodo) {
          if (l.tipo !== tipo) continue;
          const cat = db.categorias.find((c) => c.id === l.categoria_id);
          const nome = cat ? cat.nome : 'Outros';
          const icone = cat ? cat.icone : 'tag';
          const entry = catMap.get(l.categoria_id) || { nome, icone, qtd: 0, total_centavos: 0 };
          entry.qtd++;
          entry.total_centavos += l.valor_centavos;
          catMap.set(l.categoria_id, entry);
        }
        return Array.from(catMap.values()).sort((a, b) => b.total_centavos - a.total_centavos);
      };

      // Series month by month
      const serie = meses.map((m) => {
        const [mIni, mFim] = limitesDoMes(m);
        const mList = db.lancamentos.filter((l) => l.data >= mIni && l.data <= mFim);
        let entradas = 0;
        let saidas = 0;
        for (const l of mList) {
          if (l.tipo === 'entrada') entradas += l.valor_centavos;
          else saidas += l.valor_centavos;
        }
        return {
          mes: m,
          entradas_centavos: entradas,
          saidas_centavos: saidas,
          saldo_centavos: entradas - saidas,
          qtd: mList.length,
        };
      });

      // By truck
      const truckMap = new Map<number | null, any>();
      for (const c of db.caminhoes) {
        truckMap.set(c.id, {
          id: c.id,
          placa: c.placa,
          apelido: c.apelido,
          entradas_centavos: 0,
          saidas_centavos: 0,
          litros: 0,
          combustivel_centavos: 0,
          km_rodados: 0,
          qtd: 0,
        });
      }
      truckMap.set(null, {
        id: null,
        placa: 'Sem caminhão',
        apelido: null,
        entradas_centavos: 0,
        saidas_centavos: 0,
        litros: 0,
        combustivel_centavos: 0,
        km_rodados: 0,
        qtd: 0,
      });

      for (const l of filteredPeriodo) {
        const entry = truckMap.get(l.caminhao_id) || truckMap.get(null)!;
        entry.qtd++;
        if (l.tipo === 'entrada') entry.entradas_centavos += l.valor_centavos;
        else entry.saidas_centavos += l.valor_centavos;

        const cat = db.categorias.find((c) => c.id === l.categoria_id);
        if (cat && cat.pede_litros) {
          entry.litros += l.litros || 0;
          entry.combustivel_centavos += l.valor_centavos;
        }
      }

      // Calculate km from trips
      for (const v of db.viagens) {
        if (v.caminhao_id && v.km_final && v.km_inicial && v.inicio >= de && v.inicio <= ate) {
          const entry = truckMap.get(v.caminhao_id);
          if (entry) {
            entry.km_rodados += v.km_final - v.km_inicial;
          }
        }
      }

      const caminhoesList = Array.from(truckMap.values())
        .filter((c) => c.qtd > 0 || c.id !== null)
        .map((c) => ({
          ...c,
          saldo_centavos: c.entradas_centavos - c.saidas_centavos,
        }))
        .sort((a, b) => b.saidas_centavos - a.saidas_centavos);

      // By driver (gastos por motorista)
      const driverMap = new Map<number, { nome: string; qtd: number; total_centavos: number }>();
      for (const l of filteredPeriodo) {
        if (l.tipo !== 'saida') continue;
        const u = db.usuarios.find((x) => x.id === l.usuario_id);
        const nome = u ? u.nome : 'Desconhecido';
        const entry = driverMap.get(l.usuario_id) || { nome, qtd: 0, total_centavos: 0 };
        entry.qtd++;
        entry.total_centavos += l.valor_centavos;
        driverMap.set(l.usuario_id, entry);
      }

      // By day
      const dayMap = new Map<string, { data: string; entradas_centavos: number; saidas_centavos: number }>();
      for (const l of filteredPeriodo) {
        const entry = dayMap.get(l.data) || { data: l.data, entradas_centavos: 0, saidas_centavos: 0 };
        if (l.tipo === 'entrada') entry.entradas_centavos += l.valor_centavos;
        else entry.saidas_centavos += l.valor_centavos;
        dayMap.set(l.data, entry);
      }
      const porDia = Array.from(dayMap.values()).sort((a, b) => a.data.localeCompare(b.data));

      return {
        de: deMes,
        ate: ateMes,
        anterior_de: antAteMes,
        anterior_ate: antAteMes,
        atual: getTotais(de, ate),
        anterior: getTotais(antDe, antAte),
        litros: combustivelLitros,
        combustivel_centavos: combustivelCentavos,
        meses: serie,
        saidas_por_categoria: porCategoria('saida'),
        entradas_por_categoria: porCategoria('entrada'),
        por_caminhao: caminhoesList,
        por_motorista: Array.from(driverMap.values()).sort((a, b) => b.total_centavos - a.total_centavos),
        por_dia: porDia,
        viagens_abertas: db.viagens.filter((v) => v.status === 'aberta').length,
      };
    }

    case 'GET pdf': {
      exigeAdmin(req);
      let lista = [...db.lancamentos];
      if (req.query.mes) {
        const [de, ate] = limitesDoMes(req.query.mes as string);
        lista = lista.filter((l) => l.data >= de && l.data <= ate);
      }
      if (req.query.de) lista = lista.filter((l) => l.data >= (req.query.de as string));
      if (req.query.ate) lista = lista.filter((l) => l.data <= (req.query.ate as string));
      lista.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);

      const itens = lista.map((l) => db.joinLancamento(l));
      let entradas = 0;
      let saidas = 0;
      for (const l of itens) {
        if (l.tipo === 'entrada') entradas += l.valor_centavos;
        else saidas += l.valor_centavos;
      }

      const pdf = new Pdf();
      pdf.novaPagina();
      pdf.cabecalho('Lançamentos', NOME_SISTEMA);
      pdf.indicadores([
        ['Entradas', pdfReais(entradas), PDF_VERDE],
        ['Saídas', pdfReais(saidas), PDF_VERMELHO],
        ['Saldo', pdfReais(entradas - saidas), entradas - saidas >= 0 ? PDF_VERDE : PDF_VERMELHO],
        ['Lançamentos', String(itens.length), PDF_TINTA],
      ]);
      pdf.y += 6;

      pdf.tabela(
        [
          ['Data', 44], ['Tipo', 32], ['Categoria', 64], ['Descrição', 90], ['Valor', 54, true],
          ['Caminhão', 44], ['Motorista', 58], ['Viagem', 72], ['Litros', 30, true], ['Km', 34, true],
          ['Onde foi', 60], ['Quem pagou', 58], ['Pagamento', 52], ['Observação', 94],
        ],
        itens.map((l) => [
          pdfData(l.data),
          l.tipo === 'entrada' ? 'Entrada' : 'Saída',
          l.categoria || '',
          l.descricao || '',
          [pdfReais(l.valor_centavos), l.tipo === 'entrada' ? PDF_VERDE : PDF_VERMELHO],
          l.placa || '',
          l.motorista || '',
          l.viagem_origem ? `${l.viagem_origem} > ${l.viagem_destino}` : '',
          l.litros ? pdfNumero(l.litros, 2) : '',
          l.km ? pdfNumero(l.km) : '',
          l.lugar || '',
          l.cliente || '',
          l.pagamento || '',
          l.observacao || '',
        ]),
        'Nenhum lançamento encontrado.'
      );

      const buffer = pdf.gera();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="lancamentos-${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
      return;
    }

    case 'GET pdf-panorama': {
      exigeAdmin(req);
      const hoje = new Date().toISOString().slice(0, 7);
      const deMes = (req.query.mes as string) || (req.query.de as string) || hoje;
      const ateMes = (req.query.mes as string) || (req.query.ate as string) || hoje;
      const [de] = limitesDoMes(deMes);
      const [, ate] = limitesDoMes(ateMes);

      const filtered = db.lancamentos.filter((l) => l.data >= de && l.data <= ate);
      let entradas = 0;
      let saidas = 0;
      for (const l of filtered) {
        if (l.tipo === 'entrada') entradas += l.valor_centavos;
        else saidas += l.valor_centavos;
      }

      const pdf = new Pdf();
      pdf.novaPagina();
      pdf.cabecalho('Panorama', `${NOME_SISTEMA} · ${periodoPorExtenso(deMes, ateMes)}`);
      pdf.indicadores([
        ['Entradas (fretes)', pdfReais(entradas), PDF_VERDE],
        ['Saídas (gastos)', pdfReais(saidas), PDF_VERMELHO],
        ['Saldo', pdfReais(entradas - saidas), entradas - saidas >= 0 ? PDF_VERDE : PDF_VERMELHO],
        ['Lançamentos', String(filtered.length), PDF_TINTA],
        ['Viagens abertas hoje', String(db.viagens.filter((v) => v.status === 'aberta').length), PDF_TINTA],
      ]);
      pdf.y += 10;

      pdf.secao('Lançamentos do período');
      pdf.tabela(
        [
          ['Data', 44], ['Tipo', 32], ['Categoria', 64], ['Descrição', 90], ['Valor', 54, true],
          ['Caminhão', 44], ['Motorista', 58], ['Viagem', 72], ['Litros', 30, true], ['Km', 34, true],
          ['Onde foi', 60], ['Quem pagou', 58], ['Pagamento', 52], ['Observação', 94],
        ],
        filtered.map((l) => {
          const item = db.joinLancamento(l);
          return [
            pdfData(item.data),
            item.tipo === 'entrada' ? 'Entrada' : 'Saída',
            item.categoria || '',
            item.descricao || '',
            [pdfReais(item.valor_centavos), item.tipo === 'entrada' ? PDF_VERDE : PDF_VERMELHO],
            item.placa || '',
            item.motorista || '',
            item.viagem_origem ? `${item.viagem_origem} > ${item.viagem_destino}` : '',
            item.litros ? pdfNumero(item.litros, 2) : '',
            item.km ? pdfNumero(item.km) : '',
            item.lugar || '',
            item.cliente || '',
            item.pagamento || '',
            item.observacao || '',
          ];
        }),
        'Nenhum lançamento no período.'
      );

      const buffer = pdf.gera();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="panorama-${deMes}-a-${ateMes}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
      return;
    }

    case 'GET comprovante': {
      const eu = exigeLogin(req);
      const arquivo = String(req.query.arquivo || '');
      if (!/^[A-Za-z0-9._-]+$/.test(arquivo) || arquivo.includes('..')) {
        throw new ErroDeUso('Arquivo inválido.');
      }
      const l = db.lancamentos.find((x) => x.comprovante === arquivo);
      if (l && eu.papel !== 'admin' && l.usuario_id !== eu.id) {
        throw new ErroDeUso('Sem acesso a este comprovante.', 403);
      }
      const fullPath = path.join(uploadsDir, arquivo);
      if (!fs.existsSync(fullPath)) {
        throw new ErroDeUso('Comprovante não encontrado.', 404);
      }
      return res.sendFile(fullPath);
    }
  }

  throw new ErroDeUso('Endereço não encontrado.', 404);
}

// Special handler for POST comprovante (with multer)
app.post(['/api.php', '/frota/api.php'], (req: Request, res: Response, next: NextFunction) => {
  if (req.query.r === 'comprovante') {
    upload.single('foto')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ erro: err.message || 'Erro ao enviar foto.' });
      }
      try {
        exigeLogin(req);
        if (!req.file) {
          throw new ErroDeUso('Não foi possível receber a foto. Tente de novo.');
        }
        res.json({ comprovante: req.file.filename });
      } catch (e: any) {
        res.status(e.status || 400).json({ erro: e.message });
      }
    });
    return;
  }
  next();
});

// All other API requests
app.all(['/api.php', '/frota/api.php'], async (req: Request, res: Response) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    exigePedidoDoApp(req);
    const resultado = await despacha(req, res);
    if (!res.headersSent && resultado !== undefined) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.json(resultado);
    }
  } catch (err: any) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 400;
    res.status(status).json({ erro: err.message || 'Erro interno.' });
  }
});

// Serve static assets from public/ and uploads/
app.use(express.static(path.resolve(process.cwd(), 'public')));
app.use('/frota/assets', express.static(path.resolve(process.cwd(), 'public/assets')));
app.use('/frota', express.static(path.resolve(process.cwd(), 'public')));
app.use('/uploads', express.static(uploadsDir));

// Fallback HTML handler for root, /frota, /index.php, etc.
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'public/index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`[Frota] Servidor rodando em http://${HOST}:${PORT}`);
});
