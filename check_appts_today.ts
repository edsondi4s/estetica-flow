import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkAppts() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Buscando agendamentos de hoje:', today);
  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, appointment_time, status, client_id, professional_id')
    .gte('appointment_date', today);

  if (error) {
      console.error('Erro:', error.message);
      return;
  }

  console.log('Agendamentos hoje:', data?.length);
  data?.forEach(a => {
      console.log(`- ID: ${a.id}, Hora: ${a.appointment_time}, Status: ${a.status}`);
  });
}

checkAppts();
