import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkFlows() {
  console.log('Verificando fluxos ativos...');
  const { data, error } = await supabase
    .from('bot_flows')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Erro ao buscar fluxos:', error);
    return;
  }

  console.log('Fluxos ativos:', data?.length);
  data?.forEach(f => {
      console.log(`- ${f.name} (Keywords: ${f.trigger_keywords?.join(', ')})`);
  });
}

checkFlows();
