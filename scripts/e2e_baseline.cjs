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

  const userCount = await client.query(`select count(*) from public.users`);
  console.log('total users:', userCount.rows[0].count);

  const admins = await client.query(`select id, email, created_at from public.users where role='admin'`);
  console.log('admins:', JSON.stringify(admins.rows, null, 2));

  const testLooking = await client.query(`
    select id, email, role, is_active, created_at from public.users
    where email ilike '%test%' or email ilike '%e2e%' or email ilike '%teammate%'
    order by created_at asc
  `);
  console.log('test-looking accounts already present:', JSON.stringify(testLooking.rows, null, 2));

  const eventCount = await client.query(`select count(*) from public.events where deleted_at is null`);
  console.log('active events:', eventCount.rows[0].count);

  const auditCount = await client.query(`select count(*) from public.audit_log`);
  console.log('audit_log rows:', auditCount.rows[0].count);

  const govYears = await client.query(`select distinct reporting_year from public.module_strategy_risk order by reporting_year`);
  console.log('governance years with data:', govYears.rows.map(r => r.reporting_year));

  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
