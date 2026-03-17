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
            <div className="bg-white dark:bg-slate-950 p-2 rounded-sm border-2 border-slate-100 dark:border-slate-900 shadow-2xl flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
                {[
                    { id: 'info', label: 'Informações da Empresa', icon: Building2 },
                    { id: 'enderecos', label: 'Endereços', icon: MapIcon },
                    { id: 'branding', label: 'Aparência', icon: Palette },
                    { id: 'seo', label: 'Site e Busca (SEO)', icon: Globe },
                    { id: 'hours', label: 'Horário de Funcionamento', icon: Clock }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center justify-center gap-3 h-12 rounded-none text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ease-in-out
                            ${activeTab === tab.id
                                ? 'bg-primary text-slate-950 px-8 flex-1 sm:flex-none'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 px-5 w-14'}`}
                        title={tab.label}
                    >
                        <tab.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`} />
                        {activeTab === tab.id && (
                            <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                                {tab.label}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <Card noPadding>
                {activeTab === 'info' && (
                    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Informações da <span className="text-primary">Empresa</span></h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dados básicos da sua unidade</p>
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
                    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Nossos <span className="text-primary">Endereços</span></h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Locais onde você atende</p>
                            </div>
                            <Button
                                onClick={() => {
                                    setAddressForm({ id: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', is_main: addresses.length === 0 });
                                    setIsAddressModalOpen(true);
                                }}
                                className="bg-primary text-slate-950 rounded-none h-12 px-8 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Endereço
                            </Button>
                        </div>

                        {addresses.length === 0 ? (
                            <div className="text-center py-24 bg-slate-50 dark:bg-slate-900/50 rounded-sm border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zero pontos ativos detectados</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {addresses.map((addr) => (
                                    <div key={addr.id} className="group relative bg-white dark:bg-slate-950 p-8 rounded-sm border border-slate-100 dark:border-slate-900 shadow-2xl shadow-black/5 hover:border-primary/30 transition-all overflow-hidden">
                                        {addr.is_main && (
                                            <div className="absolute top-0 right-0 bg-primary text-slate-950 text-[9px] font-black px-4 py-1 tracking-widest uppercase">
                                                Principal
                                            </div>
                                        )}
                                        <div className="flex gap-4 mb-6">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-none flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800">
                                                <MapPin className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div>
                                                <h5 className="font-black text-slate-950 dark:text-white text-md uppercase tracking-tight">{addr.street}, {addr.number}</h5>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {addr.neighborhood} — {addr.city}/{addr.state}
                                                </p>
                                                <div className="mt-2 flex items-center gap-3">
                                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest px-2 py-0.5 border border-primary/20 bg-primary/5">CEP {addr.zip_code}</span>
                                                    {addr.complement && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">[{addr.complement}]</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-end pt-6 border-t border-slate-50 dark:border-slate-900">
                                            <button
                                                onClick={() => {
                                                    setAddressForm(addr);
                                                    setIsAddressModalOpen(true);
                                                }}
                                            >
                                                Editar Endereço
                                            </button>
                                            <button
                                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors"
                                                onClick={() => handleDeleteAddress(addr.id)}
                                            >
                                                Desativar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'seo' && (
                    <div className="p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-950 flex items-center justify-center rounded-sm border border-slate-900 shadow-xl">
                                <Globe className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Aparecer no <span className="text-primary">Google</span></h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configurações para seu site ser encontrado</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-10">
                            <InputField
                                label="Título do Site (Title Tag)"
                                placeholder="Ex: EstéticaFlow — Biotecnologia Avançada"
                                value={settings.seo_title || ''}
                                onChange={(e) => setSettings({ ...settings, seo_title: e.target.value })}
                            />

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição do Site (Meta Description)</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-none text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white resize-none font-medium leading-relaxed"
                                    placeholder="Breve resumo da expertise técnica da unidade..."
                                    value={settings.seo_description || ''}
                                    onChange={(e) => setSettings({ ...settings, seo_description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Palavras-chave Técnicas (SEO Tags)</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-none text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white resize-none font-mono"
                                    placeholder="estetica, botox, preenchimento..."
                                    value={settings.seo_keywords || ''}
                                    onChange={(e) => setSettings({ ...settings, seo_keywords: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-10 border-t border-slate-100 dark:border-slate-900">
                            <div className="mb-8">
                                <h4 className="text-md font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-2">Códigos de <span className="text-primary">Rastreamento</span></h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Para Google Analytics, Facebook Pixel e outros</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Head Injection &lt;head&gt;</label>
                                    <textarea
                                        rows={8}
                                        className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-none text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-emerald-500 resize-none opacity-80"
                                        placeholder="<!-- Scripts: GTM, Search Console -->"
                                        value={settings.tracking_code || ''}
                                        onChange={(e) => setSettings({ ...settings, tracking_code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Body Injection &lt;body&gt;</label>
                                    <textarea
                                        rows={8}
                                        className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-none text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-emerald-500 resize-none opacity-80"
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
                    <div className="p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-950 flex items-center justify-center rounded-sm border border-slate-900 shadow-xl">
                                <Palette className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Cores e <span className="text-primary">Logotipo</span></h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personalização visual do sistema</p>
                            </div>
                        </div>

                        <div className="space-y-12">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 block">Cor Principal da Interface</label>
                                <div className="flex flex-wrap gap-4">
                                    {[
                                        '#ebfe62', // Neon Lime (Silk & Steel Default)
                                        '#db2777', // Rosa
                                        '#7c3aed', // Roxo
                                        '#2563eb', // Azul
                                        '#059669', // Verde
                                        '#1e293b', // Slate
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setSettings({ ...settings, primary_color: color })}
                                            className={`w-14 h-14 rounded-none border-2 transition-all relative ${settings.primary_color === color ? 'border-primary ring-4 ring-primary/10' : 'border-slate-200 dark:border-slate-800'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        >
                                            {settings.primary_color === color && <Check className="w-5 h-5 absolute inset-0 m-auto text-slate-950" />}
                                        </button>
                                    ))}
                                    <div className="flex items-center gap-4 ml-6 pl-6 border-l border-slate-100 dark:border-slate-800">
                                        <div className="relative group">
                                            <input
                                                type="color"
                                                value={settings.primary_color}
                                                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                                                className="w-14 h-14 rounded-none border-none cursor-pointer bg-transparent"
                                            />
                                            <div className="absolute inset-0 border-2 border-slate-200 dark:border-slate-800 pointer-events-none group-hover:border-primary/50 transition-colors"></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual RGB</span>
                                            <span className="text-[14px] font-mono font-black text-slate-950 dark:text-white uppercase tracking-tighter">{settings.primary_color}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 dark:border-slate-900">
                                <h4 className="text-md font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                                    <ImageIcon className="w-5 h-5 text-primary" /> Ativos de <span className="text-primary">Marca</span>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {/* Light Logo */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projeção Padrão (Modo Claro)</label>
                                        <div className="relative group aspect-video rounded-none bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                                            {settings.logo_url ? (
                                                <img src={settings.logo_url} className="max-w-[70%] max-h-[70%] object-contain grayscale hover:grayscale-0 transition-all duration-700" alt="Logo Light" />
                                            ) : (
                                                <div className="text-center opacity-20">
                                                    <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Offline Asset</span>
                                                </div>
                                            )}
                                            <input type="file" id="logo-light-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'light')} disabled={isUploadingLogo} />
                                            <label htmlFor="logo-light-upload" className="absolute inset-0 flex items-center justify-center bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-black text-[10px] tracking-[0.2em] uppercase gap-3">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                                Remapear Entidade
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dark Logo */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projeção Escura (Alto Contraste)</label>
                                        <div className="relative group aspect-video rounded-none bg-slate-950 flex items-center justify-center border-2 border-dashed border-slate-900 overflow-hidden">
                                            {settings.logo_url_dark ? (
                                                <img src={settings.logo_url_dark} className="max-w-[70%] max-h-[70%] object-contain" alt="Logo Dark" />
                                            ) : (
                                                <div className="text-center opacity-10">
                                                    <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Pending Asset</span>
                                                </div>
                                            )}
                                            <input type="file" id="logo-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} disabled={isUploadingLogo} />
                                            <label htmlFor="logo-dark-upload" className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-black text-[10px] tracking-[0.2em] uppercase gap-3">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                                Remapear Entidade
                                            </label>
                                        </div>
                                    </div>

                                    {/* Favicon Light */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ícone do Navegador (Modo Claro)</label>
                                        <div className="relative group w-24 h-24 rounded-none bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                                            {settings.favicon_url ? (
                                                <img src={settings.favicon_url} className="w-12 h-12 object-contain grayscale hover:grayscale-0 transition-all duration-700" alt="Favicon" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-300 mx-auto opacity-20" />
                                            )}
                                            <input type="file" id="favicon-light-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'favicon-light')} disabled={isUploadingLogo} />
                                            <label htmlFor="favicon-light-upload" className="absolute inset-0 flex items-center justify-center bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-black text-[10px] tracking-[0.2em] uppercase gap-3">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Favicon Dark */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ícone do Navegador (Modo Escuro)</label>
                                        <div className="relative group w-24 h-24 rounded-none bg-slate-950 flex items-center justify-center border-2 border-dashed border-slate-900 overflow-hidden">
                                            {settings.favicon_url_dark ? (
                                                <img src={settings.favicon_url_dark} className="w-12 h-12 object-contain" alt="Favicon" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-600 mx-auto opacity-10" />
                                            )}
                                            <input type="file" id="favicon-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'favicon-dark')} disabled={isUploadingLogo} />
                                            <label htmlFor="favicon-dark-upload" className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white font-black text-[10px] tracking-[0.2em] uppercase gap-3">
                                                {isUploadingLogo ? <Loader2 className="animate-spin w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-950 border border-slate-900 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>
                            <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> Dica Visual
                            </h5>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-2xl">
                                <span className="text-white uppercase font-black">Design do Sistema:</span> Usamos cores modernas e alto contraste para garantir que o sistema seja fácil de ler e usar em qualquer tela.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-950 flex items-center justify-center rounded-sm border border-slate-900 shadow-xl">
                                <Clock className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Horário de <span className="text-primary">Atendimento</span></h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defina quando sua empresa está aberta</p>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : (
                            <div className="space-y-4">
                                {businessHours.map((bh, index) => (
                                    <div key={bh.id} className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-none border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 hover:border-primary/30 transition-colors group">
                                        <div className="flex items-center gap-6 w-56 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const newBh = [...businessHours];
                                                    newBh[index].is_working_day = !newBh[index].is_working_day;
                                                    setBusinessHours(newBh);
                                                }}
                                                className={`w-12 h-6 rounded-none relative transition-all border ${bh.is_working_day ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800'}`}
                                            >
                                                <div className={`absolute top-0.5 w-4.5 h-4.5 bg-slate-950 rounded-none transition-all ${bh.is_working_day ? 'left-6 bg-white' : 'left-1'}`} />
                                            </button>
                                            <span className={`text-[12px] font-black uppercase tracking-widest ${bh.is_working_day ? 'text-slate-950 dark:text-white' : 'text-slate-400 opacity-50'}`}>
                                                {DAYS_OF_WEEK[bh.day_of_week]}
                                            </span>
                                        </div>

                                        <div className={`flex items-center gap-4 flex-1 transition-all duration-300 ${!bh.is_working_day ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
                                                    value={bh.start_time?.substring(0, 5) || '08:00'}
                                                    onChange={(e) => {
                                                        const newBh = [...businessHours];
                                                        newBh[index].start_time = e.target.value;
                                                        setBusinessHours(newBh);
                                                    }}
                                                />
                                                <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-950 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Início</label>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
                                                    value={bh.end_time?.substring(0, 5) || '18:00'}
                                                    onChange={(e) => {
                                                        const newBh = [...businessHours];
                                                        newBh[index].end_time = e.target.value;
                                                        setBusinessHours(newBh);
                                                    }}
                                                />
                                                <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-950 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Fim</label>
                                            </div>
                                        </div>
                                        {!bh.is_working_day && (
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:block opacity-30">Fechado</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-8 bg-primary/5 border-l-4 border-primary rounded-none">
                            <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                                <Info className="w-3 h-3" /> Importante
                            </h5>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Alterações no <span className="text-slate-900 dark:text-white">horário</span> afetam imediatamente quando os clientes podem agendar pelo site e o atendimento do robô.
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-10 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-8">
                    {onLogout && (
                        <Button variant="danger" className="rounded-none uppercase font-black tracking-[0.2em] text-[10px] h-12 px-8 opacity-50 hover:opacity-100 transition-opacity" onClick={onLogout}>
                            Encerrar Sessão
                        </Button>
                    )}
                    <div className="flex gap-6 w-full sm:w-auto">
                        <Button variant="ghost" className="flex-1 sm:flex-none uppercase font-black tracking-widest text-[10px] transition-all hover:bg-slate-100 dark:hover:bg-slate-900" disabled={isSaving} onClick={() => fetchSettings()}>Resetar Interface</Button>
                        <Button className="flex-1 sm:flex-none h-14 px-12 rounded-none uppercase font-black tracking-widest text-[11px] shadow-xl shadow-primary/20" onClick={handleSave} disabled={isSaving || isLoading} isLoading={isSaving}>
                            <Save className="w-5 h-5 mr-3" /> Salvar Configurações
                        </Button>
                    </div>
                </div>
            </Card>


            {/* Modal de Endereço */}
            <Modal
                isOpen={isAddressModalOpen}
                onClose={() => setIsAddressModalOpen(false)}
                title={addressForm.id ? 'VÍNCULO_GEO: EDITAR' : 'VÍNCULO_GEO: NOVO'}
                description="Sincronizando coordenadas físicas do nó."
            >
                <form onSubmit={handleSaveAddress} className="space-y-8 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 relative">
                            <InputField
                                label="COORDINATE_CODE (CEP)"
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
                                label="PRIMARY_AXIS (Street)"
                                value={addressForm.street}
                                onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                                placeholder="Rua, Avenida..."
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <InputField
                                label="NODE_ID (Number)"
                                value={addressForm.number}
                                onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })}
                                placeholder="123"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <InputField
                                label="OFFSET_DATA (Complement)"
                                value={addressForm.complement}
                                onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })}
                                placeholder="Sala, Andar, Bloco..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <InputField
                                label="DISTRICT_ZONE"
                                value={addressForm.neighborhood}
                                onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <InputField
                                label="METROPOLIS"
                                value={addressForm.city}
                                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <InputField
                                label="STATE_REF (UF)"
                                value={addressForm.state}
                                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                placeholder="SP"
                                maxLength={2}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setAddressForm({ ...addressForm, is_main: !addressForm.is_main })}
                            disabled={addresses.length === 0}
                            className={`w-12 h-6 rounded-none relative transition-all border ${addressForm.is_main ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-none transition-all ${addressForm.is_main ? 'left-7 bg-white' : 'left-0.5'}`} />
                        </button>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Definir como Nó Principal de Operações</label>
                    </div>

                    <div className="flex justify-end gap-6 pt-8 border-t border-slate-100 dark:border-slate-900">
                        <Button type="button" variant="ghost" className="uppercase font-black tracking-widest text-[10px]" onClick={() => setIsAddressModalOpen(false)}>Abortar Vinculação</Button>
                        <Button type="submit" className="h-14 px-10 rounded-none uppercase font-black tracking-widest text-[11px]" disabled={isSaving} isLoading={isSaving}>
                            <Save className="w-5 h-5 mr-3" /> Confirmar Dados Geográficos
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};
