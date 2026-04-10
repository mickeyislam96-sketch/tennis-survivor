import pg from 'pg';

const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('railway');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tennis_survivor',
  max: 10,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Ensure UTF-8 encoding on every new connection to prevent double-encoding of Unicode characters
pool.on('connect', (client) => {
  client.query("SET client_encoding = 'UTF8'");
});

export { pool };
