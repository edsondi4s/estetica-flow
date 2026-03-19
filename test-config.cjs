const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';
const sp = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: st } = await sp.from('ai_agent_settings').select('*').limit(1).single();
    console.log("Model:", st.ai_model);
    console.log("Prompt:", st.system_prompt);
}
run();
