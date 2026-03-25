import fs from 'fs';
import path from 'path';
import { pool, connectDB } from '../config/db';
import { logger } from '../shared/utils/logger';

// We need env loaded before importing config
import '../config/env';

async function runMigrations(): Promise<void> {
  await connectDB();

  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedSet = new Set(applied.map((r) => r.version));

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.debug(`Skipping already applied migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      logger.info(`Applying migration: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        count++;
        logger.info(`Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`Migration failed: ${file}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    if (count === 0) {
      logger.info('All migrations already applied — database is up to date');
    } else {
      logger.info(`Migrations complete — applied ${count} migration(s)`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  logger.error('Migration runner failed', {
    error: err instanceof Error ? err.message || err.stack : String(err),
  });
  process.exit(1);
});
