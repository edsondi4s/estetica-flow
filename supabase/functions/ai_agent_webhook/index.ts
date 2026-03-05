import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import OpenAI from "npm:openai@^4.0.0"
import Anthropic from "npm:@anthropic-ai/sdk@^0.18.0"
// Usando fetch nativo temporário para o Gemini p/ evitar erro de compilação da CLI

import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function logToDb(supabase: any, level: string, message: string, payload?: any, agentSettings?: any) {
    if (agentSettings && agentSettings.enable_logs !== true) {
        if (level !== 'ERROR') return;
    }
    if (!agentSettings && level === 'INFO') return;

    try {
        await supabase.from('debug_logs').insert({ level, message, payload });
    } catch (e) {
        console.error("Erro ao logar no DB:", e);
    }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey)

  await logToDb(supabase, "INFO", "Nova requisição recebida");
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    await logToDb(supabase, "INFO", "Payload recebido", payload);
    
    if (!payload || !payload.instance) {
        await logToDb(supabase, "WARN", "Payload inválido ou sem instância.");
        return new Response('OK - No instance', { headers: corsHeaders });
    }

    const instanceName = payload.instance;
    const messageData = payload.data?.messages?.[0] || payload.data;
    
    if (!messageData || !messageData.key || messageData.key.fromMe) {
        await logToDb(supabase, "INFO", "Mensagem ignorada (fromMe ou sem dados).", { instanceName, messageData });
        return new Response('Not processed', { headers: corsHeaders })
    }

    const senderNumber = messageData.key.remoteJidAlt || messageData.key.remoteJid;
    const textMessage = messageData.message?.conversation || 
                      messageData.message?.extendedTextMessage?.text ||
                      messageData.message?.imageMessage?.caption ||
                      payload.data?.content ||
                      '';

    await logToDb(supabase, "INFO", "Mensagem recebida", { senderNumber, textMessage });

    if (!textMessage) {
        await logToDb(supabase, "WARN", "Texto vazio.", { senderNumber });
        return new Response('No text', { headers: corsHeaders })
    }

    // 2. Buscar configurações do robô
    await logToDb(supabase, "INFO", "Buscando bot para instância", { instanceName });
    const { data: agentSettings, error: agentError } = await supabase
        .from('ai_agent_settings')
        .select('*')
        .eq('provider_instance', instanceName)
        .eq('is_active', true)
        .single();

    if (agentError || !agentSettings) {
        await logToDb(supabase, "WARN", "Bot inativo ou missing para instancia", { instanceName, error: agentError });
        return new Response('Bot inactive or missing', { headers: corsHeaders });
    }

    // 2.5 Verificar se é uma resposta de confirmação de lembrete
    const cleanSenderNumber = senderNumber.split('@')[0];
    const msgNorm = textMessage.trim().toUpperCase();
    const isConfirmation = ['SIM', 'SIM!', 'CONFIRMO', 'CONFIRMADO', 'OK', 'PODE CONFIRMAR', 'QUERO CONFIRMAR'].some(k => msgNorm.startsWith(k));
    const isCancellation = ['NÃO', 'NAO', 'CANCELAR', 'QUERO CANCELAR', 'REAGENDAR'].some(k => msgNorm.startsWith(k));

    if (isConfirmation || isCancellation) {
        // Buscar o agendamento pendente mais recente deste cliente
        const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', cleanSenderNumber)
            .eq('user_id', agentSettings.user_id)
            .single();

        if (clientData) {
            const today = new Date().toISOString().split('T')[0];
            const { data: pendingAppt } = await supabase
                .from('appointments')
                .select('id')
                .eq('client_id', clientData.id)
                .eq('user_id', agentSettings.user_id)
                .eq('reminder_sent', true)
                .gte('appointment_date', today)
                .order('appointment_date', { ascending: true })
                .limit(1)
                .single();

            if (pendingAppt) {
                const newStatus = isConfirmation ? 'Confirmado' : 'Cancelado';
                await supabase
                    .from('appointments')
                    .update({ status: newStatus })
                    .eq('id', pendingAppt.id);

                const replyMessage = isConfirmation
                    ? `✅ Perfeito! Seu agendamento foi *confirmado*. Te esperamos! 💆‍♀️`
                    : `Tudo bem! Seu agendamento foi *cancelado*. Quando quiser reagendar, é só chamar! 😊`;

                await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, replyMessage);
                await logToDb(supabase, "INFO", `Agendamento ${newStatus} via resposta de lembrete`, { apptId: pendingAppt.id });
                return new Response(JSON.stringify({ success: true, action: `appointment_${newStatus.toLowerCase()}` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
    }

    // 3. Buscar Dados Dinâmicos e Histórico
    const { data: historyData } = await supabase
        .from('ai_chat_history')
        .select('role, content')
        .eq('sender_number', senderNumber)
        .eq('user_id', agentSettings.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

    // Filtrar histórico: remover mensagens contaminadas com XML de tool_calls e estados internos
    const history = (historyData || []).reverse().filter((h: any) => {
        if (h.role === 'assistant' && h.content && h.content.includes('<tool_call>')) return false;
        if (h.role === '__rstate__') return false; // estados internos de reagendamento
        return true;
    });

    // --- PRÉ-PROCESSADOR: Máquina de Estado de Reagendamento ---
    // Buscar estado de reagendamento pendente
    const { data: rStateData } = await supabase
        .from('ai_chat_history')
        .select('content, created_at')
        .eq('sender_number', senderNumber)
        .eq('user_id', agentSettings.user_id)
        .eq('role', '__rstate__')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Helpers de extração de data/hora
    const extractDateFromText = (text: string): string | null => {
        // Formato DD/MM ou DD/MM/YYYY
        const dmMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
        if (dmMatch) {
            const day = dmMatch[1].padStart(2, '0');
            const month = dmMatch[2].padStart(2, '0');
            const year = dmMatch[3] || new Date().getFullYear().toString();
            return `${year}-${month}-${day}`;
        }
        return null;
    };
    const extractTimeFromText = (text: string): string | null => {
        const tMatch = text.match(/(\d{1,2})[:h](\d{2})/i) || text.match(/(\d{1,2})\s*horas?/i);
        if (tMatch) return `${tMatch[1].padStart(2,'0')}:${(tMatch[2] || '00').padStart(2,'0')}`;
        return null;
    };
    const isUserConfirming = (text: string): boolean => {
        return /\b(sim|pode|confirmo|confirmado|ok|isso|perfeito|certo|quero|vai|pode ser|beleza|combinado)\b/i.test(text);
    };

    if (rStateData?.content) {
        try {
            const rState = JSON.parse(rStateData.content);
            // rState = { step: 'awaiting_datetime'|'awaiting_confirmation', appointments, selectedApptId, newDate, newTime }

            if (rState.step === 'awaiting_datetime') {
                // Verificar se o usuário forneceu data e hora
                const newDate = extractDateFromText(textMessage);
                const newTime = extractTimeFromText(textMessage);

                if (newDate && newTime) {
                    // Temos data e hora — verificar disponibilidade diretamente
                    const { data: servD } = await supabase.from('services').select('id, name, price, duration_minutes').eq('user_id', agentSettings.user_id).eq('is_active', true);
                    const { data: prosD } = await supabase.from('professionals').select('id, name, specialty').eq('user_id', agentSettings.user_id).eq('is_active', true);
                    const { data: hoursD } = await supabase.from('business_hours').select('day_of_week, start_time, end_time, is_working_day').eq('user_id', agentSettings.user_id);

                    // Identificar a appointment selecionada pelo contexto
                    const appts = rState.appointments;
                    let selectedAppt = appts[0]; // default: primeira

                    // Tentar identificar pelo que foi mencionado no texto do usuário
                    for (const appt of appts) {
                        const svcName = appt.service.toLowerCase();
                        const proName = appt.professional.toLowerCase();
                        if (textMessage.toLowerCase().includes(svcName) || textMessage.toLowerCase().includes(proName)) {
                            selectedAppt = appt;
                            break;
                        }
                    }

                    // Verificar disponibilidade
                    const avail = await handleCheckAvailability(supabase, agentSettings.user_id,
                        { date: newDate, time: newTime, service_name: selectedAppt.service, professional_name: selectedAppt.professional },
                        servD, prosD, hoursD);

                    if (!avail.available) {
                        const replyText = `❌ Desculpe, *${newTime}* do dia *${newDate.split('-').reverse().join('/')}* não está disponível. ${avail.reason || ''} Por favor, escolha outra data ou horário.`;
                        await supabase.from('ai_chat_history').insert([
                            { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'user', content: textMessage },
                            { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'assistant', content: replyText }
                        ]);
                        await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, replyText);
                        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }

                    // Disponível! Avançar para confirmação
                    const newRState = {
                        step: 'awaiting_confirmation',
                        appointments: appts,
                        selectedApptId: selectedAppt.id,
                        selectedService: selectedAppt.service,
                        selectedProfessional: selectedAppt.professional,
                        newDate,
                        newTime,
                        originalDate: selectedAppt.date,
                    };
                    await supabase.from('ai_chat_history').delete().eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');
                    await supabase.from('ai_chat_history').insert({ user_id: agentSettings.user_id, sender_number: senderNumber, role: '__rstate__', content: JSON.stringify(newRState) });

                    const dateFormatted = new Date(newDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
                    const confirmText = `✅ Ótimo! O horário de *${newTime}* na *${dateFormatted}* está disponível para *${selectedAppt.service}*${selectedAppt.professional !== 'A definir' ? ` com *${selectedAppt.professional}*` : ''}.\n\nPosso confirmar o reagendamento? _(Responda: Sim / Não)_`;

                    await supabase.from('ai_chat_history').insert([
                        { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'user', content: textMessage },
                        { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'assistant', content: confirmText }
                    ]);
                    await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, confirmText);
                    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                // Sem data/hora: deixa a IA perguntar
            }

            if (rState.step === 'awaiting_confirmation' && isUserConfirming(textMessage)) {
                // Confirmar o reagendamento!
                const { data: servD } = await supabase.from('services').select('id, name, price, duration_minutes').eq('user_id', agentSettings.user_id).eq('is_active', true);
                const { data: prosD } = await supabase.from('professionals').select('id, name, specialty').eq('user_id', agentSettings.user_id).eq('is_active', true);
                const { data: hoursD } = await supabase.from('business_hours').select('day_of_week, start_time, end_time, is_working_day').eq('user_id', agentSettings.user_id);

                const result = await handleRescheduleAppointment(supabase, agentSettings.user_id,
                    { appointment_id: rState.selectedApptId, new_date: rState.newDate, new_time: rState.newTime },
                    servD, prosD, hoursD);

                // Limpar estado
                await supabase.from('ai_chat_history').delete().eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');

                const replyText = result.success
                    ? `🎉 Perfeito! Seu *${rState.selectedService}* foi reagendado com sucesso!\n\n📅 ${new Date(rState.newDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às *${rState.newTime}*${rState.selectedProfessional !== 'A definir' ? `\n👩‍⚕️ Com ${rState.selectedProfessional}` : ''}\n\nTe esperamos! 💆‍♀️`
                    : `❌ Não consegui reagendar: ${result.reason}. Deseja tentar outro horário?`;

                await supabase.from('ai_chat_history').insert([
                    { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'user', content: textMessage },
                    { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'assistant', content: replyText }
                ]);
                await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, replyText);
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (rState.step === 'awaiting_confirmation' && /\b(n[aã]o|nope|cancela|desisto)\b/i.test(textMessage)) {
                // Usuário cancelou
                await supabase.from('ai_chat_history').delete().eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');
                const replyText = 'Tudo bem! O reagendamento foi cancelado. Se precisar de algo mais, é só chamar! 😊';
                await supabase.from('ai_chat_history').insert([
                    { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'user', content: textMessage },
                    { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'assistant', content: replyText }
                ]);
                await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, replyText);
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        } catch (stateErr: any) {
            await logToDb(supabase, "ERROR", "Erro ao processar estado de reagendamento", { error: stateErr.message });
            // Limpar estado corrompido e continuar normalmente
            await supabase.from('ai_chat_history').delete().eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');
        }
    }
    // --- FIM DA MÁQUINA DE ESTADO ---

    const { data: kbData } = await supabase
        .from('ai_knowledge_base')
        .select('title, content')
        .eq('user_id', agentSettings.user_id);

    const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes')
        .eq('user_id', agentSettings.user_id)
        .eq('is_active', true);

    const { data: hoursData } = await supabase
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_working_day')
        .eq('user_id', agentSettings.user_id);

    const { data: prosData } = await supabase
        .from('professionals')
        .select('id, name, specialty')
        .eq('user_id', agentSettings.user_id)
        .eq('is_active', true);

    const cleanNumberForClient = senderNumber.split('@')[0];
    const { data: existingClient } = await supabase
        .from('clients')
        .select('name')
        .eq('phone', cleanNumberForClient)
        .eq('user_id', agentSettings.user_id)
        .single();

    let contextText = '\n\n--- INFORMAÇÕES REAIS DO SISTEMA (ESTRITO) ---\n';
    
    if (existingClient?.name) {
        contextText += `CLIENTE IDENTIFICADO: Você está falando com o usuário registrado como "${existingClient.name}". NÃO pergunte o nome para agendar, assuma este nome e confirme diretamente.\n\n`;
    }
    
    contextText += "SERVIÇOS DISPONÍVEIS:\n" + 
                  (servicesData?.map((s: any) => `- ${s.name}: R$ ${s.price} (${s.duration_minutes} min)`).join('\n') || "Nenhum serviço cadastrado") + "\n\n";
    
    const daysMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    contextText += "HORÁRIOS DE ATENDIMENTO:\n" + 
                  (hoursData?.map((h: any) => `- ${daysMap[h.day_of_week]}: ${h.is_working_day ? `${h.start_time.substring(0,5)} às ${h.end_time.substring(0,5)}` : 'Fechado'}`).join('\n') || "Não configurado") + "\n\n";

    contextText += "PROFISSIONAIS:\n" + 
                  (prosData?.map((p: any) => `- ${p.name} (${p.specialty || 'Geral'})`).join('\n') || "Nenhum profissional cadastrado") + "\n";

    if (kbData && kbData.length > 0) {
        contextText += "\nOUTRAS INFORMAÇÕES:\n" + 
                      kbData.map((kb: any) => `${kb.title}: ${kb.content}`).join('\n');
    }
    contextText += "\n-----------------------------------------------\n";

    const basePrompt = agentSettings.system_prompt || "Você é um assistente de clínica de estética.";
    const now = new Date();
    // Ajuste para o fuso de Brasília (GMT-3) - simplificado para o prompt
    const dateBr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(now);
    const dateIso = now.toISOString().split('T')[0];

    const restrictionPrompt = `
DATA/HORA ATUAL: ${dateBr} (Hoje é ${dateIso})

REGRAS CRÍTICAS DE INTEGRIDADE:
1. Responda APENAS com base nas informações fornecidas no contexto acima.
2. PROIBIÇÃO DE ALUCINAÇÃO: Nunca diga "Agendado", "Confirmado" ou "Marcado" se as ferramentas 'book_appointment', 'reschedule_appointment' ou 'cancel_appointment' não retornarem 'success: true'. Se você apenas verificou disponibilidade, diga apenas que "está disponível" e peça para confirmar.
3. CONFIANÇA NO BANCO: O resultado de 'get_client_appointments' é a ÚNICA verdade. Sempre que o cliente perguntar, listar ou falar sobre seus agendamentos atuais, VOCÊ DEVE OBRIGATORIAMENTE chamar 'get_client_appointments'. NUNCA liste agendamentos de cabeça ou memória! Se algo foi mencionado na conversa mas não está no retorno desta função, ele NÃO EXISTE.
4. FLUXO DE NOVO AGENDAMENTO:
   a) Verifique se o serviço, data e hora estão claros. Se não, pergunte.
   b) Use a função 'check_availability'.
   c) Se disponível, informe ao cliente e PEÇA CONFIRMAÇÃO (ex: "Posso marcar para você?").
   d) ASSIM QUE O CLIENTE DISSER "SIM", chame IMEDIATAMENTE 'book_appointment'. Você só pode confirmar após o retorno desta função.
5. FLUXO DE REAGENDAMENTO:
   a) Sempre chame 'get_client_appointments' antes de falar sobre agendamentos existentes.
   b) Use 'check_availability' para o novo horário.
   c) Após o "Sim" do cliente, chame 'reschedule_appointment'.
6. O ano atual é ${now.getFullYear()}.
`;

    const finalSystemPrompt = `${basePrompt}${contextText}${restrictionPrompt}`;

    // 4. Definição de Tools
    const tools: any[] = [
        {
            type: "function",
            function: {
                name: "check_availability",
                description: "Verifica se há vaga para um serviço em uma data e hora específica.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                        time: { type: "string", description: "Hora no formato HH:mm" },
                        service_name: { type: "string", description: "Nome do serviço desejado" },
                        professional_name: { type: "string", description: "Nome do profissional (opcional)" }
                    },
                    required: ["date", "time", "service_name"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "book_appointment",
                description: "EFETIVA a reserva no banco de dados. Chame esta função APENAS após o cliente confirmar explicitamente (ex: 'Sim', 'Pode marcar') após você ter verificado a disponibilidade.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                        time: { type: "string", description: "Hora no formato HH:mm" },
                        service_name: { type: "string", description: "Nome do serviço" },
                        professional_name: { type: "string", description: "Nome do profissional" },
                        client_name: { type: "string", description: "Nome completo do cliente" }
                    },
                    required: ["date", "time", "service_name", "client_name"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "get_client_appointments",
                description: "Busca todos os agendamentos em aberto (Pendente ou Confirmado) do cliente que está conversando agora. Use esta função quando o cliente quiser reagendar, remarcar ou alterar um agendamento.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        },
        {
            type: "function",
            function: {
                name: "reschedule_appointment",
                description: "Reagenda um agendamento existente do cliente para uma nova data e hora. Cancela o agendamento antigo e cria um novo verificando disponibilidade.",
                parameters: {
                    type: "object",
                    properties: {
                        appointment_id: { type: "string", description: "O ID único (UUID) do agendamento informado em get_client_appointments. NÃO use número da lista." },
                        original_date: { type: "string", description: "A data original do agendamento que deseja ser remarcado (YYYY-MM-DD). Envie isso se não possuir o appointment_id." },
                        new_date: { type: "string", description: "Nova data no formato YYYY-MM-DD" },
                        new_time: { type: "string", description: "Novo horário no formato HH:mm" },
                        professional_name: { type: "string", description: "Nome do profissional (opcional, mantém o mesmo se não informado)" }
                    },
                    required: ["new_date", "new_time"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "cancel_appointment",
                description: "Cancela um agendamento existente do cliente.",
                parameters: {
                    type: "object",
                    properties: {
                        appointment_id: { type: "string", description: "O ID único (UUID) do agendamento. NÃO use número da lista." },
                        original_date: { type: "string", description: "A data original do agendamento a ser cancelado (YYYY-MM-DD). Envie isso se não possuir o appointment_id." },
                        reason: { type: "string", description: "Motivo opcional do cancelamento informado pelo cliente." }
                    },
                    required: []
                }
            }
        }
    ];

    // 5. Preparar Mensagens com Histórico
    const messages = [
        { role: 'system', content: finalSystemPrompt },
        ...history.map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: textMessage }
    ];

    // 6. Integração com a IA
    let aiResponseText = '';
    const aiProvider = agentSettings.ai_provider;
    const aiApiKey = agentSettings.ai_api_key;
    const aiModel = (agentSettings as any).ai_model || 'gpt-4o-mini';

    await logToDb(supabase, "INFO", "Iniciando chamada IA com Memória", { provider: aiProvider, model: aiModel, historyCount: history.length });

    try {
        if (!aiApiKey) {
            aiResponseText = 'Configuração incompleta: falta chave de API.';
        } else {
            let client;
            if (aiProvider === 'openai') {
                client = new OpenAI({ apiKey: aiApiKey });
            } else if (aiProvider === 'groq') {
                client = new OpenAI({ apiKey: aiApiKey, baseURL: "https://api.groq.com/openai/v1" });
            } else if (aiProvider === 'openrouter') {
                client = new OpenAI({ 
                    apiKey: aiApiKey, 
                    baseURL: "https://openrouter.ai/api/v1",
                    defaultHeaders: { "HTTP-Referer": "https://esteticaflow.com.br", "X-Title": "EsteticaFlow AI" }
                });
            }

            if (client) {
                let finalModel = aiModel;
                if (aiProvider === 'openrouter' && (finalModel === 'gpt-4o-mini' || finalModel === 'gpt-4o')) {
                    finalModel = `openai/${finalModel}`;
                }

                const response = await client.chat.completions.create({
                    model: finalModel,
                    messages: messages as any,
                    tools: tools,
                    tool_choice: "auto"
                });

                const msg = response.choices[0].message;
                
                if (msg.tool_calls) {
                    await logToDb(supabase, "INFO", "IA solicitou Tool Call", { calls: msg.tool_calls });
                    
                    const toolMessages = [...messages, msg];

                    for (const toolCall of msg.tool_calls) {
                        const args = JSON.parse(toolCall.function.arguments);
                        let result;

                        if (toolCall.function.name === 'check_availability') {
                            result = await handleCheckAvailability(supabase, agentSettings.user_id, args, servicesData, prosData, hoursData);
                        } else if (toolCall.function.name === 'book_appointment') {
                            result = await handleBookAppointment(supabase, agentSettings.user_id, args, servicesData, prosData, senderNumber);
                        } else if (toolCall.function.name === 'get_client_appointments') {
                            result = await handleGetClientAppointments(supabase, agentSettings.user_id, cleanSenderNumber);
                            // Sincronizar estado para o fluxo de "Sim/Não" do usuário funcionar
                            if (result?.appointments?.length > 0) {
                                await supabase.from('ai_chat_history').delete().eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');
                                await supabase.from('ai_chat_history').insert({
                                    user_id: agentSettings.user_id, sender_number: senderNumber, role: '__rstate__',
                                    content: JSON.stringify({ step: 'awaiting_datetime', appointments: result.appointments })
                                });
                            }
                        } else if (toolCall.function.name === 'reschedule_appointment') {
                            result = await handleRescheduleAppointment(supabase, agentSettings.user_id, args, servicesData, prosData, hoursData, cleanSenderNumber);
                        } else if (toolCall.function.name === 'cancel_appointment') {
                            result = await handleCancelAppointment(supabase, agentSettings.user_id, args, cleanSenderNumber);
                        }

                        toolMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result)
                        });
                    }

                    const secondResponse = await client.chat.completions.create({
                        model: finalModel,
                        messages: toolMessages as any
                    });

                    aiResponseText = secondResponse.choices[0].message.content || '';
                } else {
                    aiResponseText = msg.content || '';
                }
            } else if (aiProvider === 'anthropic' || aiProvider === 'gemini') {
                if (aiProvider === 'anthropic') {
                    const anthropic = new Anthropic({ apiKey: aiApiKey });
                    const res = await anthropic.messages.create({
                        max_tokens: 1024,
                        system: finalSystemPrompt,
                        messages: history.concat([{role: 'user', content: textMessage}]) as any,
                        model: aiModel,
                    });
                    aiResponseText = (res.content[0] as any).text || '';
                } else {
                    const genAI = new GoogleGenerativeAI(aiApiKey.trim());
                    const model = genAI.getGenerativeModel({ model: aiModel });
                    const chatHistory = history.map(h => `${h.role === 'user' ? 'Usuário' : 'IA'}: ${h.content}`).join('\n');
                    const res = await model.generateContent(`Sistema: ${finalSystemPrompt}\n\nHistórico:\n${chatHistory}\n\nUsuário: ${textMessage}`);
                    aiResponseText = res.response.text();
                }
            }
        }
    } catch (aiErr: any) {
        await logToDb(supabase, "ERROR", `Erro no provedor ${aiProvider}`, { 
            error: aiErr.message,
            status: aiErr.status,
            code: aiErr.code,
            type: aiErr.type,
            details: JSON.stringify(aiErr?.error || aiErr?.response?.data || {}).substring(0, 500)
        });
        aiResponseText = "Desculpe, tive um problema técnico. Pode repetir?";
    }

    if (!aiResponseText) aiResponseText = "Como posso ajudar?";

    // 7. Salvar no Histórico
    await supabase.from('ai_chat_history').insert([
        { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'user', content: textMessage },
        { user_id: agentSettings.user_id, sender_number: senderNumber, role: 'assistant', content: aiResponseText }
    ]);

    // 8. Sanitizar e Enviar Resposta WhatsApp
    // --- Detector unificado de tool calls emitidos como texto ---
    const KNOWN_TOOLS = ['get_client_appointments', 'check_availability', 'book_appointment', 'reschedule_appointment', 'cancel_appointment'];
    
    // Detectar se o modelo retornou um nome de ferramenta como texto puro
    const trimmedResponse = aiResponseText.trim();
    const hasXmlToolCall = trimmedResponse.includes('<tool_call>');
    const isPlainToolName = KNOWN_TOOLS.some(t => trimmedResponse === t || trimmedResponse.startsWith(t + '\n') || trimmedResponse.startsWith(t + ' '));
    
    if (hasXmlToolCall || isPlainToolName) {
        await logToDb(supabase, "INFO", "Tool call detectado como texto puro", { format: hasXmlToolCall ? 'xml' : 'plain', text: trimmedResponse.substring(0, 200) });
        
        // Determinar qual ferramenta chamar e extrair args
        let toolName = '';
        let toolArgs: any = {};
        
        if (hasXmlToolCall) {
            // Extrair do XML
            const inner = (trimmedResponse.match(/<tool_call>([\s\S]*?)<\/tool_call>/) || ['', trimmedResponse])[1].trim();
            const firstLine = inner.split('\n')[0].trim();
            toolName = firstLine;
            
            // Tentar JSON
            const jsonMatch = inner.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    // Flat arguments if they are nested in the standard AI response format
                    if (parsed.arguments && typeof parsed.arguments === 'object') {
                        toolArgs = parsed.arguments;
                    } else if (parsed.parameters && typeof parsed.parameters === 'object') {
                        toolArgs = parsed.parameters;
                    } else {
                        toolArgs = parsed;
                    }
                } catch {}
            }
            
            // Tentar <key>val</key>
            if (Object.keys(toolArgs).length === 0) {
                for (const am of inner.matchAll(/<([a-z_]+)>([^<]*)<\/\1>/g)) {
                    if (!['name', 'arg_key', 'tool_call'].includes(am[1])) toolArgs[am[1]] = am[2].trim();
                }
            }
            
            // Nome via <name> tag
            const nameTag = inner.match(/<name>([^<]+)<\/name>/);
            if (nameTag) toolName = nameTag[1];
        } else {
            // Texto puro — extrair nome e tentar JSON na mensagem do usuário
            toolName = trimmedResponse.split('\n')[0].trim();
            
            // Tentar extrair args do próprio texto da mensagem do usuário (ex: data, hora)
            const dateMatch = textMessage.match(/\d{2}\/\d{2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2}/);
            const timeMatch = textMessage.match(/\d{1,2}[:h]\d{2}/);
            if (dateMatch) {
                let d = dateMatch[0];
                if (d.includes('/')) {
                    const parts = d.split('/');
                    const year = parts[2] || new Date().getFullYear().toString();
                    d = `${year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                }
                toolArgs.new_date = d; toolArgs.date = d;
            }
            if (timeMatch) {
                toolArgs.new_time = timeMatch[0].replace('h', ':');
                toolArgs.time = toolArgs.new_time;
            }
        }
        
        // Executar a ferramenta
        let toolResult: any;
        try {
            if (toolName.includes('get_client_appointments')) {
                toolResult = await handleGetClientAppointments(supabase, agentSettings.user_id, cleanSenderNumber);
                // Salvar estado de reagendamento para ativar a máquina de estado no próximo turno
                if (toolResult?.appointments?.length > 0) {
                    await supabase.from('ai_chat_history').delete()
                        .eq('sender_number', senderNumber).eq('user_id', agentSettings.user_id).eq('role', '__rstate__');
                    await supabase.from('ai_chat_history').insert({
                        user_id: agentSettings.user_id, sender_number: senderNumber, role: '__rstate__',
                        content: JSON.stringify({ step: 'awaiting_datetime', appointments: toolResult.appointments })
                    });
                }
            } else if (toolName.includes('check_availability')) {
                toolResult = await handleCheckAvailability(supabase, agentSettings.user_id, toolArgs, servicesData, prosData, hoursData);
            } else if (toolName.includes('book_appointment')) {
                toolResult = await handleBookAppointment(supabase, agentSettings.user_id, toolArgs, servicesData, prosData, senderNumber);
            } else if (toolName.includes('reschedule_appointment')) {
                toolResult = await handleRescheduleAppointment(supabase, agentSettings.user_id, toolArgs, servicesData, prosData, hoursData, cleanSenderNumber);
            } else if (toolName.includes('cancel_appointment')) {
                toolResult = await handleCancelAppointment(supabase, agentSettings.user_id, toolArgs, cleanSenderNumber);
            }
        } catch (te: any) {
            await logToDb(supabase, "ERROR", "Erro ao executar tool call via texto", { error: te.message });
        }
        
        // Fazer nova chamada à IA com o resultado da ferramenta
        if (toolResult) {
            try {
                const baseURL = aiProvider === 'groq'
                    ? 'https://api.groq.com/openai/v1'
                    : aiProvider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1'
                    : undefined;
                const fallbackClient = new OpenAI({ apiKey: aiApiKey, ...(baseURL ? { baseURL } : {}) });
                const fallbackReply = await fallbackClient.chat.completions.create({
                    model: aiModel,
                    messages: [
                        { role: 'system', content: finalSystemPrompt },
                        ...history.map((h: any) => ({ role: h.role as any, content: h.content })),
                        { role: 'user', content: textMessage },
                        { role: 'user', content: `[Sistema]: A ferramenta '${toolName}' retornou: ${JSON.stringify(toolResult)}. Com base nisto, responda ao cliente de forma natural, clara e humanizada em português.` }
                    ]
                });
                aiResponseText = fallbackReply.choices[0].message.content || aiResponseText;
            } catch (fe: any) {
                await logToDb(supabase, "ERROR", "Erro na chamada IA fallback", { error: fe.message });
                // Se falhou mas temos resultado, formatar manualmente
                if (toolResult.appointments?.length > 0) {
                    const list = toolResult.appointments.map((a: any, i: number) => `${i+1}. *${a.service}* — ${a.date} às ${a.time} com ${a.professional}`).join('\n');
                    aiResponseText = `Olá! Encontrei seus agendamentos em aberto:\n\n${list}\n\nQual você deseja reagendar e para qual nova data e hora?`;
                } else if (toolResult.message) {
                    aiResponseText = toolResult.message;
                }
            }
        }
    }

    // Garantia final: nunca enviar tags XML ou nomes de ferramenta ao cliente
    let finalResponseText = aiResponseText
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
        .replace(/<\/?(?:tool_call|arg_key|name|arguments|tool_results)[^>]*>/g, '')
        .trim();
    
    // Se ainda for um nome de ferramenta puro, usar fallback
    if (KNOWN_TOOLS.some(t => finalResponseText === t || finalResponseText.startsWith(t + '\n'))) {
        finalResponseText = 'Estou processando sua solicitação. Pode repetir para mim?';
    }
    
    finalResponseText = finalResponseText || 'Como posso ajudar?';


    await sendWhatsApp(supabase, agentSettings, instanceName, senderNumber, finalResponseText);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    await logToDb(supabase, "CRITICAL", "Webhook error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});

// --- FUNÇÕES AUXILIARES ---

async function sendWhatsApp(supabase: any, settings: any, instance: string, remoteJid: string, text: string) {
    if (settings.provider_type !== 'evolution') return;
    let baseUrl = settings.provider_url || '';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const cleanNumber = remoteJid.split('@')[0];
    const url = `${baseUrl}/message/sendText/${instance}`;
    
    // Humanização: Quebrar textos longos em múltiplas mensagens
    const segments = text.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
            // Delay simulando digitação (min 1s, max 3s)
            const waitTime = Math.min(Math.max(segments[i-1].length * 20, 1000), 3000);
            await delay(waitTime);
        }
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': settings.provider_token },
                body: JSON.stringify({ number: cleanNumber, text: segments[i] })
            });
        } catch (e: any) {
            await logToDb(supabase, "ERROR", "Erro ao enviar WhatsApp", { error: e.message });
        }
    }
}

async function handleCheckAvailability(supabase: any, userId: string, args: any, services: any, pros: any, hours: any) {
    const { date, time } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";
    
    // 1. Validar se o serviço existe
    let service = null;
    if (args.service_id) service = services?.find((s: any) => s.id === args.service_id);
    if (!service) service = services?.find((s: any) => s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    
    if (!service) return { available: false, reason: "Serviço não encontrado no sistema." };

    // 2. Validar Horário de Funcionamento
    const day = new Date(date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) return { available: false, reason: "A clínica não abre neste dia." };

    const cleanTime = time.length === 5 ? time + ":00" : time;
    if (cleanTime < dayHours.start_time || cleanTime > dayHours.end_time) {
        return { available: false, reason: `Fora do horário de expediente (${dayHours.start_time.substring(0,5)} às ${dayHours.end_time.substring(0,5)}).` };
    }

    // 3. Verificar Colisões de Intervalo (Overlap)
    const duration = service.duration_minutes || 30;
    
    // Buscamos agendamentos do dia
    let query = supabase.from('appointments')
        .select('appointment_time, service_id, professional_id, services(duration_minutes)')
        .eq('appointment_date', date)
        .neq('status', 'Cancelado');
    
    // Se profissional for especificado, filtramos por ele
    let targetProId = null;
    let availablePro = null;

    let pro = null;
    if (args.professional_id) pro = pros?.find((p: any) => p.id === args.professional_id);
    else if (professional_name && professional_name !== "Assistente") {
        pro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase()));
    }

    if (pro) {
        targetProId = pro.id;
        availablePro = pro;
        query = query.eq('professional_id', pro.id);
        
        const { data: dayAppointments } = await query;
        if (dayAppointments) {
            const newStart = timeToMinutes(cleanTime);
            const newEnd = newStart + duration;
    
            for (const appt of dayAppointments) {
                const apptStart = timeToMinutes(appt.appointment_time);
                const apptDuration = appt.services?.duration_minutes || 30;
                const apptEnd = apptStart + apptDuration;
    
                // Lógica de Overlap
                if (newStart < apptEnd && newEnd > apptStart) {
                    return { available: false, reason: `O profissional ${pro.name} já possui um agendamento neste horário.` };
                }
            }
        }
    } else {
        // Fallback: Procurar o primeiro profissional disponível
        const { data: allDayAppointments } = await query;
        const newStart = timeToMinutes(cleanTime);
        const newEnd = newStart + duration;

        for (const pro of pros || []) {
            let hasConflict = false;
            if (allDayAppointments) {
                 for (const appt of allDayAppointments) {
                     // Verifica se o compromisso é dele ou se não tem profissional atribuído (bloqueia agenda)
                     if (appt.professional_id === pro.id || !appt.professional_id) {
                         const apptStart = timeToMinutes(appt.appointment_time);
                         const apptDuration = appt.services?.duration_minutes || 30;
                         const apptEnd = apptStart + apptDuration;
             
                         if (newStart < apptEnd && newEnd > apptStart) {
                             hasConflict = true;
                             break;
                         }
                     }
                 }
            }
            if (!hasConflict) {
                 availablePro = pro;
                 targetProId = pro.id;
                 break;
            }
        }
        
        if (!availablePro) {
             return { available: false, reason: `Nenhum profissional disponível neste horário.` };
        }
    }

    return { available: true, service_id: service.id, duration: duration, professional_id: targetProId };
}

function timeToMinutes(timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

async function handleBookAppointment(supabase: any, userId: string, args: any, services: any, pros: any, senderJid: string) {
    const { date, time, client_name } = args;
    const service_name = args.service_name || args.service || "";
    const professional_name = args.professional_name || args.pro || args.professional || "";
    const cleanNumber = senderJid.split('@')[0];

    // 1. Buscar/Criar Cliente
    let { data: client } = await supabase.from('clients').select('id').eq('phone', cleanNumber).single();
    if (!client) {
        const { data: newClient } = await supabase.from('clients').insert({ name: client_name || "Cliente", phone: cleanNumber, user_id: userId }).select().single();
        client = newClient;
    }

    // 2. Resolver IDs
    let service = null;
    if (args.service_id) service = services?.find((s: any) => s.id === args.service_id);
    if (!service && service_name) service = services?.find((s: any) => s.name?.toLowerCase().includes(service_name.toLowerCase?.() || ""));
    
    // Se não informou profissional, ou o informado não existe, tentamos pegar o primeiro disponível ou deixar null
    let pro = null;
    if (args.professional_id) pro = pros?.find((p: any) => p.id === args.professional_id);
    else if (professional_name && professional_name !== "Assistente") {
        pro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase?.() || ""));
    }
    
    // Fallback: Se a clínica tiver apenas um profissional, usa ele por padrão
    if (!pro && pros && pros.length === 1) {
        pro = pros[0];
    }

    if (!service) return { success: false, reason: "Serviço não encontrado." };

    // 3. Inserir Agendamento
    const cleanTime = time.length === 5 ? time + ":00" : time;
    const { error } = await supabase.from('appointments').insert({
        user_id: userId,
        client_id: client.id,
        service_id: service.id,
        professional_id: pro?.id || null,
        pro_name: pro?.name || professional_name || "Assistente",
        appointment_date: date,
        appointment_time: cleanTime,
        status: 'Confirmado'
    });

    if (error) return { success: false, reason: "Erro ao salvar no banco: " + error.message };
    return { success: true, message: "Agendamento realizado com sucesso!" };
}

async function handleGetClientAppointments(supabase: any, userId: string, cleanPhone: string) {
    // 1. Buscar o cliente pelo telefone
    const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('phone', cleanPhone)
        .eq('user_id', userId)
        .single();

    if (!client) {
        return { appointments: [], message: "Nenhum cadastro encontrado para este número." };
    }

    // 2. Buscar agendamentos futuros em aberto
    const today = new Date().toISOString().split('T')[0];
    const { data: appointments } = await supabase
        .from('appointments')
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
            const key = `${a.appointment_date}_${a.appointment_time?.substring(0,5)}_${a.pro_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
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

    return {
        client_name: client.name,
        appointments: formatted,
        message: `Encontrei ${formatted.length} agendamento(s) em aberto para ${client.name}.`
    };
}

async function handleRescheduleAppointment(supabase: any, userId: string, args: any, services: any, pros: any, hours: any, cleanPhone?: string) {
    let { appointment_id, new_date, new_time } = args;
    const professional_name = args.professional_name || args.pro || args.professional || "";

    // RESILIÊNCIA: Fallback se a IA não mandar o UUID correto ou mandar null/undefined
    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        const appts = apptsResult?.appointments || [];
        
        if (appts.length === 0) {
             return { success: false, reason: "Você não possui agendamentos ativos para reagendar." };
        }

        // 1. Prioridade: Tentar encontrar pela data original fornecida
        if (args.original_date) {
             const matchByDate = appts.find((a: any) => a.appointment_date === args.original_date || a.date === args.original_date);
             if (matchByDate) {
                 appointment_id = matchByDate.id;
             } else {
                 return { success: false, reason: "A data original informada não bate com nenhum agendamento ativo." };
             }
        } 
        // 2. Tentar encontrar por índice 1, 2, 3..
        else if (appointment_id && !isNaN(parseInt(appointment_id)) && appointment_id.length <= 2) {
             const index = parseInt(appointment_id) - 1;
             if (appts[index]) {
                  appointment_id = appts[index].id;
             } else {
                  return { success: false, reason: "Índice de agendamento não encontrado." };
             }
        } 
        // 3. Se só tem 1 agendamento, chutar que é ele
        else if (appts.length === 1) {
             appointment_id = appts[0].id;
        } 
        // Falhou
        else {
             return { success: false, reason: "ID de agendamento não reconhecido. Por favor, especifique a data original do agendamento que deseja alterar." };
        }
    }

    // 1. Buscar o agendamento original
    const { data: original } = await supabase
        .from('appointments')
        .select('id, service_id, pro_name, professional_id, client_id, services(name, duration_minutes)')
        .eq('id', appointment_id)
        .eq('user_id', userId)
        .single();

    if (!original) return { success: false, reason: "Agendamento não encontrado." };

    const serviceName = original.services?.name || '';
    const duration = original.services?.duration_minutes || 30;
    const cleanTime = new_time.length === 5 ? new_time + ":00" : new_time;

    // 2. Verificar horário de funcionamento no novo dia
    const day = new Date(new_date).getUTCDay();
    const dayHours = hours?.find((h: any) => h.day_of_week === day);
    if (!dayHours || !dayHours.is_working_day) {
        return { success: false, reason: "A clínica não abre neste dia." };
    }
    if (cleanTime < dayHours.start_time || cleanTime > dayHours.end_time) {
        return { success: false, reason: `Fora do horário de expediente (${dayHours.start_time.substring(0,5)} às ${dayHours.end_time.substring(0,5)}).` };
    }

    // 3. Determinar profissional alvo
    let targetPro: any = null;
    if (professional_name && professional_name !== "Assistente") {
        targetPro = pros?.find((p: any) => p.name?.toLowerCase().includes(professional_name.toLowerCase?.() || ""));
        if (!targetPro) return { success: false, reason: "Profissional não encontrado." };
    } else {
        // Manter o mesmo profissional do agendamento original
        if (original.professional_id) {
            targetPro = pros?.find((p: any) => p.id === original.professional_id);
        }
        // Fallback: única profissional
        if (!targetPro && pros?.length === 1) targetPro = pros[0];
    }

    // 4. Verificar conflito no novo horário
    const newStart = timeToMinutes(cleanTime);
    const newEnd = newStart + duration;

    const { data: conflictCheck } = await supabase
        .from('appointments')
        .select('id, appointment_time, professional_id, services(duration_minutes)')
        .eq('appointment_date', new_date)
        .eq('user_id', userId)
        .neq('id', appointment_id) // excluir o próprio agendamento original
        .neq('status', 'Cancelado');

    if (conflictCheck) {
        for (const appt of conflictCheck) {
            // Só verifica conflito se for do mesmo profissional (ou qualquer um se não há profissional)
            const checkAll = !targetPro;
            if (!checkAll && appt.professional_id !== targetPro?.id) continue;

            const apptStart = timeToMinutes(appt.appointment_time);
            const apptDuration = appt.services?.duration_minutes || 30;
            const apptEnd = apptStart + apptDuration;

            if (newStart < apptEnd && newEnd > apptStart) {
                return {
                    success: false,
                    reason: `Conflito de horário: já existe um agendamento das ${appt.appointment_time?.substring(0,5)} neste dia${targetPro ? ` para ${targetPro.name}` : ''}.`
                };
            }
        }
    }

    // 5. Atualizar o agendamento original
    const { error: updateError } = await supabase
        .from('appointments')
        .update({
            professional_id: targetPro?.id || original.professional_id || null,
            pro_name: targetPro?.name || original.pro_name || 'A definir',
            appointment_date: new_date,
            appointment_time: cleanTime,
            status: 'Confirmado'
        })
        .eq('id', appointment_id);

    if (updateError) return { success: false, reason: "Erro ao atualizar agendamento: " + updateError.message };

    return {
        success: true,
        message: `Reagendamento realizado com sucesso! ${serviceName} remarcado para ${new Date(new_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${new_time}${targetPro ? ` com ${targetPro.name}` : ''}.`
    };
}

async function handleCancelAppointment(supabase: any, userId: string, args: any, cleanPhone?: string) {
    let { appointment_id } = args;

    // RESILIÊNCIA: Fallback se a IA não mandar o UUID correto
    if ((!appointment_id || appointment_id.length !== 36) && cleanPhone) {
        const apptsResult = await handleGetClientAppointments(supabase, userId, cleanPhone);
        const appts = apptsResult?.appointments || [];
        
        if (appts.length === 0) {
             return { success: false, reason: "Você não possui agendamentos ativos para cancelar." };
        }

        // 1. Prioridade: Tentar encontrar pela data original fornecida
        if (args.original_date) {
             const matchByDate = appts.find((a: any) => a.appointment_date === args.original_date || a.date === args.original_date);
             if (matchByDate) {
                 appointment_id = matchByDate.id;
             } else {
                 return { success: false, reason: "A data original informada não bate com nenhum agendamento ativo." };
             }
        } 
        // 2. Tentar encontrar por índice 1, 2, 3..
        else if (appointment_id && !isNaN(parseInt(appointment_id)) && appointment_id.length <= 2) {
             const index = parseInt(appointment_id) - 1;
             if (appts[index]) {
                  appointment_id = appts[index].id;
             } else {
                  return { success: false, reason: "Índice de agendamento não encontrado." };
             }
        } 
        // 3. Se só tem 1 agendamento, chutar que é ele
        else if (appts.length === 1) {
             appointment_id = appts[0].id;
        } 
        // Falhou
        else {
             return { success: false, reason: "ID incerto. Por favor, especifique a data do agendamento que deseja cancelar." };
        }
    }

    const { data: original } = await supabase
        .from('appointments')
        .select('id, pro_name, services(name)')
        .eq('id', appointment_id)
        .eq('user_id', userId)
        .single();

    if (!original) return { success: false, reason: "Agendamento não encontrado." };

    const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment_id);

    if (error) return { success: false, reason: "Erro ao cancelar no banco: " + error.message };

    return { 
        success: true, 
        message: `Agendamento de ${original.services?.name} com ${original.pro_name} cancelado com sucesso.` 
    };
}
