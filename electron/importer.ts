import * as XLSX from 'xlsx';
import { getDb } from './database';
import { ResultadoImportacao } from './types';

export type { ResultadoImportacao };

/** Remove acentos, baixa para minúsculas e troca espaços por "_" (ex: "Código de Barras" -> "codigo_de_barras"). */
function normalizarChave(chave: unknown): string {
  return String(chave ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function lerPlanilha(caminhoArquivo: string): Record<string, unknown>[] {
  const workbook = XLSX.readFile(caminhoArquivo);
  const nomeAba = workbook.SheetNames[0];
  const planilha = workbook.Sheets[nomeAba];
  const linhasCru = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, { defval: null });

  return linhasCru.map((linhaCru) => {
    const linhaNormalizada: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(linhaCru)) {
      linhaNormalizada[normalizarChave(chave)] = valor;
    }
    return linhaNormalizada;
  });
}

function extrairCampo(linha: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const valor = linha[alias];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') return valor;
  }
  return null;
}

/** Converte valores como "24,90", "24.90" ou 24.9 (número) para um float consistente. */
function paraNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  let texto = String(valor).trim();
  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  }
  const numero = parseFloat(texto);
  return isNaN(numero) ? 0 : numero;
}

function paraInteiroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = parseInt(String(valor).trim(), 10);
  return isNaN(numero) ? null : numero;
}

/** Aceita data em formato Excel (serial numérico), "dd/mm/aaaa" ou "aaaa-mm-dd". Retorna sempre "aaaa-mm-dd" ou null. */
function paraDataIso(valor: unknown): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;

  if (valor instanceof Date) {
    const yyyy = String(valor.getFullYear()).padStart(4, '0');
    const mm = String(valor.getMonth() + 1).padStart(2, '0');
    const dd = String(valor.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  if (typeof valor === 'number') {
    const dataExcel = XLSX.SSF.parse_date_code(valor);
    if (dataExcel) {
      const yyyy = String(dataExcel.y).padStart(4, '0');
      const mm = String(dataExcel.m).padStart(2, '0');
      const dd = String(dataExcel.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  const texto = String(valor).trim();

  // DD/MM/YYYY, DD-MM-YYYY ou DD.MM.YYYY (com hora opcional no final)
  const matchBr = texto.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (matchBr) {
    const dia = matchBr[1].padStart(2, '0');
    const mes = matchBr[2].padStart(2, '0');
    let ano = matchBr[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  // YYYY-MM-DD, YYYY/MM/DD ou YYYY.MM.DD (com hora opcional no final)
  const matchIso = texto.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (matchIso) {
    const ano = matchIso[1];
    const mes = matchIso[2].padStart(2, '0');
    const dia = matchIso[3].padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  return null;
}


function paraTextoOuNulo(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

// ---------------------------------------------------------------------------
// PRODUTOS
// ---------------------------------------------------------------------------
const ALIASES_PRODUTO = {
  produto_id: ['produto_id', 'codigo', 'cod', 'id', 'cod_produto', 'codigo_produto'],
  descricao: ['descricao', 'produto', 'nome', 'nome_produto', 'descricao_produto', 'item'],
  barras: ['barras', 'codigo_de_barras', 'cod_barras', 'ean', 'codigo_barras', 'gtin', 'cod_ean'],
  preco_cmp: ['preco_cmp', 'preco_compra', 'custo', 'preco_custo', 'preco_de_custo', 'vlr_custo'],
  preco_vnd: ['preco_vnd', 'preco_venda', 'preco_cheio', 'preco', 'valor', 'preco_normal', 'preco_de_venda', 'vlr_venda', 'valor_venda'],
  preco_promocao: [
    'preco_promocao',
    'preco_de_promocao',
    'preco_promocional',
    'preco_promo',
    'promocao',
    'valor_promocional',
    'preco_oferta',
    'oferta',
    'desconto',
    'preco_desconto',
    'valor_promo',
    'vlr_promo',
    'p_promo',
    'preco_com_desconto',
    'promocional',
    'promo',
  ],
  data_fim_promocao: [
    'data_fim_promocao',
    'final_de_promocao',
    'final_promocao',
    'validade_promocao',
    'fim_promocao',
    'data_promocao',
    'validade_da_promocao',
    'data_fim',
    'validade',
    'data_validade',
    'fim_da_promocao',
    'dt_fim_promo',
    'dt_fim',
    'vencimento_promocao',
    'validade_promo',
  ],
  estoque: ['estoque', 'quantidade', 'qtd_estoque', 'saldo', 'estoque_atual', 'qtd'],
};

export function importarProdutosDoArquivo(caminhoArquivo: string): ResultadoImportacao {
  const db = getDb();
  const linhas = lerPlanilha(caminhoArquivo);

  const resultado: ResultadoImportacao = {
    arquivo: caminhoArquivo,
    totalLinhas: linhas.length,
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
  };

  const buscarPorId = db.prepare('SELECT produto_id FROM produtos WHERE produto_id = ?');
  const buscarPorBarras = db.prepare('SELECT produto_id FROM produtos WHERE barras = ?');
  const inserir = db.prepare(`
    INSERT INTO produtos (produto_id, descricao, barras, preco_cmp, preco_vnd, preco_promocao, data_fim_promocao, estoque)
    VALUES (@produto_id, @descricao, @barras, @preco_cmp, @preco_vnd, @preco_promocao, @data_fim_promocao, @estoque)
  `);
  const atualizar = db.prepare(`
    UPDATE produtos SET
      descricao = @descricao,
      barras = @barras,
      preco_cmp = @preco_cmp,
      preco_vnd = @preco_vnd,
      preco_promocao = @preco_promocao,
      data_fim_promocao = @data_fim_promocao,
      estoque = @estoque
    WHERE produto_id = @produto_id
  `);

  const transacao = db.transaction(() => {
    linhas.forEach((linha, indice) => {
      const numeroLinha = indice + 2; // +2 = cabeçalho (linha 1) + índice 0-based

      const descricao = paraTextoOuNulo(extrairCampo(linha, ALIASES_PRODUTO.descricao));
      if (!descricao) {
        resultado.ignorados++;
        resultado.erros.push(`Linha ${numeroLinha}: sem descrição, ignorada.`);
        return;
      }

      const dados = {
        produto_id: paraInteiroOuNulo(extrairCampo(linha, ALIASES_PRODUTO.produto_id)),
        descricao,
        barras: paraTextoOuNulo(extrairCampo(linha, ALIASES_PRODUTO.barras)),
        preco_cmp: paraNumero(extrairCampo(linha, ALIASES_PRODUTO.preco_cmp)),
        preco_vnd: paraNumero(extrairCampo(linha, ALIASES_PRODUTO.preco_vnd)),
        preco_promocao: paraNumero(extrairCampo(linha, ALIASES_PRODUTO.preco_promocao)),
        data_fim_promocao: paraDataIso(extrairCampo(linha, ALIASES_PRODUTO.data_fim_promocao)),
        estoque: paraNumero(extrairCampo(linha, ALIASES_PRODUTO.estoque)),
      };

      try {
        let produtoIdExistente: number | null = null;

        if (dados.produto_id !== null) {
          const encontrado = buscarPorId.get(dados.produto_id) as { produto_id: number } | undefined;
          if (encontrado) produtoIdExistente = encontrado.produto_id;
        }
        if (produtoIdExistente === null && dados.barras) {
          const encontrado = buscarPorBarras.get(dados.barras) as { produto_id: number } | undefined;
          if (encontrado) produtoIdExistente = encontrado.produto_id;
        }

        if (produtoIdExistente !== null) {
          atualizar.run({ ...dados, produto_id: produtoIdExistente });
          resultado.atualizados++;
        } else {
          inserir.run(dados);
          resultado.inseridos++;
        }
      } catch (erro) {
        resultado.ignorados++;
        resultado.erros.push(`Linha ${numeroLinha}: ${(erro as Error).message}`);
      }
    });
  });

  transacao();
  return resultado;
}

// ---------------------------------------------------------------------------
// USUÁRIOS / CLIENTES
// ---------------------------------------------------------------------------
const ALIASES_USUARIO = {
  usuario_id: ['usuario_id', 'codigo', 'cod', 'id', 'cod_cliente', 'cod_usuario'],
  nome: ['nome', 'nome_cliente', 'cliente', 'nome_completo'],
  documento: ['documento', 'cpf', 'cnpj', 'doc', 'cpf_cnpj'],
  telefone: ['telefone', 'tel', 'fone', 'celular', 'whatsapp'],
  endereco: ['endereco', 'endereco_entrega', 'logradouro', 'endereco_completo'],
};

export function importarUsuariosDoArquivo(caminhoArquivo: string): ResultadoImportacao {
  const db = getDb();
  const linhas = lerPlanilha(caminhoArquivo);

  const resultado: ResultadoImportacao = {
    arquivo: caminhoArquivo,
    totalLinhas: linhas.length,
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
  };

  const buscarPorId = db.prepare('SELECT usuario_id FROM usuarios WHERE usuario_id = ?');
  const buscarPorDocumento = db.prepare(`
    SELECT usuario_id FROM usuarios 
    WHERE documento = ? 
       OR (REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(documento, ''), '.', ''), '-', ''), '/', ''), ' ', '') = ? AND ? <> '')
    LIMIT 1
  `);
  const buscarPorTelefone = db.prepare(`
    SELECT usuario_id FROM usuarios 
    WHERE telefone = ? 
       OR (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') = ? AND ? <> '')
    LIMIT 1
  `);

  const inserir = db.prepare(`
    INSERT INTO usuarios (usuario_id, nome, documento, telefone, endereco)
    VALUES (@usuario_id, @nome, @documento, @telefone, @endereco)
  `);
  const atualizar = db.prepare(`
    UPDATE usuarios SET
      nome = @nome,
      documento = COALESCE(@documento, documento),
      telefone = COALESCE(@telefone, telefone),
      endereco = COALESCE(@endereco, endereco)
    WHERE usuario_id = @usuario_id
  `);

  const transacao = db.transaction(() => {
    linhas.forEach((linha, indice) => {
      const numeroLinha = indice + 2;

      const nome = paraTextoOuNulo(extrairCampo(linha, ALIASES_USUARIO.nome));
      if (!nome) {
        resultado.ignorados++;
        resultado.erros.push(`Linha ${numeroLinha}: sem nome, ignorada.`);
        return;
      }

      const usuarioIdInformado = paraInteiroOuNulo(extrairCampo(linha, ALIASES_USUARIO.usuario_id));
      const dados = {
        usuario_id: usuarioIdInformado,
        nome,
        documento: paraTextoOuNulo(extrairCampo(linha, ALIASES_USUARIO.documento)),
        telefone: paraTextoOuNulo(extrairCampo(linha, ALIASES_USUARIO.telefone)),
        endereco: paraTextoOuNulo(extrairCampo(linha, ALIASES_USUARIO.endereco)),
      };

      try {
        let usuarioIdExistente: number | null = null;

        if (usuarioIdInformado !== null) {
          const encontrado = buscarPorId.get(usuarioIdInformado) as { usuario_id: number } | undefined;
          if (encontrado) usuarioIdExistente = encontrado.usuario_id;
        }

        if (usuarioIdExistente === null && dados.documento) {
          const docLimpo = dados.documento.trim();
          const docApenNums = docLimpo.replace(/\D/g, '');
          const encontrado = buscarPorDocumento.get(docLimpo, docApenNums, docApenNums) as { usuario_id: number } | undefined;
          if (encontrado) usuarioIdExistente = encontrado.usuario_id;
        }

        if (usuarioIdExistente === null && dados.telefone) {
          const telLimpo = dados.telefone.trim();
          const telApenNums = telLimpo.replace(/\D/g, '');
          const encontrado = buscarPorTelefone.get(telLimpo, telApenNums, telApenNums) as { usuario_id: number } | undefined;
          if (encontrado) usuarioIdExistente = encontrado.usuario_id;
        }

        if (usuarioIdExistente !== null) {
          atualizar.run({ ...dados, usuario_id: usuarioIdExistente });
          resultado.atualizados++;
        } else {
          inserir.run(dados);
          resultado.inseridos++;
        }
      } catch (erro) {
        resultado.ignorados++;
        resultado.erros.push(`Linha ${numeroLinha}: ${(erro as Error).message}`);
      }
    });
  });

  transacao();
  return resultado;
}
