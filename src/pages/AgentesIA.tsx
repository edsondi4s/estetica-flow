import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Loader2, Zap, Clock, Key, Link as LinkIcon, Info, ChevronRight, ChevronLeft, Save, Code, X, FileText, Phone } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export const AgentesIA = () => {
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
        enable_logs: false
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
                api_key_openai: '',
                api_key_anthropic: '',
                api_key_gemini: '',
                api_key_groq: '',
                api_key_openrouter: '',
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
        <div className="max-w-6xl mx-auto w-full space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-950 flex items-center justify-center rounded-sm border border-slate-900 shadow-xl">
                        <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Agentes de <span className="text-primary">IA</span></h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de assistentes virtuais e automação de atendimento</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenAgentModal()} className="gap-3 h-14 px-8 rounded-none uppercase font-black tracking-widest text-[11px]">
                    <Plus className="w-5 h-5" /> Novo Agente
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* 1. Conexão Global do WhatsApp */}
                <Card className="p-10 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-32 -mt-32"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center rounded-none border border-slate-200 dark:border-slate-800">
                            <LinkIcon className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tight">Conexão com <span className="text-primary">WhatsApp</span></h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Protocolo de Conexão</label>
                            <select
                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white transition-all appearance-none cursor-pointer"
                                value={settings.whatsapp_provider_type}
                                onChange={(e) => setSettings({ ...settings, whatsapp_provider_type: e.target.value })}
                            >
                                <option value="evolution">EVOLUTION API (v2.0 Native)</option>
                                <option value="zapi">Z-API (Cloud Bridge)</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Endereço do Endpoint (URL)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
                                    value={settings.whatsapp_provider_url || ''}
                                    placeholder="https://api.instance.sh"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_url: e.target.value })}
                                />
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ID da Instância / Identificador</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
                                    value={settings.whatsapp_provider_instance || ''}
                                    placeholder="ESTETICA_FLOW_CORE"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_instance: e.target.value })}
                                />
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Token de Autenticação</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
                                    value={settings.whatsapp_provider_token || ''}
                                    placeholder="••••••••••••••••"
                                    onChange={(e) => setSettings({ ...settings, whatsapp_provider_token: e.target.value })}
                                />
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6 relative z-10">
                        <Button className="h-12 px-10 rounded-none uppercase font-black tracking-widest text-[10px]" onClick={handleSaveGlobalSettings} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Conexão
                        </Button>
                    </div>
                </Card>

                {/* 2. Lembretes Automáticos */}
                <Card className="p-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl">
                                <Clock className="w-7 h-7 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-md font-black text-slate-950 dark:text-white uppercase tracking-tighter mb-1">Lembretes <span className="text-amber-500">Automáticos</span></h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirmar agendamentos sozinho</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${settings.reminder_active ? 'text-primary' : 'text-slate-400'}`}>
                                {settings.reminder_active ? 'Status: Ativo' : 'Status: Em Espera'}
                            </span>
                            <button
                                onClick={() => setSettings({ ...settings, reminder_active: !settings.reminder_active })}
                                className={`w-14 h-7 rounded-none relative transition-all border ${settings.reminder_active ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-950 border-slate-300 dark:border-slate-800'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-slate-950 rounded-none transition-all ${settings.reminder_active ? 'left-8 bg-white' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div className={`mt-10 pt-10 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-10 transition-all duration-500 ${!settings.reminder_active ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Intervalo de Transmissão</label>
                            <select
                                className="w-full px-6 py-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white appearance-none cursor-pointer"
                                value={settings.reminder_minutes}
                                onChange={(e) => setSettings({ ...settings, reminder_minutes: parseInt(e.target.value) })}
                            >
                                <option value={30}>T-30 Minutos (Rapid Response)</option>
                                <option value={60}>T-60 Minutos (Standard)</option>
                                <option value={120}>T-120 Minutos (Extended)</option>
                                <option value={1440}>T-24 Hours (Long Term)</option>
                            </select>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20">
                            <Info className="w-5 h-5 text-primary shrink-0 mt-1" />
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                <span className="text-slate-900 dark:text-white uppercase font-black block mb-1">Como funciona:</span>
                                O sistema entende as respostas dos clientes e confirma ou cancela o agendamento sozinho, poupando seu tempo.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 relative z-10">
                        <Button className="h-10 px-8 rounded-none uppercase font-black tracking-widest text-[9px] bg-slate-950 hover:bg-slate-900" onClick={handleSaveGlobalSettings}>
                            Atualizar Lembretes
                        </Button>
                    </div>
                </Card>

                {/* 3. Lista de Agentes IA */}
                <div className="space-y-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operadores_Virtuais</span>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    </div>

                    {agents.length === 0 ? (
                        <div className="text-center py-24 bg-white dark:bg-slate-950 border-2 border-dashed border-slate-100 dark:border-slate-900 rounded-none">
                            <Bot className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6 opacity-50" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Nenhum Agente Ativo</p>
                            <Button variant="ghost" className="text-primary font-black uppercase tracking-widest text-[10px]" onClick={() => handleOpenAgentModal()}>
                                Criar Meu Primeiro Agente
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {agents.map((agent) => (
                                <div key={agent.id} className="h-full">
                                    <Card noPadding className="group relative border-2 border-slate-100 dark:border-slate-900 hover:border-primary/40 transition-all flex flex-col h-full">
                                    <div className="p-8 flex-1">
                                        <div className="flex items-center gap-6 mb-8">
                                            <div className={`w-14 h-14 flex items-center justify-center border transition-all ${agent.is_active ? 'bg-primary/5 border-primary text-primary' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                                                <Bot className="w-7 h-7" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-black text-slate-950 dark:text-white uppercase tracking-widest truncate">{agent.name}</h5>
                                                <span className="text-[9px] uppercase tracking-[0.2em] font-black text-primary/70 bg-primary/5 px-3 py-1 mt-1 inline-block">
                                                    {agent.agent_role}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleToggleAgent(agent)}
                                                className={`w-12 h-6 rounded-none relative transition-all border ${agent.is_active ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-950 border-slate-300 dark:border-slate-800'}`}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-none transition-all ${agent.is_active ? 'left-7 bg-white' : 'left-0.5'}`} />
                                            </button>
                                        </div>

                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-8 line-clamp-3 italic opacity-70">
                                            "{agent.system_prompt}"
                                        </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex gap-4 border-t border-slate-100 dark:border-slate-800">
                                        <Button variant="outline" className="flex-1 h-10 rounded-none uppercase font-black tracking-widest text-[9px]" onClick={() => handleOpenAgentModal(agent)}>
                                            Customizar
                                        </Button>
                                        <button
                                            onClick={() => setAgentToDelete(agent)}
                                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Base de Conhecimento */}
                <div className="space-y-10 pt-10 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-slate-950 flex items-center justify-center border border-slate-800 shadow-xl">
                                <FileText className="w-7 h-7 text-slate-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tight">Base de <span className="text-slate-400">Conhecimento</span></h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações técnicas obrigatórias para os robôs</p>
                            </div>
                        </div>
                        {!isAddingKnowledge && (
                            <Button size="sm" variant="outline" onClick={() => setIsAddingKnowledge(true)} className="gap-3 h-12 px-6 rounded-none border-slate-200 dark:border-slate-800 uppercase font-black tracking-widest text-[10px]">
                                <Plus className="w-4 h-4" /> Ensinar Nova Regra
                            </Button>
                        )}
                    </div>

                    {isAddingKnowledge && (
                        <div className="p-10 bg-slate-50 dark:bg-slate-950 border-2 border-primary/20 rounded-none space-y-8 animate-in fade-in slide-in-from-top-4">
                            <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Base de Dados: Adicionar Nova Informação</h5>
                            <div className="space-y-6">
                                <InputField
                                    label="Título da Regra"
                                    placeholder="Ex: Tabela de Preços 2024"
                                    value={newKnowledge.title}
                                    onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                                />
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteúdo da Instrução</label>
                                    <textarea
                                        rows={8}
                                        className="w-full px-6 py-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-medium outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white resize-y"
                                        placeholder="Regra 01: Nunca desmarcar serviços pagos.\nRegra 02: Botox custa R$ 800..."
                                        value={newKnowledge.content}
                                        onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-6 pt-6 border-t border-slate-100 dark:border-slate-900">
                                <Button variant="ghost" className="uppercase font-black tracking-widest text-[10px]" onClick={() => setIsAddingKnowledge(false)}>Cancelar</Button>
                                <Button className="h-12 px-10 rounded-none uppercase font-black tracking-widest text-[10px]" onClick={handleAddKnowledge}>Salvar Regra</Button>
                            </div>
                        </div>
                    )}

                    {knowledgeBase.length === 0 && !isAddingKnowledge ? (
                        <div className="text-center py-16 bg-slate-50 dark:bg-black/10 border border-slate-100 dark:border-slate-900 border-dashed opacity-50">
                            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sua base de conhecimento está vazia. Adicione regras para o atendimento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {knowledgeBase.map((kb) => (
                                <div key={kb.id} className="p-8 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 relative group overflow-hidden flex flex-col hover:border-slate-200 dark:hover:border-slate-800 transition-all">
                                    <div className="flex justify-between items-start mb-6">
                                        <h5 className="font-black text-slate-950 dark:text-white uppercase tracking-widest pr-12">{kb.title}</h5>
                                        <button
                                            onClick={() => handleDeleteKnowledge(kb.id)}
                                            className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-6 flex-1 leading-relaxed border-l-2 border-slate-100 dark:border-slate-900 pl-4 py-2 bg-slate-50/30 dark:bg-slate-900/30">
                                        {kb.content}
                                    </p>
                                    <div className="mt-6 pt-4 flex items-center justify-between">
                                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">ID da Regra: {kb.id.substring(0,8)}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 blur-[1px]"></div>
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Validado</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Criação/Edição de Agente (Multi-step) */}
            <Modal
                isOpen={isAgentModalOpen}
                onClose={() => setIsAgentModalOpen(false)}
                title={editingAgent ? `Configurações do Agente: ${editingAgent.name}` : "Configurar Novo Agente"}
                description={`${agentFormStep === 1 ? 'Identidade' : agentFormStep === 2 ? 'Motor de Inteligência' : 'Instruções de Operação'}`}
            >
                <div className="space-y-8 py-4">
                    {/* Stepper Industrial */}
                    <div className="flex items-center gap-1 mb-8">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex-1 flex flex-col gap-2">
                                <div className={`h-1.5 transition-all duration-500 ${agentFormStep >= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-900'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${agentFormStep >= step ? 'text-primary' : 'text-slate-400'}`}>Passo 0{step}</span>
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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Função do Agente</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white appearance-none cursor-pointer"
                                    value={agentForm.agent_role}
                                    onChange={(e) => setAgentForm({ ...agentForm, agent_role: e.target.value })}
                                >
                                    <option value="receptivo">ATENDIMENTO (Geral)</option>
                                    <option value="vendas">NEGOCIAÇÃO & AGENDAMENTO</option>
                                    <option value="recuperacao">RECUPERAÇÃO DE INATIVOS</option>
                                    <option value="confirmacao">COBRANÇA DE PRESENÇA</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {agentFormStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Provedor de IA</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white appearance-none cursor-pointer"
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Repositório de Modelos</label>

                                    {!agentForm.ai_api_key && (
                                        <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest">
                                            <Info className="w-4 h-4 shrink-0" />
                                            Token necessário para requisição de modelos.
                                        </div>
                                    )}

                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={isFetchingModels ? 'SYNCING_DATA...' : 'QUERY_MODEL_REPOSITORY...'}
                                            className="w-full pl-6 pr-12 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white placeholder-slate-400"
                                            value={modelSearch}
                                            onChange={(e) => setModelSearch(e.target.value)}
                                            disabled={isFetchingModels}
                                        />
                                        {isFetchingModels && (
                                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                                        )}
                                    </div>

                                    {agentForm.ai_model && (
                                        <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20">
                                            <div className="w-2 h-2 bg-primary animate-pulse" />
                                            <span className="text-[11px] font-mono text-primary font-black truncate uppercase tracking-widest">{agentForm.ai_model}</span>
                                            <button className="ml-auto text-slate-400 hover:text-red-500" onClick={() => setAgentForm({ ...agentForm, ai_model: '' })}>
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {openrouterModels.length > 0 && modelSearch.trim().length > 0 && (
                                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-2xl z-50 relative">
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
                                                        className="w-full text-left px-6 py-4 hover:bg-primary/5 transition-all group flex flex-col gap-1"
                                                    >
                                                        <span className="text-[12px] font-black text-slate-950 dark:text-white uppercase tracking-widest truncate group-hover:text-primary transition-colors">{model.name || model.id}</span>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[9px] font-mono text-slate-400 uppercase">{model.id}</span>
                                                            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700"></span>
                                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Verified_Hash</span>
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ID do Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-black outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white"
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
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Instruções do Sistema (Prompt)</label>
                                <textarea
                                    rows={10}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none text-[13px] font-mono font-medium outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary text-slate-950 dark:text-white resize-none leading-relaxed"
                                    placeholder="# INSTRUÇÕES_MÁTRICE\n- Responda como um humano...\n- Seja direto..."
                                    value={agentForm.system_prompt}
                                    onChange={(e) => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
                                />
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex items-center justify-center border shadow-sm ${agentForm.enable_logs ? 'bg-primary/5 border-primary text-primary' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                                        <Code className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-black text-slate-950 dark:text-white uppercase tracking-widest mb-1">Diagnóstico e Histórico</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">Salvar detalhes das conversas para conferência</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAgentForm({ ...agentForm, enable_logs: !agentForm.enable_logs })}
                                    className={`w-12 h-6 rounded-none relative transition-all border ${agentForm.enable_logs ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-950 border-slate-300 dark:border-slate-800'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-none transition-all ${agentForm.enable_logs ? 'left-7 bg-white' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <Button 
                                variant="ghost" 
                                className="w-full h-12 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all uppercase font-black tracking-widest text-[9px]"
                                onClick={handleClearLogs}
                                disabled={isClearingLogs}
                            >
                                {isClearingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-3" /> : <Trash2 className="w-4 h-4 mr-3" />}
                                Limpar Histórico de Diagnóstico (Logs)
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-between pt-8 gap-6 border-t border-slate-100 dark:border-slate-900">
                        {agentFormStep > 1 ? (
                            <Button variant="ghost" className="uppercase font-black tracking-widest text-[10px] h-12 px-8" onClick={() => setAgentFormStep(v => v - 1)}>
                                <ChevronLeft className="w-5 h-5 mr-3" /> Back
                            </Button>
                        ) : (
                            <Button variant="ghost" className="uppercase font-black tracking-widest text-[10px] h-12 px-8" onClick={() => setIsAgentModalOpen(false)}>Cancelar</Button>
                        )}

                        {agentFormStep < 3 ? (
                            <Button onClick={() => setAgentFormStep(v => v + 1)} className="h-12 px-10 rounded-none uppercase font-black tracking-widest text-[11px] ml-auto group">
                                Próxima Fase <ChevronRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        ) : (
                            <Button onClick={handleSaveAgent} disabled={isSaving} className="h-14 px-12 rounded-none uppercase font-black tracking-widest text-[11px] ml-auto shadow-xl shadow-primary/20" isLoading={isSaving}>
                                <Save className="w-5 h-5 mr-3" /> Efetivar Agente
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
