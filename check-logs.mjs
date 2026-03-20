import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnVsa3NzbGp4cmpvcWpxcWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxNzMsImV4cCI6MjA4ODExNTE3M30.YZ39BPlcTVomYMWO2410MDBp4rcvjpTu3yDza-cI9IA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: settings } = await supabase
    .from('ai_agent_settings')
    .select('*');

  fs.writeFileSync('agent-settings.json', JSON.stringify(settings, null, 2));
}

check();
