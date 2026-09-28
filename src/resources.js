const text = (max, required = false) => ({ type: 'text', max, required });
const id = (required = false) => ({ type: 'id', required });
const bool = { type: 'boolean' };
const integer = { type: 'integer' };
const decimal = (precision, scale) => ({ type: 'decimal', precision, scale });
const timestamp = { type: 'timestamp' };

// Lista fechada: nomes de tabelas e colunas nunca são aceitos diretamente do cliente.
export const resources = {
  atributos: { fields: { nome: text(150, true), tipo: text(30), unidade: text(30), ativo: bool } },
  categorias: {
    updatedAt: true,
    foreignKeys: { categoria_pai_id: 'categorias' },
    fields: { nome: text(150, true), descricao: text(), categoria_pai_id: id(), ativo: bool },
  },
  estoques: {
    updatedAt: true,
    foreignKeys: { produto_id: 'produtos_plataformas' },
    fields: { produto_id: id(true), quantidade: decimal(14, 3), reservado: decimal(14, 3), estoque_minimo: decimal(14, 3), estoque_maximo: decimal(14, 3) },
  },
  fornecedores: {
    fields: { nome: text(255, true), razao_social: text(255), cnpj: text(20), email: text(150), telefone: text(30), cidade: text(100), estado: text(2), ativo: bool },
  },
  logs_integracao: {
    foreignKeys: { plataforma_id: 'plataformas', produto_id: 'produtos' },
    fields: { plataforma_id: id(), produto_id: id(), tipo: text(50), status: text(30), mensagem: text() },
  },
  marcas: { fields: { nome: text(150, true), ativo: bool } },
  movimentacoes_estoque: {
    foreignKeys: { produto_id: 'produtos' },
    fields: {
      produto_id: id(true),
      tipo: { ...text(30, true), values: ['ENTRADA', 'VENDA', 'DEVOLUCAO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA'] },
      quantidade: { ...decimal(14, 3), required: true },
      saldo_anterior: decimal(14, 3), saldo_posterior: decimal(14, 3), referencia: text(150), observacao: text(),
    },
  },
  plataformas: { fields: { nome: text(100, true), ativo: bool } },
  produto_atributos: {
    foreignKeys: { produto_id: 'produtos', atributo_id: 'atributos' },
    fields: { produto_id: id(true), atributo_id: id(true), valor: text(255, true) },
  },
  produto_fornecedor: {
    foreignKeys: { produto_id: 'produtos', fornecedor_id: 'fornecedores' },
    fields: { produto_id: id(true), fornecedor_id: id(true), codigo_fornecedor: text(100), preco_custo: decimal(14, 2), principal: bool },
  },
  produto_plataforma: {
    foreignKeys: { produto_id: 'produtos', plataforma_id: 'plataformas' },
    fields: { produto_id: id(true), plataforma_id: id(true), codigo_externo: text(150), titulo_externo: text(255), preco: decimal(14, 2), quantidade_publicada: decimal(14, 3), ativo: bool, sincronizado: bool, ultima_sincronizacao: timestamp },
  },
  produtos: { fields: { codigo: integer, descricao: text(512), marca: text(512), preco: integer, saldo: text(512) } },
  produtos_plataformas: {
    updatedAt: true,
    foreignKeys: { categoria_id: 'categorias', marca_id: 'marcas' },
    fields: {
      codigo: text(50, true), codigo_barras: text(50), descricao: text(255, true), descricao_completa: text(),
      categoria_id: id(), marca_id: id(), modelo: text(150), unidade: text(20), peso: decimal(10, 3),
      altura: decimal(10, 2), largura: decimal(10, 2), comprimento: decimal(10, 2), ativo: bool, preco: decimal(14, 2),
    },
  },
};
