ALTER TABLE public.ai_agent_settings 
ADD COLUMN IF NOT EXISTS recovery_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS recovery_minutes INTEGER DEFAULT 30;
