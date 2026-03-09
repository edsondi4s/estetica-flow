import React, { useState, useCallback, useRef } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    Connection,
    Edge,
    Node,
    applyNodeChanges,
    applyEdgeChanges,
    OnNodesChange,
    OnEdgesChange,
    ReactFlowInstance,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './FlowNodes';
import { Button } from '../ui/Button';
import {
    Save, ChevronLeft, MessageSquare, HelpCircle, MousePointer2,
    Settings2, Trash2, X, Menu, GitBranch, Clock, Plus, Mic, Image as ImageIcon, Upload, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../lib/image-utils';
import toast from 'react-hot-toast';
import { InputField } from '../ui/InputField';

interface FlowEditorProps {
    flowId?: string;
    onClose: () => void;
    initialData?: {
        nodes: any[];
        edges: any[];
        name: string;
        trigger_keywords?: string[];
    };
}

const initialNodes: Node[] = [
    {
        id: 'start-1',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Início' }
    }
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export const FlowEditor = ({ flowId, onClose, initialData }: FlowEditorProps) => {
    const [nodes, setNodes] = useState<Node[]>(initialData?.nodes || initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialData?.edges || []);
    const [name, setName] = useState(initialData?.name || 'Novo Fluxo de Automação');
    const [keywords, setKeywords] = useState<string[]>(initialData?.trigger_keywords || []);
    const [isSaving, setIsSaving] = useState(false);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes]
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    );

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const flowData = {
                name,
                trigger_keywords: keywords,
                nodes,
                edges,
                user_id: user.id
            };

            if (flowId) {
                const { error } = await supabase
                    .from('bot_flows')
                    .update(flowData)
                    .eq('id', flowId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('bot_flows')
                    .insert([flowData]);
                if (error) throw error;
            }

            toast.success('Fluxo visual salvo com sucesso!');
            onClose();
        } catch (error: any) {
            console.error('Erro ao salvar fluxo:', error);
            toast.error('Erro ao salvar o fluxo visual.');
        } finally {
            setIsSaving(false);
        }
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type || !reactFlowBounds || !rfInstance) {
                return;
            }

            const position = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const defaultData: Record<string, any> = {
                message: { label: 'Mensagem', text: '', image: '' },
                question: { label: 'Pergunta', text: '', inputType: 'text', variable: 'res' },
                buttons: { label: 'Escolha', text: '', choices: ['Sim', 'Não'] },
                condition: { label: 'Condição', variable: '', operator: '==', value: '' },
                wait: { label: 'Aguardar', delay: 5 },
                image: { label: 'Imagem', url: '', caption: '' },
                audio: { label: 'Áudio', url: '', name: '' },
                start: { label: 'Início' }
            };

            const newNode = {
                id: `${type}-${generateId()}`,
                type,
                position,
                data: defaultData[type] || { label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [rfInstance, setNodes],
    );

    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNode(node);
        setIsConfigOpen(false);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        setIsConfigOpen(false);
    }, []);

    const updateNodeData = (nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, ...newData } }));
        }
    };

    const deleteNode = (nodeId: string) => {
        // We don't block start node deletion anymore if they want to re-add it,
        // but it's good to keep at least one. However, the user asked to be able to re-add it.
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    };

    const getAllVariables = () => {
        const vars = new Set<string>();
        nodes.forEach(n => {
            if (n.data?.variable) vars.add(n.data.variable);
        });
        return Array.from(vars);
    };

    const getUpstreamVariables = (nodeId: string) => {
        const upstreamVars = new Set<string>();
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // Find predecessors
            const incomingEdges = edges.filter(e => e.target === currentId);
            incomingEdges.forEach(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                if (sourceNode) {
                    if (sourceNode.data?.variable) {
                        upstreamVars.add(sourceNode.data.variable);
                    }
                    queue.push(sourceNode.id);
                }
            });
        }
        return Array.from(upstreamVars);
    };

    const handleMediaUpload = async (file: File, type: 'image' | 'audio', nodeId: string) => {
        try {
            let fileToUpload = file;
            if (type === 'image') {
                const compressed = await compressImage(file);
                fileToUpload = new File([compressed], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
            }

            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${type}-${generateId()}.${fileExt}`;
            const filePath = `bot-flows/${flowId || 'new'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('clinic-assets')
                .upload(filePath, fileToUpload);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('clinic-assets')
                .getPublicUrl(filePath);

            updateNodeData(nodeId, type === 'image' ? { url: publicUrl } : { url: publicUrl, name: file.name });
            toast.success(`${type === 'image' ? 'Imagem' : 'Áudio'} enviado com sucesso!`);
        } catch (error: any) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao enviar arquivo.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-right-8 duration-500">
            {/* Toolbar */}
            <div className="h-20 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 px-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-sm transition-colors group">
                        <ChevronLeft className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                    </button>

                    <div className="h-10 w-px bg-slate-100 dark:border-slate-800"></div>

                    <div className="flex flex-col">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none text-md font-black uppercase tracking-tighter text-slate-950 dark:text-white focus:ring-0 w-64 p-0 outline-none"
                            placeholder="NOME DO FLUXO..."
                        />
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Editor Visual Ativo</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mr-4">
                        <MousePointer2 className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arraste os nós para conectar</span>
                    </div>

                    <button
                        onClick={() => { setIsConfigOpen(true); setSelectedNode(null); }}
                        className={`p-3 rounded-none border transition-all ${isConfigOpen ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-primary'}`}
                    >
                        <Settings2 className="w-5 h-5" />
                    </button>

                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        className="bg-primary hover:bg-primary/90 text-slate-950 px-8 h-12 rounded-none font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20"
                    >
                        <Save className="w-4 h-4 mr-2" /> Publicar Fluxo
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Nodes */}
                <div className="w-72 bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-900 p-6 flex flex-col gap-8 overflow-y-auto no-scrollbar">
                    <div>
                        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em] mb-6">Blocos / Componentes</p>

                        <div className="space-y-4">
                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'start'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-950 dark:bg-white border border-primary/20 rounded-sm cursor-grab active:cursor-grabbing hover:shadow-lg transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-primary/20 flex items-center justify-center rounded-sm">
                                        <Plus className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-950">Início</p>
                                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-1">Gatilho de entrada</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'message'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Mensagem</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Envio de texto livre</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'question'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-emerald-500/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <HelpCircle className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Pergunta</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Coleta de dados (Lead)</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'buttons'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-purple-500/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <Menu className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Botões</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Escolha múltipla</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'condition'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-amber-500/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <GitBranch className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Condição</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Desvio lógico IF/ELSE</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'wait'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-slate-400/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <Clock className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Esperar</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Atraso na resposta</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'image'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-blue-400/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <ImageIcon className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Imagem</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Envio de mídia visual</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'audio'); e.dataTransfer.effectAllowed = 'move'; }}
                                className="group p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-sm cursor-grab active:cursor-grabbing hover:border-rose-400/40 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm">
                                        <Mic className="w-5 h-5 text-rose-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Áudio</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Nota de voz ou música</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-8 border-t border-slate-50 dark:border-slate-950">
                        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em] mb-4">Dicas de Uso</p>
                        <div className="p-4 bg-primary/5 border border-primary/10 space-y-3">
                            <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                                1. Comece sempre do nó de <span className="text-primary font-black">Início</span>.
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                                2. Conecte as saídas (bolinhas) às entradas do próximo bloco.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 relative bg-slate-50/30 dark:bg-slate-950" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setRfInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        nodesDraggable
                        fitView
                        className="dark:invert-[0.05]"
                    >
                        <Background color="#cbd5e1" gap={30} size={1} />
                        <Controls className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 shadow-xl" />
                    </ReactFlow>
                </div>

                {/* Properties Sidebar (Right) */}
                {(selectedNode || isConfigOpen) && (
                    <div className="w-80 bg-white dark:bg-slate-950 border-l border-slate-100 dark:border-slate-900 flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
                            <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-950 dark:text-white">
                                {isConfigOpen ? 'Configuração do Fluxo' : 'Propriedades do Bloco'}
                            </h3>
                            <button onClick={() => { setSelectedNode(null); setIsConfigOpen(false); }} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-sm">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                            {isConfigOpen ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nome do Fluxo</label>
                                        <InputField
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="EX: AGENDAMENTO AUTOMÁTICO"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex justify-between">
                                            Gatilhos (Keywords)
                                            <span className="text-primary italic">Enter para adicionar</span>
                                        </label>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                placeholder="DIGITE E PRESSIONE ENTER"
                                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100 outline-none focus:border-primary/50 transition-all duration-300 placeholder:text-slate-400"
                                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                    if (e.key === 'Enter' && e.currentTarget.value) {
                                                        const val = e.currentTarget.value.toLowerCase().trim();
                                                        if (!keywords.includes(val)) setKeywords([...keywords, val]);
                                                        e.currentTarget.value = '';
                                                    }
                                                }}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {keywords.map(k => (
                                                    <span key={k} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                                        #{k}
                                                        <X
                                                            size={12}
                                                            className="cursor-pointer hover:text-rose-500 transition-colors"
                                                            onClick={() => setKeywords(keywords.filter(kw => kw !== k))}
                                                        />
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : selectedNode ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-sm border border-slate-100 dark:border-slate-800">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            {selectedNode.type === 'message' && <MessageSquare size={14} className="text-primary" />}
                                            {selectedNode.type === 'question' && <HelpCircle size={14} className="text-primary" />}
                                            {selectedNode.type === 'buttons' && <Menu size={14} className="text-primary" />}
                                            {selectedNode.type === 'condition' && <GitBranch size={14} className="text-primary" />}
                                            {selectedNode.type === 'wait' && <Clock size={14} className="text-primary" />}
                                            {selectedNode.type === 'start' && <Plus size={14} className="text-primary" />}
                                            {selectedNode.type === 'image' && <ImageIcon size={14} className="text-primary" />}
                                            {selectedNode.type === 'audio' && <Mic size={14} className="text-primary" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-950 dark:text-white tracking-widest">
                                                {selectedNode.type === 'message' && 'Mensagem'}
                                                {selectedNode.type === 'question' && 'Pergunta'}
                                                {selectedNode.type === 'buttons' && 'Botões'}
                                                {selectedNode.type === 'condition' && 'Condição'}
                                                {selectedNode.type === 'wait' && 'Aguardar'}
                                                {selectedNode.type === 'start' && 'Início'}
                                                {selectedNode.type === 'image' && 'Imagem'}
                                                {selectedNode.type === 'audio' && 'Áudio'}
                                            </p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ID: {selectedNode.id}</p>
                                        </div>
                                    </div>

                                    {(selectedNode.type === 'message' || selectedNode.type === 'question' || selectedNode.type === 'buttons') && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conteúdo da Mensagem</label>
                                                </div>
                                                <textarea
                                                    className="w-full min-h-[120px] p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-primary/50 transition-all resize-none shadow-sm placeholder:text-slate-300"
                                                    value={selectedNode.data.text || ''}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                                    placeholder="Escreva a mensagem..."
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Zap size={10} className="text-primary" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inserir Variável</span>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase italic">(Apenas capturadas antes)</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {getUpstreamVariables(selectedNode.id).length > 0 ? (
                                                        getUpstreamVariables(selectedNode.id).map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => {
                                                                    const currentText = selectedNode.data.text || '';
                                                                    updateNodeData(selectedNode.id, { text: currentText + `{${v}}` });
                                                                }}
                                                                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-500 uppercase rounded-sm hover:border-primary/40 hover:text-primary transition-all flex items-center gap-1"
                                                            >
                                                                <Plus size={8} /> {v}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Nenhuma variável disponível nesta etapa</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'buttons' && (
                                        <div className="space-y-4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex justify-between">
                                                Opções de Botões
                                                <button
                                                    onClick={() => {
                                                        const current = selectedNode.data.choices || [];
                                                        updateNodeData(selectedNode.id, { choices: [...current, `Opção ${current.length + 1}`] });
                                                    }}
                                                    className="text-primary hover:underline flex items-center gap-1"
                                                >
                                                    <Plus size={10} /> Adicionar
                                                </button>
                                            </label>
                                            <div className="space-y-2">
                                                {(selectedNode.data.choices || []).map((choice: string, idx: number) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <InputField
                                                            value={choice}
                                                            onChange={(e) => {
                                                                const newChoices = [...selectedNode.data.choices];
                                                                newChoices[idx] = e.target.value;
                                                                updateNodeData(selectedNode.id, { choices: newChoices });
                                                            }}
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="px-2 border-rose-500/20 text-rose-500"
                                                            onClick={() => {
                                                                const newChoices = selectedNode.data.choices.filter((_: any, i: number) => i !== idx);
                                                                updateNodeData(selectedNode.id, { choices: newChoices });
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'condition' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Variável a Comparar</label>
                                                <div className="space-y-2">
                                                    <InputField
                                                        value={selectedNode.data.variable || ''}
                                                        onChange={(e) => updateNodeData(selectedNode.id, { variable: e.target.value })}
                                                        placeholder="ex: nome_cliente"
                                                    />
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {getUpstreamVariables(selectedNode.id).filter(v => v !== selectedNode.data.variable).map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => updateNodeData(selectedNode.id, { variable: v })}
                                                                className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold rounded-sm border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:text-primary transition-all"
                                                            >
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Operador</label>
                                                <select
                                                    className="w-full h-11 px-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary/50 cursor-pointer"
                                                    value={selectedNode.data.operator || '=='}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value })}
                                                >
                                                    <option value="==">Igual a</option>
                                                    <option value="!=">Diferente de</option>
                                                    <option value="contains">Contém</option>
                                                    <option value="exists">Existe / Não Vazio</option>
                                                </select>
                                            </div>
                                            {selectedNode.data.operator !== 'exists' && (
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Comparação</label>
                                                    <InputField
                                                        value={selectedNode.data.value || ''}
                                                        onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
                                                        placeholder="Valor esperado..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedNode.type === 'wait' && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tempo de Espera (Segundos)</label>
                                            <InputField
                                                type="number"
                                                value={selectedNode.data.delay || 5}
                                                onChange={(e) => updateNodeData(selectedNode.id, { delay: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    )}

                                    {selectedNode.type === 'question' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Dado (Input)</label>
                                                <select
                                                    className="w-full h-11 px-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary/50 cursor-pointer"
                                                    value={selectedNode.data.inputType || 'text'}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { inputType: e.target.value })}
                                                >
                                                    <option value="text">Texto Livre</option>
                                                    <option value="number">Número</option>
                                                    <option value="email">E-mail</option>
                                                    <option value="phone">WhatsApp / Telefone</option>
                                                    <option value="date">Data</option>
                                                    <option value="time">Horário</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Salvar na Variável</label>
                                                <InputField
                                                    value={selectedNode.data.variable || ''}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { variable: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                                    placeholder="ex: nome_cliente"
                                                />
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {getUpstreamVariables(selectedNode.id).filter(v => v !== selectedNode.data.variable).map(v => (
                                                        <button
                                                            key={v}
                                                            onClick={() => updateNodeData(selectedNode.id, { variable: v })}
                                                            className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold rounded-sm border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:text-primary transition-all"
                                                        >
                                                            {v}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'image' && (
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Arquivo de Imagem</label>
                                                {selectedNode.data.url ? (
                                                    <div className="space-y-4">
                                                        <div className="relative aspect-video rounded-sm overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl shadow-black/10">
                                                            <img src={selectedNode.data.url} alt="Preview" className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => updateNodeData(selectedNode.id, { url: '' })}
                                                                className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <InputField
                                                            label="Legenda (Opcional)"
                                                            value={selectedNode.data.caption || ''}
                                                            onChange={(e) => updateNodeData(selectedNode.id, { caption: e.target.value })}
                                                            placeholder="Digite uma legenda..."
                                                        />
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center gap-4 py-10 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-sm hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                                                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                                            <Upload size={20} className="text-slate-400 group-hover:text-primary" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Clique para enviar</p>
                                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Auto-compressão ativada (WebP)</p>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'image', selectedNode.id)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedNode.type === 'audio' && (
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Arquivo de Áudio (.mp3)</label>
                                                {selectedNode.data.url ? (
                                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-sm shadow-sm group">
                                                        <div className="flex items-center gap-3">
                                                            <Mic size={16} className="text-rose-500" />
                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight truncate max-w-[150px]">{selectedNode.data.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => updateNodeData(selectedNode.id, { url: '', name: '' })}
                                                            className="p-1 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center gap-4 py-10 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-sm hover:border-rose-400/40 hover:bg-rose-500/5 transition-all cursor-pointer group">
                                                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                                            <Upload size={20} className="text-slate-400 group-hover:text-rose-500" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Enviar Áudio / Voz</p>
                                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Formatos suportados: .mp3, .wav</p>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="audio/*"
                                                            className="hidden"
                                                            onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'audio', selectedNode.id)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-900 mt-4">
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 border-rose-500/20 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-none font-bold uppercase text-[9px] tracking-widest"
                                            onClick={() => deleteNode(selectedNode.id)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Remover Bloco
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
