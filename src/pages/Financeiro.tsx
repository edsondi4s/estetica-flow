import React, { useState, useEffect, useMemo } from 'react';
import { Building2, TrendingUp, TrendingDown, Loader2, Filter, Wallet, FileText, CheckCircle2, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{label}</p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatCurrency(entry.value)} <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">({entry.name})</span>
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

type AppointmentFinance = {
    id: string;
    appointment_date: string;
    status: 'Confirmado' | 'Pendente' | 'Cancelado';
    services: {
        name: string;
        price: number;
    } | null;
    professionals: {
        name: string;
    } | null;
    clients: {
        name: string;
    } | null;
};

export const Financeiro = () => {
    const [appointments, setAppointments] = useState<AppointmentFinance[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Start of current month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        d.setDate(0); // End of current month
        return d.toISOString().split('T')[0];
    });

    // Chart Grouping
    const [chartGroup, setChartGroup] = useState<'diario' | 'semanal' | 'mensal'>('diario');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    status,
                    services ( name, price ),
                    professionals ( name ),
                    clients ( name )
                `)
                .gte('appointment_date', startDate)
                .lte('appointment_date', endDate)
                .order('appointment_date', { ascending: false });

            if (error) throw error;
            setAppointments(data as any[] || []);
            // reset pagination
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Erro ao buscar dados financeiros:', error);
            toast.error('Não foi possível carregar os dados financeiros.');
        } finally {
            setIsLoading(false);
        }
    };

    // Resumos - apenas baseados no selected date range
    const confirmedApps = appointments.filter(a => a.status === 'Confirmado');
    const pendingApps = appointments.filter(a => a.status === 'Pendente');

    // Saldo Total = Apenas Confirmados
    const totalBalance = confirmedApps.reduce((acc, curr) => acc + (curr.services?.price || 0), 0);
    // Projeção = Confirmados + Pendentes
    const projectedBalance = totalBalance + pendingApps.reduce((acc, curr) => acc + (curr.services?.price || 0), 0);

    // Pagination Logic for Confirmed Appointments Table
    const confirmedTableData = confirmedApps.sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());
    const totalPages = Math.ceil(confirmedTableData.length / itemsPerPage);
    const paginatedData = confirmedTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Dados para o Gráfico
    const chartData = useMemo(() => {
        const map = new Map<string, { label: string, sortKey: string, Confirmado: number, Pendente: number }>();

        appointments.forEach(a => {
            if (a.status === 'Cancelado') return;
            const price = a.services?.price || 0;
            const dateObj = new Date(a.appointment_date + 'T12:00:00');

            let key = '';
            let label = '';
            let sortKey = '';

            if (chartGroup === 'diario') {
                key = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
                label = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
                sortKey = key;
            } else if (chartGroup === 'semanal') {
                // Determine the week of the year
                const firstDayOfYear = new Date(dateObj.getFullYear(), 0, 1);
                const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
                const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
                key = `${dateObj.getFullYear()}-W${weekNum}`;
                label = `Semana ${weekNum}`;
                sortKey = key;
            } else {
                key = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
                label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                sortKey = key;
            }

            if (!map.has(key)) {
                map.set(key, { label, sortKey, Confirmado: 0, Pendente: 0 });
            }

            const dataPoint = map.get(key)!;
            if (a.status === 'Confirmado') dataPoint.Confirmado += price;
            if (a.status === 'Pendente') dataPoint.Pendente += price;
        });

        // Convert to array and sort by sortKey ascending
        return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [appointments, chartGroup]);


    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="flex flex-col gap-10 reveal-content pb-10">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-2xl">
                        <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-serif text-slate-900 dark:text-white tracking-tight">
                            Meu Financeiro
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Resumo de ganhos e previsões</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 shadow-sm w-full sm:w-auto focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-xs font-semibold text-slate-400">até</span>
                            <input
                                type="date"
                                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                <div className="bg-white dark:bg-slate-900 p-10 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <CheckCircle2 className="w-32 h-32 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500 mb-4 tracking-wide">TOTAL RECEBIDO</p>
                    <h3 className="text-4xl font-serif text-slate-900 dark:text-white tracking-tight">{formatCurrency(totalBalance)}</h3>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.2)]"></span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Dinheiro em Caixa</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-10 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <TrendingUp className="w-32 h-32 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500 mb-4 tracking-wide">PREVISÃO DE RECEBIMENTO</p>
                    <h3 className="text-4xl font-serif text-slate-900 dark:text-white tracking-tight">{formatCurrency(projectedBalance)}</h3>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(212,175,55,0.2)]"></span>
                        <span className="text-xs font-semibold text-primary">Valor Pendente</span>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
                    <div>
                        <h3 className="text-xl font-serif text-slate-900 dark:text-white tracking-tight">Gráfico de Ganhos</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">Variação de receita no período selecionado</p>
                    </div>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {(['diario', 'semanal', 'mensal'] as const).map(group => (
                            <button
                                key={group}
                                onClick={() => setChartGroup(group)}
                                className={`px-5 py-2 text-xs font-semibold tracking-wide rounded-lg transition-all ${chartGroup === group ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {group === 'diario' ? 'Diário' : group === 'semanal' ? 'Semanal' : 'Mensal'}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-80 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-80 flex flex-col items-center justify-center text-slate-600 gap-4">
                        <FileText className="w-12 h-12 opacity-10" />
                        <p className="text-sm font-medium text-slate-500">Nenhum movimento financeiro</p>
                    </div>
                ) : (
                    <div className="h-96 w-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: '0.1em' }}
                                    dy={15}
                                />
                                <YAxis
                                    tickFormatter={(value) => `R$ ${value}`}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#475569', fontSize: 10, fontWeight: '900' }}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(235, 254, 98, 0.05)' }}
                                    content={<CustomTooltip formatCurrency={formatCurrency} />}
                                />
                                <Bar name="Confirmado" dataKey="Confirmado" fill="var(--primary)" radius={0} maxBarSize={30} stackId="a" />
                                <Bar name="Pendente" dataKey="Pendente" fill="currentColor" className="text-slate-200 dark:text-slate-800" radius={0} maxBarSize={30} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-serif text-slate-900 dark:text-white tracking-tight">Lista de Recebimentos</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">Histórico de pagamentos confirmados</p>
                    </div>
                    <div className="w-full sm:w-auto">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/30 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-semibold text-slate-500">Exibir</span>
                            <select
                                className="bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={5}>05 Itens</option>
                                <option value={10}>10 Itens</option>
                                <option value={20}>20 Itens</option>
                                <option value={50}>50 Itens</option>
                            </select>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-40 flex items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : confirmedTableData.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-500">Nenhum registro encontrado no intervalo atual</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                        <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profissional</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {paginatedData.map(t => (
                                        <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-8 bg-emerald-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                        {new Date(t.appointment_date + 'T12:00:00').toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                                        {t.clients?.name || 'Cliente comum'}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-500">
                                                        {t.services?.name || 'Serviço padrão'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    {t.professionals?.name || 'Sistema'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(t.services?.price || 0)}
                                                    </span>
                                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Concluído
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Area */}
                        <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-4">
                                <p className="text-xs font-medium text-slate-500">
                                    Exibindo <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, confirmedTableData.length)}</span> de <span className="font-bold text-slate-900 dark:text-white">{confirmedTableData.length}</span> registros
                                </p>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:border-slate-200 transition-all rounded-lg shadow-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex gap-1.5">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(page => {
                                            return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                        }).map((page, index, array) => {
                                            if (index > 0 && page - array[index - 1] > 1) {
                                                return <span key={`dots-${page}`} className="text-slate-400 font-semibold px-2">...</span>;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`min-w-[40px] h-10 text-sm font-semibold transition-all rounded-lg border ${currentPage === page ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary dark:hover:text-primary'}`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:border-slate-200 transition-all rounded-lg shadow-sm"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

