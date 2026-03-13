import { supabase } from '../lib/supabase';
import { withLock, getOrSetCache } from '../lib/redis-utils';

export interface AppointmentData {
  userId: string;
  clientId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
}

/**
 * Exemplo de Serviço de Agendamento utilizando Redis para garantir integridade.
 */
export class AppointmentService {
  
  /**
   * Busca os serviços da clínica com Cache para evitar hits desnecessários no DB.
   */
  async getClinicServices(userId: string) {
    return getOrSetCache(`services:${userId}`, async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }, 600); // 10 minutos de cache
  }

  /**
   * Realiza um agendamento com "Distributed Lock" para evitar conflito de horários.
   */
  async bookAppointment(data: AppointmentData) {
    const lockKey = `appointment:${data.professionalId}:${data.date}:${data.time}`;

    // Protege o bloco de execução para garantir que ninguém mais agende este mesmo horário
    // enquanto este processo está verificando e inserindo no banco de dados.
    return withLock(lockKey, async () => {
      
      // 1. Verificar se o horário ainda está disponível no DB
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('professional_id', data.professionalId)
        .eq('appointment_date', data.date)
        .eq('appointment_time', data.time)
        .neq('status', 'Cancelado')
        .single();

      if (existing) {
        throw new Error('Este horário acabou de ser preenchido por outra pessoa.');
      }

      // 2. Realizar o agendamento
      const { data: newAppt, error } = await supabase
        .from('appointments')
        .insert({
          user_id: data.userId,
          client_id: data.clientId,
          service_id: data.serviceId,
          professional_id: data.professionalId,
          appointment_date: data.date,
          appointment_time: data.time,
          status: 'Confirmado'
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Opcional: Invalidar cache de horários se houver algum
      // await redis.del(`available_slots:${data.userId}:${data.date}`);

      return newAppt;
    });
  }
}
