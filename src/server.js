import { pool } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve estar entre 1 e 65535.');
const app = createApp({ db: pool, tokenPepper: process.env.API_TOKEN_PEPPER });

try {
  await pool.query('SELECT 1');
  const server = app.listen(port, host, () => console.log(`API disponível em http://${host}:${port}`));
  server.on('error', async error => {
    console.error('Não foi possível iniciar o servidor.', { code: error.code });
    await pool.end();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await pool.end();
      clearTimeout(timeout);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Não foi possível conectar ao PostgreSQL. Confira o arquivo .env.', { code: error.code });
  await pool.end();
  process.exitCode = 1;
}
