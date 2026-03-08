import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, Scissors, Star, Calendar, X, Loader2, Phone, Briefcase, Menu, Cpu } from 'lucide-react';
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
}

type SearchResult = {
    id: string;
    type: 'client' | 'service' | 'professional';
    title: string;
    subtitle: string;
    raw: any;
};

export const Navbar = ({ currentPageId, user, onMenuClick }: NavbarProps) => {
    const pageLabel = menuItems.find(i => i.id === currentPageId)?.label;
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAsRead } = useNotifications();

    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery] = useDebounce(searchQuery, 400);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

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

                if (clientsRes.data) {
                    clientsRes.data.forEach(c => results.push({
                        id: c.id,
                        type: 'client',
                        title: c.name,
                        subtitle: c.phone || 'Sem telefone',
                        raw: c
                    }));
                }

                if (servicesRes.data) {
                    servicesRes.data.forEach(s => results.push({
                        id: s.id,
                        type: 'service',
                        title: s.name,
                        subtitle: `${s.duration_minutes} min • R$ ${s.price}`,
                        raw: s
                    }));
                }

                if (prosRes.data) {
                    prosRes.data.forEach(p => results.push({
                        id: p.id,
                        type: 'professional',
                        title: p.name,
                        subtitle: p.specialty || 'Profissional',
                        raw: p
                    }));
                }

                setSearchResults(results);
            } catch (error) {
                console.error("Erro na busca global:", error);
            } finally {
                setIsSearching(false);
            }
        };

        fetchResults();
    }, [debouncedQuery]);

    const getIconForType = (type: string) => {
        switch (type) {
            case 'client': return <UserIcon className="w-4 h-4 text-primary" />;
            case 'service': return <Scissors className="w-4 h-4 text-primary" />;
            case 'professional': return <Star className="w-4 h-4 text-primary" />;
            default: return <Search className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <header className="h-20 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors z-30 relative">
            {/* Background Decoration Container */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-full bg-primary/5 -skew-x-12 translate-x-32"></div>
            </div>

            <div className="flex items-center gap-6 relative z-10 text-slate-950 dark:text-white">
                <button
                    onClick={onMenuClick}
                    className="p-3 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-none hover:bg-primary dark:hover:bg-primary transition-all md:hidden shadow-xl shadow-black/10 flex items-center justify-center shrink-0"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Módulo Ativo</span>
                    <h2 className="text-sm md:text-base font-black uppercase tracking-[0.2em] flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-primary animate-pulse" />
                        {pageLabel}
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
                {/* Global Search Input */}
                <div className="relative hidden sm:block" ref={searchRef}>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            className="pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-900 focus:border-primary/50 rounded-sm text-[11px] font-black uppercase tracking-widest w-72 dark:text-slate-200 outline-none transition-all placeholder:text-slate-500"
                            placeholder="Buscar no sistema..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (!showResults) setShowResults(true);
                            }}
                            onFocus={() => {
                                if (searchQuery.trim()) setShowResults(true);
                            }}
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchQuery.trim() && (
                        <div className="absolute top-full right-0 mt-3 w-96 bg-white dark:bg-slate-950 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-900 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-xl">
                            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center transition-colors">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resultados Encontrados [{searchResults.length}]</p>
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 rounded-full bg-primary/50"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary/30"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary/10"></div>
                                </div>
                            </div>

                            {searchResults.length > 0 ? (
                                <div className="max-h-96 overflow-y-auto p-2 space-y-1">
                                    {searchResults.map((item) => (
                                        <button
                                            key={`${item.type}-${item.id}`}
                                            className="w-full text-left p-4 hover:bg-slate-950 group transition-all flex items-center gap-5 border border-transparent hover:border-primary/20 relative"
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setShowResults(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm group-hover:border-primary/50 flex items-center justify-center transition-all shrink-0 shadow-lg">
                                                {getIconForType(item.type)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">{item.type}</span>
                                                    <div className="w-0 group-hover:w-8 h-[1px] bg-primary transition-all"></div>
                                                </div>
                                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">{item.title}</p>
                                                <p className="text-[10px] font-bold text-slate-500 truncate">{item.subtitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : !isSearching ? (
                                <div className="p-12 text-center">
                                    <div className="inline-flex p-4 bg-slate-200 dark:bg-slate-900 rounded-sm mb-4">
                                        <X className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Busca Sem Resultados</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-900 pl-4 ml-2">
                    <button
                        onClick={toggleTheme}
                        className="p-3 text-slate-500 hover:text-primary transition-all rounded-sm hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                    >
                        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`p-3 transition-all rounded-sm border relative group ${showNotifications ? 'bg-slate-50 dark:bg-slate-900 border-primary/50 text-primary' : 'text-slate-500 hover:text-primary bg-transparent border-transparent hover:border-slate-200 dark:hover:border-slate-800'}`}
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-sm border-2 border-white dark:border-slate-950 shadow-[0_0_10px_var(--primary)]"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                                <div className="absolute right-0 mt-3 w-96 bg-white dark:bg-slate-950 rounded-sm shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-slate-200 dark:border-slate-900 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="p-5 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between bg-white dark:bg-slate-950 relative overflow-hidden transition-colors">
                                        <div className="absolute inset-0 bg-primary/5 -skew-x-12 translate-x-24"></div>
                                        <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-[0.2em] relative z-10">Notificações</h3>
                                        <span className="relative z-10 text-[9px] bg-primary text-slate-950 px-3 py-1 rounded-sm font-black uppercase tracking-widest animate-pulse">{unreadCount} Novas</span>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-900 bg-white dark:bg-slate-950 custom-scrollbar">
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`p-5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer group relative overflow-hidden`}
                                                    onClick={() => {
                                                        markAsRead(n.id);
                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    {!n.is_read && <div className="absolute left-0 top-0 w-1 h-full bg-primary group-hover:w-1.5 transition-all"></div>}
                                                    <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${!n.is_read ? 'text-slate-950 dark:text-white' : 'text-slate-500'}`}>{n.title}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-relaxed mb-3">{n.message}</p>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[9px] font-mono text-primary font-black uppercase">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-800 group-hover:w-full group-hover:bg-primary/20 transition-all ml-4"></div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-16 text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Nenhuma notificação</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 text-center transition-colors">
                                        <button className="text-[9px] font-black text-primary hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.3em] transition-all">Limpar todas notificações</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick View Modal [Redesigned for Silk & Steel] */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedItem(null);
                }}>
                    <div className="bg-white dark:bg-slate-950 rounded-sm shadow-[0_50px_100px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-100 dark:border-slate-900 relative">
                        {/* Industrial Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-start justify-between bg-white dark:bg-slate-950 relative overflow-hidden transition-colors">
                            <div className="absolute top-0 right-0 w-32 h-full bg-primary/10 -skew-x-12 translate-x-16"></div>
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm shadow-2xl group transition-all">
                                    <div className="text-primary group-hover:scale-110 transition-transform">
                                        {getIconForType(selectedItem.type)}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                                            {selectedItem.type === 'client' ? 'Cliente' : selectedItem.type === 'professional' ? 'Profissional' : 'Serviço'}
                                        </p>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter leading-none">{selectedItem.title}</h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-500 hover:text-primary transition-all relative z-10 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Technical Content */}
                        <div className="p-8 space-y-6 bg-white dark:bg-slate-950">
                            {selectedItem.type === 'client' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Comunicação</p>
                                            <div className="flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-black text-slate-950 dark:text-white uppercase">{selectedItem.raw.phone || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Data de Registro</p>
                                            <div className="flex items-center gap-3">
                                                <Calendar className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-black text-slate-950 dark:text-white uppercase">{new Date(selectedItem.raw.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 border-l-2 border-primary bg-primary/5">
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Registro de unidade cliente ativo no sistema.</p>
                                    </div>
                                </>
                            )}

                            {selectedItem.type === 'service' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-900">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duração do Serviço</span>
                                        <span className="text-lg font-black text-primary font-mono">{selectedItem.raw.duration_minutes} MIN</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-primary text-slate-950">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Valor do Serviço</span>
                                        <span className="text-2xl font-black">R$ {selectedItem.raw.price}</span>
                                    </div>
                                </div>
                            )}

                            {selectedItem.type === 'professional' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-950 border border-slate-900">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Especialização</p>
                                        <div className="flex items-center gap-4 text-primary">
                                            <Briefcase className="w-5 h-5" />
                                            <span className="text-sm font-black uppercase tracking-tighter">{selectedItem.raw.specialty || 'GENERALISTA'}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-center pt-4">
                                        <span className={`inline-flex items-center px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] ${selectedItem.raw.is_active ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                                            Status: {selectedItem.raw.is_active ? 'ATIVO' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Decoration */}
                        <div className="h-6 bg-slate-50 dark:bg-slate-950 flex items-center justify-between px-6 border-t border-slate-100 dark:border-slate-900 transition-colors">
                            <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1 h-3 bg-slate-100 dark:bg-slate-900 border-x border-slate-200 dark:border-slate-800 text-transparent">.</div>)}
                            </div>
                            <span className="text-[8px] font-mono text-slate-400 dark:text-slate-700">ID: {selectedItem.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
