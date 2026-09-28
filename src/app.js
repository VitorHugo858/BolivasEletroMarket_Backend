import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateApiKey } from './auth/authenticate-api-key.js';
import { authorizeScope } from './auth/authorize-scope.js';
import { decorateWithImage, imageCatalog } from './image-catalog.js';
import { resources } from './resources.js';
import { scopeFor } from './security/scopes.js';
import { HttpError, pagination, validateBody, validateId } from './validation.js';

const publicCatalogFields = Object.freeze({
  categorias: ['id', 'nome', 'descricao', 'categoria_pai_id', 'ativo'],
  produtos_plataformas: [
    'id', 'codigo', 'codigo_barras', 'descricao', 'descricao_completa', 'categoria_id', 'marca_id',
    'modelo', 'unidade', 'peso', 'altura', 'largura', 'comprimento', 'ativo', 'preco',
  ],
  marcas: ['id', 'nome', 'ativo'],
  estoques: ['id', 'produto_id', 'quantidade'],
});

export function createApp({ db, tokenPepper, logger = console }) {
  const app = express();
  const imagesPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/images');
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/images', express.static(imagesPath, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
  }));
  const authenticate = authenticateApiKey({ db, pepper: tokenPepper });
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });
  app.get('/api/imagens/categorias', (req, res) => res.json({ data: imageCatalog }));

  const list = (resourceName, contextFilter, selectedFields) => async (req, res) => {
    const resource = resources[resourceName];
    const filterNames = Object.keys(resource.foreignKeys || {});
    const query = contextFilter
      ? { ...req.query, [contextFilter]: req.params.parentId }
      : req.query;
    const { page, limit, offset, filters } = pagination(query, filterNames);
    const where = filters.length
      ? ` WHERE ${filters.map(([column], index) => `"${column}" = $${index + 1}`).join(' AND ')}`
      : '';
    const values = filters.map(([, value]) => value);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const table = `public."${resourceName}"`;
    const selection = selectedFields ? selectedFields.map(field => `"${field}"`).join(', ') : '*';
    const result = await db.query(
      `SELECT ${selection} FROM ${table}${where} ORDER BY id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...values, limit + 1, offset],
    );
    const rows = result.rows.slice(0, limit).map(row => {
      const projected = selectedFields
        ? Object.fromEntries(selectedFields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]))
        : row;
      return decorateWithImage(resourceName, projected);
    });
    res.json({ data: rows, pagination: { page, limit, hasNext: result.rows.length > limit } });
  };

  for (const [name, resource] of Object.entries(resources)) {
    const base = `/api/${name}`;
    const table = `public."${name}"`;
    const catalogFields = publicCatalogFields[name];
    if (catalogFields) app.get(base, list(name, undefined, catalogFields));
    else app.get(base, authenticate, authorizeScope(scopeFor(name, 'read')), list(name));
    app.get(`${base}/:id`, authenticate, authorizeScope(scopeFor(name, 'read')), async (req, res) => {
      const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [validateId(req.params.id)]);
      if (!result.rows.length) throw new HttpError(404, 'Registro não encontrado.');
      res.json({ data: decorateWithImage(name, result.rows[0]) });
    });
    app.post(base, authenticate, authorizeScope(scopeFor(name, 'write')), async (req, res) => {
      const entries = validateBody(req.body, resource, true);
      const columns = entries.map(([column]) => `"${column}"`).join(', ');
      const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
      const sql = entries.length
        ? `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`
        : `INSERT INTO ${table} DEFAULT VALUES RETURNING *`;
      const result = await db.query(sql, entries.map(([, value]) => value));
      res.location(`${base}/${result.rows[0].id}`).status(201).json({ data: decorateWithImage(name, result.rows[0]) });
    });
    const update = async (req, res) => {
      const id = validateId(req.params.id);
      const entries = validateBody(req.body, resource, false);
      const sets = entries.map(([column], index) => `"${column}" = $${index + 1}`);
      if (resource.updatedAt) sets.push('"atualizado_em" = CURRENT_TIMESTAMP');
      const result = await db.query(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${entries.length + 1} RETURNING *`,
        [...entries.map(([, value]) => value), id],
      );
      if (!result.rows.length) throw new HttpError(404, 'Registro não encontrado.');
      res.json({ data: decorateWithImage(name, result.rows[0]) });
    };
    app.put(`${base}/:id`, authenticate, authorizeScope(scopeFor(name, 'write')), update);
    app.patch(`${base}/:id`, authenticate, authorizeScope(scopeFor(name, 'write')), update);
    app.delete(`${base}/:id`, authenticate, authorizeScope(scopeFor(name, 'write')), async (req, res) => {
      const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [validateId(req.params.id)]);
      if (!result.rows.length) throw new HttpError(404, 'Registro não encontrado.');
      res.status(204).end();
    });
  }

  // Cada chave estrangeira também ganha uma rota legível no contexto do registro pai.
  for (const [childName, resource] of Object.entries(resources)) {
    for (const [foreignKey, parentName] of Object.entries(resource.foreignKeys || {})) {
      app.get(`/api/${parentName}/:parentId/${childName}`, authenticate, authorizeScope(scopeFor(childName, 'read')), list(childName, foreignKey));
    }
  }
  app.use((req, res, next) => next(new HttpError(404, 'Rota não encontrada.')));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'O corpo excede 1 MB.' });
    if (err.status === 415) return res.status(415).json({ error: 'Codificação do corpo não suportada.' });
    const databaseErrors = {
      '23505': [409, 'Já existe um registro com esses dados únicos.'],
      '23503': [409, 'Relacionamento inválido: registro referenciado ausente ou exclusão impedida por vínculos.'],
      '23502': [400, 'Um campo obrigatório não foi preenchido.'],
      '23514': [400, 'Os dados violam uma regra do banco.'],
      '22001': [400, 'Texto maior que o tamanho permitido.'],
      '22003': [400, 'Número fora do intervalo permitido.'],
      '22P02': [400, 'Formato de dado inválido.'],
      '22007': [400, 'Data inválida.'],
      '22008': [400, 'Data fora do intervalo permitido.'],
    };
    if (Object.hasOwn(databaseErrors, err.code || '')) {
      const [status, message] = databaseErrors[err.code];
      return res.status(status).json({ error: message });
    }
    logger.error('Falha na requisição', { code: err.code || 'INTERNAL_ERROR' });
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  });
  return app;
}
