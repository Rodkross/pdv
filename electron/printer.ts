import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { OrcamentoCompleto, TipoOperacao } from './types';

/** Largura útil, em colunas, de uma bobina térmica de 80mm (fonte padrão ~ 38 colunas com margem). */
const LARGURA_COLUNAS = 38;

/** Nome/identificação da loja impressa no cabeçalho do cupom. Ajuste conforme necessário. */
const LOJA = {
  nome: 'NOVA REDE DROGARIAS',
  endereco: 'RUA TUNISIA, 42 - BANGU',
  cnpj: '****',
  telefone: '**',
};


// ---------------------------------------------------------------------------
// Comandos ESC/POS (bytes de controle da impressora térmica)
// ---------------------------------------------------------------------------
const ESC = 0x1b;
const GS = 0x1d;

const ESC_POS = {
  INIT: Buffer.from([ESC, 0x40]), // Inicializa impressora
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: Buffer.from([GS, 0x21, 0x01]),
  DOUBLE_ON: Buffer.from([GS, 0x21, 0x11]),
  NORMAL_SIZE: Buffer.from([GS, 0x21, 0x00]),
  CUT_PARTIAL: Buffer.from([GS, 0x56, 0x01]),
  FEED_LINES: (n: number) => Buffer.from([ESC, 0x64, n]),
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

function formatarMoeda(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

function formatarDataHora(dataIso: string): string {
  const data = new Date(dataIso.replace(' ', 'T'));
  if (isNaN(data.getTime())) return dataIso;
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Rótulos de identificação de cada via, por modalidade da operação. */
function rotuloVia(tipo: TipoOperacao, numeroVia: number, totalVias: number): string {
  const rotulosCesta = ['CLIENTE', 'CAIXA/SEPARACAO'];
  const rotulosEntrega = ['CLIENTE', 'ENTREGADOR', 'CAIXA/SEPARACAO'];
  const rotulos = tipo === 'CESTA' ? rotulosCesta : rotulosEntrega;
  const rotulo = rotulos[numeroVia - 1] ?? 'VIA';
  return `VIA ${numeroVia} DE ${totalVias} - ${rotulo}`;
}

export interface OpcoesCupom {
  orcamento: OrcamentoCompleto;
  numeroVia: number;
  totalVias: number;
  terminal: string;
}

/**
 * Gera o texto completo (em colunas fixas, pronto para impressão em bobina 80mm)
 * de UMA via do cupom, contendo:
 *  - Cabeçalho da loja + identificação da operação
 *  - Dados do cliente
 *  - Tabela de itens (cod. barras | descricao | qtd x preco | total)
 *  - Rodapé com total, data/hora, terminal e identificação da via
 */
export function gerarTextoCupom(opcoes: OpcoesCupom): string {
  const { orcamento, numeroVia, totalVias, terminal } = opcoes;
  const out: string[] = [];

  // Cabeçalho da loja
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

  // Cabeçalho da tabela de itens
  out.push('COD. BARRAS');
  out.push('DESCRICAO');
  out.push(colunaDupla('QTD x PRECO UN.', 'TOTAL'));
  out.push(linha('-'));

  // Itens
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

  // Rodapé (Exibe sempre TOTAL, VALOR PAGO e TROCO sem cortes)
  out.push(colunaDupla('TOTAL GERAL:', `R$ ${formatarMoeda(orcamento.total)}`));
  const formaPagto = orcamento.forma_pagamento ?? 'DINHEIRO';
  out.push(colunaDupla('FORMA PAGTO:', formaPagto));
  out.push(colunaDupla('VALOR PAGO:', `R$ ${formatarMoeda(orcamento.valor_pago ?? orcamento.total)}`));
  out.push(colunaDupla('TROCO:', `R$ ${formatarMoeda(orcamento.troco ?? 0)}`));
  out.push(linha('='));
  out.push(colunaDupla('Data/Hora:', formatarDataHora(orcamento.data_hora)));
  out.push(colunaDupla('Terminal:', terminal));
  out.push(colunaDupla('Orcamento:', `#${orcamento.orcamento_id}`));
  out.push('');
  out.push(centralizar(rotuloVia(orcamento.tipo_operacao, numeroVia, totalVias)));
  out.push('');
  out.push('');

  return out.join('\r\n');

}


/** Converte o texto do cupom em um buffer de bytes ESC/POS pronto para a impressora. */
function montarBufferEscPos(texto: string): Buffer {
  const partes: Buffer[] = [];
  partes.push(ESC_POS.INIT);
  partes.push(ESC_POS.ALIGN_LEFT);
  partes.push(Buffer.from(texto, 'latin1'));
  partes.push(ESC_POS.FEED_LINES(3));
  partes.push(ESC_POS.CUT_PARTIAL);
  return Buffer.concat(partes);
}

export interface ResultadoImpressao {
  via: number;
  sucesso: boolean;
  mensagem?: string;
}

/**
 * Imprime N vias do orçamento na impressora térmica configurada.
 * Estratégia: gera o buffer ESC/POS de cada via e envia via comando do
 * sistema operacional para a fila de impressão padrão (Windows: PRINT /D,
 * Linux/Mac: lp), o que funciona com a maioria das impressoras térmicas
 * instaladas como impressora "genérica / texto" ou compartilhada em rede.
 */
export async function imprimirViasOrcamento(
  orcamento: OrcamentoCompleto,
  terminal: string,
  nomeImpressora?: string,
): Promise<ResultadoImpressao[]> {
  const totalVias = orcamento.tipo_operacao === 'CESTA' ? 2 : 3;
  const resultados: ResultadoImpressao[] = [];

  for (let via = 1; via <= totalVias; via++) {
    const texto = gerarTextoCupom({ orcamento, numeroVia: via, totalVias, terminal });
    const bufferVia = montarBufferEscPos(texto);
    try {
      await enviarParaImpressora(bufferVia, nomeImpressora);
      resultados.push({ via, sucesso: true });
    } catch (erro) {
      resultados.push({ via, sucesso: false, mensagem: (erro as Error).message });
    }
  }

  return resultados;
}


/** Envia o buffer bruto para a impressora do sistema operacional. */
function enviarParaImpressora(buffer: Buffer, nomeImpressora?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempName = `cupom_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`;
    const arquivoTemp = path.join(os.tmpdir(), tempName);
    fs.writeFileSync(arquivoTemp, buffer);

    if (process.platform === 'win32') {
      const scriptCaminhos = [
        path.join(__dirname, 'print.ps1'),
        path.join(__dirname, '..', 'electron', 'print.ps1'),
        path.join(process.cwd(), 'electron', 'print.ps1'),
        path.join(process.cwd(), 'dist-electron', 'print.ps1'),
      ];

      const scriptPs = scriptCaminhos.find((p) => fs.existsSync(p));

      if (scriptPs) {
        const printerArg = nomeImpressora?.trim() || '';
        execFile(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            scriptPs,
            '-filePath',
            arquivoTemp,
            '-printerName',
            printerArg,
          ],
          (erro) => {
            fs.unlink(arquivoTemp, () => undefined);
            if (erro) reject(erro);
            else resolve();
          }
        );
      } else {
        let comando = `copy /b "${arquivoTemp}" LPT1`;
        if (nomeImpressora && nomeImpressora.trim()) {
          const imp = nomeImpressora.trim();
          if (
            imp.startsWith('\\\\') ||
            imp.toUpperCase().startsWith('LPT') ||
            imp.toUpperCase().startsWith('COM')
          ) {
            comando = `copy /b "${arquivoTemp}" "${imp}"`;
          } else {
            comando = `print /d:"${imp}" "${arquivoTemp}"`;
          }
        }

        execFile('cmd.exe', ['/c', comando], (erro) => {
          fs.unlink(arquivoTemp, () => undefined);
          if (erro) reject(erro);
          else resolve();
        });
      }
    } else {
      // Linux/Mac: usa CUPS (lp) com a impressora "raw"
      const args = nomeImpressora
        ? ['-d', nomeImpressora, '-o', 'raw', arquivoTemp]
        : ['-o', 'raw', arquivoTemp];
      execFile('lp', args, (erro) => {
        fs.unlink(arquivoTemp, () => undefined);
        if (erro) reject(erro);
        else resolve();
      });
    }
  });
}
