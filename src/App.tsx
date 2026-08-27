import React, { useState } from 'react';
import { SalesProvider } from './context/SalesContext';
import PDV from './components/PDV';
import PrinterStatusBar from './components/PrinterStatusBar';
import RelatorioVendas from './components/RelatorioVendas';
import Configuracoes from './components/Configuracoes';

/** Ícone de engrenagem simples (geométrico, sem dependência externa). */
const IconeEngrenagem: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    {Array.from({ length: 8 }).map((_, i) => (
      <rect
        key={i}
        x="10.5"
        y="1"
        width="3"
        height="5"
        rx="1"
        fill="currentColor"
        transform={`rotate(${i * 45} 12 12)`}
      />
    ))}
    <circle cx="12" cy="12" r="7" fill="currentColor" />
    <circle cx="12" cy="12" r="3" fill="#1e293b" />
  </svg>
);

const App: React.FC = () => {
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [configuracoesAberto, setConfiguracoesAberto] = useState(false);

  return (
    <SalesProvider>
      <div className="flex h-screen w-screen flex-col bg-pdv-bg">
        <header className="no-imprimir flex items-center justify-between border-b border-pdv-panelLight bg-pdv-panel px-4 py-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              PDV · Orçamento de Balcão
            </h1>
            <span className="text-xs text-slate-400">Modo Offline / Rede Local (LAN)</span>
          </div>
          <div className="flex items-center gap-3">
            <PrinterStatusBar />
            <button
              onClick={() => setRelatorioAberto(true)}
              className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600"
            >
              Relatório de Vendas
            </button>
            <button
              onClick={() => setConfiguracoesAberto(true)}
              title="Configurações"
              aria-label="Configurações"
              className="rounded-md p-2 text-slate-300 transition hover:bg-pdv-panelLight hover:text-white"
            >
              <IconeEngrenagem className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <PDV />
        </main>
        {relatorioAberto && <RelatorioVendas onFechar={() => setRelatorioAberto(false)} />}
        {configuracoesAberto && (
          <Configuracoes onFechar={() => setConfiguracoesAberto(false)} />
        )}
      </div>
    </SalesProvider>
  );
};

export default App;
