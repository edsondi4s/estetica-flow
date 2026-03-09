import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";

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

async function handleCheckAvailability(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, proServicesData?: any) {
    const { date, time } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";

    let service = services?.find((s: any) => args.service_id ? s.id === args.service_id : s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    if (!service) return { available: false, reason: "Serviço não encontrado." };

    const day = new Date(date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { available: false, reason: "A clínica não abre neste dia." };

    const cleanTime = time.length === 5 ? time + ":00" : time;
    if (cleanTime < dayHours.start_time || cleanTime > dayHours.end_time) {
        return { available: false, reason: `Fora do horário (${dayHours.start_time.substring(0, 5)} às ${dayHours.end_time.substring(0, 5)}).` };
    }

    const duration = service.duration_minutes || 30;
    const { data: dayAppointments } = await supabase.from('appointments')
        .select('appointment_time, professional_id, services(duration_minutes)')
        .eq('appointment_date', date)
        .eq('user_id', userId)
        .neq('status', 'Cancelado');

    let pro = null;
    if (args.professional_id) pro = pros?.find((p: any) => p.id === args.professional_id);
    else if (professional_name && professional_name !== "Assistente") pro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase()));

    const newStart = timeToMinutes(cleanTime);
    const newEnd = newStart + duration;

    if (pro) {
        if (proServicesData && !proServicesForService(proServicesData, pro.id, service.id)) {
            return { available: false, reason: `${pro.name} não oferece ${service.name}.` };
        }
        for (const appt of (dayAppointments || [])) {
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

async function handleBookAppointment(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, senderJid: string, proServicesData?: any) {
    const { date, time, client_name } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";
    const cleanNumber = senderJid.split('@')[0];

    // 1. Validar disponibilidade tecnicamente antes de agendar
    const avail = await handleCheckAvailability(supabase, userId, args, services, pros, hours, proServicesData);
    if (!avail.available) return { success: false, reason: avail.reason };

    // 2. Localizar ou criar cliente de forma robusta
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

    // Notificação para o sistema (Painel)
    const { data: serviceData } = await supabase.from('services').select('name').eq('id', avail.service_id).single();
    const { data: clientData } = await supabase.from('clients').select('name').eq('id', client.id).single();
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Novo Agendamento via IA',
        message: `${clientData?.name || 'Cliente'} agendou ${serviceData?.name || 'Serviço'} para ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${time}.`,
        link: 'agenda'
    });

    return { success: true, message: "Agendamento realizado com sucesso!" };
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

async function handleRescheduleAppointment(supabase: any, userId: string, args: any, cleanPhone?: string) {
    let { appointment_id, new_date, new_time } = args;

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

    const cleanTime = new_time.length === 5 ? new_time + ":00" : new_time;
    const { error } = await supabase.from('appointments').update({
        appointment_date: new_date,
        appointment_time: cleanTime,
        status: 'Confirmado'
    }).eq('id', appointment_id);

    if (error) return { success: false, reason: error.message };

    // Notificação para o sistema (Painel)
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Reagendamento via IA',
        message: `Agendamento reagendado para ${new Date(new_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${new_time}.`,
        link: 'agenda'
    });

    return { success: true, message: "Reagendado!" };
}

async function handleCancelAppointment(supabase: any, userId: string, args: any, cleanPhone?: string) {
    let { appointment_id } = args;

    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        if (apptsResult?.appointments?.length === 1) appointment_id = apptsResult.appointments[0].id;
    }

    const { error } = await supabase.from('appointments').update({ status: 'Cancelado' }).eq('id', appointment_id);
    if (error) return { success: false, reason: error.message };

    // Notificação para o sistema (Painel)
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Cancelamento via IA',
        message: `Um agendamento foi cancelado pela IA.`,
        link: 'agenda'
    });

    return { success: true, message: "Cancelado!" };
}

const aiTools: any = [
    {
        type: "function",
        function: {
            name: "check_availability",
            description: "Verifica disponibilidade antes de marcar",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    time: { type: "string", description: "HH:MM" },
                    service_name: { type: "string" },
                    professional_name: { type: "string" }
                },
                required: ["date", "time", "service_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_available_slots",
            description: "Lista várias opções de horários livres no dia",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    service_name: { type: "string" },
                    professional_name: { type: "string" }
                },
                required: ["date", "service_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "book_appointment",
            description: "Grava o agendamento",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    time: { type: "string", description: "HH:MM" },
                    service_name: { type: "string" },
                    client_name: { type: "string", description: "Nome obtido na conversa" },
                    professional_name: { type: "string" }
                },
                required: ["date", "time", "service_name", "client_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_client_appointments",
            description: "Lista agendamentos futuros do cliente atual",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "reschedule_appointment",
            description: "Reagenda (muda a data ou hora)",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string", description: "Opcional" },
                    new_date: { type: "string" },
                    new_time: { type: "string" },
                    original_date: { type: "string", description: "Data atual do agendamento (ajuda a localizar)." }
                },
                required: ["new_date", "new_time"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_appointment",
            description: "Desmarca horários",
            parameters: {
                type: "object",
                properties: { appointment_id: { type: "string" } }
            }
        }
    }
];

Deno.serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const instanceName = payload.instance;
        const msgData = payload.data?.messages?.[0] || payload.data;

        if (!msgData || msgData.key?.fromMe) return new Response('skip', { headers: corsHeaders });

        const senderNumber = msgData.key.remoteJid;
        const textMessage = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || payload.data?.content || '';

        if (!textMessage) return new Response('no text', { headers: corsHeaders });

        const { data: st } = await supabase.from('ai_agent_settings').select('*').eq('provider_instance', instanceName).eq('is_active', true).single();
        if (!st) return new Response('inactive', { headers: corsHeaders });

        const cleanPhone = senderNumber.split('@')[0];
        const msgNorm = textMessage.trim().toUpperCase();

        if (['SIM', 'OK', 'CONFIRMO'].some(k => msgNorm.startsWith(k))) {
            const client = await findClientByPhone(supabase, st.user_id, cleanPhone);
            if (client) {
                const today = new Date().toISOString().split('T')[0];
                const { data: appt } = await supabase.from('appointments').select('id').eq('client_id', client.id).eq('reminder_sent', true).gte('appointment_date', today).limit(1).single();
                if (appt) {
                    await supabase.from('appointments').update({ status: 'Confirmado' }).eq('id', appt.id);
                    await sendWhatsApp(supabase, st, instanceName, senderNumber, "✅ Confirmado! Te esperamos.");
                    return new Response('ok', { headers: corsHeaders });
                }
            }
        }

        const { data: hs } = await supabase.from('ai_chat_history').select('role, content').eq('sender_number', senderNumber).eq('user_id', st.user_id).order('created_at', { ascending: false }).limit(20);
        const history = (hs || []).filter((h: any) => h.role === 'user' || h.role === 'assistant').reverse();

        const [kb, serv, hrs, proD, proServData] = await Promise.all([
            supabase.from('ai_knowledge_base').select('content').eq('user_id', st.user_id),
            supabase.from('services').select('*').eq('user_id', st.user_id).eq('is_active', true),
            supabase.from('business_hours').select('*').eq('user_id', st.user_id),
            supabase.from('professionals').select('*').eq('user_id', st.user_id).eq('is_active', true),
            supabase.from('professional_services').select('*')
        ]);

        const context = `Contexto:\nServiços: ${JSON.stringify(serv.data)}\nHorários: ${JSON.stringify(hrs.data)}\nProfissionais: ${JSON.stringify(proD.data)}\nInfo: ${kb.data?.map(k => k.content).join(' ')}`;
        const now = new Date();
        const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        const dateStr = `${days[now.getUTCDay()]}, ${now.getUTCDate().toString().padStart(2, '0')}/${(now.getUTCMonth() + 1).toString().padStart(2, '0')}/2026`;
        const systemPrompt = `${st.system_prompt}\n${context}\nDATA ATUAL: ${dateStr}. IMPORTANTE: Estamos no ano de 2026. NÃO ofereça agendamentos para dias que a clínica está fechada (conforme horários no contexto). Remova "*" asteriscos e evite negrito. USE SEMPRE AS FERRAMENTAS PARA CONSULTAS E AGENDAMENTOS!`;

        const aiClient = new OpenAI({ apiKey: st.ai_api_key, baseURL: st.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined });
        const aiModel = st.ai_model || 'gpt-4o-mini';

        await logToDb(supabase, 'INFO', `Iniciando AI Tools (${aiModel})`, { sender: cleanPhone }, st);

        let initialRes: any;
        try {
            initialRes = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: textMessage }] as any,
                tools: aiTools,
                tool_choice: "auto"
            });
        } catch (err: any) {
            await logToDb(supabase, 'WARN', `Model failed with tools, retry without (${err.message})`, {}, st);
            initialRes = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: textMessage }] as any
            });
        }

        let aiMsg = initialRes.choices[0].message;
        let aiText = aiMsg.content || '';

        if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
            let tc = aiMsg.tool_calls[0];
            let rawArgs = tc.function.arguments || "{}";
            let args = {};
            try { args = JSON.parse(rawArgs); } catch (e) { args = {}; }
            let toolRes: any = { err: "Desconhecida" };

            await logToDb(supabase, 'INFO', `Tool Call: ${tc.function.name}`, { args }, st);

            if (tc.function.name === 'check_availability') toolRes = await handleCheckAvailability(supabase, st.user_id, args, serv.data, proD.data, hrs.data, proServData.data);
            else if (tc.function.name === 'list_available_slots') toolRes = await handleListAvailableSlots(supabase, st.user_id, args, serv.data, proD.data, hrs.data, proServData.data);
            else if (tc.function.name === 'book_appointment') toolRes = await handleBookAppointment(supabase, st.user_id, args, serv.data, proD.data, hrs.data, senderNumber, proServData.data);
            else if (tc.function.name === 'get_client_appointments') toolRes = await handleGetClientAppointments(supabase, st.user_id, cleanPhone);
            else if (tc.function.name === 'reschedule_appointment') toolRes = await handleRescheduleAppointment(supabase, st.user_id, args, cleanPhone);
            else if (tc.function.name === 'cancel_appointment') toolRes = await handleCancelAppointment(supabase, st.user_id, args, cleanPhone);

            const followUpRes = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: textMessage },
                    aiMsg,
                    { role: 'tool', content: JSON.stringify(toolRes), tool_call_id: tc.id }
                ] as any
            });
            aiText = followUpRes.choices[0].message.content || 'Concluído.';
        }

        aiText = aiText.replace(/\*/g, '').trim();
        await supabase.from('ai_chat_history').insert([{ user_id: st.user_id, sender_number: senderNumber, role: 'user', content: textMessage }, { user_id: st.user_id, sender_number: senderNumber, role: 'assistant', content: aiText }]);
        await sendWhatsApp(supabase, st, instanceName, senderNumber, aiText);

        return new Response('ok', { headers: corsHeaders });
    } catch (e: any) {
        await supabase.from('debug_logs').insert({ level: 'ERROR', message: "Crit Error", payload: e.message });
        return new Response(e.message, { status: 500, headers: corsHeaders });
    }
});
