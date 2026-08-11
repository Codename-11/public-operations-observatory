import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database } from './client.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function migrate(database: Database): Promise<string[]> {
  const migrationsDirectory = path.join(projectRoot, 'migrations');
  const names = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const name of names) {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('public-operations-observatory:migrations'))",
      );
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const existing = await client.query<{ name: string }>(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [name],
      );
      if (existing.rowCount === 0) {
        await client.query(await readFile(path.join(migrationsDirectory, name), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        applied.push(name);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}
