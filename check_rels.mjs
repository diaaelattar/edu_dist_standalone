import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0) env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.rpc('inspect_fks', { table_name: 'supervisors' });
  // Since we don't have this RPC, let's just query the information_schema via a raw SQL query if possible
  // But supabase-js doesn't support raw SQL easily unless we use an RPC.
  
  // Let's try to just check the table structure via another way.
  // Actually, let's just try the query that might be failing.
  
  console.log("Checking for multiple relationships...");
  
  const queries = [
    { name: "Sup -> School", query: supabase.from('supervisors').select('*, schools(*)') },
    { name: "School -> Sup", query: supabase.from('schools').select('*, supervisors(*)') }
  ];
  
  for (const q of queries) {
    const { data, error } = await q.query;
    if (error) {
      console.log(`${q.name} failed: ${error.message}`);
    } else {
      console.log(`${q.name} succeeded!`);
    }
  }
}
test();
