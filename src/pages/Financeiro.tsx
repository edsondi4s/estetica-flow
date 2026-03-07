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
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Financeiro Baseado em Atendimentos</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhe suas receitas confirmadas e pendentes</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 shadow-sm w-full sm:w-auto">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-400">até</span>
                            <input
                                type="date"
                                className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard label="Saldo Total (Confirmados)" value={formatCurrency(totalBalance)} icon={CheckCircle2} color="emerald" />
                <StatCard label="Projeção (Confirmados + Pendentes)" value={formatCurrency(projectedBalance)} icon={TrendingUp} color="blue" />
            </div>

            <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-slate-900 dark:text-white">Receita por Período</h3>
                    </div>
                    <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-slate-50 dark:bg-slate-900/50">
                        {(['diario', 'semanal', 'mensal'] as const).map(group => (
                            <button
                                key={group}
                                onClick={() => setChartGroup(group)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-colors ${chartGroup === group ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                {group}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-72 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <FileText className="w-12 h-12 opacity-20" />
                        <p>Nenhuma receita registrada no período selecionado.</p>
                    </div>
                ) : (
                    <div className="h-80 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis tickFormatter={(value) => `R$${value}`} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={<CustomTooltip formatCurrency={formatCurrency} />}
                                />
                                <Bar name="Receita Confirmada" dataKey="Confirmado" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                                <Bar name="Receita Pendente" dataKey="Pendente" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>

            <Card title="Atendimentos Confirmados">


                {isLoading ? (
                    <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : confirmedTableData.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm border-t border-slate-100 dark:border-slate-800">
                        Nenhum atendimento confirmado neste período.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Data</th>
                                        <th className="px-6 py-4 font-semibold">Cliente</th>
                                        <th className="px-6 py-4 font-semibold">Serviço</th>
                                        <th className="px-6 py-4 font-semibold">Profissional</th>
                                        <th className="px-6 py-4 font-semibold text-right">Valor Pago</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedData.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                                {new Date(t.appointment_date + 'T12:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                                                {t.clients?.name || 'Cliente Removido'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                                {t.services?.name || 'Serviço Removido'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                                {t.professionals?.name || 'Profissional Removido'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(t.services?.price || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mostrar</span>
                                <select
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 py-1.5 px-2 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-primary/50"
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">itens</span>
                            </div>
                            <span className="text-sm text-slate-500 font-medium">
                                Total Encontrado: {confirmedTableData.length}
                            </span>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-xl">
                                <p className="text-sm text-slate-500">
                                    Mostrando <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, confirmedTableData.length)}</span> de <span className="font-medium text-slate-900 dark:text-white">{confirmedTableData.length}</span> resultados
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-2"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>

                                    <div className="flex gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(page => {
                                            // Show first, last, current, and one before/after current
                                            return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                        }).map((page, index, array) => {
                                            // Add ellipsis logic
                                            if (index > 0 && page - array[index - 1] > 1) {
                                                return (
                                                    <React.Fragment key={`ellipsis-${page}`}>
                                                        <span className="px-2 py-1 text-slate-400">...</span>
                                                        <button
                                                            onClick={() => setCurrentPage(page)}
                                                            className={`w-8 h-8 rounded-md text-sm font-semibold transition-colors ${currentPage === page ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >
                                                            {page}
                                                        </button>
                                                    </React.Fragment>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 rounded-md text-sm font-semibold transition-colors ${currentPage === page ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-2"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
};

