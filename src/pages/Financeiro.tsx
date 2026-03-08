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
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-700">
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
                    <div className="p-4 bg-slate-950 rounded-sm shadow-xl shadow-black/10">
                        <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Monitor <span className="text-primary">Financeiro</span>
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Gestão de Fluxo e Projeções</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-sm p-4 shadow-xl shadow-black/5 w-full sm:w-auto focus-within:border-primary transition-all">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none cursor-pointer"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-[8px] font-black text-slate-300 uppercase">ATÉ</span>
                            <input
                                type="date"
                                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none cursor-pointer"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                <div className="bg-white dark:bg-slate-950 p-10 rounded-sm border-l-4 border-emerald-500 shadow-2xl shadow-black/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Capital Confirmado</p>
                    <h3 className="text-5xl font-black text-slate-950 dark:text-white tracking-tighter">{formatCurrency(totalBalance)}</h3>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Saldo Realizado</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-10 rounded-sm border-l-4 border-primary shadow-2xl shadow-black/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-24 h-24 text-primary" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Receita Projetada</p>
                    <h3 className="text-5xl font-black text-slate-950 dark:text-white tracking-tighter">{formatCurrency(projectedBalance)}</h3>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">Previsão Operacional</span>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-10 rounded-sm border-2 border-slate-100 dark:border-slate-900 shadow-2xl shadow-black/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter">Análise de <span className="text-primary">Performance</span></h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-1">Oscilação de Receita por Intervalo</p>
                    </div>
                    <div className="flex items-center bg-slate-900 p-1 divide-x divide-slate-800 border border-slate-800">
                        {(['diario', 'semanal', 'mensal'] as const).map(group => (
                            <button
                                key={group}
                                onClick={() => setChartGroup(group)}
                                className={`px-6 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${chartGroup === group ? 'bg-primary text-slate-950' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {group}
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
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Aguardando logs de transação</p>
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

            <div className="bg-white dark:bg-slate-900 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-2xl shadow-black/5 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter">Log de <span className="text-primary">Transações</span></h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Histórico de Atendimentos Confirmados</p>
                    </div>
                    <div className="w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-none border border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Limitar Visualização</span>
                            <select
                                className="bg-transparent text-[10px] font-black text-slate-950 dark:text-white uppercase outline-none cursor-pointer"
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={5}>05 LOGS</option>
                                <option value={10}>10 LOGS</option>
                                <option value={20}>20 LOGS</option>
                                <option value={50}>50 LOGS</option>
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
                        <FileText className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum registro encontrado no intervalo atual</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timeline</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Especificação</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Profissional</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Fee Final</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-slate-50 dark:divide-slate-800">
                                    {paginatedData.map(t => (
                                        <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-primary/5 transition-all">
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1 h-8 bg-emerald-500 rounded-none transform scale-y-50 group-hover:scale-y-100 transition-transform"></div>
                                                    <span className="text-sm font-black text-slate-600 dark:text-slate-400 tracking-tighter">
                                                        {new Date(t.appointment_date + 'T12:00:00').toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black text-slate-950 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors">
                                                        {t.clients?.name || 'Undefined Entity'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                        {t.services?.name || 'Core Protocol'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 whitespace-nowrap">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 border border-slate-200 dark:border-slate-700">
                                                    {t.professionals?.name || 'Sytem Agent'}
                                                </span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                                        {formatCurrency(t.services?.price || 0)}
                                                    </span>
                                                    <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Verificado</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Area */}
                        <div className="px-10 py-8 bg-slate-50 dark:bg-slate-950 shadow-inner flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Exibindo <span className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, confirmedTableData.length)}</span> de <span className="text-slate-900 dark:text-white">{confirmedTableData.length}</span> registros
                                </p>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-slate-100 transition-all rounded-none"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex gap-2">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(page => {
                                            return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                        }).map((page, index, array) => {
                                            if (index > 0 && page - array[index - 1] > 1) {
                                                return <span key={`dots-${page}`} className="text-slate-300 font-black">//</span>;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-10 h-10 text-[10px] font-black transition-all rounded-none border-2 ${currentPage === page ? 'bg-primary border-primary text-slate-950' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'}`}
                                                >
                                                    {page.toString().padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-slate-100 transition-all rounded-none"
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

