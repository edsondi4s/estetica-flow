import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkChatHistory() {
  console.log('Buscando histórico de chat recente...');
  const { data, error } = await supabase
    .from('ai_chat_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return;
  }

  data?.forEach(h => {
      console.log(`[${h.created_at}] [${h.role}] ${h.content}`);
      console.log('---');
  });
}

checkChatHistory();
