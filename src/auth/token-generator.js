import { createHmac, randomBytes } from 'node:crypto';

const tokenPrefixes = Object.freeze({
  third_party: 'bv_live_',
  internal: 'bv_int_',
  development: 'bv_test_',
  temporary: 'bv_tmp_',
});

function requirePepper(pepper) {
  if (typeof pepper !== 'string' || !pepper) throw new Error('API_TOKEN_PEPPER deve estar configurado.');
}

export function hashApiToken(token, pepper) {
  requirePepper(pepper);
  return createHmac('sha256', pepper).update(token).digest('hex');
}

export function generateApiToken(context, pepper) {
  const prefix = tokenPrefixes[context];
  if (!prefix) throw new TypeError('Contexto de credencial inválido.');
  const token = `${prefix}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    tokenHash: hashApiToken(token, pepper),
    tokenPrefix: `${prefix}${token.slice(prefix.length, prefix.length + 8)}`,
  };
}
