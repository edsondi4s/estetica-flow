import React, { useState, useEffect } from 'react';
import { Camera, Plus, Building2, Phone, Mail, MapPin, Save, Clock, Loader2, Palette, Image as ImageIcon, Bot, MessageSquare, Key, Link as LinkIcon, FileText, Trash2, Info, ChevronRight, ChevronLeft, Check, Globe, Map as MapIcon, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface ConfiguracoesProps {
    onLogout?: () => void;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const Configuracoes = ({ onLogout }: ConfiguracoesProps) => {
    const [activeTab, setActiveTab] = useState<'info' | 'branding' | 'hours' | 'ai_agent'>('info');
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
    });

    const [addresses, setAddresses] = useState<any[]>([]);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressForm, setAddressForm] = useState({ id: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', is_main: false });
    const [isSearchingCep, setIsSearchingCep] = useState(false);

    // Legacy support state
    const [agentSettings, setAgentSettings] = useState<any>({});
    const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
    const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
    const [newKnowledge, setNewKnowledge] = useState({ title: '', content: '' });

    const [agents, setAgents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Agent Modal States
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any>(null);
    const [agentFormStep, setAgentFormStep] = useState(1);
    const [agentForm, setAgentForm] = useState({
        name: '',
        agent_role: 'receptivo',
        is_active: true,
        ai_provider: 'openai',
        ai_model: '',
        ai_api_key: '',
        system_prompt: 'Você é um assistente virtual gentil e prestativo...'
    });

    // Deletion Modal State
    const [agentToDelete, setAgentToDelete] = useState<any>(null);

    // OpenRouter model state
    const [openrouterModels, setOpenrouterModels] = useState<any[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    useEffect(() => {
        fetchSettings();
        fetchBusinessHours();
        fetchAgentSettings();
        fetchKnowledgeBase();
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

    const fetchOpenRouterModels = async (apiKey?: string) => {
        setIsFetchingModels(true);
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
            const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
            const json = await res.json();
            const sorted = (json.data || []).sort((a: any, b: any) =>
                (a.name || '').localeCompare(b.name || '')
            );
            setOpenrouterModels(sorted);
        } catch (e) {
            console.error('Erro ao buscar modelos OpenRouter:', e);
        } finally {
            setIsFetchingModels(false);
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

    const fetchAgentSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_agent_settings')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Erro ao buscar agentes:', error);
            } else if (data) {
                setAgents(data);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações dos agentes:', error);
        }
    };

    const fetchKnowledgeBase = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('ai_knowledge_base')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setKnowledgeBase(data || []);
        } catch (error) {
            console.error('Erro ao buscar base de conhecimento:', error);
        }
    };

    const handleAddKnowledge = async () => {
        if (!newKnowledge.title || !newKnowledge.content) {
            toast.error('Preencha o título e o conteúdo da regra.');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('ai_knowledge_base')
                .insert([{
                    user_id: user.id,
                    title: newKnowledge.title,
                    content: newKnowledge.content,
                    type: 'text'
                }])
                .select()
                .single();

            if (error) throw error;

            setKnowledgeBase([data, ...knowledgeBase]);
            setNewKnowledge({ title: '', content: '' });
            setIsAddingKnowledge(false);
            toast.success('Regra adicionada à base de conhecimento!');
        } catch (error: any) {
            toast.error('Erro ao adicionar regra: ' + error.message);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!confirm('Deseja realmente excluir esta regra da base de conhecimento do robô?')) return;

        try {
            const { error } = await supabase
                .from('ai_knowledge_base')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setKnowledgeBase(knowledgeBase.filter(kb => kb.id !== id));
            toast.success('Regra excluída com sucesso.');
        } catch (error: any) {
            toast.error('Erro ao excluir regra: ' + error.message);
        }
    };

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

    const handleOpenAgentModal = (agent: any = null) => {
        if (agent) {
            setEditingAgent(agent);
            setAgentForm({
                name: agent.name || '',
                agent_role: agent.agent_role || 'receptivo',
                is_active: agent.is_active ?? true,
                ai_provider: agent.ai_provider || 'openai',
                ai_model: agent.ai_model || '',
                ai_api_key: agent.ai_api_key || '',
                system_prompt: agent.system_prompt || '',
                enable_logs: agent.enable_logs ?? false
            });
        } else {
            setEditingAgent(null);
            setAgentForm({
                name: '',
                agent_role: 'receptivo',
                is_active: true,
                ai_provider: 'openai',
                ai_model: '',
                ai_api_key: '',
                system_prompt: 'Você é um assistente virtual gentil e prestativo...',
                enable_logs: false
            });
        }
        setAgentFormStep(1);
        setIsAgentModalOpen(true);
    };

    const handleSaveAgent = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            const agentData = {
                ...agentForm,
                user_id: user.id
            };

            if (editingAgent) {
                const { error } = await supabase
                    .from('ai_agent_settings')
                    .update(agentData)
                    .eq('id', editingAgent.id);
                if (error) throw error;
                toast.success('Agente atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('ai_agent_settings')
                    .insert([agentData]);
                if (error) throw error;
                toast.success('Novo agente criado com sucesso!');
            }

            setIsAgentModalOpen(false);
            fetchAgentSettings();
        } catch (error: any) {
            toast.error('Erro ao salvar agente: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleAgent = async (agent: any) => {
        try {
            const { error } = await supabase
                .from('ai_agent_settings')
                .update({ is_active: !agent.is_active })
                .eq('id', agent.id);
            if (error) throw error;
            fetchAgentSettings();
            toast.success(`Agente ${!agent.is_active ? 'ativado' : 'pausado'}`);
        } catch (error: any) {
            toast.error('Erro ao alternar status do agente: ' + error.message);
        }
    };

    const handleDeleteAgent = async () => {
        if (!agentToDelete) return;
        try {
            const { error } = await supabase
                .from('ai_agent_settings')
                .delete()
                .eq('id', agentToDelete.id);
            if (error) throw error;
            fetchAgentSettings();
            setAgentToDelete(null);
            toast.success('Agente removido com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir agente: ' + error.message);
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
                        seo_title: settings.seo_title,
                        seo_description: settings.seo_description,
                        seo_keywords: settings.seo_keywords,
                        tracking_code: settings.tracking_code,
                        tracking_code_body: settings.tracking_code_body,
                        favicon_url: settings.favicon_url,
                        favicon_url_dark: settings.favicon_url_dark,
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
                        seo_title: settings.seo_title,
                        seo_description: settings.seo_description,
                        seo_keywords: settings.seo_keywords,
                        tracking_code: settings.tracking_code,
                        tracking_code_body: settings.tracking_code_body,
                        favicon_url: settings.favicon_url,
                        favicon_url_dark: settings.favicon_url_dark,
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
        <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'info' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Informações Gerais
                </button>
                <button
                    onClick={() => setActiveTab('enderecos')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'enderecos' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Endereços
                </button>
                <button
                    onClick={() => setActiveTab('branding')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'branding' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Personalização Visual
                </button>
                <button
                    onClick={() => setActiveTab('seo')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'seo' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    SEO & Web
                </button>
                <button
                    onClick={() => setActiveTab('hours')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'hours' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Horários
                </button>
                <button
                    onClick={() => setActiveTab('ai_agent')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'ai_agent' ? 'bg-primary dark:bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Bot className="w-4 h-4" /> Assistente IA
                </button>
            </div>

            <Card noPadding>
                {activeTab === 'info' && (
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField
                                label="Nome da Clínica"
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
                                    label="E-mail Comercial"
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
                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MapIcon className="w-5 h-5 text-primary" /> Endereços da Clínica
                                </h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os locais de atendimento</p>
                            </div>
                            <Button className="gap-2" onClick={() => {
                                setAddressForm({ id: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', is_main: addresses.length === 0 });
                                setIsAddressModalOpen(true);
                            }}>
                                <Plus className="w-4 h-4" /> Adicionar
                            </Button>
                        </div>

                        {addresses.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">Nenhum endereço cadastrado.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {addresses.map((addr) => (
                                    <div key={addr.id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                                        {addr.is_main && (
                                            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">PRICIPAL</div>
                                        )}
                                        <div className="flex gap-3 mb-2">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 h-fit">
                                                <MapPin className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">{addr.street}, {addr.number}</h5>
                                                <p className="text-xs text-slate-500">
                                                    {addr.neighborhood} - {addr.city}/{addr.state} <br />
                                                    CEP: {addr.zip_code} {addr.complement && `(${addr.complement})`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-end mt-4">
                                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => {
                                                setAddressForm(addr);
                                                setIsAddressModalOpen(true);
                                            }}>Editar</Button>
                                            <Button variant="danger" size="sm" className="h-7 text-xs px-2 bg-rose-50 text-rose-600 border-transparent hover:bg-rose-100 dark:bg-rose-900/20" onClick={() => handleDeleteAddress(addr.id)}>Remover</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'seo' && (
                    <div className="p-8 space-y-8">
                        <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                                <Globe className="w-5 h-5 text-primary" /> SEO & Web
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Configure as informações do seu site para aparecer corretamente no Google e redes sociais.
                            </p>

                            <div className="grid grid-cols-1 gap-6">
                                <InputField
                                    label="Título do Site (Title Tag)"
                                    placeholder="Ex: EstéticaFlow - Clínica de Estética Avançada"
                                    value={settings.seo_title || ''}
                                    onChange={(e) => setSettings({ ...settings, seo_title: e.target.value })}
                                />

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Descrição (Meta Description)</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-slate-900 dark:text-white resize-y"
                                        placeholder="Um resumo de 1 ou 2 frases sobre a clínica, usado pelo Google..."
                                        value={settings.seo_description || ''}
                                        onChange={(e) => setSettings({ ...settings, seo_description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Palavras-chave (Keywords)</label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-slate-900 dark:text-white resize-y"
                                        placeholder="estética, botox, preenchimento, clínica em são paulo, harmonização..."
                                        value={settings.seo_keywords || ''}
                                        onChange={(e) => setSettings({ ...settings, seo_keywords: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Scripts e Analytics</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Insira códigos de rastreamento (Google Analytics, Pixel do Facebook, etc).</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Scripts no &lt;head&gt;</label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-slate-900 dark:text-white resize-y"
                                        placeholder="<!-- Scripts que carregam antes do body -->"
                                        value={settings.tracking_code || ''}
                                        onChange={(e) => setSettings({ ...settings, tracking_code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Scripts no &lt;body&gt;</label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-slate-900 dark:text-white resize-y"
                                        placeholder="<!-- Scripts no final do body (GTM NoScript, etc) -->"
                                        value={settings.tracking_code_body || ''}
                                        onChange={(e) => setSettings({ ...settings, tracking_code_body: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="p-8 space-y-8">
                        <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary" /> Identidade Visual
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Escolha a cor principal que será aplicada em botões, links e destaques em todo o painel administrativo.
                            </p>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cor Primária</label>
                                <div className="flex flex-wrap gap-4">
                                    {[
                                        '#db2777', // Rosa (Original)
                                        '#7c3aed', // Roxo
                                        '#2563eb', // Azul
                                        '#059669', // Verde
                                        '#d97706', // Laranja
                                        '#dc2626', // Vermelho
                                        '#1e293b', // Slate
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setSettings({ ...settings, primary_color: color })}
                                            className={`w-12 h-12 rounded-xl border-2 transition-all ${settings.primary_color === color ? 'border-primary ring-4 ring-primary/20 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-100 dark:border-slate-800">
                                        <input
                                            type="color"
                                            value={settings.primary_color}
                                            onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                                            className="w-12 h-12 rounded-xl border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">{settings.primary_color}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Logotipos por Tema</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Light Logo */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Versão para Tema Claro</label>
                                        <div className="relative group aspect-video rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden">
                                            {settings.logo_url ? (
                                                <img src={settings.logo_url} className="max-w-[80%] max-h-[80%] object-contain" alt="Logo Light" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                                    <span className="text-xs text-slate-400">Nenhum logo selecionado</span>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                id="logo-light-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleLogoUpload(e, 'light')}
                                                disabled={isUploadingLogo}
                                            />
                                            <label
                                                htmlFor="logo-light-upload"
                                                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold text-sm gap-2"
                                            >
                                                {isUploadingLogo ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5" />}
                                                {settings.logo_url ? 'Trocar Logo' : 'Adicionar Logo'}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dark Logo */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Versão para Tema Escuro</label>
                                        <div className="relative group aspect-video rounded-2xl bg-slate-950 flex items-center justify-center border-2 border-dashed border-slate-800 overflow-hidden">
                                            {settings.logo_url_dark ? (
                                                <img src={settings.logo_url_dark} className="max-w-[80%] max-h-[80%] object-contain" alt="Logo Dark" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                                    <span className="text-xs text-slate-600">Nenhum logo selecionado</span>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                id="logo-dark-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleLogoUpload(e, 'dark')}
                                                disabled={isUploadingLogo}
                                            />
                                            <label
                                                htmlFor="logo-dark-upload"
                                                className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold text-sm gap-2"
                                            >
                                                {isUploadingLogo ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5" />}
                                                {settings.logo_url_dark ? 'Trocar Logo' : 'Adicionar Logo'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 mt-8">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Favicon (Ícone do Navegador)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Light Favicon */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Versão para Tema Claro</label>
                                        <div className="relative group w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden">
                                            {settings.favicon_url ? (
                                                <img src={settings.favicon_url} className="w-12 h-12 object-contain" alt="Favicon Light" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto" />
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                id="favicon-light-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleLogoUpload(e, 'favicon-light')}
                                                disabled={isUploadingLogo}
                                            />
                                            <label
                                                htmlFor="favicon-light-upload"
                                                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold"
                                            >
                                                {isUploadingLogo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dark Favicon */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Versão para Tema Escuro</label>
                                        <div className="relative group w-24 h-24 rounded-2xl bg-slate-950 flex items-center justify-center border-2 border-dashed border-slate-800 overflow-hidden">
                                            {settings.favicon_url_dark ? (
                                                <img src={settings.favicon_url_dark} className="w-12 h-12 object-contain" alt="Favicon Dark" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-6 h-6 text-slate-600 mx-auto" />
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                id="favicon-dark-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleLogoUpload(e, 'favicon-dark')}
                                                disabled={isUploadingLogo}
                                            />
                                            <label
                                                htmlFor="favicon-dark-upload"
                                                className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold"
                                            >
                                                {isUploadingLogo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Dica de Design</h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Cores vibrantes funcionam melhor para botões de ação. Se você mudar a cor para um tom muito claro,
                                o sistema ajustará automaticamente alguns contrastes para manter a acessibilidade.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="p-8">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" /> Horário de Funcionamento
                        </h4>

                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        ) : (
                            <div className="space-y-4">
                                {businessHours.map((bh, index) => (
                                    <div key={bh.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <div className="flex items-center gap-3 w-48 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const newBh = [...businessHours];
                                                    newBh[index].is_working_day = !newBh[index].is_working_day;
                                                    setBusinessHours(newBh);
                                                }}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${bh.is_working_day ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${bh.is_working_day ? 'left-5' : 'left-1'}`} />
                                            </button>
                                            <span className={`text-sm font-medium ${bh.is_working_day ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {DAYS_OF_WEEK[bh.day_of_week]}
                                            </span>
                                        </div>

                                        <div className={`flex items-center gap-2 flex-1 transition-opacity duration-200 ${!bh.is_working_day ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                            <input
                                                type="time"
                                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                                value={bh.start_time?.substring(0, 5) || '08:00'}
                                                onChange={(e) => {
                                                    const newBh = [...businessHours];
                                                    newBh[index].start_time = e.target.value;
                                                    setBusinessHours(newBh);
                                                }}
                                            />
                                            <span className="text-slate-400">até</span>
                                            <input
                                                type="time"
                                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                                value={bh.end_time?.substring(0, 5) || '18:00'}
                                                onChange={(e) => {
                                                    const newBh = [...businessHours];
                                                    newBh[index].end_time = e.target.value;
                                                    setBusinessHours(newBh);
                                                }}
                                            />
                                        </div>
                                        {!bh.is_working_day && (
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Fechado</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ai_agent' && (
                    <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* 1. Conexão Global do WhatsApp */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <LinkIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Conexão WhatsApp</h4>
                                    <p className="text-xs text-slate-500">Configure a conexão central que todos os agentes usarão para enviar mensagens.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Plataforma</label>
                                    <select
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={settings.whatsapp_provider_type}
                                        onChange={(e) => setSettings({ ...settings, whatsapp_provider_type: e.target.value })}
                                    >
                                        <option value="evolution">Evolution API (Recomendado)</option>
                                        <option value="zapi">Z-API</option>
                                    </select>
                                </div>

                                <InputField
                                    label="URL da API"
                                    icon={LinkIcon}
                                    value={settings.whatsapp_provider_url || ''}
                                    placeholder="Ex: https://api.exemplo.com"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_url: e.target.value })}
                                />

                                <InputField
                                    label="Nome da Instância / Número"
                                    icon={Phone}
                                    value={settings.whatsapp_provider_instance || ''}
                                    placeholder="Ex: esteticaflow_bot"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_instance: e.target.value })}
                                />

                                <InputField
                                    label="Token de Conexão"
                                    icon={Key}
                                    type="password"
                                    value={settings.whatsapp_provider_token || ''}
                                    placeholder="Token de segurança"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_token: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* 2. Lembretes Automáticos */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Lembretes de Agendamento</h4>
                                        <p className="text-xs text-slate-500">Enviar mensagens automáticas para confirmar presença.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                        {settings.reminder_active ? 'Ativado' : 'Desativado'}
                                    </span>
                                    <button
                                        onClick={() => setSettings({ ...settings, reminder_active: !settings.reminder_active })}
                                        className={`w-12 h-6 rounded-full relative transition-colors ${settings.reminder_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.reminder_active ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 transition-opacity ${!settings.reminder_active ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Tempo Antecedência</label>
                                    <select
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={settings.reminder_minutes}
                                        onChange={(e) => setSettings({ ...settings, reminder_minutes: parseInt(e.target.value) })}
                                    >
                                        <option value={30}>30 Minutos antes</option>
                                        <option value={60}>1 Hora antes</option>
                                        <option value={120}>2 Horas antes</option>
                                        <option value={1440}>24 Horas antes</option>
                                    </select>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <Info className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-[11px] text-slate-500">
                                        Se o cliente responder confirmando, a IA detectará e alterará o status para <strong>"Confirmado"</strong> automaticamente.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Gestão de Agentes */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Agentes de IA</h4>
                                        <p className="text-xs text-slate-500">Crie múltiplos agentes para diferentes papéis (Recepcionista, Promoções, etc).</p>
                                    </div>
                                </div>
                                <Button onClick={() => handleOpenAgentModal()} className="gap-2 shrink-0">
                                    <Plus className="w-4 h-4" /> Novo Agente
                                </Button>
                            </div>

                            {agents.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Bot className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">Nenhum agente configurado ainda.</p>
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenAgentModal()} className="mt-2 text-primary">
                                        Criar meu primeiro agente
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {agents.map((agent) => (
                                        <div key={agent.id} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary/30 transition-all group relative">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className={`p-3 rounded-xl ${agent.is_active ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <Bot className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-bold text-slate-900 dark:text-white truncate">{agent.name}</h5>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                        {agent.agent_role}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleAgent(agent)}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${agent.is_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${agent.is_active ? 'left-5' : 'left-0.5'}`} />
                                                </button>
                                            </div>

                                            <p className="text-xs text-slate-500 line-clamp-2 mb-4 italic">
                                                "{agent.system_prompt.substring(0, 100)}..."
                                            </p>

                                            <div className="flex gap-2 pt-2">
                                                <Button variant="outline" size="sm" className="flex-1 text-xs py-1" onClick={() => handleOpenAgentModal(agent)}>
                                                    Editar
                                                </Button>
                                                <button
                                                    onClick={() => setAgentToDelete(agent)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Base de Conhecimento */}
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <FileText className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Base de Conhecimento</h4>
                                        <p className="text-xs text-slate-500">Regras e informações gerais que todos os agentes podem consultar.</p>
                                    </div>
                                </div>
                                {!isAddingKnowledge && (
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingKnowledge(true)} className="gap-2">
                                        <Plus className="w-4 h-4" /> Adicionar Instrução
                                    </Button>
                                )}
                            </div>

                            {isAddingKnowledge && (
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <h5 className="font-bold text-slate-900 dark:text-white">Nova Instrução</h5>
                                    <InputField
                                        label="Título do Documento/Regra"
                                        placeholder="Ex: Tabela de Preços, Política de Cancelamento..."
                                        value={newKnowledge.title}
                                        onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Conteúdo do Texto</label>
                                        <textarea
                                            rows={6}
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-slate-900 dark:text-white resize-y"
                                            placeholder="Ex: Botox: R$ 1.200 (1x) ou R$ 1.350 em 3x. Aceitamos PIX e Cartão..."
                                            value={newKnowledge.content}
                                            onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button variant="ghost" onClick={() => setIsAddingKnowledge(false)}>Cancelar</Button>
                                        <Button onClick={handleAddKnowledge}>Salvar Regra</Button>
                                    </div>
                                </div>
                            )}

                            {knowledgeBase.length === 0 && !isAddingKnowledge ? (
                                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3 opacity-50" />
                                    <p className="text-slate-500 font-medium">Nenhuma regra ou documento configurado.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {knowledgeBase.map((kb) => (
                                        <div key={kb.id} className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <h5 className="font-bold text-slate-900 dark:text-white pr-8">{kb.title}</h5>
                                                <button
                                                    onClick={() => handleDeleteKnowledge(kb.id)}
                                                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-4 flex-1">
                                                {kb.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-8 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-4">
                    {onLogout && (
                        <Button variant="danger" size="sm" onClick={onLogout} className="opacity-70 hover:opacity-100">
                            Sair da Conta
                        </Button>
                    )}
                    <div className="flex gap-4 ml-auto">
                        <Button variant="ghost" disabled={isSaving} onClick={() => fetchSettings()}>Cancelar</Button>
                        <Button className="gap-2" size="lg" onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </Card >

            {/* Modal de Criação/Edição de Agente (Multi-step) */}
            <Modal
                isOpen={isAgentModalOpen}
                onClose={() => setIsAgentModalOpen(false)}
                title={editingAgent ? `Editar Agente: ${editingAgent.name}` : "Criar Novo Agente Inteligente"}
                description={`Passo ${agentFormStep} de 3: ${agentFormStep === 1 ? 'Identidade' : agentFormStep === 2 ? 'Cérebro e Modelo' : 'Comportamento'}`}
            >
                <div className="space-y-6">
                    {/* Stepper Visual */}
                    <div className="flex items-center gap-2 mb-4">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex-1 flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${agentFormStep >= step ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                    {agentFormStep > step ? <Check className="w-4 h-4" /> : step}
                                </div>
                                {step < 3 && <div className={`flex-1 h-1 rounded-full ${agentFormStep > step ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`} />}
                            </div>
                        ))}
                    </div>

                    {agentFormStep === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <InputField
                                label="Nome do Agente"
                                placeholder="Ex: Recepcionista Virtual"
                                value={agentForm.name}
                                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                            />
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Papel do Agente</label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                    value={agentForm.agent_role}
                                    onChange={(e) => setAgentForm({ ...agentForm, agent_role: e.target.value })}
                                >
                                    <option value="receptivo">Atendimento Receptivo (Geral)</option>
                                    <option value="vendas">Vendas / Promoção</option>
                                    <option value="recuperacao">Recuperação de Carrinho</option>
                                    <option value="confirmacao">Confirmação de Agendamento</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {agentFormStep === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Provedor de IA</label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                    value={agentForm.ai_provider}
                                    onChange={(e) => {
                                        const provider = e.target.value;
                                        setAgentForm({ ...agentForm, ai_provider: provider, ai_model: '' });
                                        setModelSearch('');
                                        if (provider === 'openrouter') {
                                            fetchOpenRouterModels(agentForm.ai_api_key);
                                        }
                                    }}
                                >
                                    <option value="openai">OpenAI (GPT)</option>
                                    <option value="groq">Groq (Rápido e Gratuito)</option>
                                    <option value="openrouter">OpenRouter (Centenas de Modelos)</option>
                                    <option value="gemini">Google Gemini</option>
                                    <option value="anthropic">Anthropic Claude</option>
                                </select>
                            </div>

                            {/* OpenRouter: dropdown searchable de modelos */}
                            {agentForm.ai_provider === 'openrouter' ? (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Modelo</label>

                                    {/* Hint sobre a chave */}
                                    {!agentForm.ai_api_key && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                                            <Info className="w-3.5 h-3.5 shrink-0" />
                                            Informe sua chave abaixo para carregar os modelos disponíveis.
                                        </div>
                                    )}

                                    {/* Search + dropdown */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={isFetchingModels ? 'Carregando modelos...' : 'Buscar modelo (ex: llama, mistral, gpt)...'}
                                            className="w-full pl-4 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-slate-400"
                                            value={modelSearch}
                                            onChange={(e) => setModelSearch(e.target.value)}
                                            disabled={isFetchingModels}
                                        />
                                        {isFetchingModels && (
                                            <Loader2 className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 animate-spin" />
                                        )}
                                    </div>

                                    {/* Modelo selecionado atual */}
                                    {agentForm.ai_model && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                                            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span className="text-xs font-mono text-primary font-bold truncate">{agentForm.ai_model}</span>
                                            <button className="ml-auto text-slate-400 hover:text-red-500 text-xs" onClick={() => setAgentForm({ ...agentForm, ai_model: '' })}>✕</button>
                                        </div>
                                    )}

                                    {/* Lista de modelos filtrada */}
                                    {openrouterModels.length > 0 && modelSearch.trim().length > 0 && (
                                        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-50 dark:divide-slate-800 shadow-lg">
                                            {openrouterModels
                                                .filter(m =>
                                                    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
                                                    (m.name || '').toLowerCase().includes(modelSearch.toLowerCase())
                                                )
                                                .slice(0, 30)
                                                .map((model: any) => (
                                                    <button
                                                        key={model.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAgentForm({ ...agentForm, ai_model: model.id });
                                                            setModelSearch('');
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{model.name || model.id}</span>
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="text-[10px] font-mono text-slate-400 truncate">{model.id}</span>
                                                            {model.context_length && (
                                                                <span className="text-[10px] text-slate-400">{(model.context_length / 1000).toFixed(0)}K ctx</span>
                                                            )}
                                                            {model.pricing?.prompt && (
                                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                                                    ${(parseFloat(model.pricing.prompt) * 1_000_000).toFixed(2)}/M tokens
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}

                                    {/* Botão recarregar */}
                                    <button
                                        type="button"
                                        onClick={() => fetchOpenRouterModels(agentForm.ai_api_key)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                        disabled={isFetchingModels}
                                    >
                                        {isFetchingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                        {isFetchingModels ? 'Carregando...' : 'Recarregar lista de modelos'}
                                    </button>
                                </div>
                            ) : (
                                /* Para outros provedores: campo de texto com sugestões */
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Modelo (Slug)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        placeholder={
                                            agentForm.ai_provider === 'openai' ? 'gpt-4o-mini / gpt-4o / gpt-3.5-turbo' :
                                                agentForm.ai_provider === 'groq' ? 'llama-3.3-70b-versatile / mixtral-8x7b-32768' :
                                                    agentForm.ai_provider === 'gemini' ? 'gemini-1.5-flash / gemini-1.5-pro' :
                                                        agentForm.ai_provider === 'anthropic' ? 'claude-3-haiku-20240307 / claude-3-opus-20240229' :
                                                            'Slug do modelo...'
                                        }
                                        value={agentForm.ai_model}
                                        onChange={(e) => setAgentForm({ ...agentForm, ai_model: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        {agentForm.ai_provider === 'openai' && 'Recomendado: gpt-4o-mini (melhor custo-benefício)'}
                                        {agentForm.ai_provider === 'groq' && 'Recomendado: llama-3.3-70b-versatile (gratuito e rápido)'}
                                        {agentForm.ai_provider === 'gemini' && 'Recomendado: gemini-1.5-flash (rápido e gratuito)'}
                                        {agentForm.ai_provider === 'anthropic' && 'Recomendado: claude-3-haiku-20240307 (mais barato)'}
                                    </p>
                                </div>
                            )}

                            <InputField
                                label="Chave de API"
                                type="password"
                                placeholder="sk-..."
                                value={agentForm.ai_api_key}
                                onChange={(e) => {
                                    setAgentForm({ ...agentForm, ai_api_key: e.target.value });
                                    // Se OpenRouter e tiver chave, carrega modelos
                                    if (agentForm.ai_provider === 'openrouter' && e.target.value.length > 10) {
                                        fetchOpenRouterModels(e.target.value);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {agentFormStep === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Personalidade (System Prompt)</label>
                                    <textarea
                                        rows={8}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white resize-none"
                                        placeholder="Instrua como o agente deve falar..."
                                        value={agentForm.system_prompt}
                                        onChange={(e) => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
                                    />
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Modo Debug (Logs)</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Salva todas as interações e erros detalhados. Desative para economizar espaço.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={agentForm.enable_logs}
                                            onChange={(e) => setAgentForm({ ...agentForm, enable_logs: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between pt-4 gap-3">
                        {agentFormStep > 1 ? (
                            <Button variant="outline" onClick={() => setAgentFormStep(v => v - 1)} className="gap-2">
                                <ChevronLeft className="w-4 h-4" /> Voltar
                            </Button>
                        ) : (
                            <Button variant="ghost" onClick={() => setIsAgentModalOpen(false)}>Cancelar</Button>
                        )}

                        {agentFormStep < 3 ? (
                            <Button onClick={() => setAgentFormStep(v => v + 1)} className="gap-2 ml-auto">
                                Próximo <ChevronRight className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleSaveAgent} disabled={isSaving} className="gap-2 ml-auto">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingAgent ? 'Salvar Alterações' : 'Criar Agente'}
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!agentToDelete}
                onClose={() => setAgentToDelete(null)}
                onConfirm={handleDeleteAgent}
                title="Excluir Agente"
                message={`Tem certeza que deseja excluir o agente "${agentToDelete?.name}"? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir Agente"
            />

            {/* Modal de Endereço */}
            <Modal
                isOpen={isAddressModalOpen}
                onClose={() => setIsAddressModalOpen(false)}
                title={addressForm.id ? 'Editar Endereço' : 'Novo Endereço'}
                description="Preencha os dados do local de atendimento."
            >
                <form onSubmit={handleSaveAddress} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <Loader2 className="absolute right-3 top-9 w-4 h-4 text-slate-400 animate-spin" />
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <InputField
                                label="Logradouro"
                                value={addressForm.street}
                                onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                                placeholder="Rua, Avenida..."
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                label="Estado (UF)"
                                value={addressForm.state}
                                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                placeholder="SP"
                                maxLength={2}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="is_main"
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                            checked={addressForm.is_main}
                            onChange={(e) => setAddressForm({ ...addressForm, is_main: e.target.checked })}
                            disabled={addresses.length === 0} // Primeiro endereço é sempre principal
                        />
                        <label htmlFor="is_main" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Definir como endereço principal
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="ghost" onClick={() => setIsAddressModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Endereço
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};
