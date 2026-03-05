import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Edit2, Trash2, User, Phone, Mail, Calendar, ClipboardList, Clock, Info, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Função auxiliar para aplicar a máscara (XX) XXXXX-XXXX
const formatPhone = (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) {
        formatted = `(${cleaned.substring(0, 2)}) `;
        if (cleaned.length > 7) {
            formatted += `${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
        } else {
            formatted += cleaned.substring(2);
        }
    }
    return formatted;
};

export const Clientes = () => {
    const [showModal, setShowModal] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientHistory, setClientHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Confirmation Modal state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    // Form states
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');
            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClientHistory = async (client: any) => {
        setSelectedClient(client);
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    services ( name ),
                    professionals ( name )
                `)
                .eq('client_id', client.id)
                .order('appointment_date', { ascending: false });

            if (error) throw error;
            setClientHistory(data || []);
        } catch (error) {
            console.error('Erro ao buscar histórico do cliente:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleOpenModal = (client: any = null) => {
        if (client) {
            setEditingClient(client);
            setName(client.name);
            setPhone(client.phone || '');
            setEmail(client.email || '');
            setNotes(client.notes || '');
        } else {
            setEditingClient(null);
            setName('');
            setPhone('');
            setEmail('');
            setNotes('');
        }
        setShowModal(true);
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const clientData = { name, phone, email, notes };

            if (editingClient) {
                const { error } = await supabase
                    .from('clients')
                    .update(clientData)
                    .eq('id', editingClient.id);
                if (error) throw error;
                toast.success('Cliente atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('clients')
                    .insert([clientData]);
                if (error) throw error;
                toast.success('Cliente cadastrado com sucesso!');
            }

            setShowModal(false);
            fetchClients();
        } catch (error: any) {
            toast.error('Erro ao salvar cliente: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async () => {
        if (!confirmDelete.id) return;

        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', confirmDelete.id);
            if (error) throw error;

            setConfirmDelete({ isOpen: false, id: null });
            fetchClients();
            toast.success('Cliente removido com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir cliente: ' + error.message);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Confirmado': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'Cancelado': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2">
                    <Plus className="w-5 h-5" /> Adicionar Cliente
                </Button>
            </div>

            <Card noPadding>
                <div className="w-full overflow-x-auto min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nome</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefone</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-mail</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cadastro</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer group/name"
                                                onClick={() => fetchClientHistory(client)}
                                            >
                                                <Avatar
                                                    name={client.name}
                                                    initials={client.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || '?'}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-white group-hover/name:text-primary transition-colors">{client.name}</span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 opacity-0 group-hover/name:opacity-100 transition-opacity">
                                                        <Info className="w-3 h-3" /> Ver detalhes
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                            {client.phone ? formatPhone(client.phone) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{client.email || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                {new Date(client.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenModal(client)}
                                                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: client.id })}
                                                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredClients.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                            Nenhum cliente encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-white dark:bg-slate-900 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-b-xl">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        Mostrando {filteredClients.length} de {clients.length} clientes
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>Anterior</Button>
                        <Button variant="outline" size="sm" disabled={filteredClients.length === clients.length}>Próximo</Button>
                    </div>
                </div>
            </Card>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                description={editingClient ? 'Atualize as informações do seu cliente.' : 'Cadastre as informações básicas do seu novo cliente.'}
            >
                <form onSubmit={handleSaveClient} className="space-y-4 pt-2">
                    <InputField
                        label="Nome Completo"
                        placeholder="Ex: Maria Oliveira"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <InputField
                        label="Telefone"
                        type="tel"
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    <InputField
                        label="Email"
                        placeholder="cliente@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observações / Histórico de Saúde</label>
                        <textarea
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm min-h-[100px] resize-none"
                            placeholder="Anote alergias, preferências ou observações importantes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Salvar Cliente
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDeleteClient}
                title="Excluir Cliente"
                message="Tem certeza que deseja excluir este cliente? Todos os dados vinculados a ele serão impactados."
                confirmLabel="Sim, Excluir"
                cancelLabel="Não, Cancelar"
            />

            <Modal
                isOpen={!!selectedClient}
                onClose={() => setSelectedClient(null)}
                title="Prontuário do Cliente"
            >
                {selectedClient && (
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <Avatar
                                size="lg"
                                name={selectedClient.name}
                                initials={selectedClient.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || '?'}
                            />
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedClient.name}</h3>
                                <div className="flex flex-wrap gap-3 mt-1.5">
                                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-primary" /> {selectedClient.phone ? formatPhone(selectedClient.phone) : 'Sem telefone'}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-primary" /> {selectedClient.email || 'Sem e-mail'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {selectedClient.notes && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary" /> Observações Importantes
                                </h4>
                                <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                    "{selectedClient.notes}"
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Bloco 1: Em Aberto */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" /> Agendamentos em Aberto
                                </h4>

                                {isLoadingHistory ? (
                                    <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const openList = clientHistory.filter(h => {
                                        const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                        apptDate.setHours(0, 0, 0, 0);
                                        return apptDate >= today && h.status !== 'Cancelado';
                                    });

                                    return openList.length > 0 ? (
                                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                            {openList.map((h) => (
                                                <div key={h.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-primary/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                            {getStatusIcon(h.status)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{h.services?.name}</span>
                                                            <span className="text-[10px] text-slate-500 font-medium">{h.professionals?.name} • {new Date(h.appointment_date + 'T12:00:00').toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.status === 'Confirmado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {h.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 italic">Nenhum agendamento futuro.</p>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Bloco 2: Histórico */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary" /> Histórico de Procedimentos
                                </h4>

                                {isLoadingHistory ? (
                                    <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const pastList = clientHistory.filter(h => {
                                        const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                        apptDate.setHours(0, 0, 0, 0);
                                        return apptDate < today || h.status === 'Cancelado';
                                    });

                                    return pastList.length > 0 ? (
                                        <div className="space-y-3 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
                                            {pastList.map((h) => {
                                                const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                                apptDate.setHours(0, 0, 0, 0);

                                                // Regras Dinâmicas de Status Virtual
                                                let displayStatus = h.status;
                                                let badgeClass = 'bg-slate-100 text-slate-600';

                                                if (h.status === 'Cancelado') {
                                                    displayStatus = 'Cancelado';
                                                    badgeClass = 'bg-red-50 text-red-600';
                                                } else if (apptDate < today) {
                                                    if (h.status === 'Confirmado') {
                                                        displayStatus = 'Finalizado';
                                                        badgeClass = 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400';
                                                    } else if (h.status === 'Pendente') {
                                                        displayStatus = 'Expirado';
                                                        badgeClass = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                                                    }
                                                }

                                                return (
                                                    <div key={h.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-300 transition-all opacity-80 hover:opacity-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                                {displayStatus === 'Finalizado' ? <CheckCircle2 className="w-4 h-4 text-purple-500" /> :
                                                                    displayStatus === 'Expirado' ? <XCircle className="w-4 h-4 text-slate-400" /> :
                                                                        getStatusIcon(h.status)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white line-through decoration-slate-300 dark:decoration-slate-700">{h.services?.name}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium">{h.professionals?.name} • {apptDate.toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                            {displayStatus}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 italic">Nenhum evento no histórico.</p>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedClient(null)}>Fechar</Button>
                            <Button className="flex-1" onClick={() => { setSelectedClient(null); handleOpenModal(selectedClient); }}>
                                Editar Dados
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
