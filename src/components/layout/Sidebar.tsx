import { useState, useEffect } from 'react';
import { Scissors, LogOut, X, ChevronRight } from 'lucide-react';
import { MenuItem, menuItems } from '../../types/navigation';
import { User } from '@supabase/supabase-js';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';

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
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        return saved === 'true';
    });

    const currentLogo = theme === 'dark' && settings.logo_url_dark ? settings.logo_url_dark : settings.logo_url;

    useEffect(() => {
        localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
    }, [isCollapsed]);

    useEffect(() => {
        fetchChatCount();
        const channel = supabase
            .channel('chat_count_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_chat_history' }, () => {
                fetchChatCount();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
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
            {isMobileOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300" onClick={onClose} />
            )}

            <aside className={`
                bg-white dark:bg-slate-900 border-r border-[#10B981]/10 flex flex-col h-full min-h-0
                fixed md:static inset-y-0 left-0 z-50 transition-all duration-500 transform
                ${isCollapsed ? 'w-20' : 'w-64'}
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Brand / Logo */}
                <div className={`px-6 h-28 flex items-center relative transition-all duration-500 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <button onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-primary md:hidden transition-colors z-50">
                        <X className="w-5 h-5" />
                    </button>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-500">
                            {currentLogo ? (
                                <div className="h-12 flex items-center">
                                    <img src={currentLogo} alt="Logo" className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-luxury shrink-0 text-primary">
                                        <Scissors className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-lg font-serif text-slate-900 dark:text-white truncate">
                                            {settings.business_name}
                                        </h1>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Gestão Premium</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`hidden md:flex items-center justify-center rounded-full transition-all border border-transparent hover:border-primary/30 bg-primary/5 text-primary ${isCollapsed ? 'w-10 h-10' : 'p-2 ml-4'}`}
                        title={isCollapsed ? "Expandir" : "Recolher"}
                    >
                        <motion.div animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.5, ease: "anticipate" }}>
                            <ChevronRight className="w-4 h-4" />
                        </motion.div>
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item: MenuItem) => (
                        <button
                            key={item.id}
                            title={isCollapsed ? item.label : undefined}
                            onClick={() => onPageChange(item.id)}
                            className={`
                                w-full flex items-center rounded-luxury transition-all relative group 
                                ${isCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-4'}
                                ${currentPage === item.id
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-slate-500 hover:bg-primary/5 hover:text-primary'
                                }
                            `}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!isCollapsed && (
                                <span className="text-sm font-medium flex-1 text-left tracking-wide truncate">
                                    {item.label}
                                </span>
                            )}
                            {!isCollapsed && item.id === 'chat' && chatCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${currentPage === 'chat' ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                                    {chatCount}
                                </span>
                            )}
                            {isCollapsed && item.id === 'chat' && chatCount > 0 && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </nav>

                {/* Footer User Profile */}
                <div className={`p-6 border-t border-[#10B981]/10 bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-500 ${isCollapsed ? 'items-center px-2' : ''}`}>
                    <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-primary/20 flex items-center justify-center text-primary font-serif rounded-luxury shrink-0 shadow-sm">
                            {user.user_metadata?.full_name?.[0] || user.email?.[0].toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {user.user_metadata?.full_name || 'Profissional'}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onLogout}
                        title={isCollapsed ? "Sair" : undefined}
                        className={`w-full mt-6 flex items-center justify-center text-rose-500/80 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-luxury transition-all text-sm font-medium group ${isCollapsed ? 'py-3' : 'py-2.5 gap-2'}`}
                    >
                        <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        {!isCollapsed && <span>Encerrar Sessão</span>}
                    </button>
                </div>
            </aside>
        </>
    );
};
