import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkCatalog() {
  console.log('Buscando serviços e profissionais...');
  const { data: services } = await supabase.from('services').select('*');
  const { data: pros } = await supabase.from('professionals').select('*');

  console.log('Serviços:');
  services?.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));

  console.log('\nProfissionais:');
  pros?.forEach(p => console.log(`- ${p.name} (ID: ${p.id})`));
}

checkCatalog();
