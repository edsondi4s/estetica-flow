import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkGlobalAppts() {
  console.log('Buscando agendamentos globais...');
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('Agendamentos:', data?.length);
  data?.forEach(a => console.log(`- [${a.created_at}] User: ${a.user_id}, Date: ${a.appointment_date}, Status: ${a.status}`));
}

checkGlobalAppts();
