import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/marketing_worker`;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }
        });
        const text = await response.text();
        const output = {
            status: response.status,
            text
        };
        fs.writeFileSync('worker-test-output.json', JSON.stringify(output, null, 2));
    } catch (e) {
        fs.writeFileSync('worker-test-output.json', JSON.stringify({ error: e.message }));
    }
}

run();
