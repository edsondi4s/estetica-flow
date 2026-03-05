-- Create ai_agent_settings table
CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT false,
    name TEXT NOT NULL DEFAULT 'Assistente Virtual',
    system_prompt TEXT,
    provider_type TEXT,
    provider_instance TEXT,
    provider_token TEXT,
    openai_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai agent settings"
    ON public.ai_agent_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai agent settings"
    ON public.ai_agent_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai agent settings"
    ON public.ai_agent_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai agent settings"
    ON public.ai_agent_settings FOR DELETE
    USING (auth.uid() = user_id);

-- Create ai_knowledge_base table
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own knowledge base"
    ON public.ai_knowledge_base FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge base"
    ON public.ai_knowledge_base FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge base"
    ON public.ai_knowledge_base FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge base"
    ON public.ai_knowledge_base FOR DELETE
    USING (auth.uid() = user_id);
