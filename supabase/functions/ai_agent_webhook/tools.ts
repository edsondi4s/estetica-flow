import { createClient } from "npm:@supabase/supabase-js@2"

export async function logToDb(supabase: any, level: string, message: string, payload?: any, agentSettings?: any) {
    if (agentSettings && agentSettings.enable_logs !== true) {
        if (level !== 'ERROR' && level !== 'CRITICAL') return;
    }
    if (!agentSettings && level === 'INFO') return;
    try {
        await supabase.from('debug_logs').insert({ level, message, payload });
    } catch (e) {
        console.error("Erro ao logar no DB:", e);
    }
}

export async function sendWhatsApp(supabase: any, settings: any, instance: string, remoteJid: string, text: string) {
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
            console.error("Erro ao enviar WhatsApp:", e.message);
        }
    }
}

export function timeToMinutes(timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export function proServicesForService(proServicesData: any[], proId: string, serviceId: string): boolean {
    if (!proServicesData || proServicesData.length === 0) return true;
    const proRows = proServicesData.filter((ps: any) => ps.professional_id === proId);
    if (proRows.length === 0) return true;
    return proRows.some((ps: any) => ps.service_id === serviceId);
}

export async function handleCheckAvailability(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, proServicesData?: any) {
    const { date, time } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";

    let service = services?.find((s: any) => args.service_id ? s.id === args.service_id : s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    if (!service) return { available: false, reason: "Serviço não encontrado no sistema." };

    const day = new Date(date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { available: false, reason: "A clínica não abre neste dia." };

    const cleanTime = time.length === 5 ? time + ":00" : time;
    if (cleanTime < dayHours.start_time || cleanTime > dayHours.end_time) {
        return { available: false, reason: `Fora do horário de expediente (${dayHours.start_time.substring(0, 5)} às ${dayHours.end_time.substring(0, 5)}).` };
    }

    const duration = service.duration_minutes || 30;
    const { data: dayAppointments } = await supabase.from('appointments')
        .select('appointment_time, service_id, professional_id, services(duration_minutes)')
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

    return { available: false, reason: "Nenhum profissional disponível neste horário." };
}

export async function handleListAvailableSlots(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, proServicesData?: any) {
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
        return { slots: [], message: `Não há horários disponíveis para *${service.name}* em ${dateFormatted}.` };
    }
    return {
        slots: availableSlots,
        message: `Horários disponíveis para *${service.name}* em ${dateFormatted}: ${availableSlots.join(', ')}.`
    };
}

export async function handleBookAppointment(supabase: any, userId: string, args: any, services: any, pros: any, senderJid: string) {
    const { date, time, client_name } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";
    const cleanNumber = senderJid.split('@')[0];

    let { data: client } = await supabase.from('clients').select('id').eq('phone', cleanNumber).eq('user_id', userId).single();
    if (!client) {
        const { data: newClient } = await supabase.from('clients').insert({ name: client_name || "Cliente", phone: cleanNumber, user_id: userId }).select().single();
        client = newClient;
    }

    let service = services?.find((s: any) => args.service_id ? s.id === args.service_id : s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    let pro = null;
    if (args.professional_id) pro = pros?.find((p: any) => p.id === args.professional_id);
    else if (professional_name && professional_name !== "Assistente") pro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase?.() || ""));
    if (!pro && pros?.length === 1) pro = pros[0];

    if (!service) return { success: false, reason: "Serviço não encontrado." };

    const cleanTime = time.length === 5 ? time + ":00" : time;
    const { error } = await supabase.from('appointments').insert({
        user_id: userId,
        client_id: client.id,
        service_id: service.id,
        professional_id: pro?.id || null,
        pro_name: pro?.name || professional_name || "A definir",
        appointment_date: date,
        appointment_time: cleanTime,
        status: 'Confirmado'
    });

    if (error) return { success: false, reason: "Erro ao salvar no banco: " + error.message };

    // Notificação para o sistema (Painel)
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Novo Agendamento via IA',
        message: `${client.name} agendou ${service.name} com ${pro?.name || professional_name || 'Profissional'} para ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${time}.`
    });

    return { success: true, message: "Agendamento realizado com sucesso!" };
}

export async function handleGetClientAppointments(supabase: any, userId: string, cleanPhone: string) {
    const { data: client } = await supabase.from('clients').select('id, name').eq('phone', cleanPhone).eq('user_id', userId).single();
    if (!client) return { appointments: [], message: "Nenhum cadastro encontrado para este número." };

    const today = new Date().toISOString().split('T')[0];
    const { data: appointments } = await supabase.from('appointments')
        .select('id, appointment_date, appointment_time, status, pro_name, services(name)')
        .eq('client_id', client.id)
        .eq('user_id', userId)
        .in('status', ['Pendente', 'Confirmado'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true });

    if (!appointments || appointments.length === 0) {
        return { appointments: [], message: `${client.name} não possui agendamentos futuros em aberto.` };
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

    return { client_name: client.name, appointments: formatted, message: `Encontrei ${formatted.length} agendamento(s) em aberto para ${client.name}.` };
}

export async function handleRescheduleAppointment(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, cleanPhone?: string) {
    let { appointment_id, new_date, new_time } = args;
    const professional_name = args.professional_name || args.pro || args.professional || "";

    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        const appts = apptsResult?.appointments || [];
        if (appts.length === 0) return { success: false, reason: "Você não possui agendamentos ativos para reagendar." };
        if (args.original_date) {
            const match = appts.find((a: any) => a.date_iso === args.original_date);
            if (match) appointment_id = match.id;
            else return { success: false, reason: "A data original não bate com nenhum agendamento ativo." };
        } else if (appointment_id && !isNaN(parseInt(appointment_id)) && appointment_id.length <= 2) {
            const idx = parseInt(appointment_id) - 1;
            if (appts[idx]) appointment_id = appts[idx].id;
            else return { success: false, reason: "Índice de agendamento não encontrado." };
        } else if (appts.length === 1) {
            appointment_id = appts[0].id;
        } else {
            return { success: false, reason: "Especifique a data original do agendamento que deseja alterar." };
        }
    }

    const { data: original } = await supabase.from('appointments')
        .select('id, service_id, pro_name, professional_id, client_id, services(name, duration_minutes)')
        .eq('id', appointment_id).eq('user_id', userId).single();

    if (!original) return { success: false, reason: "Agendamento não encontrado." };

    const cleanTime = new_time.length === 5 ? new_time + ":00" : new_time;
    const day = new Date(new_date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { success: false, reason: "A clínica não abre neste dia." };
    if (cleanTime < dayHours.start_time || cleanTime > dayHours.end_time) {
        return { success: false, reason: `Fora do horário (${dayHours.start_time.substring(0, 5)} às ${dayHours.end_time.substring(0, 5)}).` };
    }

    let targetPro: any = null;
    if (professional_name && professional_name !== "Assistente") {
        targetPro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase?.() || ""));
        if (!targetPro) return { success: false, reason: "Profissional não encontrado." };
    } else {
        if (original.professional_id) targetPro = pros?.find((p: any) => p.id === original.professional_id);
        if (!targetPro && pros?.length === 1) targetPro = pros[0];
    }

    const duration = original.services?.duration_minutes || 30;
    const newStart = timeToMinutes(cleanTime);
    const newEnd = newStart + duration;

    const { data: conflictCheck } = await supabase.from('appointments')
        .select('id, appointment_time, professional_id, services(duration_minutes)')
        .eq('appointment_date', new_date).eq('user_id', userId)
        .neq('id', appointment_id).neq('status', 'Cancelado');

    for (const appt of (conflictCheck || [])) {
        if (targetPro && appt.professional_id !== targetPro.id) continue;
        const apptStart = timeToMinutes(appt.appointment_time);
        const apptEnd = apptStart + (appt.services?.duration_minutes || 30);
        if (newStart < apptEnd && newEnd > apptStart) {
            return { success: false, reason: `Conflito: já existe agendamento às ${appt.appointment_time?.substring(0, 5)} neste dia.` };
        }
    }

    const { error } = await supabase.from('appointments').update({
        professional_id: targetPro?.id || original.professional_id || null,
        pro_name: targetPro?.name || original.pro_name || 'A definir',
        appointment_date: new_date,
        appointment_time: cleanTime,
        status: 'Confirmado'
    }).eq('id', appointment_id);

    if (error) return { success: false, reason: "Erro ao atualizar: " + error.message };

    // Notificação para o sistema (Painel)
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Reagendamento via IA',
        message: `Agendamento de ${original.services?.name} reagendado para ${new Date(new_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${new_time}.`
    });

    return { success: true, message: `Reagendado com sucesso para ${new Date(new_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${new_time}.` };
}

export async function handleCancelAppointment(supabase: any, userId: string, args: any, cleanPhone?: string) {
    let { appointment_id, reason } = args;

    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        const appts = apptsResult?.appointments || [];
        if (appts.length === 0) return { success: false, reason: "Você não possui agendamentos ativos para cancelar." };
        if (args.original_date) {
            const match = appts.find((a: any) => a.date_iso === args.original_date);
            if (match) appointment_id = match.id;
            else return { success: false, reason: "A data informada não bate com nenhum agendamento ativo." };
        } else if (appointment_id && !isNaN(parseInt(appointment_id)) && appointment_id.length <= 2) {
            const idx = parseInt(appointment_id) - 1;
            if (appts[idx]) appointment_id = appts[idx].id;
            else return { success: false, reason: "Índice de agendamento não encontrado." };
        } else if (appts.length === 1) {
            appointment_id = appts[0].id;
        } else {
            return { success: false, reason: "Especifique a data do agendamento que deseja cancelar." };
        }
    }

    const { data: original } = await supabase.from('appointments')
        .select('id, pro_name, services(name)')
        .eq('id', appointment_id).eq('user_id', userId).single();

    if (!original) return { success: false, reason: "Agendamento não encontrado." };

    const updateData: any = { status: 'Cancelado' };
    if (reason) updateData.cancelled_reason = reason;

    const { error: cancelError } = await supabase.from('appointments').update(updateData).eq('id', appointment_id);
    if (cancelError) return { success: false, reason: "Erro ao cancelar: " + cancelError.message };

    // Notificação para o sistema (Painel)
    await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Cancelamento via IA',
        message: `Agendamento de ${original.services?.name} com ${original.pro_name} foi cancelado pela IA.`
    });

    return { success: true, message: `Agendamento de ${original.services?.name} com ${original.pro_name} cancelado com sucesso.` };
}
