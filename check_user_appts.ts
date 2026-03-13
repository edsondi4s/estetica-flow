import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkUserAppts() {
  const userId = '0c64bd71-47d6-4116-a02a-af2589ecb27d';
  console.log(`Buscando agendamentos para o usuário ${userId}...`);
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .limit(10);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('Agendamentos encontrados:', data?.length);
  data?.forEach(a => {
      console.log(`- ${a.appointment_date} ${a.appointment_time} Status: ${a.status}`);
  });
}

checkUserAppts();
