import { useState, useEffect } from 'react';
import {
    Calendar, Users, DollarSign, ArrowRight, Droplets, Scissors,
    MoreHorizontal, CalendarPlus, UserPlus, Loader2, Trophy,
    Medal, TrendingUp, ChevronDown, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';

interface DashboardProps {
    onPageChange?: (page: string) => void;
}

export const Dashboard = ({ onPageChange }: DashboardProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [chartView, setChartView] = useState<'week' | 'month' | 'year'>('week');
    const [stats, setStats] = useState({
        appointmentsCount: 0,
        clientsCount: 0,
        revenue: 0
    });
    const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
    const [popularServices, setPopularServices] = useState<any[]>([]);
    const [proRanking, setProRanking] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);

    // Pagination state for Recent Activity
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        fetchDashboardData();
    }, [chartView]);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Core Stats
            const { count: appCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('appointment_date', today);

            const { count: clientsCount } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true });

            const firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            const { data: revenueData } = await supabase
                .from('appointments')
                .select('services(price)')
                .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
                .not('status', 'eq', 'Cancelado');

            const totalRevenue = revenueData?.reduce((acc, curr: any) => acc + (curr.services?.price || 0), 0) || 0;

            setStats({
                appointmentsCount: appCount || 0,
                clientsCount: clientsCount || 0,
                revenue: totalRevenue
            });

            // 2. Recent activity
            const { data: recentData } = await supabase
                .from('appointments')
                .select(`
                    id, appointment_date, appointment_time, status, 
                    professionals(name), clients(name), services(name)
                `)
                .order('created_at', { ascending: false })
                .limit(50); // Fetch more for pagination

            setRecentAppointments(recentData || []);

            // 3. Popular services
            const { data: servicesStats } = await supabase
                .from('appointments')
                .select('services!inner(name)')
                .eq('services.is_active', true);

            const sCounts: { [key: string]: number } = {};
            servicesStats?.forEach((s: any) => {
                const name = s.services?.name;
                if (name) sCounts[name] = (sCounts[name] || 0) + 1;
            });

            const sortedServices = Object.entries(sCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            const totalApps = servicesStats?.length || 1;
            setPopularServices(sortedServices.map(s => {
                const isBotox = s.name.toLowerCase().includes('botox');
                return {
                    name: s.name,
                    count: s.count,
                    percent: Math.round((s.count / totalApps) * 100),
                    icon: isBotox ? Scissors : Droplets,
                    color: isBotox ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400',
                    bg: isBotox ? 'bg-purple-50 dark:bg-purple-500/10' : 'bg-blue-50 dark:bg-blue-500/10'
                };
            }));

            // 4. Professional Ranking
            const { data: proStats } = await supabase
                .from('appointments')
                .select('professionals(id, name, photo_url)')
                .not('status', 'eq', 'Cancelado');

            const pCounts: { [key: string]: { count: number, name: string, photo?: string } } = {};
            proStats?.forEach((p: any) => {
                if (!p.professionals) return;
                const id = p.professionals.id;
                if (!pCounts[id]) {
                    pCounts[id] = { count: 0, name: p.professionals.name, photo: p.professionals.photo_url };
                }
                pCounts[id].count++;
            });

            const sortedPros = Object.entries(pCounts)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            setProRanking(sortedPros);

            // 5. Chart Data (Week/Month/Year)
            await fetchChartData();

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchChartData = async () => {
        let startDate = new Date();
        if (chartView === 'week') {
            startDate.setDate(startDate.getDate() - 6);
        } else if (chartView === 'month') {
            startDate.setDate(startDate.getDate() - 29);
        } else {
            startDate.setMonth(0);
            startDate.setDate(1);
        }

        const { data } = await supabase
            .from('appointments')
            .select('appointment_date')
            .gte('appointment_date', startDate.toISOString().split('T')[0])
            .not('status', 'eq', 'Cancelado');

        const groupedData: { [key: string]: number } = {};

        if (chartView === 'year') {
            // Group by month
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            months.forEach(m => groupedData[m] = 0);
            data?.forEach(d => {
                const month = new Date(d.appointment_date + 'T00:00:00').getMonth();
                groupedData[months[month]]++;
            });
            setChartData(Object.entries(groupedData).map(([name, total]) => ({ name, total })));
        } else {
            // Group by day
            const daysToFetch = chartView === 'week' ? 7 : 30;
            for (let i = 0; i < daysToFetch; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                groupedData[label] = 0;
            }
            data?.forEach(d => {
                const label = new Date(d.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if (groupedData[label] !== undefined) groupedData[label]++;
            });
            setChartData(Object.entries(groupedData).map(([name, total]) => ({ name, total })));
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

    if (isLoading && chartData.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Próximos Agendamentos"
                    value={stats.appointmentsCount.toString()}
                    subtitle="Hoje"
                    icon={Calendar}
                    trend="+5%"
                    color="indigo"
                />
                <StatCard
                    label="Total de Clientes"
                    value={stats.clientsCount.toLocaleString()}
                    icon={Users}
                    trend="+12%"
                    color="emerald"
                />
                <StatCard
                    label="Receita do Mês"
                    value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    trend="+8%"
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agendamentos Chart */}
                <Card
                    className="lg:col-span-2"
                    title="Desempenho de Agendamentos"
                    extra={
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
                            {(['week', 'month', 'year'] as const).map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setChartView(v)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartView === v
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
                                </button>
                            ))}
                        </div>
                    }
                >
                    <div className="h-[300px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#FFF',
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="var(--primary)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTotal)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Professional Ranking */}
                <Card title="🏆 Ranking de Profissionais">
                    <div className="space-y-4">
                        {proRanking.map((pro, index) => (
                            <div
                                key={pro.id}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 flex items-center justify-center shrink-0`}>
                                        {index < 3 ? (
                                            <Medal className={`w-6 h-6 ${getMedalColor(index)}`} />
                                        ) : (
                                            <span className="text-sm font-bold text-slate-400">{index + 1}</span>
                                        )}
                                    </div>
                                    <Avatar name={pro.name} src={pro.photo} size="md" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{pro.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{pro.count} agendamentos</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>Top</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card
                title="Atividade Recente"
                noPadding
                extra={
                    <button
                        onClick={() => onPageChange?.('agenda')}
                        className="text-sm text-primary-dark font-medium hover:text-primary transition-colors flex items-center gap-1"
                    >
                        Ver Tudo <ArrowRight className="w-4 h-4" />
                    </button>
                }
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 font-semibold">Cliente</th>
                                <th className="px-6 py-4 font-semibold">Serviço</th>
                                <th className="px-6 py-4 font-semibold">Profissional</th>
                                <th className="px-6 py-4 font-semibold">Data</th>
                                <th className="px-6 py-4 font-semibold">Horário</th>
                                <th className="px-6 py-4 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {recentAppointments.length > 0 ? (
                                recentAppointments
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={row.clients?.name || 'Cliente'}
                                                        initials={row.clients?.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || 'C'}
                                                    />
                                                    <span className="font-medium text-slate-900 dark:text-white">{row.clients?.name || 'Cliente'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.services?.name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {row.professionals?.name || 'Profissional'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-medium dark:text-slate-400">
                                                {row.appointment_date ? new Date(row.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono dark:text-slate-400">
                                                {row.appointment_time?.substring(0, 5) || '--:--'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        Nenhum agendamento encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {recentAppointments.length > 0 && (
                    <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 rounded-b-xl">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Itens por página:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 py-1.5 px-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer hover:border-primary/30"
                            >
                                {[5, 10, 20, 50].map(val => (
                                    <option key={val} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">
                                {Math.min((currentPage * itemsPerPage) - itemsPerPage + 1, recentAppointments.length)} - {Math.min(currentPage * itemsPerPage, recentAppointments.length)} de {recentAppointments.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(recentAppointments.length / itemsPerPage)))}
                                    disabled={currentPage === Math.ceil(recentAppointments.length / itemsPerPage)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <Card title="Serviços Populares" extra={<button className="text-slate-400 hover:text-primary transition-colors"><MoreHorizontal className="w-5 h-5" /></button>}>
                    <div className="space-y-4">
                        {popularServices.map((service, i) => (
                            <div key={i}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl ${service.bg} border ${service.bg.replace('bg-', 'border-').split(' ')[0]}/20 flex items-center justify-center ${service.color} shrink-0 shadow-sm shadow-black/5`}>
                                            <service.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{service.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{service.count} agendamentos esta semana</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{service.percent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div className="bg-primary h-2 rounded-full" style={{ width: `${service.percent}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold mb-2">Ações Rápidas</h3>
                        <p className="text-white/80 font-medium text-sm mb-6">Gerencie sua clínica de forma eficiente com esses atalhos.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                onClick={() => onPageChange?.('agenda')}
                                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex flex-col gap-2 shadow-sm"
                            >
                                <CalendarPlus className="w-6 h-6 text-white" />
                                <span className="text-sm font-bold">Novo Agendamento</span>
                            </button>
                            <button
                                onClick={() => onPageChange?.('clientes')}
                                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex flex-col gap-2 shadow-sm"
                            >
                                <UserPlus className="w-6 h-6 text-white" />
                                <span className="text-sm font-bold">Adicionar Cliente</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
