import bcrypt from 'bcryptjs';
import { Usuario, Caminhao, Categoria, Viagem, Lancamento, Aviso } from './types.js';

export class Database {
  usuarios: Usuario[] = [];
  caminhoes: Caminhao[] = [];
  categorias: Categoria[] = [];
  viagens: Viagem[] = [];
  lancamentos: Lancamento[] = [];
  avisos: Aviso[] = [];
  avisosVistos: Map<number, number> = new Map();
  tentativasLogin: Map<string, { n: number; desde: number }> = new Map();
  sessoes: Map<string, { usuarioId: number; expira: number }> = new Map();

  private nextUsuarioId = 1;
  private nextCaminhaoId = 1;
  private nextCategoriaId = 1;
  private nextViagemId = 1;
  private nextLancamentoId = 1;
  private nextAvisoId = 1;

  constructor() {
    this.seed();
  }

  private seed() {
    // 17 default categories from banco.php
    const categoriasData: [string, 'entrada' | 'saida', string, number, number, number][] = [
      ['Abastecimento', 'saida', 'fuel', 1, 0, 10],
      ['Salário do motorista', 'saida', 'salario', 0, 0, 20],
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

    for (const [nome, tipo, icone, pede_litros, pede_descricao, ordem] of categoriasData) {
      this.categorias.push({
        id: this.nextCategoriaId++,
        nome,
        tipo,
        icone,
        pede_litros,
        pede_descricao,
        ordem,
        ativo: 1,
      });
    }

    const agora = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Admin user
    const adminSenha = process.env.ADMIN_SENHA || 'admin123';
    this.usuarios.push({
      id: this.nextUsuarioId++,
      nome: 'Proprietário',
      usuario: (process.env.ADMIN_USUARIO || 'admin').toLowerCase(),
      senha_hash: bcrypt.hashSync(adminSenha, 10),
      papel: 'admin',
      telefone: '(11) 99999-0000',
      ativo: 1,
      criado_em: agora,
    });

    // Sample driver
    this.usuarios.push({
      id: this.nextUsuarioId++,
      nome: 'Carlos Silva',
      usuario: 'carlos',
      senha_hash: bcrypt.hashSync('1234', 10),
      papel: 'motorista',
      telefone: '(11) 98888-1111',
      ativo: 1,
      criado_em: agora,
    });

    // Sample trucks
    this.caminhoes.push({
      id: this.nextCaminhaoId++,
      placa: 'BRA2E19',
      apelido: 'Scania R450 Branca',
      ativo: 1,
      criado_em: agora,
    });
    this.caminhoes.push({
      id: this.nextCaminhaoId++,
      placa: 'FRO1T24',
      apelido: 'Volvo FH 540 Azul',
      ativo: 1,
      criado_em: agora,
    });

    // Sample initial data for realistic feel
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const d01 = `${ano}-${mes}-01`;
    const d02 = `${ano}-${mes}-02`;
    const d03 = `${ano}-${mes}-03`;
    const d05 = `${ano}-${mes}-05`;
    const d10 = `${ano}-${mes}-10`;

    this.viagens.push({
      id: this.nextViagemId++,
      usuario_id: 2,
      caminhao_id: 1,
      origem: 'Rondonópolis - MT',
      destino: 'Santos - SP',
      inicio: d01,
      fim: d05,
      km_inicial: 145000,
      km_final: 146650,
      status: 'encerrada',
      observacao: 'Carga de soja entregue sem avarias',
      criado_em: agora,
    });

    this.viagens.push({
      id: this.nextViagemId++,
      usuario_id: 2,
      caminhao_id: 1,
      origem: 'Santos - SP',
      destino: 'Uberlândia - MG',
      inicio: d10,
      fim: null,
      km_inicial: 146700,
      km_final: null,
      status: 'aberta',
      observacao: 'Retorno com adubo',
      criado_em: agora,
    });

    // Entries for trip 1
    const catFreteGraos = this.categorias.find((c) => c.nome === 'Frete de grãos')!.id;
    const catCombustivel = this.categorias.find((c) => c.nome === 'Abastecimento')!.id;
    const catPedagio = this.categorias.find((c) => c.nome === 'Pedágio')!.id;
    const catAlimentacao = this.categorias.find((c) => c.nome === 'Alimentação')!.id;

    this.lancamentos.push({
      id: this.nextLancamentoId++,
      tipo: 'entrada',
      usuario_id: 1,
      viagem_id: 1,
      caminhao_id: 1,
      categoria_id: catFreteGraos,
      descricao: '45 toneladas de soja para exportação',
      valor_centavos: 1850000, // R$ 18.500,00
      litros: null,
      km: null,
      data: d01,
      pagamento: 'Pix',
      lugar: 'Rondonópolis',
      cliente: 'Agro Exportadora S/A',
      observacao: 'Frete negociado fechado',
      comprovante: null,
      criado_em: agora,
      criado_por: 1,
      atualizado_em: null,
      atualizado_por: null,
    });

    this.lancamentos.push({
      id: this.nextLancamentoId++,
      tipo: 'saida',
      usuario_id: 2,
      viagem_id: 1,
      caminhao_id: 1,
      categoria_id: catCombustivel,
      descricao: null,
      valor_centavos: 425000, // R$ 4.250,00
      litros: 708.33,
      km: 145000,
      data: d01,
      pagamento: 'Cartão frete',
      lugar: 'Posto Rondon',
      cliente: null,
      observacao: null,
      comprovante: null,
      criado_em: agora,
      criado_por: 2,
      atualizado_em: null,
      atualizado_por: null,
    });

    this.lancamentos.push({
      id: this.nextLancamentoId++,
      tipo: 'saida',
      usuario_id: 2,
      viagem_id: 1,
      caminhao_id: 1,
      categoria_id: catPedagio,
      descricao: null,
      valor_centavos: 68000, // R$ 680,00
      litros: null,
      km: null,
      data: d02,
      pagamento: 'Dinheiro',
      lugar: 'Praças BR-163',
      cliente: null,
      observacao: null,
      comprovante: null,
      criado_em: agora,
      criado_por: 2,
      atualizado_em: null,
      atualizado_por: null,
    });

    this.lancamentos.push({
      id: this.nextLancamentoId++,
      tipo: 'saida',
      usuario_id: 2,
      viagem_id: 1,
      caminhao_id: 1,
      categoria_id: catAlimentacao,
      descricao: null,
      valor_centavos: 12000, // R$ 120,00
      litros: null,
      km: null,
      data: d03,
      pagamento: 'Pix',
      lugar: 'Restaurante do Gaúcho',
      cliente: null,
      observacao: 'Almoço e jantar',
      comprovante: null,
      criado_em: agora,
      criado_por: 2,
      atualizado_em: null,
      atualizado_por: null,
    });

    this.avisos.push({
      id: this.nextAvisoId++,
      usuario_id: 2,
      acao: 'criou',
      tipo: 'saida',
      lancamento_id: 2,
      resumo: 'Abastecimento · R$ 4.250,00 · ' + d01.split('-').reverse().join('/'),
      criado_em: agora,
    });
  }

  // User methods
  addUsuario(data: Omit<Usuario, 'id' | 'criado_em'>): number {
    const id = this.nextUsuarioId++;
    const criado_em = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.usuarios.push({ ...data, id, criado_em });
    return id;
  }

  updateUsuario(id: number, data: Partial<Usuario>) {
    const idx = this.usuarios.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.usuarios[idx] = { ...this.usuarios[idx], ...data };
      return true;
    }
    return false;
  }

  deleteUsuario(id: number) {
    const idx = this.usuarios.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.usuarios.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Truck methods
  addCaminhao(data: Omit<Caminhao, 'id' | 'criado_em'>): number {
    const id = this.nextCaminhaoId++;
    const criado_em = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.caminhoes.push({ ...data, id, criado_em });
    return id;
  }

  updateCaminhao(id: number, data: Partial<Caminhao>) {
    const idx = this.caminhoes.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.caminhoes[idx] = { ...this.caminhoes[idx], ...data };
      return true;
    }
    return false;
  }

  deleteCaminhao(id: number) {
    const idx = this.caminhoes.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.caminhoes.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Category methods
  addCategoria(data: Omit<Categoria, 'id'>): number {
    const id = this.nextCategoriaId++;
    this.categorias.push({ ...data, id });
    return id;
  }

  updateCategoria(id: number, data: Partial<Categoria>) {
    const idx = this.categorias.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.categorias[idx] = { ...this.categorias[idx], ...data };
      return true;
    }
    return false;
  }

  deleteCategoria(id: number) {
    const idx = this.categorias.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.categorias.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Trip methods
  addViagem(data: Omit<Viagem, 'id' | 'criado_em'>): number {
    const id = this.nextViagemId++;
    const criado_em = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.viagens.push({ ...data, id, criado_em });
    return id;
  }

  updateViagem(id: number, data: Partial<Viagem>) {
    const idx = this.viagens.findIndex((v) => v.id === id);
    if (idx >= 0) {
      this.viagens[idx] = { ...this.viagens[idx], ...data };
      return true;
    }
    return false;
  }

  deleteViagem(id: number) {
    const idx = this.viagens.findIndex((v) => v.id === id);
    if (idx >= 0) {
      // Unlink lancamentos
      for (const l of this.lancamentos) {
        if (l.viagem_id === id) l.viagem_id = null;
      }
      this.viagens.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Lancamento methods
  addLancamento(data: Omit<Lancamento, 'id'>): number {
    const id = this.nextLancamentoId++;
    this.lancamentos.push({ ...data, id });
    return id;
  }

  updateLancamento(id: number, data: Partial<Lancamento>) {
    const idx = this.lancamentos.findIndex((l) => l.id === id);
    if (idx >= 0) {
      this.lancamentos[idx] = { ...this.lancamentos[idx], ...data };
      return true;
    }
    return false;
  }

  deleteLancamento(id: number) {
    const idx = this.lancamentos.findIndex((l) => l.id === id);
    if (idx >= 0) {
      // Unlink from avisos
      for (const a of this.avisos) {
        if (a.lancamento_id === id) a.lancamento_id = null;
      }
      this.lancamentos.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Aviso methods
  addAviso(usuarioId: number, acao: string, tipo: string, lancamentoId: number | null, resumo: string) {
    const id = this.nextAvisoId++;
    const criado_em = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.avisos.push({
      id,
      usuario_id: usuarioId,
      acao,
      tipo,
      lancamento_id: lancamentoId,
      resumo: resumo.slice(0, 200),
      criado_em,
    });
    return id;
  }

  // Join helpers
  joinLancamento(l: Lancamento) {
    const cat = this.categorias.find((c) => c.id === l.categoria_id);
    const user = this.usuarios.find((u) => u.id === l.usuario_id);
    const truck = l.caminhao_id ? this.caminhoes.find((c) => c.id === l.caminhao_id) : null;
    const trip = l.viagem_id ? this.viagens.find((v) => v.id === l.viagem_id) : null;

    return {
      ...l,
      categoria: cat ? cat.nome : '',
      icone: cat ? cat.icone : 'tag',
      categoria_tipo: cat ? cat.tipo : l.tipo,
      pede_litros: cat ? cat.pede_litros : 0,
      pede_descricao: cat ? cat.pede_descricao : 0,
      motorista: user ? user.nome : 'Motorista removido',
      placa: truck ? truck.placa : (l.caminhao_id ? 'Removido' : null),
      caminhao_apelido: truck ? truck.apelido : null,
      viagem_origem: trip ? trip.origem : null,
      viagem_destino: trip ? trip.destino : null,
    };
  }

  joinViagem(v: Viagem) {
    const user = this.usuarios.find((u) => u.id === v.usuario_id);
    const truck = v.caminhao_id ? this.caminhoes.find((c) => c.id === v.caminhao_id) : null;

    const tripsLancamentos = this.lancamentos.filter((l) => l.viagem_id === v.id);
    let saidas_centavos = 0;
    let entradas_centavos = 0;
    for (const l of tripsLancamentos) {
      if (l.tipo === 'saida') saidas_centavos += l.valor_centavos;
      else if (l.tipo === 'entrada') entradas_centavos += l.valor_centavos;
    }

    return {
      ...v,
      motorista: user ? user.nome : 'Motorista removido',
      placa: truck ? truck.placa : (v.caminhao_id ? 'Removido' : null),
      caminhao_apelido: truck ? truck.apelido : null,
      saidas_centavos,
      entradas_centavos,
      qtd_lancamentos: tripsLancamentos.length,
    };
  }
}

export const db = new Database();
