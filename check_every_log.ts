import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkEveryLog() {
  console.log('Buscando os 100 logs mais recentes (sem filtros)...');
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  data?.forEach(log => {
      console.log(`[${log.created_at}] [${log.level}] ${log.message}`);
      if (log.payload) {
          const p = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload);
          if (p.includes('err') || p.includes('Erro') || p.includes('fail')) {
              console.log('  PAYLOAD DETECTADO:', p.substring(0, 200));
          }
      }
  });
}

checkEveryLog();
