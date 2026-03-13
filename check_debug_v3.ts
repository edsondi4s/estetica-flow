import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkDebug() {
  const { data } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  data?.forEach(log => {
      console.log(`[${log.created_at}] [${log.level}] ${log.message}`);
      if (log.message.includes('Webhook Received')) {
          console.log('JID:', log.payload?.remoteJid);
      }
      if (log.payload?.err) console.log('ERR:', log.payload.err);
      console.log('---');
  });
}

checkDebug();
