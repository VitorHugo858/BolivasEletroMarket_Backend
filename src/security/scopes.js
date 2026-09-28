export const ADMIN_SCOPE = 'admin';

export function scopeFor(resourceName, operation) {
  return `${resourceName}:${operation}`;
}
