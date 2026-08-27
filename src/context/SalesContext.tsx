import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  InfoImpressora,
  ItemCarrinho,
  OrcamentoCompleto,
  Produto,
  ResultadoBuscaProduto,
  PrecoResolvido,
  TipoOperacao,
  Usuario,
  ConfigFilial,
  PagamentoOrcamento,
} from '../types';

interface SalesContextValue {
  // Produto / bipagem / busca por iniciais
  termoBusca: string;
  setTermoBusca: (v: string) => void;
  produtoSelecionado: Produto | null;
  precoAplicado: number;
  promocional: boolean;
  erroBusca: string | null;
  sugestoesProdutos: ResultadoBuscaProduto[];
  carregandoProdutos: boolean;
  selecionarProdutoDireto: (p: ResultadoBuscaProduto | Produto) => Promise<void>;
  limparSugestoesProdutos: () => void;
  buscarProduto: (termo: string) => Promise<void>;
  cancelarSelecaoProduto: () => void;

  // Quantidade
  quantidade: string;
  setQuantidade: (v: string) => void;
  subtotalAtual: number;
  incluirItem: () => void;

  // Carrinho
  itens: ItemCarrinho[];
  removerItem: (uid: string) => void;
  totalGeral: number;

  // Usuário / cliente (Nome, ID, CPF, Telefone)
  codigoUsuario: string;
  setCodigoUsuario: (v: string) => void;
  usuarioSelecionado: Usuario | null;
  erroUsuario: string | null;
  sugestoesUsuarios: Usuario[];
  carregandoUsuarios: boolean;
  selecionarUsuarioDireto: (u: Usuario) => void;
  limparSugestoesUsuarios: () => void;
  buscarUsuario: (codigo: string) => Promise<void>;

  // Modalidade e Pagamento
  modalidade: TipoOperacao;
  setModalidade: (t: TipoOperacao) => void;

  // Dados do cliente da entrega (nome, telefone, CPF, endereço)
  clienteEntregaNome: string;
  setClienteEntregaNome: (v: string) => void;
  clienteEntregaTelefone: string;
  setClienteEntregaTelefone: (v: string) => void;
  clienteEntregaDocumento: string;
  setClienteEntregaDocumento: (v: string) => void;
  clienteEntregaEndereco: string;
  setClienteEntregaEndereco: (v: string) => void;

  // Impressoras
  impressoraSelecionada: string;
  setImpressoraSelecionada: (v: string) => void;
  impressorasDisponiveis: InfoImpressora[];
  recarregarImpressoras: () => Promise<void>;

  // Contador de cestas do dia (reinicia sozinho à meia-noite)
  cestasHoje: number;

  // Dados da filial (nome/endereço/CNPJ/telefone) exibidos no cupom
  configFilial: ConfigFilial;
  recarregarConfigFilial: () => Promise<void>;

  // Modal de confirmação de fechamento (aberto por F12 ou pelo botão "Fechar Venda")
  modalFechamentoAberto: boolean;
  abrirModalFechamento: () => void;
  fecharModalFechamento: () => void;

  // Fechamento da venda
  fechandoVenda: boolean;
  ultimoOrcamento: OrcamentoCompleto | null;
  erroFechamento: string | null;
  fecharVenda: (
    pagamentos: PagamentoOrcamento[],
    nomeImpressora?: string
  ) => Promise<void>;
  limparUltimoOrcamento: () => void;

  // Refs para foco via atalhos de teclado
  refProduto: React.RefObject<HTMLInputElement>;
  refQuantidade: React.RefObject<HTMLInputElement>;
  refUsuario: React.RefObject<HTMLInputElement>;

  // Terminal
  terminal: string;
}

const SalesContext = createContext<SalesContextValue | undefined>(undefined);

let contadorUid = 0;
function proximoUid(): string {
  contadorUid += 1;
  return `item-${Date.now()}-${contadorUid}`;
}

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [precoAplicado, setPrecoAplicado] = useState(0);
  const [promocional, setPromocional] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const [sugestoesProdutos, setSugestoesProdutos] = useState<ResultadoBuscaProduto[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);

  const [quantidade, setQuantidade] = useState('1');

  const [itens, setItens] = useState<ItemCarrinho[]>([]);

  const [codigoUsuario, setCodigoUsuario] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [erroUsuario, setErroUsuario] = useState<string | null>(null);

  const [sugestoesUsuarios, setSugestoesUsuarios] = useState<Usuario[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);

  const [modalidade, setModalidade] = useState<TipoOperacao>('CESTA');

  const [clienteEntregaNome, setClienteEntregaNome] = useState('');
  const [clienteEntregaTelefone, setClienteEntregaTelefone] = useState('');
  const [clienteEntregaDocumento, setClienteEntregaDocumento] = useState('');
  const [clienteEntregaEndereco, setClienteEntregaEndereco] = useState('');

  const [impressoraSelecionada, setImpressoraSelecionada] = useState('');
  const [impressorasDisponiveis, setImpressorasDisponiveis] = useState<InfoImpressora[]>([]);
  const [cestasHoje, setCestasHoje] = useState(0);
  const [configFilial, setConfigFilial] = useState<ConfigFilial>({
    nome: '',
    endereco: '',
    cnpj: '',
    telefone: '',
  });

  const [modalFechamentoAberto, setModalFechamentoAberto] = useState(false);

  const [fechandoVenda, setFechandoVenda] = useState(false);
  const [ultimoOrcamento, setUltimoOrcamento] = useState<OrcamentoCompleto | null>(null);
  const [erroFechamento, setErroFechamento] = useState<string | null>(null);

  const [terminal, setTerminal] = useState('LOCAL');

  const refProduto = useRef<HTMLInputElement>(null);
  const refQuantidade = useRef<HTMLInputElement>(null);
  const refUsuario = useRef<HTMLInputElement>(null);

  const carregarImpressoras = useCallback(async (autoSelecionar: boolean) => {
    const lista = await window.api.sistema.listarImpressoras();
    setImpressorasDisponiveis(lista);
    if (autoSelecionar) {
      const thermal = lista.find((i) =>
        /elgin|pos|bematech|daruma|epson|tmt|tm-|cupom|termica|80mm|58mm/i.test(i.name)
      );
      const padrao = lista.find((i) => i.isDefault);
      if (thermal) {
        setImpressoraSelecionada(thermal.name);
      } else if (padrao) {
        setImpressoraSelecionada(padrao.name);
      } else if (lista.length > 0) {
        setImpressoraSelecionada(lista[0].name);
      }
    }
  }, []);

  useEffect(() => {
    window.api.sistema.infoTerminal().then((info) => setTerminal(info.terminal));
    carregarImpressoras(true);

    // Reconsulta o status periodicamente (papel/energia/conexão podem mudar
    // a qualquer momento) para manter o indicador do topo atualizado sem
    // exigir que o usuário reinicie o app.
    const intervalo = setInterval(() => carregarImpressoras(false), 15000);
    return () => clearInterval(intervalo);
  }, [carregarImpressoras]);

  const carregarCestasHoje = useCallback(async () => {
    try {
      const total = await window.api.sistema.contadorCestasHoje();
      setCestasHoje(total);
    } catch {
      // silencioso: não é crítico o suficiente pra atrapalhar a operação
    }
  }, []);

  useEffect(() => {
    carregarCestasHoje();
    // Também reconsulta periodicamente: útil em ambiente LAN, onde outros
    // terminais podem registrar cestas que mudam a contagem em tempo real,
    // e garante que o contador vire pra 0 sozinho logo após a virada do dia.
    const intervalo = setInterval(carregarCestasHoje, 30000);
    return () => clearInterval(intervalo);
  }, [carregarCestasHoje]);

  const recarregarConfigFilial = useCallback(async () => {
    try {
      const config = await window.api.configuracoes.obter();
      setConfigFilial(config.filial);
    } catch {
      // mantém o valor anterior em caso de falha pontual
    }
  }, []);

  useEffect(() => {
    recarregarConfigFilial();
  }, [recarregarConfigFilial]);


  // ---------------------------------------------------------------------
  // Busca por digitação ao vivo (iniciais de produtos com >= 3 letras)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const termoLimpo = termoBusca.trim();
    if (termoLimpo.length >= 3) {
      const timer = setTimeout(async () => {
        setCarregandoProdutos(true);
        try {
          const prods = await window.api.produtos.pesquisar(termoLimpo);
          setSugestoesProdutos(prods);
        } finally {
          setCarregandoProdutos(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setSugestoesProdutos([]);
    }
  }, [termoBusca]);

  // ---------------------------------------------------------------------
  // Busca por digitação ao vivo (Usuários com >= 2 caracteres)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const termoLimpo = codigoUsuario.trim();
    if (termoLimpo.length >= 2 && !usuarioSelecionado) {
      const timer = setTimeout(async () => {
        setCarregandoUsuarios(true);
        try {
          const usrs = await window.api.usuarios.pesquisar(termoLimpo);
          setSugestoesUsuarios(usrs);
        } finally {
          setCarregandoUsuarios(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setSugestoesUsuarios([]);
    }
  }, [codigoUsuario, usuarioSelecionado]);

  // ---------------------------------------------------------------------
  // A. Seleção e Busca de produto (com resolução correta de promoção)
  // ---------------------------------------------------------------------
  const selecionarProdutoDireto = useCallback(async (item: ResultadoBuscaProduto | Produto) => {
    let prod: Produto;
    let preco: PrecoResolvido;

    if ('preco' in item && item.preco) {
      prod = item.produto;
      preco = item.preco;
    } else {
      const p = item as Produto;
      const res = await window.api.produtos.buscarPorCodigoOuBarras(
        p.barras ?? String(p.produto_id)
      );
      if (res) {
        prod = res.produto;
        preco = res.preco;
      } else {
        prod = p;
        const pFloat = (v: unknown) => {
          if (typeof v === 'number') return isNaN(v) ? 0 : v;
          if (!v) return 0;
          const s = String(v).trim().replace(/\./g, '').replace(',', '.');
          const n = parseFloat(s);
          return isNaN(n) ? 0 : n;
        };
        const precoPromo = pFloat(p.preco_promocao);
        const precoVnd = pFloat(p.preco_vnd);
        let fimPromoIso: string | null = null;
        if (p.data_fim_promocao) {
          const s = String(p.data_fim_promocao).trim();
          const mBr = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
          if (mBr) {
            const ano = mBr[3].length === 2 ? '20' + mBr[3] : mBr[3];
            fimPromoIso = `${ano}-${mBr[2].padStart(2, '0')}-${mBr[1].padStart(2, '0')}`;
          } else {
            const mIso = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
            if (mIso) {
              fimPromoIso = `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
            }
          }
        }
        const d = new Date();
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        const hoje = `${ano}-${mes}-${dia}`;
        const promoValida = precoPromo > 0 && (!fimPromoIso || hoje <= fimPromoIso);
        preco = {
          precoAplicado: promoValida ? precoPromo : precoVnd,
          promocional: promoValida,
        };
      }

    }

    setProdutoSelecionado(prod);
    setPrecoAplicado(preco.precoAplicado);
    setPromocional(preco.promocional);
    setQuantidade('1');
    setTermoBusca('');
    setSugestoesProdutos([]);
    setErroBusca(null);
    requestAnimationFrame(() => {
      refQuantidade.current?.focus();
      refQuantidade.current?.select();
    });
  }, []);

  const buscarProduto = useCallback(
    async (termo: string) => {
      const termoLimpo = termo.trim();
      setErroBusca(null);
      if (!termoLimpo) return;

      const resultado = await window.api.produtos.buscarPorCodigoOuBarras(termoLimpo);
      if (resultado) {
        setProdutoSelecionado(resultado.produto);
        setPrecoAplicado(resultado.preco.precoAplicado);
        setPromocional(resultado.preco.promocional);
        setQuantidade('1');
        setTermoBusca('');
        setSugestoesProdutos([]);
        requestAnimationFrame(() => {
          refQuantidade.current?.focus();
          refQuantidade.current?.select();
        });
        return;
      }

      const lista = await window.api.produtos.pesquisar(termoLimpo);
      if (lista.length === 1) {
        await selecionarProdutoDireto(lista[0]);
      } else if (lista.length > 1) {
        setSugestoesProdutos(lista);
      } else {
        setErroBusca(`Produto não encontrado para "${termoLimpo}"`);
        setProdutoSelecionado(null);
      }
    },
    [selecionarProdutoDireto]
  );

  const limparSugestoesProdutos = useCallback(() => {
    setSugestoesProdutos([]);
  }, []);

  const cancelarSelecaoProduto = useCallback(() => {
    setProdutoSelecionado(null);
    setPrecoAplicado(0);
    setPromocional(false);
    setErroBusca(null);
    setSugestoesProdutos([]);
    requestAnimationFrame(() => refProduto.current?.focus());
  }, []);

  // ---------------------------------------------------------------------
  // B. Fluxo de multiplicação: Subtotal = Quantidade * precoAplicado
  // ---------------------------------------------------------------------
  const quantidadeNumerica = useMemo(() => {
    const n = parseFloat(quantidade.replace(',', '.'));
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [quantidade]);

  const subtotalAtual = useMemo(
    () => Number((quantidadeNumerica * precoAplicado).toFixed(2)),
    [quantidadeNumerica, precoAplicado]
  );

  const incluirItem = useCallback(() => {
    if (!produtoSelecionado || quantidadeNumerica <= 0) return;

    const novoItem: ItemCarrinho = {
      uid: proximoUid(),
      produto_id: produtoSelecionado.produto_id,
      descricao: produtoSelecionado.descricao,
      barras: produtoSelecionado.barras,
      quantidade: quantidadeNumerica,
      preco_unitario: precoAplicado,
      promocional,
      subtotal: subtotalAtual,
    };

    setItens((prev) => [...prev, novoItem]);

    setProdutoSelecionado(null);
    setPrecoAplicado(0);
    setPromocional(false);
    setQuantidade('1');
    setTermoBusca('');
    setSugestoesProdutos([]);
    requestAnimationFrame(() => refProduto.current?.focus());
  }, [produtoSelecionado, quantidadeNumerica, precoAplicado, promocional, subtotalAtual]);

  const removerItem = useCallback((uid: string) => {
    setItens((prev) => prev.filter((i) => i.uid !== uid));
  }, []);

  const totalGeral = useMemo(
    () => Number(itens.reduce((soma, item) => soma + item.subtotal, 0).toFixed(2)),
    [itens]
  );

  // ---------------------------------------------------------------------
  // C. Vínculo de usuário (F2) por Nome, ID, CPF ou Telefone
  // ---------------------------------------------------------------------
  const selecionarUsuarioDireto = useCallback((usuario: Usuario) => {
    setUsuarioSelecionado(usuario);
    setCodigoUsuario(usuario.nome);
    setSugestoesUsuarios([]);
    setErroUsuario(null);
    requestAnimationFrame(() => refProduto.current?.focus());
  }, []);

  const buscarUsuario = useCallback(
    async (termo: string) => {
      const termoLimpo = termo.trim();
      setErroUsuario(null);
      if (!termoLimpo) return;

      const encontrado = await window.api.usuarios.buscarPorTermo(termoLimpo);
      if (encontrado) {
        selecionarUsuarioDireto(encontrado);
        return;
      }

      const lista = await window.api.usuarios.pesquisar(termoLimpo);
      if (lista.length === 1) {
        selecionarUsuarioDireto(lista[0]);
      } else if (lista.length > 1) {
        setSugestoesUsuarios(lista);
      } else {
        setErroUsuario(`Vendedor não encontrado para "${termoLimpo}"`);
        setUsuarioSelecionado(null);
      }
    },
    [selecionarUsuarioDireto]
  );

  const limparSugestoesUsuarios = useCallback(() => {
    setSugestoesUsuarios([]);
  }, []);

  // ---------------------------------------------------------------------
  // D + F12: Fechamento da venda -> grava no banco e dispara impressão das vias
  // ---------------------------------------------------------------------
  const fecharVenda = useCallback(
    async (pagamentos: PagamentoOrcamento[], nomeImpressoraCustom?: string) => {
      setErroFechamento(null);

      if (itens.length === 0) {
        setErroFechamento('Inclua ao menos um item antes de fechar a venda.');
        return;
      }

      setFechandoVenda(true);
      try {
        const orcamentoCriado = await window.api.orcamentos.criar({
          usuario_id: usuarioSelecionado?.usuario_id ?? null,
          tipo_operacao: modalidade,
          terminal,
          total: totalGeral,
          pagamentos,
          cliente_nome: modalidade === 'ENTREGA' ? clienteEntregaNome.trim() || null : null,
          cliente_telefone: modalidade === 'ENTREGA' ? clienteEntregaTelefone.trim() || null : null,
          cliente_documento: modalidade === 'ENTREGA' ? clienteEntregaDocumento.trim() || null : null,
          cliente_endereco: modalidade === 'ENTREGA' ? clienteEntregaEndereco.trim() || null : null,
          itens: itens.map((i) => ({
            produto_id: i.produto_id,
            descricao: i.descricao,
            barras: i.barras,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
            promocional: i.promocional,
            subtotal: i.subtotal,
          })),
        });

        await window.api.orcamentos.imprimirVias(
          orcamentoCriado.orcamento_id,
          nomeImpressoraCustom || impressoraSelecionada || undefined
        );

        setUltimoOrcamento(orcamentoCriado);
        if (modalidade === 'CESTA') {
          carregarCestasHoje();
        }

        // Limpa o estado para a próxima venda
        setItens([]);
        setUsuarioSelecionado(null);
        setCodigoUsuario('');
        setModalidade('CESTA');
        setClienteEntregaNome('');
        setClienteEntregaTelefone('');
        setClienteEntregaDocumento('');
        setClienteEntregaEndereco('');
        setModalFechamentoAberto(false);
        requestAnimationFrame(() => refProduto.current?.focus());
      } catch (erro) {
        setErroFechamento((erro as Error).message ?? 'Erro ao fechar a venda.');
      } finally {
        setFechandoVenda(false);
      }
    },
    [
      itens,
      usuarioSelecionado,
      modalidade,
      terminal,
      totalGeral,
      impressoraSelecionada,
      clienteEntregaNome,
      clienteEntregaTelefone,
      clienteEntregaDocumento,
      clienteEntregaEndereco,
      carregarCestasHoje,
    ]
  );

  const limparUltimoOrcamento = useCallback(() => setUltimoOrcamento(null), []);

  const abrirModalFechamento = useCallback(() => {
    if (itens.length === 0) {
      setErroFechamento('Inclua ao menos um item antes de fechar a venda.');
      return;
    }
    setErroFechamento(null);
    setModalFechamentoAberto(true);
  }, [itens]);

  const fecharModalFechamento = useCallback(() => setModalFechamentoAberto(false), []);

  const alterarModalidade = useCallback((t: TipoOperacao) => {
    setModalidade(t);
    if (t !== 'ENTREGA') {
      setClienteEntregaNome('');
      setClienteEntregaTelefone('');
      setClienteEntregaDocumento('');
      setClienteEntregaEndereco('');
    }
  }, []);

  // ---------------------------------------------------------------------
  // ATALHOS DE TECLADO GLOBAIS
  // ---------------------------------------------------------------------
  useEffect(() => {
    function aoPressionarTecla(evento: KeyboardEvent) {
      switch (evento.key) {
        case 'F1':
          evento.preventDefault();
          refProduto.current?.focus();
          refProduto.current?.select();
          break;
        case 'F2':
          evento.preventDefault();
          refUsuario.current?.focus();
          refUsuario.current?.select();
          break;
        case 'F3':
          evento.preventDefault();
          alterarModalidade('CESTA');
          break;
        case 'F4':
          evento.preventDefault();
          alterarModalidade('ENTREGA');
          break;
        case 'F12':
          evento.preventDefault();
          abrirModalFechamento();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', aoPressionarTecla);
    return () => window.removeEventListener('keydown', aoPressionarTecla);
  }, [abrirModalFechamento, alterarModalidade]);

  const value: SalesContextValue = {
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
    setModalidade: alterarModalidade,

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
    recarregarImpressoras: () => carregarImpressoras(false),
    cestasHoje,
    configFilial,
    recarregarConfigFilial,
    impressorasDisponiveis,

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
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
};

export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error('useSales precisa ser usado dentro de <SalesProvider>');
  return ctx;
}
