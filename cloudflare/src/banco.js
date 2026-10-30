import bcrypt from 'bcryptjs';
import { conf, agora, ADMIN_NOME, ADMIN_USUARIO } from './util.js';

// Sobe sempre que a estrutura muda; bancos antigos ganham as tabelas e colunas novas
// na primeira visita depois da atualização, sem perder nada. É o mesmo esquema do PHP.
const VERSAO_ESQUEMA = 3;

// Uma vez conferido, o mesmo processo do Worker não pergunta de novo a cada pedido.
let esquemaConferido = false;

export async function criaEstrutura(db) {
  if (esquemaConferido) return;
  let versao = 0;
  try {
    versao = Number((await db.query('SELECT MAX(versao) AS v FROM esquema')).rows[0]?.v ?? 0);
  } catch {
    versao = 0;
  }
  if (versao >= VERSAO_ESQUEMA) {
    esquemaConferido = true;
    return;
  }
  const sql = estruturaSql();
  for (const comando of sql.tabelas) await db.query(comando);
  const novasColunas = await migraColunas(db, sql.colunas);
  for (const comando of sql.indices) {
    try {
      await db.query(comando);
    } catch {
      // Índice já existe.
    }
  }
  await semeia(db, novasColunas);
  await db.query('DELETE FROM esquema');
  await db.query(`INSERT INTO esquema (versao) VALUES (${VERSAO_ESQUEMA})`);
  esquemaConferido = true;
}

async function migraColunas(db, colunas) {
  const criadas = [];
  for (const [tabela, coluna, definicao] of colunas) {
    try {
      await db.query(`SELECT ${coluna} FROM ${tabela} WHERE 1 = 0`);
      continue;
    } catch {
      // A coluna ainda não existe.
    }
    try {
      await db.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
      criadas.push(`${tabela}.${coluna}`);
    } catch {
      // Outro pedido criou ao mesmo tempo.
    }
  }
  return criadas;
}

function estruturaSql() {
  const id = 'SERIAL PRIMARY KEY';
  const ref = 'INTEGER';
  const simNao = 'SMALLINT';
  const decimal = 'NUMERIC(12,3)';
  const dataHora = 'TIMESTAMP';
  const data = 'DATE';
  const dinheiro = 'BIGINT';

  const tabelas = {};

  tabelas.usuarios = `
    id          ${id},
    nome        VARCHAR(80)  NOT NULL,
    usuario     VARCHAR(40)  NOT NULL,
    senha_hash  VARCHAR(255) NOT NULL,
    papel       VARCHAR(12)  NOT NULL,
    telefone    VARCHAR(30)      NULL,
    caminhao_padrao_id    ${ref}      NULL,
    valor_diaria_centavos ${dinheiro} NULL,
    ativo       ${simNao}    NOT NULL,
    criado_em   ${dataHora}  NOT NULL,
    UNIQUE (usuario)`;

  tabelas.caminhoes = `
    id        ${id},
    placa     VARCHAR(10) NOT NULL,
    apelido   VARCHAR(60)     NULL,
    ativo     ${simNao}   NOT NULL,
    criado_em ${dataHora} NOT NULL,
    UNIQUE (placa)`;

  tabelas.categorias = `
    id             ${id},
    nome           VARCHAR(40) NOT NULL,
    tipo           VARCHAR(10) NOT NULL,
    icone          VARCHAR(20) NOT NULL,
    pede_litros    ${simNao}   NOT NULL,
    pede_descricao ${simNao}   NOT NULL,
    oculta_motorista ${simNao} NOT NULL DEFAULT 0,
    ordem          INT         NOT NULL,
    ativo          ${simNao}   NOT NULL,
    UNIQUE (nome, tipo)`;

  tabelas.viagens = `
    id          ${id},
    usuario_id  ${ref}      NOT NULL,
    caminhao_id ${ref}          NULL,
    origem      VARCHAR(80) NOT NULL,
    destino     VARCHAR(80) NOT NULL,
    inicio      ${data}     NOT NULL,
    fim         ${data}         NULL,
    km_inicial  INT             NULL,
    km_final    INT             NULL,
    status      VARCHAR(10) NOT NULL,
    observacao  VARCHAR(500)    NULL,
    criado_em   ${dataHora} NOT NULL,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
    FOREIGN KEY (caminhao_id) REFERENCES caminhoes(id)`;

  tabelas.lancamentos = `
    id             ${id},
    tipo           VARCHAR(10)  NOT NULL,
    usuario_id     ${ref}       NOT NULL,
    viagem_id      ${ref}           NULL,
    caminhao_id    ${ref}           NULL,
    categoria_id   ${ref}       NOT NULL,
    descricao      VARCHAR(140)     NULL,
    valor_centavos ${dinheiro}  NOT NULL,
    litros         ${decimal}       NULL,
    km             INT              NULL,
    data           ${data}      NOT NULL,
    pagamento      VARCHAR(30)      NULL,
    lugar          VARCHAR(90)      NULL,
    cliente        VARCHAR(90)      NULL,
    observacao     VARCHAR(500)     NULL,
    comprovante    VARCHAR(120)     NULL,
    recebivel_id   ${ref}           NULL,
    criado_em      ${dataHora}  NOT NULL,
    criado_por     ${ref}           NULL,
    atualizado_em  ${dataHora}      NULL,
    atualizado_por ${ref}           NULL,
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (caminhao_id)  REFERENCES caminhoes(id),
    FOREIGN KEY (viagem_id)    REFERENCES viagens(id)`;

  tabelas.notas_fiscais = `
    id             ${id},
    usuario_id     ${ref}       NOT NULL,
    numero         VARCHAR(40)      NULL,
    cliente        VARCHAR(90)      NULL,
    data           ${data}      NOT NULL,
    valor_centavos ${dinheiro}      NULL,
    viagem_id      ${ref}           NULL,
    caminhao_id    ${ref}           NULL,
    arquivo        VARCHAR(120) NOT NULL,
    observacao     VARCHAR(500)     NULL,
    criado_em      ${dataHora}  NOT NULL,
    atualizado_em  ${dataHora}      NULL,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
    FOREIGN KEY (viagem_id)   REFERENCES viagens(id),
    FOREIGN KEY (caminhao_id) REFERENCES caminhoes(id)`;

  tabelas.recebiveis = `
    id             ${id},
    cliente        VARCHAR(90)  NOT NULL,
    descricao      VARCHAR(140)     NULL,
    categoria_id   ${ref}       NOT NULL,
    valor_centavos ${dinheiro}  NOT NULL,
    data           ${data}      NOT NULL,
    vencimento     ${data}          NULL,
    viagem_id      ${ref}           NULL,
    caminhao_id    ${ref}           NULL,
    nota_fiscal_id ${ref}           NULL,
    observacao     VARCHAR(500)     NULL,
    criado_em      ${dataHora}  NOT NULL,
    criado_por     ${ref}           NULL,
    FOREIGN KEY (categoria_id)   REFERENCES categorias(id),
    FOREIGN KEY (viagem_id)      REFERENCES viagens(id),
    FOREIGN KEY (caminhao_id)    REFERENCES caminhoes(id),
    FOREIGN KEY (nota_fiscal_id) REFERENCES notas_fiscais(id)`;

  tabelas.diarias = `
    id             ${id},
    usuario_id     ${ref}       NOT NULL,
    data           ${data}      NOT NULL,
    valor_centavos ${dinheiro}  NOT NULL,
    viagem_id      ${ref}           NULL,
    observacao     VARCHAR(200)     NULL,
    lancamento_id  ${ref}           NULL,
    criado_em      ${dataHora}  NOT NULL,
    criado_por     ${ref}           NULL,
    UNIQUE (usuario_id, data),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (viagem_id)  REFERENCES viagens(id)`;

  tabelas.avisos = `
    id            ${id},
    usuario_id    ${ref}       NOT NULL,
    acao          VARCHAR(12)  NOT NULL,
    tipo          VARCHAR(10)  NOT NULL,
    lancamento_id ${ref}           NULL,
    resumo        VARCHAR(200) NOT NULL,
    para_usuario_id ${ref}         NULL,
    criado_em     ${dataHora}  NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)`;

  tabelas.esquema = `
    versao INT NOT NULL`;

  tabelas.avisos_vistos = `
    usuario_id ${ref} NOT NULL PRIMARY KEY,
    ultimo_id  INT    NOT NULL`;

  tabelas.tentativas_login = `
    chave VARCHAR(120) NOT NULL PRIMARY KEY,
    n     INT          NOT NULL,
    desde ${dataHora}  NOT NULL`;

  tabelas.inscricoes_push = `
    id            ${id},
    usuario_id    ${ref}       NOT NULL,
    endpoint_hash VARCHAR(64)  NOT NULL,
    endpoint      TEXT         NOT NULL,
    p256dh        VARCHAR(120) NOT NULL,
    auth          VARCHAR(60)  NOT NULL,
    criado_em     ${dataHora}  NOT NULL,
    UNIQUE (endpoint_hash)`;

  tabelas.envios_fila = `
    id         VARCHAR(40) NOT NULL PRIMARY KEY,
    usuario_id ${ref}      NOT NULL,
    resposta   TEXT            NULL,
    criado_em  ${dataHora} NOT NULL`;

  tabelas.configuracoes = `
    chave VARCHAR(40) NOT NULL PRIMARY KEY,
    valor TEXT        NOT NULL`;

  tabelas.sessoes = `
    id     VARCHAR(128) NOT NULL PRIMARY KEY,
    dados  TEXT         NOT NULL,
    expira BIGINT       NOT NULL`;

  tabelas.comprovantes = `
    nome      VARCHAR(120) NOT NULL PRIMARY KEY,
    dados     BYTEA        NOT NULL,
    criado_em ${dataHora}  NOT NULL`;

  const indices = {
    idx_lanc_data: 'lancamentos (data)',
    idx_lanc_tipo: 'lancamentos (tipo, data)',
    idx_lanc_usuario: 'lancamentos (usuario_id)',
    idx_lanc_viagem: 'lancamentos (viagem_id)',
    idx_viagem_usuario: 'viagens (usuario_id)',
    idx_lanc_recebivel: 'lancamentos (recebivel_id)',
    idx_nota_usuario: 'notas_fiscais (usuario_id)',
    idx_diaria_data: 'diarias (data)',
    idx_push_usuario: 'inscricoes_push (usuario_id)',
  };

  return {
    tabelas: Object.entries(tabelas).map(([nome, corpo]) => `CREATE TABLE IF NOT EXISTS ${nome} (${corpo})`),
    indices: Object.entries(indices).map(([nome, alvo]) => `CREATE INDEX ${nome} ON ${alvo}`),
    colunas: [
      ['usuarios', 'caminhao_padrao_id', `${ref} NULL`],
      ['usuarios', 'valor_diaria_centavos', `${dinheiro} NULL`],
      ['categorias', 'oculta_motorista', `${simNao} NOT NULL DEFAULT 0`],
      ['lancamentos', 'recebivel_id', `${ref} NULL`],
      ['avisos', 'para_usuario_id', `${ref} NULL`],
    ],
  };
}

const CATEGORIAS = [
  ['Abastecimento', 'saida', 'fuel', 1, 0, 10],
  ['Salário do motorista', 'saida', 'salario', 0, 0, 20],
  ['Diárias de motorista', 'saida', 'salario', 0, 0, 25],
  ['Manutenção', 'saida', 'wrench', 0, 0, 30],
  ['Pneus', 'saida', 'tire', 0, 0, 40],
  ['Pedágio', 'saida', 'road', 0, 0, 50],
  ['Seguro', 'saida', 'shield', 0, 0, 60],
  ['IPVA e licenciamento', 'saida', 'doc', 0, 0, 70],
  ['Peças e acessórios', 'saida', 'parts', 0, 0, 80],
  ['Alimentação', 'saida', 'food', 0, 0, 90],
  ['Hospedagem', 'saida', 'bed', 0, 0, 100],
  ['Lavagem', 'saida', 'wash', 0, 0, 110],
  ['Multas', 'saida', 'alert', 0, 0, 120],
  ['Outro gasto', 'saida', 'tag', 0, 1, 999],
  ['Frete de grãos', 'entrada', 'graos', 0, 0, 10],
  ['Frete de calcário', 'entrada', 'calcario', 0, 0, 20],
  ['Outro frete', 'entrada', 'truck', 0, 1, 30],
  ['Outra entrada', 'entrada', 'plus', 0, 1, 999],
];

async function semeia(db, novasColunas) {
  const conta = async (sql, args = []) => Number((await db.query(sql, args)).rows[0].n);

  if (await conta('SELECT COUNT(*) AS n FROM categorias') === 0) {
    for (const c of CATEGORIAS) {
      await db.query(
        `INSERT INTO categorias (nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, 1)`,
        c
      );
    }
  } else if (await conta('SELECT COUNT(*) AS n FROM categorias WHERE nome = $1 AND tipo = $2',
    ['Diárias de motorista', 'saida']) === 0) {
    await db.query(
      `INSERT INTO categorias (nome, tipo, icone, pede_litros, pede_descricao, ordem, ativo)
       VALUES ('Diárias de motorista', 'saida', 'salario', 0, 0, 25, 1)`
    );
  }

  // Pagamento do motorista não aparece na lista de gastos dele.
  if (novasColunas.includes('categorias.oculta_motorista')
    || await conta('SELECT COUNT(*) AS n FROM categorias WHERE oculta_motorista = 1') === 0) {
    await db.query(
      `UPDATE categorias SET oculta_motorista = 1
        WHERE tipo = 'saida' AND nome IN ('Salário do motorista', 'Diárias de motorista')`
    );
  }

  if (await conta("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin'") === 0) {
    await db.query(
      `INSERT INTO usuarios (nome, usuario, senha_hash, papel, ativo, criado_em)
       VALUES ($1, $2, $3, 'admin', 1, $4)`,
      [ADMIN_NOME, ADMIN_USUARIO.toLowerCase(), await hashSenha(conf('ADMIN_SENHA', 'admin123')), agora()]
    );
  }
}

// bcrypt, o mesmo formato do password_hash() do PHP: as senhas de antes continuam valendo
// e, se um dia voltar para o PHP, as senhas criadas aqui também.
export function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

export function confereSenha(senha, hash) {
  const h = String(hash || '');
  if (!/^\$2[aby]\$/.test(h)) return Promise.resolve(false);
  return bcrypt.compare(senha, h.replace(/^\$2y\$/, '$2b$'));
}
