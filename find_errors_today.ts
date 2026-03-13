import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function findError() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Buscando erros de hoje:', today);
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .eq('level', 'ERROR')
    .gte('created_at', today)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
      console.log('Nenhum erro encontrado hoje.');
      return;
  }

  data.forEach(log => {
      console.log(`[${log.created_at}] ${log.message}`);
      console.log('ERR Detail:', log.payload?.err || JSON.stringify(log.payload));
      console.log('---');
  });
}

findError();
