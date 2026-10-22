export interface Usuario {
  id: number;
  nome: string;
  usuario: string;
  senha_hash: string;
  papel: 'admin' | 'motorista';
  telefone: string | null;
  ativo: number;
  criado_em: string;
}

export interface Caminhao {
  id: number;
  placa: string;
  apelido: string | null;
  ativo: number;
  criado_em: string;
}

export interface Categoria {
  id: number;
  nome: string;
  tipo: 'entrada' | 'saida';
  icone: string;
  pede_litros: number;
  pede_descricao: number;
  ordem: number;
  ativo: number;
}

export interface Viagem {
  id: number;
  usuario_id: number;
  caminhao_id: number | null;
  origem: string;
  destino: string;
  inicio: string;
  fim: string | null;
  km_inicial: number | null;
  km_final: number | null;
  status: 'aberta' | 'encerrada';
  observacao: string | null;
  criado_em: string;
}

export interface Lancamento {
  id: number;
  tipo: 'entrada' | 'saida';
  usuario_id: number;
  viagem_id: number | null;
  caminhao_id: number | null;
  categoria_id: number;
  descricao: string | null;
  valor_centavos: number;
  litros: number | null;
  km: number | null;
  data: string;
  pagamento: string | null;
  lugar: string | null;
  cliente: string | null;
  observacao: string | null;
  comprovante: string | null;
  criado_em: string;
  criado_por: number | null;
  atualizado_em: string | null;
  atualizado_por: number | null;
}

export interface Aviso {
  id: number;
  usuario_id: number;
  acao: string;
  tipo: string;
  lancamento_id: number | null;
  resumo: string;
  criado_em: string;
}
