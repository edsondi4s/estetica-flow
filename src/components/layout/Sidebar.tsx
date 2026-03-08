import { useState, useEffect } from 'react';
import { Scissors, LogOut, X, ChevronRight } from 'lucide-react';
import { MenuItem, menuItems } from '../../types/navigation';
import { User } from '@supabase/supabase-js';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
    currentPage: string;
    onPageChange: (id: string) => void;
    user: User;
    onLogout: () => Promise<void>;
    isMobileOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar = ({ currentPage, onPageChange, user, onLogout, isMobileOpen, onClose }: SidebarProps) => {
    const { theme, settings } = useTheme();
    const [chatCount, setChatCount] = useState(0);
    const currentLogo = theme === 'dark' && settings.logo_url_dark ? settings.logo_url_dark : settings.logo_url;

    useEffect(() => {
        fetchChatCount();

        const channel = supabase
            .channel('chat_count_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_chat_history' }, () => {
                fetchChatCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchChatCount = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select('sender_number')
                .eq('user_id', user.id)
                .neq('role', '__rstate__');

            if (!error && data) {
                const uniqueNumbers = new Set(data.map(item => item.sender_number).filter(Boolean));
                setChatCount(uniqueNumbers.size);
            }
        } catch (err) {
            console.error('Error fetching chat count:', err);
        }
    };

    return (
        <>
            {/* Overlay for Mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 md:hidden animate-in fade-in duration-300"
                    onClick={onClose}
                />
            )}

            <aside className={`
                w-64 bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-900 flex flex-col 
                fixed md:static inset-y-0 left-0 z-50 transition-all duration-500 transform
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Header / Logo Section */}
                <div className="p-6 h-28 flex flex-col justify-center border-b border-slate-50 dark:border-slate-900 relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-0 group-hover:h-full bg-primary transition-all duration-500"></div>

                    {/* Close Button Mobile */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-primary md:hidden transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {currentLogo ? (
                        <div className="relative z-10 w-full h-12 flex items-center justify-center">
                            <img
                                src={currentLogo}
                                alt="Logo"
                                className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
                            />
                        </div>
                    ) : (
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center rounded-sm shrink-0">
                                <Scissors className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-[0.2em] leading-tight truncate">
                                    {settings.business_name}
                                </h1>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Command Center</p>
                            </div>
                        </div>
                    )}

                    {/* Industrial Decoration */}
                    <div className="absolute bottom-1 right-2 text-[8px] font-mono text-slate-100 dark:text-slate-900 uppercase tracking-widest pointer-events-none">
                        V4.0 ESTÁVEL
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <p className="px-4 py-2 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em] mb-2">Sistema / Módulos</p>
                    {menuItems.map((item: MenuItem) => (
                        <button
                            key={item.id}
                            onClick={() => onPageChange(item.id)}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all relative group overflow-hidden
                                ${currentPage === item.id
                                    ? 'bg-slate-50 dark:bg-slate-900 text-primary shadow-xl border border-slate-100 dark:border-slate-800'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-950 dark:hover:text-white border border-transparent'
                                }
                            `}
                        >
                            {/* Active Indicator */}
                            {currentPage === item.id && (
                                <div className="absolute left-0 top-0 w-1 h-full bg-primary shadow-[0_0_10px_var(--primary)]"></div>
                            )}

                            <item.icon className={`
                                w-4 h-4 transition-all duration-300
                                ${currentPage === item.id ? 'text-primary scale-110' : 'text-slate-400 group-hover:text-primary'}
                            `} />

                            <span className={`
                                text-[11px] font-black flex-1 text-left uppercase tracking-widest
                                ${currentPage === item.id ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}
                            `}>
                                {item.label}
                            </span>

                            {item.id === 'chat' && chatCount > 0 && (
                                <span className={`
                                    px-2 py-0.5 rounded-sm text-[9px] font-black
                                    ${currentPage === 'chat'
                                        ? 'bg-primary text-slate-950'
                                        : 'bg-slate-900 dark:bg-slate-800 text-primary border border-primary/30 shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]'
                                    }
                                `}>
                                    {chatCount}
                                </span>
                            )}

                            <ChevronRight className={`
                                w-3 h-3 transition-all duration-300
                                ${currentPage === item.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}
                            `} />
                        </button>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-4 border-t border-slate-50 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-sm group cursor-default shadow-sm hover:border-primary/30 transition-all overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all"></div>

                        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 flex items-center justify-center text-primary font-black text-sm shrink-0 rounded-sm relative z-10 transition-colors">
                            {user.user_metadata?.full_name?.[0] || user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1 relative z-10">
                            <p className="text-[11px] font-black text-slate-950 dark:text-white truncate uppercase leading-none mb-1">
                                {user.user_metadata?.full_name || 'Usuário'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 truncate uppercase tracking-tighter">ID: {user.email?.split('@')[0]}</p>
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 text-rose-500 border border-slate-100 dark:border-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] group"
                    >
                        <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                        Encerrar Sessão
                    </button>

                    <div className="mt-4 flex justify-center">
                        <div className="w-24 h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/20 w-1/3 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};
