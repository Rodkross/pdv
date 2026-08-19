import React, { useState } from 'react';
import { ResultadoImportacao } from '../types';

const ImportPanel: React.FC = () => {
  const [carregando, setCarregando] = useState<'produtos' | 'usuarios' | null>(null);
  const [resultado, setResultado] = useState<{ tipo: string; dados: ResultadoImportacao } | null>(null);

  async function importarProdutos() {
    setCarregando('produtos');
    try {
      const dados = await window.api.importacao.produtos();
      if (dados) setResultado({ tipo: 'Produtos', dados });
    } finally {
      setCarregando(null);
    }
  }

  async function importarUsuarios() {
    setCarregando('usuarios');
    try {
      const dados = await window.api.importacao.usuarios();
      if (dados) setResultado({ tipo: 'Vendedores / Usuários', dados });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={importarProdutos}
          disabled={carregando !== null}
          className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
        >
          {carregando === 'produtos' ? 'Importando...' : 'Importar Produtos (.xlsx)'}
        </button>
        <button
          onClick={importarUsuarios}
          disabled={carregando !== null}
          className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
        >
          {carregando === 'usuarios' ? 'Importando...' : 'Importar Vendedores (.xlsx)'}
        </button>
      </div>

      {resultado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg bg-pdv-panel p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-100">
              Importação de {resultado.tipo} concluída
            </h3>
            <p className="mb-4 text-xs text-slate-400 break-all">{resultado.dados.arquivo}</p>

            <div className="mb-4 grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-slate-100">
                  {resultado.dados.totalLinhas}
                </span>
                <span className="text-xs text-slate-400">Linhas</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-accent2">
                  {resultado.dados.inseridos}
                </span>
                <span className="text-xs text-slate-400">Inseridos</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-accent">
                  {resultado.dados.atualizados}
                </span>
                <span className="text-xs text-slate-400">Atualizados</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-warn">
                  {resultado.dados.ignorados}
                </span>
                <span className="text-xs text-slate-400">Ignorados</span>
              </div>
            </div>

            {resultado.dados.erros.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded bg-slate-950 p-3">
                <p className="mb-1 text-xs font-semibold text-red-400">Avisos:</p>
                {resultado.dados.erros.map((erro, i) => (
                  <p key={i} className="text-xs text-slate-400">
                    {erro}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={() => setResultado(null)}
              className="w-full rounded-md bg-pdv-accent py-2 text-sm font-semibold hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportPanel;
