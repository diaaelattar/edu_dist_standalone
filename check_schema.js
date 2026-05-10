require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('Checking columns for table: schools');
  
  // Use a query that fetches column info from postgres via rpc or just fetch 1 row
  // Note: we can't easily query information_schema from REST API.
  // Instead, let's just do a SELECT * LIMIT 1 and see the keys.
  const { data, error } = await supabase.from('schools').select('*').limit(1);
  
  if (error) {
    console.error('Error querying schools:', error.message);
  } else {
    if (data.length > 0) {
      console.log('Columns in schools table:', Object.keys(data[0]));
    } else {
      console.log('Table is empty, trying to insert a dummy to see schema error or just ignoring.');
    }
  }
}

checkSchema();
