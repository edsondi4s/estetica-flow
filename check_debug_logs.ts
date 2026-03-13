import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkErrors() {
  const { data } = await supabase
    .from('debug_logs')
    .select('created_at, message, payload')
    .eq('level', 'ERROR')
    .order('created_at', { ascending: false })
    .limit(3);

  data?.forEach(log => {
      console.log(`TIME: ${log.created_at}`);
      console.log(`MSG: ${log.message}`);
      if (log.payload && log.payload.err) console.log(`ERR: ${log.payload.err}`);
      else console.log(`PAYLOAD: ${JSON.stringify(log.payload)}`);
      console.log('---');
  });
}

checkErrors();
