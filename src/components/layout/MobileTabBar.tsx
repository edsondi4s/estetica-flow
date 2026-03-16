import React, { useState, useEffect } from 'react';
import { menuItems } from '../../types/navigation';
import { motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

interface MobileTabBarProps {
    currentPageId: string;
    onPageChange: (id: string) => void;
    onMenuClick: () => void;
    user: User;
}

export const MobileTabBar = ({ currentPageId, onPageChange, onMenuClick, user }: MobileTabBarProps) => {
    // Select top 4 items for the tab bar
    const mainItems = menuItems.slice(0, 4);
    const [chatCount, setChatCount] = useState(0);

    useEffect(() => {
        fetchChatCount();

        const channel = supabase
            .channel('mobile_chat_count_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_chat_history' }, () => {
                fetchChatCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id]);

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
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-around px-2 py-3">
                {mainItems.map((item) => {
                    const isActive = currentPageId === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onPageChange(item.id)}
                            className={`flex flex-col items-center justify-center w-16 h-14 relative rounded-xl transition-all outline-none ${
                                isActive 
                                    ? 'text-primary' 
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="mobileTabIndicator"
                                    className="absolute inset-0 bg-primary/10 rounded-xl"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-1.5">
                                <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                                <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                                
                                {item.id === 'chat' && chatCount > 0 && (
                                    <span className="absolute -top-1 -right-2 bg-primary text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-950 shadow-sm">
                                        {chatCount > 9 ? '9+' : chatCount}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}

                {/* More / Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center w-16 h-14 relative rounded-xl transition-all text-slate-500 hover:text-slate-900 dark:hover:text-white outline-none"
                >
                    <div className="relative z-10 flex flex-col items-center gap-1.5">
                        <Menu className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Menu</span>
                    </div>
                </button>
            </div>
        </div>
    );
};
