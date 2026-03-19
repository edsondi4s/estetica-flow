const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: apps } = await sp.from('appointments').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("APPS:");
    console.log(JSON.stringify(apps, null, 2));
}
run();
