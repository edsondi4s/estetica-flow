import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Loader2, Zap, Clock, Key, Link as LinkIcon, Info, ChevronRight, ChevronLeft, Save, Code, X, FileText, Phone, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export const AgentesIA = () => {
    const [activeTab, setActiveTab] = useState('whatsapp');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<any>({});
    const [agents, setAgents] = useState<any[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
    const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
    const [newKnowledge, setNewKnowledge] = useState({ title: '', content: '' });

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
        api_key_openai: '',
        api_key_anthropic: '',
        api_key_gemini: '',
        api_key_groq: '',
        api_key_openrouter: '',
        system_prompt: 'Você é um assistente virtual gentil e prestativo...',
        enable_logs: false,
        recovery_minutes: 30
    });

    // Deletion Modal State
    const [agentToDelete, setAgentToDelete] = useState<any>(null);

    // OpenRouter model state
    const [openrouterModels, setOpenrouterModels] = useState<any[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const [isClearingLogs, setIsClearingLogs] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchAgentSettings();
        fetchKnowledgeBase();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error && error.code !== 'PGRST116') {
                console.error('Erro ao buscar configurações:', error);
            } else if (data) {
                setSettings(data);
            }
        } catch (error) {
            console.error('Erro ao buscar definições:', error);
        } finally {
            setIsLoading(false);
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

    const handleSaveGlobalSettings = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('settings')
                .update({
                    whatsapp_provider_type: settings.whatsapp_provider_type,
                    whatsapp_provider_url: settings.whatsapp_provider_url,
                    whatsapp_provider_instance: settings.whatsapp_provider_instance,
                    whatsapp_provider_token: settings.whatsapp_provider_token,
                    reminder_active: settings.reminder_active,
                    reminder_minutes: settings.reminder_minutes,
                    reminder_message: settings.reminder_message,
                })
                .eq('id', settings.id);

            if (error) throw error;
            toast.success('Configurações de conexão salvas!');
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
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
                api_key_openai: agent.api_key_openai || '',
                api_key_anthropic: agent.api_key_anthropic || '',
                api_key_gemini: agent.api_key_gemini || '',
                api_key_groq: agent.api_key_groq || '',
                api_key_openrouter: agent.api_key_openrouter || '',
                system_prompt: agent.system_prompt || '',
                enable_logs: agent.enable_logs ?? false,
                recovery_minutes: agent.recovery_minutes || 30
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
                api_key_openai: '',
                api_key_anthropic: '',
                api_key_gemini: '',
                api_key_groq: '',
                api_key_openrouter: '',
                system_prompt: 'Você é um assistente virtual gentil e prestativo...',
                enable_logs: false,
                recovery_minutes: 30
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
                name: agentForm.name,
                agent_role: agentForm.agent_role,
                is_active: agentForm.is_active,
                ai_provider: agentForm.ai_provider,
                ai_model: agentForm.ai_model,
                ai_api_key: agentForm.ai_api_key,
                api_key_openai: agentForm.api_key_openai,
                api_key_anthropic: agentForm.api_key_anthropic,
                api_key_gemini: agentForm.api_key_gemini,
                api_key_groq: agentForm.api_key_groq,
                api_key_openrouter: agentForm.api_key_openrouter,
                system_prompt: agentForm.system_prompt,
                enable_logs: agentForm.enable_logs,
                recovery_minutes: agentForm.recovery_minutes,
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

    const handleClearLogs = async () => {
        if (!confirm('Tem certeza que deseja apagar todos os logs de diagnóstico? Esta ação é irreversível.')) {
            return;
        }

        setIsClearingLogs(true);
        try {
            const { error } = await supabase.from('debug_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            toast.success('Logs de diagnóstico apagados com sucesso!');
        } catch (error) {
            console.error('Erro ao limpar logs:', error);
            toast.error('Ocorreu um erro ao limpar os logs.');
        } finally {
            setIsClearingLogs(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto w-full space-y-10 mt-6">

            {/* Navegação via Abas */}
            <div className="flex overflow-x-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-[32px] p-1.5 gap-2 mb-8">
                {[
                    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: <LinkIcon className="w-4 h-4" /> },
                    { id: 'agents', label: 'Operadores IA', icon: <Bot className="w-4 h-4" /> },
                    { id: 'reminders', label: 'Lembretes', icon: <Clock className="w-4 h-4" /> },
                    { id: 'knowledge', label: 'Base de Conhecimento', icon: <FileText className="w-4 h-4" /> }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all rounded-[28px] whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-950 text-primary shadow-sm border border-slate-200/50 dark:border-slate-800 mx-auto'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transparent'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] min-h-[500px] overflow-hidden relative">
                {/* 1. Conexão Global do WhatsApp */}
                {activeTab === 'whatsapp' && (
                <div className="p-8 relative transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <LinkIcon className="w-5 h-5 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-serif text-slate-900 dark:text-white">Conexão com <span className="text-primary italic">WhatsApp</span></h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">Protocolo de Conexão</label>
                            <select
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                value={settings.whatsapp_provider_type}
                                onChange={(e) => setSettings({ ...settings, whatsapp_provider_type: e.target.value })}
                            >
                                <option value="evolution">EVOLUTION API (v2.0 Native)</option>
                                <option value="zapi">Z-API (Cloud Bridge)</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">Endereço do Endpoint (URL)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full pl-11 pr-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                                    value={settings.whatsapp_provider_url || ''}
                                    placeholder="https://api.instance.sh"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_url: e.target.value })}
                                />
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">ID da Instância / Identificador</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full pl-11 pr-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                                    value={settings.whatsapp_provider_instance || ''}
                                    placeholder="ESTETICA_FLOW_CORE"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_instance: e.target.value })}
                                />
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">Token de Autenticação</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    className="w-full pl-11 pr-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                                    value={settings.whatsapp_provider_token || ''}
                                    placeholder="••••••••••••••••"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_token: e.target.value })}
                                />
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6 relative z-10 border-t border-slate-100 dark:border-slate-800/50 mt-6">
                        <Button className="h-11 px-8 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]" onClick={handleSaveGlobalSettings} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Conexão
                        </Button>
                    </div>
                </div>
                )}

                {/* 2. Lembretes Automáticos */}
                {activeTab === 'reminders' && (
                <div className="p-8 relative transition-all duration-300 group animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                                <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Lembretes <span className="text-primary italic">Automáticos</span></h4>
                                <p className="text-xs font-semibold text-slate-500 tracking-wide">Confirmar agendamentos sozinho</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className={`text-xs font-semibold tracking-wide ${settings.reminder_active ? 'text-primary' : 'text-slate-400'}`}>
                                {settings.reminder_active ? 'Status: Ativo' : 'Status: Em Espera'}
                            </span>
                            <button
                                onClick={() => setSettings({ ...settings, reminder_active: !settings.reminder_active })}
                                className={`w-14 h-7 rounded-full relative transition-all border ${settings.reminder_active ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-950 border-slate-300 dark:border-slate-800'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${settings.reminder_active ? 'left-8' : 'left-0.5 bg-white dark:bg-slate-700'}`} />
                            </button>
                        </div>
                    </div>

                    <div className={`mt-10 pt-10 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-10 transition-all duration-500 ${!settings.reminder_active ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                        <div className="space-y-4">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">Intervalo de Transmissão (Tempo de Antecedência)</label>
                            <select
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all appearance-none cursor-pointer mb-2"
                                value={[30, 60, 120, 1440].includes(settings.reminder_minutes) ? settings.reminder_minutes : 'custom'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSettings({ ...settings, reminder_minutes: val === 'custom' ? 45 : parseInt(val) })
                                }}
                            >
                                <option value={30}>30 Minutos antes (Resposta Rápida)</option>
                                <option value={60}>1 Hora antes (Padrão)</option>
                                <option value={120}>2 Horas antes (Moderado)</option>
                                <option value={1440}>1 Dia antes / 24 Horas (Longo Prazo)</option>
                                <option value="custom">
                                    {![30, 60, 120, 1440].includes(settings.reminder_minutes) && settings.reminder_minutes > 0 
                                        ? `Personalizado (${settings.reminder_minutes} minutos antes)` 
                                        : 'Personalizado (Digitar minutos)'}
                                </option>
                            </select>
                            
                            {![30, 60, 120, 1440].includes(settings.reminder_minutes) && (
                                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="w-24 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                                        value={settings.reminder_minutes || ''}
                                        onChange={(e) => setSettings({ ...settings, reminder_minutes: parseInt(e.target.value) || 0 })}
                                    />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 block">Minutos antes do horário marcado</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-start gap-4 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                            <Info className="w-5 h-5 text-primary shrink-0 mt-1" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                <span className="text-slate-900 dark:text-white font-semibold block mb-1">Como funciona:</span>
                                O sistema entende as respostas dos clientes e confirma ou cancela o agendamento sozinho, poupando seu tempo.
                            </p>
                        </div>

                        <div className="col-span-1 sm:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <h5 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-primary" />
                                    Mensagem Personalizada do Lembrete
                                </h5>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Escreva como o robô deve abordar o seu cliente. Clique nos botões abaixo para inserir os dados automáticos do agendamento onde o cursor estiver posicionado. Se deixar em branco, usaremos nossa mensagem padrão.
                                </p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 border border-slate-100 dark:border-slate-800 rounded-xl">
                                {['{{nome}}', '{{servico}}', '{{data}}', '{{hora}}', '{{profissional}}'].map(variable => (
                                    <button
                                        key={variable}
                                        type="button"
                                        className="text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                        onClick={() => {
                                            const textarea = document.getElementById('reminder-message') as HTMLTextAreaElement;
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = settings.reminder_message || '';
                                                const newMessage = text.substring(0, start) + variable + text.substring(end);
                                                setSettings({ ...settings, reminder_message: newMessage });
                                                setTimeout(() => {
                                                    textarea.focus();
                                                    textarea.setSelectionRange(start + variable.length, start + variable.length);
                                                }, 0);
                                            }
                                        }}
                                    >
                                        <Plus className="w-3 h-3" /> {variable.replace(/[{}]/g, '')}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="relative">
                                <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md z-10">
                                    <Phone className="w-4 h-4 text-white" />
                                </div>
                                <textarea
                                    id="reminder-message"
                                    rows={5}
                                    className="w-full pl-16 pr-5 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white resize-y leading-relaxed"
                                    placeholder="Ex: Olá {{nome}}, seu agendamento de {{servico}} está marcado para as {{hora}} com o(a) {{profissional}}. Responda com 'SIM' para confirmar."
                                    value={settings.reminder_message || ''}
                                    onChange={(e) => setSettings({ ...settings, reminder_message: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 pt-6 relative z-10 border-t border-slate-100 dark:border-slate-800/50">
                        <Button className="h-11 px-8 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]" onClick={handleSaveGlobalSettings} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Atualizar Lembretes
                        </Button>
                    </div>
                </div>
                )}

                {/* 3. Lista de Agentes IA */}
                {activeTab === 'agents' && (
                <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-serif text-slate-900 dark:text-white">Operadores <span className="text-primary italic">Virtuais</span></h3>
                            <div className="h-px bg-slate-100 dark:bg-slate-800/60 flex-1 hidden sm:block w-32"></div>
                        </div>
                        <Button onClick={() => handleOpenAgentModal()} className="gap-2 h-11 px-6 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
                            <Plus className="w-4 h-4" /> Novo Agente
                        </Button>
                    </div>

                    {agents.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)]">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl mx-auto mb-4">
                                <Bot className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-lg font-serif text-slate-700 dark:text-slate-300 mb-2">Nenhum Agente Ativo</p>
                            <Button variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 mt-4 h-11 px-6 rounded-xl" onClick={() => handleOpenAgentModal()}>
                                Criar Meu Primeiro Agente
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {agents.map((agent) => (
                                <div key={agent.id} className="bg-white dark:bg-slate-950 rounded-[20px] border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)] hover:border-primary/30 transition-all overflow-hidden group flex flex-col sm:flex-row items-stretch sm:items-center">
                                    <div className="p-5 flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                                        <div className={`w-14 h-14 flex items-center justify-center rounded-2xl border transition-all shrink-0 group-hover:scale-105 duration-300 ${agent.is_active ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                                            <Bot className="w-6 h-6" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h5 className="font-serif text-xl font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{agent.name}</h5>
                                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 ${agent.is_active ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                    {agent.is_active ? 'Ativo' : 'Pausado'}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1.5 line-clamp-1 italic">
                                                "{agent.system_prompt}"
                                            </p>
                                            
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800">
                                                🛠️ Função: {agent.agent_role === 'vendas' ? 'Vendas & Agendamento' :
                                                 agent.agent_role === 'recuperacao' ? 'Recuperação de Inativos' :
                                                 agent.agent_role === 'confirmacao' ? 'Confirmação de Retorno' :
                                                 'Atendimento Geral'
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 sm:bg-transparent border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800/60 flex items-center gap-3 justify-end shrink-0">
                                        <button
                                            onClick={() => handleToggleAgent(agent)}
                                            className={`w-12 h-6.5 rounded-full relative transition-all border mr-2 flex items-center px-0.5 outline-none ${agent.is_active ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}
                                            title={agent.is_active ? "Pausar agente" : "Ativar agente"}
                                            style={{ height: '26px' }}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white transition-all shadow-sm ${agent.is_active ? 'ml-6' : 'ml-0'}`} />
                                        </button>
                                        <Button variant="outline" className="h-10 px-5 rounded-xl text-sm font-medium border-slate-200 dark:border-slate-700 hover:text-primary hover:border-primary hover:bg-primary/5 shadow-sm" onClick={() => handleOpenAgentModal(agent)}>
                                            Personalizar
                                        </Button>
                                        <button
                                            onClick={() => setAgentToDelete(agent)}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:border-rose-200 dark:hover:border-rose-800/50 shadow-sm transition-all outline-none"
                                            title="Excluir agente"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                )}

                {/* 4. Base de Conhecimento */}
                {activeTab === 'knowledge' && (
                <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                <FileText className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h4 className="text-xl font-serif text-slate-900 dark:text-white mb-1">Base de <span className="text-indigo-500 italic">Conhecimento</span></h4>
                                <p className="text-xs font-medium text-slate-500">Informações técnicas obrigatórias para os robôs</p>
                            </div>
                        </div>
                        {!isAddingKnowledge && (
                            <Button size="sm" variant="outline" onClick={() => setIsAddingKnowledge(true)} className="gap-2 h-11 px-6 rounded-xl font-medium border-slate-200 dark:border-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
                                <Plus className="w-4 h-4" /> Ensinar Nova Regra
                            </Button>
                        )}
                    </div>

                    {isAddingKnowledge && (
                        <div className="bg-white dark:bg-slate-950 rounded-[32px] p-8 border border-indigo-100 dark:border-indigo-900/30 shadow-[0_8px_30px_rgba(99,102,241,0.06)] space-y-8 animate-in fade-in slide-in-from-top-4">
                            <h5 className="text-sm font-semibold text-indigo-500 uppercase tracking-widest">Base de Dados: Nova Informação</h5>
                            <div className="space-y-6">
                                <InputField
                                    label="Título da Regra"
                                    placeholder="Ex: Tabela de Preços 2024"
                                    value={newKnowledge.title}
                                    onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                                />
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Conteúdo da Instrução</label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white resize-y leading-relaxed"
                                        placeholder="Regra 01: Nunca desmarcar serviços pagos.\nRegra 02: Botox custa R$ 800..."
                                        value={newKnowledge.content}
                                        onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                                <Button variant="ghost" className="h-11 px-6 rounded-xl font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setIsAddingKnowledge(false)}>Cancelar</Button>
                                <Button className="h-11 px-8 rounded-xl font-medium bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_8px_30px_rgba(99,102,241,0.2)]" onClick={handleAddKnowledge}>Salvar Regra</Button>
                            </div>
                        </div>
                    )}

                    {knowledgeBase.length === 0 && !isAddingKnowledge ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)]">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl mx-auto mb-4">
                                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-lg font-serif text-slate-700 dark:text-slate-300">Sua base de conhecimento está vazia</p>
                            <p className="text-sm font-medium text-slate-500 mt-2">Adicione regras essenciais para o atendimento</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {knowledgeBase.map((kb) => (
                                <div key={kb.id} className="bg-white dark:bg-slate-950 rounded-[24px] border border-slate-100 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] relative group overflow-hidden flex flex-col hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)] hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all p-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <h5 className="font-serif text-lg text-slate-900 dark:text-white pr-8">{kb.title}</h5>
                                        <button
                                            onClick={() => handleDeleteKnowledge(kb.id)}
                                            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-4 flex-1 leading-relaxed">
                                        {kb.content}
                                    </p>
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                                        <span className="text-[10px] font-mono font-medium text-slate-400">ID: {kb.id.substring(0,8)}</span>
                                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-md">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Validado</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Modal de Criação/Edição de Agente (Multi-step) */}
            <Modal
                isOpen={isAgentModalOpen}
                onClose={() => setIsAgentModalOpen(false)}
                title={editingAgent ? `Configurações do Agente: ${editingAgent.name}` : "Configurar Novo Agente"}
                description={`${agentFormStep === 1 ? 'Identidade' : agentFormStep === 2 ? 'Motor de Inteligência' : 'Instruções de Operação'}`}
            >
                <div className="space-y-8 py-4">
                    {/* Stepper Luxury */}
                    <div className="flex items-center gap-2 mb-8">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex-1 flex flex-col gap-2">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${agentFormStep >= step ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`} />
                                <span className={`text-[10px] font-semibold uppercase tracking-widest ${agentFormStep >= step ? 'text-primary' : 'text-slate-400'}`}>Passo 0{step}</span>
                            </div>
                        ))}
                    </div>

                    {agentFormStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <InputField
                                label="Nome do Assistente"
                                placeholder="ex. Atendente Virtual"
                                value={agentForm.name}
                                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                            />
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Função do Agente</label>
                                <select
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                    value={agentForm.agent_role}
                                    onChange={(e) => setAgentForm({ ...agentForm, agent_role: e.target.value })}
                                >
                                    <option value="receptivo">ATENDIMENTO (Geral)</option>
                                    <option value="vendas">NEGOCIAÇÃO & AGENDAMENTO</option>
                                    <option value="recuperacao">RECUPERAÇÃO DE INATIVOS</option>
                                    <option value="confirmacao">COBRANÇA DE PRESENÇA</option>
                                </select>
                            </div>

                            {agentForm.agent_role === 'recuperacao' && (
                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="text-sm font-semibold text-primary">Configurações de Resgate</h4>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Ociosidade Mínima (Minutos)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder-slate-400"
                                            value={agentForm.recovery_minutes}
                                            onChange={(e) => setAgentForm({ ...agentForm, recovery_minutes: parseInt(e.target.value) || 30 })}
                                        />
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">Tempo que a IA irá aguardar sem resposta do cliente (após negociar o horário) antes de enviar a mensagem empática de resgate.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {agentFormStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Provedor de IA</label>
                                <select
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                    value={agentForm.ai_provider}
                                    onChange={(e) => {
                                        const provider = e.target.value;
                                        let correspondingKey = '';
                                        
                                        // Mapeia a chave correspondente do estado baseado no provedor
                                        if (provider === 'openai') correspondingKey = agentForm.api_key_openai;
                                        else if (provider === 'anthropic') correspondingKey = agentForm.api_key_anthropic;
                                        else if (provider === 'gemini') correspondingKey = agentForm.api_key_gemini;
                                        else if (provider === 'groq') correspondingKey = agentForm.api_key_groq;
                                        else if (provider === 'openrouter') correspondingKey = agentForm.api_key_openrouter;

                                        setAgentForm({ 
                                            ...agentForm, 
                                            ai_provider: provider, 
                                            ai_model: '',
                                            ai_api_key: correspondingKey // Define a chave visível para a que está salva para este provedor
                                        });
                                        
                                        setModelSearch('');
                                        if (provider === 'openrouter' && correspondingKey) {
                                            fetchOpenRouterModels(correspondingKey);
                                        }
                                    }}
                                >
                                    <option value="openai">OpenAI (GPT-4o, GPT-4o Mini)</option>
                                    <option value="groq">Groq (Llama-3, Mixtral)</option>
                                    <option value="openrouter">OpenRouter (Acesso Total)</option>
                                    <option value="gemini">Google Gemini (Flash 2.0)</option>
                                    <option value="anthropic">Anthropic Claude (3.5 Sonnet)</option>
                                </select>
                            </div>

                            {agentForm.ai_provider === 'openrouter' ? (
                                <div className="space-y-4">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Repositório de Modelos</label>

                                    {!agentForm.ai_api_key && (
                                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-sm text-amber-600 dark:text-amber-400 font-medium rounded-xl">
                                            <Info className="w-5 h-5 shrink-0" />
                                            Token necessário para requisição de modelos.
                                        </div>
                                    )}

                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={isFetchingModels ? 'Sincronizando...' : 'Pesquisar modelos'}
                                            className="w-full pl-5 pr-12 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder-slate-400"
                                            value={modelSearch}
                                            onChange={(e) => setModelSearch(e.target.value)}
                                            disabled={isFetchingModels}
                                        />
                                        {isFetchingModels && (
                                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                                        )}
                                    </div>

                                    {agentForm.ai_model && (
                                        <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold truncate">{agentForm.ai_model}</span>
                                            <button className="ml-auto text-slate-400 hover:text-rose-500 transition-colors" onClick={() => setAgentForm({ ...agentForm, ai_model: '' })}>
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {openrouterModels.length > 0 && modelSearch.trim().length > 0 && (
                                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-50 relative">
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
                                                        className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                                                    >
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{model.name || model.id}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-400">{model.id}</span>
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">ID do Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all placeholder-slate-400"
                                        placeholder="ex. gpt-4o-mini"
                                    value={agentForm.ai_model}
                                        onChange={(e) => setAgentForm({ ...agentForm, ai_model: e.target.value })}
                                    />
                                </div>
                            )}

                            <InputField
                                label="Chave de API (Secret Key)"
                                type="password"
                                placeholder="sk-pro-••••••••••••••••"
                                value={agentForm.ai_api_key}
                                onChange={(e) => {
                                    const newKey = e.target.value;
                                    const provider = agentForm.ai_provider;
                                    
                                    // Atualiza a chave global e a específica
                                    const updatedKeys: any = { ai_api_key: newKey };
                                    if (provider === 'openai') updatedKeys.api_key_openai = newKey;
                                    else if (provider === 'anthropic') updatedKeys.api_key_anthropic = newKey;
                                    else if (provider === 'gemini') updatedKeys.api_key_gemini = newKey;
                                    else if (provider === 'groq') updatedKeys.api_key_groq = newKey;
                                    else if (provider === 'openrouter') updatedKeys.api_key_openrouter = newKey;

                                    setAgentForm({ ...agentForm, ...updatedKeys });
                                    
                                    if (provider === 'openrouter' && (newKey?.length || 0) > 10) {
                                        fetchOpenRouterModels(newKey);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {agentFormStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Instruções do Sistema (Prompt)</label>
                                <textarea
                                    rows={10}
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white resize-y leading-relaxed"
                                    placeholder="Ex: Você é um assistente da clínica..."
                                    value={agentForm.system_prompt}
                                    onChange={(e) => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
                                />
                            </div>

                            <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${agentForm.enable_logs ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Code className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">Diagnóstico e Histórico</h4>
                                        <p className="text-xs font-medium text-slate-500">Salvar detalhes das conversas para conferência</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAgentForm({ ...agentForm, enable_logs: !agentForm.enable_logs })}
                                    className={`w-11 h-6 rounded-full relative transition-all border ${agentForm.enable_logs ? 'bg-indigo-500 border-indigo-500' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${agentForm.enable_logs ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-xl text-sm font-medium border-rose-200 dark:border-rose-900/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all font-semibold"
                                onClick={handleClearLogs}
                                disabled={isClearingLogs}
                            >
                                {isClearingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Limpar Histórico de Diagnóstico
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-between pt-6 gap-4 border-t border-slate-100 dark:border-slate-800/50 mt-6">
                        {agentFormStep > 1 ? (
                            <Button variant="ghost" className="h-11 px-6 rounded-xl font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setAgentFormStep(v => v - 1)}>
                                <ChevronLeft className="w-5 h-5 mr-2" /> Voltar
                            </Button>
                        ) : (
                            <Button variant="ghost" className="h-11 px-6 rounded-xl font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setIsAgentModalOpen(false)}>Cancelar</Button>
                        )}

                        {agentFormStep < 3 ? (
                            <Button onClick={() => setAgentFormStep(v => v + 1)} className="h-11 px-8 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)] ml-auto">
                                Próxima Fase <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleSaveAgent} disabled={isSaving} className="h-11 px-8 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)] ml-auto" isLoading={isSaving}>
                                <Save className="w-4 h-4 mr-2" /> Concluir Agente
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!agentToDelete}
                onClose={() => setAgentToDelete(null)}
                onConfirm={handleDeleteAgent}
                title="TERMINAR_AGENTE"
                message={`Deseja realmente desativar permanentemente o operador "${agentToDelete?.name}"? A conexão será perdida.`}
                confirmLabel="Finalizar Operador"
            />
        </div>
    );
};
