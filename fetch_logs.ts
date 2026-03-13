import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = "https://vobulkssljxrjoqjqqcg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnVsa3NzbGp4cmpvcWpxcWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxNzMsImV4cCI6MjA4ODExNTE3M30.YZ39BPlcTVomYMWO2410MDBp4rcvjpTu3yDza-cI9IA";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('debug_logs')
    .select('*')
    .ilike('message', '%Identity%')
    .order('created_at', { ascending: false })
    .limit(100);

  if (data) {
    const lidLogs = data.filter(r => JSON.stringify(r.payload || {}).includes('@lid'));
    fs.writeFileSync('payload_identity.json', JSON.stringify(lidLogs.slice(0, 3), null, 2));
    
    const { data: webhooks } = await supabase
        .from('debug_logs')
        .select('*')
        .ilike('message', '%Webhook%')
        .order('created_at', { ascending: false })
        .limit(100);
        
    const lidWebhooks = (webhooks||[]).filter(r => JSON.stringify(r.payload || {}).includes('@lid'));
    fs.writeFileSync('payload_webhook.json', JSON.stringify(lidWebhooks.slice(0, 3), null, 2));
    console.log("Done");
  }
}
run();
