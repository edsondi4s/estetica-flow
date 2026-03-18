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
    const [categories, setCategories] = useState<any[]>([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

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

    useEffect(() => {
        fetchServices();
        fetchCategories();
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
                    <p className="text-sm font-medium text-slate-500 mt-2">Gestão completa de tratamentos e valores oferecidos</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 h-11 px-6 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
                    <Plus className="w-4 h-4" /> Novo Serviço
                </Button>
            </div>

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
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Serviço</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classificação</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duração</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor (R$)</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                    <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {services.map((service) => (
                                    <tr key={service.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all ${!service.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{service.name}</span>
                                                <span className="text-sm font-medium text-slate-500">{service.description || 'Sem descrição'}</span>
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
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-base font-semibold text-slate-900 dark:text-white">
                                                    R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button
                                                onClick={() => toggleStatus(service)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide rounded-full transition-all border ${service.is_active
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {service.is_active ? <Check className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                                                {service.is_active ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 transition-all opacity-0 group-hover:opacity-100">
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
                                        <td colSpan={6} className="px-8 py-24 text-center">
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
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Descrição (Visível aos clientes)</label>
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
