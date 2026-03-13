import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking Bot Flows ---');
    const { data: flows, error: flowsError } = await supabase
        .from('bot_flows')
        .select('id, name, is_active, trigger_keywords');
    
    if (flowsError) {
        console.error('Error fetching flows:', flowsError);
    } else {
        console.log(`Found ${flows?.length || 0} flows:`);
        flows?.forEach(f => console.log(`- ${f.name} (Active: ${f.is_active}, Triggers: ${f.trigger_keywords})`));
    }

    console.log('\n--- Checking Recent Debug Logs (Flow related) ---');
    const { data: logs, error: logsError } = await supabase
        .from('debug_logs')
        .select('*')
        .ilike('message', '%Flow%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (logsError) {
        console.error('Error fetching logs:', logsError);
    } else {
        console.log(`Recent Flow Logs:`);
        logs?.forEach(l => console.log(`[${l.created_at}] ${l.level}: ${l.message}`));
    }
}

check();
