import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkColumns() {
  console.log('Verificando colunas da tabela appointments...');
  
  // Uma forma de pegar as colunas sem ter dados é tentar um insert que falha por erro de sintaxe ou algo assim
  // Ou melhor, usar information_schema se possível, mas via API costuma ser restrito.
  // Vamos tentar um select que pegue os nomes das colunas via query.
  
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .limit(0); // Tira 0 linhas, mas o cabeçalho vem?

  if (error) {
    console.error('Erro:', error);
    return;
  }

  // Infelizmente o supabase-js não retorna as colunas se o array for vazio.
  
  // Vamos tentar inserir um objeto vazio e ver quais colunas dão erro de "missing"
  const { error: insertError } = await supabase.from('appointments').insert({});
  console.log('Erro de inserção vazia (pode revelar colunas obrigatórias):', insertError?.message);
}

checkColumns();
