import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logDb(sp: any, lv: string, msg: string, p?: any) {
    try { await sp.from('debug_logs').insert({ level: lv, message: msg, payload: p }); } catch (e) {}
}

async function sendWhatsApp(sp: any, st: any, inst: string, jid: string, content: string | { url: string, type: 'image' | 'audio', caption?: string }) {
    if (st.provider_type !== 'evolution') return;
    let baseUrl = (st.provider_url || '').replace(/\/$/, '');
    const cleanNumber = jid.split('@')[0];
    const headers = { 'Content-Type': 'application/json', 'apikey': st.provider_token };

    if (typeof content === 'object') {
        const endpoint = content.type === 'image' ? 'sendImage' : 'sendAudio';
        const url = `${baseUrl}/message/${endpoint}/${instance}`;
        const body: any = { number: cleanNumber };
        if (content.type === 'image') {
            body.image = content.url;
            if (content.caption) body.caption = content.caption;
        } else {
            body.audio = content.url;
        }
        try {
            await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        } catch (e: any) { logDb(sp, 'ERROR', `WhatsApp ${content.type} error`, { err: e.message }); }
        return;
    }

    const url = `${baseUrl}/message/sendText/${inst}`;
    const segs = content.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    for (const s of segs) {
        try {
            await fetch(url, { method: 'POST', headers, body: JSON.stringify({ number: cleanNumber, text: s }) });
        } catch (err: any) { logDb(sp, 'ERROR', "Erro WhatsApp Fetch", { err: err.message }); }
        await new Promise(r => setTimeout(r, 600));
    }
}

const toSec = (t: string) => {
    const [h, m, s] = t.split(':').map(Number);
    return (h * 3600) + (m * 60) + (s || 0);
};

const toTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

async function findClientByPhone(supabase: any, userId: string, rawPhone: string) {
    const cleanWhatsApp = rawPhone.replace(/\D/g, '');
    const searchTarget = (cleanWhatsApp.startsWith('55') && (cleanWhatsApp.length === 12 || cleanWhatsApp.length === 13))
        ? cleanWhatsApp.substring(2)
        : cleanWhatsApp;

    const { data: clients } = await supabase.from('clients').select('id, name, phone').eq('user_id', userId);
    if (!clients) return null;

    return clients.find((c: any) => {
        if (!c.phone) return false;
        const cleanDb = c.phone.replace(/\D/g, '');
        const dbTarget = (cleanDb.startsWith('55') && (cleanDb.length === 12 || cleanDb.length === 13))
            ? cleanDb.substring(2)
            : cleanDb;
        return dbTarget === searchTarget || (dbTarget.slice(-8) === searchTarget.slice(-8) && searchTarget.length >= 8);
    });
}

async function checkCollision(sp: any, uid: string, propId: string, date: string, time: string, svcId: string, svcs: any[], excludeApptId?: string) {
    const tFmt = (time.length === 5) ? time + ":00" : time;
    const requestedStart = toSec(tFmt);
    const svc = (svcs || []).find(s => s.id === svcId);
    const duration = (svc?.duration_minutes || 60) * 60;
    const requestedEnd = requestedStart + duration;

    const query = sp.from('appointments').select('id, appointment_time, services(duration_minutes)')
        .eq('user_id', uid).eq('professional_id', propId).eq('appointment_date', date)
        .in('status', ['Confirmado', 'Pendente']);
    if (excludeApptId) query.neq('id', excludeApptId);
    const { data: existing } = await query;
    for (const appt of (existing || [])) {
        const start = toSec(appt.appointment_time);
        const end = start + ((appt.services?.duration_minutes || 60) * 60);
        if (requestedStart < end && requestedEnd > start) return { collision: true, range: `${toTime(start)}-${toTime(end)}` };
    }
    return { collision: false };
}

async function handleToolCall(sp: any, st: any, tc: any, cleanPhone: string, services: any[], pros: any[]) {
    const name = tc.function.name;
    const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;

    try {
        if (name === 'create_client') {
            let found = await findClientByPhone(sp, st.user_id, cleanPhone);
            if (found) return { success: true, client: found, message: "Cliente já existe." };
            const { data, error } = await sp.from('clients').insert({ name: args.name, phone: cleanPhone, user_id: st.user_id }).select().single();
            return error ? { success: false, reason: error.message } : { success: true, client: data };
        }

        if (name === 'book_appointment') {
            let client = await findClientByPhone(sp, st.user_id, cleanPhone);
            if (!client) return { success: false, reason: "Use create_client primeiro." };
            const collision = await checkCollision(sp, st.user_id, args.professional_id, args.date, args.time, args.service_id, services);
            if (collision.collision) return { success: false, reason: `Conflito de horário: ${collision.range}.` };
            const pro = pros.find(p => p.id === args.professional_id);
            const { data, error } = await sp.from('appointments').insert({ 
                user_id: st.user_id, client_id: client.id, service_id: args.service_id, 
                professional_id: args.professional_id, pro_name: pro?.name || 'Profissional',
                appointment_date: args.date, 
                appointment_time: args.time.length === 5 ? args.time + ":00" : args.time, 
                status: 'Confirmado' 
            }).select('*, services(name), professionals(name)').single();
            return error ? { success: false, reason: error.message } : { success: true, appointment: data };
        }

        if (name === 'list_my_appointments' || name === 'get_my_appointments' || name === 'list_appointments') {
            let client = await findClientByPhone(sp, st.user_id, cleanPhone);
            if (!client) return { success: false, reason: "Nenhum cadastro encontrado para este número." };
            const today = new Date().toISOString().split('T')[0];
            const { data } = await sp.from('appointments').select('id, appointment_date, appointment_time, status, services(name), professionals(name)').eq('client_id', client.id).in('status', ['Confirmado', 'Pendente']).gte('appointment_date', today).order('appointment_date');
            return { success: true, appointments: data || [], client_name: client.name };
        }

        if (name === 'cancel_appointment') {
            const { error } = await sp.from('appointments').update({ status: 'Cancelado' }).eq('id', args.appointment_id).eq('user_id', st.user_id);
            return error ? { success: false, reason: error.message } : { success: true, message: "Agendamento cancelado com sucesso." };
        }

        if (name === 'cancel_all_my_appointments') {
            let client = await findClientByPhone(sp, st.user_id, cleanPhone);
            if (!client) return { success: false, reason: "Cadastro não encontrado." };
            const today = new Date().toISOString().split('T')[0];
            const { error, count } = await sp.from('appointments').update({ status: 'Cancelado' }).eq('client_id', client.id).eq('user_id', st.user_id).in('status', ['Confirmado', 'Pendente']).gte('appointment_date', today);
            return error ? { success: false, reason: error.message } : { success: true, message: `Todos os agendamentos (${count || 'futuros'}) foram cancelados.` };
        }
    } catch (e: any) {
        return { success: false, reason: `Erro na execução da tool ${name}: ${e.message}` };
    }
    return { success: false, reason: "Tool não encontrada." };
}

function universalExtract(payload: any) {
    const p = Array.isArray(payload) ? payload[0] : payload;
    const data = p?.data || p;
    const inst = p?.instance || p?.instance_name || data?.instance;
    const msg = data?.message || data?.messages?.[0]?.message || data;
    const key = data?.key || data?.messages?.[0]?.key;
    const rawJid = key?.remoteJid || data?.sender || data?.from || '';
    const participant = data?.participant || (msg?.contactMessage?.vcard && msg.contactMessage.vcard.match(/waid=(\d+)/)?.[1]);
    const remoteJidAlt = key?.remoteJidAlt || '';
    const senderPn = data?.senderPn || '';

    let jid = rawJid;
    const candidates = [rawJid, participant, remoteJidAlt, senderPn].filter(Boolean);
    const netMatch = candidates.find(c => typeof c === 'string' && c.includes('@s.whatsapp.net'));
    if (netMatch) jid = netMatch;
    else {
        const phoneMatch = candidates.find(c => typeof c === 'string' && !c.includes('@'));
        if (phoneMatch) {
            const clean = phoneMatch.replace(/\D/g, '');
            if (clean.length >= 8) jid = `${clean}@s.whatsapp.net`;
            else {
                const lidMatch = candidates.find(c => typeof c === 'string' && c.includes('@lid'));
                if (lidMatch) jid = lidMatch;
            }
        } else {
            const lidMatch = candidates.find(c => typeof c === 'string' && c.includes('@lid'));
            if (lidMatch) jid = lidMatch;
        }
    }
    if (jid && typeof jid === 'string' && jid.includes(':')) {
        const parts = jid.split('@');
        const userPart = parts[0].split(':')[0];
        jid = `${userPart}@${parts[1]}`;
    }
    const txt = msg?.conversation || msg?.extendedTextMessage?.text || data?.content || '';
    const fromMe = key?.fromMe ?? false;
    const possibleRealPhone = participant || jid;
    return { inst, jid, txt, fromMe, possibleRealPhone };
}

function parseXmlToolCall(txt: string) {
    const match = txt.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
    if (!match) return null;
    try { return JSON.parse(match[1].trim()); } catch (e) { return null; }
}

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

Deno.serve(async (req) => {
    const sp = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    
    try {
        const body = await req.json();
        const { inst, jid, txt, fromMe, possibleRealPhone } = universalExtract(body);
        if (fromMe || !jid || !txt) return new Response('skip', { headers: corsHeaders });
        
        const { data: st } = await sp.from('ai_agent_settings').select('*').eq('provider_instance', inst).eq('is_active', true).single();
        if (!st) return new Response('no settings', { headers: corsHeaders });
        
        const cleanPhone = possibleRealPhone.split('@')[0].replace(/\D/g, '');

        // --- BOT FLOW ENGINE ---
        const processBotFlow = async () => {
            const { data: activeState } = await sp.from('bot_flow_states').select('*, bot_flows(*)').eq('user_id', st.user_id).eq('client_phone', cleanPhone).eq('is_completed', false).maybeSingle();
            const { data: flows } = await sp.from('bot_flows').select('*').eq('user_id', st.user_id).eq('is_active', true);
            const triggeredFlow = flows?.find(f => f.trigger_keywords?.some((k: string) => txt.trim().toLowerCase() === k.toLowerCase()));
            let currentState = null, currentFlow = null;
            if (triggeredFlow) {
                const startNode = triggeredFlow.nodes.find((n: any) => n.type === 'start' || n.id === 'start-1');
                const { data: newState } = await sp.from('bot_flow_states').upsert({
                    user_id: st.user_id, flow_id: triggeredFlow.id, client_phone: cleanPhone,
                    current_node_id: startNode?.id, collected_data: {}, is_completed: false, updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,client_phone' }).select().single();
                currentState = newState; currentFlow = triggeredFlow;
            } else if (activeState) { currentState = activeState; currentFlow = activeState.bot_flows; }
            if (currentState && currentFlow) {
                const { nodes, edges } = currentFlow;
                const currentNode = nodes.find((n: any) => n.id === currentState.current_node_id);
                if (!currentNode) return false;
                if (currentNode.type === 'question') {
                    const varName = currentNode.data.variable || 'last_response';
                    const data = { ...currentState.collected_data, [varName]: txt };
                    await sp.from('bot_flow_states').update({ collected_data: data }).eq('id', currentState.id);
                }
                let nextNodeId = null;
                if (currentNode.type === 'condition') {
                    const { variable, operator, value } = currentNode.data;
                    const val = currentState.collected_data[variable];
                    let res = false;
                    if (operator === '==') res = String(val) === String(value);
                    else if (operator === '!=') res = String(val) !== String(value);
                    else if (operator === 'contains') res = String(val).toLowerCase().includes(String(value).toLowerCase());
                    else if (operator === 'exists') res = !!val && String(val).trim() !== "";
                    nextNodeId = edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === (res ? 'true' : 'false'))?.target;
                } else if (currentNode.type === 'buttons') {
                    const matchIdx = (currentNode.data.choices || []).findIndex((c: string) => txt.trim().toLowerCase() === c.toLowerCase());
                    if (matchIdx !== -1) nextNodeId = edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === `choice-${matchIdx}`)?.target;
                    else { await sp.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id); return false; }
                } else nextNodeId = edges.find((e: any) => e.source === currentNode.id)?.target;
                if (!nextNodeId) { await sp.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id); return false; }
                const interpolate = (t: string) => t.replace(/\{(\w+)\}/g, (m, k) => currentState.collected_data?.[k] || m);
                let tempId = nextNodeId;
                while (tempId) {
                    const next = nodes.find((n: any) => n.id === tempId);
                    if (!next) break;
                    if (next.type === 'message' || next.type === 'image' || next.type === 'audio') {
                        if (next.type === 'message') await sendWhatsApp(sp, st, inst, jid, interpolate(next.data.text));
                        else if (next.data.url) await sendWhatsApp(sp, st, inst, jid, { url: next.data.url, type: next.type as any, caption: next.type === 'image' ? interpolate(next.data.caption) : undefined });
                        await sp.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        tempId = edges.find((e: any) => e.source === next.id)?.target;
                        if (!tempId) await sp.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id);
                    } else if (next.type === 'question' || next.type === 'buttons') {
                        await sendWhatsApp(sp, st, inst, jid, interpolate(next.data.text));
                        await sp.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        return true;
                    } else if (next.type === 'wait') {
                        await new Promise(r => setTimeout(r, (next.data.delay || 5) * 1000));
                        await sp.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        tempId = edges.find((e: any) => e.source === next.id)?.target;
                    } else break;
                }
                return true;
            }
            return false;
        };
        if (await processBotFlow()) return new Response('flow handled', { headers: corsHeaders });
        // --- END BOT FLOW ENGINE ---

        // Salva imediatamente a mensagem do usuário para evitar perda de estado
        await sp.from('ai_chat_history').insert({ user_id: st.user_id, sender_number: jid, role: 'user', content: txt });

        const foundClient = await findClientByPhone(sp, st.user_id, possibleRealPhone);
        const [services, pros, mapping, bizHours] = await Promise.all([
            sp.from('services').select('*').eq('user_id', st.user_id).eq('is_active', true),
            sp.from('professionals').select('id,name').eq('user_id', st.user_id).eq('is_active', true),
            sp.from('professional_services').select('professional_id,service_id').eq('user_id', st.user_id),
            sp.from('business_hours').select('*').eq('user_id', st.user_id).order('day_of_week')
        ]);

        const matrix = (services.data || []).map(s => {
            const pIds = (mapping.data || []).filter(m => m.service_id === s.id).map(m => m.professional_id);
            const pNames = (pros.data || []).filter(p => pIds.includes(p.id)).map(p => `${p.name} (ID: ${p.id})`).join(' OU ');
            return `- ${s.name} (${s.duration_minutes}min, ID: ${s.id}). Profissionais: ${pNames}`;
        }).join('\n');

        const bizSummary = (bizHours.data || []).map(b => `${DAYS[b.day_of_week]}: ${b.is_working_day ? `${b.start_time.slice(0,5)}-${b.end_time.slice(0,5)}` : 'FECHADO'}`).join('\n');
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth()+1}/2026`;

        const sys = `${st.system_prompt}
### PROTOCOLO DE ESTADO (v28.3) ###
- DATA HOJE: ${dateStr} (ANO 2026)
- CLIENTE: ${foundClient ? `"${foundClient.name}"` : 'NÃO CADASTRADO'}
- TELEFONE: ${cleanPhone}

### REGRAS CRÍTICAS:
1. SE O CLIENTE JÁ TIVER NOME, use-o sempre.
2. SE O NOME FOR "NÃO CADASTRADO", use 'create_client' IMEDIATAMENTE antes de qualquer outra ação.
3. PARA QUALQUER DÚVIDA SOBRE AGENDAMENTOS, use 'list_my_appointments'. NUNCA assuma que sabe os horários.
4. SE O CLIENTE PEDIR PARA CANCELAR TUDO, use 'cancel_all_my_appointments'.
5. OBRIGATÓRIO: Use tools para agendar, listar ou cancelar.

SERVIÇOS:
${matrix}
FUNCIONAMENTO:
${bizSummary}`;

        const historyDb = await sp.from('ai_chat_history').select('role,content').eq('sender_number', jid).eq('user_id', st.user_id).order('created_at', { ascending: false }).limit(6);
        const history = (historyDb.data || []).reverse();

        const ai = new OpenAI({ apiKey: st.ai_api_key, baseURL: st.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined });
        const tools: any = [
            { type: "function", function: { name: "create_client", description: "Cadastra nome do cliente", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
            { type: "function", function: { name: "book_appointment", description: "Novo agendamento", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:mm" }, service_id: { type: "string" }, professional_id: { type: "string" } }, required: ["date", "time", "service_id", "professional_id"] } } },
            { type: "function", function: { name: "list_my_appointments", description: "Ver agendamentos futuros do cliente" } },
            { type: "function", function: { name: "cancel_appointment", description: "Cancela um agendamento específico", parameters: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] } } },
            { type: "function", function: { name: "cancel_all_my_appointments", description: "Cancela TODOS os agendamentos futuros do cliente" } }
        ];

        const res = await ai.chat.completions.create({ model: st.ai_model || 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: txt }] as any, tools });
        let aM = res.choices[0].message, aTxt = aM.content || '', toolCalls = aM.tool_calls || [];
        const xmlCall = parseXmlToolCall(aTxt);
        if (xmlCall) toolCalls.push({ id: 'xml-' + Math.random().toString(36).substring(7), type: 'function', function: { name: xmlCall.name, arguments: JSON.stringify(xmlCall.arguments) } });

        if (toolCalls.length > 0) {
            let tcContext = [];
            for (const tc of toolCalls) {
                const tr = await handleToolCall(sp, st, tc, cleanPhone, services.data, pros.data);
                tcContext.push({ role: 'tool', content: JSON.stringify(tr), tool_call_id: tc.id });
            }
            const final = await ai.chat.completions.create({ model: st.ai_model || 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: txt }, aM, ...tcContext] as any });
            aTxt = final.choices[0].message.content || '';
        }

        aTxt = aTxt.replace(/\*/g, '').trim();
        if (aTxt && !aTxt.includes('<tool_call>')) {
            await Promise.all([
                sp.from('ai_chat_history').insert({ user_id: st.user_id, sender_number: jid, role: 'assistant', content: aTxt }),
                sendWhatsApp(sp, st, inst, jid, aTxt)
            ]);
        }
        return new Response('ok', { headers: corsHeaders });
    } catch (e: any) {
        await logDb(sp, 'ERROR', "Fatal v28.3", { err: e.message });
        return new Response('error', { status: 500, headers: corsHeaders });
    }
});