export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function validateId(value) {
  const validType = typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value));
  if (!validType || !/^[1-9]\d{0,18}$/.test(String(value)) || BigInt(value) > 9223372036854775807n) {
    throw new HttpError(400, 'ID deve ser um inteiro positivo de até 64 bits. Envie IDs grandes como texto.');
  }
  return String(value);
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(value)) return false;
  const date = new Date(`${value}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
}

function validateValue(name, value, field) {
  if (value === null) {
    if (field.required) throw new HttpError(400, `${name} não pode ser nulo.`);
    return null;
  }
  let valid = false;
  switch (field.type) {
    case 'id': return validateId(value);
    case 'text':
      valid = typeof value === 'string' && (!field.max || [...value].length <= field.max);
      break;
    case 'boolean': valid = typeof value === 'boolean'; break;
    case 'integer': valid = Number.isInteger(value) && value >= -2147483648 && value <= 2147483647; break;
    case 'timestamp': valid = validTimestamp(value); break;
    case 'decimal': {
      const decimalText = String(value);
      valid = (typeof value === 'string' || typeof value === 'number') && /^-?\d+(\.\d+)?$/.test(decimalText);
      if (valid) {
        const [whole, fraction = ''] = decimalText.replace(/^-/, '').split('.');
        valid = whole.replace(/^0+/, '').length <= field.precision - field.scale && fraction.length <= field.scale;
      }
      break;
    }
  }
  if (!valid || (field.values && !field.values.includes(value))) {
    throw new HttpError(400, `Valor inválido para ${name}${field.values ? `: use ${field.values.join(', ')}` : ''}.`);
  }
  return value;
}

export function validateBody(body, resource, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Envie um objeto JSON.');
  const entries = Object.entries(body);
  if (!creating && entries.length === 0) throw new HttpError(400, 'Informe pelo menos um campo para atualizar.');
  for (const [name] of entries) {
    if (!Object.hasOwn(resource.fields, name)) throw new HttpError(400, `Campo não permitido: ${name}.`);
  }
  if (creating) {
    for (const [name, field] of Object.entries(resource.fields)) {
      if (field.required && !Object.hasOwn(body, name)) throw new HttpError(400, `Campo obrigatório: ${name}.`);
    }
  }
  return entries.map(([name, value]) => [name, validateValue(name, value, resource.fields[name])]);
}

export function pagination(query, filterNames = []) {
  const allowed = ['page', 'limit', ...filterNames];
  if (Object.keys(query).some(key => !allowed.includes(key))) {
    const filters = filterNames.length ? ` e os filtros ${filterNames.join(', ')}` : '';
    throw new HttpError(400, `Use somente os parâmetros page, limit${filters}.`);
  }
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw new HttpError(400, 'Paginação inválida: page deve ser positivo e limit deve estar entre 1 e 100.');
    }
    return Number(value);
  };
  const page = parse(query.page, 1, 1000000000);
  const limit = parse(query.limit, 20, 100);
  const filters = filterNames
    .filter(name => query[name] !== undefined)
    .map(name => [name, validateId(query[name])]);
  return { page, limit, offset: (page - 1) * limit, filters };
}
