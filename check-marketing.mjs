import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const sp = createClient(url, key);

async function check() {
    const { data: promos } = await sp.from('promotions').select('*').order('created_at', { ascending: false }).limit(5);
    const { data: logs } = await sp.from('debug_logs').select('*').order('created_at', { ascending: false }).limit(5);
    const out = { promos, logs, now: new Date().toISOString() };
    fs.writeFileSync('marketing-check-out.json', JSON.stringify(out, null, 2));
}

check();
