import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkColDetails() {
  console.log('Buscando detalhes da coluna pro_name...');
  // Tentar inserir apenas com pro_name para ver se o erro de falta de colunas obrigatórias revela os nomes
  const { error } = await supabase
    .from('appointments')
    .insert({ pro_name: 'Teste' });

  if (error) {
      console.log('Detecção de erro (esperado):', error.message);
      // O erro pode listar colunas obrigatórias
  }
}

checkColDetails();
