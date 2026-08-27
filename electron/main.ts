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
  contarCestasHoje,
  gerarRelatorioVendasPorDiaVendedor,
  obterConfiguracoesApp,
  salvarConfiguracoesApp,
} from './database';
import { imprimirViasOrcamento } from './printer';
import { resolverCaminhoScript } from './resourcePaths';
import { execFile } from 'child_process';
import { iniciarServidorLan, pararServidorLan } from './server';
import { importarProdutosDoArquivo, importarUsuariosDoArquivo, ResultadoImportacao } from './importer';
import { OrcamentoInput, ConfiguracoesApp } from './types';

const isDev = !app.isPackaged;
const NOME_TERMINAL = os.hostname();

// ---------------------------------------------------------------------------
// Interpretação do status de impressora (bitmask retornado pelo Chromium a
// partir da API nativa de spooler do Windows, PRINTER_INFO_2.dwStatus).
// Referência: winspool.h (constantes PRINTER_STATUS_*)
// ---------------------------------------------------------------------------
const PRINTER_STATUS_OFFLINE = 0x00000080;
const PRINTER_STATUS_ERROR = 0x00000002;
const PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;
const PRINTER_STATUS_SERVER_UNKNOWN = 0x00800000;
const PRINTER_STATUS_PAPER_OUT = 0x00000010;
const PRINTER_STATUS_PAPER_JAM = 0x00000008;
const PRINTER_STATUS_DOOR_OPEN = 0x00400000;
const PRINTER_STATUS_NO_TONER = 0x00040000;

function interpretarStatusImpressora(status: number): { online: boolean; situacao: string } {
  const bitsOffline =
    PRINTER_STATUS_OFFLINE | PRINTER_STATUS_NOT_AVAILABLE | PRINTER_STATUS_SERVER_UNKNOWN;

  if (status & bitsOffline) {
    return { online: false, situacao: 'Offline' };
  }
  if (status & PRINTER_STATUS_ERROR) {
    return { online: false, situacao: 'Erro' };
  }
  if (status & PRINTER_STATUS_PAPER_OUT) {
    return { online: true, situacao: 'Sem papel' };
  }
  if (status & PRINTER_STATUS_PAPER_JAM) {
    return { online: true, situacao: 'Papel atolado' };
  }
  if (status & PRINTER_STATUS_DOOR_OPEN) {
    return { online: true, situacao: 'Tampa aberta' };
  }
  if (status & PRINTER_STATUS_NO_TONER) {
    return { online: true, situacao: 'Sem toner/fita' };
  }
  return { online: true, situacao: 'Pronta' };
}

interface StatusRealPorta {
  workOffline: boolean;
  portaAtiva: boolean;
  portName: string;
}

/**
 * Consulta o status "real" de conexão das impressoras (via printer-status.ps1
 * / WMI), que complementa o bitmask do spooler: detecta impressora térmica
 * desconectada fisicamente mesmo quando o Windows ainda não atualizou o
 * status do spooler (comum em impressoras "Genérica/Texto" em porta COM).
 * Em caso de falha ou timeout, retorna um mapa vazio (nunca marca offline
 * "por engano" — só complementa, nunca substitui, a checagem já existente).
 */
function consultarStatusRealImpressoras(): Promise<Map<string, StatusRealPorta>> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(new Map());
      return;
    }

    const script = resolverCaminhoScript('printer-status.ps1');
    if (!script) {
      console.error('[printer-status] printer-status.ps1 não encontrado.');
      resolve(new Map());
      return;
    }

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
      { timeout: 5000 },
      (erro, stdout) => {
        if (erro) {
          console.error('[printer-status] falha ao consultar status real:', erro.message);
          resolve(new Map());
          return;
        }
        try {
          const lista = JSON.parse(stdout) as Array<{
            Name: string;
            PortName: string;
            WorkOffline: boolean;
            PortaAtiva: boolean;
          }>;
          const mapa = new Map<string, StatusRealPorta>();
          for (const item of lista) {
            mapa.set(item.Name, {
              workOffline: item.WorkOffline,
              portaAtiva: item.PortaAtiva,
              portName: item.PortName,
            });
          }
          resolve(mapa);
        } catch (e) {
          console.error('[printer-status] resposta inesperada do script:', stdout);
          resolve(new Map());
        }
      }
    );
  });
}

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
    const { filial } = obterConfiguracoesApp();
    return imprimirViasOrcamento(orcamento, NOME_TERMINAL, filial, nomeImpressora);
  });

  ipcMain.handle('sistema:infoTerminal', () => {
    return { terminal: NOME_TERMINAL, plataforma: process.platform };
  });

  ipcMain.handle('sistema:contadorCestasHoje', () => {
    return contarCestasHoje();
  });

  ipcMain.handle('sistema:listarImpressoras', async () => {
    if (!janelaPrincipal) return [];
    try {
      const [impressoras, statusReal] = await Promise.all([
        janelaPrincipal.webContents.getPrintersAsync(),
        consultarStatusRealImpressoras(),
      ]);
      return impressoras.map((imp) => {
        const { online: onlinePorBitmask, situacao: situacaoPorBitmask } =
          interpretarStatusImpressora(imp.status);
        const real = statusReal.get(imp.name);

        let online = onlinePorBitmask;
        let situacao = situacaoPorBitmask;

        // A checagem real (porta/WMI) só pode DEGRADAR o status pra offline;
        // nunca promove uma impressora de volta pra online por conta própria.
        if (real?.workOffline) {
          online = false;
          situacao = 'Offline';
        } else if (real && !real.portaAtiva) {
          online = false;
          situacao = `Desconectada (porta ${real.portName || '?'} não encontrada)`;
        }

        return {
          name: imp.name,
          displayName: imp.displayName,
          isDefault: imp.isDefault,
          status: imp.status,
          online,
          situacao,
        };
      });
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

  ipcMain.handle('configuracoes:obter', () => {
    return obterConfiguracoesApp();
  });

  ipcMain.handle('configuracoes:salvar', (_evt, config: ConfiguracoesApp) => {
    return salvarConfiguracoesApp(config);
  });

  ipcMain.handle(
    'relatorios:vendasPorDiaVendedor',
    (_evt, dataInicio: string, dataFim: string) => {
      const formatoValido = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (!formatoValido(dataInicio) || !formatoValido(dataFim)) {
        throw new Error('Datas inválidas. Use o formato AAAA-MM-DD.');
      }
      return gerarRelatorioVendasPorDiaVendedor(dataInicio, dataFim);
    }
  );
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
