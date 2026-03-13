import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSpecificClient() {
  const phone = '559291571034';
  console.log(`Buscando cliente com telefone ${phone}...`);
  const { data, error } = await supabase
    .from('clients')
    .select('*');

  if (error) {
      console.error('Erro:', error);
      return;
  }

  const found = data?.find(c => c.phone?.includes('91571034'));
  if (found) {
      console.log('Cliente encontrado:', found.id, found.name, found.phone);
  } else {
      console.log('Cliente NÃO encontrado.');
  }
}

checkSpecificClient();
