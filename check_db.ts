
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to find .env or use defaults from lib/supabase.ts
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('VITE_SUPABASE_ANON_KEY not found');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Checking Columns for appointments ---');
    const { data: cols, error: colError } = await supabase
        .from('appointments')
        .select('*')
        .limit(1);

    if (colError) {
        console.error('Error fetching appointments:', colError);
    } else if (cols && cols.length > 0) {
        console.log('Columns in appointments:', Object.keys(cols[0]));
    } else {
        console.log('No data in appointments to infer columns.');
    }

    console.log('\n--- Checking Buckets ---');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
        console.error('Error listing buckets:', bucketError);
    } else {
        console.log('Available buckets:', buckets.map(b => b.name));
    }
}

checkSchema();
