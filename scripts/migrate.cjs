/**
 * Supabase schema migration — applies supabase/schema.sql via a direct
 * PostgreSQL connection. Reads SUPABASE_URL from backend/.env.
 * Usage: node scripts/migrate.cjs
 */

const { Client } = require('pg');
const fs     = require('fs');
const path   = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD  = process.env.DB_PASSWORD;

if (!SUPABASE_URL) {
  console.error('Set SUPABASE_URL in backend/.env first.');
  process.exit(1);
}
if (!DB_PASSWORD) {
  console.error('Set DB_PASSWORD env var before running: $env:DB_PASSWORD="your-database-password"');
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const HOST = `db.${PROJECT_REF}.supabase.co`;

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');

  const client = new Client({
    host: HOST,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    process.stdout.write(`Connecting to ${HOST}:5432 ... `);
    await client.connect();
    console.log('connected!');

    console.log('Applying schema.sql ...');
    await client.query(schema);
    console.log('Schema applied.');

    await client.end();
    console.log('\nMigration successful! Next: node scripts/reseed_events.js');
  } catch (err) {
    console.log(`failed: ${err.message.split('\n')[0]}`);
    try { await client.end(); } catch {}
    console.error('\nFallback: paste the contents of supabase/schema.sql into the');
    console.error('Supabase SQL Editor at https://supabase.com/dashboard, then run:');
    console.error('  node scripts/reseed_events.js');
    process.exit(1);
  }
}

run();
