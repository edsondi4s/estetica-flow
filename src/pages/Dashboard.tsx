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
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {payload[0].value} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">agendamentos</span>
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
        <div className="flex flex-col gap-4 md:gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    onClick={() => onPageChange?.('agenda')}
                    label="Próximos Agendamentos"
                    value={stats.appointmentsCount.toString()}
                    subtitle="Hoje"
                    icon={Calendar}
                    trend={stats.appointmentsTrend}
                    color="indigo"
                />
                <StatCard
                    onClick={() => onPageChange?.('clientes')}
                    label="Total de Clientes"
                    value={stats.clientsCount.toLocaleString()}
                    icon={Users}
                    trend={stats.clientsTrend}
                    color="emerald"
                />
                <StatCard
                    onClick={() => onPageChange?.('financeiro')}
                    label="Receita do Mês"
                    value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    trend={stats.revenueTrend}
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
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(226, 232, 240, 0.5)', strokeWidth: 1, strokeDasharray: '3 3' }} />
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
                <Card title="🔥 Horários de Pico">
                    <div className="flex flex-col gap-4 py-2">
                        <p className="text-xs text-slate-500 mb-2 leading-relaxed">Frequência por horário e dia da semana (últmos 90 dias)</p>
                        <div className="flex gap-4">
                            {/* Time labels column */}
                            <div className="flex flex-col justify-between py-1 text-[9px] font-bold text-slate-400 w-8">
                                <span>08h</span>
                                <span>12h</span>
                                <span>16h</span>
                                <span>19h</span>
                            </div>

                            {/* Heatmap Grid */}
                            <div className="flex-1">
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Day labels header */}
                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                        <div key={i} className="text-[10px] font-black text-slate-400 text-center mb-1">{d}</div>
                                    ))}

                                    {/* Grid cells (rendered by hour, then by day) */}
                                    {heatmapData.map((row, hIdx) => (
                                        row.days.map((day: any, dIdx: number) => (
                                            <div
                                                key={`${hIdx}-${dIdx}`}
                                                className="w-full h-3.5 md:h-4.5 rounded-[1px] cursor-help transition-all hover:scale-110 relative group"
                                                style={{
                                                    backgroundColor: `var(--primary)`,
                                                    opacity: day.count === 0 ? 0.05 : Math.max(day.intensity, 0.2)
                                                }}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-xl border border-white/10">
                                                    {day.count} agendamentos às {row.hour}
                                                </div>
                                            </div>
                                        ))
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                            <span className="text-[9px] text-slate-400 font-medium italic">Frequência:</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-slate-400 mr-1">Menor</span>
                                {[0.2, 0.4, 0.6, 0.8, 1].map((op, i) => (
                                    <div key={i} className="w-2 h-2 rounded-[1px] bg-primary" style={{ opacity: op }}></div>
                                ))}
                                <span className="text-[9px] text-slate-400 ml-1">Maior</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex flex-col gap-6">
                    <Card title="Serviços Populares" extra={<button className="text-slate-400 hover:text-primary transition-colors"><MoreHorizontal className="w-5 h-5" /></button>}>
                        <div className="space-y-4">
                            {popularServices.map((service, i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${service.bg} border ${service.bg.replace('bg-', 'border-').split(' ')[0]}/20 flex items-center justify-center ${service.color} shrink-0 shadow-sm shadow-black/5`}>
                                                <service.icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">{service.name}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{service.count} agendamentos</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{service.percent}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${service.percent}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg p-5 text-white relative overflow-hidden flex-1 flex flex-col justify-center min-h-[160px]">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-1">Ações Rápidas</h3>
                            <p className="text-white/80 font-medium text-[11px] mb-4 leading-tight">Gestão eficiente com atalhos.</p>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => onPageChange?.('agenda')}
                                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex items-center gap-3 shadow-sm"
                                >
                                    <CalendarPlus className="w-5 h-5 text-white shrink-0" />
                                    <span className="text-[11px] font-bold">Novo Agendamento</span>
                                </button>
                                <button
                                    onClick={() => onPageChange?.('clientes')}
                                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex items-center gap-3 shadow-sm"
                                >
                                    <UserPlus className="w-5 h-5 text-white shrink-0" />
                                    <span className="text-[11px] font-bold">Adicionar Cliente</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};
