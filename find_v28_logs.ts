import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function findV28Logs() {
  console.log('Buscando logs de v28...');
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .ilike('message', '%v28%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
      console.log('Nenhum log de v28 encontrado.');
      return;
  }

  data.forEach(log => {
      console.log(`[${log.created_at}] [${log.level}] ${log.message}`);
      console.log('Payload:', JSON.stringify(log.payload));
      console.log('---');
  });
}

findV28Logs();
