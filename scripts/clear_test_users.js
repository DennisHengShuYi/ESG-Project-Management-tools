import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Fetching all users to identify test accounts...');
  const { data: users, error: fetchErr } = await supabase
    .from('users')
    .select('id, email, role, created_at');

  if (fetchErr) {
    console.error('Error fetching users:', fetchErr.message);
    process.exit(1);
  }

  // Filter test users by typical patterns: e2e, test, teammate
  const testUsers = users.filter(u => {
    const email = (u.email || '').toLowerCase();
    return email.includes('test') || email.includes('e2e') || email.includes('teammate');
  });

  console.log(`Found ${testUsers.length} test-looking user(s) out of ${users.length} total user(s).`);

  if (testUsers.length === 0) {
    console.log('No test user accounts found to clear.');
    return;
  }

  console.log('\nUsers to be deleted:');
  testUsers.forEach(u => console.log(`- [${u.id}] ${u.email} (Created: ${u.created_at})`));

  console.log('\nDeleting audit logs and test users...');
  for (const u of testUsers) {
    // 1. Delete dependent audit logs first
    const { error: auditErr } = await supabase
      .from('audit_log')
      .delete()
      .eq('user_id', u.id);

    if (auditErr) {
      console.error(`Failed to delete audit logs for ${u.email}:`, auditErr.message);
      continue;
    }

    // 2. Delete the user
    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', u.id);

    if (delErr) {
      console.error(`Failed to delete user ${u.email}:`, delErr.message);
    } else {
      console.log(`Successfully deleted user and audit logs for ${u.email}`);
    }
  }

  console.log('\nTest users clean up complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
