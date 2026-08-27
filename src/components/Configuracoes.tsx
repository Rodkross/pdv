import React, { useEffect, useState } from 'react';
import { useSales } from '../context/SalesContext';
import { ConfiguracoesApp, ResultadoImportacao } from '../types';

interface ConfiguracoesProps {
  onFechar: () => void;
}

const CONFIG_VAZIA: ConfiguracoesApp = {
  filial: { nome: '', endereco: '', cnpj: '', telefone: '' },
};

/** Aplica a máscara "xx.xxx.xxx/xxxx-xx" progressivamente enquanto digita. */
function formatarCNPJ(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  }
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

/**
 * Aplica a máscara "xxxx-xxxx" (8 dígitos) ou "xxxxx-xxxx" (9 dígitos) ao
 * número local. Se vierem mais dígitos (DDD + número), o DDD fica separado
 * por espaço na frente, sem parênteses — ex: "21 2405-4454".
 */
function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  const total = digitos.length;

  if (total <= 4) return digitos;
  if (total <= 8) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  if (total === 9) return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;

  // 10 ou 11 dígitos: os 2 primeiros viram DDD, o resto segue a mesma regra.
  const ddd = digitos.slice(0, 2);
  const local = digitos.slice(2);
  if (local.length <= 8) {
    return `${ddd} ${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return `${ddd} ${local.slice(0, 5)}-${local.slice(5)}`;
}

const Configuracoes: React.FC<ConfiguracoesProps> = ({ onFechar }) => {
  const { recarregarConfigFilial } = useSales();

  const [config, setConfig] = useState<ConfiguracoesApp>(CONFIG_VAZIA);
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvo, setMensagemSalvo] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [importando, setImportando] = useState<'produtos' | 'usuarios' | null>(null);
  const [resultadoImportacao, setResultadoImportacao] = useState<{
    tipo: string;
    dados: ResultadoImportacao;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    window.api.configuracoes.obter().then((cfg) => {
      if (ativo) {
        setConfig(cfg);
        setCarregandoConfig(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  function atualizarFilial(campo: keyof ConfiguracoesApp['filial'], valor: string) {
    setConfig((prev) => ({ ...prev, filial: { ...prev.filial, [campo]: valor } }));
  }

  async function salvar() {
    setSalvando(true);
    setErroSalvar(null);
    setMensagemSalvo(null);
    try {
      const salvo = await window.api.configuracoes.salvar(config);
      setConfig(salvo);
      await recarregarConfigFilial();
      setMensagemSalvo('Configurações salvas com sucesso!');
    } catch (e) {
      setErroSalvar((e as Error).message ?? 'Erro ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  }

  async function importarProdutos() {
    setImportando('produtos');
    try {
      const dados = await window.api.importacao.produtos();
      if (dados) setResultadoImportacao({ tipo: 'Produtos', dados });
    } finally {
      setImportando(null);
    }
  }

  async function importarUsuarios() {
    setImportando('usuarios');
    try {
      const dados = await window.api.importacao.usuarios();
      if (dados) setResultadoImportacao({ tipo: 'Vendedores / Usuários', dados });
    } finally {
      setImportando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-pdv-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-pdv-panelLight px-5 py-3">
          <h2 className="text-base font-bold text-slate-100">⚙ Configurações</h2>
          <button
            onClick={onFechar}
            className="rounded-md bg-pdv-panelLight px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Fechar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carregandoConfig ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : (
            <>
              {/* Dados da filial */}
              <section className="mb-6 rounded-lg bg-slate-900 p-4">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Dados da Filial
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Essas informações aparecem no cabeçalho do cupom impresso.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 flex flex-col text-xs font-semibold text-slate-400">
                    Nome da loja
                    <input
                      value={config.filial.nome}
                      onChange={(e) => atualizarFilial('nome', e.target.value)}
                      className="mt-1 rounded-md border border-pdv-panelLight bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pdv-accent"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col text-xs font-semibold text-slate-400">
                    Endereço
                    <input
                      value={config.filial.endereco}
                      onChange={(e) => atualizarFilial('endereco', e.target.value)}
                      className="mt-1 rounded-md border border-pdv-panelLight bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pdv-accent"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-semibold text-slate-400">
                    CNPJ
                    <input
                      value={config.filial.cnpj}
                      onChange={(e) => atualizarFilial('cnpj', formatarCNPJ(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      inputMode="numeric"
                      className="mt-1 rounded-md border border-pdv-panelLight bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pdv-accent"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-semibold text-slate-400">
                    Telefone
                    <input
                      value={config.filial.telefone}
                      onChange={(e) => atualizarFilial('telefone', formatarTelefone(e.target.value))}
                      placeholder="0000-0000"
                      inputMode="numeric"
                      className="mt-1 rounded-md border border-pdv-panelLight bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pdv-accent"
                    />
                  </label>
                </div>
              </section>

              <div className="mb-6 flex items-center gap-3">
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="rounded-md bg-pdv-accent px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Configurações'}
                </button>
                {mensagemSalvo && (
                  <span className="text-xs font-semibold text-pdv-accent2">{mensagemSalvo}</span>
                )}
                {erroSalvar && <span className="text-xs font-semibold text-red-400">{erroSalvar}</span>}
              </div>

              {/* Importar planilhas */}
              <section className="rounded-lg bg-slate-900 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Importar Planilhas
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={importarProdutos}
                    disabled={importando !== null}
                    className="flex-1 rounded-md bg-pdv-panelLight px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >
                    {importando === 'produtos' ? 'Importando...' : 'Importar Produtos (.xlsx)'}
                  </button>
                  <button
                    onClick={importarUsuarios}
                    disabled={importando !== null}
                    className="flex-1 rounded-md bg-pdv-panelLight px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >
                    {importando === 'usuarios' ? 'Importando...' : 'Importar Vendedores (.xlsx)'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Resultado da importação */}
      {resultadoImportacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg bg-pdv-panel p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-100">
              Importação de {resultadoImportacao.tipo} concluída
            </h3>
            <p className="mb-4 break-all text-xs text-slate-400">
              {resultadoImportacao.dados.arquivo}
            </p>

            <div className="mb-4 grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-slate-100">
                  {resultadoImportacao.dados.totalLinhas}
                </span>
                <span className="text-xs text-slate-400">Linhas</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-accent2">
                  {resultadoImportacao.dados.inseridos}
                </span>
                <span className="text-xs text-slate-400">Inseridos</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-accent">
                  {resultadoImportacao.dados.atualizados}
                </span>
                <span className="text-xs text-slate-400">Atualizados</span>
              </div>
              <div className="rounded bg-slate-800 p-2">
                <span className="block text-lg font-bold text-pdv-warn">
                  {resultadoImportacao.dados.ignorados}
                </span>
                <span className="text-xs text-slate-400">Ignorados</span>
              </div>
            </div>

            {resultadoImportacao.dados.erros.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded bg-slate-950 p-3">
                <p className="mb-1 text-xs font-semibold text-red-400">Avisos:</p>
                {resultadoImportacao.dados.erros.map((erro, i) => (
                  <p key={i} className="text-xs text-slate-400">
                    {erro}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={() => setResultadoImportacao(null)}
              className="w-full rounded-md bg-pdv-accent py-2 text-sm font-semibold hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;
