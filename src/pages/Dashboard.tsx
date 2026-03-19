import { useState, useEffect } from 'react';
import {
    Calendar, Users, DollarSign, ArrowRight, Droplets, Scissors,
    MoreHorizontal, CalendarPlus, UserPlus, Loader2, Trophy,
    Medal, TrendingUp, ChevronDown, Filter, ChevronLeft, ChevronRight, Sparkles, X
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
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 border border-slate-100 dark:border-slate-800 rounded-luxury shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-50"></div>
                <p className="text-xs font-medium text-slate-500 mb-1">Período: {label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary animate-pulse rounded-full"></div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {payload[0].value} <span className="text-xs font-normal text-slate-400">agendamentos</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
}

interface DashboardProps {
    onPageChange?: (page: string) => void;
}

export const Dashboard = ({ onPageChange }: DashboardProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [isInsightOpen, setIsInsightOpen] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
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

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        fetchDashboardData();

        // Check if welcome modal was shown in this session
        if (!sessionStorage.getItem('insightModalShown')) {
            setTimeout(() => {
                setShowWelcomeModal(true);
                sessionStorage.setItem('insightModalShown', 'true');
            }, 1000); // Small delay to allow data to load and feel organic
        }
    }, [chartView]);

    useEffect(() => {
        const appointmentsSubscription = supabase
            .channel('dashboard_appointments')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                () => fetchDashboardData()
            )
            .subscribe();

        const clientsSubscription = supabase
            .channel('dashboard_clients')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'clients' },
                () => fetchDashboardData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(appointmentsSubscription);
            supabase.removeChannel(clientsSubscription);
        };
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
                if (metaName) {
                    setUserName(metaName.split(' ')[0]);
                } else if (user.email) {
                    const emailName = user.email.split('@')[0];
                    setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
                }
            }

            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const { count: appCountToday } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', todayStr);
            const { count: appCountYesterday } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', yesterdayStr);
            const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true });

            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const firstDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

            const { count: clientsThisMonth } = await supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', firstDayOfMonth.toISOString().split('T')[0]);
            const { count: clientsLastMonth } = await supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', firstDayOfPrevMonth.toISOString().split('T')[0]).lte('created_at', lastDayOfPrevMonth.toISOString().split('T')[0] + 'T23:59:59');

            const { data: revenueDataThisMonth } = await supabase.from('appointments').select('services(price)').gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0]).not('status', 'eq', 'Cancelado');
            const { data: revenueDataLastMonth } = await supabase.from('appointments').select('services(price)').gte('appointment_date', firstDayOfPrevMonth.toISOString().split('T')[0]).lte('appointment_date', lastDayOfPrevMonth.toISOString().split('T')[0]).not('status', 'eq', 'Cancelado');

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

            const { data: recentData } = await supabase
                .from('appointments')
                .select(`id, appointment_date, appointment_time, status, professionals(name), clients(name), services(name)`)
                .order('created_at', { ascending: false })
                .limit(50);
            setRecentAppointments(recentData || []);

            const { data: servicesStats } = await supabase.from('appointments').select('services!inner(name)').eq('services.is_active', true);
            const sCounts: { [key: string]: number } = {};
            servicesStats?.forEach((s: any) => {
                const name = s.services?.name;
                if (name) sCounts[name] = (sCounts[name] || 0) + 1;
            });
            const sortedServices = Object.entries(sCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3);
            const totalApps = servicesStats?.length || 1;
            setPopularServices(sortedServices.map(s => {
                const isBotox = s.name.toLowerCase().includes('botox');
                return {
                    name: s.name, count: s.count, percent: Math.round((s.count / totalApps) * 100),
                    icon: isBotox ? Sparkles : Droplets,
                    color: isBotox ? 'text-primary' : 'text-[var(--color-secondary)]',
                    bg: isBotox ? 'bg-primary/10' : 'bg-[var(--color-secondary)]/10'
                };
            }));

            const { data: proStats } = await supabase.from('appointments').select('professionals(id, name, photo_url)').not('status', 'eq', 'Cancelado');
            const pCounts: { [key: string]: { count: number, name: string, photo?: string } } = {};
            proStats?.forEach((p: any) => {
                if (!p.professionals) return;
                const id = p.professionals.id;
                if (!pCounts[id]) pCounts[id] = { count: 0, name: p.professionals.name, photo: p.professionals.photo_url };
                pCounts[id].count++;
            });
            const sortedPros = Object.entries(pCounts).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.count - a.count).slice(0, 5);
            setProRanking(sortedPros);

            await fetchChartData();

            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const { data: hData } = await supabase.from('appointments').select('appointment_date, appointment_time').gte('appointment_date', ninetyDaysAgo.toISOString().split('T')[0]).not('status', 'eq', 'Cancelado');
            
            const hours = Array.from({ length: 12 }, (_, i) => i + 8);
            const days = [0, 1, 2, 3, 4, 5, 6];
            const grid: any[] = hours.map(hour => ({ hour: `${hour.toString().padStart(2, '0')}:00`, days: days.map(day => ({ day, count: 0 })) }));
            
            hData?.forEach(item => {
                const date = new Date(item.appointment_date + 'T12:00:00');
                const day = date.getDay();
                const hour = parseInt(item.appointment_time?.split(':')[0] || '0');
                if (hour >= 8 && hour <= 19) grid[hour - 8].days[day].count++;
            });

            let globalMax = 0;
            grid.forEach(row => row.days.forEach((d: any) => { if (d.count > globalMax) globalMax = d.count; }));
            setHeatmapData(grid.map(row => ({
                ...row,
                days: row.days.map((d: any) => ({ ...d, intensity: globalMax > 0 ? d.count / globalMax : 0 }))
            })));

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchChartData = async () => {
        let startDate = new Date();
        if (chartView === 'week') startDate.setDate(startDate.getDate() - 6);
        else if (chartView === 'month') startDate.setDate(startDate.getDate() - 29);
        else { startDate.setMonth(0); startDate.setDate(1); }

        const { data } = await supabase.from('appointments').select('appointment_date').gte('appointment_date', startDate.toISOString().split('T')[0]).not('status', 'eq', 'Cancelado');
        const groupedData: { [key: string]: number } = {};

        if (chartView === 'year') {
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            months.forEach(m => groupedData[m] = 0);
            data?.forEach(d => { const month = new Date(d.appointment_date + 'T00:00:00').getMonth(); groupedData[months[month]]++; });
            setChartData(Object.entries(groupedData).map(([name, total]) => ({ name, total })));
        } else {
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
            case 0: return 'text-amber-500'; // Gold
            case 1: return 'text-slate-400'; // Silver
            case 2: return 'text-orange-700'; // Bronze
            default: return 'text-slate-300';
        }
    };

    const generateDynamicInsight = () => {
        const hour = new Date().getHours();
        let greeting = 'Boa noite';
        if (hour >= 5 && hour < 12) greeting = 'Bom dia';
        else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';

        const dayOfWeek = new Date().getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let insight = '';
        let tip = '';

        const revTrendVal = parseFloat(stats.revenueTrend.replace('%', '').replace('+', '')) || 0;
        const appTrendVal = parseFloat(stats.appointmentsTrend.replace('%', '').replace('+', '')) || 0;
        const formattedRev = `R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        if (stats.appointmentsCount === 0) {
            if (isWeekend) {
                insight = `O fim de semana chegou e não temos agendamentos marcados para hoje. A receita mensal segue acumulada em ${formattedRev}.`;
                tip = 'Aproveite a pausa para revisar suas métricas financeiras, planejar a próxima semana ou descansar. Uma mente criativa vende mais!';
            } else {
                insight = `Nenhum agendamento foi registrado para hoje ainda. No acumulado deste mês, já alcançamos um total de ${formattedRev} gerados.`;
                tip = 'Este é um excelente momento para ativar seus Agentes de IA e enviar uma campanha relâmpago para clientes que não retornam há mais de 30 dias.';
            }
        } else if (stats.appointmentsCount > 5) {
            insight = `Sua agenda está bombando! Temos ${stats.appointmentsCount} agendamentos previstos para hoje. A receita somada até agora neste mês totaliza ${formattedRev}.`;
            
            if (revTrendVal > 0) {
                tip = `A receita já cresceu ${stats.revenueTrend} comparada ao mês passado! Tente focar em adicionar serviços de upsell durante o atendimento local de hoje.`;
            } else {
                tip = 'Com a clínica cheia, fortalecer o relacionamento é a chave. Ao final dos atendimentos, não se esqueça de solicitar avaliações positivas no Google Meu Negócio.';
            }
        } else {
            insight = `Sua operação segue um ritmo estável com ${stats.appointmentsCount} agendamento(s) para hoje. A receita confirmada deste mês está em ${formattedRev}.`;
            
            if (appTrendVal < 0) {
                tip = `Sua média diária de agendamentos está levemente reduzida (${stats.appointmentsTrend}). Experimente reativar Lembretes Automáticos para blindar-se contra no-shows (faltas).`;
            } else if (revTrendVal < 0) {
                tip = `A receita demonstra uma métrica de ${stats.revenueTrend}. Como estratégia prática, vale criar promoções via WhatsApp mirando serviços de alto ticket.`;
            } else {
                tip = 'Seus números demonstram estabilidade brilhante. Aproveite a brecha nos horários vagos de hoje para organizar com a equipe conteúdos engajadores para o Instagram da clínica!';
            }
        }

        return { greeting, insight, tip };
    };

    if (isLoading && chartData.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Dynamic Insight Floating Widget */}
            <div className={`fixed bottom-8 right-8 z-50 transition-all duration-500 ease-out transform ${isInsightOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
                {isInsightOpen && (
                    <div className="w-80 sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-3xl shadow-[0_20px_40px_rgba(16,185,129,0.15)] flex flex-col relative overflow-hidden mb-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                        
                        <div className="p-6 relative z-10 border-b border-emerald-500/10 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    <Sparkles className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {generateDynamicInsight().greeting}{userName ? `, ${userName}` : ''}!
                                    </h3>
                                    <p className="text-xs text-slate-500">Agente Estratégico AI</p>
                                </div>
                            </div>
                            <button onClick={() => setIsInsightOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-6 relative z-10 space-y-4">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                                {generateDynamicInsight().insight}
                            </p>
                            <div className="bg-emerald-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/10">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-2">
                                    <span>💡</span> DICA ESTRATÉGICA
                                </div>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {generateDynamicInsight().tip}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Toggle Button */}
            {!isInsightOpen && !showWelcomeModal && (
                <button
                    onClick={() => setIsInsightOpen(true)}
                    className="fixed bottom-8 right-8 z-50 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-4 shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-110 hover:-translate-y-1 animate-in fade-in zoom-in group"
                    title="Insights da IA"
                >
                    <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </button>
            )}

            {/* Welcome Modal Overlay */}
            {showWelcomeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-3xl shadow-[0_20px_40px_rgba(16,185,129,0.15)] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none"></div>
                        
                        <div className="p-8 relative z-10 flex flex-col items-center text-center pb-6">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20 mb-6 shadow-sm">
                                <Sparkles className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-2">
                                {generateDynamicInsight().greeting}{userName ? `, ${userName}` : ''}!
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mb-6">
                                Resumo Estratégico Diário
                            </p>
                            <p className="text-base font-medium text-slate-700 dark:text-slate-200 leading-relaxed mb-8">
                                {generateDynamicInsight().insight}
                            </p>
                        </div>
                        
                        <div className="p-6 relative z-10 bg-emerald-50/50 dark:bg-slate-800/30 border-t border-emerald-500/10">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-3">
                                <span>💡</span> DICA ESTRATÉGICA
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                                {generateDynamicInsight().tip}
                            </p>
                            
                            <button 
                                onClick={() => setShowWelcomeModal(false)}
                                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5"
                            >
                                Acessar Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 reveal-content delay-100">
                <div className="md:col-span-12 lg:col-span-4">
                    <StatCard
                        onClick={() => onPageChange?.('financeiro')}
                        label="Receita do Mês"
                        value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        icon={DollarSign}
                        trend={stats.revenueTrend}
                        color="amber"
                    />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                    <StatCard
                        onClick={() => onPageChange?.('agenda')}
                        label="Agendamentos Hoje"
                        value={stats.appointmentsCount.toString()}
                        icon={Calendar}
                        trend={stats.appointmentsTrend}
                        color="indigo"
                    />
                </div>
                <div className="md:col-span-6 lg:col-span-4">
                    <StatCard
                        onClick={() => onPageChange?.('clientes')}
                        label="Total de Clientes"
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
                        title="Fluxo de Atendimentos"
                        extra={
                            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200 dark:border-slate-700/50">
                                {(['week', 'month', 'year'] as const).map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setChartView(v)}
                                        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${chartView === v
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                    >
                                        {v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
                                    </button>
                                ))}
                            </div>
                        }
                    >
                        <div className="h-[350px] w-full pt-8 px-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#64748B', fontWeight: 400 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#64748B', fontWeight: 400 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="var(--primary)"
                                        strokeWidth={3}
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
                    <Card title="Destaques da Equipe">
                        <div className="space-y-4 min-h-[300px] flex flex-col pt-2">
                            {proRanking.length > 0 ? (
                                proRanking.map((pro, index) => (
                                    <div
                                        key={pro.id}
                                        className="relative flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-luxury hover:border-primary/30 transition-all cursor-default group"
                                    >
                                        <div className="flex items-center gap-4 relative z-10 w-full">
                                            <div className="flex flex-col items-center justify-center w-6">
                                                <div className={`text-lg font-serif mb-0.5 ${getMedalColor(index)}`}>
                                                    0{index + 1}
                                                </div>
                                            </div>
                                            <div className="relativeshrink-0">
                                                <Avatar name={pro.name} src={pro.photo} size="md" className="ring-2 ring-transparent group-hover:ring-primary/20 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{pro.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-slate-500 font-light">{pro.count} procedimentos</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                                    <Medal className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-4" />
                                    <p className="text-sm font-light text-slate-500">Nenhum dado disponível ainda.</p>
                                </div>
                            )}
                        </div>
                    </Card>


                </div>
            </div>

            <div className="reveal-content delay-300">
                <Card
                    title="Atividades Recentes"
                    noPadding
                    extra={
                        <button
                            onClick={() => onPageChange?.('agenda')}
                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        >
                            Ver agenda completa <ArrowRight className="w-4 h-4" />
                        </button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide font-medium border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Procedimento</th>
                                    <th className="px-6 py-4">Especialista</th>
                                    <th className="px-6 py-4">Data e Hora</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm bg-white dark:bg-slate-900">
                                {recentAppointments.length > 0 ? (
                                    recentAppointments
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={row.clients?.name || 'Cliente'}
                                                            className="w-9 h-9 ring-1 ring-slate-100 dark:ring-slate-800 group-hover:ring-primary/20 transition-all rounded-full"
                                                            initials={row.clients?.name?.split(' ')?.map((n: any) => n[0]).join('').toUpperCase() || 'C'}
                                                        />
                                                        <span className="font-medium text-slate-900 dark:text-white text-sm">{row.clients?.name || 'Cliente'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-light">{row.services?.name}</td>
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-light">{row.professionals?.name || 'Profissional'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                       <span className="text-sm text-slate-700 dark:text-slate-200">
                                                            {row.appointment_date ? new Date(row.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-medium">
                                                            {row.appointment_time?.substring(0, 5) || '--:--'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <StatusBadge 
                                                        status={
                                                            (row.status === 'Pendente' && row.appointment_date && row.appointment_time && 
                                                            new Date(`${row.appointment_date}T${row.appointment_time.length === 5 ? row.appointment_time + ':00' : row.appointment_time}-03:00`) < new Date())
                                                                ? 'Expirado' 
                                                                : (row.status === 'Confirmado' && row.appointment_date && row.appointment_time && 
                                                                new Date(new Date(`${row.appointment_date}T${row.appointment_time.length === 5 ? row.appointment_time + ':00' : row.appointment_time}-03:00`).getTime() + 60 * 60 * 1000) < new Date())
                                                                    ? 'Finalizado'
                                                                    : row.status
                                                        } 
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-light">
                                            Aguardando entrada de dados...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {recentAppointments.length > 0 && (
                        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">Registros:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-700 dark:text-slate-200 py-1.5 px-3 outline-none focus:border-primary transition-all cursor-pointer"
                                >
                                    {[5, 10, 20, 50].map(val => (
                                        <option key={val} value={val}>{val} por vez</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500 font-medium">
                                    Página {currentPage} de {Math.ceil(recentAppointments.length / itemsPerPage)}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(recentAppointments.length / itemsPerPage)))}
                                        disabled={currentPage === Math.ceil(recentAppointments.length / itemsPerPage)}
                                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal-content delay-300">
                <Card title="Mapa de Calor (90 dias)">
                    <div className="flex flex-col gap-6 py-2">
                        <div className="flex gap-4">
                            <div className="flex flex-col justify-between py-2 text-xs font-medium text-slate-400 w-8 text-right pr-2">
                                <span>08h</span>
                                <span>12h</span>
                                <span>16h</span>
                                <span>19h</span>
                            </div>

                            <div className="flex-1">
                                <div className="grid grid-cols-7 gap-2">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                                        <div key={i} className="text-xs font-medium text-slate-400 text-center mb-2">{d}</div>
                                    ))}

                                    {heatmapData.map((row, hIdx) => (
                                        row.days.map((day: any, dIdx: number) => (
                                            <div
                                                key={`${hIdx}-${dIdx}`}
                                                className="w-full h-5 rounded hover:scale-110 transition-all relative group"
                                                style={{
                                                    backgroundColor: day.count > 0 ? 'var(--color-primary)' : 'transparent',
                                                    opacity: day.count === 0 ? 0.05 : Math.max(day.intensity, 0.15),
                                                    border: day.count === 0 ? '1px solid rgba(148, 163, 184, 0.2)' : 'none'
                                                }}
                                            >
                                                {day.count > 0 && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-lg">
                                                        <span className="font-semibold">{day.count} agendamentos</span> às {row.hour}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs text-slate-500">Volume de atendimentos</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Menos</span>
                                {[0.1, 0.3, 0.5, 0.7, 1].map((op, i) => (
                                    <div key={i} className="w-4 h-4 rounded bg-primary" style={{ opacity: op }}></div>
                                ))}
                                <span className="text-xs text-slate-400">Mais</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Procedimentos Populares" extra={<button className="text-slate-400 hover:text-primary transition-all"><MoreHorizontal className="w-5 h-5" /></button>}>
                    <div className="space-y-6 pt-2">
                        {popularServices.length > 0 ? (
                            popularServices.map((service, i) => (
                                <div key={i} className="group">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${service.color} ${service.bg} transition-colors`}>
                                                <service.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-primary transition-colors">{service.name}</p>
                                                <p className="text-xs text-slate-500 font-light mt-0.5">{service.count} sessões realizadas</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{service.percent}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${service.percent}%` }}></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Scissors className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                <p className="text-sm font-light text-slate-500">Nenhum serviço analisado ainda.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
