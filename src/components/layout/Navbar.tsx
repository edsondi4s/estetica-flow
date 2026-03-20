import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, Scissors, Star, Calendar, X, Loader2, Phone, Briefcase, Settings, Sparkles } from 'lucide-react';
import { menuItems } from '../../types/navigation';
import { User } from '@supabase/supabase-js';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useDebounce } from 'use-debounce';
import { supabase } from '../../lib/supabase';

interface NavbarProps {
    currentPageId: string;
    user: User;
    onMenuClick?: () => void;
    onPageChange: (id: string) => void;
}

type SearchResult = {
    id: string;
    type: 'client' | 'service' | 'professional';
    title: string;
    subtitle: string;
    raw: any;
};

export const Navbar = ({ currentPageId, user, onMenuClick, onPageChange }: NavbarProps) => {
    const activeItem = menuItems.find(i => i.id === currentPageId);
    const pageLabel = currentPageId === 'configuracoes' ? 'Configurações' : activeItem?.label;
    const pageDescription = activeItem?.description || 'Visão Geral da Clínica';
    const ActiveIcon = currentPageId === 'configuracoes' ? Settings : (activeItem?.icon || Sparkles);
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();

    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery] = useDebounce(searchQuery, 400);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
    const [clientStats, setClientStats] = useState<{ total: number, completed: number, totalValue: number } | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    const formatPhoneNumber = (phone: string) => {
        if (!phone) return 'Nenhum telefone registrado';
        const cleaned = phone.replace(/\D/g, '');
        let match = cleaned.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
        if (match) return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
        match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
        if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
        return phone;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (!debouncedQuery.trim()) {
                setSearchResults([]);
                setShowResults(false);
                return;
            }
            setIsSearching(true);
            setShowResults(true);

            try {
                const [clientsRes, servicesRes, prosRes] = await Promise.all([
                    supabase.from('clients').select('*').ilike('name', `%${debouncedQuery}%`).limit(3),
                    supabase.from('services').select('*').ilike('name', `%${debouncedQuery}%`).limit(3),
                    supabase.from('professionals').select('*').ilike('name', `%${debouncedQuery}%`).limit(3)
                ]);

                const results: SearchResult[] = [];
                if (clientsRes.data) clientsRes.data.forEach(c => results.push({ id: c.id, type: 'client', title: c.name, subtitle: c.phone || 'S/ telefone', raw: c }));
                if (servicesRes.data) servicesRes.data.forEach(s => results.push({ id: s.id, type: 'service', title: s.name, subtitle: `${s.duration_minutes} min • R$ ${s.price}`, raw: s }));
                if (prosRes.data) prosRes.data.forEach(p => results.push({ id: p.id, type: 'professional', title: p.name, subtitle: p.specialty || 'Especialista', raw: p }));

                setSearchResults(results);
            } catch (error) {
                console.error("Busca falhou:", error);
            } finally {
                setIsSearching(false);
            }
        };
        fetchResults();
    }, [debouncedQuery]);

    useEffect(() => {
        let isMounted = true;
        const fetchClientStats = async () => {
            if (selectedItem?.type !== 'client') {
                if (isMounted) setClientStats(null);
                return;
            }
            if (isMounted) setIsLoadingStats(true);
            try {
                const { data, error } = await supabase
                    .from('appointments')
                    .select('status, services(name, price)')
                    .eq('client_id', selectedItem.id);
                    
                if (error) throw error;
                
                if (isMounted && data) {
                    const total = data.length;
                    const completed = data.filter(a => a.status === 'Finalizado').length;
                    const totalValue = data.reduce((acc, curr) => acc + (Number((curr.services as any)?.price) || 0), 0);
                    setClientStats({ total, completed, totalValue });
                }
            } catch (err) {
                console.error("Erro ao carregar stats do cliente:", err);
            } finally {
                if (isMounted) setIsLoadingStats(false);
            }
        };
        
        fetchClientStats();
        return () => { isMounted = false; };
    }, [selectedItem]);

    const getIconForType = (type: string) => {
        switch (type) {
            case 'client': return <UserIcon className="w-4 h-4 text-[var(--color-secondary)]" />;
            case 'service': return <Scissors className="w-4 h-4 text-primary" />;
            case 'professional': return <Star className="w-4 h-4 text-[var(--color-secondary)]" />;
            default: return <Search className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <header className="h-24 px-8 flex items-center justify-between shrink-0 relative bg-transparent z-30">
            <div className="flex items-center gap-4 text-slate-800 dark:text-white">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-luxury shadow-sm flex items-center justify-center text-primary border border-primary/10">
                    <ActiveIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-serif font-medium tracking-tight">
                        {pageLabel}
                    </h2>
                    <p className="text-xs text-slate-500 tracking-wide mt-0.5">{pageDescription}</p>
                </div>
            </div>

            <div className="flex items-center gap-5">
                {/* Search */}
                <div className="relative hidden lg:block" ref={searchRef}>
                    <div className="relative group bg-white dark:bg-slate-800 rounded-luxury shadow-sm border border-slate-100 dark:border-slate-700/50 has-[:focus]:border-primary/50 transition-colors">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="pl-12 pr-4 py-3 bg-transparent w-80 text-sm outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-light"
                            placeholder="Buscar pacotes, clientes..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); if (!showResults) setShowResults(true); }}
                            onFocus={() => { if (searchQuery.trim()) setShowResults(true); }}
                        />
                        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                    </div>

                    {showResults && searchQuery.trim() && (
                        <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 rounded-luxury shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                            {searchResults.length > 0 ? (
                                <div className="max-h-80 overflow-y-auto">
                                    {searchResults.map((item) => (
                                        <button
                                            key={`${item.type}-${item.id}`}
                                            className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                                            onClick={() => { setSelectedItem(item); setShowResults(false); setSearchQuery(''); }}
                                        >
                                            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                                                {getIconForType(item.type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : !isSearching ? (
                                <div className="p-8 text-center text-slate-500 text-sm">Nenhum resultado luxuoso encontrado.</div>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Theme & Notifications */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-luxury shadow-sm border border-slate-100 dark:border-slate-700/50">
                    <button onClick={toggleTheme} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-luxury transition-colors">
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>

                    <div className="w-px h-6 bg-slate-100 dark:bg-slate-700"></div>

                    <div className="relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-luxury transition-colors relative">
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>}
                        </button>

                        {showNotifications && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-800 rounded-luxury shadow-xl border border-slate-100 dark:border-slate-700 z-50 animate-in zoom-in-95 origin-top-right">
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <h3 className="font-serif text-sm font-medium">Notificações</h3>
                                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{unreadCount}</span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div key={n.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50" onClick={() => { markAsRead(n.id); setShowNotifications(false); if (n.link) onPageChange(n.link); }}>
                                                    <p className={`text-sm ${!n.is_read ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>{n.title}</p>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-xs text-slate-400">Tudo calmo por aqui.</div>
                                        )}
                                    </div>
                                    <button onClick={() => clearAll()} className="w-full p-3 text-xs text-primary hover:bg-primary/5 transition-colors font-medium">Limpar Notificações</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Quick View Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl w-full max-w-[28rem] overflow-hidden animate-in fade-in zoom-in-95 border border-slate-100 dark:border-slate-700/50 m-auto">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-primary mt-1 shrink-0">
                                    {getIconForType(selectedItem.type)}
                                </div>
                                <div>
                                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase mb-1.5 opacity-80">
                                        {selectedItem.type === 'client' ? 'Cliente da Clínica' : selectedItem.type === 'service' ? 'Serviço Oferecido' : 'Membro da Equipe'}
                                    </p>
                                    <h3 className="text-2xl font-serif text-slate-900 dark:text-white leading-tight font-medium tracking-tight break-words pr-4">{selectedItem.title}</h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-8 pb-10">
                            {selectedItem.type === 'client' && (
                                <div className="space-y-6 mb-8 transform transition-all duration-300">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">Contato Principal</span>
                                        <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                            <Phone className="w-4 h-4 text-primary shrink-0 drop-shadow-[0_2px_4px_rgba(16,185,129,0.2)]" />
                                            {formatPhoneNumber(selectedItem.raw.phone)}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Total de Agendamentos</span>
                                            {isLoadingStats ? (
                                                <div className="h-6 flex items-center"><Loader2 className="w-4 h-4 text-primary animate-spin" /></div>
                                            ) : (
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{clientStats?.total || 0}</span>
                                            )}
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Serviços Feitos</span>
                                            {isLoadingStats ? (
                                                <div className="h-6 flex items-center"><Loader2 className="w-4 h-4 text-primary animate-spin" /></div>
                                            ) : (
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{clientStats?.completed || 0}</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-[20px] border border-amber-100 dark:border-amber-900/30 relative overflow-hidden group hover:border-amber-200 dark:hover:border-amber-800/50 transition-colors">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-[100px] transition-all group-hover:scale-110"></div>
                                        <div className="relative z-10">
                                            <span className="text-[11px] font-bold text-amber-600/80 dark:text-amber-500/80 uppercase tracking-widest mb-2.5 block flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Anotações Especiais</span>
                                            <p className={`text-[15px] leading-relaxed font-medium ${selectedItem.raw.notes ? 'text-amber-900/90 dark:text-amber-200/90 italic' : 'text-amber-800/60 dark:text-amber-200/60'}`}>
                                                {selectedItem.raw.notes ? `"${selectedItem.raw.notes}"` : 'Ainda não há nenhuma observação anotada para este cliente. Quando houver, ela aparecerá aqui para te ajudar no atendimento.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedItem.type === 'service' && (
                                <div className="space-y-6 mb-8">
                                    <div className="flex gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 flex-1 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 transition-colors hover:border-primary/30 group">
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 pl-0.5">Tempo Médio</span>
                                            <span className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 group-hover:scale-105 transition-transform origin-left">
                                                <Calendar className="w-5 h-5 text-primary drop-shadow-[0_2px_4px_rgba(16,185,129,0.2)]" />
                                                {selectedItem.raw.duration_minutes}m
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 flex-1 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 transition-colors hover:border-emerald-500/30 group">
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 pl-0.5">Valor Base</span>
                                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight group-hover:scale-105 transition-transform origin-left">
                                                R$ {Number(selectedItem.raw.price).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-900/30 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                        <div className="relative shrink-0 flex items-center justify-center w-3 h-3">
                                            {selectedItem.raw.is_active && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-30"></div>}
                                            <div className={`w-2.5 h-2.5 rounded-full relative z-10 ${selectedItem.raw.is_active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                                        </div>
                                        <span className="text-[15px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                            {selectedItem.raw.is_active ? 'Este serviço está ativo e disponível para agendamentos na clínica.' : 'Este serviço está pausado no momento.'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {selectedItem.type === 'professional' && (
                                <div className="space-y-6 mb-8">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Especialidade Principal</span>
                                        <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 w-full px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                            <Star className="w-5 h-5 text-amber-500 shrink-0 drop-shadow-[0_2px_4px_rgba(245,158,11,0.2)]" />
                                            {selectedItem.raw.specialty || 'Profissional Multidisciplinar'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-900/30 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                                        <div className="relative shrink-0 flex items-center justify-center w-3 h-3">
                                            {selectedItem.raw.is_active && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-30"></div>}
                                            <div className={`w-2.5 h-2.5 rounded-full relative z-10 ${selectedItem.raw.is_active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                                        </div>
                                        <span className="text-[15px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                            {selectedItem.raw.is_active ? 'Faz parte da equipe ativa e está aceitando horários.' : 'Perfil inativo ou afastado temporariamente.'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.12)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.2)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 text-[15px]"
                                onClick={() => {
                                    setSelectedItem(null);
                                    if (selectedItem.type === 'client') onPageChange('clientes');
                                    else if (selectedItem.type === 'service') onPageChange('servicos');
                                    else if (selectedItem.type === 'professional') onPageChange('profissionais');
                                }}
                            >
                                <span className="opacity-90">Ir para</span> {selectedItem.type === 'client' ? 'Clientes' : selectedItem.type === 'service' ? 'Serviços' : 'Equipe'}
                                <div className="ml-1 w-5 h-5 bg-white/20 dark:bg-black/10 rounded-full flex items-center justify-center opacity-70">
                                    →
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
