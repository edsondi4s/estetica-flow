const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: msgs } = await sp.from('ai_chat_history').select('*').order('created_at', { ascending: false }).limit(6);
    console.log(JSON.stringify(msgs, null, 2));
}
run();
