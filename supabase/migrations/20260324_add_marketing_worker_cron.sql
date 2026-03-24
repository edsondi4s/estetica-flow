-- Configure pg_cron to call the marketing_worker every 1 minute
-- This requires pg_net and pg_cron extensions to be enabled (which they typically are in Supabase)

-- First, ensure the pg_net extension is enabled (might fail if not superuser, but Supabase enables by default)
create extension if not exists pg_net;

-- Create a cron job to call the edge function every 1 minute
select
  cron.schedule(
    'marketing-worker-every-1-min',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://vobulkssljxrjoqjqqcg.supabase.co/functions/v1/marketing_worker',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnVsa3NzbGp4cmpvcWpxcWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxNzMsImV4cCI6MjA4ODExNTE3M30.YZ39BPlcTVomYMWO2410MDBp4rcvjpTu3yDza-cI9IA"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
  );
