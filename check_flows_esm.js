import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: flows, error } = await supabase.from('bot_flows').select('id, name, is_active, trigger_keywords');
        if (error) {
            console.error('FLOWS ERROR:', error);
        } else {
            console.log('FLOWS_FOUND:' + JSON.stringify(flows));
        }
        
        const { data: logs, error: logsError } = await supabase.from('debug_logs').select('message, level, created_at').ilike('message', '%Flow%').order('created_at', { ascending: false }).limit(10);
        if (logsError) {
            console.error('LOGS ERROR:', logsError);
        } else {
            console.log('LOGS_FOUND:' + JSON.stringify(logs));
        }
    } catch (e) {
        console.error('ERROR:' + e.message);
    }
}

check();
