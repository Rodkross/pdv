import React, { useMemo, useState } from 'react';
import { useSales } from '../context/SalesContext';

/**
 * Indicador + seletor de impressora exibido no topo da aplicação.
 *
 * - Bolinha verde: impressora selecionada está pronta (online).
 * - Bolinha vermelha: offline / não encontrada / erro.
 * - Bolinha amarela: online mas com algum alerta (sem papel, tampa aberta, etc).
 * - Dropdown permite trocar a impressora usada nas próximas impressões.
 * - Botão de atualizar força uma nova consulta de status ao Windows.
 */
const PrinterStatusBar: React.FC = () => {
  const {
    impressorasDisponiveis,
    impressoraSelecionada,
    setImpressoraSelecionada,
    recarregarImpressoras,
  } = useSales();

  const [atualizando, setAtualizando] = useState(false);

  const impressoraAtual = useMemo(
    () => impressorasDisponiveis.find((i) => i.name === impressoraSelecionada),
    [impressorasDisponiveis, impressoraSelecionada]
  );

  const { corBolinha, textoStatus } = useMemo(() => {
    if (!impressoraSelecionada) {
      return { corBolinha: 'bg-red-500', textoStatus: 'Nenhuma impressora selecionada' };
    }
    if (!impressoraAtual) {
      return { corBolinha: 'bg-red-500', textoStatus: 'Offline' };
    }
    if (impressoraAtual.online === false) {
      // Situações de desconexão (ex.: "Desconectada (porta COM3 não
      // encontrada)") viram só "Offline" no rótulo principal — o detalhe
      // técnico completo fica no title/tooltip pra quem quiser investigar.
      return { corBolinha: 'bg-red-500', textoStatus: 'Offline' };
    }
    if (impressoraAtual.situacao && impressoraAtual.situacao !== 'Pronta') {
      return { corBolinha: 'bg-yellow-400', textoStatus: impressoraAtual.situacao };
    }
    return { corBolinha: 'bg-green-500', textoStatus: 'Pronta' };
  }, [impressoraSelecionada, impressoraAtual]);

  async function handleAtualizar() {
    setAtualizando(true);
    try {
      await recarregarImpressoras();
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-pdv-panelLight bg-pdv-panel px-3 py-1.5">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${corBolinha}`}
        title={impressoraAtual?.situacao || textoStatus}
        aria-label={impressoraAtual?.situacao || textoStatus}
      />
      <select
        className="max-w-[220px] truncate bg-transparent text-sm text-slate-100 outline-none"
        value={impressoraSelecionada}
        onChange={(e) => setImpressoraSelecionada(e.target.value)}
        title={impressoraAtual?.displayName || impressoraSelecionada}
      >
        {impressorasDisponiveis.length === 0 && <option value="">Nenhuma impressora encontrada</option>}
        {impressorasDisponiveis.map((imp) => (
          <option key={imp.name} value={imp.name}>
            {imp.isDefault ? `★ ${imp.name}` : imp.name}
          </option>
        ))}
      </select>
      <span className="hidden text-xs text-slate-400 sm:inline">{textoStatus}</span>
      <button
        type="button"
        onClick={handleAtualizar}
        disabled={atualizando}
        title="Atualizar status da impressora"
        className="rounded p-1 text-slate-400 transition hover:bg-pdv-panelLight hover:text-slate-100 disabled:opacity-50"
      >
        <span className={atualizando ? 'inline-block animate-spin' : 'inline-block'}>⟳</span>
      </button>
    </div>
  );
};

export default PrinterStatusBar;
