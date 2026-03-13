import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testBooking() {
  console.log('Testando agendamento via lógica da IA...');
  
  // Buscar user_id das configurações do agente
  const { data: st } = await supabase.from('ai_agent_settings').select('user_id').limit(1).single();
  if (!st) {
      console.error('Nenhuma configuração de agente encontrada');
      return;
  }

  const { data: client } = await supabase.from('clients').select('id').limit(1).single();
  const { data: service } = await supabase.from('services').select('id').limit(1).single();
  const { data: pro } = await supabase.from('professionals').select('id, name').limit(1).single();

  if (!client || !service || !pro) {
      console.error('Dados insuficientes (cliente, serviço ou profissional faltando)');
      return;
  }

  console.log('Tentando inserir agendamento para user_id:', st.user_id);
  const { data, error } = await supabase.from('appointments').insert({
      user_id: st.user_id,
      client_id: client.id,
      service_id: service.id,
      professional_id: pro.id,
      pro_name: pro.name,
      appointment_date: '2026-10-10',
      appointment_time: '10:00:00',
      status: 'Confirmado'
  }).select().single();

  if (error) {
      console.error('ERRO NO AGENDAMENTO:', error);
  } else {
      console.log('Agendamento realizado com sucesso:', data.id);
  }
}

testBooking();
