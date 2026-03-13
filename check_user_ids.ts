import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkUserIds() {
  console.log('Buscando User IDs no histórico de chat...');
  const { data, error } = await supabase
    .from('ai_chat_history')
    .select('user_id')
    .limit(10);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  const ids = Array.from(new Set(data?.map(i => i.user_id)));
  console.log('User IDs encontrados:', ids);
}

checkUserIds();
