import { createClient } from "npm:@supabase/supabase-js@2";

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
               logDb(sp, 'ERROR', "Erro HTTP WhatsApp Lembrete", { status: response.status, statusText: response.statusText });
            }
        } catch (err: any) { 
            success = false;
            logDb(sp, 'ERROR', "Erro Fetch WhatsApp Lembrete", { err: err.message }); 
        }
        await new Promise(r => setTimeout(r, 600));
    }
    return success;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    // Autenticação com o Service Role Key para poder ler settings em background
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(JSON.stringify({ error: 'Configuração do Supabase ausente' }), { status: 500, headers: corsHeaders });
    }

    const sp = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Buscar todas as configurações onde o lembrete automático está ativado
        const { data: settingsList, error: settingsError } = await sp
            .from('settings')
            .select('*')
            .eq('reminder_active', true);
            
        if (settingsError || !settingsList || settingsList.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum lembrete automático ativo encontrado." }), { headers: corsHeaders, status: 200 });
        }

        const now = new Date();
        const results = [];

        // Para cada configuração ativa (geralmente 1 por usuário/clínica)
        for (const st of settingsList) {
            const minutesAhead = st.reminder_minutes || 60;

            // Busca configurações da inteligência (onde geralmente o provider está completo)
            const { data: aiSettings } = await sp
                .from('ai_agent_settings')
                .select('*')
                .eq('user_id', st.user_id)
                .limit(1)
                .maybeSingle();

            const pType = st.whatsapp_provider_type || aiSettings?.provider_type;
            const pUrl = st.whatsapp_provider_url || aiSettings?.provider_url;
            const pInst = st.whatsapp_provider_instance || aiSettings?.provider_instance;
            const pToken = st.whatsapp_provider_token || aiSettings?.provider_token;
            
            // Converter a data UTC atual para o fuso brasileiro (onde a tabela local possivelmente está operando - GMT-3)
            // No banco de dados, 'appointment_date' está salvo como string 'YYYY-MM-DD'
            // 'appointment_time' é string 'HH:mm'

            // Para que o supabase compare a data certa:
            // Pegamos o NOW (UTC real)
            const todayStr = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().split('T')[0];

            const { data: appointments, error: apptError } = await sp
                .from('appointments')
                .select(`
                    id, 
                    client_id, 
                    appointment_date, 
                    appointment_time, 
                    services(name), 
                    professionals(name), 
                    clients(name, phone)
                `)
                .in('status', ['Confirmado', 'Pendente'])
                .eq('reminder_sent', false)
                .eq('appointment_date', todayStr);

            if (apptError || !appointments || appointments.length === 0) {
                continue;
            }

            for (const app of appointments) {
                // Cálculo de tempo para verificar se cai na janela do lembrete
                const appDateStr = app.appointment_date;
                const appTimeStr = app.appointment_time.length === 5 ? app.appointment_time + ":00" : app.appointment_time;
                
                // appDateTimeUTC inicia assumindo q o horario do banco é UTC
                // ex: appDateStr="2026-03-16", appTimeStr="10:25:00" -> vira 10:25 UTC
                const appDateTimeUTC = new Date(`${appDateStr}T${appTimeStr}Z`);
                
                // Ajustamos somando 3 horas para transformar "10:25 UTC virtual" em "13:25 UTC" (que é o correspondente a 10:25 BRT real)
                appDateTimeUTC.setTime(appDateTimeUTC.getTime() + 3 * 3600 * 1000);

                // A diferença no mundo real (UTC)
                const diffMs = appDateTimeUTC.getTime() - now.getTime();
                const diffMins = Math.floor(diffMs / 60000);

                // Se faltam exatamente (ou menos) os minutos configurados, e o compromisso não passou (diffMins > 0)
                if (diffMins > 0 && diffMins <= minutesAhead) {
                    const client = Array.isArray(app.clients) ? app.clients[0] : app.clients;
                    if (!client || !client.phone) continue;

                    const clientName = client.name ? client.name.split(' ')[0] : 'Cliente';
                    const serviceName = app.services?.name || 'Serviço';
                    const proName = app.professionals?.name || 'Profissional';
                    const timeShort = app.appointment_time.slice(0, 5);

                    // Mensagem a ser enviada
                    const msg = `Olá *${clientName}*! Tudo bem?\n\nEsse é um lembrete automático do seu agendamento de *${serviceName}* hoje às *${timeShort}* com *${proName}*.\n\nPor favor, *confirme* ou *reagende* respondendo a esta mensagem. Esperamos por você!`;

                    // Tratar número de WhatsApp
                    let jid = client.phone.replace(/\D/g, '');
                    if (jid.startsWith('55') && jid.length >= 12) {
                        jid = `${jid}@s.whatsapp.net`;
                    } else if (jid.length >= 10) {
                        jid = `55${jid}@s.whatsapp.net`;
                    }

                    // Enviar notificação se tiver credenciais
                    if (pType && pUrl && pInst && pToken) {
                        const sentObj = await sendWhatsApp(sp, pType, pUrl, pInst, pToken, jid, msg);
                        if (sentObj) {
                            // Atualizar banco apenas se enviou
                            await sp.from('appointments').update({ reminder_sent: true }).eq('id', app.id);
                            
                            // Adicionar o Lembrete ao histórico da IA, para ela ter Mnemônica
                            await sp.from('ai_chat_history').insert({
                                user_id: st.user_id,
                                sender_number: jid,
                                role: 'assistant',
                                content: msg
                            });

                            results.push(`Sent lembrete para ${clientName} (${jid})`);
                        }
                    } else {
                        results.push(`Ignorado lembrete para ${clientName} (${jid}) - sem credenciais de provider ativas`);
                    }
                }
            }
        }
        
        return new Response(JSON.stringify({ success: true, verified: results.length, details: results }), { headers: corsHeaders, status: 200 });

    } catch (e: any) {
        await logDb(sp, 'ERROR', "Fatal Cron Reminder Worker", { err: e.message });
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
