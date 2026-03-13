import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkTuesday() {
  const date = '2026-03-17';
  console.log(`Buscando agendamentos para ${date}...`);
  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, appointment_time, status, client_id, professional_id')
    .eq('appointment_date', date);

  if (error) {
      console.error('Erro:', error.message);
      return;
  }

  console.log('Agendamentos:', data?.length);
  data?.forEach(a => {
      console.log(`- ID: ${a.id}, Hora: ${a.appointment_time}, Status: ${a.status}`);
  });
}

checkTuesday();
