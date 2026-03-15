require('dotenv').config({ path: 'c:/Users/User/Downloads/estetica-flow-main/estetica-flow-main/estetica-flow/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('addresses').select('*').limit(1);
  console.log("Addresses error:", error);
  console.log("Addresses data:", data);
}
run();
