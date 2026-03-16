ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Ativação das extensões necessárias (apenas funciona no plano Pro nativo do Supabase via Dashboard, 
-- mas deixamos preparado para projetos locais ou planos que suportam pg_cron).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- (Opcional) Função para ajudar no agendamento manual se o usuário desejar via SQL:
-- select cron.schedule('reminders-job', '*/5 * * * *', $$ select net.http_post(url:='https://<sua-url>/functions/v1/reminders_worker', headers:='{"Authorization": "Bearer <SEU_ANON_KEY>"}') $$);
