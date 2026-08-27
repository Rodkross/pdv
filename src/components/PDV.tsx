import React, { useState, useEffect, useRef } from 'react';
import { useSales } from '../context/SalesContext';
import ReceiptPreview from './ReceiptPreview';
import { PagamentoOrcamento, FormaPagamento } from '../types';

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PDV: React.FC = () => {
  const {
    termoBusca,
    setTermoBusca,
    produtoSelecionado,
    precoAplicado,
    promocional,
    erroBusca,
    sugestoesProdutos,
    carregandoProdutos,
    selecionarProdutoDireto,
    limparSugestoesProdutos,
    buscarProduto,
    cancelarSelecaoProduto,
    quantidade,
    setQuantidade,
    subtotalAtual,
    incluirItem,
    itens,
    removerItem,
    totalGeral,
    codigoUsuario,
    setCodigoUsuario,
    usuarioSelecionado,
    erroUsuario,
    sugestoesUsuarios,
    carregandoUsuarios,
    selecionarUsuarioDireto,
    limparSugestoesUsuarios,
    buscarUsuario,
    modalidade,
    setModalidade,
    clienteEntregaNome,
    setClienteEntregaNome,
    clienteEntregaTelefone,
    setClienteEntregaTelefone,
    clienteEntregaDocumento,
    setClienteEntregaDocumento,
    clienteEntregaEndereco,
    setClienteEntregaEndereco,
    impressoraSelecionada,
    setImpressoraSelecionada,
    impressorasDisponiveis,
    cestasHoje,
    modalFechamentoAberto,
    abrirModalFechamento,
    fecharModalFechamento,
    fechandoVenda,
    ultimoOrcamento,
    erroFechamento,
    fecharVenda,
    limparUltimoOrcamento,
    refProduto,
    refQuantidade,
    refUsuario,
    terminal,
  } = useSales();

  const [indiceProdutoFocado, setIndiceProdutoFocado] = useState(-1);
  const [indiceUsuarioFocado, setIndiceUsuarioFocado] = useState(-1);

  const refsItensProduto = useRef<Array<HTMLLIElement | null>>([]);
  const refsItensUsuario = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    setIndiceProdutoFocado(-1);
  }, [sugestoesProdutos]);

  useEffect(() => {
    setIndiceUsuarioFocado(-1);
  }, [sugestoesUsuarios]);

  // Acompanha a navegação por teclado (setas ↑/↓): rola a listinha de
  // sugestões pra manter o item destacado sempre visível, do mesmo jeito
  // que aconteceria clicando/arrastando o scroll manualmente.
  useEffect(() => {
    if (indiceProdutoFocado < 0) return;
    refsItensProduto.current[indiceProdutoFocado]?.scrollIntoView({ block: 'nearest' });
  }, [indiceProdutoFocado]);

  useEffect(() => {
    if (indiceUsuarioFocado < 0) return;
    refsItensUsuario.current[indiceUsuarioFocado]?.scrollIntoView({ block: 'nearest' });
  }, [indiceUsuarioFocado]);

  function aoSubmeterBusca(e: React.FormEvent) {
    e.preventDefault();
    if (indiceProdutoFocado >= 0 && indiceProdutoFocado < sugestoesProdutos.length) {
      void selecionarProdutoDireto(sugestoesProdutos[indiceProdutoFocado]);
    } else {
      void buscarProduto(termoBusca);
    }
  }

  function aoSubmeterUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (indiceUsuarioFocado >= 0 && indiceUsuarioFocado < sugestoesUsuarios.length) {
      selecionarUsuarioDireto(sugestoesUsuarios[indiceUsuarioFocado]);
    } else {
      void buscarUsuario(codigoUsuario);
    }
  }

  function aoTeclarInputProduto(e: React.KeyboardEvent<HTMLInputElement>) {
    if (sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceProdutoFocado((prev) => (prev < sugestoesProdutos.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceProdutoFocado((prev) => (prev > 0 ? prev - 1 : sugestoesProdutos.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        limparSugestoesProdutos();
        return;
      }
    }
  }

  function aoTeclarInputUsuario(e: React.KeyboardEvent<HTMLInputElement>) {
    if (sugestoesUsuarios.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceUsuarioFocado((prev) => (prev < sugestoesUsuarios.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceUsuarioFocado((prev) => (prev > 0 ? prev - 1 : sugestoesUsuarios.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        limparSugestoesUsuarios();
        return;
      }
    }
  }

  function aoTeclarQuantidade(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      incluirItem();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelarSelecaoProduto();
    }
  }

  function solicitarFechamento() {
    abrirModalFechamento();
  }

  async function confirmarEFechar(pagamentos: PagamentoOrcamento[], impressora: string) {
    fecharModalFechamento();
    await fecharVenda(pagamentos, impressora);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      {/* Barra de status de atalhos */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-pdv-panel px-4 py-2 text-xs text-slate-300">
        <Atalho tecla="F2" descricao="Buscar Vendedor" />
        <Atalho tecla="F1" descricao="Buscar Produto" />
        <Atalho tecla="F3" descricao="Modalidade CESTA" ativo={modalidade === 'CESTA'} />
        <Atalho tecla="F4" descricao="Modalidade ENTREGA" ativo={modalidade === 'ENTREGA'} />
        <Atalho tecla="ENTER" descricao="Incluir Item" />
        <Atalho tecla="F12" descricao="Fechar Venda" />
        <span className="ml-auto rounded bg-pdv-panelLight px-2 py-1 font-semibold text-slate-200">
          Terminal: {terminal}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden">
        {/* Coluna esquerda: bipagem + quantidade + vendedor + modalidade */}
        <div className="col-span-1 flex flex-col gap-3 overflow-y-auto">
          {/* Busca de Vendedor (Usuário) */}
          <section className="relative rounded-lg bg-pdv-panel p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Vendedor (Usuário) (F2)
            </h2>
            <form onSubmit={aoSubmeterUsuario} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={refUsuario}
                  value={codigoUsuario}
                  onChange={(e) => setCodigoUsuario(e.target.value)}
                  onKeyDown={aoTeclarInputUsuario}
                  placeholder="Nome, ID ou CPF do Vendedor..."
                  className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                  autoFocus
                />
                {carregandoUsuarios && (
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">...</span>
                )}
              </div>
              <button
                type="submit"
                className="rounded-md bg-pdv-accent px-4 py-2 text-sm font-semibold hover:bg-blue-700"
              >
                Vincular
              </button>
            </form>

            {/* Dropdown de sugestões de vendedores */}
            {sugestoesUsuarios.length > 0 && (
              <ul className="absolute left-4 right-4 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-pdv-panelLight bg-slate-900 shadow-2xl">
                {sugestoesUsuarios.map((item, index) => (
                  <li
                    key={item.usuario_id}
                    ref={(el) => (refsItensUsuario.current[index] = el)}
                    onClick={() => selecionarUsuarioDireto(item)}
                    onMouseEnter={() => setIndiceUsuarioFocado(index)}
                    className={`cursor-pointer border-b border-slate-800 p-2 text-xs transition ${
                      index === indiceUsuarioFocado
                        ? 'bg-pdv-accent text-white'
                        : 'hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="font-semibold">
                      Vendedor #{item.usuario_id} — {item.nome}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {erroUsuario && <p className="mt-2 text-sm text-red-400">{erroUsuario}</p>}

            {usuarioSelecionado && (
              <div className="mt-3 flex items-center justify-between rounded-md border border-pdv-panelLight bg-slate-900 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-100">
                    Vendedor: #{usuarioSelecionado.usuario_id} — {usuarioSelecionado.nome}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCodigoUsuario('');
                    limparSugestoesUsuarios();
                  }}
                  className="ml-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white"
                  title="Alterar vendedor"
                >
                  Alterar
                </button>
              </div>
            )}
          </section>

          {/* Bipagem / busca de produto */}
          <section className="relative rounded-lg bg-pdv-panel p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Produto (F1)
            </h2>
            <form onSubmit={aoSubmeterBusca} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={refProduto}
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onKeyDown={aoTeclarInputProduto}
                  placeholder="Código de barras, ID ou iniciais (ex: ARR)..."
                  className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                />
                {carregandoProdutos && (
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">...</span>
                )}
              </div>
              <button
                type="submit"
                className="rounded-md bg-pdv-accent px-4 py-2 text-sm font-semibold hover:bg-blue-700"
              >
                Buscar
              </button>
            </form>

            {/* Dropdown de sugestões de produtos */}
            {sugestoesProdutos.length > 0 && (
              <ul className="absolute left-4 right-4 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-pdv-panelLight bg-slate-900 shadow-2xl">
                {sugestoesProdutos.map((item, index) => (
                  <li
                    key={item.produto.produto_id}
                    ref={(el) => (refsItensProduto.current[index] = el)}
                    onClick={() => void selecionarProdutoDireto(item)}
                    onMouseEnter={() => setIndiceProdutoFocado(index)}
                    className={`cursor-pointer border-b border-slate-800 p-2 text-xs transition ${
                      index === indiceProdutoFocado
                        ? 'bg-pdv-accent text-white'
                        : 'hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{item.produto.descricao}</span>
                      <span className="font-bold text-pdv-accent2">
                        {formatarMoeda(item.preco.precoAplicado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] opacity-75">
                      <span>
                        Cód: {item.produto.produto_id} {item.produto.barras ? `· EAN: ${item.produto.barras}` : ''}
                      </span>
                      {item.preco.promocional && (
                        <span className="font-bold text-amber-400">* PROMOÇÃO</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {erroBusca && <p className="mt-2 text-sm text-red-400">{erroBusca}</p>}

            {produtoSelecionado && (
              <div className="mt-4 rounded-md border border-pdv-panelLight bg-slate-900 p-3">
                <p className="text-sm font-semibold text-slate-100">
                  {produtoSelecionado.descricao}
                </p>
                <p className="text-xs text-slate-400">
                  Cód. barras: {produtoSelecionado.barras ?? '—'} · Cód: {produtoSelecionado.produto_id}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-pdv-accent2">
                    {formatarMoeda(precoAplicado)}
                  </span>
                  {promocional && (
                    <span className="rounded bg-pdv-warn px-2 py-0.5 text-xs font-bold text-slate-900">
                      * PROMOÇÃO VIGENTE
                    </span>
                  )}
                  {!promocional && (
                    <span className="text-xs text-slate-500">preço cheio</span>
                  )}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-slate-400">Quantidade</label>
                    <input
                      ref={refQuantidade}
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      onKeyDown={aoTeclarQuantidade}
                      inputMode="decimal"
                      className="w-full rounded-md border border-pdv-panelLight bg-slate-950 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                    />
                  </div>
                  <div className="flex-1 text-right">
                    <span className="block text-xs text-slate-400">Subtotal</span>
                    <span className="text-lg font-bold">{formatarMoeda(subtotalAtual)}</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={incluirItem}
                    className="flex-1 rounded-md bg-pdv-accent2 py-2 text-sm font-semibold hover:bg-green-700"
                  >
                    Incluir Item (ENTER)
                  </button>
                  <button
                    onClick={cancelarSelecaoProduto}
                    className="rounded-md bg-pdv-panelLight px-3 py-2 text-sm hover:bg-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Modalidade */}
          <section className="rounded-lg bg-pdv-panel p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Modalidade da Operação
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setModalidade('CESTA')}
                className={`relative flex-1 rounded-md py-3 text-sm font-semibold transition ${
                  modalidade === 'CESTA'
                    ? 'bg-pdv-accent text-white'
                    : 'bg-pdv-panelLight text-slate-300 hover:bg-slate-600'
                }`}
              >
                CESTA (F3)
                <span className="block text-xs font-normal opacity-80">2 vias</span>
                <span
                  className="absolute -top-2 -right-2 rounded-full bg-pdv-accent2 px-2 py-0.5 text-[10px] font-bold text-white shadow"
                  title="Número da próxima cesta hoje (reinicia à meia-noite)"
                >
                  Próx. Nº {cestasHoje + 1}
                </span>
              </button>
              <button
                onClick={() => setModalidade('ENTREGA')}
                className={`flex-1 rounded-md py-3 text-sm font-semibold transition ${
                  modalidade === 'ENTREGA'
                    ? 'bg-pdv-accent text-white'
                    : 'bg-pdv-panelLight text-slate-300 hover:bg-slate-600'
                }`}
              >
                ENTREGA (F4)
                <span className="block text-xs font-normal opacity-80">3 vias + caneta</span>
              </button>
            </div>
          </section>

          {modalidade === 'ENTREGA' && (
            <section className="rounded-lg bg-pdv-panel p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Dados do Cliente (Entrega)
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Nome</label>
                  <input
                    value={clienteEntregaNome}
                    onChange={(e) => setClienteEntregaNome(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Telefone</label>
                  <input
                    value={clienteEntregaTelefone}
                    onChange={(e) => setClienteEntregaTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">CPF</label>
                  <input
                    value={clienteEntregaDocumento}
                    onChange={(e) => setClienteEntregaDocumento(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Endereço de entrega</label>
                  <input
                    value={clienteEntregaEndereco}
                    onChange={(e) => setClienteEntregaEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, referência..."
                    className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm outline-none focus:border-pdv-accent"
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Coluna direita: carrinho / lista do orçamento ativo */}
        <div className="col-span-2 flex flex-col overflow-hidden rounded-lg bg-pdv-panel">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-pdv-panelLight text-xs uppercase text-slate-300">
                <tr>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Cód. Barras</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Preço Un.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Nenhum item incluído. Use F1 para buscar um produto por código, ID ou iniciais.
                    </td>
                  </tr>
                )}
                {itens.map((item) => (
                  <tr key={item.uid} className="border-b border-pdv-panelLight/50">
                    <td className="px-3 py-2">
                      {item.descricao}
                      {item.promocional && (
                        <span className="ml-1 text-xs font-bold text-pdv-warn">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{item.barras ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right">{formatarMoeda(item.preco_unitario)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatarMoeda(item.subtotal)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removerItem(item.uid)}
                        className="rounded bg-pdv-danger/80 px-2 py-1 text-xs hover:bg-pdv-danger"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rodapé: total geral e fechamento */}
          <div className="flex items-center justify-between border-t border-pdv-panelLight bg-pdv-panel p-4">
            <div>
              <span className="block text-xs uppercase text-slate-400">Total Geral</span>
              <span className="text-3xl font-bold text-pdv-accent2">
                {formatarMoeda(totalGeral)}
              </span>
            </div>
            <div className="text-right">
              {erroFechamento && <p className="mb-2 text-sm text-red-400">{erroFechamento}</p>}
              <button
                onClick={solicitarFechamento}
                disabled={fechandoVenda || itens.length === 0}
                className="rounded-md bg-pdv-accent2 px-6 py-3 text-base font-bold shadow-lg hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {fechandoVenda ? 'Processando...' : 'Fechar Venda (F12)'}
              </button>
              <p className="mt-1 text-xs text-slate-400">
                Modalidade: <strong>{modalidade}</strong> ·{' '}
                {modalidade === 'CESTA' ? '2 vias' : '3 vias'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {modalFechamentoAberto && (
        <ModalConfirmacao
          totalGeral={totalGeral}
          modalidade={modalidade}
          quantidadeItens={itens.length}
          impressoraInicial={impressoraSelecionada}
          impressorasDisponiveis={impressorasDisponiveis}
          onConfirmar={confirmarEFechar}
          onCancelar={fecharModalFechamento}
        />
      )}

      {ultimoOrcamento && (
        <ReceiptPreview orcamento={ultimoOrcamento} terminal={terminal} onFechar={limparUltimoOrcamento} />
      )}
    </div>
  );
};

const Atalho: React.FC<{ tecla: string; descricao: string; ativo?: boolean }> = ({
  tecla,
  descricao,
  ativo,
}) => (
  <span
    className={`flex items-center gap-1 rounded px-2 py-1 ${
      ativo ? 'bg-pdv-accent text-white' : 'bg-pdv-panelLight text-slate-300'
    }`}
  >
    <kbd className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[11px]">{tecla}</kbd>
    {descricao}
  </span>
);

/** Rótulos e ordem de exibição das formas de pagamento na grade. */
const FORMAS_PAGAMENTO: Array<{ forma: FormaPagamento; label: string }> = [
  { forma: 'DINHEIRO', label: 'Dinheiro' },
  { forma: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { forma: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { forma: 'PIX', label: 'PIX' },
  { forma: 'OUTROS', label: 'Outros' },
];

function paraNumero(texto: string): number {
  const n = parseFloat(texto.replace(',', '.'));
  return isNaN(n) || n < 0 ? 0 : n;
}

const ModalConfirmacao: React.FC<{
  totalGeral: number;
  modalidade: string;
  quantidadeItens: number;
  impressoraInicial: string;
  impressorasDisponiveis: Array<{ name: string; isDefault?: boolean }>;
  onConfirmar: (pagamentos: PagamentoOrcamento[], impressora: string) => void;
  onCancelar: () => void;
}> = ({
  totalGeral,
  modalidade,
  quantidadeItens,
  impressoraInicial,
  impressorasDisponiveis,
  onConfirmar,
  onCancelar,
}) => {
  // Valores digitados por forma de pagamento, todos começando zerados.
  const [valores, setValores] = useState<Record<FormaPagamento, string>>({
    DINHEIRO: '',
    CARTAO_DEBITO: '',
    CARTAO_CREDITO: '',
    PIX: '',
    OUTROS: '',
  });
  const [impressora, setImpressora] = useState(impressoraInicial || '');

  function atualizarValor(forma: FormaPagamento, texto: string) {
    setValores((prev) => ({ ...prev, [forma]: texto }));
  }

  // --- Cálculo da "baixa" em tempo real, a cada valor digitado ---
  const valorDinheiro = paraNumero(valores.DINHEIRO);
  const formasNaoDinheiro: FormaPagamento[] = ['CARTAO_DEBITO', 'CARTAO_CREDITO', 'PIX', 'OUTROS'];
  const somaNaoDinheiro = formasNaoDinheiro.reduce((soma, f) => soma + paraNumero(valores[f]), 0);

  // Cartão/PIX/Outros nunca podem, juntos, passar do valor da venda —
  // se algum ultrapassar, a diferença precisa vir de outra forma.
  const excedeuNaoDinheiro = somaNaoDinheiro > totalGeral + 0.005;

  // Quanto ainda falta antes de considerar o dinheiro digitado.
  const saldoAntesDinheiro = Math.max(0, Number((totalGeral - somaNaoDinheiro).toFixed(2)));
  // Dinheiro pode ultrapassar o saldo — o excedente vira troco.
  const dinheiroAplicado = Math.min(valorDinheiro, saldoAntesDinheiro);
  const troco = Math.max(0, Number((valorDinheiro - saldoAntesDinheiro).toFixed(2)));

  const totalCoberto = Number((somaNaoDinheiro + dinheiroAplicado).toFixed(2));
  const saldoRestante = Math.max(0, Number((totalGeral - totalCoberto).toFixed(2)));

  const podeFinalizar = saldoRestante <= 0.005 && !excedeuNaoDinheiro;

  function completarComDinheiro() {
    atualizarValor('DINHEIRO', String(saldoAntesDinheiro).replace('.', ','));
  }

  function submeterConfirmacao(e: React.FormEvent) {
    e.preventDefault();
    if (!podeFinalizar) return;

    const pagamentos: PagamentoOrcamento[] = FORMAS_PAGAMENTO.map(({ forma }) => ({
      forma_pagamento: forma,
      valor: paraNumero(valores[forma]),
    })).filter((p) => p.valor > 0);

    onConfirmar(pagamentos, impressora);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-pdv-panelLight bg-pdv-panel p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold text-white">Confirmar Fechamento de Venda</h3>
        <p className="mb-4 text-xs text-slate-300">
          {quantidadeItens} item(ns) · Modalidade <strong>{modalidade}</strong> · Impressão de{' '}
          <strong>{modalidade === 'CESTA' ? '2 vias' : '3 vias'}</strong>
        </p>

        <form onSubmit={submeterConfirmacao} className="space-y-4">
          {/* Valor da venda */}
          <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/90 px-4 py-3">
            <span className="text-sm font-semibold text-slate-300">Valor da Venda</span>
            <span className="text-2xl font-extrabold text-white">{formatarMoeda(totalGeral)}</span>
          </div>

          {/* Grade de formas de pagamento (linhas compactas, como uma tabela) */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-300">
              Formas de Pagamento
            </label>
            <div className="overflow-hidden rounded-md border border-pdv-panelLight">
              {FORMAS_PAGAMENTO.map(({ forma, label }, index) => {
                const valorCampo = paraNumero(valores[forma]);
                const ehDinheiro = forma === 'DINHEIRO';
                // Máximo permitido pra este campo específico, considerando
                // só as OUTRAS formas não-dinheiro já preenchidas.
                const maxPermitido = ehDinheiro
                  ? null
                  : Math.max(0, Number((totalGeral - (somaNaoDinheiro - valorCampo)).toFixed(2)));
                const excedeuEsteCampo =
                  !ehDinheiro && maxPermitido !== null && valorCampo > maxPermitido + 0.005;

                return (
                  <div
                    key={forma}
                    className={`flex items-center justify-between gap-2 px-3 py-2 ${
                      index % 2 === 0 ? 'bg-slate-800/60' : 'bg-slate-900'
                    } ${excedeuEsteCampo ? 'ring-1 ring-inset ring-red-500' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-semibold uppercase text-slate-200">
                        {label}
                      </span>
                      {ehDinheiro && saldoAntesDinheiro > 0 && (
                        <button
                          type="button"
                          onClick={completarComDinheiro}
                          className="shrink-0 text-[10px] font-semibold text-pdv-accent2 underline underline-offset-2 hover:text-green-400"
                          title="Preencher com o valor que falta"
                        >
                          completar
                        </button>
                      )}
                      {excedeuEsteCampo && maxPermitido !== null && (
                        <span className="shrink-0 text-[10px] font-semibold text-red-400">
                          máx {formatarMoeda(maxPermitido)}
                        </span>
                      )}
                      {ehDinheiro && troco > 0 && (
                        <span className="shrink-0 text-[10px] font-bold text-pdv-accent2">
                          troco {formatarMoeda(troco)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex shrink-0 items-center gap-1 rounded-md border bg-slate-950 px-2 ${
                        excedeuEsteCampo
                          ? 'border-red-500'
                          : 'border-pdv-panelLight focus-within:border-pdv-accent'
                      }`}
                    >
                      <span className="text-xs text-slate-500">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valores[forma]}
                        onChange={(e) => atualizarValor(forma, e.target.value)}
                        placeholder="0,00"
                        autoFocus={ehDinheiro}
                        className="w-24 bg-transparent py-1.5 text-right text-sm font-bold text-white outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status da baixa em tempo real */}
          <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/90 px-4 py-3">
            <span className="text-xs font-semibold uppercase text-slate-300">
              {saldoRestante > 0.005 ? 'Falta Receber' : troco > 0.005 ? 'Troco a Devolver' : 'Situação'}
            </span>
            <span
              className={`text-xl font-extrabold ${
                saldoRestante > 0.005
                  ? 'text-red-400'
                  : troco > 0.005
                    ? 'text-pdv-accent2'
                    : 'text-pdv-accent2'
              }`}
            >
              {saldoRestante > 0.005
                ? formatarMoeda(saldoRestante)
                : troco > 0.005
                  ? formatarMoeda(troco)
                  : 'Pagamento completo'}
            </span>
          </div>

          {excedeuNaoDinheiro && (
            <p className="text-[11px] font-semibold text-red-400">
              O valor em cartão/PIX/outros não pode ultrapassar o total da venda. Ajuste os
              campos destacados em vermelho.
            </p>
          )}

          {/* Seleção de Impressora */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">
              Selecione a Impressora
            </label>
            <select
              value={impressora}
              onChange={(e) => setImpressora(e.target.value)}
              className="w-full rounded-md border border-pdv-panelLight bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-pdv-accent"
            >
              <option value="">Impressora Padrão do Sistema</option>
              {impressorasDisponiveis.map((imp) => (
                <option key={imp.name} value={imp.name}>
                  {imp.name} {imp.isDefault ? '(Padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-md bg-pdv-panelLight px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!podeFinalizar}
              className="rounded-md bg-pdv-accent2 px-5 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirmar e Imprimir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PDV;
