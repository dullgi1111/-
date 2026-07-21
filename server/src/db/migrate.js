const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`applying: ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed: ${file}: ${err.message}`);
      }
    }

    const seedDir = path.join(__dirname, 'seed');
    const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of seedFiles) {
      const sql = fs.readFileSync(path.join(seedDir, file), 'utf8');
      console.log(`seeding: ${file}`);
      await client.query(sql);
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
