import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkGlobalHistory() {
  console.log('Buscando histórico global de chat...');
  const { data, error } = await supabase
    .from('ai_chat_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  data?.forEach(h => {
      console.log(`[${h.created_at}] [${h.role}] [User: ${h.user_id}] ${h.content}`);
  });
}

checkGlobalHistory();
