import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, UserRound, Award, Check, Camera, TrendingUp, Calendar, Scissors, User, Medal, Users, CalendarDays, PieChart as PieChartIcon, BarChart3, Sparkles } from 'lucide-react';
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
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
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
                    <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
                        Nossa <span className="text-primary">Equipe</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-2">Gerencie seus profissionais e acompanhe a performance.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 h-11 px-6 rounded-xl font-medium shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
                    <Plus className="w-4 h-4" /> Novo Profissional
                </Button>
            </div>            {/* Métricas de Performance da Equipe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
                            <Users className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-500 mb-1">Profissionais Ativos</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-serif font-bold text-slate-900 dark:text-white">{globalStats.activeCount}</span>
                                <span className="text-xs font-medium text-emerald-500">Em Dia</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
                            <CalendarDays className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-500 mb-1">Volume Mensal</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-serif font-bold text-slate-900 dark:text-white">{globalStats.totalMonth}</span>
                                <span className="text-xs font-medium text-slate-400">Atendimentos</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 p-6 rounded-luxury border border-primary/20 shadow-sm relative overflow-hidden group sm:col-span-2 lg:col-span-1">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12">
                            <Medal className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-primary mb-1">Destaque do Mês</p>
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-xl font-serif font-bold text-slate-900 dark:text-white truncate block group-hover:translate-x-1 transition-transform">
                                    {globalStats.starPro.name || '---'}
                                </span>
                                <span className="text-xs font-medium text-slate-500">
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
                            <div key={pro.id} className={`${!pro.is_active ? 'opacity-50 grayscale' : ''} group`}>
                                <div className="relative bg-white dark:bg-slate-950 p-6 rounded-luxury border border-slate-100 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-500 overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>

                                    <div className="flex flex-col relative z-10 h-full">
                                        <div className="flex justify-between items-start w-full mb-6 relative">
                                            <div
                                                className="w-20 h-20 rounded-[20px] bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden relative z-20"
                                                onClick={() => fetchProStats(pro)}
                                            >
                                                {pro.photo_url ? (
                                                    <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                                                        <UserRound className="w-8 h-8 text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(pro)}
                                                    className="w-9 h-9 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-primary hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"
                                                    title="Editar Perfil"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: pro.id })}
                                                    className="w-9 h-9 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"
                                                    title="Desligar Profissional"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="w-full mb-5">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3
                                                    className="text-xl font-serif font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer"
                                                    onClick={() => fetchProStats(pro)}
                                                >
                                                    {pro.name}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-slate-500">{pro.specialty || 'Clínica Geral'}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {proServices.length > 0 ? (
                                                proServices.slice(0, 3).map((sName: string, idx: number) => (
                                                    <span key={idx} className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                                                        {sName}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs font-medium text-slate-400">Geral</span>
                                            )}
                                            {proServices.length > 3 && (
                                                <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-lg">
                                                    +{proServices.length - 3}
                                                </span>
                                            )}
                                        </div>

                                        <div className="w-full mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-between items-center">
                                            <button
                                                onClick={() => toggleProStatus(pro)}
                                                className={`flex items-center gap-2 text-xs font-medium transition-colors ${pro.is_active ? 'text-emerald-500' : 'text-slate-400'}`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${pro.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.25)]' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                                {pro.is_active ? 'Ativo' : 'Inativo'}
                                            </button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => fetchProStats(pro)}
                                                className="h-8 text-xs font-medium text-primary hover:bg-primary/5 rounded-xl px-3"
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
                        <div className="col-span-full py-24 text-center bg-white dark:bg-slate-950 rounded-luxury border border-slate-100 dark:border-slate-800/60 shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 flex items-center justify-center rounded-2xl mx-auto mb-4">
                                <UserRound className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-lg font-serif text-slate-700 dark:text-slate-300">Nenhum profissional cadastrado</p>
                            <p className="text-sm text-slate-500 mt-2">Comece adicionando seu primeiro membro da equipe</p>
                        </div>
                    )}
                </div>
            )}

            {/* Comparative View Chart Moved Below List */}
            {globalStats.chartData.length > 0 && (
                <div className="bg-white dark:bg-slate-950 p-8 rounded-luxury border border-slate-100 dark:border-slate-800/60 shadow-sm reveal-content">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Relatório de <span className="text-primary">Performance</span></h3>
                            <p className="text-sm text-slate-500 mt-1">Atividade Mensal por Profissional</p>
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
                                    tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'transparent' }}
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
                <form onSubmit={handleSave} className="space-y-6 pt-4">
                    {/* 1. Foto de Perfil */}
                    <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[24px] border border-slate-100 dark:border-slate-800/60 shadow-sm transition-all hover:border-primary/20 group">
                        <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-900 shadow-lg group-hover:scale-105 transition-transform duration-300 shrink-0">
                            {photoUrl ? (
                                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 pl-1">Foto de Perfil</label>
                            <label className="inline-flex items-center justify-center gap-2 px-6 py-3 border-dashed bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-[16px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 transition-all text-sm group-hover:text-primary group-hover:border-primary/40 w-full sm:w-auto">
                                <Camera className="w-4 h-4" />
                                {photoUrl ? 'Substituir Foto' : 'Fazer Upload'}
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

                    {/* 2. Nome */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1">Nome do Profissional</label>
                        <input
                            placeholder="Nome completo"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[20px] text-[15px] font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            required
                        />
                    </div>

                    {/* 3. Especialidades */}
                    <div>
                        <div className="flex justify-between items-center mb-3 px-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Especialidades</label>
                            <button
                                type="button"
                                onClick={() => setIsAddingService(!isAddingService)}
                                className="text-xs text-primary font-bold hover:text-emerald-500 transition-colors uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-lg"
                            >
                                {isAddingService ? 'Selecionar da Lista' : '+ Novo Serviço'}
                            </button>
                        </div>

                        {!isAddingService && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[24px] border border-slate-100 dark:border-slate-800/60 p-3 h-[184px] overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {services.map(s => {
                                        const isSelected = selectedServices.includes(s.id);
                                        return (
                                            <label
                                                key={s.id}
                                                className={`flex items-center justify-between p-3.5 rounded-[16px] cursor-pointer transition-all border ${isSelected
                                                    ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                                                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isSelected}
                                                    onChange={() => toggleServiceSelection(s.id)}
                                                />
                                                <p className={`text-[14px] font-semibold truncate ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {s.name}
                                                </p>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-primary border-primary' : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700'}`}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {services.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                            <Sparkles className="w-6 h-6 text-slate-400 mb-2" />
                                            <p className="text-xs font-semibold text-slate-500">Nenhum serviço cadastrado.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {isAddingService && (
                            <div className="space-y-2 animate-in fade-in zoom-in-95 mt-2">
                                <input
                                    className="w-full px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-[20px] text-[15px] font-medium outline-none text-slate-900 dark:text-white placeholder:text-slate-400 transition-all shadow-sm"
                                    placeholder="Nome do novo procedimento"
                                    value={newServiceName}
                                    onChange={(e) => setNewServiceName(e.target.value)}
                                    autoFocus
                                    required={isAddingService}
                                />
                                <p className="text-[11px] font-medium text-slate-500 px-2 mt-2">
                                    Pressione Salvar para cadastrar o profissional e incluir este novo serviço na clínica simultaneamente.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 flex gap-4 border-t border-slate-100 dark:border-slate-800/60 mt-8">
                        <Button type="button" variant="outline" className="flex-1 rounded-[16px] h-14 text-slate-600 dark:text-slate-300 font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[15px]" onClick={() => setShowModal(false)}>
                            Cancelar Operação
                        </Button>
                        <Button type="submit" className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:-translate-y-0.5 border-none rounded-[16px] h-14 font-semibold shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-[15px] transition-all" disabled={isSaving || (!isAddingService && selectedServices.length === 0)}>
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingPro ? 'Atualizar Profissional' : 'Finalizar Cadastro')}
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
                title="Desempenho da Equipe"
            >
                {selectedPro && (
                    <div className="space-y-6 pt-2">
                        <div className="flex flex-col md:flex-row items-center gap-6 bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                            <div className="w-24 h-24 rounded-[24px] bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-500">
                                {selectedPro.photo_url ? (
                                    <img src={selectedPro.photo_url} className="w-full h-full object-cover" alt={selectedPro.name} />
                                ) : (
                                    <User className="w-10 h-10 text-slate-400" />
                                )}
                            </div>
                            <div className="text-center md:text-left relative z-10 w-full">
                                <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-1">{selectedPro.name}</h3>
                                <p className="text-sm font-medium text-primary flex items-center justify-center md:justify-start gap-2">
                                    <Award className="w-4 h-4" /> Profissional Nível Superior
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center text-center">
                                <p className="text-4xl font-serif font-bold text-slate-900 dark:text-white mb-1">{proStats?.total || 0}</p>
                                <p className="text-xs font-medium text-slate-500">Procedimentos Realizados</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center text-center">
                                <p className="text-4xl font-serif font-bold text-emerald-500 mb-1">100%</p>
                                <p className="text-xs font-medium text-slate-500">SLA de Qualidade</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-4">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                Distribuição de Serviços
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
                                                <div className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][i % 5] }} />
                                                        {s.name}
                                                    </span>
                                                    <span className="text-slate-900 dark:text-white">{Math.round((s.count / proStats.total) * 100)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
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
                                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <Scissors className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-slate-500">Nenhum atendimento registrado</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 flex gap-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                            <Button variant="outline" className="flex-1 rounded-xl h-11 text-slate-600 dark:text-slate-300 font-medium" onClick={() => setSelectedPro(null)}>Fechar</Button>
                            <Button className="flex-1 bg-primary hover:bg-emerald-600 text-white border-none rounded-xl h-11 font-medium shadow-md shadow-primary/20" onClick={() => { setSelectedPro(null); handleOpenModal(selectedPro); }}>
                                Editar Perfil
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
