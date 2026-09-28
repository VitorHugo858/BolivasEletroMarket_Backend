import { HttpError } from '../validation.js';
import { hashApiToken } from './token-generator.js';

const unauthorized = () => new HttpError(401, 'Chave de API inválida ou ausente.');

export function authenticateApiKey({ db, pepper }) {
  if (!pepper) throw new Error('API_TOKEN_PEPPER deve estar configurado.');

  return async (req, res, next) => {
    try {
      const token = req.get('X-API-Key');
      if (!token) throw unauthorized();

      const result = await db.query(
        `SELECT c.id, c.nome, c.client_id, c.contexto, c.ativo, c.expira_em,
                c.rate_limit_per_minute,
                COALESCE(array_agg(s.scope) FILTER (WHERE s.scope IS NOT NULL), '{}') AS scopes
           FROM public.api_clients c
           LEFT JOIN public.api_client_scopes s ON s.api_client_id = c.id
          WHERE c.token_hash = $1
          GROUP BY c.id`,
        [hashApiToken(token, pepper)],
      );
      const client = result.rows[0];
      if (!client || !client.ativo) throw unauthorized();
      if (client.expira_em && new Date(client.expira_em).getTime() <= Date.now()) throw unauthorized();

      req.apiClient = {
        id: client.id,
        nome: client.nome,
        clientId: client.client_id,
        contexto: client.contexto,
        rateLimitPerMinute: client.rate_limit_per_minute,
        scopes: client.scopes,
      };
      await db.query('UPDATE public.api_clients SET ultimo_acesso_em = CURRENT_TIMESTAMP WHERE id = $1', [client.id]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
