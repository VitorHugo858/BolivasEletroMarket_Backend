import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

let client;
try {
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('As 13 tabelas foram criadas.');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error('Não foi possível criar as tabelas. Use um banco vazio e confira o .env.', { code: error.code });
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end();
}
