import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log('--- Fetching Error Logs ---');
        const { data: errors, error: err1 } = await supabase
            .from('debug_logs')
            .select('*')
            .eq('level', 'ERROR')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (err1) throw err1;
        console.log('ERRORS:' + JSON.stringify(errors, null, 2));

        console.log('--- Fetching Flow-like Activity ---');
        const { data: flowActivity, error: err2 } = await supabase
            .from('debug_logs')
            .select('*')
            .ilike('message', '%flow%')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (err2) throw err2;
        console.log('FLOW_ACTIVITY:' + JSON.stringify(flowActivity, null, 2));
    } catch (e) {
        console.error('ERROR:' + e.message);
    }
}

check();
