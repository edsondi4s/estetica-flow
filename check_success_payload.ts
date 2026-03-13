import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSuccessPayload() {
  console.log('Buscando payload do log de sucesso...');
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .ilike('message', '%SuccessApp%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
      console.log('Log encontrado:', data[0].message);
      console.log('Payload:', JSON.stringify(data[0].payload, null, 2));
  } else {
      console.log('Nenhum log de SuccessApp encontrado.');
  }
}

checkSuccessPayload();
