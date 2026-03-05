
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vobulkssljxrjoqjqqcg.supabase.co';
const supabaseKey = 'sb_publishable_gUyu-gJlN5SjprEX3BPn5Q_-tSAD_kF';

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
