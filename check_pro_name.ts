import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkProName() {
  console.log('Verificando se a coluna pro_name existe em appointments...');
  
  // Tentar um select de apenas pro_name
  const { data, error } = await supabase
    .from('appointments')
    .select('pro_name')
    .limit(1);

  if (error) {
    console.log('ERRO ao buscar pro_name (provavelmente não existe):', error.message);
  } else {
    console.log('Coluna pro_name EXISTE.');
  }
}

checkProName();
