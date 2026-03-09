import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, Plus, Loader2, X, Trash2, Edit2, Search, Filter, SlidersHorizontal, MessageCircle, Save } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatToISODate = (date: Date) => {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
};

export const Agenda = () => {
    const { addNotification } = useNotifications();
    const { settings } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
    const [view, setView] = useState<'day' | 'week' | 'month'>('week');
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [conflictAppointments, setConflictAppointments] = useState<any[]>([]);
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [filters, setFilters] = useState({
        status: [] as string[],
        professionals: [] as string[],
        services: [] as string[]
    });

    // Confirmation Modal state
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });

    const [confirmMove, setConfirmMove] = useState<{
        isOpen: boolean;
        appointment: any;
        newDate: string;
        newTime: string;
    }>({
        isOpen: false,
        appointment: null,
        newDate: '',
        newTime: ''
    });

    // Context states
    const [currentDate, setCurrentDate] = useState(new Date());

    // Form states
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedProId, setSelectedProId] = useState('');
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('09:00');
    const [newClientName, setNewClientName] = useState('');
    const [isAddingClient, setIsAddingClient] = useState(false);

    const [professionals, setProfessionals] = useState<any[]>([]);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [businessHours, setBusinessHours] = useState<any[]>([]);
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

    const isPastSlot = (dateString: string, timeString?: string) => {
        const now = new Date();
        const currentDateString = formatToISODate(now);

        if (dateString < currentDateString) {
            return true;
        }

        if (dateString === currentDateString && timeString) {
            const currentTimeString = now.toTimeString().substring(0, 5);
            if (timeString < currentTimeString) {
                return true;
            }
        }
        return false;
    };

    useEffect(() => {
        if (isModalOpen || isFilterPanelOpen) fetchFormData();
    }, [isModalOpen, isFilterPanelOpen]);

    useEffect(() => {
        fetchAppointments();
    }, [currentDate, view]);

    const fetchFormData = async () => {
        try {
            const [
                { data: clientsData, error: clientsError },
                { data: servicesData, error: servicesError },
                { data: prosData, error: prosError },
                { data: bhData, error: bhError },
                { data: addressesData, error: addressesError }
            ] = await Promise.all([
                supabase.from('clients').select('id, name').order('name'),
                supabase.from('services').select('id, name, duration_minutes').eq('is_active', true).order('name'),
                supabase.from('professionals').select('id, name, is_active, professional_services(service_id)').eq('is_active', true).order('name'),
                supabase.from('business_hours').select('*'),
                supabase.from('addresses').select('id, street, number, city, state, is_main').order('is_main', { ascending: false })
            ]);

            if (clientsError) console.error('Error fetching clients:', clientsError);
            if (servicesError) console.error('Error fetching services:', servicesError);
            if (prosError) console.error('Error fetching professionals:', prosError);

            setClients(clientsData || []);
            setServices(servicesData || []);
            setProfessionals(prosData || []);
            setBusinessHours(bhData || []);

            const adds = addressesData || [];
            setAddresses(adds);
            if (adds.length > 0 && !editingAppointmentId) {
                setSelectedAddressId(adds.find((a: any) => a.is_main)?.id || adds[0].id);
            }
        } catch (error: any) {
            console.error('Fatal error in fetchFormData:', error.message);
            toast.error('Erro ao sincronizar dados do sistema.');
        }
    };

    const filteredProfessionals = React.useMemo(() => {
        if (!selectedServiceId) return professionals;
        return professionals.filter(p => p.professional_services?.some((ps: any) => ps.service_id === selectedServiceId));
    }, [professionals, selectedServiceId]);

    const filteredServices = React.useMemo(() => {
        if (!selectedProId) return services;
        const pro = professionals.find(p => p.id === selectedProId);
        if (!pro || !pro.professional_services) return services;
        const validServiceIds = pro.professional_services.map((ps: any) => ps.service_id);
        return services.filter(s => validServiceIds.includes(s.id));
    }, [services, professionals, selectedProId]);

    const fetchAppointments = async () => {
        setIsLoadingAppointments(true);
        try {
            let start = new Date(currentDate);
            let end = new Date(currentDate);

            if (view === 'day') {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
            } else if (view === 'week') {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
            } else if (view === 'month') {
                start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const firstDayOfWeek = start.getDay();
                start.setDate(start.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

                end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                const remaining = 42 - (Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                if (remaining > 0) end.setDate(end.getDate() + remaining);
                end.setHours(23, 59, 59, 999);
            }

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    clients(name, phone),
                    services(name, duration_minutes, price),
                    professionals(name)
                `)
                .gte('appointment_date', formatToISODate(start))
                .lte('appointment_date', formatToISODate(end));

            if (error) throw error;
            setAppointments(data || []);
        } catch (error: any) {
            console.error('Erro ao buscar agendamentos:', error.message);
        } finally {
            setIsLoadingAppointments(false);
        }
    };

    const filteredAppointments = React.useMemo(() => {
        return appointments.filter(app => {
            const matchesSearch = searchTerm === '' ||
                app.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.services?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.professionals?.name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = filters.status.length === 0 || filters.status.includes(app.status);
            const matchesPro = filters.professionals.length === 0 || filters.professionals.includes(app.professional_id);
            const matchesService = filters.services.length === 0 || filters.services.includes(app.service_id);

            return matchesSearch && matchesStatus && matchesPro && matchesService;
        });
    }, [appointments, searchTerm, filters]);

    const activeFilterCount = (filters.status.length > 0 ? 1 : 0) +
        (filters.professionals.length > 0 ? 1 : 0) +
        (filters.services.length > 0 ? 1 : 0);

    const handleOpenEditModal = (app: any) => {
        setEditingAppointmentId(app.id);
        setSelectedClientId(app.client_id);
        setSelectedServiceId(app.service_id);
        setSelectedProId(app.professional_id);
        setSelectedAddressId(app.address_id || '');
        setDate(app.appointment_date);
        setTime(app.appointment_time.substring(0, 5));
        setNewClientName('');
        setIsAddingClient(false);
        setIsModalOpen(true);
        setSelectedAppointment(null);
    };

    const handleDeleteAppointment = async () => {
        if (!confirmDelete.id) return;

        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', confirmDelete.id);
            if (error) throw error;

            setConfirmDelete({ isOpen: false, id: null });
            setSelectedAppointment(null);
            fetchAppointments();
            toast.success('Agendamento cancelado com sucesso!');
        } catch (error: any) {
            toast.error('Erro ao excluir agendamento: ' + error.message);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            toast.success(`Status atualizado para ${newStatus}`);

            // Update local state for immediate feedback
            setSelectedAppointment((prev: any) => prev ? { ...prev, status: newStatus } : null);
            fetchAppointments();
        } catch (error: any) {
            toast.error('Erro ao atualizar status: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!date || !selectedProId || !selectedServiceId || businessHours.length === 0) {
            setAvailableTimes([]);
            return;
        }

        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const bh = businessHours.find(b => b.day_of_week === dayOfWeek);

        if (!bh || !bh.is_working_day) {
            setAvailableTimes([]);
            setTime('');
            return;
        }

        const service = services.find(s => s.id === selectedServiceId);
        const duration = service ? service.duration_minutes : 30;

        const proAppointments = appointments.filter(a =>
            a.professional_id === selectedProId &&
            a.appointment_date === date &&
            a.status !== 'Cancelado' &&
            a.id !== editingAppointmentId
        );

        let slots: string[] = [];
        let currTime = new Date(date + 'T' + bh.start_time);
        const endTime = new Date(date + 'T' + bh.end_time);
        const maxStartTime = new Date(endTime.getTime() - duration * 60000);

        while (currTime <= maxStartTime) {
            const slotStart = new Date(currTime);
            const slotEnd = new Date(currTime.getTime() + duration * 60000);

            let hasConflict = false;
            for (const app of proAppointments) {
                const appStart = new Date(date + 'T' + app.appointment_time);
                const appEnd = new Date(appStart.getTime() + (app.services?.duration_minutes || 60) * 60000);

                if (slotStart < appEnd && slotEnd > appStart) {
                    hasConflict = true;
                    break;
                }
            }

            const now = new Date();
            const isToday = dateObj.toDateString() === now.toDateString();
            if (isToday && slotStart < now) {
                hasConflict = true;
            }

            if (!hasConflict) {
                slots.push(slotStart.toTimeString().substring(0, 5));
            }

            currTime = new Date(currTime.getTime() + 30 * 60000);
        }

        setAvailableTimes(slots);

        if (time && slots.includes(time)) {
        } else if (slots.length > 0 && !editingAppointmentId) {
            setTime(slots[0]);
        } else if (!slots.includes(time) && editingAppointmentId) {
            slots.push(time);
            slots.sort();
            setAvailableTimes(slots);
        } else {
            setTime('');
        }

    }, [date, selectedProId, selectedServiceId, appointments, businessHours, editingAppointmentId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let clientId = selectedClientId;

            if (isAddingClient && newClientName) {
                const { data: newClient, error: clientError } = await supabase
                    .from('clients')
                    .insert({ name: newClientName })
                    .select()
                    .single();

                if (clientError) throw clientError;
                clientId = newClient.id;
            }

            if (!clientId) throw new Error('Selecione ou cadastre um cliente.');
            if (!selectedServiceId) throw new Error('Selecione um serviço.');
            if (!selectedProId) throw new Error('Selecione um profissional.');
            if (!time) throw new Error('Selecione um horário válido.');

            const { data: conflict } = await supabase
                .from('appointments')
                .select('id')
                .eq('professional_id', selectedProId)
                .eq('appointment_date', date)
                .eq('appointment_time', time)
                .not('status', 'eq', 'Cancelado')
                .neq('id', editingAppointmentId || '00000000-0000-0000-0000-000000000000')
                .maybeSingle();

            if (conflict) {
                throw new Error('Este profissional já possui um agendamento neste horário.');
            }

            const appData = {
                client_id: clientId,
                service_id: selectedServiceId,
                professional_id: selectedProId,
                address_id: selectedAddressId || null,
                appointment_date: date,
                appointment_time: time,
                status: 'Pendente'
            };

            if (editingAppointmentId) {
                const { error: appError } = await supabase
                    .from('appointments')
                    .update(appData)
                    .eq('id', editingAppointmentId);
                if (appError) throw appError;
            } else {
                const { error: appError } = await supabase
                    .from('appointments')
                    .insert([appData]);
                if (appError) throw appError;
            }

            setIsModalOpen(false);
            setEditingAppointmentId(null);
            setSelectedClientId('');
            setNewClientName('');
            setIsAddingClient(false);
            setSelectedServiceId('');
            setSelectedProId('');
            if (addresses.length > 0) setSelectedAddressId(addresses.find(a => a.is_main)?.id || addresses[0].id);

            fetchAppointments();

            const proName = professionals.find(p => p.id === selectedProId)?.name || 'Profissional';
            const serviceName = services.find(s => s.id === selectedServiceId)?.name || 'Serviço';
            await addNotification(
                editingAppointmentId ? 'Reagendamento Confirmado' : 'Novo Agendamento',
                `${serviceName} com ${proName} para ${new Date(date + 'T00:00:00').toLocaleDateString()} às ${time}.`
            );

            toast.success(`Agendamento ${editingAppointmentId ? 'atualizado' : 'realizado'} com sucesso!`);
        } catch (error: any) {
            toast.error('Erro ao salvar agendamento: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, appt: any) => {
        setDraggedAppId(appt.id);
        e.dataTransfer.setData('appointmentId', appt.id);
        e.dataTransfer.effectAllowed = 'move';

        // Add a ghost image or effect if desired
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '1';
        setDraggedAppId(null);
    };

    const handleDragOver = (e: React.DragEvent, slotId: string, date: string, time?: string) => {
        if (isPastSlot(date, time)) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverSlot(slotId);
    };

    const handleDragLeave = () => {
        setDragOverSlot(null);
    };

    const handleDrop = (e: React.DragEvent, newDate: string, newTime: string) => {
        e.preventDefault();
        setDragOverSlot(null);

        if (isPastSlot(newDate, newTime)) {
            toast.error('Não é possível mover para datas ou horários passados.');
            return;
        }

        const appointmentId = e.dataTransfer.getData('appointmentId');
        const appt = appointments.find(a => a.id === appointmentId);

        if (!appt) return;

        // If newTime is empty (month view), keep existing time
        const finalTime = newTime || appt.appointment_time.substring(0, 5);

        // Skip if same date and time
        if (appt.appointment_date === newDate && appt.appointment_time.substring(0, 5) === finalTime) {
            return;
        }

        setConfirmMove({
            isOpen: true,
            appointment: appt,
            newDate,
            newTime: finalTime
        });
    };

    const confirmMovement = async () => {
        if (!confirmMove.appointment) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('appointments')
                .update({
                    appointment_date: confirmMove.newDate,
                    appointment_time: confirmMove.newTime
                })
                .eq('id', confirmMove.appointment.id);

            if (error) throw error;

            toast.success('Agendamento movido com sucesso!');
            fetchAppointments();

            const serviceName = confirmMove.appointment.services?.name || 'Serviço';
            await addNotification(
                'Agendamento Movido',
                `${serviceName} movido para ${new Date(confirmMove.newDate).toLocaleDateString()} às ${confirmMove.newTime}.`
            );
        } catch (error: any) {
            toast.error('Erro ao mover agendamento: ' + error.message);
        } finally {
            setIsSaving(false);
            setConfirmMove({ isOpen: false, appointment: null, newDate: '', newTime: '' });
        }
    };

    const navigateDate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (view === 'day') {
            newDate.setDate(currentDate.getDate() + direction);
        } else if (view === 'week') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (view === 'month') {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    const getWeekDays = () => {
        const days = [];
        const start = new Date(currentDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const dateObj = new Date(start);
            dateObj.setDate(start.getDate() + i);
            days.push(dateObj);
        }
        return days;
    };

    const weekDays = getWeekDays();
    const currentMonthLabel = months[currentDate.getMonth()] + ' ' + currentDate.getFullYear();

    const getAppointmentStyle = (apptTime: string, duration: number = 60) => {
        const [hours, minutes] = apptTime.split(':').map(Number);
        const top = (hours - 8) * 80 + (minutes / 60) * 80;
        const height = Math.max((duration / 60) * 80, 50);
        return {
            top: `${top}px`,
            height: `${height}px`,
            width: 'calc(100% - 8px)',
            left: '4px'
        };
    };

    const getStatusStyles = (status: string, isMonthView: boolean = false) => {
        switch (status) {
            case 'Pendente':
                return isMonthView
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-l-[6px] border-amber-500 text-slate-900 dark:text-white shadow-xl shadow-amber-500/5";
            case 'Confirmado':
                return isMonthView
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-l-[6px] border-emerald-500 text-slate-900 dark:text-white shadow-xl shadow-emerald-500/5";
            case 'Concluído':
            case 'Finalizado':
                return isMonthView
                    ? "bg-sky-50 dark:bg-sky-500/10 text-sky-900 dark:text-sky-400 border border-sky-200/50 dark:border-sky-500/20 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-l-[6px] border-sky-500 text-slate-900 dark:text-white shadow-xl shadow-sky-500/5";
            case 'Cancelado':
                return isMonthView
                    ? "bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 opacity-60"
                    : "bg-red-50 dark:bg-slate-950 border-l-[6px] border-red-500 text-red-900 dark:text-red-100 opacity-60 grayscale";
            default:
                return isMonthView
                    ? "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-l-[6px] border-primary text-slate-900 dark:text-white shadow-xl";
        }
    };

    const getMonthDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        const firstDayOfWeek = firstDay.getDay();
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1); i > 0; i--) {
            days.push(new Date(year, month - 1, prevMonthLastDay - i + 1));
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(new Date(year, month + 1, i));
        }
        return days;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden reveal-content">
            <div className="flex flex-col lg:flex-row items-center justify-between p-6 gap-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-xl shadow-black/5 z-20">
                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-800 p-0.5">
                        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)} className="hover:bg-white dark:hover:bg-slate-700 rounded-sm"><ChevronLeft className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} className="hover:bg-white dark:hover:bg-slate-700 rounded-sm"><ChevronRight className="w-5 h-5" /></Button>
                    </div>
                    <div className="flex flex-col items-center lg:items-start flex-1 px-4">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">
                            {view === 'day' ? `${currentDate.getDate()} de ${months[currentDate.getMonth()]}` : months[currentDate.getMonth()]}
                        </h2>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{currentDate.getFullYear()}</span>
                    </div>
                    <Button variant="outline" size="sm" className="hidden sm:flex border-primary/20 hover:bg-primary/5 text-primary rounded-sm font-black uppercase text-[10px] tracking-widest" onClick={goToToday}>Hoje</Button>
                </div>

                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div className="relative flex-1 lg:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar na agenda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary/20 rounded-sm text-xs font-bold uppercase tracking-tight focus:bg-white dark:focus:bg-slate-800 transition-all outline-none dark:text-white"
                        />
                    </div>

                    <button
                        onClick={() => setIsFilterPanelOpen(true)}
                        className={`relative p-3 rounded-sm border-2 transition-all flex items-center gap-2 group ${activeFilterCount > 0
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                            : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-primary/30"}`}
                    >
                        <Filter className={`w-4 h-4 ${activeFilterCount > 0 ? "scale-110" : "group-hover:scale-110"} transition-transform`} />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-slate-950 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-1 rounded-sm border border-slate-100 dark:border-slate-800">
                        {(['day', 'week', 'month'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-4 py-2 text-[10px] uppercase font-black tracking-widest rounded-sm transition-all ${view === v
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>

                    <Button
                        className="gap-2 bg-slate-950 hover:bg-primary border-none shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 active:translate-y-0 group"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="hidden sm:inline font-black uppercase text-xs tracking-widest">Agendar</span>
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
                {isLoadingAppointments && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                )}

                {view === 'month' ? (
                    <div className="min-w-[800px] md:min-w-full grid grid-cols-7 h-full">
                        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(d => (
                            <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">{d}</div>
                        ))}
                        {getMonthDays().map((dateObj, i) => {
                            const isCurrentMonth = dateObj.getMonth() === currentDate.getMonth();
                            const isToday = dateObj.toDateString() === new Date().toDateString();
                            const dayFormatted = formatToISODate(dateObj);
                            const dayAppointments = filteredAppointments.filter(a => a.appointment_date === dayFormatted);

                            return (
                                <div
                                    key={i}
                                    className={`min-h-[120px] border-r border-b border-slate-100 dark:border-slate-800 p-2 transition-colors ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''} ${dragOverSlot === dayFormatted ? 'bg-primary/10' : ''} ${isPastSlot(dayFormatted) ? 'bg-slate-100/30 dark:bg-slate-800/30 cursor-not-allowed' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, dayFormatted, dayFormatted)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, dayFormatted, '')}
                                >
                                    <span className={`text-sm font-semibold ${isToday ? 'bg-primary text-white w-7 h-7 flex items-center justify-center rounded-full' : isCurrentMonth ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                                        {dateObj.getDate()}
                                    </span>
                                    <div className="mt-2 space-y-1">
                                        {dayAppointments.slice(0, 3).map(a => (
                                            <div
                                                key={a.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, a)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setSelectedAppointment(a)}
                                                className={`text-[10px] p-1 rounded truncate cursor-pointer transition-all ${getStatusStyles(a.status, true)}`}
                                            >
                                                {a.appointment_time.substring(0, 5)} {a.services?.name}
                                            </div>
                                        ))}
                                        {dayAppointments.length > 3 && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{dayAppointments.length - 3} mais</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="min-w-[800px] md:min-w-full flex flex-col h-full">
                        <div className={`grid ${view === 'week' ? 'grid-cols-8' : 'grid-cols-[60px_1fr]'} border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10`}>
                            <div className="h-14 border-r border-slate-100 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">GMT-3</div>
                            {(view === 'week' ? weekDays : [currentDate]).map((dateObj, i) => {
                                const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
                                const isToday = new Date().toDateString() === dateObj.toDateString();
                                return (
                                    <div key={i} className={`flex flex-col items-center justify-center py-2 border-r border-slate-100 dark:border-slate-800 ${isToday ? 'bg-primary/5' : ''}`}>
                                        <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>{dayNames[dateObj.getDay()]}</span>
                                        <span className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{dateObj.getDate()}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={`grid ${view === 'week' ? 'grid-cols-8' : 'grid-cols-[60px_1fr]'} relative h-[960px]`}>
                            <div className="border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="h-20 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 p-2 text-right relative">
                                        <span className="-top-3 relative">{`${(i + 8).toString().padStart(2, '0')}:00`}</span>
                                    </div>
                                ))}
                            </div>
                            {(view === 'week' ? weekDays : [currentDate]).map((dayDate, i) => (
                                <div key={i} className="border-r border-slate-100 dark:border-slate-800 relative">
                                    {Array.from({ length: 12 }).map((_, j) => {
                                        const hour = (j + 8).toString().padStart(2, '0') + ':00';
                                        const slotId = `${formatToISODate(dayDate)}-${hour}`;
                                        const isOver = dragOverSlot === slotId;
                                        const isPast = isPastSlot(formatToISODate(dayDate), hour);
                                        return (
                                            <div
                                                key={j}
                                                className={`h-20 border-b border-slate-100 dark:border-slate-800 transition-colors ${isOver ? 'bg-primary/10' : ''} ${isPast ? 'bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed' : ''}`}
                                                onDragOver={(e) => handleDragOver(e, slotId, formatToISODate(dayDate), hour)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, formatToISODate(dayDate), hour)}
                                            ></div>
                                        );
                                    })}

                                    {(() => {
                                        const dayApps = filteredAppointments.filter(a => a.appointment_date === formatToISODate(dayDate));

                                        // Group by exact time for simpler aggregator
                                        const timeGroups: { [key: string]: any[] } = {};
                                        dayApps.forEach(a => {
                                            const t = a.appointment_time.substring(0, 5);
                                            if (!timeGroups[t]) timeGroups[t] = [];
                                            timeGroups[t].push(a);
                                        });

                                        return Object.entries(timeGroups).map(([time, group]) => {
                                            const appt = group[0];
                                            const hasConflicts = group.length > 1;

                                            return (
                                                <div
                                                    key={appt.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, appt)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={() => {
                                                        if (hasConflicts) {
                                                            setConflictAppointments(group);
                                                            setIsConflictModalOpen(true);
                                                        } else {
                                                            setSelectedAppointment(appt);
                                                        }
                                                    }}
                                                    className={`absolute p-1 z-10 cursor-pointer transition-all ${draggedAppId === appt.id ? 'z-50' : ''}`}
                                                    style={getAppointmentStyle(appt.appointment_time, appt.services?.duration_minutes)}
                                                >
                                                    <div className={`
                                                        ${getStatusStyles(appt.status)} 
                                                        border-l-[6px] p-2.5 rounded-sm h-full flex flex-col justify-between overflow-hidden hover:scale-[1.02] hover:shadow-2xl hover:z-30 transition-all duration-300 group/item
                                                    `}>
                                                        {hasConflicts && (
                                                            <div className="absolute top-1 right-1 bg-slate-950 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm z-20 animate-pulse border border-white/20">
                                                                +{group.length - 1}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-black text-[11px] text-slate-900 dark:text-white truncate uppercase tracking-tight leading-none mb-1 group-hover/item:text-primary transition-colors">{appt.services?.name}</p>
                                                            {appt.services?.duration_minutes >= 30 && (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate tracking-tight">{appt.clients?.name}</p>
                                                                    <p className="text-[9px] text-primary font-black truncate uppercase tracking-widest opacity-80">{appt.professionals?.name}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mt-1">
                                                            <Clock className="w-3 h-3 flex-shrink-0" />
                                                            <span className="text-[10px] font-black tracking-widest">{appt.appointment_time.substring(0, 5)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div >

            {/* Modal de Novo Agendamento */}
            {
                isModalOpen && createPortal(
                    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col">
                            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-balance">
                                        {editingAppointmentId ? 'Ajustar' : 'Novo'} <span className="text-primary">Agendamento</span>
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">EstéticaFlow — Alta Performance</p>
                                </div>
                                <button onClick={() => { setIsModalOpen(false); setEditingAppointmentId(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm transition-colors">
                                    <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Cliente</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingClient(!isAddingClient)}
                                            className="text-[10px] font-black text-primary uppercase tracking-widest transition-all"
                                        >
                                            {isAddingClient ? '[ Selecionar ]' : '[ + Novo ]'}
                                        </button>
                                    </div>
                                    {isAddingClient ? (
                                        <input
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-primary/20 rounded-sm text-sm font-bold tracking-tight outline-none focus:border-primary transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                            placeholder="Nome completo do cliente"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                            autoFocus
                                        />
                                    ) : (
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary/20 rounded-sm text-sm font-bold text-slate-900 dark:text-white outline-none transition-all cursor-pointer"
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione um cliente...</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Serviço</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary/20 rounded-sm text-sm font-bold text-slate-900 dark:text-white outline-none transition-all cursor-pointer"
                                            value={selectedServiceId}
                                            onChange={(e) => setSelectedServiceId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Profissional</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary/20 rounded-sm text-sm font-bold text-slate-900 dark:text-white outline-none transition-all cursor-pointer"
                                            value={selectedProId}
                                            onChange={(e) => setSelectedProId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {filteredProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <InputField label="DATA" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Horário</label>
                                        <select
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-sm text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            required
                                            disabled={availableTimes.length === 0 || !selectedServiceId || !selectedProId}
                                        >
                                            {!selectedServiceId || !selectedProId ? (
                                                <option value="">Aguardando...</option>
                                            ) : availableTimes.length === 0 ? (
                                                <option value="">Lotado</option>
                                            ) : (
                                                <>
                                                    <option value="" disabled>Escolha...</option>
                                                    {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-6 pt-2">
                                    <Button type="submit" className="w-full py-8 bg-slate-950 hover:bg-primary text-white font-black uppercase tracking-[0.3em] rounded-sm shadow-xl shadow-black/20 transition-all group flex items-center justify-center gap-3" disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                                        {editingAppointmentId ? 'Confirmar Ajuste' : 'Protocolar Agendamento'}
                                    </Button>
                                    <div className="flex items-center justify-center gap-4 text-slate-300 dark:text-slate-800">
                                        <div className="h-px bg-current flex-1"></div>
                                        <div className="w-2 h-2 rounded-full bg-current"></div>
                                        <div className="h-px bg-current flex-1"></div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Modal de Detalhes do Agendamento */}
            {
                selectedAppointment && createPortal(
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes do Agendamento</h3>
                                    <p className="text-xs text-slate-500 mt-1">ID: #{selectedAppointment.id.substring(0, 8)}</p>
                                </div>
                                <button onClick={() => setSelectedAppointment(null)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors shadow-sm">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Data e Horário</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">
                                            {new Date(selectedAppointment.appointment_date + 'T12:00:00').toLocaleDateString()} às {selectedAppointment.appointment_time.substring(0, 5)}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cliente</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">{selectedAppointment.clients?.name}</p>
                                        {selectedAppointment.clients?.phone && <p className="text-xs text-slate-400 dark:text-slate-500">{selectedAppointment.clients.phone}</p>}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Serviço</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">{selectedAppointment.services?.name}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">{selectedAppointment.services?.duration_minutes} min • R$ {selectedAppointment.services?.price}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Profissional</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">{selectedAppointment.professionals?.name || 'Não atribuído'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</p>
                                        <select
                                            className={`w-full mt-1 px-3 py-2 rounded-sm text-[11px] font-black uppercase tracking-widest border-2 transition-all outline-none cursor-pointer
                                            ${selectedAppointment.status === 'Pendente' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-400' :
                                                    selectedAppointment.status === 'Confirmado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500/30 dark:text-emerald-400' :
                                                        (selectedAppointment.status === 'Concluído' || selectedAppointment.status === 'Finalizado') ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:border-sky-500/30 dark:text-sky-400' :
                                                            'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400'}`}
                                            value={selectedAppointment.status}
                                            onChange={(e) => handleStatusUpdate(selectedAppointment.id, e.target.value)}
                                            disabled={isSaving}
                                        >
                                            <option value="Pendente">Pendente</option>
                                            <option value="Confirmado">Confirmado</option>
                                            <option value="Finalizado">Finalizado</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Link de WhatsApp Humanizado */}
                                {selectedAppointment.clients?.phone && (
                                    <div className="pt-2">
                                        <a
                                            href={`https://wa.me/55${selectedAppointment.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                `Olá ${selectedAppointment.clients.name}! Tudo bem?\n\nPassando para confirmar o seu horário de *${selectedAppointment.services?.name}* aqui na ${settings.business_name || 'EstéticaFlow'}.\n\n📅 *${new Date(selectedAppointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}* às *${selectedAppointment.appointment_time.substring(0, 5)}*\n\nPodemos confirmar a sua presença?`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-slate-950 hover:bg-primary text-white font-black rounded-sm transition-all shadow-xl shadow-black/10 active:scale-[0.98] group uppercase tracking-widest text-[11px]"
                                        >
                                            <MessageCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                            Enviar Lembrete Amigável
                                        </a>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setSelectedAppointment(null)}>Fechar</Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 text-red-500 hover:text-red-600 border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setConfirmDelete({ isOpen: true, id: selectedAppointment.id })}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </Button>
                                <Button className="flex-1" onClick={() => handleOpenEditModal(selectedAppointment)}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Editar
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDeleteAppointment}
                title="Cancelar Agendamento"
                message="Tem certeza que deseja cancelar/excluir este agendamento? Esta ação removerá o horário da agenda da profissional."
                confirmLabel="Sim, Cancelar"
                cancelLabel="Não, Manter"
            />

            <ConfirmModal
                isOpen={confirmMove.isOpen}
                onClose={() => setConfirmMove({ ...confirmMove, isOpen: false })}
                onConfirm={confirmMovement}
                title="Mover Agendamento"
                message={`Deseja mover o agendamento de ${confirmMove.appointment?.clients?.name} para o dia ${confirmMove.newDate ? new Date(confirmMove.newDate + 'T00:00:00').toLocaleDateString() : ''} às ${confirmMove.newTime}?`}
                confirmLabel="Sim, Mover"
                cancelLabel="Não, Manter original"
            />
            {/* Modal de Conflitos de Horário */}
            {isConflictModalOpen && createPortal(
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                Agendamentos às {conflictAppointments[0]?.appointment_time.substring(0, 5)}
                            </h3>
                            <button onClick={() => setIsConflictModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {conflictAppointments.map(appt => (
                                <div
                                    key={appt.id}
                                    onClick={() => {
                                        setSelectedAppointment(appt);
                                        setIsConflictModalOpen(false);
                                    }}
                                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary">{appt.services?.name}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${appt.status === 'Pendente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : appt.status === 'Confirmado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (appt.status === 'Concluído' || appt.status === 'Finalizado') ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {appt.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{appt.clients?.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{appt.professionals?.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isFilterPanelOpen && createPortal(
                <div className="fixed inset-0 z-[120] flex justify-end">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setIsFilterPanelOpen(false)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col p-10 animate-in slide-in-from-right duration-500 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                    Filtros <span className="text-primary">Pro</span>
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Refine sua gestão</p>
                            </div>
                            <button onClick={() => setIsFilterPanelOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-12 pr-2 relative z-10 scrollbar-hide">
                            {/* Status */}
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-950 dark:text-white uppercase tracking-[0.2em]">Status do Fluxo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['Pendente', 'Confirmado', 'Finalizado', 'Cancelado'].map(s => {
                                        const isSelected = filters.status.includes(s);
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setFilters(prev => ({
                                                        ...prev,
                                                        status: isSelected ? prev.status.filter(x => x !== s) : [...prev.status, s]
                                                    }));
                                                }}
                                                className={`px-4 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isSelected
                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.05]'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-primary/20'}`}
                                            >
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Profissionais */}
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-950 dark:text-white uppercase tracking-[0.2em]">Profissionais</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {!professionals || professionals.length === 0 ? (
                                        <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 text-center rounded-sm">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum profissional operacional detectado</p>
                                        </div>
                                    ) : (
                                        professionals.map(p => {
                                            const isSelected = filters.professionals.includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            professionals: isSelected ? prev.professionals.filter(x => x !== p.id) : [...prev.professionals, p.id]
                                                        }));
                                                    }}
                                                    className={`w-full flex items-center justify-between px-5 py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isSelected
                                                        ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5'
                                                        : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200 dark:hover:bg-slate-800'}`}
                                                >
                                                    {p.name}
                                                    {isSelected && <Plus className="w-4 h-4 rotate-45" />}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Serviços */}
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-950 dark:text-white uppercase tracking-[0.2em]">Serviços Ativos</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {!services || services.length === 0 ? (
                                        <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 text-center rounded-sm">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catálogo sincronizado não encontrado</p>
                                        </div>
                                    ) : (
                                        services.map(s => {
                                            const isSelected = filters.services.includes(s.id);
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            services: isSelected ? prev.services.filter(x => x !== s.id) : [...prev.services, s.id]
                                                        }));
                                                    }}
                                                    className={`w-full flex items-center justify-between px-5 py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isSelected
                                                        ? 'bg-slate-950 border-slate-950 text-white shadow-2xl'
                                                        : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200 dark:hover:bg-slate-800'}`}
                                                >
                                                    {s.name}
                                                    {isSelected && <div className="w-2 h-2 rounded-none bg-primary animate-pulse" />}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 relative z-10 bg-white dark:bg-slate-900">
                            <button
                                onClick={() => {
                                    setFilters({ status: [], professionals: [], services: [] });
                                    setSearchTerm('');
                                }}
                                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-red-500 transition-colors"
                            >
                                [ Limpar Configurações ]
                            </button>
                            <Button className="w-full py-6 rounded-sm bg-slate-950 hover:bg-primary text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all" onClick={() => setIsFilterPanelOpen(false)}>
                                Aplicar Consultoria
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
};
