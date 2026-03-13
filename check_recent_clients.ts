import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkRecentClients() {
  console.log('Buscando clientes recentes...');
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('Clientes:', data?.length);
  data?.forEach(c => console.log(`- ${c.name} (${c.phone}) [User: ${c.user_id}]`));
}

checkRecentClients();
