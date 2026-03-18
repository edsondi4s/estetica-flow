import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Zap, MoreVertical, Play, Pause, Trash2, Edit2, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FlowEditor } from '../components/flows/FlowEditor';
import toast from 'react-hot-toast';

export const BotFlows = () => {
    const [flows, setFlows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedFlow, setSelectedFlow] = useState<any>(null);

    useEffect(() => {
        fetchFlows();
    }, []);

    const fetchFlows = async () => {
        try {
            const { data, error } = await supabase
                .from('bot_flows')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setFlows(data || []);
        } catch (error: any) {
            console.error('Erro ao buscar fluxos:', error);
            toast.error('Erro ao carregar fluxos automatizados.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateFlow = () => {
        setSelectedFlow(null);
        setIsEditorOpen(true);
    };

    const handleEditFlow = (flow: any) => {
        setSelectedFlow(flow);
        setIsEditorOpen(true);
    };

    const toggleFlowStatus = async (flow: any) => {
        try {
            const { error } = await supabase
                .from('bot_flows')
                .update({ is_active: !flow.is_active })
                .eq('id', flow.id);

            if (error) throw error;
            setFlows(flows.map(f => f.id === flow.id ? { ...f, is_active: !f.is_active } : f));
            toast.success(`Fluxo ${!flow.is_active ? 'ativado' : 'pausado'} com sucesso!`);
        } catch (error: any) {
            toast.error('Erro ao alterar status do fluxo.');
        }
    };

    const handleDeleteFlow = async (flowId: string) => {
        if (!confirm('Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.')) return;

        try {
            const { error } = await supabase
                .from('bot_flows')
                .delete()
                .eq('id', flowId);

            if (error) throw error;
            setFlows(flows.filter(f => f.id !== flowId));
            toast.success('Fluxo excluído com sucesso!');
        } catch (error: any) {
            console.error('Erro ao excluir fluxo:', error);
            toast.error('Erro ao excluir fluxo.');
        }
    };

    const filteredFlows = flows.filter(flow =>
        flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.trigger_keywords?.some((k: string) => k.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="relative">
                    <h2 className="text-3xl font-serif text-slate-900 dark:text-white flex items-center gap-3">
                        Fluxos <span className="text-primary italic">Automatizados</span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Gestão de automações e jornadas interativas</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleCreateFlow}
                        className="bg-primary hover:bg-primary/90 text-white px-6 h-11 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)] transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Fluxo Visual</span>
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
                {/* Search & Filter Bar */}
                <div className="bg-white dark:bg-slate-950 p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row gap-2 transition-all">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou gatilho..."
                            className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-medium outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" className="h-11 rounded-xl px-5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800">
                        <Filter className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">Filtros Avançados</span>
                    </Button>
                </div>

                {/* Flows Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 animate-pulse bg-white/50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800/50" />
                        ))}
                    </div>
                ) : filteredFlows.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center space-y-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[32px]">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl">
                            <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div>
                            <p className="text-lg font-serif text-slate-700 dark:text-slate-300">Nenhum fluxo encontrado</p>
                            <p className="text-sm text-slate-500 mt-2">Inicie sua primeira jornada de conversão visual</p>
                        </div>
                        <Button onClick={handleCreateFlow} variant="outline" className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-8 py-2.5">
                            Começar Agora
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredFlows.map((flow) => (
                            <div key={flow.id} className="group relative bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 p-6 rounded-[24px] hover:border-primary/30 transition-all duration-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.01)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)]">
                                {/* Status Indicator */}
                                <div className="absolute top-6 right-6 flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${flow.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                    <span className="text-xs font-medium text-slate-500">{flow.is_active ? 'Ativo' : 'Pausado'}</span>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center rounded-2xl group-hover:scale-105 transition-transform duration-500">
                                            <Zap className={`w-6 h-6 ${flow.is_active ? 'text-emerald-500' : 'text-slate-400'}`} />
                                        </div>
                                    </div>

                                    <div className="min-h-[80px]">
                                        <h4 className="text-xl font-serif text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{flow.name}</h4>
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {flow.trigger_keywords?.map((keyword: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-300 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                                    #{keyword}
                                                </span>
                                            ))}
                                            {(!flow.trigger_keywords || flow.trigger_keywords.length === 0) && (
                                                <span className="text-xs text-slate-400 italic">Sem gatilhos</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-5 flex items-center justify-between gap-3 border-t border-slate-50 dark:border-slate-800/50">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className={`w-9 h-9 p-0 rounded-xl border-slate-200 dark:border-slate-700 ${flow.is_active ? 'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200' : 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'}`}
                                                onClick={() => toggleFlowStatus(flow)}
                                            >
                                                {flow.is_active ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-9 h-9 p-0 rounded-xl border-slate-200 dark:border-slate-700 hover:text-primary hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-200"
                                                onClick={() => handleEditFlow(flow)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="w-9 h-9 p-0 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                                            onClick={() => handleDeleteFlow(flow.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Flow Editor Overlay */}
            {isEditorOpen && (
                <FlowEditor
                    flowId={selectedFlow?.id}
                    initialData={selectedFlow ? {
                        nodes: selectedFlow.nodes,
                        edges: selectedFlow.edges,
                        name: selectedFlow.name,
                        trigger_keywords: selectedFlow.trigger_keywords
                    } : undefined}
                    onClose={() => {
                        setIsEditorOpen(false);
                        fetchFlows();
                    }}
                />
            )}
        </div>
    );
};
