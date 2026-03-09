import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface Notification {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
    addNotification: (title: string, message: string, link?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotifications([]);
            return;
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotifications(data);
        }
    };

    useEffect(() => {
        let channel: any;

        const init = async () => {
            await fetchNotifications();
            if (!channel) {
                channel = supabase
                    .channel('notifications_changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                        fetchNotifications();
                    })
                    .subscribe();
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                init();
            } else {
                setNotifications([]);
                if (channel) {
                    supabase.removeChannel(channel);
                    channel = null;
                }
            }
        });

        init();

        return () => {
            if (channel) supabase.removeChannel(channel);
            subscription.unsubscribe();
        };
    }, []);

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    const clearAll = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id);

        if (!error) {
            setNotifications([]);
            toast.success('Notificações removidas');
        } else {
            console.error('Erro ao limpar notificações:', error);
            toast.error('Erro ao limpar notificações do banco de dados');
        }
    };

    const addNotification = async (title: string, message: string, link?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('notifications').insert({
            user_id: user.id,
            title,
            message,
            link
        });

        if (error) {
            console.error('Erro ao adicionar notificação:', error);
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, clearAll, addNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};
