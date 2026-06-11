/**
 * Supabase migration script — runs schema.sql then seed_dummy.sql.
 * Uses direct PostgreSQL connection on port 5432.
 * Usage: node scripts/migrate.cjs
 */

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PROJECT_REF = 'rvndetvetovcnaievyoq';
const DB_PASSWORD = process.env.DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error('Set DB_PASSWORD env var before running: $env:DB_PASSWORD="your-password"');
  process.exit(1);
}

const HOSTS = [
  `db.${PROJECT_REF}.supabase.co`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
];

async function run() {
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const seedPath   = path.join(__dirname, '..', 'supabase', 'seed_dummy.sql');
  const schema     = fs.readFileSync(schemaPath, 'utf8');
  const seed       = fs.readFileSync(seedPath,   'utf8');

  let lastErr = null;

  for (const host of HOSTS) {
    const users = host.includes('pooler')
      ? [`postgres.${PROJECT_REF}`]
      : ['postgres'];

    for (const user of users) {
      const client = new Client({
        host,
        port: 5432,
        database: 'postgres',
        user,
        password: DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });

      try {
        process.stdout.write(`Trying ${user}@${host}:5432 ... `);
        await client.connect();
        console.log('connected!');

        console.log('Applying schema.sql ...');
        await client.query(schema);
        console.log('Schema applied.');

        console.log('Running seed_dummy.sql ...');
        await client.query(seed);
        console.log('Seed complete.');

        await client.end();
        console.log('\nMigration successful!');
        return;
      } catch (err) {
        lastErr = err;
        console.log(`failed: ${err.message.split('\n')[0]}`);
        try { await client.end(); } catch {}
      }
    }
  }

  console.error('\nAll connection attempts failed.');
  console.error('Last error:', lastErr?.message);
  console.error('\nFallback: paste supabase/schema.sql then supabase/seed_dummy.sql');
  console.error('into the Supabase SQL Editor at https://supabase.com/dashboard');
  process.exit(1);
}

run();
