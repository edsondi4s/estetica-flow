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
            .ilike('message', 'Webhook Received%')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        logs?.forEach(l => {
            console.log(`[${l.created_at}] Payload:`, JSON.stringify(l.payload, null, 2));
            const msg = l.payload?.full?.message?.conversation || l.payload?.full?.message?.extendedTextMessage?.text || '';
            console.log(`>>> Text Captured: "${msg}"`);
        });
    } catch (e) {
        console.error('ERROR:' + e.message);
    }
}

check();
