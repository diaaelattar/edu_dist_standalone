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
  console.log("Testing getAllWishes and getResultsByRun fixes...");
  
  const q1 = supabase.from('supervisor_wishes').select(`
      *,
      supervisor:supervisors!supervisor_id(id, name, specialty),
      school_1:schools!wish_1(id, school_name),
      school_2:schools!wish_2(id, school_name),
      school_3:schools!wish_3(id, school_name),
      school_4:schools!wish_4(id, school_name)
    `);

  const q2 = supabase.from('distribution_results').select(`
      *,
      supervisor:supervisors!supervisor_id(id, name, specialty, stage, school_type),
      school:schools!assigned_school_id(id, school_name, school_code, stage, school_type)
    `);

  const res1 = await q1;
  const res2 = await q2;

  if (res1.error) console.log("Wishes error:", res1.error.message);
  else console.log("Wishes succeeded! Count:", res1.data.length);

  if (res2.error) console.log("Results error:", res2.error.message);
  else console.log("Results succeeded! Count:", res2.data.length);
}
test();
