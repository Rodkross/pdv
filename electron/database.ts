import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import {
  Produto,
  Usuario,
  OrcamentoInput,
  OrcamentoCompleto,
  ItemOrcamento,
  PrecoResolvido,
} from './types';

let db: Database.Database;

/**
 * Resolve a pasta de dados do usuário. Em desenvolvimento (sem app pronto)
 * cai para uma pasta local do projeto.
 */
function resolveUserDataPath(): string {
  try {
    return app.getPath('userData');
  } catch {
    const fallback = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Banco de dados ainda não foi inicializado. Chame initDatabase() primeiro.');
  return db;
}

export function initDatabase(): Database.Database {
  const userDataPath = resolveUserDataPath();
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

  const dbPath = path.join(userDataPath, 'pdv.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      produto_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao            TEXT NOT NULL,
      barras                TEXT UNIQUE,
      preco_cmp             REAL NOT NULL DEFAULT 0,
      preco_vnd             REAL NOT NULL DEFAULT 0,
      preco_promocao        REAL NOT NULL DEFAULT 0,
      data_fim_promocao     TEXT,
      estoque                REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      usuario_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      nome         TEXT NOT NULL,
      documento    TEXT,
      telefone     TEXT,
      endereco     TEXT
    );

    CREATE TABLE IF NOT EXISTS orcamentos (
      orcamento_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id      INTEGER,
      tipo_operacao   TEXT NOT NULL CHECK (tipo_operacao IN ('CESTA','ENTREGA')),
      total            REAL NOT NULL DEFAULT 0,
      terminal         TEXT NOT NULL DEFAULT 'LOCAL',
      data_hora        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
    );

    CREATE TABLE IF NOT EXISTS orcamento_itens (
      item_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      orcamento_id      INTEGER NOT NULL,
      produto_id         INTEGER NOT NULL,
      descricao          TEXT NOT NULL,
      barras             TEXT,
      quantidade          REAL NOT NULL,
      preco_unitario      REAL NOT NULL,
      promocional         INTEGER NOT NULL DEFAULT 0,
      subtotal             REAL NOT NULL,
      FOREIGN KEY (orcamento_id) REFERENCES orcamentos(orcamento_id),
      FOREIGN KEY (produto_id)   REFERENCES produtos(produto_id)
    );

    CREATE INDEX IF NOT EXISTS idx_produtos_barras ON produtos(barras);
    CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos(descricao);
    CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON orcamento_itens(orcamento_id);
  `);

  try { db.exec('ALTER TABLE orcamentos ADD COLUMN forma_pagamento TEXT;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN valor_pago REAL DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN troco REAL DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN cliente_nome TEXT;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN cliente_telefone TEXT;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN cliente_documento TEXT;'); } catch {}
  try { db.exec('ALTER TABLE orcamentos ADD COLUMN cliente_endereco TEXT;'); } catch {}

  seedIfEmpty();


  return db;
}

/** Popula dados de demonstração apenas se as tabelas estiverem vazias (facilita 1º uso). */
function seedIfEmpty(): void {
  const totalProdutos = (db.prepare('SELECT COUNT(*) AS c FROM produtos').get() as { c: number }).c;
  if (totalProdutos === 0) {
    const inserirProduto = db.prepare(`
      INSERT INTO produtos (descricao, barras, preco_cmp, preco_vnd, preco_promocao, data_fim_promocao, estoque)
      VALUES (@descricao, @barras, @preco_cmp, @preco_vnd, @preco_promocao, @data_fim_promocao, @estoque)
    `);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 30);
    const dataFimPromo = amanha.toISOString().slice(0, 10);

    const seed = db.transaction(() => {
      inserirProduto.run({ descricao: 'ARROZ TIPO 1 5KG', barras: '7891000100103', preco_cmp: 18.5, preco_vnd: 24.9, preco_promocao: 21.9, data_fim_promocao: dataFimPromo, estoque: 120 });
      inserirProduto.run({ descricao: 'FEIJAO CARIOCA 1KG', barras: '7891000100202', preco_cmp: 5.2, preco_vnd: 8.49, preco_promocao: 0, data_fim_promocao: null, estoque: 200 });
      inserirProduto.run({ descricao: 'ACUCAR REFINADO 1KG', barras: '7891000100301', preco_cmp: 3.1, preco_vnd: 4.99, preco_promocao: 4.29, data_fim_promocao: dataFimPromo, estoque: 300 });
      inserirProduto.run({ descricao: 'OLEO DE SOJA 900ML', barras: '7891000100400', preco_cmp: 6.0, preco_vnd: 8.99, preco_promocao: 0, data_fim_promocao: null, estoque: 90 });
      inserirProduto.run({ descricao: 'CAFE TORRADO E MOIDO 500G', barras: '7891000100509', preco_cmp: 9.5, preco_vnd: 14.9, preco_promocao: 12.9, data_fim_promocao: '2020-01-01', estoque: 60 });
    });
    seed();
  }

  const totalUsuarios = (db.prepare('SELECT COUNT(*) AS c FROM usuarios').get() as { c: number }).c;
  if (totalUsuarios === 0) {
    const inserirUsuario = db.prepare(`
      INSERT INTO usuarios (nome, documento, telefone, endereco)
      VALUES (@nome, @documento, @telefone, @endereco)
    `);
    const seed = db.transaction(() => {
      inserirUsuario.run({ nome: 'CLIENTE BALCAO', documento: null, telefone: null, endereco: null });
      inserirUsuario.run({ nome: 'MARIA DA SILVA', documento: '123.456.789-00', telefone: '(11) 98888-1234', endereco: 'RUA DAS FLORES, 123 - CENTRO' });
      inserirUsuario.run({ nome: 'JOAO PEREIRA', documento: '987.654.321-00', telefone: '(11) 97777-5678', endereco: 'AV. BRASIL, 456 - JARDIM' });
    });
    seed();
  }
}

export function extrairDataIso(dataStr: unknown): string | null {

  if (dataStr === null || dataStr === undefined) return null;

  if (dataStr instanceof Date) {
    const yyyy = String(dataStr.getFullYear()).padStart(4, '0');
    const mm = String(dataStr.getMonth() + 1).padStart(2, '0');
    const dd = String(dataStr.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  if (typeof dataStr === 'number') {
    const dateObj = new Date(Math.round((dataStr - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const yyyy = String(dateObj.getUTCFullYear()).padStart(4, '0');
      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  const s = String(dataStr).trim();
  if (!s) return null;

  // Se for apenas número em formato string (ex: "45524")
  if (/^\d{5}$/.test(s)) {
    const n = parseInt(s, 10);
    const dateObj = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const yyyy = String(dateObj.getUTCFullYear()).padStart(4, '0');
      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY ou DD.MM.YYYY (com hora opcional)
  const mBr = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (mBr) {
    const dia = mBr[1].padStart(2, '0');
    const mes = mBr[2].padStart(2, '0');
    let ano = mBr[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  // YYYY-MM-DD, YYYY/MM/DD ou YYYY.MM.DD (com hora opcional)
  const mIso = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (mIso) {
    const ano = mIso[1];
    const mes = mIso[2].padStart(2, '0');
    const dia = mIso[3].padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

function obterHojeIso(dataRef?: Date): string {
  const d = dataRef ?? new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function paraFloat(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const s = String(val).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Regra de negócio: define o preço applied ao item considerando a
 * vigência da promoção na data atual (fuso horário local).
 */
export function resolverPreco(produto: Produto, dataReferencia: Date = new Date()): PrecoResolvido {
  const precoPromo = paraFloat(produto.preco_promocao);
  const precoVnd = paraFloat(produto.preco_vnd);

  if (precoPromo <= 0) {
    return { precoAplicado: precoVnd, promocional: false };
  }

  const hoje = obterHojeIso(dataReferencia);
  const fimPromoIso = extrairDataIso(produto.data_fim_promocao);

  // A promoção é válida se a data atual for menor ou igual à data limite (ou sem data limite definida)
  const promocaoValida = !fimPromoIso || hoje <= fimPromoIso;

  if (promocaoValida) {
    return { precoAplicado: precoPromo, promocional: true };
  }

  return { precoAplicado: precoVnd, promocional: false };
}




/** Busca produto por código numérico (produto_id), código de barras ou por descrição (se >= 3 letras e resultado único). */
export function buscarProdutoPorCodigoOuBarras(termo: string): Produto | null {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return null;

  const porBarras = db
    .prepare('SELECT * FROM produtos WHERE barras = ? OR TRIM(barras) = ?')
    .get(termoLimpo, termoLimpo) as Produto | undefined;
  if (porBarras) return porBarras;

  if (/^\d+$/.test(termoLimpo)) {
    const porId = db
      .prepare('SELECT * FROM produtos WHERE produto_id = ?')
      .get(Number(termoLimpo)) as Produto | undefined;
    if (porId) return porId;
  }

  if (termoLimpo.length >= 3) {
    const resultados = pesquisarProdutos(termoLimpo, 15);
    if (resultados.length === 1) {
      return resultados[0];
    }
  }

  return null;
}

/** Busca de produtos por código de barras, ID ou iniciais/descrição (autocomplete). */
export function pesquisarProdutos(termo: string, limite = 15): Produto[] {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return [];

  const porBarras = db
    .prepare('SELECT * FROM produtos WHERE barras = ?')
    .get(termoLimpo) as Produto | undefined;

  let porId: Produto | undefined = undefined;
  if (/^\d+$/.test(termoLimpo)) {
    porId = db
      .prepare('SELECT * FROM produtos WHERE produto_id = ?')
      .get(Number(termoLimpo)) as Produto | undefined;
  }

  const termoComeco = `${termoLimpo}%`;
  const termoContem = `%${termoLimpo}%`;

  const porDescricao = db
    .prepare(`
      SELECT * FROM produtos 
      WHERE descricao LIKE ? OR barras LIKE ?
      ORDER BY 
        CASE 
          WHEN descricao LIKE ? THEN 1 
          WHEN descricao LIKE ? THEN 2 
          ELSE 3 
        END, 
        descricao ASC 
      LIMIT ?
    `)
    .all(termoContem, termoContem, termoComeco, termoContem, limite) as Produto[];

  const lista: Produto[] = [];
  const idsVistos = new Set<number>();

  if (porBarras) {
    lista.push(porBarras);
    idsVistos.add(porBarras.produto_id);
  }
  if (porId && !idsVistos.has(porId.produto_id)) {
    lista.push(porId);
    idsVistos.add(porId.produto_id);
  }
  for (const item of porDescricao) {
    if (!idsVistos.has(item.produto_id)) {
      lista.push(item);
      idsVistos.add(item.produto_id);
    }
  }

  return lista.slice(0, limite);
}

/** Mantém retrocompatibilidade com a assinatura antiga de busca por descrição. */
export function pesquisarProdutosPorDescricao(termo: string, limite = 15): Produto[] {
  return pesquisarProdutos(termo, limite);
}

export function buscarUsuarioPorId(usuarioId: number): Usuario | null {
  const usuario = db
    .prepare('SELECT * FROM usuarios WHERE usuario_id = ?')
    .get(usuarioId) as Usuario | undefined;
  return usuario ?? null;
}

/** Busca usuário por ID numérico, CPF, Telefone ou Nome. */
export function buscarUsuarioPorTermo(termo: string): Usuario | null {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return null;

  if (/^\d+$/.test(termoLimpo)) {
    const porId = buscarUsuarioPorId(Number(termoLimpo));
    if (porId) return porId;
  }

  const resultados = pesquisarUsuarios(termoLimpo, 15);
  if (resultados.length === 1) {
    return resultados[0];
  }

  return null;
}

/** Busca textual por Usuário/Cliente por ID, Nome, CPF (documento) ou Telefone (autocomplete). */
export function pesquisarUsuarios(termo: string, limite = 15): Usuario[] {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return [];

  const apenasNumeros = termoLimpo.replace(/\D/g, '');
  const termoContem = `%${termoLimpo}%`;
  const termoComeco = `${termoLimpo}%`;
  const numContem = apenasNumeros ? `%${apenasNumeros}%` : '';

  const idNum = /^\d+$/.test(termoLimpo) ? Number(termoLimpo) : -1;

  const resultados = db
    .prepare(`
      SELECT * FROM usuarios
      WHERE 
        usuario_id = ?
        OR nome LIKE ?
        OR documento LIKE ?
        OR (? <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(documento, ''), '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?)
        OR telefone LIKE ?
        OR (? <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ?)
      ORDER BY 
        CASE 
          WHEN usuario_id = ? THEN 1
          WHEN nome LIKE ? THEN 2
          WHEN nome LIKE ? THEN 3
          ELSE 4 
        END, 
        nome ASC
      LIMIT ?
    `)
    .all(
      idNum,
      termoContem,
      termoContem,
      numContem,
      numContem,
      termoContem,
      numContem,
      numContem,
      idNum,
      termoComeco,
      termoContem,
      limite
    ) as Usuario[];

  return resultados;
}

export function pesquisarUsuariosPorNome(termo: string, limite = 15): Usuario[] {
  return pesquisarUsuarios(termo, limite);
}

/** Grava o orçamento e seus itens em uma única transação e retorna o registro completo. */
export function criarOrcamento(input: OrcamentoInput): OrcamentoCompleto {
  const inserirOrcamento = db.prepare(`
    INSERT INTO orcamentos (usuario_id, tipo_operacao, total, terminal, forma_pagamento, valor_pago, troco, cliente_nome, cliente_telefone, cliente_documento, cliente_endereco)
    VALUES (@usuario_id, @tipo_operacao, @total, @terminal, @forma_pagamento, @valor_pago, @troco, @cliente_nome, @cliente_telefone, @cliente_documento, @cliente_endereco)
  `);

  const inserirItem = db.prepare(`
    INSERT INTO orcamento_itens
      (orcamento_id, produto_id, descricao, barras, quantidade, preco_unitario, promocional, subtotal)
    VALUES
      (@orcamento_id, @produto_id, @descricao, @barras, @quantidade, @preco_unitario, @promocional, @subtotal)
  `);

  const transacao = db.transaction((dados: OrcamentoInput) => {
    const resultado = inserirOrcamento.run({
      usuario_id: dados.usuario_id,
      tipo_operacao: dados.tipo_operacao,
      total: dados.total,
      terminal: dados.terminal,
      forma_pagamento: dados.forma_pagamento ?? null,
      valor_pago: dados.valor_pago ?? 0,
      troco: dados.troco ?? 0,
      cliente_nome: dados.cliente_nome ?? null,
      cliente_telefone: dados.cliente_telefone ?? null,
      cliente_documento: dados.cliente_documento ?? null,
      cliente_endereco: dados.cliente_endereco ?? null,
    });
    const orcamentoId = Number(resultado.lastInsertRowid);


    for (const item of dados.itens) {
      inserirItem.run({
        orcamento_id: orcamentoId,
        produto_id: item.produto_id,
        descricao: item.descricao,
        barras: item.barras,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        promocional: item.promocional ? 1 : 0,
        subtotal: item.subtotal,
      });
    }

    return orcamentoId;
  });

  const orcamentoId = transacao(input);
  return buscarOrcamentoCompleto(orcamentoId)!;
}

export function buscarOrcamentoCompleto(orcamentoId: number): OrcamentoCompleto | null {
  const orcamento = db
    .prepare('SELECT * FROM orcamentos WHERE orcamento_id = ?')
    .get(orcamentoId) as OrcamentoCompleto | undefined;
  if (!orcamento) return null;

  const itens = db
    .prepare('SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY item_id ASC')
    .all(orcamentoId) as ItemOrcamento[];

  const usuario = orcamento.usuario_id ? buscarUsuarioPorId(orcamento.usuario_id) : null;

  return { ...orcamento, itens, usuario };
}

export function listarUltimosOrcamentos(limite = 50): OrcamentoCompleto[] {
  const ids = db
    .prepare('SELECT orcamento_id FROM orcamentos ORDER BY orcamento_id DESC LIMIT ?')
    .all(limite) as { orcamento_id: number }[];
  return ids
    .map((row) => buscarOrcamentoCompleto(row.orcamento_id))
    .filter((o): o is OrcamentoCompleto => o !== null);
}
