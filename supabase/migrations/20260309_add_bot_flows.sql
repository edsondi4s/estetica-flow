-- Create bot_flows table for visual flow definition
CREATE TABLE IF NOT EXISTS public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_keywords TEXT[] DEFAULT '{}',
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bot flows"
    ON public.bot_flows FOR ALL
    USING (auth.uid() = user_id);

-- Create bot_flow_states for session management
CREATE TABLE IF NOT EXISTS public.bot_flow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_id UUID REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    client_phone TEXT NOT NULL,
    current_node_id TEXT,
    collected_data JSONB DEFAULT '{}',
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, client_phone)
);

ALTER TABLE public.bot_flow_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bot flow states"
    ON public.bot_flow_states FOR ALL
    USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_bot_flows
    BEFORE UPDATE ON public.bot_flows
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_bot_flow_states
    BEFORE UPDATE ON public.bot_flow_states
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
