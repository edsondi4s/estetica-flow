import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logDb(sp: any, lv: string, msg: string, p?: any) {
    try { await sp.from('debug_logs').insert({ level: lv, message: msg, payload: p }); } catch (e) {}
}

async function sendWhatsApp(sp: any, type: string, baseUrlRaw: string, inst: string, token: string, jid: string, content: string) {
    if (type !== 'evolution' && type !== 'zapi') return false;
    let baseUrl = (baseUrlRaw || '').replace(/\/$/, '');
    const cleanNumber = jid.split('@')[0];
    const headers = { 'Content-Type': 'application/json', 'apikey': token };
    const url = `${baseUrl}/message/sendText/${inst}`;
    const segs = content.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    let success = true;
    for (const s of segs) {
        try {
            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ number: cleanNumber, text: s }) });
            if (!response.ok) {
               success = false;
               logDb(sp, 'ERROR', "Erro HTTP WhatsApp Recovery", { status: response.status, statusText: response.statusText });
            }
        } catch (err: any) { 
            success = false;
            logDb(sp, 'ERROR', "Erro Fetch WhatsApp Recovery", { err: err.message }); 
        }
        await new Promise(r => setTimeout(r, 600));
    }
    return success;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(JSON.stringify({ error: 'Configuração do Supabase ausente' }), { status: 500, headers: corsHeaders });
    }

    const sp = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data: aiSettings, error: setErr } = await sp.from('ai_agent_settings').select('*').eq('agent_role', 'recuperacao').eq('is_active', true);
        if (setErr || !aiSettings || aiSettings.length === 0) {
            return new Response(JSON.stringify({ message: 'Nenhuma config ativa.' }), { headers: corsHeaders });
        }

        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
        let totalRecoveries = 0;
        let debugLog: any[] = [];

        for (const st of aiSettings) {
            const recoveryMins = st.recovery_minutes || 30;

            const { data: rawChats } = await sp
                .from('ai_chat_history')
                .select('id, user_id, sender_number, role, content, created_at')
                .eq('user_id', st.user_id)
                .gte('created_at', twoHoursAgo)
                .order('created_at', { ascending: false });

            debugLog.push({ action: 'fetch_chats', count: rawChats?.length || 0, user_id: st.user_id, recoveryMins });

            if (!rawChats || rawChats.length === 0) continue;

            const groups: Record<string, any[]> = {};
            for (const c of rawChats) {
                if (!groups[c.sender_number]) groups[c.sender_number] = [];
                groups[c.sender_number].push(c);
            }

            for (const sender_number in groups) {
                const msgs = groups[sender_number];
                if (msgs.length < 2) continue;

                const lastMsg = msgs[0];

                debugLog.push({ sender: sender_number, lastRole: lastMsg.role, lastContent: lastMsg.content });

                if (lastMsg.role === 'assistant') {
                    const userMsgIndex = msgs.findIndex(m => m.role === 'user');
                    if (userMsgIndex === -1) {
                         debugLog.push({ sender: sender_number, skip: 'No user message found' });
                         continue;
                    }
                    
                    const prevUserMsg = msgs[userMsgIndex];
                    const lastMsgDate = new Date(lastMsg.created_at);
                    const diffMins = Math.floor((now.getTime() - lastMsgDate.getTime()) / 60000);

                    debugLog.push({ sender: sender_number, diffMins, recoveryMins });

                    if (diffMins >= recoveryMins && diffMins <= 120) {
                        const contentLower = lastMsg.content.toLowerCase();
                        
                        // Verifica se a última mensagem do assistente soava como uma pergunta de agendamento:
                        const isQuestionPattern = /\?/.test(contentLower) && /(agend|marc|hor[aá]|dia|data|servi[cç]|qual|quando)/.test(contentLower);

                        debugLog.push({ sender: sender_number, isQuestionPattern });

                        if (isQuestionPattern) {
                            const ai = new OpenAI({ 
                                apiKey: st.ai_api_key || st.openai_api_key, 
                                baseURL: st.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined 
                            });
                            
                            const prompt = `Você é o assistente virtual da clínica. O cliente da conversa abaixo parou de responder há ${diffMins} minutos durante a tentativa de agendamento e abandonou a conversa.
Sua missão: Mande APENAS UMA ÚNICA mensagem curta (1 frase) de engajamento empático, perguntando se ele gostaria de continuar o agendamento ou se teve alguma dúvida, para reativar o atendimento. 
Não use formalidade ou gírias extremas.
Aqui está o final da conversa interrompida:
Cliente: "${prevUserMsg.content}"
Você: "${lastMsg.content}"

(Gere APENAS o texto da mensagem que será enviada diretamente pro WhatsApp dele. Nenhuma formatação extra. Pense no cliente inativo que você está querendo trazer de volta).`;

                            try {
                                const aiRes = await ai.chat.completions.create({
                                    model: st.ai_model || 'gpt-4o-mini',
                                    messages: [{ role: 'system', content: prompt }],
                                    max_tokens: 150
                                });
                                
                                const recoveryTxt = aiRes.choices[0].message.content?.trim();
                                
                                if (recoveryTxt) {
                                    const { data: globalSettings } = await sp.from('settings').select('*').eq('user_id', st.user_id).single();
                                    const { data: primaryAgent } = await sp.from('ai_agent_settings')
                                        .select('provider_type, provider_url, provider_token, provider_instance')
                                        .eq('user_id', st.user_id)
                                        .not('provider_type', 'is', null)
                                        .limit(1)
                                        .single();

                                    const pType = st.provider_type || primaryAgent?.provider_type || globalSettings?.whatsapp_provider_type;
                                    const pUrl = st.provider_url || primaryAgent?.provider_url || globalSettings?.whatsapp_provider_url; 
                                    const pToken = st.provider_token || primaryAgent?.provider_token || globalSettings?.whatsapp_provider_token;
                                    const pInst = st.provider_instance || primaryAgent?.provider_instance || globalSettings?.whatsapp_provider_instance;
                                    
                                    debugLog.push({ sender: sender_number, pType, pInst, sentRecovery: !!recoveryTxt });

                                    if (pType && pUrl && pToken && pInst) {
                                        const sent = await sendWhatsApp(sp, pType, pUrl, pInst, pToken, sender_number, recoveryTxt);
                                        debugLog.push({ sender: sender_number, whatsappSentSuccess: sent });
                                        if (sent) {
                                            await sp.from('ai_chat_history').insert({
                                                user_id: st.user_id,
                                                sender_number: sender_number,
                                                role: 'assistant',
                                                content: recoveryTxt
                                            });
                                            totalRecoveries++;
                                            await logDb(sp, 'INFO', `Recovery Worker enviou mensagem de resgate para ${sender_number}`);
                                        }
                                    } else {
                                        await logDb(sp, 'ERROR', 'Recovery Worker sem credencias do WhatsApp configuradas para o usuario', { user_id: st.user_id });
                                    }
                                }
                            } catch (e: any) {
                                await logDb(sp, 'ERROR', 'Recovery OpenAI Error', {err: e.message});
                            }
                        }
                    }
                }
            }
        }

        return new Response(JSON.stringify({ success: true, recoveries: totalRecoveries, debug: debugLog }), { headers: corsHeaders });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
