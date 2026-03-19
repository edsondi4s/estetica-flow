const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: logs } = await sp.from('debug_logs').select('*').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(logs, null, 2));
}
run();
