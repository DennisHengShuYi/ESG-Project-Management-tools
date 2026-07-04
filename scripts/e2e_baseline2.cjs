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

  const notE2E = await client.query(`
    select id, email, role, is_active, created_at from public.users
    where email not ilike '%e2e%'
    order by created_at asc
  `);
  console.log('Non-e2e-pattern accounts (candidates for "real" users):', JSON.stringify(notE2E.rows, null, 2));

  const e2eCount = await client.query(`select count(*) from public.users where email ilike '%e2e%'`);
  console.log('e2e-pattern account count:', e2eCount.rows[0].count);

  const events = await client.query(`select id, event_name, client_name, created_at from public.events where deleted_at is null order by created_at asc`);
  console.log('all active events:', JSON.stringify(events.rows, null, 2));

  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
