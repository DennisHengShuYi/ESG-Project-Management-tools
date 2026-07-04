const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const HOST = `db.${PROJECT_REF}.supabase.co`;

async function run() {
  const client = new Client({ host: HOST, port: 5432, database: 'postgres', user: 'postgres', password: DB_PASSWORD, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cols = await client.query(`select column_name, is_nullable, column_default from information_schema.columns where table_name='organisations' and table_schema='public'`);
  console.log('organisations columns:', JSON.stringify(cols.rows, null, 2));
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
