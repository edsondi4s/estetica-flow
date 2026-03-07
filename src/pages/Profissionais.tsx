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
                return s ? s.name : '';
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
            await supabase.from('appointments').update({ pro_id: null }).eq('pro_id', confirmDelete.id);
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
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Equipe de Profissionais</h2>
                <Button onClick={() => handleOpenModal()} className="gap-2">
                    <Plus className="w-5 h-5" /> Adicionar Profissional
                </Button>
            </div>

            {/* Quick Metrics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="p-5 border-slate-200/60 dark:border-slate-800/60 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/10">
                            <Users className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-0.5">Profissionais</p>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{globalStats.activeCount}</span>
                                <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ativos</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-slate-200/60 dark:border-slate-800/60 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/10">
                            <CalendarDays className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-0.5">Atendimentos</p>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{globalStats.totalMonth}</span>
                                <span className="text-xs font-medium text-slate-400 capitalize">neste mês</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-slate-200/60 dark:border-slate-800/60 hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/10">
                            <Medal className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-0.5">Destaque do Mês</p>
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-lg font-black text-slate-900 dark:text-white truncate block">
                                    {globalStats.starPro.name}
                                </span>
                                <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded shrink-0 inline-block">
                                    {globalStats.starPro.count} atendimentos
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
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
                            <div key={pro.id} className={!pro.is_active ? 'opacity-60 grayscale-[0.5]' : ''}>
                                <Card className="relative group overflow-hidden h-full flex flex-col border-slate-200/60 dark:border-slate-800/60 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                                    <div className="flex flex-col items-start p-6 flex-1">
                                        <div className="flex justify-between items-start w-full mb-4">
                                            <div
                                                className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                                                onClick={() => fetchProStats(pro)}
                                            >
                                                {pro.photo_url ? (
                                                    <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                                                        <UserRound className="w-8 h-8 text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                <button
                                                    onClick={() => handleOpenModal(pro)}
                                                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete({ isOpen: true, id: pro.id })}
                                                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between w-full mb-1">
                                            <h3
                                                className="text-lg font-bold text-slate-900 dark:text-white hover:text-primary transition-colors cursor-pointer line-clamp-1"
                                                onClick={() => fetchProStats(pro)}
                                            >
                                                {pro.name}
                                            </h3>
                                            <button
                                                onClick={() => toggleProStatus(pro)}
                                                className={`transition-all ${pro.is_active ? 'text-green-500' : 'text-slate-300'}`}
                                                title={pro.is_active ? 'Desativar' : 'Ativar'}
                                            >
                                                <div className={`w-7 h-3.5 rounded-full relative transition-colors ${pro.is_active ? 'bg-green-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                    <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full shadow-sm transition-all ${pro.is_active ? 'left-4 bg-green-500' : 'left-0.5 bg-slate-400'}`} />
                                                </div>
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
                                            {proServices.length > 0 ? (
                                                proServices.slice(0, 3).map((sName: string, idx: number) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10 px-2 py-1 rounded-md border border-primary/10">
                                                        {sName}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sem especialidades</span>
                                            )}
                                            {proServices.length > 3 && (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                    +{proServices.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50/30 dark:bg-slate-800/20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="font-medium">Membro desde {new Date(pro.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => fetchProStats(pro)}
                                            className="h-7 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5"
                                        >
                                            Ver Perfil
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                    {professionals.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <p className="text-slate-500 dark:text-slate-400">Nenhum profissional cadastrado.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Comparative View Chart Moved Below List */}
            {globalStats.chartData.length > 0 && (
                <Card className="p-6 border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-slate-900 dark:text-white">Desempenho Comparativo (Mês Atual)</h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={globalStats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={<CustomTooltip />}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                                    {globalStats.chartData.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={index === 0 ? 'var(--primary)' : 'var(--primary-light)'}
                                            fillOpacity={1 - (index * 0.15)}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPro ? 'Editar Profissional' : 'Novo Profissional'}
                description="Cadastre um novo membro para sua equipe e atribua serviços."
            >
                <form onSubmit={handleSave} className="space-y-5 pt-2">
                    <InputField
                        label="Nome do Profissional"
                        placeholder="Ex: Dra. Juliana Costa"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Foto de Perfil</label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-8 h-8 text-slate-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                                    <Camera className="w-4 h-4" />
                                    {photoUrl ? 'Alterar Foto' : 'Selecionar Foto'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        disabled={isSaving}
                                    />
                                </label>
                                <p className="text-[10px] text-slate-500 mt-1.5">Formatos aceitos: JPG, PNG. Tamanho máx: 2MB.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 w-full">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Serviços Realizados</label>
                            <button
                                type="button"
                                onClick={() => setIsAddingService(!isAddingService)}
                                className="text-xs text-primary font-medium hover:underline"
                            >
                                {isAddingService ? 'Apenas selecionar' : '+ Criar Novo Serviço agora'}
                            </button>
                        </div>

                        {!isAddingService && (
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {services.map(s => {
                                    const isSelected = selectedServices.includes(s.id);
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${isSelected
                                                ? 'bg-primary/5 border-primary/30 dark:bg-primary/20 dark:border-primary/50'
                                                : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                                }`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={isSelected}
                                                onChange={() => toggleServiceSelection(s.id)}
                                            />
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium leading-none ${isSelected ? 'text-primary-dark dark:text-primary-light' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {s.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-1">{s.duration_minutes} min</p>
                                            </div>
                                        </label>
                                    );
                                })}
                                {services.length === 0 && (
                                    <p className="text-sm text-slate-500 italic p-2 col-span-full">Nenhum serviço cadastrado ainda.</p>
                                )}
                            </div>
                        )}

                        {isAddingService && (
                            <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl space-y-2">
                                <label className="text-xs font-semibold text-primary">Nome do novo serviço</label>
                                <input
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-primary/30 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder:text-slate-400"
                                    placeholder="Ex: Botox Facial"
                                    value={newServiceName}
                                    onChange={(e) => setNewServiceName(e.target.value)}
                                    autoFocus
                                    required={isAddingService}
                                />
                                <p className="text-[10px] text-slate-500">O serviço será salvo automaticamente com 30 min de duração e valor zero. Você poderá editá-lo depois na aba de Serviços.</p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isSaving || (!isAddingService && selectedServices.length === 0)}>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Salvar Profissional
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
                title="Perfil do Profissional"
            >
                {selectedPro && (
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-md overflow-hidden shrink-0">
                                {selectedPro.photo_url ? (
                                    <img src={selectedPro.photo_url} className="w-full h-full object-cover" alt={selectedPro.name} />
                                ) : (
                                    <User className="w-10 h-10 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedPro.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                                    <Calendar className="w-4 h-4" /> Integrante desde {new Date(selectedPro.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-2xl font-black text-primary">{proStats?.total || 0}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total de Agendamentos</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-2xl font-black text-emerald-500">{selectedPro.is_active ? 'Ativo' : 'Inativo'}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status Geral</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <PieChartIcon className="w-4 h-4 text-primary" /> Distribuição de Procedimentos
                            </h4>
                            {isLoadingStats ? (
                                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : proStats?.topServices.length > 0 ? (
                                <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="h-[120px] w-[120px] shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={proStats.topServices}
                                                    innerRadius={30}
                                                    outerRadius={50}
                                                    paddingAngle={5}
                                                    dataKey="count"
                                                >
                                                    {proStats.topServices.map((_: any, index: number) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][index % 5]}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-3 w-full">
                                        {proStats.topServices.map((s: any, i: number) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                    <span className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#db2777', '#9333ea', '#2563eb', '#059669', '#d97706'][i % 5] }} />
                                                        {s.name}
                                                    </span>
                                                    <span>{Math.round((s.count / proStats.total) * 100)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
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
                                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Scissors className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-500">Nenhum procedimento registrado ainda.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedPro(null)}>Fechar</Button>
                            <Button className="flex-1" onClick={() => { setSelectedPro(null); handleOpenModal(selectedPro); }}>
                                Editar Perfil
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
