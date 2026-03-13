import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkAllLogs() {
  console.log('Buscando os 50 logs mais recentes...');
  const { data, error } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro ao buscar logs:', error);
    return;
  }

  const output = data?.map(log => {
      let payloadStr = '';
      try {
          payloadStr = JSON.stringify(log.payload);
      } catch (e) {
          payloadStr = '[Circular or invalid payload]';
      }
      return `[${log.created_at}] [${log.level}] ${log.message} | Payload: ${payloadStr}`;
  }).join('\n');

  console.log(output);
}

checkAllLogs();
