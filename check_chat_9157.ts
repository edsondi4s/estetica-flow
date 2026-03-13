import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSpecificChat() {
  const phone = '559291571034@s.whatsapp.net';
  console.log(`Buscando chat para ${phone}...`);
  const { data, error } = await supabase
    .from('ai_chat_history')
    .select('*')
    .eq('sender_number', phone)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro:', error);
    return;
  }

  data?.forEach(h => {
      console.log(`[${h.created_at}] [${h.role}] ${h.content}`);
      console.log('---');
  });
}

checkSpecificChat();
