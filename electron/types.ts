export interface Produto {
  produto_id: number;
  descricao: string;
  barras: string | null;
  preco_cmp: number;
  preco_vnd: number;
  preco_promocao: number;
  data_fim_promocao: string | null; // formato 'YYYY-MM-DD'
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

export type FormaPagamento =
  | 'DINHEIRO'
  | 'CARTAO_DEBITO'
  | 'CARTAO_CREDITO'
  | 'PIX'
  | 'OUTROS';

/** Uma "baixa" de pagamento — a venda pode ser dividida em mais de uma
 * forma (ex: parte no PIX, parte em dinheiro). */
export interface PagamentoOrcamento {
  forma_pagamento: FormaPagamento;
  valor: number;
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
  /** Lista de pagamentos que cobrem a venda (uma ou mais formas). O
   * resumo (forma_pagamento/valor_pago/troco) é calculado e validado no
   * servidor a partir desta lista — ver consolidarPagamentos() em
   * database.ts. */
  pagamentos: PagamentoOrcamento[];
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
  /** Resumo calculado no servidor: forma única, ou 'MULTIPLO' se a venda
   * foi paga em mais de uma forma — ver `pagamentos` em OrcamentoCompleto
   * para o detalhamento de cada forma usada. */
  forma_pagamento?: string | null;
  /** Soma bruta recebida em todas as formas (inclui o valor em dinheiro
   * antes de descontar o troco). */
  valor_pago?: number | null;
  troco?: number | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  cliente_documento?: string | null;
  cliente_endereco?: string | null;
  /** Número sequencial da cesta NO DIA (reinicia sozinho todo dia). Só é
   * preenchido para tipo_operacao === 'CESTA'. */
  numero_cesta_dia?: number | null;
}

export interface OrcamentoCompleto extends Orcamento {
  itens: ItemOrcamento[];
  /** Detalhamento de cada forma de pagamento usada (pode ser mais de uma). */
  pagamentos: PagamentoOrcamento[];
  usuario: Usuario | null;
}


export interface ResultadoFechamento {
  orcamento: OrcamentoCompleto;
  viasImpressas: number;
}

/** Preço já resolvido para exibição/gravação, considerando promoção vigente. */
export interface PrecoResolvido {
  precoAplicado: number;
  promocional: boolean;
}

export interface ResultadoBuscaProduto {
  produto: Produto;
  preco: PrecoResolvido;
}

export interface ResultadoImportacao {
  arquivo: string;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
}

/** Dados da filial impressos no cabeçalho do cupom. Configuráveis pela tela
 * de Configurações (roldana no topo do app). */
export interface ConfigFilial {
  nome: string;
  endereco: string;
  cnpj: string;
  telefone: string;
}

export interface ConfiguracoesApp {
  filial: ConfigFilial;
}
