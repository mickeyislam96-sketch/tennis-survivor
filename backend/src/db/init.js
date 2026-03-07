import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tennis_survivor'
  });
  await client.connect();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(schema);
  console.log('Schema applied.');
  await client.end();
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});
