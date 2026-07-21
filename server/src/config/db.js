const { Pool, types } = require('pg');
const env = require('./env');

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects —
// pg's default Date parsing applies local-timezone conversion and shifts the day.
types.setTypeParser(types.builtins.DATE, (val) => val);

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
});

module.exports = { pool };
