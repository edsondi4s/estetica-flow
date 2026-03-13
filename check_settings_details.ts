import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSettings() {
  const { data } = await supabase
    .from('ai_agent_settings')
    .select('*')
    .eq('is_active', true);

  console.log('Settings Ativas:');
  data?.forEach(s => {
      console.log(`- ID: ${s.id}, Instance: ${s.provider_instance}, Provider: ${s.provider_type}`);
  });
}

checkSettings();
