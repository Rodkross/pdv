import { OrcamentoCompleto, TipoOperacao } from '../types';

const LARGURA_COLUNAS = 42;

const LOJA = {
  nome: 'MERCADO CENTRAL LTDA',
  endereco: 'RUA PRINCIPAL, 100 - CENTRO',
  cnpj: '00.000.000/0001-00',
  telefone: '(11) 4000-0000',
};

function linha(caractere = '-'): string {
  return caractere.repeat(LARGURA_COLUNAS);
}

function centralizar(texto: string): string {
  const t = texto.slice(0, LARGURA_COLUNAS);
  const espacos = Math.max(0, Math.floor((LARGURA_COLUNAS - t.length) / 2));
  return ' '.repeat(espacos) + t;
}

function colunaDupla(esquerda: string, direita: string): string {
  const maxEsquerda = LARGURA_COLUNAS - direita.length - 1;
  const esq = esquerda.length > maxEsquerda ? esquerda.slice(0, maxEsquerda) : esquerda.padEnd(maxEsquerda, ' ');
  return `${esq} ${direita}`;
}

function quebrarTexto(texto: string, largura: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (candidato.length > largura) {
      if (atual) linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidato;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

export function formatarMoeda(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

export function formatarDataHora(dataIso: string): string {
  const data = new Date(dataIso.replace(' ', 'T'));
  if (isNaN(data.getTime())) return dataIso;
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function rotuloVia(tipo: TipoOperacao, numeroVia: number, totalVias: number): string {
  const rotulosCesta = ['CLIENTE', 'CAIXA/SEPARACAO'];
  const rotulosEntrega = ['CLIENTE', 'ENTREGADOR', 'CAIXA/SEPARACAO'];
  const rotulos = tipo === 'CESTA' ? rotulosCesta : rotulosEntrega;
  const rotulo = rotulos[numeroVia - 1] ?? 'VIA';
  return `VIA ${numeroVia} DE ${totalVias} - ${rotulo}`;
}

export function totalViasPorModalidade(tipo: TipoOperacao): number {
  return tipo === 'CESTA' ? 2 : 3;
}

export interface OpcoesCupom {
  orcamento: OrcamentoCompleto;
  numeroVia: number;
  totalVias: number;
  terminal: string;
}

/** Gera o texto de UMA via do cupom — mesma lógica usada na impressão real (electron/printer.ts). */
export function gerarTextoCupom(opcoes: OpcoesCupom): string {
  const { orcamento, numeroVia, totalVias, terminal } = opcoes;
  const out: string[] = [];

  out.push(centralizar(LOJA.nome));
  out.push(centralizar(LOJA.endereco));
  out.push(centralizar(`CNPJ: ${LOJA.cnpj}  TEL: ${LOJA.telefone}`));
  out.push(linha('='));
  out.push(centralizar(`*** OPERACAO: ${orcamento.tipo_operacao} ***`));
  out.push(linha('='));

  // Identificação do Vendedor (usuário)
  if (orcamento.usuario) {
    out.push(colunaDupla('VENDEDOR:', `#${orcamento.usuario.usuario_id} - ${orcamento.usuario.nome}`));
  } else {
    out.push(colunaDupla('VENDEDOR:', 'Nao identificado'));
  }
  out.push(linha('-'));

  // Dados do cliente
  out.push('DADOS DO CLIENTE');
  if (orcamento.tipo_operacao === 'ENTREGA') {
    const nome = orcamento.cliente_nome?.trim() || 'Nao informado';
    const telefone = orcamento.cliente_telefone?.trim() || 'Nao informado';
    const documento = orcamento.cliente_documento?.trim() || 'Nao informado';
    const endereco = orcamento.cliente_endereco?.trim() || 'Nao informado';

    quebrarTexto(`Nome: ${nome}`, LARGURA_COLUNAS).forEach((l) => out.push(l));
    quebrarTexto(`Tel: ${telefone}`, LARGURA_COLUNAS).forEach((l) => out.push(l));
    quebrarTexto(`CPF: ${documento}`, LARGURA_COLUNAS).forEach((l) => out.push(l));
    quebrarTexto(`Endereco: ${endereco}`, LARGURA_COLUNAS).forEach((l) => out.push(l));
  } else {
    out.push('Cliente: Balcao / Venda Direta');
  }
  out.push(linha('-'));

  out.push('COD. BARRAS');
  out.push('DESCRICAO');
  out.push(colunaDupla('QTD x PRECO UN.', 'TOTAL'));
  out.push(linha('-'));

  for (const item of orcamento.itens) {
    out.push(item.barras ?? `(COD ${item.produto_id})`);
    quebrarTexto(item.descricao, LARGURA_COLUNAS).forEach((l) => out.push(l));
    const marcaPromo = item.promocional ? '*' : ' ';
    const qtdPreco = `${item.quantidade} x ${formatarMoeda(item.preco_unitario)}${marcaPromo}`;
    out.push(colunaDupla(qtdPreco, formatarMoeda(item.subtotal)));
    out.push('');
  }

  out.push(linha('-'));
  out.push('* = PRECO PROMOCIONAL APLICADO');
  out.push(linha('='));

  out.push(colunaDupla('TOTAL GERAL:', `R$ ${formatarMoeda(orcamento.total)}`));
  if (orcamento.forma_pagamento) {
    out.push(colunaDupla('FORMA PAGTO:', orcamento.forma_pagamento));
    if (orcamento.forma_pagamento === 'DINHEIRO' || (orcamento.valor_pago && orcamento.valor_pago > 0)) {
      out.push(colunaDupla('VALOR PAGO:', `R$ ${formatarMoeda(orcamento.valor_pago ?? 0)}`));
      out.push(colunaDupla('TROCO:', `R$ ${formatarMoeda(orcamento.troco ?? 0)}`));
    }
  }
  out.push(linha('='));
  out.push(colunaDupla('Data/Hora:', formatarDataHora(orcamento.data_hora)));
  out.push(colunaDupla('Terminal:', terminal));
  out.push(colunaDupla('Orcamento:', `#${orcamento.orcamento_id}`));
  out.push('');
  out.push(centralizar(rotuloVia(orcamento.tipo_operacao, numeroVia, totalVias)));

  return out.join('\n');
}
