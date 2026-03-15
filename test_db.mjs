import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/User/Downloads/estetica-flow-main/estetica-flow-main/estetica-flow/.env' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('ai_chat_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleted history", error, data);
}
run();
