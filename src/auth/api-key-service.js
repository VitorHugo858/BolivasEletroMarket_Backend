import { generateApiToken } from './token-generator.js';

async function withTransaction(db, action) {
  const connection = typeof db.connect === 'function' ? await db.connect() : db;
  try {
    await connection.query('BEGIN');
    const result = await action(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    if (connection !== db) connection.release();
  }
}

export async function createApiKey({ db, pepper, nome, clientId, contexto, scopes = [], expiraEm = null, rateLimitPerMinute = null }) {
  const generated = generateApiToken(contexto, pepper);
  return withTransaction(db, async connection => {
    const result = await connection.query(
      `INSERT INTO public.api_clients
         (nome, client_id, contexto, token_hash, token_prefix, expira_em, rate_limit_per_minute)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, client_id, contexto, token_prefix, ativo, expira_em,
                 rate_limit_per_minute, ultimo_acesso_em, criado_em, atualizado_em`,
      [nome, clientId, contexto, generated.tokenHash, generated.tokenPrefix, expiraEm, rateLimitPerMinute],
    );
    if (scopes.length) {
      await connection.query(
        `INSERT INTO public.api_client_scopes (api_client_id, scope)
         SELECT $1, unnest($2::varchar[])`,
        [result.rows[0].id, [...new Set(scopes)]],
      );
    }
    return { ...result.rows[0], scopes: [...new Set(scopes)], token: generated.token };
  });
}

export async function revokeApiKey({ db, id }) {
  const result = await db.query(
    `UPDATE public.api_clients SET ativo = false, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING id, ativo, atualizado_em`,
    [id],
  );
  return result.rows[0] || null;
}

export async function rotateApiKey({ db, pepper, id }) {
  return withTransaction(db, async connection => {
    const current = await connection.query('SELECT contexto FROM public.api_clients WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rows.length) return null;
    const generated = generateApiToken(current.rows[0].contexto, pepper);
    const result = await connection.query(
      `UPDATE public.api_clients
          SET token_hash = $1, token_prefix = $2, ativo = true,
              ultimo_acesso_em = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, nome, client_id, contexto, token_prefix, ativo, expira_em,
                  rate_limit_per_minute, ultimo_acesso_em, criado_em, atualizado_em`,
      [generated.tokenHash, generated.tokenPrefix, id],
    );
    return { ...result.rows[0], token: generated.token };
  });
}
