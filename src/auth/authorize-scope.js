import { HttpError } from '../validation.js';
import { ADMIN_SCOPE } from '../security/scopes.js';

export function authorizeScope(requiredScope) {
  return (req, res, next) => {
    const scopes = req.apiClient?.scopes || [];
    if (!scopes.includes(ADMIN_SCOPE) && !scopes.includes(requiredScope)) {
      return next(new HttpError(403, 'Credencial sem permissão para esta operação.'));
    }
    next();
  };
}
