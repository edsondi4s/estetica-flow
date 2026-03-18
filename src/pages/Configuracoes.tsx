import React, { useState, useEffect } from 'react';
import { Camera, Plus, Building2, Phone, Mail, MapPin, Save, Clock, Loader2, Palette, Image as ImageIcon, FileText, Trash2, Info, Check, Globe, Map as MapIcon, Zap } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';

interface ConfiguracoesProps {
    onLogout?: () => void;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const Configuracoes = ({ onLogout }: ConfiguracoesProps) => {
    const [activeTab, setActiveTab] = useState<'info' | 'enderecos' | 'branding' | 'seo' | 'hours'>('info');
    const [businessHours, setBusinessHours] = useState<any[]>([]);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [settings, setSettings] = useState({
        id: '',
        business_name: 'EstéticaFlow',
        phone: '',
        email: '',
        address: '',
        logo_url: '',
        logo_url_dark: '',
        primary_color: '#db2777',
        whatsapp_provider_type: 'evolution',
        whatsapp_provider_url: '',
        whatsapp_provider_instance: '',
        whatsapp_provider_token: '',
        reminder_active: false,
        reminder_minutes: 60,
        seo_title: '',
        seo_description: '',
        seo_keywords: '',
        tracking_code: '',
        tracking_code_body: '',
        favicon_url: '',
        favicon_url_dark: '',
        chat_cleanup_days: 30,
        reminder_message: '',
    });

    const [addresses, setAddresses] = useState<any[]>([]);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressForm, setAddressForm] = useState({ id: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', is_main: false });
    const [isSearchingCep, setIsSearchingCep] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'light' | 'dark' | 'favicon-light' | 'favicon-dark' = 'light') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingLogo(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('clinic-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('clinic-assets')
                .getPublicUrl(filePath);

            if (type === 'light') {
                setSettings({ ...settings, logo_url: publicUrl });
            } else if (type === 'dark') {
                setSettings({ ...settings, logo_url_dark: publicUrl });
            } else if (type === 'favicon-light') {
                setSettings({ ...settings, favicon_url: publicUrl });
            } else if (type === 'favicon-dark') {
                setSettings({ ...settings, favicon_url_dark: publicUrl });
            }
            toast.success(`Upload de imagem (${type}) concluído. Salve para confirmar.`);
        } catch (error: any) {
            toast.error('Erro ao fazer upload: ' + error.message);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchBusinessHours();
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setAddresses(data || []);
        } catch (error) {
            console.error('Erro ao buscar endereços:', error);
        }
    };

    const handleCepSearch = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;
        setIsSearchingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setAddressForm(prev => ({
                    ...prev,
                    zip_code: data.cep,
                    street: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf
                }));
            } else {
                toast.error('CEP não encontrado.');
            }
        } catch (error) {
            toast.error('Erro ao buscar CEP');
            console.error(error);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (addressForm.id) {
                if (addressForm.is_main) {
                    await supabase.from('addresses').update({ is_main: false }).neq('id', addressForm.id);
                }
                const { error } = await supabase.from('addresses').update({
                    zip_code: addressForm.zip_code,
                    street: addressForm.street,
                    number: addressForm.number,
                    complement: addressForm.complement,
                    neighborhood: addressForm.neighborhood,
                    city: addressForm.city,
                    state: addressForm.state,
                    is_main: addressForm.is_main
                }).eq('id', addressForm.id);
                if (error) throw error;
            } else {
                if (addressForm.is_main || addresses.length === 0) {
                    await supabase.from('addresses').update({ is_main: false }).neq('id', '00000000-0000-0000-0000-000000000000');
                }
                const { error } = await supabase.from('addresses').insert([{
                    zip_code: addressForm.zip_code,
                    street: addressForm.street,
                    number: addressForm.number,
                    complement: addressForm.complement,
                    neighborhood: addressForm.neighborhood,
                    city: addressForm.city,
                    state: addressForm.state,
                    is_main: addressForm.is_main || addresses.length === 0
                }]);
                if (error) throw error;
            }
            toast.success('Endereço salvo com sucesso!');
            setIsAddressModalOpen(false);
            fetchAddresses();
        } catch (error: any) {
            toast.error('Erro ao salvar endereço: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm('Deseja realmente excluir este endereço?')) return;
        try {
            const { error } = await supabase.from('addresses').delete().eq('id', id);
            if (error) throw error;
            toast.success('Endereço excluído.');
            fetchAddresses();
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data: sData, error: sError } = await supabase
                .from('settings')
                .select('*')
                .single();

            if (sError && sError.code !== 'PGRST116') {
                console.error('Erro ao buscar configurações:', sError);
            } else if (sData) {
                setSettings({
                    ...sData,
                    primary_color: sData.primary_color || '#db2777'
                });
            }
        } catch (error) {
            console.error('Erro ao buscar definições:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBusinessHours = async () => {
        try {
            const { data, error } = await supabase
                .from('business_hours')
                .select('*')
                .order('day_of_week', { ascending: true });

            if (error) throw error;
            setBusinessHours(data || []);
        } catch (error) {
            console.error('Erro ao buscar horários:', error);
        }
    };



    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (settings.id) {
                const { error } = await supabase
                    .from('settings')
                    .update({
                        business_name: settings.business_name,
                        phone: settings.phone,
                        email: settings.email,
                        address: settings.address,
                        logo_url: settings.logo_url,
                        logo_url_dark: settings.logo_url_dark,
                        primary_color: settings.primary_color,
                        whatsapp_provider_type: settings.whatsapp_provider_type,
                        whatsapp_provider_url: settings.whatsapp_provider_url,
                        whatsapp_provider_instance: settings.whatsapp_provider_instance,
                        whatsapp_provider_token: settings.whatsapp_provider_token,
                        reminder_active: settings.reminder_active,
                        reminder_minutes: settings.reminder_minutes,
                        reminder_message: settings.reminder_message,
                        seo_title: settings.seo_title,
                        seo_description: settings.seo_description,
                        seo_keywords: settings.seo_keywords,
                        tracking_code: settings.tracking_code,
                        tracking_code_body: settings.tracking_code_body,
                        favicon_url: settings.favicon_url,
                        favicon_url_dark: settings.favicon_url_dark,
                        chat_cleanup_days: settings.chat_cleanup_days,
                    })
                    .eq('id', settings.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('settings')
                    .insert([{
                        business_name: settings.business_name,
                        phone: settings.phone,
                        email: settings.email,
                        address: settings.address,
                        logo_url: settings.logo_url,
                        logo_url_dark: settings.logo_url_dark,
                        primary_color: settings.primary_color,
                        whatsapp_provider_type: settings.whatsapp_provider_type,
                        whatsapp_provider_url: settings.whatsapp_provider_url,
                        whatsapp_provider_instance: settings.whatsapp_provider_instance,
                        whatsapp_provider_token: settings.whatsapp_provider_token,
                        reminder_active: settings.reminder_active,
                        reminder_minutes: settings.reminder_minutes,
                        reminder_message: settings.reminder_message,
                        seo_title: settings.seo_title,
                        seo_description: settings.seo_description,
                        seo_keywords: settings.seo_keywords,
                        tracking_code: settings.tracking_code,
                        tracking_code_body: settings.tracking_code_body,
                        favicon_url: settings.favicon_url,
                        favicon_url_dark: settings.favicon_url_dark,
                        chat_cleanup_days: settings.chat_cleanup_days,
                    }]);
                if (error) throw error;
            }

            const { error: hoursError } = await supabase
                .from('business_hours')
                .upsert(businessHours);
            if (hoursError) throw hoursError;

            // Apply SEO dynamically on save
            if (settings.seo_title) document.title = settings.seo_title;

            if (settings.seo_description) {
                let descMeta = document.querySelector('meta[name="description"]');
                if (!descMeta) {
                    descMeta = document.createElement('meta');
                    descMeta.setAttribute('name', 'description');
                    document.head.appendChild(descMeta);
                }
                descMeta.setAttribute('content', settings.seo_description);
            }

            if (settings.seo_keywords) {
                let keyMeta = document.querySelector('meta[name="keywords"]');
                if (!keyMeta) {
                    keyMeta = document.createElement('meta');
                    keyMeta.setAttribute('name', 'keywords');
                    document.head.appendChild(keyMeta);
                }
                keyMeta.setAttribute('content', settings.seo_keywords);
            }

            // Apply Favicon dynamically on save
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            let currentFavicon = isDark && settings.favicon_url_dark ? settings.favicon_url_dark : settings.favicon_url;
            if (currentFavicon) {
                let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
                if (!link) {
                    link = document.createElement('link');
                    link.setAttribute('rel', 'icon');
                    document.head.appendChild(link);
                }
                link.setAttribute('href', currentFavicon);
            }

            toast.success('Configurações salvas com sucesso!');
            // Re-fetch instead of reload to avoid losing state if not necessary
            fetchSettings();
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto w-full space-y-10">
            {/* Navegação via Abas */}
            <div className="flex overflow-x-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-[32px] p-1.5 gap-2 mb-8">
                {[
                    { id: 'info', label: 'Empresa', icon: Building2 },
                    { id: 'enderecos', label: 'Endereços', icon: MapIcon },
                    { id: 'branding', label: 'Aparência', icon: Palette },
                    { id: 'seo', label: 'SEO & Site', icon: Globe },
                    { id: 'hours', label: 'Horários', icon: Clock }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all rounded-[28px] whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-950 text-primary shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200/50 dark:border-slate-800/60'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 border border-transparent'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 transition-transform ${activeTab === tab.id ? 'scale-110 text-primary' : 'text-slate-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <Card noPadding>
                {activeTab === 'info' && (
                    <div className="p-8 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Informações da <span className="text-primary italic">Empresa</span></h3>
                            <p className="text-sm font-medium text-slate-500">Dados básicos da sua unidade</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <InputField
                                label="Nome da Empresa"
                                icon={Building2}
                                value={settings.business_name}
                                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                            />
                            <InputField
                                label="Telefone de Contato"
                                icon={Phone}
                                type="tel"
                                placeholder="(00) 00000-0000"
                                value={settings.phone}
                                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                            />
                            <div className="md:col-span-2">
                                <InputField
                                    label="Canal de Comunicação Oficial (E-mail)"
                                    icon={Mail}
                                    type="email"
                                    value={settings.email}
                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'enderecos' && (
                    <div className="p-8 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Nossos <span className="text-primary italic">Endereços</span></h3>
                                <p className="text-sm font-medium text-slate-500">Locais onde você atende</p>
                            </div>
                            <Button
                                onClick={() => {
                                    setAddressForm({ id: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', is_main: addresses.length === 0 });
                                    setIsAddressModalOpen(true);
                                }}
                                className="h-11 px-6 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Endereço
                            </Button>
                        </div>

                        {addresses.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4 opacity-70" />
                                <p className="text-sm font-medium text-slate-500">Nenhum endereço cadastrado</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {addresses.map((addr) => (
                                    <div key={addr.id} className="group relative bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)] transition-all overflow-hidden flex flex-col h-full">
                                        {addr.is_main && (
                                            <div className="absolute top-4 right-4 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                                                Principal
                                            </div>
                                        )}
                                        <div className="flex gap-4 mb-6 flex-1">
                                            <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center shrink-0 border border-primary/10">
                                                <MapPin className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h5 className="font-semibold text-slate-900 dark:text-white text-lg">{addr.street}, {addr.number}</h5>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {addr.neighborhood} — {addr.city}/{addr.state}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">CEP {addr.zip_code}</span>
                                                    {addr.complement && <span className="text-xs font-medium text-slate-500">Compl: {addr.complement}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 justify-end pt-5 border-t border-slate-100 dark:border-slate-800/60 mt-auto">
                                            <button
                                                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                                                onClick={() => {
                                                    setAddressForm(addr);
                                                    setIsAddressModalOpen(true);
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors"
                                                onClick={() => handleDeleteAddress(addr.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'seo' && (
                    <div className="p-8 md:p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-primary/5 flex items-center justify-center rounded-2xl border border-primary/10">
                                <Globe className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Aparecer no <span className="text-primary italic">Google</span></h3>
                                <p className="text-sm font-medium text-slate-500">Configurações para seu site ser encontrado</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            <InputField
                                label="Título do Site (Title Tag)"
                                placeholder="Ex: EstéticaFlow — Biotecnologia Avançada"
                                value={settings.seo_title || ''}
                                onChange={(e) => setSettings({ ...settings, seo_title: e.target.value })}
                            />

                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Descrição do Site (Meta Description)</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white resize-none transition-all placeholder:text-slate-400"
                                    placeholder="Breve resumo da expertise técnica da unidade..."
                                    value={settings.seo_description || ''}
                                    onChange={(e) => setSettings({ ...settings, seo_description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Palavras-chave (SEO Tags)</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white resize-none transition-all placeholder:text-slate-400"
                                    placeholder="estetica, botox, preenchimento..."
                                    value={settings.seo_keywords || ''}
                                    onChange={(e) => setSettings({ ...settings, seo_keywords: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-10 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="mb-8">
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Códigos de <span className="text-primary italic">Rastreamento</span></h4>
                                <p className="text-sm text-slate-500 font-medium">Para Google Analytics, Facebook Pixel e outros</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Head Injection &lt;head&gt;</label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-5 py-3.5 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-emerald-400 resize-none opacity-90 transition-all font-medium leading-relaxed"
                                        placeholder="<!-- Scripts: GTM, Search Console -->"
                                        value={settings.tracking_code || ''}
                                        onChange={(e) => setSettings({ ...settings, tracking_code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Body Injection &lt;body&gt;</label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-5 py-3.5 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-emerald-400 resize-none opacity-90 transition-all font-medium leading-relaxed"
                                        placeholder="<!-- Scripts: FB Pixel NoScript -->"
                                        value={settings.tracking_code_body || ''}
                                        onChange={(e) => setSettings({ ...settings, tracking_code_body: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="p-8 md:p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-primary/5 flex items-center justify-center rounded-2xl border border-primary/10">
                                <Palette className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Cores e <span className="text-primary italic">Logotipo</span></h3>
                                <p className="text-sm font-medium text-slate-500">Personalização visual do sistema</p>
                            </div>
                        </div>

                        <div className="space-y-12">
                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-4">Cor Principal da Interface</label>
                                <div className="flex flex-wrap gap-4">
                                    {[
                                        '#10b981', // Emerald (Silk & Steel Default)
                                        '#db2777', // Rosa
                                        '#7c3aed', // Roxo
                                        '#2563eb', // Azul
                                        '#f59e0b', // Amber
                                        '#64748b', // Slate
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setSettings({ ...settings, primary_color: color })}
                                            className={`w-12 h-12 rounded-full border-2 transition-all relative ${settings.primary_color === color ? 'border-primary ring-4 ring-primary/20' : 'border-transparent hover:scale-110 shadow-sm'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        >
                                            {settings.primary_color === color && <Check className="w-5 h-5 absolute inset-0 m-auto text-white dark:text-slate-950" />}
                                        </button>
                                    ))}
                                    <div className="flex items-center gap-4 ml-4 pl-4 border-l border-slate-100 dark:border-slate-800/60">
                                        <div className="relative group">
                                            <input
                                                type="color"
                                                value={settings.primary_color}
                                                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                                                className="w-12 h-12 rounded-full border-none cursor-pointer bg-transparent overflow-hidden shadow-[0_2px_10px_rgb(0,0,0,0.05)]"
                                            />
                                            <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800 pointer-events-none group-hover:border-primary/50 transition-colors"></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-500">Hexadecimal</span>
                                            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white uppercase">{settings.primary_color}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 dark:border-slate-900">
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5 text-primary" /> Ativos de <span className="text-primary italic">Marca</span>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Light Logo */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Projeção Padrão (Modo Claro)</label>
                                        <div className="relative group aspect-video rounded-3xl bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 overflow-hidden">
                                            {settings.logo_url ? (
                                                <img src={settings.logo_url} className="max-w-[70%] max-h-[70%] object-contain shadow-sm transition-all duration-700 group-hover:scale-105" alt="Logo Light" />
                                            ) : (
                                                <div className="text-center opacity-50">
                                                    <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                                    <span className="text-xs font-medium text-slate-500">Sem Logo</span>
                                                </div>
                                            )}
                                            <input type="file" id="logo-light-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'light')} disabled={isUploadingLogo} />
                                            <label htmlFor="logo-light-upload" className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-semibold text-sm gap-2">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                Alterar Logo
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dark Logo */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Projeção Escura (Alto Contraste)</label>
                                        <div className="relative group aspect-video rounded-3xl bg-slate-900 dark:bg-slate-950 flex items-center justify-center border border-dashed border-slate-800 dark:border-slate-800 overflow-hidden">
                                            {settings.logo_url_dark ? (
                                                <img src={settings.logo_url_dark} className="max-w-[70%] max-h-[70%] object-contain transition-all duration-700 group-hover:scale-105" alt="Logo Dark" />
                                            ) : (
                                                <div className="text-center opacity-50">
                                                    <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                                    <span className="text-xs font-medium text-slate-500">Sem Logo</span>
                                                </div>
                                            )}
                                            <input type="file" id="logo-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} disabled={isUploadingLogo} />
                                            <label htmlFor="logo-dark-upload" className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-semibold text-sm gap-2">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                Alterar Logo
                                            </label>
                                        </div>
                                    </div>

                                    {/* Favicon Light */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Ícone do Navegador (Claro)</label>
                                        <div className="relative group w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 overflow-hidden">
                                            {settings.favicon_url ? (
                                                <img src={settings.favicon_url} className="w-12 h-12 object-contain shadow-sm group-hover:scale-110 transition-all duration-500" alt="Favicon" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-300 mx-auto opacity-50" />
                                            )}
                                            <input type="file" id="favicon-light-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'favicon-light')} disabled={isUploadingLogo} />
                                            <label htmlFor="favicon-light-upload" className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Favicon Dark */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">Ícone do Navegador (Escuro)</label>
                                        <div className="relative group w-24 h-24 rounded-2xl bg-slate-900 dark:bg-slate-950 flex items-center justify-center border border-dashed border-slate-800 overflow-hidden">
                                            {settings.favicon_url_dark ? (
                                                <img src={settings.favicon_url_dark} className="w-12 h-12 object-contain shadow-sm group-hover:scale-110 transition-all duration-500" alt="Favicon" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-600 mx-auto opacity-50" />
                                            )}
                                            <input type="file" id="favicon-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'favicon-dark')} disabled={isUploadingLogo} />
                                            <label htmlFor="favicon-dark-upload" className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-primary/5 border border-primary/10 relative overflow-hidden group rounded-3xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-colors"></div>
                            <h5 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4" /> Dica Visual
                            </h5>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-2xl relative z-10">
                                O Design System usa bordas arredondadas e suavizadas. Cores escuras aumentam o conforto visual dos usuários e combinam perfeitamente com a tipografia moderna que implantamos.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="p-8 md:p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-primary/5 flex items-center justify-center rounded-2xl border border-primary/10">
                                <Clock className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Horário de <span className="text-primary italic">Atendimento</span></h3>
                                <p className="text-sm font-medium text-slate-500">Defina quando sua empresa está aberta</p>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : (
                            <div className="space-y-3">
                                {businessHours.map((bh, index) => (
                                    <div key={bh.id} className="flex flex-col sm:flex-row sm:items-center gap-6 p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_4px_20px_rgb(0,0,0,0.02)] bg-white dark:bg-slate-950 hover:border-primary/30 transition-colors group">
                                        <div className="flex items-center gap-5 w-48 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const newBh = [...businessHours];
                                                    newBh[index].is_working_day = !newBh[index].is_working_day;
                                                    setBusinessHours(newBh);
                                                }}
                                                className={`w-11 h-6 rounded-full relative transition-all border ${bh.is_working_day ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                                            >
                                                <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all bg-white shadow-sm ${bh.is_working_day ? 'left-[22px]' : 'left-0.5'}`} />
                                            </button>
                                            <span className={`text-sm font-semibold capitalize ${bh.is_working_day ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                                {DAYS_OF_WEEK[bh.day_of_week].toLowerCase()}
                                            </span>
                                        </div>

                                        <div className={`flex items-center gap-4 flex-1 transition-all duration-300 ${!bh.is_working_day ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-slate-500 block mb-1.5 ml-1">Início</label>
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white"
                                                    value={bh.start_time?.substring(0, 5) || '08:00'}
                                                    onChange={(e) => {
                                                        const newBh = [...businessHours];
                                                        newBh[index].start_time = e.target.value;
                                                        setBusinessHours(newBh);
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-400 mt-6 hidden sm:block">até</span>
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-slate-500 block mb-1.5 ml-1">Fim</label>
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white"
                                                    value={bh.end_time?.substring(0, 5) || '18:00'}
                                                    onChange={(e) => {
                                                        const newBh = [...businessHours];
                                                        newBh[index].end_time = e.target.value;
                                                        setBusinessHours(newBh);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {!bh.is_working_day && (
                                            <span className="text-xs font-semibold text-slate-400 hidden sm:block opacity-50 ml-auto">Fechado</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 rounded-r-2xl">
                            <h5 className="text-sm font-semibold text-amber-700 dark:text-amber-500 mb-1.5 flex items-center gap-2">
                                <Info className="w-4 h-4" /> Importante
                            </h5>
                            <p className="text-sm text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                Alterações no horário de atendimento afetam imediatamente quando os clientes podem agendar pelo site e como o robô de IA vai se comportar.
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-8 md:p-10 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between items-center gap-6 rounded-b-3xl">
                    {onLogout && (
                        <Button variant="danger" className="rounded-xl font-medium text-sm h-11 px-6 opacity-70 hover:opacity-100 transition-opacity" onClick={onLogout}>
                            Encerrar Sessão
                        </Button>
                    )}
                    <div className="flex gap-4 w-full sm:w-auto">
                        <Button variant="ghost" className="flex-1 sm:flex-none font-medium text-sm h-11 px-6 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800" disabled={isSaving} onClick={() => fetchSettings()}>Cancelar</Button>
                        <Button className="flex-1 sm:flex-none h-11 px-8 rounded-xl font-medium text-sm shadow-[0_8px_30px_rgba(16,185,129,0.2)]" onClick={handleSave} disabled={isSaving || isLoading} isLoading={isSaving}>
                            <Save className="w-4 h-4 mr-2" /> Salvar Configurações
                        </Button>
                    </div>
                </div>
            </Card>


            {/* Modal de Endereço */}
            <Modal
                isOpen={isAddressModalOpen}
                onClose={() => setIsAddressModalOpen(false)}
                title={addressForm.id ? 'Editar Endereço' : 'Novo Endereço'}
                description="Dados de localização da sua unidade de atendimento."
            >
                <form onSubmit={handleSaveAddress} className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 relative">
                            <InputField
                                label="CEP"
                                value={addressForm.zip_code}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setAddressForm({ ...addressForm, zip_code: val });
                                    if (val.replace(/\D/g, '').length === 8) {
                                        handleCepSearch(val);
                                    }
                                }}
                                placeholder="00000-000"
                                required
                            />
                            {isSearchingCep && (
                                <Loader2 className="absolute right-4 top-10 w-4 h-4 text-primary animate-spin" />
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <InputField
                                label="Rua / Avenida"
                                value={addressForm.street}
                                onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                                placeholder="Ex: Av. Paulista"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <InputField
                                label="Número"
                                value={addressForm.number}
                                onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })}
                                placeholder="123"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <InputField
                                label="Complemento"
                                value={addressForm.complement}
                                onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })}
                                placeholder="Sala, Andar, Bloco..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <InputField
                                label="Bairro"
                                value={addressForm.neighborhood}
                                onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <InputField
                                label="Cidade"
                                value={addressForm.city}
                                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <InputField
                                label="UF"
                                value={addressForm.state}
                                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                placeholder="SP"
                                maxLength={2}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 mt-2">
                        <button
                            type="button"
                            onClick={() => setAddressForm({ ...addressForm, is_main: !addressForm.is_main })}
                            disabled={addresses.length === 0}
                            className={`w-11 h-6 rounded-full relative transition-all border ${addressForm.is_main ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                        >
                            <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all bg-white shadow-sm ${addressForm.is_main ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Definir como Endereço Principal</label>
                    </div>

                    <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <Button type="button" variant="ghost" className="h-11 px-6 rounded-xl font-medium text-sm transition-all" onClick={() => setIsAddressModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="h-11 px-8 rounded-xl font-medium text-sm shadow-[0_8px_30px_rgba(16,185,129,0.2)]" disabled={isSaving} isLoading={isSaving}>
                            <Save className="w-4 h-4 mr-2" /> Salvar Endereço
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};
