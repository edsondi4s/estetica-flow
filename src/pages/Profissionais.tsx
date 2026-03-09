import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, UserRound, Award, Check, Camera, TrendingUp, Calendar, Scissors, User, Medal, Users, CalendarDays, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image-utils';
import toast from 'react-hot-toast';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {payload[0].value} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">atendimentos</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export const Profissionais = () => {
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingPro, setEditingPro] = useState<any>(null);
    const [selectedPro, setSelectedPro] = useState<any>(null);
    const [proStats, setProStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // New global metrics states
    const [globalStats, setGlobalStats] = useState({
        totalMonth: 0,
        activeCount: 0,
        starPro: { name: '', count: 0, photo: '' },
        chartData: [] as any[]
    });

    // Form states
    const [name, setName] = useState('');
    const [services, setServices] = useState<any[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [isAddingService, setIsAddingService] = useState(false);
    const [newServiceName, setNewServiceName] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');

    // Confirmation Modal state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    useEffect(() => {
        fetchProfessionals();
        fetchServices();
        fetchGlobalMetrics();
    }, []);

    const fetchGlobalMetrics = async () => {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { data: monthApps, error } = await supabase
                .from('appointments')
                .select('professional_id, professionals(name, photo_url)')
                .gte('appointment_date', startOfMonth.toISOString().split('T')[0])
                .not('status', 'eq', 'Cancelado');

            if (error) throw error;

            const counts: { [key: string]: { count: number, name: string, photo: string } } = {};
            monthApps?.forEach((a: any) => {
                if (!a.professional_id || !a.professionals) return;
                const id = a.professional_id;
                if (!counts[id]) {
                    counts[id] = { count: 0, name: a.professionals.name, photo: a.professionals.photo_url };
                }
                counts[id].count++;
            });

            const sorted = Object.entries(counts)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => b.count - a.count);

            const star = sorted.length > 0 ? sorted[0] : { name: '---', count: 0, photo: '' };

            setGlobalStats(prev => ({
                ...prev,
                totalMonth: monthApps?.length || 0,
                starPro: star,
                chartData: sorted.slice(0, 5)
            }));
        } catch (error) {
            console.error('Erro ao buscar métricas globais:', error);
        }
    };

    const fetchServices = async () => {
        try {
            const { data, error } = await supabase.from('services').select('*').order('name');
            if (!error && data) setServices(data);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
        }
    };

    const fetchProfessionals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select(`
                    *,
                    professional_services (
                        service_id,
                        services ( id, name )
                    )
                `)
                .order('name');
            if (error) throw error;
            const pros = data || [];
            setProfessionals(pros);

            // Update active count in global stats
            setGlobalStats(prev => ({
                ...prev,
                activeCount: pros.filter((p: any) => p.is_active).length
            }));
        } catch (error) {
            console.error('Erro ao buscar profissionais:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (pro: any = null) => {
        if (pro) {
            setEditingPro(pro);
            setName(pro.name);
            const proServices = pro.professional_services?.map((ps: any) => ps.service_id) || [];
            setSelectedServices(proServices);
            setIsAddingService(false);
            setNewServiceName('');
            setPhotoUrl(pro.photo_url || '');
        } else {
            setEditingPro(null);
            setName('');
            setSelectedServices([]);
            setIsAddingService(false);
            setNewServiceName('');
            setPhotoUrl('');
        }
        setShowModal(true);
    };

    const fetchProStats = async (pro: any) => {
        setSelectedPro(pro);
        setIsLoadingStats(true);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('service_id, services(name)')
                .eq('professional_id', pro.id)
                .not('status', 'eq', 'Cancelado');

            if (error) throw error;

            const counts: { [key: string]: number } = {};
            data?.forEach((a: any) => {
                const sName = a.services?.name;
                if (sName) counts[sName] = (counts[sName] || 0) + 1;
            });

            const sorted = Object.entries(counts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            setProStats({
                total: data?.length || 0,
                topServices: sorted.slice(0, 5)
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const toggleServiceSelection = (serviceId: string) => {
        if (selectedServices.includes(serviceId)) {
            setSelectedServices(selectedServices.filter(id => id !== serviceId));
        } else {
            setSelectedServices([...selectedServices, serviceId]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        setIsSaving(true);
        try {
            // Compress and convert to WebP
            const compressedBlob = await compressImage(file, 800, 0.7);
            const fileName = `${Math.random()}.webp`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('professional-photos')
                .upload(filePath, compressedBlob, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('professional-photos')
                .getPublicUrl(filePath);

            setPhotoUrl(publicUrl);
            toast.success('Foto carregada com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao fazer upload: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let finalSelectedServices = [...selectedServices];

            if (isAddingService && newServiceName.trim()) {
                const { data: newServiceData, error: serviceError } = await supabase
                    .from('services')
                    .insert([{
                        name: newServiceName.trim(),
                        price: 0,
                        duration_minutes: 30,
                        category: 'Especialidade'
                    }])
                    .select('id')
                    .single();
                if (serviceError) throw serviceError;

                finalSelectedServices.push(newServiceData.id);
                fetchServices();
            }

            const specialtyList = finalSelectedServices.map(sid => {
                const s = services.find(sv => sv.id === sid);
                if (s) return s.name;
                if (isAddingService && newServiceName.trim()) return newServiceName.trim();
                return '';
            }).filter(Boolean);

            const proData = {
                name,
                specialty: specialtyList.length > 0 ? specialtyList[0] : '',
                photo_url: photoUrl
            };
            let proId = editingPro ? editingPro.id : null;

            if (editingPro) {
                const { error } = await supabase.from('professionals').update(proData).eq('id', proId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('professionals').insert([proData]).select('id').single();
                if (error) throw error;
                proId = data.id;
            }

            if (editingPro) {
                await supabase.from('professional_services').delete().eq('professional_id', proId);
            }

            if (finalSelectedServices.length > 0) {
                const pivotInserts = finalSelectedServices.map(serviceId => ({
                    professional_id: proId,
                    service_id: serviceId
                }));
                const { error: pivotError } = await supabase.from('professional_services').insert(pivotInserts);
                if (pivotError) throw pivotError;
            }

            setShowModal(false);
            fetchProfessionals();
            toast.success(`Profissional ${editingPro ? 'atualizado' : 'cadastrado'} com sucesso!`);
        } catch (error: any) {
            toast.error('Erro ao salvar profissional: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleProStatus = async (pro: any) => {
        try {
            const { error } = await supabase
                .from('professionals')
                .update({ is_active: !pro.is_active })
                .eq('id', pro.id);
            if (error) throw error;
            fetchProfessionals();
            toast.success(`Status de ${pro.name} alterado!`);
        } catch (error: any) {
            toast.error('Erro ao alterar status: ' + error.message);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.id) return;

        try {
            await supabase.from('appointments').update({ professional_id: null }).eq('professional_id', confirmDelete.id);
            const { error } = await supabase.from('professionals').delete().eq('id', confirmDelete.id);
            if (error) throw error;

            setConfirmDelete({ isOpen: false, id: null });
            fetchProfessionals();
            toast.success('Profissional removido com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col gap-10 reveal-content">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                        Nossa <span className="text-primary">Equipe</span>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Gerencie seus profissionais e performance</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 bg-slate-950 hover:bg-primary border-none shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 rounded-sm font-black uppercase text-[10px] tracking-widest whitespace-nowrap py-6 px-8">
                    <Plus className="w-4 h-4" /> Novo Profissional
                </Button>
            </div>

            {/* Métricas de Performance da Equipe - Silk & Steel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-black/5 group hover:border-primary transition-all">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-sm bg-slate-950 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                            <Users className="w-8 h-8" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Profissionais Ativos</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter">{globalStats.activeCount}</span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Em Dia</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-black/5 group hover:border-primary transition-all">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-sm bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                            <CalendarDays className="w-8 h-8" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Mensal</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter">{globalStats.totalMonth}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Check-ins</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-8 rounded-sm border-2 border-slate-100 dark:border-slate-900 shadow-2xl group hover:border-primary transition-all sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-sm bg-primary flex items-center justify-center text-slate-950 shrink-0 transition-transform group-hover:rotate-12">
                            <Medal className="w-8 h-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Destaque do Mês</p>
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-xl font-black text-slate-950 dark:text-white tracking-tight truncate block group-hover:translate-x-1 transition-transform">
                                    {globalStats.starPro.name}
                                </span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {globalStats.starPro.count} Atendimentos
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {professionals.map((pro) => {
                        const proServices = pro.professional_services?.map((ps: any) => ps.services?.name).filter(Boolean) || [];

                        return (
                            <div key={pro.id} className={`${!pro.is_active ? 'opacity-40 grayscale' : ''} group`}>
                                <div className="relative bg-white dark:bg-slate-900 p-8 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-black/5 hover:border-primary hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all"></div>

                                    <div className="flex flex-col items-start relative z-10">
                                        <div className="flex justify-between items-start w-full mb-8">
                                            <div
                                                className="w-20 h-20 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-slate-50 dark:border-slate-950 shadow-2xl cursor-pointer hover:ring-2 hover:ring-primary transition-all overflow-hidden"
                                                onClick={() => fetchProStats(pro)}
                                            >
                                                {pro.photo_url ? (
                                                    <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                                                        <UserRound className="w-10 h-10 text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(pro)}
                                                    className="p-3 bg-slate-950 text-white rounded-sm hover:bg-primary transition-all shadow-xl shadow-black/20"
                                                    title="Editar Perfil"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: pro.id })}
                                                    className="p-3 bg-red-100 text-red-500 rounded-sm hover:bg-red-500 hover:text-white transition-all shadow-xl"
                                                    title="Desligar Profissional"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="w-full mb-6">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3
                                                    className="text-2xl font-black uppercase tracking-tighter text-slate-950 dark:text-white group-hover:text-primary transition-colors cursor-pointer leading-none"
                                                    onClick={() => fetchProStats(pro)}
                                                >
                                                    {pro.name}
                                                </h3>
                                                <button
                                                    onClick={() => toggleProStatus(pro)}
                                                    className={`transition-all hover:scale-110 active:scale-95 ${pro.is_active ? 'text-primary' : 'text-slate-400'}`}
                                                    title={pro.is_active ? 'Desativar Profissional' : 'Ativar Profissional'}
                                                >
                                                    <div className={`w-10 h-4 rounded-sm border-2 relative transition-all ${pro.is_active ? 'bg-primary/10 border-primary' : 'bg-slate-200 border-slate-400'}`}>
                                                        <div className={`absolute top-0.5 w-2 h-2 rounded-none transition-all ${pro.is_active ? 'left-6 bg-primary animate-pulse' : 'left-0.5 bg-slate-500'}`} />
                                                    </div>
                                                </button>
                                            </div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">[ Disponibilidade Total ]</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-8">
                                            {proServices.length > 0 ? (
                                                proServices.slice(0, 3).map((sName: string, idx: number) => (
                                                    <span key={idx} className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-sm border border-slate-100 dark:border-slate-800 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                                        {sName}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-300 uppercase">Geralista</span>
                                            )}
                                            {proServices.length > 3 && (
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-sm">
                                                    +{proServices.length - 3}
                                                </span>
                                            )}
                                        </div>

                                        <div className="w-full pt-6 border-t-2 border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-none animate-ping" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desde {new Date(pro.created_at).getFullYear()}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => fetchProStats(pro)}
                                                className="h-8 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/5"
                                            >
                                                Ver Performance
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {professionals.length === 0 && (
                        <div className="col-span-full py-24 text-center bg-slate-50 dark:bg-slate-900/50 rounded-sm border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <UserRound className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de dados vazia</p>
                        </div>
                    )}
                </div>
            )}

            {/* Comparative View Chart Moved Below List */}
            {globalStats.chartData.length > 0 && (
                <div className="bg-white dark:bg-slate-950 p-10 rounded-sm border-2 border-slate-100 dark:border-slate-900 shadow-2xl reveal-content">
                    <div className="flex items-center gap-3 mb-10">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        <div>
                            <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter">Relatório de <span className="text-primary">Performance</span></h3>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Atividade Mensal por Profissional</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={globalStats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b', textTransform: 'uppercase' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                />
                                <Bar dataKey="count" radius={[0, 0, 0, 0]} barSize={50}>
                                    {globalStats.chartData.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={index === 0 ? 'var(--primary)' : 'currentColor'}
                                            className="text-slate-200 dark:text-slate-800"
                                            stroke="none"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPro ? 'Editar Profissional' : 'Novo Profissional'}
                description="Cadastre um novo membro para sua equipe e atribua serviços."
            >
                <form onSubmit={handleSave} className="space-y-4 pt-2">
                    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800 focus-within:border-primary transition-all">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nome do Profissional</label>
                        <input
                            placeholder="NOME COMPLETO"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter placeholder:text-slate-200 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Foto de Ativo</label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-sm bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-sm cursor-pointer hover:bg-primary transition-all shadow-lg shadow-black/20">
                                        <Camera className="w-4 h-4" />
                                        {photoUrl ? 'Substituir' : 'Upload'}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            disabled={isSaving}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Serviços que realiza</label>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingService(!isAddingService)}
                                    className="text-[9px] text-primary font-black uppercase tracking-widest hover:underline"
                                >
                                    {isAddingService ? '[ Selecionar ]' : '[ Criar Novo ]'}
                                </button>
                            </div>

                            {!isAddingService && (
                                <div className="max-h-32 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                    {services.map(s => {
                                        const isSelected = selectedServices.includes(s.id);
                                        return (
                                            <label
                                                key={s.id}
                                                className={`flex items-center gap-3 p-3 rounded-sm cursor-pointer transition-all border-2 ${isSelected
                                                    ? 'bg-primary border-primary text-slate-950'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isSelected}
                                                    onChange={() => toggleServiceSelection(s.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-widest truncate">
                                                        {s.name}
                                                    </p>
                                                </div>
                                                {isSelected && <Check className="w-3 h-3 font-black" />}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {isAddingService && (
                                <div className="space-y-2">
                                    <input
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-primary rounded-sm text-[10px] font-black uppercase tracking-widest outline-none text-slate-950 dark:text-white placeholder:text-slate-200"
                                        placeholder="Nome do Serviço"
                                        value={newServiceName}
                                        onChange={(e) => setNewServiceName(e.target.value)}
                                        autoFocus
                                        required={isAddingService}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-8 flex gap-4 border-t-2 border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" className="flex-1 rounded-sm border-2 border-slate-200 font-black uppercase text-[10px] tracking-widest py-6" onClick={() => setShowModal(false)}>
                            Descartar
                        </Button>
                        <Button type="submit" className="flex-1 bg-slate-950 hover:bg-primary border-none text-white rounded-sm font-black uppercase text-[10px] tracking-widest py-6 shadow-xl shadow-black/20" disabled={isSaving || (!isAddingService && selectedServices.length === 0)}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Profissional'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Remover Profissional"
                message="Tem certeza que deseja remover este profissional? Todos os agendamentos vinculados a ele serão mantidos sem profissional designado."
                confirmLabel="Sim, Remover"
                cancelLabel="Não, Cancelar"
            />

            <Modal
                isOpen={!!selectedPro}
                onClose={() => setSelectedPro(null)}
                title="DESEMPENHO DO PROFISSIONAL"
            >
                {selectedPro && (
                    <div className="space-y-8 pt-4">
                        <div className="flex flex-col md:flex-row items-center gap-8 bg-white dark:bg-slate-950 p-8 rounded-sm shadow-2xl relative overflow-hidden group border-2 border-slate-100 dark:border-slate-800">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                            <div className="w-32 h-32 rounded-sm bg-slate-50 dark:bg-slate-900 flex items-center justify-center border-4 border-slate-100 dark:border-slate-900 shadow-2xl overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-500">
                                {selectedPro.photo_url ? (
                                    <img src={selectedPro.photo_url} className="w-full h-full object-cover" alt={selectedPro.name} />
                                ) : (
                                    <User className="w-16 h-16 text-slate-700" />
                                )}
                            </div>
                            <div className="text-center md:text-left relative z-10">
                                <h3 className="text-3xl font-black text-slate-950 dark:text-white uppercase tracking-tighter">{selectedPro.name}</h3>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] mt-2 flex items-center justify-center md:justify-start gap-2">
                                    <Award className="w-4 h-4" /> Nível Especialista
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                                <p className="text-5xl font-black text-slate-950 dark:text-white tracking-tighter leading-none mb-2">{proStats?.total || 0}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedimentos Totais</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-sm border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                                <p className="text-5xl font-black text-emerald-500 tracking-tighter leading-none mb-2">100%</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SLA de Qualidade</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-sm border-2 border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                                <div className="w-4 h-0.5 bg-primary"></div> Distribuição de Atendimentos
                            </h4>
                            {isLoadingStats ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : proStats?.topServices.length > 0 ? (
                                <div className="flex flex-col md:flex-row items-center gap-10">
                                    <div className="h-[180px] w-[180px] shrink-0 transform hover:rotate-3 transition-transform">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={proStats.topServices}
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={2}
                                                    dataKey="count"
                                                    stroke="none"
                                                >
                                                    {proStats.topServices.map((_: any, index: number) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][index % 5]}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-4 w-full">
                                        {proStats.topServices.map((s: any, i: number) => (
                                            <div key={i} className="flex flex-col gap-2">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                                                    <span className="flex items-center gap-3">
                                                        <div className="w-3 h-3 rounded-none" style={{ backgroundColor: ['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][i % 5] }} />
                                                        {s.name}
                                                    </span>
                                                    <span className="text-slate-950 dark:text-white">{Math.round((s.count / proStats.total) * 100)}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-none overflow-hidden">
                                                    <div
                                                        className="h-full"
                                                        style={{
                                                            width: `${(s.count / proStats.total) * 100}%`,
                                                            backgroundColor: ['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][i % 5]
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <Scissors className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum atendimento registrado</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-8 flex gap-4 border-t-2 border-slate-100 dark:border-slate-800">
                            <Button variant="outline" className="flex-1 rounded-sm border-2 border-slate-200 font-black uppercase text-[10px] tracking-widest py-6" onClick={() => setSelectedPro(null)}>Fechar Dash</Button>
                            <Button className="flex-1 bg-slate-950 hover:bg-primary border-none text-white rounded-sm font-black uppercase text-[10px] tracking-widest py-6 shadow-xl shadow-black/20" onClick={() => { setSelectedPro(null); handleOpenModal(selectedPro); }}>
                                Editar Perfil
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
