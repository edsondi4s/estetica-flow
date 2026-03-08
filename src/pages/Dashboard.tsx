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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-900 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-50"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Dados: {label}</p>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary animate-pulse"></div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                        {payload[0].value} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">unidades</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

interface DashboardProps {
    onPageChange?: (page: string) => void;
}

export const Dashboard = ({ onPageChange }: DashboardProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [chartView, setChartView] = useState<'week' | 'month' | 'year'>('week');
    const [stats, setStats] = useState({
        appointmentsCount: 0,
        appointmentsTrend: '0%',
        clientsCount: 0,
        clientsTrend: '0%',
        revenue: 0,
        revenueTrend: '0%'
    });
    const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
    const [popularServices, setPopularServices] = useState<any[]>([]);
    const [proRanking, setProRanking] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [heatmapData, setHeatmapData] = useState<any[]>([]);

    // Pagination state for Recent Activity
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        fetchDashboardData();
    }, [chartView]);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // 1. Core Stats
            const { count: appCountToday } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('appointment_date', todayStr);

            const { count: appCountYesterday } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('appointment_date', yesterdayStr);

            const { count: totalClients } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true });

            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const firstDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

            const { count: clientsThisMonth } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', firstDayOfMonth.toISOString().split('T')[0]);

            const { count: clientsLastMonth } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', firstDayOfPrevMonth.toISOString().split('T')[0])
                .lte('created_at', lastDayOfPrevMonth.toISOString().split('T')[0] + 'T23:59:59');

            const { data: revenueDataThisMonth } = await supabase
                .from('appointments')
                .select('services(price)')
                .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
                .not('status', 'eq', 'Cancelado');

            const { data: revenueDataLastMonth } = await supabase
                .from('appointments')
                .select('services(price)')
                .gte('appointment_date', firstDayOfPrevMonth.toISOString().split('T')[0])
                .lte('appointment_date', lastDayOfPrevMonth.toISOString().split('T')[0])
                .not('status', 'eq', 'Cancelado');

            const revenueThisMonth = revenueDataThisMonth?.reduce((acc, curr: any) => acc + (curr.services?.price || 0), 0) || 0;
            const revenueLastMonth = revenueDataLastMonth?.reduce((acc, curr: any) => acc + (curr.services?.price || 0), 0) || 0;

            const calculateTrend = (current: number, previous: number) => {
                if (previous === 0) return current > 0 ? '+100%' : '0%';
                const change = ((current - previous) / previous) * 100;
                const sign = change > 0 ? '+' : '';
                return `${sign}${Math.round(change)}%`;
            };

            setStats({
                appointmentsCount: appCountToday || 0,
                appointmentsTrend: calculateTrend(appCountToday || 0, appCountYesterday || 0),
                clientsCount: totalClients || 0,
                clientsTrend: calculateTrend(clientsThisMonth || 0, clientsLastMonth || 0),
                revenue: revenueThisMonth,
                revenueTrend: calculateTrend(revenueThisMonth, revenueLastMonth)
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

            // 6. Weekly Frequency (Heatmap 2.0 - Hours x Days)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            const { data: hData } = await supabase
                .from('appointments')
                .select('appointment_date, appointment_time')
                .gte('appointment_date', ninetyDaysAgo.toISOString().split('T')[0])
                .not('status', 'eq', 'Cancelado');

            // Grid: Rows (Hours 08-19) x Cols (Days 0-6)
            const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8, 9, ..., 19
            const days = [0, 1, 2, 3, 4, 5, 6];

            const grid: any[] = hours.map(hour => ({
                hour: `${hour.toString().padStart(2, '0')}:00`,
                days: days.map(day => ({ day, count: 0 }))
            }));

            hData?.forEach(item => {
                const date = new Date(item.appointment_date + 'T12:00:00');
                const day = date.getDay();
                const hour = parseInt(item.appointment_time?.split(':')[0] || '0');

                if (hour >= 8 && hour <= 19) {
                    grid[hour - 8].days[day].count++;
                }
            });

            // Calculate global max for intensity
            let globalMax = 0;
            grid.forEach(row => row.days.forEach((d: any) => {
                if (d.count > globalMax) globalMax = d.count;
            }));

            setHeatmapData(grid.map(row => ({
                ...row,
                days: row.days.map((d: any) => ({
                    ...d,
                    intensity: globalMax > 0 ? d.count / globalMax : 0
                }))
            })));

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
        <div className="flex flex-col gap-8 md:gap-12 pb-12">
            {/* Header / Hero Section - Title Removed as per user request */}
            <div className="reveal-content flex flex-col md:flex-row md:items-end justify-between gap-6">
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 reveal-content delay-100">
                <div className="md:col-span-12 lg:col-span-5">
                    <StatCard
                        onClick={() => onPageChange?.('financeiro')}
                        label="Receita do Mês"
                        value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        icon={DollarSign}
                        trend={stats.revenueTrend}
                        color="rose"
                    />
                </div>
                <div className="md:col-span-6 lg:col-span-3">
                    <StatCard
                        onClick={() => onPageChange?.('agenda')}
                        label="Agendamentos"
                        value={stats.appointmentsCount.toString()}
                        subtitle="Hoje"
                        icon={Calendar}
                        trend={stats.appointmentsTrend}
                        color="indigo"
                    />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                    <StatCard
                        onClick={() => onPageChange?.('clientes')}
                        label="Clientes Totais"
                        value={stats.clientsCount.toLocaleString()}
                        icon={Users}
                        trend={stats.clientsTrend}
                        color="emerald"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 reveal-content delay-200">
                {/* Agendamentos Chart */}
                <div className="lg:col-span-8">
                    <Card
                        title="Vetor de Fluxo"
                        extra={
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-1 rounded-sm">
                                {(['week', 'month', 'year'] as const).map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setChartView(v)}
                                        className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${chartView === v
                                            ? 'bg-slate-900 text-primary shadow-xl shadow-black/20'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                                    >
                                        {v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
                                    </button>
                                ))}
                            </div>
                        }
                    >
                        <div className="h-[350px] w-full pt-8 px-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="var(--primary)" />
                                            <stop offset="100%" stopColor="#ff4d4d" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: '#64748B', fontWeight: 900 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: '#64748B', fontWeight: 900 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="url(#strokeGradient)"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorTotal)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Professional Ranking */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <Card title="⚡ Ranking de Profissionais">
                        <div className="space-y-3">
                            {proRanking.map((pro, index) => (
                                <div
                                    key={pro.id}
                                    className="relative flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"></div>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className={`text-xl font-black mb-1 ${getMedalColor(index)}`}>
                                                0{index + 1}
                                            </div>
                                            <div className="w-4 h-[2px] bg-slate-200 dark:bg-slate-800"></div>
                                        </div>
                                        <div className="relative">
                                            <Avatar name={pro.name} src={pro.photo} size="md" className="ring-2 ring-primary/10 group-hover:ring-primary/40 transition-all" />
                                            {index < 3 && <div className="absolute -top-1 -right-1 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-full w-5 h-5 shadow-xl"><Medal className={`w-3 h-3 ${getMedalColor(index)}`} /></div>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-1 group-hover:text-primary transition-colors">{pro.name}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400">{pro.count} Atendimentos</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="bg-white dark:bg-slate-950 rounded-sm shadow-2xl p-6 text-slate-950 dark:text-white relative overflow-hidden flex-1 flex flex-col justify-center min-h-[180px] group border-2 border-slate-100 dark:border-slate-900">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/40 transition-all duration-700"></div>
                        <div className="relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">Ações Rápidas</h3>
                            <p className="text-2xl font-black mb-6 leading-tight uppercase tracking-tight text-slate-900 dark:text-white">Alta <br />Performance</p>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => onPageChange?.('agenda')}
                                    className="bg-slate-50 dark:bg-white/5 hover:bg-primary text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-sm p-4 text-left transition-all duration-300 flex items-center justify-between group/btn"
                                >
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white group-hover/btn:text-slate-950 transition-colors">Novo Agendamento</span>
                                    <CalendarPlus className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                </button>
                                <button
                                    onClick={() => onPageChange?.('clientes')}
                                    className="bg-slate-50 dark:bg-white/5 hover:bg-primary text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-sm p-4 text-left transition-all duration-300 flex items-center justify-between group/btn"
                                >
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white group-hover/btn:text-slate-950 transition-colors">Cadastrar Cliente</span>
                                    <UserPlus className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="reveal-content delay-300">
                <Card
                    title="Atividades Recentes"
                    noPadding
                    extra={
                        <button
                            onClick={() => onPageChange?.('agenda')}
                            className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:opacity-70 transition-all flex items-center gap-2"
                        >
                            Ver Tudo <ArrowRight className="w-4 h-4" />
                        </button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100 dark:border-slate-900">
                                    <th className="px-8 py-6 font-black">Cliente</th>
                                    <th className="px-8 py-6 font-black">Serviço</th>
                                    <th className="px-8 py-6 font-black">Profissional</th>
                                    <th className="px-8 py-6 font-black">Data</th>
                                    <th className="px-8 py-6 font-black">Horário</th>
                                    <th className="px-8 py-6 font-black text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-sm bg-white dark:bg-slate-950">
                                {recentAppointments.length > 0 ? (
                                    recentAppointments
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((row, i) => (
                                            <tr key={i} className="hover:bg-primary/5 dark:hover:bg-primary/5 transition-all duration-300 group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <Avatar
                                                            name={row.clients?.name || 'Cliente'}
                                                            className="w-10 h-10 ring-2 ring-primary/10 group-hover:ring-primary/40 transition-all rounded-sm"
                                                            initials={row.clients?.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || 'C'}
                                                        />
                                                        <span className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-xs">{row.clients?.name || 'Cliente'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{row.services?.name}</td>
                                                <td className="px-8 py-5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                                                    {row.professionals?.name || 'Profissional'}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-sm">
                                                        {row.appointment_date ? new Date(row.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-[10px] font-black text-primary font-mono bg-primary/5 dark:bg-primary/10 text-center">
                                                    {row.appointment_time?.substring(0, 5) || '--:--'}
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-16 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                                            Aguardando entrada de dados...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {recentAppointments.length > 0 && (
                        <div className="px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950/50">
                            <div className="flex items-center gap-4">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registros por Bloco:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm text-[10px] font-black text-slate-700 dark:text-slate-200 py-1.5 px-4 outline-none focus:border-primary transition-all cursor-pointer uppercase"
                                >
                                    {[5, 10, 20, 50].map(val => (
                                        <option key={val} value={val}>{val} Unid.</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">
                                    Página {currentPage} de {Math.ceil(recentAppointments.length / itemsPerPage)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 bg-slate-950 text-white border border-slate-900 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(recentAppointments.length / itemsPerPage)))}
                                        disabled={currentPage === Math.ceil(recentAppointments.length / itemsPerPage)}
                                        className="p-2 bg-slate-950 text-white border border-slate-900 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                                    >
                                        <ChevronRight className="w-5 h-5 text-primary" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8 reveal-content delay-300">
                <Card title="📈 Intensidade de Atendimento">
                    <div className="flex flex-col gap-6 py-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Análise de volume por horário (últimos 90 dias)</p>
                        <div className="flex gap-6">
                            <div className="flex flex-col justify-between py-2 text-[10px] font-black text-slate-500 w-8 text-right pr-2 border-r border-slate-100 dark:border-slate-900">
                                <span>08H</span>
                                <span>12H</span>
                                <span>16H</span>
                                <span>19H</span>
                            </div>

                            <div className="flex-1">
                                <div className="grid grid-cols-7 gap-1.5">
                                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((d, i) => (
                                        <div key={i} className="text-[9px] font-black text-slate-400 text-center mb-2 uppercase tracking-tighter">{d}</div>
                                    ))}

                                    {heatmapData.map((row, hIdx) => (
                                        row.days.map((day: any, dIdx: number) => (
                                            <div
                                                key={`${hIdx}-${dIdx}`}
                                                className="w-full h-4.5 rounded-sm cursor-crosshair transition-all hover:scale-125 hover:z-50 relative group border border-transparent hover:border-white/20"
                                                style={{
                                                    backgroundColor: `var(--primary)`,
                                                    boxShadow: day.count > 0 ? `0 0 10px var(--primary)` : 'none',
                                                    opacity: day.count === 0 ? 0.03 : Math.max(day.intensity, 0.2)
                                                }}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-950 text-white text-[10px] font-black py-2 px-3 border border-primary/50 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-30 shadow-2xl backdrop-blur-xl uppercase tracking-widest">
                                                    <span className="text-primary">{day.count} Agendamentos</span> Detectados @ {row.hour}
                                                </div>
                                            </div>
                                        ))
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-900/50">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Densidade de Atendimentos</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Baixo</span>
                                {[0.1, 0.3, 0.5, 0.7, 1].map((op, i) => (
                                    <div key={i} className="w-3 h-3 rounded-sm bg-primary border border-white/10" style={{ opacity: op }}></div>
                                ))}
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Alto</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="📈 Meus Serviços" extra={<button className="text-slate-400 hover:text-primary transition-all"><MoreHorizontal className="w-5 h-5" /></button>}>
                    <div className="space-y-6 py-2">
                        {popularServices.map((service, i) => (
                            <div key={i} className="group cursor-default">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 group-hover:border-primary/50 transition-all flex items-center justify-center ${service.color} shrink-0 shadow-2xl relative overflow-hidden`}>
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <service.icon className="w-8 h-8 relative z-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors tracking-tighter uppercase">{service.name}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-[1px] bg-slate-300 dark:bg-slate-700"></div>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">{service.count} Execuções</p>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-slate-950 dark:text-white tracking-tighter">{service.percent}.0%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-900 h-1.5 overflow-hidden rounded-sm relative">
                                    <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                                    <div className="bg-primary h-full relative" style={{ width: `${service.percent}%` }}>
                                        <div className="absolute top-0 right-0 w-2 h-full bg-white opacity-20 blur-sm"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};
