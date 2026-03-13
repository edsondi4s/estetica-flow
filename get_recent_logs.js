import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: logs, error } = await supabase
            .from('debug_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        console.log('LOGS:' + JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error('ERROR:' + e.message);
    }
}

check();
