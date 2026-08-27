import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LinhaRelatorioVendas } from '../types';

interface RelatorioVendasProps {
  onFechar: () => void;
}

function hojeIsoLocal(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'. Evita `new Date(string)` de propósito: isso
 * interpreta a string como UTC e pode mostrar o dia errado em fusos como o
 * do Brasil (UTC-3). */
function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const RelatorioVendas: React.FC<RelatorioVendasProps> = ({ onFechar }) => {
  const hoje = useMemo(() => hojeIsoLocal(), []);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [linhas, setLinhas] = useState<LinhaRelatorioVendas[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [geradoEm, setGeradoEm] = useState<string | null>(null);

  const gerar = useCallback(async () => {
    if (dataInicio > dataFim) {
      setErro('A data inicial não pode ser depois da data final.');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await window.api.relatorios.vendasPorDiaVendedor(dataInicio, dataFim);
      setLinhas(resultado);
      setGeradoEm(new Date().toLocaleString('pt-BR'));
    } catch (e) {
      setErro((e as Error).message ?? 'Erro ao gerar relatório.');
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  // Gera automaticamente o relatório do dia de hoje ao abrir.
  useEffect(() => {
    gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaRelatorioVendas[]>();
    for (const linha of linhas) {
      if (!mapa.has(linha.data)) mapa.set(linha.data, []);
      mapa.get(linha.data)!.push(linha);
    }
    // A consulta já vem ordenada por data DESC, então a ordem de inserção
    // no Map (preservada pelo JS) já reflete a ordem correta de exibição.
    return Array.from(mapa.entries());
  }, [linhas]);

  const totalGeral = useMemo(
    () => linhas.reduce((soma, l) => soma + l.totalVendido, 0),
    [linhas]
  );
  const totalCestas = useMemo(() => linhas.reduce((s, l) => s + l.qtdCestas, 0), [linhas]);
  const totalEntregas = useMemo(() => linhas.reduce((s, l) => s + l.qtdEntregas, 0), [linhas]);
  const totalOrcamentos = useMemo(
    () => linhas.reduce((s, l) => s + l.qtdOrcamentos, 0),
    [linhas]
  );

  function imprimir() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-slate-100 text-slate-900 shadow-2xl">
        {/* Barra superior: some inteira na impressão (.no-imprimir) */}
        <header className="no-imprimir flex flex-wrap items-center justify-between gap-3 bg-pdv-panel px-4 py-3 text-slate-100">
          <div>
            <h3 className="text-base font-bold">Relatório de Vendas — por Dia / Vendedor</h3>
            <p className="text-xs text-slate-400">
              Selecione o período e clique em Gerar. Depois, Imprimir / Salvar PDF.
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Fechar
          </button>
        </header>

        <div className="no-imprimir flex flex-wrap items-end gap-3 border-b border-slate-300 bg-slate-200 px-4 py-3">
          <label className="flex flex-col text-xs font-semibold text-slate-700">
            De
            <input
              type="date"
              value={dataInicio}
              max={dataFim}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 rounded border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-700">
            Até
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              max={hoje}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1 rounded border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
            />
          </label>
          <button
            onClick={gerar}
            disabled={carregando}
            className="rounded-md bg-pdv-accent px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {carregando ? 'Gerando...' : 'Gerar'}
          </button>
          <button
            onClick={imprimir}
            disabled={carregando || linhas.length === 0}
            className="rounded-md bg-pdv-accent2 px-4 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Imprimir / Salvar PDF
          </button>
          {erro && <span className="text-xs font-semibold text-red-600">{erro}</span>}
        </div>

        {/* Conteúdo — é isto que fica visível/impresso (ver .relatorio-imprimivel no index.css) */}
        <div className="relatorio-imprimivel flex-1 overflow-y-auto bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Relatório de Vendas por Dia e Vendedor</h2>
            <p className="text-xs text-slate-600">
              Período: {formatarDataBr(dataInicio)} a {formatarDataBr(dataFim)}
              {geradoEm ? ` · Gerado em ${geradoEm}` : ''}
            </p>
          </div>

          {linhas.length === 0 && !carregando && (
            <p className="text-sm text-slate-500">Nenhuma venda encontrada nesse período.</p>
          )}

          {grupos.map(([data, linhasDoDia]) => {
            const totalDia = linhasDoDia.reduce((s, l) => s + l.totalVendido, 0);
            return (
              <div key={data} className="mb-6 break-inside-avoid">
                <h3 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold text-slate-900">
                  {formatarDataBr(data)}
                </h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-400 text-left text-xs uppercase text-slate-600">
                      <th className="py-1 pr-2">Vendedor</th>
                      <th className="py-1 px-2 text-right">Orçamentos</th>
                      <th className="py-1 px-2 text-right">Cestas</th>
                      <th className="py-1 px-2 text-right">Entregas</th>
                      <th className="py-1 pl-2 text-right">Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDoDia.map((l) => (
                      <tr key={`${l.data}-${l.vendedorId ?? 'sem-vendedor'}`} className="border-b border-slate-200">
                        <td className="py-1 pr-2">{l.vendedorNome}</td>
                        <td className="py-1 px-2 text-right">{l.qtdOrcamentos}</td>
                        <td className="py-1 px-2 text-right">{l.qtdCestas}</td>
                        <td className="py-1 px-2 text-right">{l.qtdEntregas}</td>
                        <td className="py-1 pl-2 text-right font-semibold">
                          {formatarMoeda(l.totalVendido)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-slate-900">
                      <td className="pt-1 pr-2" colSpan={4}>
                        Subtotal do dia
                      </td>
                      <td className="pt-1 pl-2 text-right">{formatarMoeda(totalDia)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {linhas.length > 0 && (
            <div className="mt-6 border-t-2 border-slate-800 pt-3">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="font-bold text-slate-900">
                    <td className="py-1">TOTAL DO PERÍODO</td>
                    <td className="py-1 px-2 text-right">{totalOrcamentos} orçamento(s)</td>
                    <td className="py-1 px-2 text-right">{totalCestas} cesta(s)</td>
                    <td className="py-1 px-2 text-right">{totalEntregas} entrega(s)</td>
                    <td className="py-1 pl-2 text-right">{formatarMoeda(totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelatorioVendas;
