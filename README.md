# PDV / Emissão de Orçamentos de Balcão

Aplicação desktop **offline / rede local (LAN)** para PDV e emissão de
orçamentos de balcão, com operação 100% via teclado (bipagem + atalhos de
função) e impressão térmica ESC/POS (80mm) em 2 ou 3 vias conforme a
modalidade da operação.

## Stack

- **Electron + Node.js** — runtime desktop, empacotado com `electron-builder` (.exe via NSIS)
- **React 18 + Vite + TypeScript + Tailwind CSS** — interface
- **better-sqlite3** — banco de dados local (SQLite), síncrono, roda no processo principal
- **Express.js** — servidor HTTP interno (porta `3550`) para terminais clientes na mesma LAN consultarem produtos/usuários e gravarem orçamentos
- **ESC/POS** — geração e envio de cupom para impressora térmica de bobina 80mm

## Estrutura de pastas

```
pdv-app/
├─ electron/                 # Processo principal (Node.js)
│  ├─ main.ts                # Janela, IPC handlers, bootstrap
│  ├─ preload.ts             # contextBridge -> window.api
│  ├─ database.ts            # SQLite (better-sqlite3): schema, CRUD, regra de preço
│  ├─ printer.ts             # Formatação ESC/POS do cupom + envio para impressora
│  ├─ server.ts              # API Express para terminais da LAN
│  └─ types.ts
├─ src/                      # Renderer (React)
│  ├─ context/SalesContext.tsx   # Estado global do PDV + atalhos de teclado
│  ├─ components/
│  │  ├─ PDV.tsx             # Tela principal (busca, carrinho, cliente, modalidade)
│  │  └─ ReceiptPreview.tsx  # Pré-visualização das vias do cupom
│  ├─ utils/cupomFormatter.ts   # Mesma formatação do printer.ts, para preview em tela
│  ├─ types/index.ts
│  ├─ App.tsx / main.tsx / index.css
├─ index.html
├─ vite.config.ts
├─ tailwind.config.js / postcss.config.js
├─ tsconfig.json / electron/tsconfig.json
├─ package.json
└─ electron-builder.json
```

## Banco de dados (SQLite)

Tabelas criadas automaticamente em `electron/database.ts::initDatabase()`,
no arquivo `pdv.db` salvo em `app.getPath('userData')`:

- **produtos**: `produto_id, descricao, barras, preco_cmp, preco_vnd, preco_promocao, data_fim_promocao, estoque`
- **usuarios**: `usuario_id, nome, documento, telefone, endereco`
- **orcamentos**: `orcamento_id, usuario_id, tipo_operacao (CESTA|ENTREGA), total, terminal, data_hora, numero_cesta_dia`
- **orcamento_itens**: `item_id, orcamento_id, produto_id, descricao, barras, quantidade, preco_unitario, promocional, subtotal`

Na primeira execução, se as tabelas estiverem vazias, alguns produtos e
usuários de demonstração são inseridos automaticamente (`seedIfEmpty`).

### Numeração diária de cestas

Toda venda com `tipo_operacao = 'CESTA'` recebe um `numero_cesta_dia`
sequencial, calculado a partir de `COUNT(*) ... WHERE date(data_hora) =
date(hoje)` no momento da criação. Como o cálculo é sempre filtrado pela
data atual, o número **reinicia sozinho todo dia**, sem necessidade de
nenhum job de reset. Aparece no cupom impresso, na pré-visualização e como
badge ("Próx. Nº X") no botão CESTA da tela do PDV.

### Relatório de vendas por dia / vendedor

Acessível pelo botão "Relatório de Vendas" no topo da aplicação. Permite
escolher um período (`dataInicio`/`dataFim`), exibe o total vendido e a
quantidade de cestas/entregas agrupados por dia e por vendedor, e oferece
impressão/"Salvar como PDF" via `window.print()` nativo do Electron.

### Configurações (ícone de engrenagem, canto superior direito)

Tela dedicada com:
- **Dados da Filial**: nome, endereço, CNPJ e telefone impressos no
  cabeçalho do cupom (antes eram fixos no código, em `printer.ts` e
  `cupomFormatter.ts` — agora ficam gravados na tabela `configuracoes`
  do banco, editáveis pela interface). CNPJ e telefone têm máscara de
  formatação aplicada automaticamente enquanto digita.
- **Importar Planilhas**: botões "Importar Produtos" e "Importar
  Vendedores" (migrados do antigo painel fixo no topo do app), que abrem
  o seletor de arquivo do Windows normalmente.

Tudo é persistido em `configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`
como pares chave/valor, o que evita nova migração de schema a cada
configuração adicionada no futuro.

### Regra de preço promocional

```
SE data_atual <= data_fim_promocao E preco_promocao > 0:
    preco_aplicado = preco_promocao   (marcado com *)
CASO CONTRÁRIO:
    preco_aplicado = preco_vnd
```

Implementada em `electron/database.ts::resolverPreco()` e reaplicada de
forma idêntica no preview (`src/utils/cupomFormatter.ts`) e no cupom real
(`electron/printer.ts`).

## Atalhos de teclado

| Tecla  | Ação                                            |
|--------|--------------------------------------------------|
| F1     | Foco na busca/bipagem de produtos                 |
| F2     | Foco na busca de usuário                          |
| F3     | Selecionar modalidade **CESTA** (2 vias)          |
| F4     | Selecionar modalidade **ENTREGA** (3 vias)        |
| ENTER  | Confirmar quantidade / incluir item no carrinho   |
| F12    | Fechar venda (grava no banco + imprime as vias)   |
| ESC    | Cancelar seleção do produto atual                 |

Os atalhos são globais (`window.addEventListener('keydown', ...)`) e ficam
ativos em toda a tela do PDV — ver `src/context/SalesContext.tsx`.

## Rodando em desenvolvimento

```bash
npm install
npm run dev:electron
```

Isso sobe o Vite em `http://localhost:5173`, compila o processo principal
(`electron/*.ts` -> `dist-electron/*.js`) em modo watch e abre a janela do
Electron apontando para o Vite dev server.

## Build de produção (.exe)

```bash
npm run build   # compila renderer (Vite) + processo principal (tsc)
npm run dist    # empacota com electron-builder (gera instalador NSIS em /release)
```

## Importando suas planilhas de base (.xlsx)

No cabeçalho do app existem dois botões: **"Importar Produtos (.xlsx)"** e
**"Importar Usuários (.xlsx)"**. Cada um abre o seletor de arquivos do
Windows; escolha a planilha correspondente. O importador (`electron/importer.ts`)
lê a primeira aba do arquivo e reconhece várias variações de nome de coluna
(sem diferenciar maiúsculas/acentos), então não precisa editar sua planilha
para bater exatamente com os nomes do banco:

**Produtos** — a coluna de descrição é obrigatória; as demais são opcionais:

| Campo no banco       | Nomes de coluna aceitos na planilha                          |
|-----------------------|---------------------------------------------------------------|
| `produto_id`           | codigo, cod, id, produto_id, cod_produto                      |
| `descricao` (obrigatório) | descricao, produto, nome, nome_produto                     |
| `barras`                | barras, codigo de barras, cod_barras, ean, gtin              |
| `preco_cmp`              | preco_cmp, preco_compra, custo, preco de custo               |
| `preco_vnd`               | preco_vnd, preco_venda, preco_cheio, preco, valor            |
| `preco_promocao`           | preco_promocao, promocao, valor promocional, preco oferta  |
| `data_fim_promocao`         | data_fim_promocao, validade_promocao, fim_promocao (aceita dd/mm/aaaa, aaaa-mm-dd ou data do Excel) |
| `estoque`                    | estoque, quantidade, qtd_estoque, saldo                    |

**Usuários/Clientes** — a coluna de nome é obrigatória:

| Campo no banco | Nomes de coluna aceitos                          |
|-----------------|---------------------------------------------------|
| `usuario_id`      | codigo, cod, id, usuario_id, cod_cliente          |
| `nome` (obrigatório) | nome, nome_cliente, cliente, nome_completo    |
| `documento`         | documento, cpf, cnpj, doc                       |
| `telefone`            | telefone, tel, fone, celular, whatsapp         |
| `endereco`               | endereco, endereco_entrega, logradouro       |

**Regra de upsert:** se a planilha trouxer um código (`produto_id` /
`usuario_id`) ou um código de barras já existente no banco, o registro é
**atualizado**; caso contrário, é **inserido** como novo. Isso permite rodar
a importação várias vezes (ex: reajuste de preços) sem duplicar produtos.

Depois de importar, feche e reabra o app (ou pressione F1 e busque um
produto) para confirmar que os dados entraram corretamente.

## Servidor LAN (terminais clientes)

Enquanto o app estiver aberto no computador "host", ele expõe uma API REST
na porta **3550** para outros terminais da rede local consultarem produtos,
usuários e gravarem orçamentos sem precisar de banco próprio:

```
GET  /api/status
GET  /api/produtos/busca?termo=...
GET  /api/produtos/pesquisa?termo=...
GET  /api/usuarios/:id
GET  /api/usuarios?termo=...
POST /api/orcamentos
GET  /api/orcamentos/:id
POST /api/orcamentos/:id/imprimir
```

Ver `electron/server.ts`.

## Impressão térmica (ESC/POS)

`electron/printer.ts` monta o texto do cupom (colunas fixas, 42 colunas –
padrão para bobina 80mm) e o envelopa em comandos ESC/POS (inicialização,
alinhamento, alimentação de papel e corte parcial), enviando o buffer bruto
para a impressora do sistema operacional (`copy /b` no Windows, `lp -o raw`
no Linux/Mac). Ajuste `nomeImpressora` conforme o nome da fila de impressão
instalada, se necessário.

Layout do cupom (por via):
1. Cabeçalho da loja
2. `*** OPERACAO: CESTA ***` ou `*** OPERACAO: ENTREGA ***`
3. Dados do cliente (código, nome, telefone, endereço de entrega quando ENTREGA)
4. Tabela de itens: código de barras / descrição / `qtd x preço unit.` / total
5. Rodapé: total geral, data/hora, terminal, número do orçamento e
   identificação da via (`VIA 1 DE 3 - CLIENTE`, `VIA 2 DE 3 - ENTREGADOR`, ...)
