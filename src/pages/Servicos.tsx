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
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Catálogo de Serviços</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os procedimentos e disponibilidades.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2">
                    <Plus className="w-5 h-5" /> Novo Serviço
                </Button>
            </div>

            <Card noPadding>
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Serviço</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categoria</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duração</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Preço</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {services.map((service) => (
                                    <tr key={service.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!service.is_active ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white">{service.name}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{service.description || 'Sem descrição'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                                                {service.category || 'Geral'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                <Clock className="w-4 h-4" />
                                                <span className="text-sm">{service.duration_minutes} min</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                            R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleStatus(service)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${service.is_active
                                                    ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-200'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {service.is_active ? <Check className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                                                {service.is_active ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 text-slate-400">
                                                <button
                                                    onClick={() => handleOpenModal(service)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-primary transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: service.id })}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-red-500 transition-all"
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
                                        <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                                            Nenhum serviço cadastrado ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingService ? 'Editar Serviço' : 'Novo Serviço'}
                description="Preencha as informações do serviço oferecido."
            >
                <form onSubmit={handleSaveService} className="space-y-4 pt-2">
                    <InputField
                        label="Nome do Serviço"
                        placeholder="Ex: Limpeza de Pele"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label="Duração (min)"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            required
                        />
                        <InputField
                            label="Preço (R$)"
                            placeholder="0,00"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Categoria</label>
                        <select
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white outline-none transition-all"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="Facial">Facial</option>
                            <option value="Corporal">Corporal</option>
                            <option value="Sobrancelhas">Sobrancelhas</option>
                            <option value="Injetáveis">Injetáveis</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Descrição</label>
                        <textarea
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[100px] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Descreva o procedimento..."
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 py-2">
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-primary/20 ${isActive ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span
                                className={`${isActive ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Serviço Ativo</span>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Salvar Serviço
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
