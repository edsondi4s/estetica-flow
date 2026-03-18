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
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-luxury shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    {getIconForType(selectedItem.type)}
                                </div>
                                <div>
                                    <p className="text-xs text-primary font-medium tracking-wider uppercase mb-1">{selectedItem.type}</p>
                                    <h3 className="text-xl font-serif text-slate-800 dark:text-white leading-tight">{selectedItem.title}</h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 dark:bg-slate-900 rounded-full"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">{selectedItem.subtitle}</p>
                            <button className="w-full py-2.5 bg-primary text-white rounded-luxury font-medium luxury-hover text-sm">Acessar Detalhes</button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
