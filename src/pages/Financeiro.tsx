import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, TrendingDown, Plus, Loader2, Filter, DollarSign, Wallet, FileText, CheckCircle2, ChevronDown } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

type Transaction = {
    id: string;
    type: 'Receita' | 'Despesa';
    amount: number;
    category: string;
    description: string | null;
    transaction_date: string;
    status: 'Concluído' | 'Pendente' | 'Cancelado';
    created_at: string;
};

export const Financeiro = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'7' | '15' | '30' | 'all'>('30');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [type, setType] = useState<'Receita' | 'Despesa'>('Receita');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState<'Concluído' | 'Pendente' | 'Cancelado'>('Concluído');

    useEffect(() => {
        fetchTransactions();
    }, [dateFilter]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('transactions').select('*').order('transaction_date', { ascending: false });

            if (dateFilter !== 'all') {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - parseInt(dateFilter));
                query = query.gte('transaction_date', pastDate.toISOString().split('T')[0]);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTransactions(data || []);
        } catch (error: any) {
            console.error('Erro ao buscar transações:', error);
            toast.error('Não foi possível carregar as transações.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const numAmount = parseFloat(amount.replace(',', '.'));
            if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valor inválido.');
            if (!category) throw new Error('Categoria é obrigatória.');

            const { error } = await supabase.from('transactions').insert([{
                type,
                amount: numAmount,
                category,
                description,
                transaction_date: date,
                status
            }]);

            if (error) throw error;

            toast.success('Transação salva com sucesso!');
            setIsModalOpen(false);
            resetForm();
            fetchTransactions();
        } catch (error: any) {
            toast.error('Erro ao salvar transação: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setType('Receita');
        setAmount('');
        setCategory('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setStatus('Concluído');
    };

    // Resumos
    const completedTransactions = transactions.filter(t => t.status === 'Concluído');
    const totalIncomes = completedTransactions.filter(t => t.type === 'Receita').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = completedTransactions.filter(t => t.type === 'Despesa').reduce((acc, curr) => acc + curr.amount, 0);
    const balance = totalIncomes - totalExpenses;

    // Dados para o Gráfico
    const chartDataMap = new Map<string, { name: string, Receitas: number, Despesas: number }>();
    completedTransactions.forEach(t => {
        const d = new Date(t.transaction_date + 'T00:00:00');
        const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!chartDataMap.has(key)) {
            chartDataMap.set(key, { name: key, Receitas: 0, Despesas: 0 });
        }

        const dataPoint = chartDataMap.get(key)!;
        if (t.type === 'Receita') dataPoint.Receitas += t.amount;
        else dataPoint.Despesas += t.amount;
    });

    const chartData = Array.from(chartDataMap.values()).reverse();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Visão Geral</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhe as movimentações do seu negócio</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-sm shrink-0">
                        <Filter className="w-4 h-4 text-slate-400 ml-2 mr-1" />
                        <select
                            className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 py-1.5 pr-2 outline-none cursor-pointer"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as any)}
                        >
                            <option value="7">Últimos 7 dias</option>
                            <option value="15">Últimos 15 dias</option>
                            <option value="30">Últimos 30 dias</option>
                            <option value="all">Todo o período</option>
                        </select>
                    </div>

                    <Button onClick={() => setIsModalOpen(true)} className="gap-2 whitespace-nowrap hidden sm:flex">
                        <Plus className="w-4 h-4" /> Nova Movimentação
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Saldo Total" value={formatCurrency(balance)} icon={Building2} color="blue" />
                <StatCard label="Receitas" value={formatCurrency(totalIncomes)} icon={TrendingUp} color="emerald" />
                <StatCard label="Despesas" value={formatCurrency(totalExpenses)} icon={TrendingDown} color="rose" />
                <Button onClick={() => setIsModalOpen(true)} className="gap-2 w-full sm:hidden">
                    <Plus className="w-4 h-4" /> Nova Movimentação
                </Button>
            </div>

            <Card title="Fluxo de Caixa Diário" className="p-6">
                {isLoading ? (
                    <div className="h-72 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <FileText className="w-12 h-12 opacity-20" />
                        <p>Nenhuma transação concluída no período selecionado.</p>
                    </div>
                ) : (
                    <div className="h-80 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis tickFormatter={(value) => `R$${value}`} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [formatCurrency(value)]} />
                                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>

            <Card title="Últimas Movimentações">
                {isLoading ? (
                    <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm border-t border-slate-100 dark:border-slate-800">
                        Nenhuma movimentação encontrada neste período.
                    </div>
                ) : (
                    <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Descrição / Categoria</th>
                                    <th className="px-6 py-4 font-semibold">Data</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {transactions.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg shrink-0 ${t.type === 'Receita' ? 'bg-emerald-100/50 text-emerald-600' : 'bg-rose-100/50 text-rose-600'}`}>
                                                    {t.type === 'Receita' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white capitalize">{t.description || t.category}</p>
                                                    {t.description && <p className="text-xs text-slate-500 capitalize">{t.category}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                            {new Date(t.transaction_date + 'T00:00:00').toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                                ${t.status === 'Concluído' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                    t.status === 'Pendente' ? 'bg-amber-100/80 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                                                        'bg-rose-100/80 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                                {t.status === 'Concluído' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                                            <span className={t.type === 'Receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                {t.type === 'Receita' ? '+' : '-'} {formatCurrency(t.amount)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-primary" /> Nova Movimentação
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                Fechar
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button type="button" onClick={() => setType('Receita')} className={`py-2 text-sm font-semibold rounded-lg transition-all ${type === 'Receita' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Receita</button>
                                <button type="button" onClick={() => setType('Despesa')} className={`py-2 text-sm font-semibold rounded-lg transition-all ${type === 'Despesa' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Despesa</button>
                            </div>
                            <InputField label={`Valor (${type})`} type="number" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Categoria *</label>
                                    <div className="relative">
                                        <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white appearance-none" value={category} onChange={(e) => setCategory(e.target.value)} required>
                                            <option value="">Selecione...</option>
                                            {type === 'Receita' ? (
                                                <>
                                                    <option value="Serviços">Serviços</option>
                                                    <option value="Produtos">Produtos</option>
                                                    <option value="Outros">Outras Entradas</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Fornecedores">Fornecedores</option>
                                                    <option value="Impostos">Impostos</option>
                                                    <option value="Salários">Salários</option>
                                                    <option value="Gastos Fixos">Gastos Fixos (Água, Luz)</option>
                                                    <option value="Outros">Outras Saídas</option>
                                                </>
                                            )}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <InputField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                            </div>
                            <InputField label="Descrição (Opcional)" type="text" placeholder="Ex: Conta de Luz / Pagamento Maria" value={description} onChange={(e) => setDescription(e.target.value)} />
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
                                <div className="relative">
                                    <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white appearance-none" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                                        <option value="Concluído">Pago / Recebido</option>
                                        <option value="Pendente">A Pagar / A Receber</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                                <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Salvar
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
