import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkAllSettings() {
  const { data, error } = await supabase
    .from('ai_agent_settings')
    .select('*');

  if (error) {
      console.error('Erro:', error);
      return;
  }

  console.log('Todas as Settings (Total: ' + (data?.length || 0) + '):');
  data?.forEach(s => {
      console.log(`- ID: ${s.id}, Instance: ${s.provider_instance}, Active: ${s.is_active}, User: ${s.user_id}`);
  });
}

checkAllSettings();
