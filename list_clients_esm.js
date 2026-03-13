import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkClients() {
    const { data, error } = await supabase.from('clients').select('id, name, phone, user_id').limit(10);
    if (error) {
        console.error('Error fetching clients:', error);
        return;
    }
    console.log('--- Clients List ---');
    if (!data || data.length === 0) {
        console.log('No clients found (check RLS or table content)');
    } else {
        data.forEach(c => {
            console.log(`ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | UserID: ${c.user_id}`);
        });
    }
}

checkClients();
