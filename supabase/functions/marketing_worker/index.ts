import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logDb(sp: any, lv: string, msg: string, p?: any) {
    try { await sp.from('debug_logs').insert({ level: lv, message: msg, payload: p }); } catch (e) {}
}

function interpolateMessage(template: string, client: any, services: any[], selectedIds: string[], discountType: string | null, discountValue: number | null, validUntil: string | null, comboName: string | null) {
    const selectedServices = services.filter(s => selectedIds.includes(s.id));
    const svcNames = selectedServices.map(s => s.name).join(', ') || 'Serviço Especial';
    const svcLabel = comboName || svcNames;
    const originalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
    
    let promo = originalPrice;
    if (discountType === 'percent' && discountValue) promo = originalPrice * (1 - discountValue / 100);
    if (discountType === 'fixed' && discountValue) promo = originalPrice - discountValue;
    
    // Simple BRL formatter for Deno
    const formatBRL = (v: number) => v.toFixed(2).replace('.', ',');
    const validStr = validUntil ? new Date(validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data não definida';
    
    const clientName = client.name ? client.name.split(' ')[0] : 'Cliente';

    return template
        .replace(/\{\{nome\}\}/g, clientName)
        .replace(/\{\{servico\}\}/g, svcLabel)
        .replace(/\{\{preco_original\}\}/g, formatBRL(originalPrice))
        .replace(/\{\{preco_promocional\}\}/g, formatBRL(promo))
        .replace(/\{\{validade\}\}/g, validStr);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(JSON.stringify({ error: 'Configuração do Supabase ausente' }), { status: 500, headers: corsHeaders });
    }

    const sp = createClient(supabaseUrl, supabaseServiceKey);
    const results = [];

    try {
        const now = new Date();
        const nowISO = now.toISOString();

        // DEV DEBUG LOG:
        const { data: allScheduled } = await sp.from('promotions').select('*').eq('status', 'scheduled');
        await logDb(sp, 'INFO', `Worker running: nowISO=${nowISO}`, { totalScheduled: allScheduled?.length || 0, first: allScheduled && allScheduled.length > 0 ? allScheduled[0] : null });

        // Fetch promotions that are scheduled AND their time has come or passed
        const { data: promotions, error: promoErr } = await sp
            .from('promotions')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_at', nowISO);

        if (promoErr) throw promoErr;
        
        if (!promotions || promotions.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhuma campanha agendada para enviar agora." }), { headers: corsHeaders, status: 200 });
        }

        // Fetch settings (we assume singular local business structure)
        const { data: settings } = await sp
            .from('settings')
            .select('whatsapp_provider_url, whatsapp_provider_instance, whatsapp_provider_token')
            .limit(1)
            .maybeSingle();

        if (!settings?.whatsapp_provider_url || !settings?.whatsapp_provider_token || !settings?.whatsapp_provider_instance) {
            await logDb(sp, 'ERROR', 'Marketing Worker falhou: Evolution API não configurada');
            return new Response(JSON.stringify({ error: "Evolution API credentials missing." }), { status: 500, headers: corsHeaders });
        }

        const apiBase = settings.whatsapp_provider_url.replace(/\/$/, '');
        const apiUrl = `${apiBase}/message/sendText/${settings.whatsapp_provider_instance}`;

        // Prepare context data
        // Fetch all services just in case we need them for interpolation
        const { data: allServices } = await sp.from('services').select('id, name, price');
        // Fetch all clients if target_type is all
        const { data: allClients } = await sp.from('clients').select('id, name, phone').eq('is_active', true);

        for (const promo of promotions) {
            let targetClients = [];
            
            if (promo.target_type === 'all') {
                targetClients = allClients || [];
            } else if (promo.target_client_ids && promo.target_client_ids.length > 0) {
                targetClients = (allClients || []).filter((c: any) => promo.target_client_ids.includes(c.id));
            }

            if (targetClients.length === 0) {
                // Sent with zero clients... Still mark it as sent so we don't pick it up again
                await sp.from('promotions').update({ status: 'sent', sent_at: nowISO }).eq('id', promo.id);
                continue;
            }

            results.push(`Iniciando envio para campanha ${promo.id}`);
            
            // Loop through each client and dispatch
            for (const client of targetClients) {
                if (!client.phone) continue;

                const messageText = interpolateMessage(
                    promo.message_template,
                    client,
                    allServices || [],
                    promo.service_ids,
                    promo.discount_type,
                    promo.discount_value,
                    promo.valid_until,
                    promo.combo_name
                );

                let phone = client.phone.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = phone.slice(1);
                if (phone.length <= 11) phone = '55' + phone;

                let sendSuccess = false;
                let errMsg = null;

                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': settings.whatsapp_provider_token
                        },
                        body: JSON.stringify({
                            number: phone,
                            text: messageText,
                            delay: 5000 // use a small delay via API property if supported, or we just delay the loop
                        })
                    });

                    if (response.ok) {
                        sendSuccess = true;
                    } else {
                        const err = await response.text();
                        errMsg = `HTTP ${response.status}: ${err}`;
                        await logDb(sp, 'ERROR', `Marketing Disparo Error (HTTP)`, { status: response.status, body: err });
                    }
                } catch (e: any) {
                    errMsg = e.message;
                    await logDb(sp, 'ERROR', `Marketing Disparo Network Error`, { err: e.message });
                }

                // Log into promotion_dispatches
                await sp.from('promotion_dispatches').insert({
                    promotion_id: promo.id,
                    client_id: client.id,
                    client_name: client.name,
                    client_phone: client.phone,
                    status: sendSuccess ? 'sent' : 'failed',
                    error_message: errMsg
                });

                // Anti-ban delay: 5 seconds between dispatches for marketing
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Mark promotion as sent
            await sp.from('promotions').update({ status: 'sent', sent_at: nowISO }).eq('id', promo.id);
            results.push(`Campanha ${promo.id} finalizada`);
        }

        return new Response(JSON.stringify({ success: true, details: results }), { headers: corsHeaders, status: 200 });

    } catch (e: any) {
        await logDb(sp, 'ERROR', "Fatal Cron Marketing Worker", { err: e.message });
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
