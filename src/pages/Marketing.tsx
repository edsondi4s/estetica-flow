import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Megaphone, Plus, Send, Clock, Users, CheckCircle2, XCircle,
    Loader2, Package, ChevronDown, Calendar, Sparkles, Tag,
    BarChart3, History, X, Edit3, Eye, Trash2, Info, Timer, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Service {
    id: string;
    name: string;
    price: number;
    category: string;
    is_active: boolean;
}
interface Client {
    id: string;
    name: string;
    phone: string;
}
interface Promotion {
    id: string;
    title: string;
    message_template: string;
    service_ids: string[];
    combo_name: string | null;
    discount_type: 'percent' | 'fixed' | null;
    discount_value: number | null;
    valid_until: string | null;
    target_type: 'all' | 'selected';
    target_client_ids: string[];
    status: 'draft' | 'sent' | 'expired' | 'scheduled';
    created_at: string;
    sent_at: string | null;
    scheduled_at: string | null;
}
interface Dispatch {
    id: string;
    promotion_id: string;
    total: number;
    success: number;
    failed: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VARS = ['{{nome}}', '{{servico}}', '{{preco_original}}', '{{preco_promocional}}', '{{validade}}'];

function interpolate(template: string, client: Client, services: Service[], selectedIds: string[], discountType: string | null, discountValue: number | null, validUntil: string | null, comboName: string) {
    const svcNames = services.filter(s => selectedIds.includes(s.id)).map(s => s.name).join(', ') || 'Serviço Especial';
    const svcLabel = comboName || svcNames;
    const originalPrice = services.filter(s => selectedIds.includes(s.id)).reduce((acc, s) => acc + s.price, 0);
    let promo = originalPrice;
    if (discountType === 'percent' && discountValue) promo = originalPrice * (1 - discountValue / 100);
    if (discountType === 'fixed' && discountValue) promo = originalPrice - discountValue;
    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const validStr = validUntil ? new Date(validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data não definida';
    return template
        .replace(/\{\{nome\}\}/g, client.name)
        .replace(/\{\{servico\}\}/g, svcLabel)
        .replace(/\{\{preco_original\}\}/g, `R$ ${formatBRL(originalPrice)}`)
        .replace(/\{\{preco_promocional\}\}/g, `R$ ${formatBRL(promo)}`)
        .replace(/\{\{validade\}\}/g, validStr);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) => (
    <div className={`bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden group hover:border-amber-400/40 transition-all duration-300`}>
        <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-3xl -mr-14 -mt-14 group-hover:bg-amber-500/10 transition-all" />
        <div className="flex items-center gap-4 relative z-10">
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
            </div>
        </div>
    </div>
);

const WhatsAppBubble = ({ text }: { text: string }) => (
    <div className="bg-[#DCF8C6] text-slate-900 rounded-2xl rounded-tl-sm p-4 shadow-sm max-w-xs text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
        {text || <span className="text-slate-400 italic">Sua mensagem aparecerá aqui...</span>}
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const Marketing = () => {
    // Data
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [activeView, setActiveView] = useState<'create' | 'history'>('create');
    const [clientSearch, setClientSearch] = useState('');

    // Stats
    const [stats, setStats] = useState({ total: 0, impacted: 0, active: 0 });

    // Form
    const [title, setTitle] = useState('');
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
    const [comboName, setComboName] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed' | ''>('');
    const [discountValue, setDiscountValue] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [targetType, setTargetType] = useState<'all' | 'selected'>('all');
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [message, setMessage] = useState('Olá {{nome}}! 🌟\n\nTemos uma promoção exclusiva para você: *{{servico}}*\n\nDe: ~{{preco_original}}~\nPor apenas: *{{preco_promocional}}*\n\nPromoção válida até {{validade}}. Agende agora! 💅');
    const [delaySeconds, setDelaySeconds] = useState(5);

    // History Actions
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [viewDetailsPromo, setViewDetailsPromo] = useState<Promotion | null>(null);
    const [promoDispatches, setPromoDispatches] = useState<Dispatch[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Fetch data
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [svcs, cls, promos] = await Promise.all([
                    supabase.from('services').select('id, name, price, category, is_active').eq('is_active', true).order('name'),
                    supabase.from('clients').select('id, name, phone').order('name'),
                    supabase.from('promotions').select('*').order('created_at', { ascending: false })
                ]);
                setServices(svcs.data || []);
                setClients(cls.data || []);
                setPromotions(promos.data || []);

                const sent = (promos.data || []).filter((p: Promotion) => p.status === 'sent');
                const active = (promos.data || []).filter((p: Promotion) => p.status === 'draft' || (p.valid_until && new Date(p.valid_until) >= new Date()));

                if (promos.data && promos.data.length > 0) {
                    supabase.from('debug_logs').insert({ level: 'INFO', message: 'FRONTEND PROMOS DUMP', payload: promos.data }).then(() => console.log('dumped'));
                }

                // Get total impacted from dispatches
                const { count } = await supabase.from('promotion_dispatches').select('id', { count: 'exact', head: true }).eq('status', 'sent');
                setStats({ total: sent.length, impacted: count || 0, active: active.length });
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const toggleService = (id: string) => {
        setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const toggleClient = (id: string) => {
        setSelectedClientIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const insertVar = (v: string) => {
        setMessage(prev => prev + v);
    };

    const recipientCount = useMemo(() => {
        if (targetType === 'all') return clients.length;
        return selectedClientIds.length;
    }, [targetType, clients, selectedClientIds]);

    const previewClient = clients[0] || { id: '', name: 'Maria Silva', phone: '' };
    const previewText = useMemo(() =>
        interpolate(message, previewClient, services, selectedServiceIds, discountType || null, discountValue ? parseFloat(discountValue.replace(',', '.')) : null, validUntil || null, comboName),
        [message, previewClient, services, selectedServiceIds, discountType, discountValue, validUntil, comboName]
    );

    const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
    const originalTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
    const promoTotal = discountType === 'percent' && discountValue
        ? originalTotal * (1 - parseFloat(discountValue.replace(',', '.')) / 100)
        : discountType === 'fixed' && discountValue
            ? originalTotal - parseFloat(discountValue.replace(',', '.'))
            : originalTotal;

    const handleSaveDraft = async () => {
        if (!title || !message || selectedServiceIds.length === 0) {
            toast.error('Preencha o título, selecione ao menos 1 serviço e escreva a mensagem.');
            return;
        }
        try {
            const status = scheduledAt ? 'scheduled' : 'draft';
            const { error } = await supabase.from('promotions').insert([{
                title, message_template: message,
                service_ids: selectedServiceIds, combo_name: comboName || null,
                discount_type: discountType || null, discount_value: discountValue ? parseFloat(discountValue.replace(',', '.')) : null,
                valid_until: validUntil || null, target_type: targetType,
                target_client_ids: targetType === 'selected' ? selectedClientIds : [],
                status, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
            }]);
            if (error) throw error;
            toast.success(status === 'scheduled' ? `Campanha agendada para ${new Date(scheduledAt).toLocaleString('pt-BR')}!` : 'Rascunho salvo com sucesso!');
            const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
            setPromotions(data || []);
            setActiveView('history');
        } catch (e: any) {
            toast.error('Erro ao salvar: ' + e.message);
        }
    };

    const handleSendPromotion = async () => {
        if (!title || !message || selectedServiceIds.length === 0) {
            toast.error('Preencha o título, selecione ao menos 1 serviço e escreva a mensagem.');
            return;
        }
        if (recipientCount === 0) {
            toast.error('Nenhum destinatário selecionado.');
            return;
        }

        setIsSending(true);
        try {
            // 1. Get Evolution API settings
            const { data: settings, error: settingsErr } = await supabase
                .from('settings')
                .select('whatsapp_provider_url, whatsapp_provider_instance, whatsapp_provider_token')
                .single();

            if (settingsErr) {
                toast.error('Erro ao buscar configurações: ' + settingsErr.message);
                setIsSending(false);
                return;
            }

            // Debug: log the settings (check console)
            console.log('[Marketing] Settings carregados:', {
                url: settings?.whatsapp_provider_url,
                instance: settings?.whatsapp_provider_instance,
                hasToken: !!settings?.whatsapp_provider_token
            });

            if (!settings?.whatsapp_provider_url || !settings?.whatsapp_provider_token || !settings?.whatsapp_provider_instance) {
                toast.error('Faltam configurações da Evolution API. Verifique URL, Instância e Token em Configurações.');
                setIsSending(false);
                return;
            }

            // 2. Get recipients
            const targetClients = targetType === 'all' ? clients : clients.filter(c => selectedClientIds.includes(c.id));

            // 3. Save promotion record
            const { data: promo, error: promoErr } = await supabase.from('promotions').insert([{
                title, message_template: message,
                service_ids: selectedServiceIds, combo_name: comboName || null,
                discount_type: discountType || null, discount_value: discountValue ? parseFloat(discountValue.replace(',', '.')) : null,
                valid_until: validUntil || null, target_type: targetType,
                target_client_ids: targetType === 'selected' ? selectedClientIds : [],
                status: 'sent', sent_at: new Date().toISOString(), scheduled_at: null
            }]).select().single();
            if (promoErr) throw promoErr;

            // 4. Send messages and log dispatches
            let successCount = 0;
            let failCount = 0;

            const apiBase = settings.whatsapp_provider_url.replace(/\/$/, '');
            const apiUrl = `${apiBase}/message/sendText/${settings.whatsapp_provider_instance}`;
            console.log('[Marketing] Chamando API:', apiUrl);

            for (let i = 0; i < targetClients.length; i++) {
                const client = targetClients[i];
                if (!client.phone) {
                    console.warn('[Marketing] Cliente sem telefone:', client.name);
                    failCount++;
                    continue;
                }

                // Normalize phone: remove non-digits, ensure DDI 55 for BR numbers
                let phone = client.phone.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = phone.slice(1); // remove leading 0
                if (phone.length <= 11) phone = '55' + phone;     // add BR DDI if missing

                const personalMsg = interpolate(message, client, services, selectedServiceIds, discountType || null, discountValue ? parseFloat(discountValue.replace(',', '.')) : null, validUntil || null, comboName);

                console.log(`[Marketing] Enviando para ${client.name} → ${phone} (${i + 1}/${targetClients.length})`);

                try {
                    const res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': settings.whatsapp_provider_token },
                        body: JSON.stringify({ number: phone, text: personalMsg })
                    });

                    const responseText = await res.text();
                    const dispatched = res.ok;

                    if (!dispatched) {
                        console.error(`[Marketing] Falha HTTP ${res.status} para ${client.name}:`, responseText);
                    }

                    await supabase.from('promotion_dispatches').insert([{
                        promotion_id: promo.id, client_id: client.id, client_name: client.name,
                        client_phone: phone, status: dispatched ? 'sent' : 'failed',
                        sent_at: dispatched ? new Date().toISOString() : null,
                        error_message: dispatched ? null : `HTTP ${res.status}: ${responseText.slice(0, 200)}`
                    }]);
                    if (dispatched) successCount++; else failCount++;
                } catch (fetchErr: any) {
                    console.error(`[Marketing] Erro de rede para ${client.name}:`, fetchErr);
                    failCount++;
                    await supabase.from('promotion_dispatches').insert([{
                        promotion_id: promo.id, client_id: client.id, client_name: client.name,
                        client_phone: phone, status: 'failed', error_message: 'Network error: ' + fetchErr.message
                    }]);
                }

                // Aplicar delay para evitar bloqueio, exceto no último item
                if (delaySeconds > 0 && i < targetClients.length - 1) {
                    console.log(`[Marketing] Aguardando ${delaySeconds}s antes do próximo disparo...`);
                    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                }
            }

            toast.success(`Promoção disparada! ✅ ${successCount} enviados, ❌ ${failCount} falhas.`);
            const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
            setPromotions(data || []);
            setStats(s => ({ ...s, total: s.total + 1, impacted: s.impacted + successCount }));
            setActiveView('history');
        } catch (e: any) {
            console.error('[Marketing] Erro geral:', e);
            toast.error('Erro ao disparar: ' + e.message);
        } finally {
            setIsSending(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
    );

    const handleDeleteSelected = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('promotions').delete().in('id', selectedHistoryIds);
            if (error) throw error;
            toast.success(`${selectedHistoryIds.length} campanha(s) excluída(s) com sucesso.`);
            setPromotions(prev => prev.filter(p => !selectedHistoryIds.includes(p.id)));
            setSelectedHistoryIds([]);
            setShowDeleteModal(false);
        } catch (e: any) {
            toast.error('Erro ao excluir: ' + e.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewDetails = async (promo: Promotion) => {
        setViewDetailsPromo(promo);
        setIsLoadingDetails(true);
        try {
            const { data } = await supabase.from('promotion_dispatches').select('*').eq('promotion_id', promo.id).order('created_at', { ascending: false });
            setPromoDispatches(data || []);
        } catch (e: any) {
            toast.error('Erro ao carregar detalhes: ' + e.message);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    if (isLoading) return (
        <div className="flex flex-1 items-center justify-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        </div>
    );

    return (
        <div className="flex flex-col gap-8 reveal-content">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Central de Campanhas</p>
                    <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
                        Marketing <span className="text-amber-500">Inteligente</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-1.5">Crie promoções personalizadas e dispare via WhatsApp</p>
                </div>
                {/* Tab switcher */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveView('create')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'create' ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Plus className="w-4 h-4" /> Nova Campanha
                    </button>
                    <button
                        onClick={() => setActiveView('history')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'history' ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <History className="w-4 h-4" /> Histórico
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <StatCard icon={Send} label="Campanhas Enviadas" value={stats.total} color="bg-amber-50 dark:bg-amber-900/10 text-amber-500" />
                <StatCard icon={Users} label="Clientes Impactados" value={stats.impacted} color="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500" />
                <StatCard icon={Megaphone} label="Promoções Ativas" value={stats.active} color="bg-rose-50 dark:bg-rose-900/10 text-rose-500" />
            </div>

            {/* Create View */}
            {activeView === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Form Panel — 60% (3/5) */}
                    <div className="lg:col-span-3 flex flex-col gap-5">

                        {/* Campaign Title */}
                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Campanha</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Ex: Promoção de Verão — Hidratação Facial"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                            />
                        </div>

                        {/* Services */}
                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Serviços da Promoção</label>
                                <span className="text-xs font-semibold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                                    {selectedServiceIds.length} selecionado(s)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                {services.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => toggleService(s.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all text-sm ${selectedServiceIds.includes(s.id)
                                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 text-slate-700 dark:text-slate-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selectedServiceIds.includes(s.id) ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {selectedServiceIds.includes(s.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold truncate">{s.name}</p>
                                            <p className="text-xs opacity-70">R$ {s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {selectedServiceIds.length > 1 && (
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Combo (opcional)</label>
                                    <input
                                        value={comboName}
                                        onChange={e => setComboName(e.target.value)}
                                        placeholder="Ex: Pacote Renovação Completa"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            )}

                            {/* Price Summary */}
                            {selectedServiceIds.length > 0 && (
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="text-xs font-semibold text-slate-500">Valor Total dos Serviços</div>
                                    <div className="flex items-center gap-2">
                                        {promoTotal < originalTotal && (
                                            <span className="text-xs text-slate-400 line-through">R$ {originalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        )}
                                        <span className="text-sm font-bold text-emerald-500">R$ {promoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Discount + Validity */}
                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Desconto</label>
                                <select
                                    value={discountType}
                                    onChange={e => setDiscountType(e.target.value as any)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all cursor-pointer"
                                >
                                    <option value="">Sem desconto</option>
                                    <option value="percent">Percentual (%)</option>
                                    <option value="fixed">Fixo (R$)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Valor do Desconto</label>
                                <input
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value)}
                                    placeholder={discountType === 'percent' ? '10' : '50,00'}
                                    disabled={!discountType}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all disabled:opacity-40 placeholder:text-slate-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> Validade
                                </label>
                                <input
                                    type="date"
                                    value={validUntil}
                                    onChange={e => setValidUntil(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all"
                                />
                            </div>
                        </div>

                        {/* Scheduling */}
                        <div className={`bg-white dark:bg-slate-950 p-6 rounded-2xl border shadow-sm space-y-3 transition-all ${scheduledAt ? 'border-blue-400/60 dark:border-blue-500/30' : 'border-slate-100 dark:border-slate-800/60'}`}>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> Agendar Envio <span className="normal-case font-normal text-slate-400">(opcional)</span>
                                </label>
                                {scheduledAt && (
                                    <button type="button" onClick={() => setScheduledAt('')} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">Cancelar</button>
                                )}
                            </div>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 text-slate-900 dark:text-white transition-all"
                            />
                            {scheduledAt ? (
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    Será enviada em {new Date(scheduledAt).toLocaleString('pt-BR')}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-400">Deixe em branco para disparar manualmente agora.</p>
                            )}
                        </div>

                        {/* Targeting */}
                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Destinatários</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTargetType('all')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${targetType === 'all' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                                >
                                    <Users className="w-4 h-4" /> Todos os Clientes ({clients.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetType('selected')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${targetType === 'selected' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                                >
                                    <Tag className="w-4 h-4" /> Selecionar
                                </button>
                            </div>

                            {targetType === 'selected' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <input
                                        value={clientSearch}
                                        onChange={e => setClientSearch(e.target.value)}
                                        placeholder="Buscar cliente..."
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                                    />
                                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                        {filteredClients.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleClient(c.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${selectedClientIds.includes(c.id)
                                                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-amber-200 text-slate-700 dark:text-slate-300'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selectedClientIds.includes(c.id) ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {selectedClientIds.includes(c.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{c.name}</p>
                                                    <p className="text-xs opacity-60">{c.phone || 'Sem telefone'}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedClientIds.length > 0 && (
                                        <div className="flex justify-between items-center text-xs font-semibold text-amber-600 dark:text-amber-400 pt-1">
                                            <span>{selectedClientIds.length} cliente(s) selecionado(s)</span>
                                            <button onClick={() => setSelectedClientIds([])} className="hover:underline">Limpar seleção</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 mt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Timer className="w-4 h-4" /> Delay de Envio (Anti-ban)
                                </label>
                                <p className="text-[11px] text-slate-400">Tempo de espera entre cada mensagem disparada para evitar bloqueios do WhatsApp.</p>
                                <select
                                    value={delaySeconds}
                                    onChange={e => setDelaySeconds(Number(e.target.value))}
                                    className="w-full sm:w-1/2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all cursor-pointer"
                                >
                                    <option value={0}>Sem delay (Risco Alto)</option>
                                    <option value={3}>3 segundos</option>
                                    <option value={5}>5 segundos (Recomendado)</option>
                                    <option value={10}>10 segundos</option>
                                    <option value={30}>30 segundos (Muito Seguro)</option>
                                </select>
                            </div>
                        </div>

                        {/* Message Editor */}
                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mensagem Personalizada</label>
                            <div className="flex flex-wrap gap-2">
                                {VARS.map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => insertVar(v)}
                                        className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-2.5 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={6}
                                placeholder="Digite sua mensagem promocional..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-900 dark:text-white transition-all resize-none placeholder:text-slate-400 font-mono"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveDraft}
                                className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                                    scheduledAt
                                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300 hover:text-amber-500'
                                }`}
                            >
                                {scheduledAt ? <Clock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                {scheduledAt ? 'Agendar Envio' : 'Salvar Rascunho'}
                            </button>
                            <button
                                onClick={handleSendPromotion}
                                disabled={isSending}
                                className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {isSending ? `Disparando...` : `Disparar para ${recipientCount} cliente(s)`}
                            </button>
                        </div>
                    </div>

                    {/* Preview Panel — 40% (2/5) */}
                    <div className="lg:col-span-2 flex flex-col gap-4 sticky top-8 self-start">
                        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
                            {/* Preview Header */}
                            <div className="bg-[#075E54] px-5 py-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm">
                                    {previewClient.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">{previewClient.name || 'Cliente'}</p>
                                    <p className="text-emerald-300 text-xs">online</p>
                                </div>
                            </div>

                            {/* Chat bg */}
                            <div className="bg-[#ECE5DD] dark:bg-slate-800 p-5 min-h-[300px] flex flex-col justify-end gap-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2300000008\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
                                <WhatsAppBubble text={previewText} />
                                <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 -mt-1">
                                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                                </div>
                            </div>

                            {/* Preview Footer */}
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-amber-500" /> Destinatários</span>
                                    <span className="text-amber-500 font-bold text-sm">{recipientCount}</span>
                                </div>
                                {validUntil && (
                                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-500" /> Expira em</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                            {new Date(validUntil + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                )}
                                {scheduledAt && (
                                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> Agendado p/</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                            {new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                                {selectedServiceIds.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Serviços Incluídos</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedServices.map(s => (
                                                <span key={s.id} className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded">
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 space-y-1.5">
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Dicas</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
                                Use <strong>*texto*</strong> para negrito e <strong>~texto~</strong> para tachado no WhatsApp. Personalize com variáveis para aumentar a taxa de resposta.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* History View */}
            {activeView === 'history' && (
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
                    {promotions.length === 0 ? (
                        <div className="py-24 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center">
                                <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-sm font-medium text-slate-500">Nenhuma campanha criada ainda</p>
                            <button onClick={() => setActiveView('create')} className="text-sm font-semibold text-amber-500 hover:underline">Criar a primeira campanha</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            {/* History Header Actions */}
                            {selectedHistoryIds.length > 0 && (
                                <div className="bg-rose-50 dark:bg-rose-900/20 px-6 py-3 flex items-center justify-between border-b border-rose-100 dark:border-rose-900/50">
                                    <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                                        {selectedHistoryIds.length} campanha(s) selecionada(s)
                                    </span>
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        disabled={isDeleting}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        Excluir Selecionadas
                                    </button>
                                </div>
                            )}
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                                        <th className="pl-8 pr-4 py-6 w-12 text-center">
                                            <div className="flex items-center justify-center">
                                                <label className="relative flex items-center justify-center cursor-pointer group/checkbox">
                                                    <input
                                                        type="checkbox"
                                                        className="peer sr-only"
                                                        checked={promotions.length > 0 && selectedHistoryIds.length === promotions.length}
                                                        onChange={e => setSelectedHistoryIds(e.target.checked ? promotions.map(p => p.id) : [])}
                                                    />
                                                    <div className="w-5 h-5 rounded-[6px] border border-slate-300 dark:border-slate-600 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800/50 group-hover/checkbox:border-amber-500/50 shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-slate-900">
                                                        <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" strokeWidth={3} />
                                                    </div>
                                                </label>
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campanha</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Validade</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatários</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {promotions.map(p => {
                                        const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                                        const displayStatus = p.status === 'sent' ? 'sent' : p.status === 'scheduled' ? 'scheduled' : isExpired ? 'expired' : 'draft';
                                        return (
                                            <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors ${selectedHistoryIds.includes(p.id) ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                                <td className="pl-8 pr-4 py-6 w-12 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <label className="relative flex items-center justify-center cursor-pointer group/checkbox">
                                                            <input
                                                                type="checkbox"
                                                                className="peer sr-only"
                                                                checked={selectedHistoryIds.includes(p.id)}
                                                                onChange={e => setSelectedHistoryIds(prev =>
                                                                    e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                                                )}
                                                            />
                                                            <div className="w-5 h-5 rounded-[6px] border border-slate-300 dark:border-slate-600 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800/50 group-hover/checkbox:border-amber-500/50 shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-slate-900">
                                                                <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" strokeWidth={3} />
                                                            </div>
                                                        </label>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{p.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {p.combo_name || `${p.service_ids.length} serviço(s)`} • {new Date(p.created_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    {p.valid_until ? new Date(p.valid_until + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    {p.target_type === 'all' ? 'Todos' : `${p.target_client_ids.length} clientes`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border w-fit ${
                                                            displayStatus === 'sent'
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                                : displayStatus === 'scheduled'
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40'
                                                                    : displayStatus === 'expired'
                                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                                                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                                                            }`}>
                                                            {displayStatus === 'sent' ? <CheckCircle2 className="w-3.5 h-3.5" /> : displayStatus === 'scheduled' ? <Clock className="w-3.5 h-3.5" /> : displayStatus === 'expired' ? <XCircle className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                                                            {displayStatus === 'sent' ? 'Enviado' : displayStatus === 'scheduled' ? 'Agendado' : displayStatus === 'expired' ? 'Expirado' : 'Rascunho'}
                                                        </span>
                                                        {displayStatus === 'scheduled' && p.scheduled_at && (
                                                            <span className="text-[10px] text-blue-500 font-semibold">
                                                                {new Date(p.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleViewDetails(p)}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all"
                                                    >
                                                        <Info className="w-3.5 h-3.5" /> Detalhes
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Detalhes da Campanha */}
            {viewDetailsPromo && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes da Campanha</h3>
                                <p className="text-sm font-medium text-slate-500">{viewDetailsPromo.title}</p>
                            </div>
                            <button onClick={() => setViewDetailsPromo(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {/* Template */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Template Original da Mensagem</label>
                                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                    {viewDetailsPromo.message_template}
                                </div>
                            </div>

                            {/* Detalhes de Envio */}
                            {viewDetailsPromo.status !== 'draft' && viewDetailsPromo.status !== 'scheduled' && (
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        Logs de Disparo
                                        {isLoadingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    </label>
                                    
                                    {!isLoadingDetails && promoDispatches.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">Nenhum disparo registrado (pode ter sido rascunho ou sem contatos).</p>
                                    ) : (
                                        <div className="border border-slate-100 dark:border-slate-800/60 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold text-slate-500">Cliente</th>
                                                        <th className="px-4 py-3 font-semibold text-slate-500">Telefone</th>
                                                        <th className="px-4 py-3 font-semibold text-slate-500">Status</th>
                                                        <th className="px-4 py-3 font-semibold text-slate-500">Detalhe</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                    {promoDispatches.map(d => (
                                                        <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{d.client_name}</td>
                                                            <td className="px-4 py-3 text-slate-500">{d.client_phone}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                                                    d.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                }`}>
                                                                    {d.status === 'sent' ? 'Enviado' : 'Falha'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[150px] truncate" title={d.error_message || ''}>
                                                                {d.error_message || 'OK'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button onClick={() => setViewDetailsPromo(null)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Exclusão Padrão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteSelected}
                title="Excluir Campanhas?"
                message={`Você está prestes a excluir ${selectedHistoryIds.length} campanha(s). Todo o histórico de mensagens disparadas associado a elas também será apagado. Esta ação não pode ser desfeita.`}
                confirmLabel="Sim, Excluir"
                cancelLabel="Cancelar"
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};
