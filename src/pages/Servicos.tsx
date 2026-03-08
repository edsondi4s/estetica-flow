import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, Loader2, Power, PowerOff, Check } from 'lucide-react';
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

    useEffect(() => {
        fetchServices();
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

    const handleOpenModal = (service: any = null) => {
        if (service) {
            setEditingService(service);
            setName(service.name);
            setDesc(service.description || '');
            setDuration(service.duration_minutes.toString());
            setPrice(service.price.toString());
            setCategory(service.category || 'Facial');
            setIsActive(service.is_active ?? true);
        } else {
            setEditingService(null);
            setName('');
            setDesc('');
            setDuration('60');
            setPrice('');
            setCategory('Facial');
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
                category,
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
            }

            setShowModal(false);
            fetchServices();
        } catch (error: any) {
            toast.error('Erro ao salvar serviço: ' + error.message);
        } finally {
            setIsSaving(false);
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
        if (!confirmDelete.id) return;

        try {
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', confirmDelete.id);
            if (error) throw error;

            setConfirmDelete({ isOpen: false, id: null });
            fetchServices();
            toast.success('Serviço removido com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col gap-10 reveal-content">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                        Catálogo <span className="text-primary">Técnico</span>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Engenharia de Procedimentos e Valores</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 bg-slate-950 hover:bg-primary border-none shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 rounded-sm font-black uppercase text-[10px] tracking-widest whitespace-nowrap py-6 px-8">
                    <Plus className="w-4 h-4" /> Novo Procedimento
                </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-2xl shadow-black/5 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950 border-b-2 border-primary">
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em]">Procedimento</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em]">Classificação</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em]">Duração</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em]">Valor (R$)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em] text-center">Protocolo</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-[0.2em] text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-slate-50 dark:divide-slate-800">
                                {services.map((service) => (
                                    <tr key={service.id} className={`group hover:bg-slate-50 dark:hover:bg-primary/5 transition-all ${!service.is_active ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-slate-950 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors">{service.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{service.description || 'Nenhuma especificação disponível'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-none border border-slate-200 dark:border-slate-700 transition-colors group-hover:border-primary/30 group-hover:text-primary">
                                                {service.category || 'Padrão'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                <Clock className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-sm font-black">{service.duration_minutes}<span className="text-[9px] text-slate-400 ml-1">MIN</span></span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-slate-950 dark:text-white tracking-tighter">
                                                    R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Valor de Tabela</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button
                                                onClick={() => toggleStatus(service)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-2 transition-all ${service.is_active
                                                    ? 'bg-primary/5 border-primary text-primary hover:bg-primary hover:text-slate-950'
                                                    : 'bg-slate-100 border-slate-300 text-slate-400 hover:border-slate-400'
                                                    }`}
                                            >
                                                {service.is_active ? <Check className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                                                {service.is_active ? 'Ativado' : 'Bloqueado'}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-3 transition-all">
                                                <button
                                                    onClick={() => handleOpenModal(service)}
                                                    className="p-2.5 bg-slate-950 text-white hover:bg-primary transition-all shadow-xl shadow-black/20"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: service.id })}
                                                    className="p-2.5 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {services.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center">
                                                <Clock className="w-12 h-12 text-slate-100 mb-4" />
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aguardando injeção de dados técnico-comerciais</p>
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
                title="ESPECIFICAÇÃO TÉCNICA"
            >
                <form onSubmit={handleSaveService} className="space-y-6 pt-4">
                    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800 focus-within:border-primary transition-all">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Identificação do Procedimento</label>
                        <input
                            placeholder="NOME DO PROCEDIMENTO"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter placeholder:text-slate-200 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duração Estimada (Minutos)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full bg-transparent text-2xl font-black text-primary tracking-tighter outline-none"
                                required
                            />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fee Profissional (R$)</label>
                            <input
                                placeholder="0,00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full bg-transparent text-2xl font-black text-slate-950 dark:text-white tracking-tighter outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Classificação de Domínio</label>
                        <select
                            className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-950 dark:text-white outline-none cursor-pointer"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="Facial">Divisão Facial</option>
                            <option value="Corporal">Mecânica Corporal</option>
                            <option value="Sobrancelhas">Dermo-Arte</option>
                            <option value="Injetáveis">Protocolo Invasivo</option>
                            <option value="Outros">Operações Especiais</option>
                        </select>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Memória Manual (Descrição)</label>
                        <textarea
                            className="w-full bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 min-h-[100px] outline-none placeholder:text-slate-200 resize-none"
                            placeholder="Descreva o passo a passo técnico..."
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 py-2 px-1">
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`relative inline-flex h-5 w-10 items-center rounded-none transition-all ${isActive ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}
                        >
                            <span
                                className={`${isActive ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-3 w-3 transform rounded-none bg-slate-950 transition-transform`}
                            />
                        </button>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo Ativado no Catálogo</span>
                    </div>

                    <div className="pt-8 flex gap-4 border-t-2 border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" className="flex-1 rounded-sm border-2 border-slate-200 font-black uppercase text-[10px] tracking-widest py-6" onClick={() => setShowModal(false)}>
                            Descartar
                        </Button>
                        <Button type="submit" className="flex-1 bg-slate-950 hover:bg-primary border-none text-white rounded-sm font-black uppercase text-[10px] tracking-widest py-6 shadow-xl shadow-black/20" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Procedimento'}
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
        </div>
    );
};
