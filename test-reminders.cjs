const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching logs...");
    const { data: logs } = await sp.from('debug_logs').select('*').order('created_at', { ascending: false }).limit(20);
    console.log("LOGS:");
    console.log(JSON.stringify(logs, null, 2));

    const todayStr = new Date().toISOString().split('T')[0];
    const { data: apps } = await sp.from('appointments').select('*').eq('appointment_date', todayStr);
    console.log("TODAY APPS count (requires auth so maybe empty with anon key? let's see):");
    console.log(apps ? apps.length : apps);

    // Call the edge function manually
    console.log("Invoking reminders_worker...");
    const { data: edgeRes, error: edgeErr } = await sp.functions.invoke('reminders_worker');
    if (edgeErr) console.error("Edge Function Error:", edgeErr);
    else console.log("Edge Function Response:", edgeRes);
}
run();
