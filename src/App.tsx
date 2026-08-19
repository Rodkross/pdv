import React from 'react';
import { SalesProvider } from './context/SalesContext';
import PDV from './components/PDV';
import ImportPanel from './components/ImportPanel';

const App: React.FC = () => {
  return (
    <SalesProvider>
      <div className="flex h-screen w-screen flex-col bg-pdv-bg">
        <header className="flex items-center justify-between border-b border-pdv-panelLight bg-pdv-panel px-4 py-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              PDV · Orçamento de Balcão
            </h1>
            <span className="text-xs text-slate-400">Modo Offline / Rede Local (LAN)</span>
          </div>
          <ImportPanel />
        </header>
        <main className="flex-1 overflow-hidden">
          <PDV />
        </main>
      </div>
    </SalesProvider>
  );
};

export default App;
