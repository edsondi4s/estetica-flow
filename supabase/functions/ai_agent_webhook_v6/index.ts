import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logToDb(supabase: any, level: string, msg: string, payload?: any, st?: any) {
    if (st && st.enable_logs !== true && level !== 'ERROR') return;
    try { await supabase.from('debug_logs').insert({ level, message: msg, payload }) } catch (e) { }
}

async function sendWhatsApp(sp: any, st: any, inst: string, jid: string, text: string) {
    if (st.provider_type !== 'evolution') return;
    let url = (st.provider_url || '').replace(/\/$/, '') + `/message/sendText/${inst}`;
    const num = jid.split('@')[0];
    const segs = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1000));
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': st.provider_token },
            body: JSON.stringify({ number: num, text: segs[i] })
        }).catch(e => console.error(e));
    }
}

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

async function checkAvailability(sp: any, uid: string, date: string, time: string, serviceName: string, proName: string, svcs: any[], pros: any[], hrs: any[]) {
    const sName = serviceName || "";
    const pName = proName || "";
    let svc = svcs.find((s: any) => s.name.toLowerCase().includes(sName.toLowerCase()));
    if (!svc) return { available: false, reason: "Serviço não encontrado." };

    const day = new Date(date).getUTCDay();
    const dHrs = hrs.find((h: any) => h.day_of_week === day);
    if (!dHrs || !dHrs.is_working_day) return { available: false, reason: "Clínica fechada na data." };

    const cTime = time.length === 5 ? time + ":00" : time;
    if (cTime < dHrs.start_time || cTime > dHrs.end_time) return { available: false, reason: `Fora do horário. Horários do dia: ${dHrs.start_time.substring(0, 5)} - ${dHrs.end_time.substring(0, 5)}.` };

    const dur = svc.duration_minutes || 30;
    const { data: appts } = await sp.from('appointments').select('appointment_time,professional_id,services(duration_minutes)').eq('appointment_date', date).eq('user_id', uid).neq('status', 'Cancelado');

    let pro = pName ? pros.find((p: any) => p.name.toLowerCase().includes(pName.toLowerCase())) : null;
    const nS = timeToMin(cTime), nE = nS + dur;

    if (pro) {
        for (const a of (appts || [])) {
            if (a.professional_id === pro.id) {
                const aS = timeToMin(a.appointment_time), aE = aS + (a.services?.duration_minutes || 30);
                if (nS < aE && nE > aS) return { available: false, reason: `${pro.name} já tem agendamento neste horário.` };
            }
        }
        return { available: true, service_id: svc.id, duration: dur, professional_id: pro.id, professional_name: pro.name };
    }

    for (const p of pros) {
        let isFree = true;
        for (const a of (appts || [])) {
            if (a.professional_id === p.id) {
                const aS = timeToMin(a.appointment_time), aE = aS + (a.services?.duration_minutes || 30);
                if (nS < aE && nE > aS) { isFree = false; break; }
            }
        }
        if (isFree) return { available: true, service_id: svc.id, duration: dur, professional_id: p.id, professional_name: p.name };
    }
    return { available: false, reason: "Nenhum profissional disponível." };
}

async function listSlots(sp: any, uid: string, date: string, serviceName: string, proName: string, svcs: any[], pros: any[], hrs: any[]) {
    const sName = serviceName || "";
    const pName = proName || "";
    let svc = svcs.find((s: any) => s.name.toLowerCase().includes(sName.toLowerCase()));
    if (!svc) return { slots: [], message: `Serviço '${serviceName}' não encontrado.` };

    const day = new Date(date).getUTCDay();
    const dHrs = hrs.find((h: any) => h.day_of_week === day);
    if (!dHrs || !dHrs.is_working_day) return { slots: [], message: "Clínica fechada na data." };

    const dur = svc.duration_minutes || 30;
    const sMin = timeToMin(dHrs.start_time), eMin = timeToMin(dHrs.end_time);
    const { data: appts } = await sp.from('appointments').select('appointment_time,professional_id,services(duration_minutes)').eq('appointment_date', date).eq('user_id', uid).neq('status', 'Cancelado');
    const slots = [];

    for (let t = sMin; t + dur <= eMin; t += 30) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        const st = `${hh}:${mm}`;

        for (const p of pros) {
            if (pName && !p.name.toLowerCase().includes(pName.toLowerCase())) continue;
            let isFree = true;
            for (const a of (appts || [])) {
                if (a.professional_id === p.id) {
                    const aS = timeToMin(a.appointment_time), aE = aS + (a.services?.duration_minutes || 30);
                    if (t < aE && (t + dur) > aS) { isFree = false; break; }
                }
            }
            if (isFree) { slots.push(st); break; }
        }
    }
    const dFmt = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
    if (slots.length > 0) return { slots, message: `Vagas para ${svc.name} em ${dFmt}: ${slots.join(', ')}.` };
    return { slots: [], message: `Não há horários para ${svc.name} no dia ${dFmt}.` };
}

async function findOrCreateClient(sp: any, uid: string, phone: string, name: string) {
    let { data: c } = await sp.from('clients').select('id, name').eq('phone', phone).eq('user_id', uid).single();
    if (!c) {
        const { data: nC } = await sp.from('clients').insert({ name: name || "Cliente WhatsApp", phone, user_id: uid }).select().single();
        c = nC;
    }
    return c;
}

async function getClientAppts(sp: any, uid: string, phone: string) {
    const c = await findOrCreateClient(sp, uid, phone, "Cliente");
    const { data: a } = await sp.from('appointments').select('id,appointment_date,appointment_time,status,pro_name,services(name)').eq('client_id', c.id).eq('user_id', uid).in('status', ['Pendente', 'Confirmado']).gte('appointment_date', new Date().toISOString().split('T')[0]).order('appointment_date', { ascending: true });
    return {
        client_name: c.name,
        appointments: (a || []).map((x: any) => ({ id: x.id, service: x.services?.name, date: x.appointment_date, time: x.appointment_time?.substring(0, 5), professional: x.pro_name, status: x.status }))
    };
}

async function bookAppt(sp: any, uid: string, args: any, svcs: any[], pros: any[], phone: string) {
    const { date, time, client_name, service_name, professional_name } = args;
    const c = await findOrCreateClient(sp, uid, phone, client_name);
    let svc = svcs.find((s: any) => s.name.toLowerCase().includes((service_name || "").toLowerCase()));
    if (!svc) return { success: false, reason: "Serviço não encontrado na base de dados." };

    let pro = professional_name ? pros.find((p: any) => p.name.toLowerCase().includes(professional_name.toLowerCase())) : (pros.length === 1 ? pros[0] : null);

    const { error } = await sp.from('appointments').insert({
        user_id: uid, client_id: c.id, service_id: svc.id, professional_id: pro?.id || null,
        pro_name: pro?.name || professional_name || "A definir", appointment_date: date, appointment_time: time.length === 5 ? time + ":00" : time, status: 'Confirmado'
    });
    if (error) return { success: false, reason: error.message };
    return { success: true, message: `Agendamento criado com sucesso para o dia ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${time}!` };
}

async function cancelAppt(sp: any, uid: string, args: any, phone: string) {
    let aId = args.appointment_id;
    if (!aId) {
        const a = await getClientAppts(sp, uid, phone);
        if (a.appointments.length === 1) aId = a.appointments[0].id;
        else if (a.appointments.length > 1) return { success: false, reason: "Você tem múltiplos agendamentos, forneça a data ou especifique qual cancelar chamando a lista de agendamentos primeiro." };
        else return { success: false, reason: "Não encontramos agendamentos ativos para você." };
    }
    const { error } = await sp.from('appointments').update({ status: 'Cancelado' }).eq('id', aId).eq('user_id', uid);
    if (error) return { success: false, reason: error.message };
    return { success: true, message: "Agendamento cancelado com sucesso." };
}

async function reschAppt(sp: any, uid: string, args: any, phone: string) {
    let aId = args.appointment_id;
    if (!aId) {
        const a = await getClientAppts(sp, uid, phone);
        if (a.appointments.length === 1) aId = a.appointments[0].id;
        else if (args.original_date) {
            const m = a.appointments.find((x: any) => x.date === args.original_date);
            if (m) aId = m.id;
        }
        if (!aId) return { success: false, reason: "Forneça qual agendamento remarcar (qual data original)." };
    }
    const { error } = await sp.from('appointments').update({ appointment_date: args.new_date, appointment_time: args.new_time.length === 5 ? args.new_time + ":00" : args.new_time, status: 'Confirmado' }).eq('id', aId).eq('user_id', uid);
    if (error) return { success: false, reason: error.message };
    return { success: true, message: "Agendamento remarcado com sucesso!" };
}

const TOOLS: any = [
    { type: "function", function: { name: "search_slots", description: "Encontra opções de horários disponíveis livres em uma data", parameters: { type: "object", properties: { date: { type: "string", description: "Data ISO (YYYY-MM-DD)" }, service_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "service_name"] } } },
    { type: "function", function: { name: "check_availability", description: "Verifica se uma data e hora ESPECÍFICAS estão disponíveis", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM" }, service_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "time", "service_name"] } } },
    { type: "function", function: { name: "book_appointment", description: "Confirma e salva no banco de dados o agendamento após verificar", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM (24h format)" }, service_name: { type: "string" }, client_name: { type: "string" }, professional_name: { type: "string" } }, required: ["date", "time", "service_name", "client_name"] } } },
    { type: "function", function: { name: "get_my_appointments", description: "Retorna todos os agendamentos futuros deste cliente exato", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "cancel_appointment", description: "Cancela um agendamento. Use appointment_id obtido na listagem.", parameters: { type: "object", properties: { appointment_id: { type: "string" } } } } },
    { type: "function", function: { name: "reschedule_appointment", description: "Altera a data/hora de um agendamento", parameters: { type: "object", properties: { appointment_id: { type: "string" }, new_date: { type: "string" }, new_time: { type: "string" }, original_date: { type: "string" } }, required: ["new_date", "new_time"] } } }
];

Deno.serve(async (req) => {
    const sp = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const instance = payload.instance;

        let msgObj = null;
        if (payload.data?.messages && payload.data.messages.length > 0) msgObj = payload.data.messages[0];
        else if (payload.data?.message) msgObj = payload.data.message;
        else if (payload.data && payload.data.key) msgObj = payload.data;

        if (!msgObj || !msgObj.key || msgObj.key.fromMe) return new Response('skip', { headers: corsHeaders });

        const remoteJid = msgObj.key.remoteJid;
        if (!remoteJid) return new Response('no jid', { headers: corsHeaders });

        const text = msgObj.message?.conversation || msgObj.message?.extendedTextMessage?.text || payload.data?.content || '';
        if (!text) return new Response('no text', { headers: corsHeaders });

        const phone = remoteJid.split('@')[0];
        const { data: st } = await sp.from('ai_agent_settings').select('*').eq('provider_instance', instance).eq('is_active', true).single();
        if (!st) return new Response('inactive', { headers: corsHeaders });

        const tzOffset = -3;
        const now = new Date();
        now.setHours(now.getHours() + tzOffset);
        const todayStr = now.toISOString().split('T')[0];

        const mN = text.trim().toUpperCase();
        if (['SIM', 'OK', 'CONFIRMO'].some(k => mN.startsWith(k))) {
            const { data: c } = await sp.from('clients').select('id').eq('phone', phone).eq('user_id', st.user_id).single();
            if (c) {
                const { data: a } = await sp.from('appointments').select('id').eq('client_id', c.id).eq('reminder_sent', true).gte('appointment_date', todayStr).limit(1).single();
                if (a) {
                    await sp.from('appointments').update({ status: 'Confirmado' }).eq('id', a.id);
                    await sendWhatsApp(sp, st, instance, remoteJid, "✅ Nosso compromisso está confirmado! Te esperamos lá.");
                    return new Response('ok', { headers: corsHeaders });
                }
            }
        }

        const { data: hs } = await sp.from('ai_chat_history').select('role,content').eq('sender_number', remoteJid).eq('user_id', st.user_id).order('created_at', { ascending: false }).limit(20);
        const history = (hs || []).filter((h: any) => h.role === 'user' || h.role === 'assistant').reverse();

        const [kb, sv, hr, pr] = await Promise.all([
            sp.from('ai_knowledge_base').select('content').eq('user_id', st.user_id),
            sp.from('services').select('*').eq('user_id', st.user_id).eq('is_active', true),
            sp.from('business_hours').select('*').eq('user_id', st.user_id),
            sp.from('professionals').select('*').eq('user_id', st.user_id).eq('is_active', true)
        ]);

        const ctx = `Serviços:${JSON.stringify(sv.data)}\nHorários Func:${JSON.stringify(hr.data)}\nPros:${JSON.stringify(pr.data)}\nInfo:${kb.data?.map(k => k.content).join(' ')}`;
        const sys = `${st.system_prompt}

IMPORTANTE: 
- Hoje é ${todayStr}. A hora atual é ${now.toISOString().substring(11, 16)} (BRT).
- Sempre descubra e use o nome do cliente no chat.
- Para verificar opções de horários, USE a ferramenta 'search_slots'.
- Para concluir agendamento, USE a ferramenta 'book_appointment', passando o nome do cliente.
- REMOVA TODOS OS ASTERISCOS (*) ao gerar a mensagem. Não use negrito ou itálico.
- Seja amigável, direto e fluido.
- Consulte a agenda SEMPRE via ferramenta!
${ctx}`;

        const aiModel = st.ai_model || 'gpt-4o-mini';
        const ai = new OpenAI({ apiKey: st.ai_api_key, baseURL: st.ai_provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined });

        await logToDb(sp, 'INFO', `Processando Msg`, { text }, st);

        let res: any;
        try {
            res = await ai.chat.completions.create({ model: aiModel, messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: text }] as any, tools: TOOLS, tool_choice: "auto" });
        } catch (err: any) {
            await logToDb(sp, 'WARN', `Fallback (Sem Tools)`, { err: err.message }, st);
            res = await ai.chat.completions.create({ model: aiModel, messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: text }] as any });
        }

        let aM = res.choices[0].message, aTxt = aM.content || '';

        if (aM.tool_calls && aM.tool_calls.length > 0) {
            let tc = aM.tool_calls[0], args = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) { }
            let tR: any = { error: "Unrecognized function" };

            await logToDb(sp, 'INFO', `Tool Call: ${tc.function.name}`, { args }, st);

            if (tc.function.name === 'check_availability') tR = await checkAvailability(sp, st.user_id, args.date, args.time, args.service_name, args.professional_name, sv.data, pr.data, hr.data);
            else if (tc.function.name === 'search_slots') tR = await listSlots(sp, st.user_id, args.date, args.service_name, args.professional_name, sv.data, pr.data, hr.data);
            else if (tc.function.name === 'book_appointment') tR = await bookAppt(sp, st.user_id, args, sv.data, pr.data, phone);
            else if (tc.function.name === 'get_my_appointments') tR = await getClientAppts(sp, st.user_id, phone);
            else if (tc.function.name === 'cancel_appointment') tR = await cancelAppt(sp, st.user_id, args, phone);
            else if (tc.function.name === 'reschedule_appointment') tR = await reschAppt(sp, st.user_id, args, phone);

            await logToDb(sp, 'INFO', `Tool Result`, { result: tR }, st);

            const fRes = await ai.chat.completions.create({ model: aiModel, messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: text }, aM, { role: 'tool', content: JSON.stringify(tR), tool_call_id: tc.id }] as any });
            aTxt = fRes.choices[0].message.content || 'Concluído.';
        }

        aTxt = aTxt.replace(/\*/g, '').trim();
        await sp.from('ai_chat_history').insert([{ user_id: st.user_id, sender_number: remoteJid, role: 'user', content: text }, { user_id: st.user_id, sender_number: remoteJid, role: 'assistant', content: aTxt }]);
        await sendWhatsApp(sp, st, instance, remoteJid, aTxt);

        return new Response('ok', { headers: corsHeaders });
    } catch (e: any) {
        await logToDb(sp, 'ERROR', "Erro global webhook", { error: e.message, stack: e.stack });
        return new Response(e.message, { status: 500, headers: corsHeaders });
    }
});
