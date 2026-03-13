import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: settings, error } = await supabase
            .from('ai_agent_settings')
            .select('*');
            
        if (error) throw error;
        console.log('SETTINGS:' + JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('ERROR:' + e.message);
    }
}

check();
