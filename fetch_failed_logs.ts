import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = "https://vobulkssljxrjoqjqqcg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnVsa3NzbGp4cmpvcWpxcWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxNzMsImV4cCI6MjA4ODExNTE3M30.YZ39BPlcTVomYMWO2410MDBp4rcvjpTu3yDza-cI9IA";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  fs.writeFileSync('failed_log.json', JSON.stringify(data, null, 2));
  console.log("Written failed_log.json");
}
run();
