import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkHistoryDetails() {
  console.log('Buscando detalhes do histórico...');
  const { data } = await supabase
    .from('ai_chat_history')
    .select('*')
    .limit(1);

  if (data && data.length > 0) {
      console.log('Mensagem encontrada:', data[0].content);
      console.log('User ID:', data[0].user_id);
  }
}

checkHistoryDetails();
