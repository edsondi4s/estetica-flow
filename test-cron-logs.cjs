const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: logs } = await sp.from('debug_logs').select('*').in('level', ['ERROR', 'WARN', 'INFO']).order('created_at', { ascending: false }).limit(20);
    console.log("LOGS:");
    console.log(JSON.stringify(logs, null, 2));

    const todayStr = new Date().toISOString().split('T')[0];
    const { data: apps } = await sp.from('appointments').select('*').eq('appointment_date', todayStr);
    console.log("APPS:");
    console.log(JSON.stringify(apps, null, 2));
}
run();
