import { useState, useEffect } from 'react';
import { Scissors, LogOut, X } from 'lucide-react';
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
            // Conta quantos números únicos enviaram pelo menos uma mensagem (excluindo mensagens do sistema ou rstate se necessário)
            // Para simplicidade, vamos contar sender_numbers distintos que não sejam null
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
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
                w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col 
                fixed md:static inset-y-0 left-0 z-50 transition-all duration-300 transform 
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className={`p-6 flex items-center border-b border-slate-50 dark:border-slate-800 relative ${currentLogo ? 'justify-center' : 'gap-3'}`}>
                    {/* Close Button Mobile */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 md:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {currentLogo ? (
                        <div className="w-full h-16 flex items-center justify-center overflow-hidden">
                            <img
                                src={currentLogo}
                                alt="Logo"
                                className="max-w-full max-h-full object-contain pointer-events-none"
                            />
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-dark flex items-center justify-center overflow-hidden shrink-0">
                                <Scissors className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                                    {settings.business_name}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Painel Admin</p>
                            </div>
                        </>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item: MenuItem) => (
                        <button
                            key={item.id}
                            onClick={() => onPageChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group ${currentPage === item.id
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${currentPage === item.id ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>

                            {item.id === 'chat' && chatCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${currentPage === 'chat'
                                    ? 'bg-white text-primary'
                                    : 'bg-primary text-white shadow-sm'
                                    }`}>
                                    {chatCount}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-50 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/20 shrink-0">
                            {user.user_metadata?.full_name?.[0] || user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {user.user_metadata?.full_name || 'Usuário'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-semibold text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                    </button>
                </div>
            </aside>
        </>
    );
};
