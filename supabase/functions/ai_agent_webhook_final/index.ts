import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";
import Redis from "npm:ioredis@^5.4.0";

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

async function sendWhatsApp(supabase: any, settings: any, instance: string, remoteJid: string, content: string | { url: string, type: 'image' | 'audio', caption?: string }) {
    if (settings.provider_type !== 'evolution') return;
    let baseUrl = settings.provider_url || '';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const cleanNumber = remoteJid.split('@')[0];

    const headers = { 'Content-Type': 'application/json', 'apikey': settings.provider_token };

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
        } catch (e: any) {
            console.error(`WhatsApp ${content.type} error:`, e.message);
        }
        return;
    }

    const url = `${baseUrl}/message/sendText/${instance}`;
    const segments = content.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
            const waitTime = Math.min(Math.max(segments[i - 1].length * 20, 800), 3000);
            await delay(waitTime);
        }
        try {
            await fetch(url, {
                method: 'POST',
                headers,
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

/**
 * Busca um cliente comparando apenas os dígitos finais (ignorando formatação e prefixo de país)
 */
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

// Global functions for AI Tools ported from the original logic
async function handleCheckAvailability(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, proServicesData?: any, ignore_appointment_id?: string) {
    const { date, time } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";

    let service = services?.find((s: any) => args.service_id ? s.id === args.service_id : s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    if (!service) return { available: false, reason: "Serviço não encontrado." };

    const day = new Date(date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { available: false, reason: "A clínica não abre neste dia." };

    const duration = service.duration_minutes || 30;
    const cleanTime = time.length === 5 ? time + ":00" : time;
    const newStart = timeToMinutes(cleanTime);
    const newEnd = newStart + duration;

    const clinicStart = timeToMinutes(dayHours.start_time);
    const clinicEnd = timeToMinutes(dayHours.end_time);

    if (newStart < clinicStart || newEnd > clinicEnd) {
        const lastSlot = clinicEnd - duration;
        const lastH = String(Math.floor(lastSlot / 60)).padStart(2, '0');
        const lastM = String(lastSlot % 60).padStart(2, '0');
        return { available: false, reason: `Fora do horário (${dayHours.start_time.substring(0, 5)} às ${dayHours.end_time.substring(0, 5)}). Considerando a duração do serviço (${duration}m), o último horário é ${lastH}:${lastM}.` };
    }

    const { data: dayAppointments } = await supabase.from('appointments')
        .select('appointment_time, professional_id, services(duration_minutes)')
        .eq('appointment_date', date)
        .eq('user_id', userId)
        .neq('status', 'Cancelado');

    let pro = null;
    if (args.professional_id) pro = pros?.find((p: any) => p.id === args.professional_id);
    else if (professional_name && professional_name !== "Assistente") pro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase()));

    if (pro) {
        if (proServicesData && !proServicesForService(proServicesData, pro.id, service.id)) {
            return { available: false, reason: `${pro.name} não oferece ${service.name}.` };
        }
        for (const appt of (dayAppointments || [])) {
            if (ignore_appointment_id && appt.id === ignore_appointment_id) continue;
            if (appt.professional_id !== pro.id) continue;
            const apptStart = timeToMinutes(appt.appointment_time);
            const apptEnd = apptStart + (appt.services?.duration_minutes || 30);
            if (newStart < apptEnd && newEnd > apptStart) {
                return { available: false, reason: `${pro.name} já possui agendamento neste horário.` };
            }
        }
        return { available: true, service_id: service.id, duration, professional_id: pro.id };
    }

    for (const p of (pros || [])) {
        if (proServicesData && !proServicesForService(proServicesData, p.id, service.id)) continue;
        let hasConflict = false;
        for (const appt of (dayAppointments || [])) {
            if (ignore_appointment_id && appt.id === ignore_appointment_id) continue;
            if (appt.professional_id !== p.id) continue;
            const apptStart = timeToMinutes(appt.appointment_time);
            const apptEnd = apptStart + (appt.services?.duration_minutes || 30);
            if (newStart < apptEnd && newEnd > apptStart) { hasConflict = true; break; }
        }
        if (!hasConflict) return { available: true, service_id: service.id, duration, professional_id: p.id };
    }

    return { available: false, reason: "Nenhum profissional disponível." };
}

async function handleListAvailableSlots(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, proServicesData?: any) {
    const { date } = args;
    const service_name = args.service_name || "";
    const professional_name = args.professional_name || "";

    const service = services?.find((s: any) => s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    if (!service) return { slots: [], message: "Serviço não encontrado." };

    const day = new Date(date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { slots: [], message: "A clínica não abre neste dia." };

    const duration = service.duration_minutes || 30;
    const startMin = timeToMinutes(dayHours.start_time);
    const endMin = timeToMinutes(dayHours.end_time);

    const { data: dayAppointments } = await supabase.from('appointments')
        .select('appointment_time, professional_id, services(duration_minutes)')
        .eq('appointment_date', date)
        .eq('user_id', userId)
        .neq('status', 'Cancelado');

    const availableSlots: string[] = [];
    for (let t = startMin; t + duration <= endMin; t += 30) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        const slotTime = `${hh}:${mm}`;

        for (const p of (pros || [])) {
            if (professional_name && !p.name.toLowerCase().includes(professional_name.toLowerCase())) continue;
            if (proServicesData && !proServicesForService(proServicesData, p.id, service.id)) continue;

            let hasConflict = false;
            for (const appt of (dayAppointments || [])) {
                if (appt.professional_id !== p.id) continue;
                const apptStart = timeToMinutes(appt.appointment_time);
                const apptEnd = apptStart + (appt.services?.duration_minutes || 30);
                if (t < apptEnd && (t + duration) > apptStart) { hasConflict = true; break; }
            }
            if (!hasConflict) { availableSlots.push(slotTime); break; }
        }
    }

    const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (availableSlots.length === 0) {
        return { slots: [], message: `Não há horários para *${service.name}* em ${dateFormatted}.` };
    }
    return {
        slots: availableSlots,
        message: `Vagas para *${service.name}* em ${dateFormatted}: ${availableSlots.join(', ')}.`
    };
}

async function handleBookAppointment(supabase: any, redis: any, userId: string, args: any, services: any, pros: any, hours: any, senderJid: string, proServicesData?: any) {
    const { date, time, client_name } = args;
    const cleanNumber = senderJid.split('@')[0];

    let lockKey = "";
    if (redis) {
        lockKey = `lock:appointment:${userId}:${args.professional_id || 'any'}:${date}:${time}`;
        const acquired = await redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
        if (!acquired) {
            return { success: false, reason: "Este horário está sendo processado por outra pessoa. Tente novamente em alguns segundos." };
        }
    }

    try {
        const avail = await handleCheckAvailability(supabase, userId, args, services, pros, hours, proServicesData);
        if (!avail.available) return { success: false, reason: avail.reason };

        let client = await findClientByPhone(supabase, userId, cleanNumber);
        if (!client) {
            const { data: newClient } = await supabase.from('clients').insert({
                name: client_name || "Cliente",
                phone: cleanNumber,
                user_id: userId
            }).select().single();
            client = newClient;
        }

        const { error } = await supabase.from('appointments').insert({
            user_id: userId,
            client_id: client.id,
            service_id: avail.service_id,
            professional_id: avail.professional_id,
            pro_name: (pros?.find((p: any) => p.id === avail.professional_id))?.name || "Profissional",
            appointment_date: date,
            appointment_time: time.length === 5 ? time + ":00" : time,
            status: 'Confirmado'
        });

        if (error) return { success: false, reason: error.message };

        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Novo Agendamento via IA',
            message: `${client?.name || 'Cliente'} agendou serviço para ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${time}.`,
            link: 'agenda'
        });

        return { success: true, message: "Agendamento realizado com sucesso!" };
    } finally {
        if (redis && lockKey) await redis.del(lockKey);
    }
}

async function handleGetClientAppointments(supabase: any, userId: string, cleanPhone: string) {
    const client = await findClientByPhone(supabase, userId, cleanPhone);
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

async function handleRescheduleAppointment(supabase: any, redis: any, userId: string, args: any, cleanPhone: string | undefined, services: any, pros: any, hours: any, proServicesData: any) {
    let { appointment_id, new_date, new_time } = args;

    let lockKey = "";
    if (redis) {
        lockKey = `lock:reschedule:${userId}:${appointment_id || 'any'}:${new_date}:${new_time}`;
        const acquired = await redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
        if (!acquired) {
            return { success: false, reason: "Este reagendamento está sendo processado. Tente novamente." };
        }
    }

    try {
        if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
            const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
            const appts = apptsResult?.appointments || [];
            if (args.original_date) {
                const match = appts.find((a: any) => a.date_iso === args.original_date);
                if (match) appointment_id = match.id;
            } else if (appts.length === 1) {
                appointment_id = appts[0].id;
            }
        }

        const { data: original } = await supabase.from('appointments')
            .select('id, service_id, pro_name, professional_id, client_id, services(name, duration_minutes)')
            .eq('id', appointment_id).eq('user_id', userId).single();

        if (!original) return { success: false, reason: "Agendamento não encontrado." };

        const availArgs = {
            date: new_date,
            time: new_time,
            service_id: original.service_id,
            professional_id: original.professional_id
        };
        const avail = await handleCheckAvailability(supabase, userId, availArgs, services, pros, hours, proServicesData, appointment_id);
        if (!avail.available) return { success: false, reason: avail.reason };

        const cleanTime = new_time.length === 5 ? new_time + ":00" : new_time;
        const { error } = await supabase.from('appointments').update({
            appointment_date: new_date,
            appointment_time: cleanTime,
            status: 'Confirmado'
        }).eq('id', appointment_id);

        if (error) return { success: false, reason: error.message };

        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Reagendamento via IA',
            message: `Agendamento reagendado para ${new Date(new_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${new_time}.`,
            link: 'agenda'
        });

        return { success: true, message: "Reagendado!" };
    } finally {
        if (redis && lockKey) await redis.del(lockKey);
    }
}

async function handleCancelAppointment(supabase: any, userId: string, args: any, cleanPhone?: string) {
    let { appointment_id } = args;

    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        if (apptsResult?.appointments?.length === 1) appointment_id = apptsResult.appointments[0].id;
    }

    const { error } = await supabase.from('appointments').update({ status: 'Cancelado' }).eq('id', appointment_id);
    if (error) return { success: false, reason: error.message };

    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Cancelamento via IA',
        message: `Um agendamento foi cancelado pela IA.`,
        link: 'agenda'
    });

    return { success: true, message: "Cancelado!" };
}

const aiTools: any = [
    { type: "function", function: { name: "check_availability", description: "Verifica disponibilidade", parameters: { type: "object", properties: { date: { type: "string" }, time: { type: "string" }, service_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "time", "service_name"] } } },
    { type: "function", function: { name: "list_available_slots", description: "Lista horários livres", parameters: { type: "object", properties: { date: { type: "string" }, service_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "service_name"] } } },
    { type: "function", function: { name: "book_appointment", description: "Novo agendamento", parameters: { type: "object", properties: { date: { type: "string" }, time: { type: "string" }, service_name: { type: "string" }, client_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "time", "service_name", "client_name"] } } },
    { type: "function", function: { name: "get_client_appointments", description: "Lista agendamentos futuros", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "reschedule_appointment", description: "Reagenda", parameters: { type: "object", properties: { appointment_id: { type: "string" }, new_date: { type: "string" }, new_time: { type: "string" } }, required: ["new_date", "new_time"] } } },
    { type: "function", function: { name: "cancel_appointment", description: "Cancela", parameters: { type: "object", properties: { appointment_id: { type: "string" } } } } }
];

const redisUrl = Deno.env.get('REDIS_URL');
const redis = redisUrl ? new Redis(redisUrl) : null;

// Helper to extract robust JID/Phone Ported from v28
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
    if (netMatch) {
        jid = netMatch;
    } else {
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

Deno.serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json();
        const { inst, jid, txt, fromMe, possibleRealPhone } = universalExtract(body);

        if (fromMe || !jid || !txt) return new Response('skip', { headers: corsHeaders });

        const { data: st } = await supabase.from('ai_agent_settings').select('*').eq('provider_instance', inst).eq('is_active', true).single();
        if (!st) return new Response('inactive', { headers: corsHeaders });

        const cleanPhone = possibleRealPhone.split('@')[0].replace(/\D/g, '');

        // --- BOT FLOW ENGINE ---
        const processBotFlow = async () => {
            const { data: flows } = await supabase.from('bot_flows').select('*').eq('user_id', st.user_id).eq('is_active', true);
            const triggeredFlow = flows?.find(f => f.trigger_keywords?.some((k: string) => txt.trim().toLowerCase() === k.toLowerCase()));

            let currentState = null;
            let currentFlow = null;

            if (triggeredFlow) {
                const startNode = triggeredFlow.nodes.find((n: any) => n.type === 'start' || n.id === 'start-1');
                const { data: newState } = await supabase.from('bot_flow_states').upsert({
                    user_id: st.user_id, flow_id: triggeredFlow.id, client_phone: cleanPhone,
                    current_node_id: startNode?.id, collected_data: {}, is_completed: false, updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,client_phone' }).select().single();
                currentState = newState;
                currentFlow = triggeredFlow;
            } else {
                const { data: activeState } = await supabase.from('bot_flow_states').select('*, bot_flows(*)').eq('user_id', st.user_id).eq('client_phone', cleanPhone).eq('is_completed', false).maybeSingle();
                if (activeState) {
                    currentState = activeState;
                    currentFlow = activeState.bot_flows;
                } else return false;
            }

            if (currentState && currentFlow) {
                const nodes = currentFlow.nodes;
                const edges = currentFlow.edges;
                const currentNode = nodes.find((n: any) => n.id === currentState.current_node_id);
                if (!currentNode) return false;

                if (currentNode.type === 'question') {
                    const varName = currentNode.data.variable || 'last_response';
                    const data = { ...currentState.collected_data, [varName]: txt };
                    await supabase.from('bot_flow_states').update({ collected_data: data }).eq('id', currentState.id);
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
                    else { await supabase.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id); return false; }
                } else {
                    nextNodeId = edges.find((e: any) => e.source === currentNode.id)?.target;
                }

                if (!nextNodeId) { await supabase.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id); return false; }

                const interpolate = (t: string) => t.replace(/\{(\w+)\}/g, (m, k) => currentState.collected_data?.[k] || m);
                let tempId = nextNodeId;
                while (tempId) {
                    const next = nodes.find((n: any) => n.id === tempId);
                    if (!next) break;
                    if (next.type === 'message') {
                        await sendWhatsApp(supabase, st, inst, jid, interpolate(next.data.text));
                        await supabase.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        const edge = edges.find((e: any) => e.source === next.id);
                        tempId = edge?.target;
                        if (!tempId) await supabase.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id);
                    } else if (next.type === 'image' || next.type === 'audio') {
                        if (next.data.url) await sendWhatsApp(supabase, st, inst, jid, { url: next.data.url, type: next.type as any, caption: next.type === 'image' ? interpolate(next.data.caption) : undefined });
                        await supabase.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        const edge = edges.find((e: any) => e.source === next.id);
                        tempId = edge?.target;
                        if (!tempId) await supabase.from('bot_flow_states').update({ is_completed: true }).eq('id', currentState.id);
                    } else if (next.type === 'question' || next.type === 'buttons') {
                        await sendWhatsApp(supabase, st, inst, jid, interpolate(next.data.text));
                        await supabase.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        return true;
                    } else if (next.type === 'wait') {
                        await new Promise(r => setTimeout(r, (next.data.delay || 5) * 1000));
                        await supabase.from('bot_flow_states').update({ current_node_id: next.id }).eq('id', currentState.id);
                        tempId = edges.find((e: any) => e.source === next.id)?.target;
                    } else break;
                }
                return true;
            }
            return false;
        };

        if (await processBotFlow()) return new Response('flow handled', { headers: corsHeaders });

        // --- AI AGENT LOGIC ---
        const { data: hs } = await supabase.from('ai_chat_history').select('role, content').eq('sender_number', jid).eq('user_id', st.user_id).order('created_at', { ascending: false }).limit(6);
        const history = (hs || []).filter((h: any) => h.role === 'user' || h.role === 'assistant').reverse();

        const [kb, serv, hrs, proD, proServData, addressesData] = await Promise.all([
            supabase.from('ai_knowledge_base').select('content').eq('user_id', st.user_id),
            supabase.from('services').select('*').eq('user_id', st.user_id).eq('is_active', true),
            supabase.from('business_hours').select('*').eq('user_id', st.user_id),
            supabase.from('professionals').select('*').eq('user_id', st.user_id).eq('is_active', true),
            supabase.from('professional_services').select('*'),
            supabase.from('addresses').select('*')
        ]);

        const context = `Serviços: ${JSON.stringify(serv.data)}\nHorários: ${JSON.stringify(hrs.data)}\nProfissionais: ${JSON.stringify(proD.data)}\nEndereços da Clínica: ${JSON.stringify(addressesData.data)}\nInfo: ${kb.data?.map(k => k.content).join(' ')}`;
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
        
        const strictRules = `
REGRAS ESTABELECIDAS DE AGENDAMENTO E ENDEREÇO (MUITO IMPORTANTE):
1. NUNCA PRESUMA INFORMAÇÕES DE AGENDAMENTOS ANTERIORES. Toda vez que um novo agendamento for iniciado, VOCÊ DEVE PERGUNTAR explicitamente ao cliente: o serviço desejado, a data e o horário, e o profissional (se aplicável). NÃO crie agendamentos com antigos dados no histórico sem confirmação absoluta das necessidades ATUAIS.
2. SOBRE O ENDEREÇO DA CLÍNICA:
   - Se houver APENAS 1 (um) endereço cadastrado na clínica, VOCÊ NÃO PRECISA PERGUNTAR ao cliente qual o endereço. Apenas INFORME o endereço completo (incluindo número, bairro e cidade) NO FINAL, junto com a mensagem de confirmação do agendamento concluído (preferencialmente enviando um link do Google Maps pesquisando "Rua tal, numero tal, cidade tal" se aplicável).
   - Se houver 2 (DOIS) ou mais endereços cadastrados, VOCÊ DEVE, em algum momento durante a conversa de agendamento (antes de finalizar), PERGUNTAR ao cliente em qual unidade/endereço ele deseja ser atendido, listando sutilmente as opções de endereços e bairros/cidades. Use este dado para informar o profissional correto e confirmar o agendamento no local certo.
`;

        const systemPrompt = `${st.system_prompt}\nContexto:\n${context}\nDATA HOJE: ${dateStr}. USE TOOLS SEMPRE!\n${strictRules}`;

        const aiClient = new OpenAI({ apiKey: st.ai_api_key, baseURL: st.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined });
        const aiRes = await aiClient.chat.completions.create({
            model: st.ai_model || 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: txt }] as any,
            tools: aiTools,
            tool_choice: "auto"
        });

        let aiMsg = aiRes.choices[0].message, aiText = aiMsg.content || '';

        if (aiMsg.tool_calls) {
            let tcContext = [];
            for (const tc of aiMsg.tool_calls) {
                let toolRes: any = {};
                try {
                    const args = JSON.parse(tc.function.arguments);
                    
                    if (tc.function.name === 'check_availability') toolRes = await handleCheckAvailability(supabase, st.user_id, args, serv.data, proD.data, hrs.data, proServData.data);
                    else if (tc.function.name === 'list_available_slots') toolRes = await handleListAvailableSlots(supabase, st.user_id, args, serv.data, proD.data, hrs.data, proServData.data);
                    else if (tc.function.name === 'book_appointment') toolRes = await handleBookAppointment(supabase, redis, st.user_id, args, serv.data, proD.data, hrs.data, jid, proServData.data);
                    else if (tc.function.name === 'get_client_appointments') toolRes = await handleGetClientAppointments(supabase, st.user_id, jid);
                    else if (tc.function.name === 'reschedule_appointment') toolRes = await handleRescheduleAppointment(supabase, redis, st.user_id, args, jid, serv.data, proD.data, hrs.data, proServData.data);
                    else if (tc.function.name === 'cancel_appointment') toolRes = await handleCancelAppointment(supabase, st.user_id, args, jid);
                    else toolRes = { success: false, reason: "Ferramenta desconhecida." };
                } catch (err: any) {
                    toolRes = { success: false, reason: "Erro ao interpretar argumentos da ferramenta (JSON inválido). Peça para a IA tentar novamente." };
                }
                
                tcContext.push({ role: 'tool', content: JSON.stringify(toolRes), tool_call_id: tc.id });
            }

            const finalRes = await aiClient.chat.completions.create({
                model: st.ai_model || 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: txt }, aiMsg, ...tcContext] as any
            });
            aiText = finalRes.choices[0].message.content || '';
        }

        aiText = aiText.replace(/\*/g, '').trim();
        if (aiText) {
            await supabase.from('ai_chat_history').insert([{ user_id: st.user_id, sender_number: jid, role: 'user', content: txt }, { user_id: st.user_id, sender_number: jid, role: 'assistant', content: aiText }]);
            await sendWhatsApp(supabase, st, inst, jid, aiText);
        }

        await supabase.from('debug_logs').insert({ level: 'INFO', message: "Webhook Consolidado Success", payload: { jid, response: aiText } });
        return new Response('ok', { headers: corsHeaders });

    } catch (e: any) {
        await supabase.from('debug_logs').insert({ level: 'ERROR', message: "Consolidado Error", payload: { err: e.message } });
        return new Response(e.message, { status: 500, headers: corsHeaders });
    }
});
