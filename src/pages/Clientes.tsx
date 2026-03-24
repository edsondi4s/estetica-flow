import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Edit2, Trash2, User, Phone, Mail, Calendar, ClipboardList, Clock, Info, CheckCircle2, XCircle, Trophy, Medal, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const formatPhone = (value: string) => {
    if (!value) return '';

    // Remove tudo que não for número
    let cleaned = value.replace(/\D/g, '');

    // Se começar com 55 e tiver 12 ou 13 caracteres, removemos o 55 para tratar o DDD
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
        cleaned = cleaned.substring(2);
    }

    // Limita a quantidade de números (DDD 2 + Numero 9 = 11)
    if (cleaned.length > 11) cleaned = cleaned.substring(0, 11);

    let formatted = cleaned;
    let countryCode = '+55 ';

    if (cleaned.length > 2) {
        formatted = `(${cleaned.substring(0, 2)}) `;
        if (cleaned.length > 6) {
            // Formato com 9 dígitos ou 8 dígitos
            if (cleaned.length === 11) {
                formatted += `${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
            } else {
                formatted += `${cleaned.substring(2, 6)}-${cleaned.substring(6, 10)}`;
            }
        } else {
            formatted += cleaned.substring(2);
        }
    }

    // Só formata país se já tem algo digitado além do DDD (ou pode deixar fixo)
    return cleaned.length > 0 ? countryCode + formatted : formatted;
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
    const [clientRanking, setClientRanking] = useState<any[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [activitySearch, setActivitySearch] = useState('');
    const [activityStatus, setActivityStatus] = useState('Todos');
    const [activityDateStart, setActivityDateStart] = useState('');
    const [activityDateEnd, setActivityDateEnd] = useState('');

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
        fetchClientRanking();
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

    const fetchClientRanking = async () => {
        setIsRankingLoading(true);
        try {
            const { data: appStats } = await supabase
                .from('appointments')
                .select('client_id, clients(id, name, phone), appointment_date, services(name)')
                .not('status', 'eq', 'Cancelado');

            const counts: { [key: string]: { count: number, name: string, phone?: string, lastVisit: string, services: string[] } } = {};
            appStats?.forEach((a: any) => {
                if (!a.clients) return;
                const client = a.clients as any;
                const id = client.id;
                if (!counts[id]) {
                    counts[id] = { count: 0, name: client.name, phone: client.phone, lastVisit: a.appointment_date, services: [] };
                }
                counts[id].count++;
                if (a.appointment_date > counts[id].lastVisit) {
                    counts[id].lastVisit = a.appointment_date;
                }
                if (a.services?.name) {
                    counts[id].services.push(a.services.name);
                }
            });

            const sorted = Object.entries(counts)
                .map(([id, data]) => {
                    const mostFrequentService = data.services.length > 0
                        ? data.services.reduce((a, b, i, arr) =>
                            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
                        ) : 'N/A';
                    return { id, ...data, favorite: mostFrequentService };
                })
                .sort((a, b: any) => b.count - a.count)
                .slice(0, 5);

            setClientRanking(sorted);
        } catch (error) {
            console.error('Erro ao buscar ranking de clientes:', error);
        } finally {
            setIsRankingLoading(false);
        }
    };

    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return 'text-amber-400'; // Gold
            case 1: return 'text-slate-400'; // Silver
            case 2: return 'text-amber-700'; // Bronze
            default: return 'text-slate-300';
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
            const clientData = { 
                name, 
                phone: phone ? phone : null, 
                email: email ? email : null, 
                notes 
            };

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

    const handleExportCSV = () => {
        const headers = ['Nome', 'Telefone', 'Email', 'Data de Cadastro', 'Observações'];
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const client of filteredClients) {
            const row = [
                `"${client.name || ''}"`,
                `"${client.phone ? formatPhone(client.phone) : ''}"`,
                `"${client.email || ''}"`,
                `"${new Date(client.created_at).toLocaleDateString()}"`,
                `"${(client.notes || '').replace(/"/g, '""')}"` // escape double quotes
            ];
            csvRows.push(row.join(','));
        }

        const csvContent = csvRows.join('\n');
        // Usar UTF-8 BOM para forçar o Excel a ler acentos corretamente
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'clientes.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Lista de clientes exportada!');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Confirmado': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'Cancelado': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    return (
        <div className="flex flex-col gap-10 reveal-content">
            {/* Seção de Ranking de Clientes - Premium Silk & Steel */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
                            Clientes <span className="text-primary">Premium</span>
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-2">Nossos clientes mais frequentes e fiéis</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700/50 shadow-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                        <Trophy className="w-4 h-4 text-primary" />
                        Status: Premium
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {isRankingLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl border border-transparent" />
                        ))
                    ) : clientRanking.length > 0 ? (
                        clientRanking.map((rank, index) => (
                            <div
                                key={rank.id}
                                onClick={() => fetchClientHistory({ id: rank.id, name: rank.name, phone: rank.phone })}
                                className="relative bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:border-primary/50 shadow-sm hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)] hover:-translate-y-1 transition-all duration-500 cursor-pointer group overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>

                                <div className="flex flex-col h-full justify-between gap-5 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className={`text-3xl font-serif font-bold opacity-10 group-hover:opacity-30 transition-opacity ${getMedalColor(index)}`}>
                                            0{index + 1}
                                        </div>
                                        {index < 3 && <Medal className={`w-6 h-6 ${getMedalColor(index)}`} />}
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{rank.name}</p>
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/30 flex items-center gap-1">
                                                    {rank.count} Visitas <TrendingUp className="w-3 h-3" />
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
                                            <div className="flex justify-between items-center text-xs font-medium">
                                                <span className="text-slate-500">Serviço Favorito</span>
                                                <span className="text-slate-900 dark:text-slate-200">{rank.favorite}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-medium">
                                                <span className="text-slate-500">Última Visita</span>
                                                <span className="text-slate-900 dark:text-slate-200">{new Date(rank.lastVisit + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-sm border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aguardando dados de atendimentos...</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 rounded-luxury shadow-sm">
                <div className="relative flex-1 group w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar cliente por nome ou telefone..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl text-sm font-medium transition-all outline-none text-slate-900 dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="outline" onClick={handleExportCSV} className="gap-2 flex-1 md:flex-none rounded-xl h-11 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                        <ClipboardList className="w-4 h-4" /> Exportar Planilha
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="gap-2 flex-1 md:flex-none shadow-md shadow-primary/20 rounded-xl h-11 font-medium whitespace-nowrap">
                        <Plus className="w-4 h-4" /> Novo Cliente
                    </Button>
                </div>
            </div>

            <Card noPadding className="border border-slate-100 dark:border-slate-800/60 rounded-luxury shadow-sm overflow-hidden bg-white dark:bg-slate-950">
                <div className="w-full overflow-x-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-32 bg-white dark:bg-slate-950">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <span className="text-sm font-medium text-slate-500">Carregando clientes...</span>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Nome do Cliente</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefone</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-Mail</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cadastro</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                                {filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group/row">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div
                                                className="flex items-center gap-4 cursor-pointer group/name"
                                                onClick={() => fetchClientHistory(client)}
                                            >
                                                <Avatar
                                                    name={client.name}
                                                    className="w-10 h-10 ring-2 ring-transparent group-hover/name:ring-primary/20 transition-all shadow-sm rounded-[14px]"
                                                    initials={client.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || '?'}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover/name:text-primary transition-colors">{client.name}</span>
                                                    <span className="text-xs text-slate-500 group-hover/name:text-primary/70 transition-colors font-medium">
                                                        Ver Perfil & Histórico
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {client.phone ? formatPhone(client.phone) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{client.email || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                                                {new Date(client.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenModal(client)}
                                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors border border-slate-200/50 dark:border-slate-700/50"
                                                    title="Editar Detalhes"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: client.id })}
                                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors border border-slate-200/50 dark:border-slate-700/50"
                                                    title="Remover Registro"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredClients.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 flex items-center justify-center rounded-2xl">
                                                    <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-500">Nenhum registro encontrado</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                        Total: {filteredClients.length} de {clients.length} Clientes
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl font-medium" disabled>Anterior</Button>
                        <Button variant="outline" size="sm" className="rounded-xl font-medium" disabled={filteredClients.length === clients.length}>Próximo</Button>
                    </div>
                </div>
            </Card>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            >
                <div className="flex flex-col gap-1 mb-6">
                    <p className="text-sm font-medium text-primary">Gestão de Clientes</p>
                    <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                        {editingClient ? 'Editar Cadastro' : 'Novo Cliente'}
                    </h3>
                </div>

                <form onSubmit={handleSaveClient} className="space-y-5 pt-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</label>
                        <input
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400"
                            placeholder="Ex: Maria Oliveira"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefone</label>
                            <input
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400"
                                type="tel"
                                placeholder="+55 (00) 00000-0000"
                                value={phone}
                                onChange={(e) => setPhone(formatPhone(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</label>
                            <input
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400"
                                placeholder="cliente@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Observações</label>
                        <textarea
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[120px] resize-none placeholder:text-slate-400"
                            placeholder="Anote detalhes, alergias ou preferências..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="pt-6 flex gap-3 border-t border-slate-100 dark:border-slate-800/60 mt-6">
                        <Button type="button" variant="outline" className="flex-1 rounded-xl h-11 text-slate-600 dark:text-slate-300 font-medium" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 gap-2 rounded-xl bg-primary hover:bg-emerald-600 shadow-md shadow-primary/20 text-white transition-all h-11 font-medium" disabled={isSaving}>
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
                title="Ficha do Cliente"
            >
                {selectedClient && (
                    <div className="space-y-8 py-2 reveal-content overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <Avatar
                                size="lg"
                                className="w-20 h-20 ring-4 ring-primary/10 rounded-2xl"
                                name={selectedClient.name}
                                initials={selectedClient.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || '?'}
                            />
                            <div className="text-center md:text-left flex-1">
                                <h3 className="text-2xl font-serif font-bold mb-2">{selectedClient.name}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <span className="text-sm font-medium text-primary flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> {selectedClient.phone ? formatPhone(selectedClient.phone) : 'Sem Contato'}
                                    </span>
                                    <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> {selectedClient.email || 'Sem Registro'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {selectedClient.notes && (
                            <div className="space-y-3 relative z-10">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary" /> Notas e Observações
                                </h4>
                                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-l-2 border-primary rounded-r-xl text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {selectedClient.notes}
                                </div>
                            </div>
                        )}

                        <div className="space-y-8 relative z-10 p-1">
                            {/* Filtros Avançados de Atividades */}
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-5 rounded-xl space-y-5">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buscar Serviço ou Profissional</label>
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Pesquisar..."
                                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white placeholder:text-slate-400"
                                                value={activitySearch}
                                                onChange={(e) => setActivitySearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-48 space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtrar Status</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white cursor-pointer"
                                            value={activityStatus}
                                            onChange={(e) => setActivityStatus(e.target.value)}
                                        >
                                            <option value="Todos">Todos</option>
                                            <option value="Confirmado">Confirmados</option>
                                            <option value="Pendente">Pendentes</option>
                                            <option value="Cancelado">Cancelados</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A partir de</label>
                                            <input
                                                type="date"
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white"
                                                value={activityDateStart}
                                                onChange={(e) => setActivityDateStart(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Até</label>
                                            <input
                                                type="date"
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white"
                                                value={activityDateEnd}
                                                onChange={(e) => setActivityDateEnd(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {(activitySearch || activityStatus !== 'Todos' || activityDateStart || activityDateEnd) && (
                                        <button
                                            onClick={() => {
                                                setActivitySearch('');
                                                setActivityStatus('Todos');
                                                setActivityDateStart('');
                                                setActivityDateEnd('');
                                            }}
                                            className="text-xs font-semibold text-primary hover:underline underline-offset-2 pb-3 px-2"
                                        >
                                            Limpar Filtros
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4 mt-6">
                                    <Clock className="w-4 h-4 text-primary" /> Próximos Atendimentos
                                </h4>

                                {isLoadingHistory ? (
                                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                ) : (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const filtered = clientHistory.filter(h => {
                                        const matchesSearch = !activitySearch ||
                                            h.services?.name?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                                            h.professionals?.name?.toLowerCase().includes(activitySearch.toLowerCase());
                                        const matchesStatus = activityStatus === 'Todos' || h.status === activityStatus;

                                        const apptDateStr = h.appointment_date;
                                        const matchesDateStart = !activityDateStart || apptDateStr >= activityDateStart;
                                        const matchesDateEnd = !activityDateEnd || apptDateStr <= activityDateEnd;

                                        return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
                                    });

                                    const openList = filtered.filter(h => {
                                        const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                        apptDate.setHours(0, 0, 0, 0);
                                        return apptDate >= today && h.status !== 'Cancelado';
                                    });

                                    return openList.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-3">
                                            {openList.map((h) => (
                                                <div key={h.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center justify-between gap-4 hover:border-primary/50 shadow-sm transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-primary/10 transition-colors">
                                                            {getStatusIcon(h.status)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{h.services?.name}</span>
                                                            <span className="text-xs font-medium text-slate-500">{h.professionals?.name} • {new Date(h.appointment_date + 'T12:00:00').toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${h.status === 'Confirmado' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                                                        {h.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-white dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <p className="text-sm font-medium text-slate-500">Sem agendamentos futuros</p>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4 mt-8">
                                    <CheckCircle2 className="w-4 h-4 text-primary" /> Histórico de Atendimentos
                                </h4>

                                {isLoadingHistory ? (
                                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                ) : (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const filtered = clientHistory.filter(h => {
                                        const matchesSearch = !activitySearch ||
                                            h.services?.name?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                                            h.professionals?.name?.toLowerCase().includes(activitySearch.toLowerCase());
                                        const matchesStatus = activityStatus === 'Todos' || h.status === activityStatus;

                                        const apptDateStr = h.appointment_date;
                                        const matchesDateStart = !activityDateStart || apptDateStr >= activityDateStart;
                                        const matchesDateEnd = !activityDateEnd || apptDateStr <= activityDateEnd;

                                        return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
                                    });

                                    const pastList = filtered.filter(h => {
                                        const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                        apptDate.setHours(0, 0, 0, 0);
                                        return apptDate < today || h.status === 'Cancelado';
                                    });

                                    return pastList.length > 0 ? (
                                        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                            {pastList.map((h) => {
                                                const apptDate = new Date(h.appointment_date + 'T12:00:00');
                                                apptDate.setHours(0, 0, 0, 0);

                                                let displayStatus = h.status;
                                                let badgeClass = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';

                                                if (h.status === 'Cancelado') {
                                                    displayStatus = 'Cancelado';
                                                    badgeClass = 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 opacity-70';
                                                } else if (apptDate < today) {
                                                    if (h.status === 'Confirmado') {
                                                        displayStatus = 'Realizado';
                                                        badgeClass = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                                                    } else if (h.status === 'Pendente') {
                                                        displayStatus = 'Não Compareceu';
                                                        badgeClass = 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500';
                                                    }
                                                }

                                                return (
                                                    <div key={h.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-all group/item shadow-sm">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                                                {displayStatus === 'Realizado' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                                                                    displayStatus === 'Não Compareceu' ? <XCircle className="w-4 h-4 text-slate-400" /> :
                                                                        getStatusIcon(h.status)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white group-hover/item:text-primary transition-colors">{h.services?.name}</span>
                                                                <span className="text-xs font-medium text-slate-500">{h.professionals?.name} • {apptDate.toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${badgeClass}`}>
                                                            {displayStatus}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-white dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <p className="text-sm font-medium text-slate-500">Histórico limpo</p>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="pt-8 flex gap-3 relative z-10 border-t border-slate-100 dark:border-slate-800/60 mt-4">
                            <Button variant="outline" className="flex-1 rounded-xl h-11 text-slate-600 dark:text-slate-300 font-medium" onClick={() => setSelectedClient(null)}>Fechar Ficha</Button>
                            <Button className="flex-1 rounded-xl bg-primary hover:bg-emerald-600 text-white shadow-md shadow-primary/20 transition-all h-11 font-medium" onClick={() => { setSelectedClient(null); handleOpenModal(selectedClient); }}>
                                Editar Perfil
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
