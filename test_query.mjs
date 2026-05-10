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
  const { data, error } = await supabase.from('supervisors').select('*, home_school:schools!home_school_id(id, school_name)').limit(1);
  if (error) console.error("Error with home_school_id:", error.message);
  else console.log("Success with home_school_id!");
  
  const { data2, error2 } = await supabase.from('supervisors').select('*, home_school:schools!supervisors_home_school_id_fkey(id, school_name)').limit(1);
  if (error2) console.error("Error with supervisors_home_school_id_fkey:", error2.message);
  else console.log("Success with supervisors_home_school_id_fkey!");
}
test();
