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
  console.log("Calling getAllSupervisors logic...");
  const { data, error } = await supabase
    .from('supervisors')
    .select('*, home_school:schools!home_school_id(id, school_name, school_code)')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.log(`Failed: ${error.message}`);
  } else {
    console.log(`Succeeded! Count: ${data.length}`);
  }
}
test();
