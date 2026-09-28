import 'dotenv/config';
import pg from 'pg';

if (!['true', 'false', undefined].includes(process.env.PGSSL)) {
  throw new Error('PGSSL deve ser true ou false.');
}

export const pool = new pg.Pool({
  // pg lê PGHOST, PGPORT, PGDATABASE, PGUSER e PGPASSWORD do ambiente.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
});
pool.on('error', error => console.error('Erro de conexão PostgreSQL', { code: error.code }));
