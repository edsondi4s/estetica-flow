import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkIds() {
  console.log('Buscando dados com ANON_KEY...');
  const { data: settings } = await supabase.from('ai_agent_settings').select('*');
  const { data: pros } = await supabase.from('professionals').select('*');
  const { data: svcs } = await supabase.from('services').select('*');

  console.log('Settings:', settings?.length);
  console.log('Pros:', pros?.length);
  console.log('Svcs:', svcs?.length);
  
  if (settings && settings.length > 0) {
      console.log('User ID from Settings:', settings[0].user_id);
  }
}

checkIds();
