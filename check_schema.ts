import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase
    .rpc('get_table_schema', { table_name: 'appointments' });

  if (error) {
    // If RPC doesn't exist, try another way
    const { data: cols, error: err2 } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (err2) {
      console.error('Erro ao buscar colunas:', err2);
      return;
    }
    console.log('Colunas detectadas:', Object.keys(cols[0] || {}));
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
