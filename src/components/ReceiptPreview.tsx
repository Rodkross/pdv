import React, { useMemo, useState } from 'react';
import { useSales } from '../context/SalesContext';
import { OrcamentoCompleto } from '../types';
import { gerarTextoCupom, totalViasPorModalidade } from '../utils/cupomFormatter';

interface ReceiptPreviewProps {
  orcamento: OrcamentoCompleto;
  terminal: string;
  onFechar: () => void;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ orcamento, terminal, onFechar }) => {
  const { impressorasDisponiveis, impressoraSelecionada, setImpressoraSelecionada, configFilial } =
    useSales();
  const totalVias = totalViasPorModalidade(orcamento.tipo_operacao);
  const [viaAtiva, setViaAtiva] = useState(1);
  const [reimprimindo, setReimprimindo] = useState(false);
  const [mensagemReimpressao, setMensagemReimpressao] = useState<string | null>(null);

  const textoVias = useMemo(() => {
    const vias: string[] = [];
    for (let via = 1; via <= totalVias; via++) {
      vias.push(gerarTextoCupom({ orcamento, numeroVia: via, totalVias, terminal, loja: configFilial }));
    }
    return vias;
  }, [orcamento, totalVias, terminal, configFilial]);

  async function reimprimir() {
    setReimprimindo(true);
    setMensagemReimpressao(null);
    try {
      await window.api.orcamentos.imprimirVias(
        orcamento.orcamento_id,
        impressoraSelecionada || undefined
      );
      setMensagemReimpressao('Impresso com sucesso!');
    } catch (err) {
      setMensagemReimpressao(`Erro ao imprimir: ${(err as Error).message}`);
    } finally {
      setReimprimindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-slate-100 text-slate-900 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-pdv-panel px-4 py-3 text-slate-100">
          <div>
            <h3 className="text-base font-bold">
              Venda #{orcamento.orcamento_id} concluída — {orcamento.tipo_operacao}
              {orcamento.tipo_operacao === 'CESTA' && orcamento.numero_cesta_dia
                ? ` (Nº ${orcamento.numero_cesta_dia} do dia)`
                : ''}
            </h3>
            <p className="text-xs text-slate-400">
              {totalVias} via(s) impressa(s) / pré-visualização do cupom
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-sm font-semibold hover:bg-slate-600 text-white"
          >
            Concluir / Nova Venda
          </button>
        </header>

        {/* Seletor de impressora para re-impressão */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-200 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Impressora:</span>
            <select
              value={impressoraSelecionada}
              onChange={(e) => setImpressoraSelecionada(e.target.value)}
              className="rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-900 font-semibold outline-none"
            >
              <option value="">Impressora Padrão do Sistema</option>
              {impressorasDisponiveis.map((imp) => (
                <option key={imp.name} value={imp.name}>
                  {imp.name} {imp.isDefault ? '(Padrão)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {mensagemReimpressao && (
              <span className="text-xs font-semibold text-blue-700">{mensagemReimpressao}</span>
            )}
            <button
              onClick={reimprimir}
              disabled={reimprimindo}
              className="rounded bg-pdv-accent px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {reimprimindo ? 'Imprimindo...' : 'Reimprimir Cupom'}
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-300 bg-slate-200 px-3 pt-2">
          {textoVias.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setViaAtiva(idx + 1)}
              className={`rounded-t-md px-3 py-1.5 text-xs font-semibold ${
                viaAtiva === idx + 1
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-300 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Via {idx + 1}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          <pre className="mx-auto w-[340px] whitespace-pre-wrap break-words rounded bg-white p-4 font-mono text-[11px] leading-tight shadow-inner border border-slate-300">
            {textoVias[viaAtiva - 1]}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
