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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="relative">
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary/20 blur-sm"></div>
                    <h2 className="text-4xl font-black text-slate-950 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                        Fluxos <span className="text-primary">Automatizados</span>
                        <div className="bg-primary/10 border border-primary/20 p-1 rounded-sm">
                            <Zap className="w-4 h-4 text-primary fill-primary/20" />
                        </div>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Gestão de Automações Estilo Typebot</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleCreateFlow}
                        className="bg-primary hover:bg-primary/90 text-slate-950 px-8 h-12 rounded-none font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <Plus className="w-4 h-4 mr-2 relative z-10" />
                        <span className="relative z-10">Novo Fluxo Visual</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards - Optional for future expansion */}

            {/* Main Content Area */}
            <div className="space-y-6">
                {/* Search & Filter Bar */}
                <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-dashed">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="BUSCAR POR NOME OU GATILHO..."
                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-none text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:text-slate-300"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-12 border-slate-200 dark:border-slate-800 rounded-none px-6">
                            <Filter className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Filtros Avançados</span>
                        </Button>
                    </div>
                </Card>

                {/* Flows Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i}>
                                <Card className="h-64 animate-pulse bg-slate-50 dark:bg-slate-900/50">
                                    <div className="flex-1" />
                                </Card>
                            </div>
                        ))}
                    </div>
                ) : filteredFlows.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center space-y-6 bg-slate-50/30 dark:bg-slate-900/10 border-2 border-dashed border-slate-100 dark:border-slate-900 rounded-sm">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 flex items-center justify-center rounded-sm">
                            <Zap className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Nenhum fluxo automatizado encontrado</p>
                            <p className="text-[9px] font-bold text-slate-400/50 uppercase tracking-widest mt-2">Inicie sua primeira jornada de conversão visual</p>
                        </div>
                        <Button onClick={handleCreateFlow} variant="outline" className="rounded-none border-primary/20 text-primary hover:bg-primary/5 px-8">
                            Começar Agora
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredFlows.map((flow) => (
                            <div key={flow.id} className="group relative bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-6 rounded-sm hover:border-primary/30 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-primary/5">
                                {/* Status Indicator */}
                                <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest ${flow.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                    {flow.is_active ? 'Ativo' : 'Pausado'}
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                            <Zap className={`w-8 h-8 ${flow.is_active ? 'text-primary' : 'text-slate-300'}`} />
                                        </div>
                                        <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="min-h-[80px]">
                                        <h4 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter leading-tight group-hover:text-primary transition-colors">{flow.name}</h4>
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {flow.trigger_keywords?.map((keyword: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-slate-800">
                                                    #{keyword}
                                                </span>
                                            ))}
                                            {(!flow.trigger_keywords || flow.trigger_keywords.length === 0) && (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">Sem gatilhos configurados</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-50 dark:border-slate-900 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-10 h-10 p-0 rounded-none border-slate-100 dark:border-slate-800"
                                                onClick={() => toggleFlowStatus(flow)}
                                            >
                                                {flow.is_active ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-10 h-10 p-0 rounded-none border-slate-100 dark:border-slate-800 hover:text-primary"
                                                onClick={() => handleEditFlow(flow)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-10 h-10 p-0 rounded-none border-slate-100 dark:border-slate-800 hover:text-rose-500 hover:border-rose-500/20"
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
