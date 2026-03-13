import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkNotifications() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Buscando notificações de hoje:', today);
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .gte('created_at', today);

  if (error) {
      console.error('Erro:', error.message);
      return;
  }

  console.log('Notificações hoje:', data?.length);
  data?.forEach(n => {
      console.log(`- [${n.created_at}] ${n.title}: ${n.message}`);
  });
}

checkNotifications();
