import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";
import Anthropic from "npm:@anthropic-ai/sdk@^0.18.0";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logToDb(supabase: any, level: string, message: string, payload?: any, agentSettings?: any) {
    if (agentSettings && agentSettings.enable_logs !== true) {
        if (level !== 'ERROR' && level !== 'CRITICAL') return;
    }
    try {
        await supabase.from('debug_logs').insert({ level, message, payload });
    } catch (e) {
        console.error("Log error:", e);
    }
}

async function sendWhatsApp(supabase: any, settings: any, instance: string, remoteJid: string, text: string) {
    if (settings.provider_type !== 'evolution') return;
    let baseUrl = settings.provider_url || '';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const cleanNumber = remoteJid.split('@')[0];
    const url = `${baseUrl}/message/sendText/${instance}`;
    const segments = text.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
            const waitTime = Math.min(Math.max(segments[i - 1].length * 20, 800), 3000);
            await delay(waitTime);
        }
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': settings.provider_token },
                body: JSON.stringify({ number: cleanNumber, text: segments[i] })
            });
        } catch (e: any) {
            console.error("WhatsApp error:", e.message);
        }
    }
}

function timeToMinutes(timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function proServicesForService(proServicesData: any[], proId: string, serviceId: string): boolean {
    if (!proServicesData || proServicesData.length === 0) return true;
    const proRows = proServicesData.filter((ps: any) => ps.professional_id === proId);
    if (proRows.length === 0) return true;
    return proRows.some((ps: any) => ps.service_id === serviceId);
}

async function handleGetClientAppointments(supabase: any, userId: string, cleanPhone: string) {
    const { data: client } = await supabase.from('clients').select('id, name').eq('phone', cleanPhone).eq('user_id', userId).single();
    if (!client) return { appointments: [], message: "Nenhum cadastro encontrado." };

    const today = new Date().toISOString().split('T')[0];
    const { data: appointments } = await supabase.from('appointments')
        .select('id, appointment_date, appointment_time, status, pro_name, services(name)')
        .eq('client_id', client.id)
        .eq('user_id', userId)
        .in('status', ['Pendente', 'Confirmado'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true });

    if (!appointments || appointments.length === 0) {
        return { appointments: [], message: `${client.name} não possui agendamentos futuros.` };
    }

    const seen = new Set<string>();
    const formatted = appointments
        .filter((a: any) => {
            const key = `${a.appointment_date}_${a.appointment_time?.substring(0, 5)}_${a.pro_name}`;
            if (seen.has(key)) return false;
            seen.add(key); return true;
        })
        .map((a: any) => ({
            id: a.id,
            service: a.services?.name || 'Serviço',
            date: new Date(a.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
            date_iso: a.appointment_date,
            time: a.appointment_time?.substring(0, 5),
            professional: a.pro_name || 'A definir',
            status: a.status
        }));

    return { client_name: client.name, appointments: formatted, message: `Encontrei ${formatted.length} agendamento(s).` };
}

Deno.serve(async (req: Request) => {
    const su = Deno.env.get('SUPABASE_URL')!;
    const sk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(su, sk);

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const instance = payload.instance;
        const msgData = payload.data?.messages?.[0] || payload.data;

        if (!msgData || msgData.key?.fromMe) return new Response('skip', { headers: corsHeaders });

        const sender = msgData.key?.remoteJid;
        const text = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || payload.data?.content || '';

        if (!text) return new Response('no text', { headers: corsHeaders });

        const { data: settings } = await supabase.from('ai_agent_settings').select('*').eq('provider_instance', instance).eq('is_active', true).single();
        if (!settings) return new Response('inactive', { headers: corsHeaders });

        const cleanSender = sender.split('@')[0];
        const msgNorm = text.trim().toUpperCase();

        if (['SIM', 'OK', 'CONFIRMO'].some(k => msgNorm.startsWith(k))) {
            const { data: client } = await supabase.from('clients').select('id').eq('phone', cleanSender).eq('user_id', settings.user_id).single();
            if (client) {
                const today = new Date().toISOString().split('T')[0];
                const { data: appt } = await supabase.from('appointments').select('id').eq('client_id', client.id).eq('reminder_sent', true).gte('appointment_date', today).limit(1).single();
                if (appt) {
                    await supabase.from('appointments').update({ status: 'Confirmado' }).eq('id', appt.id);
                    await sendWhatsApp(supabase, settings, instance, sender, "Confirmado!");
                    return new Response('ok', { headers: corsHeaders });
                }
            }
        }

        const { data: historyData } = await supabase.from('ai_chat_history').select('role,content').eq('sender_number', sender).eq('user_id', settings.user_id).order('created_at', { ascending: false }).limit(20);
        const history = (historyData || []).filter((h: any) => h.role === 'user' || h.role === 'assistant').reverse();

        const [kb, serv, hrs, proD] = await Promise.all([
            supabase.from('ai_knowledge_base').select('content').eq('user_id', settings.user_id),
            supabase.from('services').select('*').eq('user_id', settings.user_id).eq('is_active', true),
            supabase.from('business_hours').select('*').eq('user_id', settings.user_id),
            supabase.from('professionals').select('*').eq('user_id', settings.user_id).eq('is_active', true)
        ]);

        const context = `Contexto:\nServiços: ${JSON.stringify(serv.data)}\nHorários: ${JSON.stringify(hrs.data)}\nProfissionais: ${JSON.stringify(proD.data)}\nInfo: ${kb.data?.map(k => k.content).join(' ')}`;
        const systemPrompt = `${settings.system_prompt}\n${context}\nHoje é ${new Date().toISOString().split('T')[0]}. Remova asteriscos (*) das respostas.`;

        const aiClient = new OpenAI({ apiKey: settings.ai_api_key, baseURL: settings.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined });
        const aiModel = settings.ai_model || 'gpt-4o-mini';

        await logToDb(supabase, 'INFO', 'Iniciando chamada IA', { model: aiModel, provider: settings.ai_provider, historyCount: history.length, sender: cleanSender }, settings);

        let response = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }] as any
        });

        let aiText = response.choices[0].message.content || '';
        const IS_PENDING = /aguarde|momento|instante/i;

        if (IS_PENDING.test(aiText)) {
            const isCancel = /\b(cancelar|desmarcar)\b/i.test(text);
            const isList = /\b(ver|meus|quais)\b/i.test(text);
            if (isCancel || isList) {
                await logToDb(supabase, 'WARN', 'Fallback de Intent acionado', { text: aiText }, settings);
                const appts = await handleGetClientAppointments(supabase, settings.user_id, cleanSender);
                if (appts.appointments.length > 0) {
                    const secondRes = await aiClient.chat.completions.create({
                        model: aiModel,
                        messages: [{ role: 'system', content: `${systemPrompt}\n\nDados Reais: ${JSON.stringify(appts)}` }, ...history, { role: 'user', content: text }] as any
                    });
                    aiText = secondRes.choices[0].message.content || aiText;
                }
            }
        }

        aiText = aiText.replace(/\*/g, '').trim();
        await supabase.from('ai_chat_history').insert([{ user_id: settings.user_id, sender_number: sender, role: 'user', content: text }, { user_id: settings.user_id, sender_number: sender, role: 'assistant', content: aiText }]);
        await sendWhatsApp(supabase, settings, instance, sender, aiText);

        return new Response('ok', { headers: corsHeaders });
    } catch (e: any) {
        console.error("Critical error:", e.message);
        try {
            await supabase.from('debug_logs').insert({ level: 'ERROR', message: "Erro crítico no webhook", payload: { error: e.message, stack: e.stack } });
        } catch (lE) { console.error("Log failed", lE); }
        return new Response(e.message, { status: 500, headers: corsHeaders });
    }
});
