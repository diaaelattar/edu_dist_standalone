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
  console.log("Testing specific relationship fixes...");
  
  const queries = [
    { name: "Sup -> School (FIXED)", query: supabase.from('supervisors').select('*, schools!home_school_id(*)') },
    { name: "School -> Sup (FIXED)", query: supabase.from('schools').select('*, supervisors!mandatory_supervisor_id(*)') }
  ];
  
  for (const q of queries) {
    const { data, error } = await q.query;
    if (error) {
      console.log(`${q.name} failed: ${error.message}`);
    } else {
      console.log(`${q.name} succeeded! Count: ${data.length}`);
    }
  }
}
test();
