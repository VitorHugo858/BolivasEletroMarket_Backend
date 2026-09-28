# API Bolivas Eletroinfo

API Node.js com Express e PostgreSQL, baseada nas 13 tabelas do SQL fornecido. Oferece consulta, cadastro, atualização e exclusão. Requer Node.js 22 ou superior e um banco PostgreSQL acessível.

## Executar

No PowerShell, dentro da pasta do projeto:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Preencha no `.env` os campos `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` e `PGPASSWORD`. O arquivo não deve ser versionado. Use `PGSSL=true` quando seu servidor exigir TLS com certificado válido; certificados privados podem ser configurados com `NODE_EXTRA_CA_CERTS`.

```powershell
npm.cmd run dev
```

A API inicia em `http://127.0.0.1:3000`. Para executar sem reinício automático, use `npm.cmd start`. No Windows, `npm.cmd` evita o bloqueio de scripts `npm.ps1` do PowerShell; outros terminais podem usar `npm`.

O servidor verifica a conexão ao iniciar. Credenciais ausentes ou inválidas impedem a inicialização e produzem uma mensagem no terminal.

Se o banco já contém as tabelas, basta iniciar a API. Para um **banco vazio**, crie primeiro o banco no PostgreSQL, configure o `.env` e execute uma única vez:

```powershell
npm.cmd run db:init
```

Esse comando executa `database/schema.sql` em uma transação. O SQL original foi reorganizado pelas dependências, mantendo campos, índices e relacionamentos. Não apaga tabelas nem migra estruturas existentes; se alguma tabela já existir, a operação falha e é revertida. A aplicação não executa esse script automaticamente.

## Endpoints

Substitua `recurso` pelo nome exato de uma das tabelas abaixo:

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET | `/api/recurso?page=1&limit=20` | Lista ordenada por ID, com paginação |
| GET | `/api/recurso/:id` | Consulta um registro |
| POST | `/api/recurso` | Cria um registro; retorna 201 e o header Location |
| PUT ou PATCH | `/api/recurso/:id` | Atualiza somente os campos enviados |
| DELETE | `/api/recurso/:id` | Exclui fisicamente; retorna 204 sem corpo |
| GET | `/health` | Verifica a conexão com o banco |

PUT e PATCH têm a mesma semântica de atualização parcial neste projeto: campos omitidos permanecem iguais. `null` limpa um campo que aceite nulos. Envie `Content-Type: application/json` em POST, PUT e PATCH.

| Recurso | Campos obrigatórios no POST |
| --- | --- |
| `atributos` | `nome` |
| `categorias` | `nome` |
| `estoques` | `produto_id` |
| `fornecedores` | `nome` |
| `logs_integracao` | Nenhum |
| `marcas` | `nome` |
| `movimentacoes_estoque` | `produto_id`, `tipo`, `quantidade` |
| `plataformas` | `nome` |
| `produto_atributos` | `produto_id`, `atributo_id`, `valor` |
| `produto_fornecedor` | `produto_id`, `fornecedor_id` |
| `produto_plataforma` | `produto_id`, `plataforma_id` |
| `produtos` | Nenhum |
| `produtos_plataformas` | `codigo`, `descricao` |

Os demais campos editáveis estão em `src/resources.js` e seguem o SQL. IDs, `criado_em` e `atualizado_em` são gerenciados pelo banco/API e não são aceitos no corpo. Campos desconhecidos são rejeitados. `atualizado_em` é atualizado automaticamente em categorias, estoques e produtos_plataformas.

Listagens aceitam `page`, `limit` e filtros pelas chaves estrangeiras do recurso, com limite padrão 20 e máximo 100:

```json
{
  "data": [{ "id": "1", "nome": "Exemplo" }],
  "pagination": { "page": 1, "limit": 20, "hasNext": false }
}
```

## Consultas por relacionamento

Uma listagem pode ser filtrada diretamente pelo nome da chave estrangeira. É possível combinar filtros; todos são aplicados com `AND`:

```text
GET /api/produtos_plataformas?categoria_id=1
GET /api/produtos_plataformas?categoria_id=1&marca_id=2&page=1&limit=20
GET /api/produto_plataforma?produto_id=10&plataforma_id=2
GET /api/produto_atributos?produto_id=10
```

Cada relacionamento também possui uma rota contextual equivalente, no formato `/api/recurso-pai/:id/recurso-filho`:

```text
GET /api/categorias/1/produtos_plataformas
GET /api/marcas/2/produtos_plataformas
GET /api/produtos/10/produto_atributos
GET /api/produtos/10/produto_fornecedor
GET /api/produtos/10/produto_plataforma
GET /api/plataformas/2/produto_plataforma
GET /api/produtos_plataformas/15/estoques
```

As duas formas retornam o mesmo formato paginado. IDs inválidos, filtros desconhecidos e campos que não são chaves estrangeiras retornam status 400. Os valores são enviados ao PostgreSQL como parâmetros, sem interpolação no SQL.

## Imagens de produtos

As categorias que já possuem produtos receberam uma imagem genérica de catálogo. Consulte o catálogo de imagens em:

```text
GET /api/imagens/categorias
```

As respostas de `GET /api/categorias` e `GET /api/produtos_plataformas` incluem `imagem_url` quando há uma imagem para a categoria:

```json
{
  "id": "224",
  "nome": "Televisores",
  "imagem_url": "/images/categorias/televisores/default.png"
}
```

Os arquivos são servidos diretamente em `/images`. Exemplo:

```text
GET /images/categorias/televisores/default.png
```

Para adicionar fotos reais posteriormente, siga a convenção documentada em `public/images/README.md`: `public/images/produtos/<codigo>/principal.webp` para a capa e `01.webp`, `02.webp` etc. para a galeria.

Consultas individuais, criações e atualizações retornam `{ "data": { ... } }`. Erros retornam `{ "error": "mensagem" }`: 400 para entrada inválida, 401 para chave inválida, 404 para registro/rota ausente, 409 para duplicidade ou conflito de relacionamento e 500 para falha interna. `/health` retorna 503 se o banco estiver indisponível.

## Exemplo no PowerShell

Com a API iniciada e `API_KEY` vazio, execute:

```powershell
$base = 'http://127.0.0.1:3000'

# Cria um produto na tabela produtos_plataformas.
$json = @{ codigo = 'SKU-001'; descricao = 'Mouse USB'; preco = '49.90' } | ConvertTo-Json
$produto = Invoke-RestMethod -Method Post -Uri "$base/api/produtos_plataformas" -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
$produtoId = $produto.data.id

# Lista e consulta o produto criado.
Invoke-RestMethod -Uri "$base/api/produtos_plataformas?page=1&limit=20"
Invoke-RestMethod -Uri "$base/api/produtos_plataformas/$produtoId"

# Atualiza o preço.
Invoke-RestMethod -Method Patch -Uri "$base/api/produtos_plataformas/$produtoId" -ContentType 'application/json' -Body '{"preco":"59.90"}'

# Exclui o produto criado no exemplo.
Invoke-RestMethod -Method Delete -Uri "$base/api/produtos_plataformas/$produtoId"
```

## Particularidades do banco

- `produtos` e `produtos_plataformas` são tabelas diferentes, preservadas como no SQL. Em `produtos`, `preco` é inteiro e `saldo` é texto; não há conversão implícita para centavos ou números decimais.
- `estoques.produto_id` referencia **produtos_plataformas**. `movimentacoes_estoque`, `produto_atributos`, `produto_fornecedor`, `produto_plataforma` e `logs_integracao` referenciam **produtos**.
- As relações e exclusões CASCADE, SET NULL e RESTRICT são aplicadas pelo PostgreSQL. Excluir um registro pode excluir vínculos ou estoques conforme essas regras.
- Este é um CRUD: registrar uma movimentação não altera estoques automaticamente. Não foram inferidas regras de venda, reserva ou sincronização entre plataformas.
- IDs bigint e valores numeric são retornados pelo driver como texto para preservar a precisão. Envie IDs grandes e decimais como strings (`"9223372036854775807"`, `"49.90"`). Números decimais devem usar ponto, respeitando a precisão/escala da coluna.
- `ultima_sincronizacao` aceita data/hora sem fuso como `2026-09-23T14:30:00`, seguindo o tipo timestamp do SQL.
- Tipos de movimentação aceitos: ENTRADA, VENDA, DEVOLUCAO, AJUSTE_POSITIVO, AJUSTE_NEGATIVO e TRANSFERENCIA.

## Acesso e configuração

Por padrão a API escuta somente em `127.0.0.1`. Para acesso por outras máquinas, configure `HOST` adequadamente e defina `API_KEY`. Quando preenchida, envie `X-API-Key` em todas as chamadas a `/api` e `/health`:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/produtos' -Headers @{ 'X-API-Key' = 'sua-chave' }
```

A chave compartilhada não implementa usuários ou permissões individuais. Para publicação na internet, configure HTTPS e controle de acesso conforme a aplicação. Não há CORS configurado para um frontend de outra origem.

## Verificação

```powershell
npm.cmd test
```

Os testes exercitam HTTP, validações, consultas parametrizadas e tratamento de erros usando um banco simulado. Não precisam de credenciais e não comprovam conexão com seu PostgreSQL. Após preencher o `.env`, inicie a API e consulte `/health` para verificar a conexão real.

Referências de implementação: [Express — tratamento de erros](https://expressjs.com/en/guide/error-handling/) e [node-postgres — consultas parametrizadas](https://node-postgres.com/features/queries).
