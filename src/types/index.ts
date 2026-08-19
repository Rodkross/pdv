export interface Produto {
  produto_id: number;
  descricao: string;
  barras: string | null;
  preco_cmp: number;
  preco_vnd: number;
  preco_promocao: number;
  data_fim_promocao: string | null;
  estoque: number;
}

export interface Usuario {
  usuario_id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  endereco: string | null;
}

export type TipoOperacao = 'CESTA' | 'ENTREGA';

export interface PrecoResolvido {
  precoAplicado: number;
  promocional: boolean;
}

export interface ResultadoBuscaProduto {
  produto: Produto;
  preco: PrecoResolvido;
}

export interface ItemCarrinho {
  uid: string; // identificador local temporário (antes de persistir)
  produto_id: number;
  descricao: string;
  barras: string | null;
  quantidade: number;
  preco_unitario: number;
  promocional: boolean;
  subtotal: number;
}

export interface ItemOrcamentoInput {
  produto_id: number;
  descricao: string;
  barras: string | null;
  quantidade: number;
  preco_unitario: number;
  promocional: boolean;
  subtotal: number;
}

export interface OrcamentoInput {
  usuario_id: number | null;
  tipo_operacao: TipoOperacao;
  terminal: string;
  total: number;
  forma_pagamento?: string | null;
  valor_pago?: number | null;
  troco?: number | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  cliente_documento?: string | null;
  cliente_endereco?: string | null;
  itens: ItemOrcamentoInput[];
}

export interface ItemOrcamento extends ItemOrcamentoInput {
  item_id: number;
  orcamento_id: number;
}

export interface Orcamento {
  orcamento_id: number;
  usuario_id: number | null;
  tipo_operacao: TipoOperacao;
  total: number;
  terminal: string;
  data_hora: string;
  forma_pagamento?: string | null;
  valor_pago?: number | null;
  troco?: number | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  cliente_documento?: string | null;
  cliente_endereco?: string | null;
}

export interface OrcamentoCompleto extends Orcamento {
  itens: ItemOrcamento[];
  usuario: Usuario | null;
}

export interface InfoImpressora {
  name: string;
  isDefault?: boolean;
}

export interface ResultadoImpressao {
  via: number;
  sucesso: boolean;
  mensagem?: string;
}

export interface ResultadoImportacao {
  arquivo: string;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
}

export interface PdvApi {
  produtos: {
    buscarPorCodigoOuBarras: (
      termo: string,
    ) => Promise<ResultadoBuscaProduto | null>;
    pesquisar: (termo: string) => Promise<ResultadoBuscaProduto[]>;
  };
  usuarios: {
    buscarPorId: (usuarioId: number) => Promise<Usuario | null>;
    buscarPorTermo: (termo: string) => Promise<Usuario | null>;
    pesquisar: (termo: string) => Promise<Usuario[]>;
  };
  orcamentos: {
    criar: (input: OrcamentoInput) => Promise<OrcamentoCompleto>;
    imprimirVias: (orcamentoId: number, nomeImpressora?: string) => Promise<ResultadoImpressao[]>;
  };
  sistema: {
    infoTerminal: () => Promise<{ terminal: string; plataforma: string }>;
    listarImpressoras: () => Promise<InfoImpressora[]>;
  };
  importacao: {
    produtos: () => Promise<ResultadoImportacao | null>;
    usuarios: () => Promise<ResultadoImportacao | null>;
  };
}

declare global {
  interface Window {
    api: PdvApi;
  }
}
