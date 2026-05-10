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
  console.log("Simulating Mandatory Page loading...");
  try {
    const [res1, res2, res3] = await Promise.all([
      supabase.from('schools').select('*').eq('is_active', true).order('school_name'),
      supabase.from('supervisors').select('*, home_school:schools!home_school_id(id, school_name, school_code)').eq('is_active', true).order('name'),
      supabase.from('schools').select('stage')
    ]);

    if (res1.error) console.log("Schools error:", res1.error.message);
    if (res2.error) console.log("Supervisors error:", res2.error.message);
    if (res3.error) console.log("Stages error:", res3.error.message);

    if (!res1.error && !res2.error && !res3.error) {
      console.log(`Success! Schools: ${res1.data.length}, Supervisors: ${res2.data.length}`);
    }
  } catch (e) {
    console.log("Promise.all failed:", e.message);
  }
}
test();
