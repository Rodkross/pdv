import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'http';
import {
  buscarProdutoPorCodigoOuBarras,
  pesquisarProdutosPorDescricao,
  buscarUsuarioPorId,
  pesquisarUsuariosPorNome,
  criarOrcamento,
  buscarOrcamentoCompleto,
  resolverPreco,
} from './database';
import { imprimirViasOrcamento } from './printer';
import { OrcamentoInput } from './types';

export const PORTA_SERVIDOR_LAN = 3550;

let servidorHttp: Server | null = null;

export function iniciarServidorLan(): Server {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Saúde do servidor - usado pelos terminais clientes para descoberta na LAN
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ ok: true, servico: 'pdv-orcamento-balcao', versao: '1.0.0' });
  });

  app.get('/api/produtos/busca', (req: Request, res: Response) => {
    const termo = String(req.query.termo ?? '');
    const produto = buscarProdutoPorCodigoOuBarras(termo);
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado' });
    const preco = resolverPreco(produto);
    res.json({ produto, preco });
  });

  app.get('/api/produtos/pesquisa', (req: Request, res: Response) => {
    const termo = String(req.query.termo ?? '');
    const produtos = pesquisarProdutosPorDescricao(termo);
    res.json({ produtos });
  });

  app.get('/api/usuarios/:id', (req: Request, res: Response) => {
    const usuario = buscarUsuarioPorId(Number(req.params.id));
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    res.json({ usuario });
  });

  app.get('/api/usuarios', (req: Request, res: Response) => {
    const termo = String(req.query.termo ?? '');
    const usuarios = pesquisarUsuariosPorNome(termo);
    res.json({ usuarios });
  });

  app.post('/api/orcamentos', (req: Request, res: Response) => {
    try {
      const input = req.body as OrcamentoInput;
      const orcamento = criarOrcamento(input);
      res.status(201).json({ orcamento });
    } catch (erro) {
      res.status(400).json({ erro: (erro as Error).message });
    }
  });

  app.get('/api/orcamentos/:id', (req: Request, res: Response) => {
    const orcamento = buscarOrcamentoCompleto(Number(req.params.id));
    if (!orcamento) return res.status(404).json({ erro: 'Orcamento nao encontrado' });
    res.json({ orcamento });
  });

  app.post('/api/orcamentos/:id/imprimir', async (req: Request, res: Response) => {
    const orcamento = buscarOrcamentoCompleto(Number(req.params.id));
    if (!orcamento) return res.status(404).json({ erro: 'Orcamento nao encontrado' });
    const terminal = String(req.body?.terminal ?? 'REMOTO');
    const nomeImpressora = req.body?.nomeImpressora as string | undefined;
    const resultados = await imprimirViasOrcamento(orcamento, terminal, nomeImpressora);
    res.json({ resultados });
  });

  servidorHttp = app.listen(PORTA_SERVIDOR_LAN, '0.0.0.0', () => {
    console.log(`[server] Servidor LAN ouvindo na porta ${PORTA_SERVIDOR_LAN}`);
  });

  return servidorHttp;
}

export function pararServidorLan(): void {
  servidorHttp?.close();
  servidorHttp = null;
}
