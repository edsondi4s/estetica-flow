import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, Loader2, X, Trash2, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import toast from 'react-hot-toast';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatToISODate = (date: Date) => {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
};

export const Agenda = () => {
    const { addNotification } = useNotifications();
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
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('09:00');
    const [newClientName, setNewClientName] = useState('');
    const [isAddingClient, setIsAddingClient] = useState(false);

    const [professionals, setProfessionals] = useState<any[]>([]);
    const [businessHours, setBusinessHours] = useState<any[]>([]);
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

    useEffect(() => {
        if (isModalOpen) fetchFormData();
    }, [isModalOpen]);

    useEffect(() => {
        fetchAppointments();
    }, [currentDate, view]);

    const fetchFormData = async () => {
        const { data: clientsData } = await supabase.from('clients').select('id, name').order('name');
        const { data: servicesData } = await supabase.from('services').select('id, name, duration_minutes').eq('is_active', true).order('name');
        const { data: prosData } = await supabase.from('professionals').select('id, name, is_active').eq('is_active', true).order('name');
        const { data: bhData } = await supabase.from('business_hours').select('*');

        setClients(clientsData || []);
        setServices(servicesData || []);
        setProfessionals(prosData || []);
        setBusinessHours(bhData || []);
    };

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
                    clients(name),
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

    const handleOpenEditModal = (app: any) => {
        setEditingAppointmentId(app.id);
        setSelectedClientId(app.client_id);
        setSelectedServiceId(app.service_id);
        setSelectedProId(app.professional_id);
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

            fetchAppointments();

            const proName = professionals.find(p => p.id === selectedProId)?.name || 'Profissional';
            const serviceName = services.find(s => s.id === selectedServiceId)?.name || 'Serviço';
            await addNotification(
                `Agendamento ${editingAppointmentId ? 'Atualizado' : 'Confirmado'}`,
                `${serviceName} com ${proName} às ${time}.`
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

    const handleDragOver = (e: React.DragEvent, slotId: string) => {
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
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-col lg:flex-row items-center justify-between p-4 gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between w-full lg:w-auto gap-2">
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="w-5 h-5" /></Button>
                    </div>
                    <h2 className="text-sm md:text-lg font-bold text-slate-900 dark:text-white truncate flex-1 text-center lg:text-left mx-2">
                        {view === 'day' ? `${currentDate.getDate()} de ${currentMonthLabel}` : currentMonthLabel}
                    </h2>
                    <Button variant="outline" size="sm" className="shrink-0" onClick={goToToday}>Hoje</Button>
                </div>
                <div className="flex items-center justify-between w-full lg:w-auto gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex-1 lg:flex-none">
                        <button onClick={() => setView('day')} className={`flex-1 lg:px-3 py-1 text-xs md:text-sm font-medium rounded-md transition-all ${view === 'day' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Dia</button>
                        <button onClick={() => setView('week')} className={`flex-1 lg:px-3 py-1 text-xs md:text-sm font-medium rounded-md transition-all ${view === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Semana</button>
                        <button onClick={() => setView('month')} className={`flex-1 lg:px-3 py-1 text-xs md:text-sm font-medium rounded-md transition-all ${view === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Mês</button>
                    </div>
                    <Button className="gap-2 shrink-0 py-1 px-3 md:py-2 md:px-4 text-xs md:text-sm" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Novo Agendamento</span>
                        <span className="xs:hidden">Novo</span>
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
                            const dayAppointments = appointments.filter(a => a.appointment_date === dayFormatted);

                            return (
                                <div
                                    key={i}
                                    className={`min-h-[120px] border-r border-b border-slate-100 dark:border-slate-800 p-2 transition-colors ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''} ${dragOverSlot === dayFormatted ? 'bg-primary/10' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, dayFormatted)}
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
                                                className="text-[10px] p-1 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 truncate cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-all"
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
                                        return (
                                            <div
                                                key={j}
                                                className={`h-20 border-b border-slate-100 dark:border-slate-800 transition-colors ${isOver ? 'bg-primary/10' : ''}`}
                                                onDragOver={(e) => handleDragOver(e, slotId)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, formatToISODate(dayDate), hour)}
                                            ></div>
                                        );
                                    })}

                                    {(() => {
                                        const dayApps = appointments.filter(a => a.appointment_date === formatToISODate(dayDate));

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
                                                        ${appt.status === 'Cancelado' ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-500 opacity-60' :
                                                            appt.status === 'Concluído' ? 'bg-slate-100 dark:bg-slate-800 border-slate-500' :
                                                                'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 shadow-sm'} 
                                                        border-l-4 p-1.5 rounded text-xs h-full flex flex-col justify-between overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all relative
                                                    `}>
                                                        {hasConflicts && (
                                                            <div className="absolute top-1 right-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg z-20 animate-pulse">
                                                                +{group.length - 1}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{appt.services?.name}</p>
                                                            {appt.services?.duration_minutes >= 45 && (
                                                                <div className="flex flex-col">
                                                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate opacity-90">{appt.clients?.name}</p>
                                                                    <p className="text-[10px] text-primary-dark dark:text-primary-light font-medium truncate italic">{appt.professionals?.name}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                            <Clock className="w-3 h-3 flex-shrink-0" /> {appt.appointment_time.substring(0, 5)}
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
                isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                                <button onClick={() => { setIsModalOpen(false); setEditingAppointmentId(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Escolher Cliente</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingClient(!isAddingClient)}
                                            className="text-xs text-primary font-medium hover:underline"
                                        >
                                            {isAddingClient ? 'Selecionar existente' : '+ Novo Cliente'}
                                        </button>
                                    </div>
                                    {isAddingClient ? (
                                        <input
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-primary/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            placeholder="Nome do novo cliente"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                            autoFocus
                                        />
                                    ) : (
                                        <select
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione um cliente...</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Serviço</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                        value={selectedServiceId}
                                        onChange={(e) => setSelectedServiceId(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecione um serviço...</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profissional</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                        value={selectedProId}
                                        onChange={(e) => setSelectedProId(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecione um profissional...</option>
                                        {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Horário</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            required
                                            disabled={availableTimes.length === 0 || !selectedServiceId || !selectedProId}
                                        >
                                            {!selectedServiceId || !selectedProId ? (
                                                <option value="">Selecione serviço e profissional</option>
                                            ) : availableTimes.length === 0 ? (
                                                <option value="">Nenhum horário disponível</option>
                                            ) : (
                                                <>
                                                    <option value="" disabled>Escolha o horário...</option>
                                                    {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); setEditingAppointmentId(null); }}>Cancelar</Button>
                                    <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Confirmar Agendamento
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Modal de Detalhes do Agendamento */}
            {
                selectedAppointment && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
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
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1
                                        ${selectedAppointment.status === 'Pendente' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                                (selectedAppointment.status === 'Confirmado' || selectedAppointment.status === 'Concluído') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {selectedAppointment.status}
                                        </span>
                                    </div>
                                </div>
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
                    </div>
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
            {isConflictModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${appt.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' : appt.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {appt.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{appt.clients?.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">{appt.professionals?.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
