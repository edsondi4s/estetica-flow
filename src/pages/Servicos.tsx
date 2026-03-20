import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, Loader2, Power, PowerOff, Check, Sparkles, TrendingUp, DollarSign } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const Servicos = () => {
    const [services, setServices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);

    // Form states
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [duration, setDuration] = useState('60');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('Facial');
    const [isActive, setIsActive] = useState(true);

    // Confirmation Modal state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });
    const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ isOpen: boolean; name: string | null }>({
        isOpen: false,
        name: null
    });

    const [stats, setStats] = useState({
        mostScheduled: { name: 'Carregando...', count: 0 },
        mostProfitable: { name: 'Carregando...', revenue: 0 },
        lastScheduled: { name: 'Carregando...', date: '' }
    });

    useEffect(() => {
        fetchServices();
        fetchCategories();
        fetchServiceStats();
    }, []);

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('name');
            if (error) throw error;
            setServices(data || []);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchServiceStats = async () => {
        try {
            const { data: appointments, error } = await supabase
                .from('appointments')
                .select('created_at, status, services(id, name, price)')
                .not('status', 'eq', 'Cancelado');

            if (error) throw error;

            if (!appointments || appointments.length === 0) {
                setStats({
                    mostScheduled: { name: 'Nenhum dado', count: 0 },
                    mostProfitable: { name: 'Nenhum dado', revenue: 0 },
                    lastScheduled: { name: 'Nenhum dado', date: '' }
                });
                return;
            }

            const serviceCounts: Record<string, { count: number, name: string, revenue: number }> = {};
            let latestApp = appointments[0];

            appointments.forEach(app => {
                const srv = Array.isArray(app.services) ? app.services[0] : app.services;
                if (!srv || !srv.id) return;

                if (!serviceCounts[srv.id]) {
                    serviceCounts[srv.id] = { count: 0, name: srv.name, revenue: 0 };
                }
                serviceCounts[srv.id].count += 1;
                serviceCounts[srv.id].revenue += (srv.price || 0);

                if (new Date(app.created_at) > new Date(latestApp.created_at)) {
                    latestApp = app;
                }
            });

            const countsArray = Object.values(serviceCounts);
            
            const mostScheduled = countsArray.length > 0 
                ? countsArray.reduce((prev, current) => (prev.count > current.count) ? prev : current)
                : { name: 'Nenhum dado', count: 0, revenue: 0 };
                
            const mostProfitable = countsArray.length > 0
                ? countsArray.reduce((prev, current) => (prev.revenue > current.revenue) ? prev : current)
                : { name: 'Nenhum dado', count: 0, revenue: 0 };
            
            let latestSrvName = 'Desconhecido';
            if (latestApp && latestApp.services) {
                 const srv = Array.isArray(latestApp.services) ? latestApp.services[0] : latestApp.services;
                 if (srv) latestSrvName = srv.name;
            }

            setStats({
                mostScheduled: { name: mostScheduled.name, count: mostScheduled.count },
                mostProfitable: { name: mostProfitable.name, revenue: mostProfitable.revenue },
                lastScheduled: { 
                    name: latestSrvName, 
                    date: latestApp ? new Date(latestApp.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '' 
                }
            });

        } catch (error) {
            console.error('Erro ao buscar estatísticas de serviços:', error);
            setStats({
                mostScheduled: { name: 'Erro', count: 0 },
                mostProfitable: { name: 'Erro', revenue: 0 },
                lastScheduled: { name: 'Erro', date: '' }
            });
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('service_categories')
                .select('*')
                .order('name');
            if (error) throw error;
            setCategories(data || []);

            // Set default category if none selected and categories exist
            if (data && data.length > 0 && !category) {
                setCategory(data[0].name);
            }
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
        }
    };

    const handleOpenModal = (service: any = null) => {
        if (service) {
            setEditingService(service);
            setName(service.name);
            setDesc(service.description || '');
            setDuration(service.duration_minutes.toString());
            setPrice(service.price.toString());
            setCategory(service.category || '');
            setIsActive(service.is_active ?? true);
        } else {
            setEditingService(null);
            setName('');
            setDesc('');
            setDuration('60');
            setPrice('');
            setCategory(categories.length > 0 ? categories[0].name : '');
            setIsActive(true);
        }
        setShowModal(true);
    };

    const handleSaveService = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const serviceData = {
                name,
                description: desc,
                duration_minutes: parseInt(duration),
                price: parseFloat(price.replace(',', '.')),
                category: isAddingCategory ? newCategoryName : category,
                is_active: isActive
            };

            if (editingService) {
                const { error } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', editingService.id);
                if (error) throw error;
                toast.success('Serviço atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('services')
                    .insert([serviceData]);
                if (error) throw error;
                toast.success('Serviço cadastrado com sucesso!');

                // If a new category was created, save it to the table too
                if (isAddingCategory && newCategoryName) {
                    await supabase.from('service_categories').insert([{ name: newCategoryName }]);
                    fetchCategories();
                }
            }

            setShowModal(false);
            setIsAddingCategory(false);
            setNewCategoryName('');
            fetchServices();
        } catch (error: any) {
            toast.error('Erro ao salvar serviço: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateDescription = async () => {
        if (!name) {
            toast.error('Preencha o nome do serviço primeiro para a IA saber o que gerar.');
            return;
        }

        setIsGeneratingDesc(true);
        try {
            const { data: agents, error: agentError } = await supabase
                .from('ai_agent_settings')
                .select('*')
                .eq('is_active', true)
                .limit(1);

            if (agentError || !agents || agents.length === 0) {
                toast.error('Nenhum Agente IA ativo configurado com chave de API.');
                setIsGeneratingDesc(false);
                return;
            }

            const agent = agents[0];
            const provider = agent.ai_provider;
            let apiKey = '';
            
            if (provider === 'openai') apiKey = agent.api_key_openai;
            else if (provider === 'anthropic') apiKey = agent.api_key_anthropic;
            else if (provider === 'gemini') apiKey = agent.api_key_gemini;
            else if (provider === 'groq') apiKey = agent.api_key_groq;
            else if (provider === 'openrouter') apiKey = agent.api_key_openrouter;

            if (!apiKey) {
                toast.error('A chave de API do provedor IA não está configurada no seu agente.');
                setIsGeneratingDesc(false);
                return;
            }

            let generatedText = '';
            const catName = isAddingCategory && newCategoryName ? newCategoryName : category || 'Estética';
            const prompt = `Atue como um especialista em marketing de clínicas de estética. Crie uma descrição curta, atraente e comercial (máximo de 3 linhas) para um serviço chamado "${name}" na categoria "${catName}". Seja persuasivo e foque nos benefícios para o cliente. Não use aspas ou introduções, apenas o texto da descrição direto.`;

            if (provider === 'openai' || provider === 'openrouter' || provider === 'groq') {
                const baseURL = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 
                                provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 
                                'https://api.openai.com/v1/chat/completions';
                                
                const res = await fetch(baseURL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: agent.ai_model || (provider === 'openai' ? 'gpt-4o-mini' : provider === 'groq' ? 'llama3-8b-8192' : 'openai/gpt-3.5-turbo'),
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        max_tokens: 150
                    })
                });

                if (!res.ok) throw new Error('Falha na API: ' + res.statusText);
                const json = await res.json();
                generatedText = json.choices[0].message.content;
            } else if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
                if (!res.ok) throw new Error('Falha na API Gemini: ' + res.statusText);
                const json = await res.json();
                generatedText = json.candidates[0].content.parts[0].text;
            } else if (provider === 'anthropic') {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerously-allow-browser': 'true'
                    },
                    body: JSON.stringify({
                        model: agent.ai_model || 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 150
                    })
                });
                if (!res.ok) throw new Error('Falha na API Anthropic: ' + res.statusText);
                const json = await res.json();
                generatedText = json.content[0].text;
            }

            if (generatedText) {
                setDesc(generatedText.trim().replace(/^["']|["']$/g, ''));
                toast.success('Descrição mágica gerada!');
            }

        } catch (error: any) {
            console.error('Erro na IA:', error);
            toast.error('Erro ao gerar descrição: ' + error.message);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    const toggleStatus = async (service: any) => {
        try {
            const { error } = await supabase
                .from('services')
                .update({ is_active: !service.is_active })
                .eq('id', service.id);
            if (error) throw error;
            fetchServices();
            toast.success(`Serviço ${service.is_active ? 'desativado' : 'ativado'}!`);
        } catch (error: any) {
            toast.error('Erro ao atualizar status: ' + error.message);
        }
    };

    const handleDelete = async () => {
        try {
            if (confirmDelete.id === 'bulk') {
                if (selectedServices.length === 0) return;
                const { error } = await supabase
                    .from('services')
                    .delete()
                    .in('id', selectedServices);
                if (error) throw error;
                toast.success(`${selectedServices.length} opções removidas com sucesso!`);
                setSelectedServices([]);
            } else {
                if (!confirmDelete.id) return;
                const { error } = await supabase
                    .from('services')
                    .delete()
                    .eq('id', confirmDelete.id);
                if (error) throw error;
                toast.success('Serviço removido com sucesso!');
            }

            setConfirmDelete({ isOpen: false, id: null });
            fetchServices();
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
        }
    };

    const handleDeleteCategoryConf = async () => {
        if (!confirmDeleteCategory.name) return;

        try {
            const { error } = await supabase
                .from('service_categories')
                .delete()
                .eq('name', confirmDeleteCategory.name);
            if (error) throw error;

            setConfirmDeleteCategory({ isOpen: false, name: null });
            
            const remaining = categories.filter(c => c.name !== confirmDeleteCategory.name);
            setCategories(remaining);
            if (category === confirmDeleteCategory.name) {
                setCategory(remaining.length > 0 ? remaining[0].name : '');
            }
            
            toast.success('Classificação removida com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir a classificação: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col gap-10 reveal-content">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-serif text-slate-900 dark:text-white tracking-tight">
                        Meus Serviços
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-2">Gestão completa e estatísticas de tratamentos oferecidos</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 h-11 px-6 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
                    <Plus className="w-4 h-4" /> Novo Serviço
                </Button>
            </div>

            {/* Cards de Indicadores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-500 shrink-0 transition-transform group-hover:scale-105">
                            <TrendingUp className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-0.5">Mais Agendado</p>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate mb-1" title={stats.mostScheduled.name}>{stats.mostScheduled.name}</h4>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-serif font-bold text-indigo-500">{stats.mostScheduled.count}</span>
                                <span className="text-xs font-medium text-slate-400">agendamentos</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-500 shrink-0 transition-transform group-hover:scale-105">
                            <DollarSign className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-0.5">Maior Receita</p>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate mb-1" title={stats.mostProfitable.name}>{stats.mostProfitable.name}</h4>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-bold text-emerald-500">R$</span>
                                <span className="text-xl font-serif font-bold text-emerald-500">
                                    {stats.mostProfitable.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-all"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center text-amber-500 shrink-0 transition-transform group-hover:scale-105">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-0.5">Último Agendado</p>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate mb-1" title={stats.lastScheduled.name}>{stats.lastScheduled.name}</h4>
                            <div className="flex items-center mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                    Dia {stats.lastScheduled.date || '--/--/----'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedServices.length > 0 && (
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 -mt-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <span className="text-sm font-semibold text-primary">
                        {selectedServices.length} {selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}
                    </span>
                    <button
                        onClick={() => setConfirmDelete({ isOpen: true, id: 'bulk' })}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-95 rounded-xl transition-all shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Excluir Selecionados
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pl-8 pr-4 py-5 w-12 text-center group/th cursor-pointer">
                                        <div className="flex items-center justify-center">
                                            <label className="relative flex items-center justify-center cursor-pointer group/checkbox">
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={services.length > 0 && selectedServices.length === services.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedServices(services.map(s => s.id));
                                                        } else {
                                                            setSelectedServices([]);
                                                        }
                                                    }}
                                                />
                                                <div className="w-5 h-5 rounded-[6px] border border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800/50 group-hover/checkbox:border-primary/50 shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-slate-900">
                                                    <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" strokeWidth={3} />
                                                </div>
                                            </label>
                                        </div>
                                    </th>
                                    <th className="pr-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Serviço</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classificação</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duração</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Valor (R$)</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {services.map((service) => (
                                    <tr key={service.id} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all ${!service.is_active ? 'opacity-50' : ''} ${selectedServices.includes(service.id) ? 'bg-primary/5 dark:bg-primary/20' : ''}`}>
                                        <td className="pl-8 pr-4 py-6 w-12 text-center">
                                            <div className="flex items-center justify-center">
                                                <label className="relative flex items-center justify-center cursor-pointer group/checkbox">
                                                    <input
                                                        type="checkbox"
                                                        className="peer sr-only"
                                                        checked={selectedServices.includes(service.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedServices([...selectedServices, service.id]);
                                                            } else {
                                                                setSelectedServices(selectedServices.filter(id => id !== service.id));
                                                            }
                                                        }}
                                                    />
                                                    <div className="w-5 h-5 rounded-[6px] border border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 flex items-center justify-center bg-white dark:bg-slate-800/50 group-hover/checkbox:border-primary/50 shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-slate-900">
                                                        <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" strokeWidth={3} />
                                                    </div>
                                                </label>
                                            </div>
                                        </td>
                                        <td className="pr-8 py-6">
                                            <div className="flex flex-col gap-1.5 max-w-sm">
                                                <span className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{service.name}</span>
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{service.description || 'Sem descrição'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
                                                {service.category || 'Padrão'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-semibold">{service.duration_minutes}<span className="text-xs text-slate-400 ml-1">min</span></span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-base font-semibold text-slate-900 dark:text-white">
                                                    R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex justify-center items-center gap-3">
                                                <button
                                                    onClick={() => toggleStatus(service)}
                                                    role="switch"
                                                    aria-checked={service.is_active}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 shadow-sm ${
                                                        service.is_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                                                    }`}
                                                >
                                                    <span className="sr-only">Status do serviço</span>
                                                    <span
                                                        aria-hidden="true"
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                            service.is_active ? 'translate-x-5' : 'translate-x-0'
                                                        }`}
                                                    />
                                                </button>
                                                <span className={`text-sm font-semibold w-12 text-left transition-colors ${
                                                    service.is_active ? 'text-primary' : 'text-slate-500'
                                                }`}>
                                                    {service.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 transition-all">
                                                <button
                                                    onClick={() => handleOpenModal(service)}
                                                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/30 transition-all rounded-lg shadow-sm"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: service.id })}
                                                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all rounded-lg shadow-sm"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {services.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 mb-4">
                                                    <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-500">Nenhum serviço cadastrado ainda.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingService ? "Editar Serviço" : "Novo Serviço"}
            >
                <form onSubmit={handleSaveService} className="space-y-6 pt-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Nome do Serviço</label>
                        <input
                            placeholder="Ex: Limpeza de Pele Profunda"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Duração (Minutos)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Valor de Venda (R$)</label>
                            <input
                                placeholder="0,00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Classificação</label>
                            <button
                                type="button"
                                onClick={() => setIsAddingCategory(!isAddingCategory)}
                                className="text-xs font-medium text-primary hover:underline transition-all"
                            >
                                {isAddingCategory ? 'Selecionar Existente' : '+ Criar Nova'}
                            </button>
                        </div>

                        {isAddingCategory ? (
                            <input
                                placeholder="Nome da nova classificação"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                                autoFocus
                            />
                        ) : (
                            <div className="flex items-center gap-3">
                                <select
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    {categories.length === 0 ? (
                                        <option value="">Sem classificações disponíveis</option>
                                    ) : (
                                        categories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))
                                    )}
                                </select>
                                {category && categories.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteCategory({ isOpen: true, name: category })}
                                        className="p-3.5 border border-rose-200 dark:border-rose-900/30 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 hover:bg-rose-100 transition-colors"
                                        title="Excluir classificação"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Descrição (Visível aos clientes)</label>
                            <button
                                type="button"
                                onClick={handleGenerateDescription}
                                disabled={isGeneratingDesc}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-all bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-primary/20"
                            >
                                {isGeneratingDesc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {isGeneratingDesc ? 'Gerando...' : 'Gerar com IA'}
                            </button>
                        </div>
                        <textarea
                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all resize-none"
                            placeholder="Descreva brevemente o serviço..."
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">Disponibilidade</h4>
                            <p className="text-xs font-medium text-slate-500">Serviço disponível para agendamento</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`w-11 h-6 rounded-full relative transition-all border ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isActive ? 'left-6' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <div className="pt-6 flex gap-4 border-t border-slate-100 dark:border-slate-800/50 mt-6 mt-top">
                        <Button type="button" variant="ghost" className="flex-1 h-12 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 h-12 rounded-xl font-medium shadow-md shadow-primary/20 hover:shadow-lg transition-all" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            {editingService ? 'Atualizar Serviço' : 'Criar Serviço'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Excluir Serviço"
                message="Tem certeza que deseja excluir este serviço? Esta ação não poderá ser desfeita."
                confirmLabel="Sim, Excluir"
                cancelLabel="Não, Cancelar"
            />
            
            <ConfirmModal
                isOpen={confirmDeleteCategory.isOpen}
                onClose={() => setConfirmDeleteCategory({ isOpen: false, name: null })}
                onConfirm={handleDeleteCategoryConf}
                title="Excluir Classificação"
                message={`Tem certeza que deseja excluir a classificação "${confirmDeleteCategory.name}"? Isso não apagará os serviços, mas eles ficarão sem essa categoria.`}
                confirmLabel="Sim, Excluir"
                cancelLabel="Não, Cancelar"
            />
        </div>
    );
};
