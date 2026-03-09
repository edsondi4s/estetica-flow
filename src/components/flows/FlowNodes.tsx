import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
    MessageSquare, HelpCircle, User, Calendar, Image as ImageIcon,
    Video, Type, Hash, Mail, Globe, Phone, Clock, Menu, GitBranch,
    PlayCircle, Save, Square, Mic
} from 'lucide-react';

// Common header for all nodes
const NodeHeader = ({ icon: Icon, title, color = 'primary' }: { icon: any, title: string, color?: string }) => {
    const colorClasses: Record<string, string> = {
        primary: 'text-primary-500',
        blue: 'text-blue-500',
        emerald: 'text-emerald-500',
        purple: 'text-purple-500',
        amber: 'text-amber-500',
        rose: 'text-rose-500'
    };

    return (
        <div className="flex items-center justify-between p-3 border-b border-slate-50 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
                <div className={`p-1 box-content rounded-sm bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800`}>
                    <Icon size={14} className={colorClasses[color] || 'text-primary-500'} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</span>
            </div>
        </div>
    );
};

// Message Node
export const MessageNode = memo(({ data }: any) => {
    return (
        <div className="min-w-[200px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-blue-500/30 transition-all border-l-blue-500/40">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-950" />

            <NodeHeader icon={MessageSquare} title="Envio de Mensagem" color="blue" />

            <div className="p-4">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed italic">
                    {data.text || "Sua mensagem aqui..."}
                </p>
                {data.image && (
                    <div className="mt-3 rounded-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <img src={data.image} alt="Preview" className="w-full h-20 object-cover opacity-50 grayscale" />
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-950" />
        </div>
    );
});

// Question Node
export const QuestionNode = memo(({ data }: any) => {
    const inputIcons: Record<string, any> = {
        text: Type,
        number: Hash,
        email: Mail,
        phone: Phone,
        date: Calendar,
        time: Clock
    };

    const InputIcon = inputIcons[data.inputType] || Type;

    return (
        <div className="min-w-[220px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-emerald-500/50 transition-all border-l-emerald-500/40">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950" />

            <NodeHeader icon={HelpCircle} title="Pergunta / Coleta" color="emerald" />

            <div className="p-4 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 italic">
                    {data.text || "Qual o seu nome?"}
                </p>

                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <InputIcon className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        Input: {data.inputType || 'Texto'}
                    </span>
                </div>

                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right">
                    Variável: <span className="text-primary">{data.variable || 'res'}</span>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950" />
        </div>
    );
});

// Buttons Node
export const ButtonsNode = memo(({ data }: any) => {
    const choices = data.choices || ['Opção 1'];
    return (
        <div className="min-w-[220px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-purple-500/50 transition-all border-l-purple-500/40">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-slate-950" />
            <NodeHeader icon={Menu} title="Escolha Múltipla" color="purple" />
            <div className="p-4 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 italic">
                    {data.text || "Selecione uma opção:"}
                </p>
                <div className="space-y-2">
                    {choices.map((choice: string, idx: number) => (
                        <div key={idx} className="relative flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{choice}</span>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`choice-${idx}`}
                                style={{ top: '50%', right: -8 }}
                                className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-slate-950"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

// Condition Node
export const ConditionNode = memo(({ data }: any) => {
    return (
        <div className="min-w-[180px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-amber-500/50 transition-all border-l-amber-500">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-950" />
            <NodeHeader icon={GitBranch} title="Condição Lógica" color="amber" />
            <div className="p-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Se a variável</div>
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="text-primary">{data.variable || 'res'}</span> {data.operator || '=='} <span className="text-emerald-500">{data.value || 'vazio'}</span>
                </div>
            </div>
            <div className="flex border-t border-slate-50 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/30">
                <div className="flex-1 p-2 text-center relative border-r border-slate-50 dark:border-slate-900">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">SIM</span>
                    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '50%' }} className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950" />
                </div>
                <div className="flex-1 p-2 text-center relative">
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">NÃO</span>
                    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '50%' }} className="w-3 h-3 bg-rose-500 border-2 border-white dark:border-slate-950" />
                </div>
            </div>
        </div>
    );
});

// Wait Node
export const WaitNode = memo(({ data }: any) => {
    return (
        <div className="min-w-[150px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-slate-400 transition-all border-l-slate-400">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-950" />
            <NodeHeader icon={Clock} title="Aguardar" color="primary" />
            <div className="p-4 flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                    <Clock size={16} className="text-slate-400" />
                </div>
                <div>
                    <span className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tighter">{data.delay || 5}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">segundos</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-950" />
        </div>
    );
});

// Start Node
export const StartNode = memo(() => {
    return (
        <div className="px-6 py-3 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-full shadow-2xl flex items-center gap-3 border border-primary/50">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_var(--primary)]"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Gatilho Detectado</span>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-950" />
        </div>
    );
});

// Image Node
export const ImageNode = memo(({ data }: any) => {
    return (
        <div className="min-w-[200px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-blue-400/50 transition-all border-l-blue-400/40">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400 border-2 border-white dark:border-slate-950" />
            <NodeHeader icon={ImageIcon} title="Imagem" color="blue" />
            <div className="p-4">
                {data.url ? (
                    <div className="relative aspect-video rounded-sm overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        <img src={data.url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="aspect-video bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-slate-200 dark:border-slate-800">
                        <ImageIcon size={20} className="text-slate-200" />
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Aguardando Imagem</span>
                    </div>
                )}
                {data.caption && (
                    <p className="mt-2 text-[10px] font-bold text-slate-500 italic line-clamp-2 leading-tight">
                        "{data.caption}"
                    </p>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-400 border-2 border-white dark:border-slate-950" />
        </div>
    );
});

// Audio Node
export const AudioNode = memo(({ data }: any) => {
    return (
        <div className="min-w-[180px] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-900 rounded-sm shadow-xl overflow-hidden group hover:border-rose-400/50 transition-all border-l-rose-400/40">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-rose-400 border-2 border-white dark:border-slate-950" />
            <NodeHeader icon={Mic} title="Áudio / Voz" color="rose" />
            <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
                    <Mic size={18} className="text-rose-500" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 truncate">
                        {data.name || 'Sem áudio'}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Voice Note (.mp3)</p>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-rose-400 border-2 border-white dark:border-slate-950" />
        </div>
    );
});

export const nodeTypes = {
    start: StartNode,
    message: MessageNode,
    question: QuestionNode,
    buttons: ButtonsNode,
    condition: ConditionNode,
    wait: WaitNode,
    image: ImageNode,
    audio: AudioNode
};
