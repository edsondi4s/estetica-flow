import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, Moon, Sun, User as UserIcon, Scissors, Star, Calendar, X, Loader2, Phone, Briefcase, Menu } from 'lucide-react';
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

// Interfaces for Global Search Results
type SearchResult = {
    id: string;
    type: 'client' | 'service' | 'professional';
    title: string;
    subtitle: string;
    raw: any; // Raw object for modal details
};

export const Navbar = ({ currentPageId, user, onMenuClick }: NavbarProps) => {
    const pageLabel = menuItems.find(i => i.id === currentPageId)?.label;
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAsRead } = useNotifications();

    const [showNotifications, setShowNotifications] = useState(false);

    // Global Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery] = useDebounce(searchQuery, 400);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

    // Close search dropdown on click outside
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
                // Pararel Search Queries
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
            case 'client': return <UserIcon className="w-4 h-4 text-blue-500" />;
            case 'service': return <Scissors className="w-4 h-4 text-emerald-500" />;
            case 'professional': return <Star className="w-4 h-4 text-amber-500" />;
            default: return <Search className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors z-30 relative">
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 text-slate-500 hover:text-primary transition-colors rounded-lg md:hidden"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white truncate">
                    {pageLabel}
                </h2>
            </div>
            <div className="flex items-center gap-4">

                {/* Global Search Input */}
                <div className="relative hidden sm:block" ref={searchRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-primary/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 w-64 dark:text-slate-200 outline-none transition-all"
                            placeholder="Buscar clientes, serviços..."
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
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchQuery.trim() && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.length > 0 ? (
                                <div className="max-h-80 overflow-y-auto py-2">
                                    <div className="px-3 pb-1 pt-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resultados ({searchResults.length})</p>
                                    </div>
                                    {searchResults.map((item) => (
                                        <button
                                            key={`${item.type}-${item.id}`}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors group"
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setShowResults(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-md group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors">
                                                {getIconForType(item.type)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : !isSearching ? (
                                <div className="p-4 text-center">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum resultado encontrado para "{searchQuery}"</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 relative"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-[10px] text-white font-bold rounded-full flex items-center justify-center border border-white dark:border-slate-900">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-900 dark:text-white">Notificações</h3>
                                    <span className="text-[10px] bg-primary/20 text-primary-dark dark:text-primary px-2 py-0.5 rounded-full font-bold uppercase">{unreadCount} novas</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                                onClick={() => {
                                                    markAsRead(n.id);
                                                    setShowNotifications(false);
                                                }}
                                            >
                                                <p className={`text-sm font-bold ${!n.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-2">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-slate-500">Nenhuma notificação por aqui.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-center">
                                    <button className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">Limpar tudo</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <button className="p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Quick View Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedItem(null);
                }}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
                        <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                    {getIconForType(selectedItem.type)}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {selectedItem.type === 'client' ? 'Cliente' : selectedItem.type === 'service' ? 'Serviço' : 'Profissional'}
                                    </p>
                                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{selectedItem.title}</h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {selectedItem.type === 'client' && (
                                <>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300">{selectedItem.raw.phone || 'Sem telefone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300">Cliente desde {new Date(selectedItem.raw.created_at).toLocaleDateString()}</span>
                                    </div>
                                </>
                            )}

                            {selectedItem.type === 'service' && (
                                <>
                                    <div className="flex items-center justify-between text-sm py-2 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-slate-500">Duração</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{selectedItem.raw.duration_minutes} min</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-2">
                                        <span className="text-slate-500">Preço</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {selectedItem.raw.price}</span>
                                    </div>
                                    <div className="mt-2 text-center">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase ${selectedItem.raw.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {selectedItem.raw.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                </>
                            )}

                            {selectedItem.type === 'professional' && (
                                <>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Briefcase className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300">{selectedItem.raw.specialty || 'Não informada'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm mt-3">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300">{selectedItem.raw.phone || 'Sem telefone'}</span>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase ${selectedItem.raw.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {selectedItem.raw.is_active ? 'Ativo na Clínica' : 'Inativo'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
