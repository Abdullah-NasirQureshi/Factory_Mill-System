const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'neondb',
  ssl:      { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

/**
 * Wraps pg pool to match the mysql2/promise interface used throughout the app.
 * mysql2 returns [rows, fields] — we replicate that here.
 */
const db = {
  query: async (sql, params = []) => {
    // pg uses $1,$2 placeholders; mysql2 uses ?
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    // Auto-append RETURNING id for INSERT statements that don't already have RETURNING
    const isInsert = /^\s*INSERT\s/i.test(pgSql);
    const hasReturning = /RETURNING/i.test(pgSql);
    const finalSql = isInsert && !hasReturning ? pgSql + ' RETURNING id' : pgSql;
    const result = await pool.query(finalSql, params);
    // Attach insertId for compatibility with mysql2 pattern
    if (isInsert && result.rows[0]?.id) result.insertId = result.rows[0].id;
    return [result.rows, result.fields, result];
  },

  getConnection: async () => {
    const client = await pool.connect();
    return {
      query: async (sql, params = []) => {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        const isInsert = /^\s*INSERT\s/i.test(pgSql);
        const hasReturning = /RETURNING/i.test(pgSql);
        const finalSql = isInsert && !hasReturning ? pgSql + ' RETURNING id' : pgSql;
        const result = await client.query(finalSql, params);
        if (isInsert && result.rows[0]?.id) result.insertId = result.rows[0].id;
        return [result.rows, result.fields, result];
      },
      beginTransaction: () => client.query('BEGIN'),
      commit:           () => client.query('COMMIT'),
      rollback:         () => client.query('ROLLBACK'),
      release:          () => client.release(),
    };
  },
};

module.exports = db;
