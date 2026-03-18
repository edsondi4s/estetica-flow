import fs from 'fs';
const url = "https://vobulkssljxrjoqjqqcg.supabase.co/functions/v1/recovery_worker";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnVsa3NzbGp4cmpvcWpxcWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxNzMsImV4cCI6MjA4ODExNTE3M30.YZ39BPlcTVomYMWO2410MDBp4rcvjpTu3yDza-cI9IA";

async function run() {
    console.log("Chamando recovery_worker...");
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${anonKey}`,
            "Content-Type": "application/json"
        }
    });
    const text = await res.text();
    fs.writeFileSync('recovery-out.json', text);
    console.log("Saved to recovery-out.json");
}

run();
