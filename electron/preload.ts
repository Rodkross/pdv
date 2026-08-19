import { contextBridge, ipcRenderer } from 'electron';
import { OrcamentoInput } from './types';

const api = {
  produtos: {
    buscarPorCodigoOuBarras: (termo: string) =>
      ipcRenderer.invoke('produtos:buscarPorCodigoOuBarras', termo),
    pesquisar: (termo: string) => ipcRenderer.invoke('produtos:pesquisar', termo),
  },
  usuarios: {
    buscarPorId: (usuarioId: number) => ipcRenderer.invoke('usuarios:buscarPorId', usuarioId),
    buscarPorTermo: (termo: string) => ipcRenderer.invoke('usuarios:buscarPorTermo', termo),
    pesquisar: (termo: string) => ipcRenderer.invoke('usuarios:pesquisar', termo),
  },
  orcamentos: {
    criar: (input: OrcamentoInput) => ipcRenderer.invoke('orcamentos:criar', input),
    imprimirVias: (orcamentoId: number, nomeImpressora?: string) =>
      ipcRenderer.invoke('orcamentos:imprimirVias', orcamentoId, nomeImpressora),
  },
  sistema: {
    infoTerminal: () => ipcRenderer.invoke('sistema:infoTerminal'),
    listarImpressoras: () => ipcRenderer.invoke('sistema:listarImpressoras'),
  },
  importacao: {
    produtos: () => ipcRenderer.invoke('importacao:produtos'),
    usuarios: () => ipcRenderer.invoke('importacao:usuarios'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type PdvApi = typeof api;
