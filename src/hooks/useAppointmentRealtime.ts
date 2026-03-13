import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';

export function useAppointmentRealtime() {
    useEffect(() => {
        let channel: any;

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel('realtime_appointments')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'appointments',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('Novo agendamento recebido:', payload);
                        
                        // Disparar Toast
                        toast.success('Novo agendamento recebido! 🎉', {
                            duration: 5000,
                            icon: '📅',
                        });

                        // Disparar Confete
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6, x: 0.5 },
                            colors: ['#ff4d4d', '#3b82f6', '#10b981', '#f59e0b']
                        });
                    }
                )
                .subscribe();
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                init();
            } else {
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
}
