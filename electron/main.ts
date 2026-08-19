import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  buscarProdutoPorCodigoOuBarras,
  pesquisarProdutos,
  buscarUsuarioPorId,
  buscarUsuarioPorTermo,
  pesquisarUsuarios,
  criarOrcamento,
  resolverPreco,
} from './database';
import { imprimirViasOrcamento } from './printer';
import { iniciarServidorLan, pararServidorLan } from './server';
import { importarProdutosDoArquivo, importarUsuariosDoArquivo, ResultadoImportacao } from './importer';
import { OrcamentoInput } from './types';

const isDev = !app.isPackaged;
const NOME_TERMINAL = os.hostname();

let janelaPrincipal: BrowserWindow | null = null;

function criarJanela(): void {
  janelaPrincipal = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    janelaPrincipal.loadURL('http://localhost:5173');
    janelaPrincipal.webContents.openDevTools({ mode: 'detach' });
  } else {
    janelaPrincipal.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });
}

// ---------------------------------------------------------------------------
// IPC: canais expostos ao renderer via preload.ts (window.api)
// ---------------------------------------------------------------------------
function registrarHandlersIpc(): void {
  ipcMain.handle('produtos:buscarPorCodigoOuBarras', (_evt, termo: string) => {
    const produto = buscarProdutoPorCodigoOuBarras(termo);
    if (!produto) return null;
    const preco = resolverPreco(produto);
    return { produto, preco };
  });

  ipcMain.handle('produtos:pesquisar', (_evt, termo: string) => {
    const produtos = pesquisarProdutos(termo);
    return produtos.map((produto) => ({
      produto,
      preco: resolverPreco(produto),
    }));
  });

  ipcMain.handle('usuarios:buscarPorId', (_evt, usuarioId: number) => {
    return buscarUsuarioPorId(usuarioId);
  });

  ipcMain.handle('usuarios:buscarPorTermo', (_evt, termo: string) => {
    return buscarUsuarioPorTermo(termo);
  });

  ipcMain.handle('usuarios:pesquisar', (_evt, termo: string) => {
    return pesquisarUsuarios(termo);
  });

  ipcMain.handle('orcamentos:criar', (_evt, input: OrcamentoInput) => {
    return criarOrcamento(input);
  });

  ipcMain.handle('orcamentos:imprimirVias', async (_evt, orcamentoId: number, nomeImpressora?: string) => {
    const { buscarOrcamentoCompleto } = await import('./database');
    const orcamento = buscarOrcamentoCompleto(orcamentoId);
    if (!orcamento) throw new Error(`Orcamento #${orcamentoId} nao encontrado`);
    return imprimirViasOrcamento(orcamento, NOME_TERMINAL, nomeImpressora);
  });

  ipcMain.handle('sistema:infoTerminal', () => {
    return { terminal: NOME_TERMINAL, plataforma: process.platform };
  });

  ipcMain.handle('sistema:listarImpressoras', async () => {
    if (!janelaPrincipal) return [];
    try {
      return await janelaPrincipal.webContents.getPrintersAsync();
    } catch {
      return [];
    }
  });

  ipcMain.handle('importacao:produtos', async (): Promise<ResultadoImportacao | null> => {
    if (!janelaPrincipal) return null;
    const escolha = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Selecionar planilha de PRODUTOS',
      filters: [{ name: 'Planilhas Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    if (escolha.canceled || escolha.filePaths.length === 0) return null;
    return importarProdutosDoArquivo(escolha.filePaths[0]);
  });

  ipcMain.handle('importacao:usuarios', async (): Promise<ResultadoImportacao | null> => {
    if (!janelaPrincipal) return null;
    const escolha = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Selecionar planilha de USUÁRIOS/CLIENTES',
      filters: [{ name: 'Planilhas Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    if (escolha.canceled || escolha.filePaths.length === 0) return null;
    return importarUsuariosDoArquivo(escolha.filePaths[0]);
  });
}

app.whenReady().then(() => {
  initDatabase();
  registrarHandlersIpc();
  iniciarServidorLan();
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  pararServidorLan();
  if (process.platform !== 'darwin') app.quit();
});
