import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { hashApiToken } from '../src/auth/token-generator.js';
import { resources } from '../src/resources.js';

async function fixture(t, authentication = {}) {
  const calls = [];
  let result = { rows: [] };
  let failure;
  const pepper = 'pepper-de-teste';
  const auth = {
    token: 'bv_test_token-valido', sendToken: true, ativo: true, expiraEm: null,
    scopes: ['admin'], ...authentication,
  };
  const db = { async query(sql, params) {
    if (sql.includes('FROM public.api_clients c')) {
      const valid = params[0] === hashApiToken(auth.token, pepper);
      return { rows: valid ? [{
        id: '99', nome: 'Teste', client_id: 'teste', contexto: 'development',
        ativo: auth.ativo, expira_em: auth.expiraEm, rate_limit_per_minute: 60,
        scopes: auth.scopes,
      }] : [] };
    }
    if (sql.startsWith('UPDATE public.api_clients SET ultimo_acesso_em')) return { rows: [] };
    calls.push({ sql, params });
    if (failure) throw failure;
    return result;
  } };
  const server = createApp({ db, tokenPepper: pepper, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    calls,
    reply(rows) { result = { rows }; failure = undefined; },
    fail(code) { failure = Object.assign(new Error('segredo do banco'), { code }); },
    authenticate(changes) { Object.assign(auth, changes); },
    request(path, method = 'GET', body, headers = {}) {
      const apiKeyHeader = auth.sendToken ? { 'X-API-Key': auth.token } : {};
      return fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...apiKeyHeader, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    },
    raw(path, body) { return fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': auth.token }, body }); },
  };
}

const samples = {
  atributos: { nome: 'Cor' }, categorias: { nome: 'Eletrônicos' }, estoques: { produto_id: '1' },
  fornecedores: { nome: 'Fornecedor' }, logs_integracao: { mensagem: 'Teste' }, marcas: { nome: 'Marca' },
  movimentacoes_estoque: { produto_id: '1', tipo: 'ENTRADA', quantidade: '2.000' },
  plataformas: { nome: 'Loja' }, produto_atributos: { produto_id: '1', atributo_id: '1', valor: 'Azul' },
  produto_fornecedor: { produto_id: '1', fornecedor_id: '1' }, produto_plataforma: { produto_id: '1', plataforma_id: '1' },
  produtos: { descricao: 'Mouse', preco: 20, saldo: '2' }, produtos_plataformas: { codigo: 'SKU-1', descricao: 'Mouse', preco: '20.00' },
};

for (const name of Object.keys(resources)) {
  test(`CRUD HTTP: ${name}`, async t => {
    const f = await fixture(t);
    const path = `/api/${name}`;
    const row = { id: '1', ...samples[name] };
    f.reply([row]);
    let response = await f.request(path, 'POST', samples[name]);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('location'), `${path}/1`);
    assert.deepEqual((await response.json()).data, row);
    assert.match(f.calls.at(-1).sql, new RegExp(`INSERT INTO public."${name}"`));
    assert.deepEqual(f.calls.at(-1).params, Object.values(samples[name]));

    response = await f.request(`${path}/1`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, row);
    assert.deepEqual(f.calls.at(-1).params, ['1']);

    response = await f.request(`${path}?page=2&limit=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls.at(-1).params, [2, 1]);

    for (const method of ['PUT', 'PATCH']) {
      response = await f.request(`${path}/1`, method, samples[name]);
      assert.equal(response.status, 200);
      assert.match(f.calls.at(-1).sql, /UPDATE .* WHERE id = \$\d+ RETURNING \*/);
      assert.equal(f.calls.at(-1).sql.includes('"atualizado_em" = CURRENT_TIMESTAMP'), Boolean(resources[name].updatedAt));
    }
    response = await f.request(`${path}/1`, 'DELETE');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.match(f.calls.at(-1).sql, /DELETE .* WHERE id = \$1 RETURNING id/);
  });
}

test('Entradas inválidas são rejeitadas antes de acessar o banco', async t => {
  const f = await fixture(t);
  const cases = [
    ['/api/marcas', 'POST', {}], ['/api/marcas', 'POST', { nome: null }],
    ['/api/marcas', 'POST', { nome: 'x', id: '7' }], ['/api/marcas', 'POST', { nome: 'x', ativo: 'true' }],
    ['/api/marcas', 'POST', { nome: 'x'.repeat(151) }], ['/api/marcas/1', 'PATCH', {}],
    ['/api/marcas', 'POST', []], ['/api/marcas', 'POST', { constructor: 'x' }],
    ['/api/marcas/0'], ['/api/marcas/1%20OR%201=1'], ['/api/marcas/9223372036854775808'],
    ['/api/marcas?limit=101'], ['/api/marcas?page=-1'], ['/api/marcas?limit=1&limit=2'], ['/api/marcas?sort=nome'],
    ['/api/produtos', 'POST', { preco: 10.5 }], ['/api/produtos', 'POST', { preco: 2147483648 }],
    ['/api/estoques', 'POST', { produto_id: 9007199254740992 }],
    ['/api/produtos_plataformas/1', 'PATCH', { preco: '1.999' }],
    ['/api/produtos_plataformas/1', 'PATCH', { preco: '1000000000000.00' }],
    ['/api/movimentacoes_estoque', 'POST', { produto_id: '1', tipo: 'INVALIDO', quantidade: '1' }],
    ['/api/produto_plataforma/1', 'PATCH', { ultima_sincronizacao: '2026-02-30T12:00:00' }],
  ];
  for (const [path, method, body] of cases) {
    assert.equal((await f.request(path, method, body)).status, 400, `${method || 'GET'} ${path}: ${JSON.stringify(body)}`);
  }
  assert.equal((await f.raw('/api/marcas', '{')).status, 400);
  assert.equal(f.calls.length, 0);
});

test('SQL mantém dados do cliente nos parâmetros e preserva bigint', async t => {
  const f = await fixture(t);
  f.reply([{ id: '9223372036854775807' }]);
  const nome = "'); DROP TABLE marcas; --";
  assert.equal((await f.request('/api/marcas', 'POST', { nome })).status, 201);
  assert.equal(f.calls[0].sql.includes(nome), false);
  assert.deepEqual(f.calls[0].params, [nome]);
  assert.equal((await f.request('/api/marcas/9223372036854775807')).status, 200);
  assert.deepEqual(f.calls[1].params, ['9223372036854775807']);
});

test('Paginação sinaliza a próxima página e limita os resultados', async t => {
  const f = await fixture(t);
  f.reply([{ id: '1' }, { id: '2' }]);
  const response = await f.request('/api/produtos?limit=1');
  assert.deepEqual(await response.json(), { data: [{ id: '1' }], pagination: { page: 1, limit: 1, hasNext: true } });
});

test('Listagens aceitam filtros somente para chaves estrangeiras', async t => {
  const f = await fixture(t);
  f.reply([{ id: '7', categoria_id: '3', marca_id: '2' }]);
  let response = await f.request('/api/produtos_plataformas?categoria_id=3&marca_id=2&page=2&limit=10');
  assert.equal(response.status, 200);
  assert.match(f.calls.at(-1).sql, /WHERE "categoria_id" = \$1 AND "marca_id" = \$2/);
  assert.deepEqual(f.calls.at(-1).params, ['3', '2', 11, 10]);

  response = await f.request('/api/produtos_plataformas?descricao=Mouse');
  assert.equal(response.status, 400);
});

test('Rotas contextuais traduzem o ID do pai para a chave estrangeira', async t => {
  const f = await fixture(t);
  f.reply([{ id: '7', categoria_id: '3' }]);
  const response = await f.request('/api/categorias/3/produtos_plataformas?limit=5');
  assert.equal(response.status, 200);
  assert.match(f.calls.at(-1).sql, /WHERE "categoria_id" = \$1/);
  assert.deepEqual(f.calls.at(-1).params, ['3', 6, 0]);
});

test('Catálogo e produtos expõem imagens das categorias mapeadas', async t => {
  const f = await fixture(t);
  let response = await f.request('/api/imagens/categorias');
  assert.equal(response.status, 200);
  const catalog = (await response.json()).data;
  assert.equal(catalog.length, 18);
  assert.equal(catalog.find(item => item.categoria_id === '224').imagem_url, '/images/categorias/televisores/default.png');

  f.reply([{ id: '1', codigo: 'TV-1', categoria_id: '224' }]);
  response = await f.request('/api/produtos_plataformas/1');
  assert.equal((await response.json()).data.imagem_url, '/images/categorias/televisores/default.png');

  response = await f.request('/images/categorias/televisores/default.png');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.ok((await response.arrayBuffer()).byteLength > 100000);
});

test('Catálogo público dispensa chave, limita campos e não libera outras rotas', async t => {
  const f = await fixture(t, { sendToken: false });
  const cases = [
    ['/api/categorias', { id: '1', nome: 'Eletrônicos', descricao: 'Catálogo', categoria_pai_id: null, ativo: true }, { criado_em: 'interno' }],
    ['/api/produtos_plataformas', { id: '2', codigo: 'SKU-1', descricao: 'Mouse', categoria_id: '1', preco: '20.00', ativo: true }, { atualizado_em: 'interno' }],
    ['/api/marcas', { id: '3', nome: 'Marca', ativo: true }, { criado_em: 'interno' }],
    ['/api/estoques', { id: '4', produto_id: '2', quantidade: '10.000' }, { reservado: '2.000', estoque_minimo: '3.000' }],
  ];

  for (const [path, visible, internal] of cases) {
    f.reply([{ ...visible, ...internal }]);
    const response = await f.request(path);
    assert.equal(response.status, 200, path);
    const row = (await response.json()).data[0];
    for (const [field, value] of Object.entries(visible)) assert.deepEqual(row[field], value);
    for (const field of Object.keys(internal)) assert.equal(Object.hasOwn(row, field), false);
  }

  assert.equal((await f.request('/api/imagens/categorias')).status, 200);
  assert.equal((await f.request('/api/produtos')).status, 401);
  assert.equal((await f.request('/api/categorias/3/produtos_plataformas')).status, 401);
  assert.equal((await f.request('/api/marcas/1')).status, 401);
  assert.equal((await f.request('/api/marcas', 'POST', { nome: 'Nova' })).status, 401);
});

test('Ausência, conflitos e erros internos retornam status apropriado sem detalhes do banco', async t => {
  const f = await fixture(t);
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal((await f.request('/api/marcas/1', method, method === 'PATCH' ? { nome: 'x' } : undefined)).status, 404);
  }
  assert.equal((await f.request('/api/tabela_nao_permitida')).status, 404);
  for (const [code, status] of [['23505', 409], ['23503', 409], ['23514', 400], ['ECONNREFUSED', 500]]) {
    f.fail(code);
    const response = await f.request('/api/marcas', 'POST', { nome: 'x' });
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes('segredo'), false);
  }
});

test('Campos omitidos usam os defaults do banco e campos nulos são preservados', async t => {
  const f = await fixture(t);
  f.reply([{ id: '1' }]);
  assert.equal((await f.request('/api/produtos', 'POST', {})).status, 201);
  assert.match(f.calls.at(-1).sql, /DEFAULT VALUES/);
  assert.equal((await f.request('/api/marcas/1', 'PATCH', { ativo: null })).status, 200);
  assert.deepEqual(f.calls.at(-1).params, [null, '1']);
});

test('Autentica credenciais e autoriza scopes do CRUD', async t => {
  const f = await fixture(t, { scopes: [] });
  f.reply([{ id: '1', descricao: 'Mouse' }]);

  f.authenticate({ sendToken: false });
  assert.equal((await f.request('/api/produtos')).status, 401);

  f.authenticate({ sendToken: true });
  assert.equal((await f.request('/api/produtos', 'GET', undefined, { 'X-API-Key': 'invalida' })).status, 401);
  assert.equal((await f.request('/api/produtos')).status, 403);

  f.authenticate({ scopes: ['produtos:read'] });
  assert.equal((await f.request('/api/produtos')).status, 200);
  assert.equal((await f.request('/api/produtos', 'POST', { descricao: 'Mouse' })).status, 403);
  assert.equal((await f.request('/api/produtos_plataformas', 'POST', { codigo: 'SKU-1', descricao: 'Mouse' })).status, 403);

  f.authenticate({ scopes: ['produtos:write'] });
  assert.equal((await f.request('/api/produtos', 'POST', { descricao: 'Mouse' })).status, 201);

  f.authenticate({ scopes: ['admin'] });
  assert.equal((await f.request('/api/produtos')).status, 200);
  assert.equal((await f.request('/api/produtos', 'POST', { descricao: 'Mouse' })).status, 201);

  f.authenticate({ expiraEm: new Date(Date.now() - 1000).toISOString() });
  assert.equal((await f.request('/api/produtos')).status, 401);

  f.authenticate({ expiraEm: null, ativo: false });
  assert.equal((await f.request('/api/produtos')).status, 401);
});
