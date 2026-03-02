/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Scissors, 
  DollarSign, 
  Settings, 
  LogOut, 
  Bell,
  Search,
  Plus,
  TrendingUp,
  MoreHorizontal,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Droplets,
  UserPlus,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  SortAsc,
  Camera,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Components for each screen ---

const Dashboard = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition-colors">
              <Calendar className="text-indigo-600 w-6 h-6" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +5%
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1">Próximos Agendamentos</p>
          <h3 className="text-slate-900 text-3xl font-bold tracking-tight">12 <span className="text-lg font-normal text-slate-400">Hoje</span></h3>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <Users className="text-emerald-600 w-6 h-6" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12%
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1">Total de Clientes</p>
          <h3 className="text-slate-900 text-3xl font-bold tracking-tight">1.234</h3>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition-colors">
              <DollarSign className="text-amber-600 w-6 h-6" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +8%
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1">Receita do Mês</p>
          <h3 className="text-slate-900 text-3xl font-bold tracking-tight">R$ 45.200</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white">
          <h3 className="text-lg font-bold text-slate-800">Atividade Recente</h3>
          <button className="text-sm text-primary-dark font-medium hover:text-primary transition-colors flex items-center gap-1">
            Ver Tudo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Serviço</th>
                <th className="px-6 py-4 font-semibold">Profissional</th>
                <th className="px-6 py-4 font-semibold">Horário</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {[
                { name: 'Ana Silva', initials: 'AS', service: 'Aplicação de Botox', pro: 'Dra. Julia', time: '14:00', status: 'Confirmado', color: 'bg-indigo-100 text-indigo-600' },
                { name: 'Beatriz Costa', initials: 'BC', service: 'Depilação a Laser', pro: 'Téc. Marcos', time: '15:30', status: 'Pendente', color: 'bg-purple-100 text-purple-600' },
                { name: 'Carla Dias', initials: 'CD', service: 'Limpeza de Pele', pro: 'Dra. Julia', time: '16:45', status: 'Concluído', color: 'bg-pink-100 text-pink-600' },
                { name: 'Daniela Souza', initials: 'DS', service: 'Microagulhamento', pro: 'Téc. Marcos', time: '10:00', status: 'Cancelado', color: 'bg-orange-100 text-orange-600' },
                { name: 'Elena Lima', initials: 'EL', service: 'Consulta', pro: 'Dra. Julia', time: '11:15', status: 'Confirmado', color: 'bg-teal-100 text-teal-600' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${row.color}`}>{row.initials}</div>
                      <span className="font-medium text-slate-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{row.service}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(https://picsum.photos/seed/${row.pro}/100)` }}></div>
                      <span className="text-slate-600">{row.pro}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">{row.time}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row.status === 'Confirmado' ? 'bg-green-100 text-green-800' :
                      row.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                      row.status === 'Concluído' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Serviços Populares</h3>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {[
              { name: 'HydraFacial', count: 24, percent: 35, icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
              { name: 'Tratamento com Botox', count: 18, percent: 28, icon: Scissors, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((service, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`${service.bg} p-2 rounded-lg ${service.color}`}>
                      <service.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                      <p className="text-xs text-slate-500">{service.count} agendamentos esta semana</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{service.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${service.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary to-purple-400 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Ações Rápidas</h3>
            <p className="text-white/80 text-sm mb-6">Gerencie sua clínica de forma eficiente com esses atalhos.</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex flex-col gap-2">
                <CalendarPlus className="w-6 h-6" />
                <span className="text-sm font-medium">Novo Agendamento</span>
              </button>
              <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-left transition-colors flex flex-col gap-2">
                <UserPlus className="w-6 h-6" />
                <span className="text-sm font-medium">Adicionar Cliente</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Clientes = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Último Atendimento</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[
                { name: 'Ana Silva', initials: 'AS', phone: '(11) 99999-1234', email: 'ana.silva@email.com', date: '15 Out 2023', color: 'bg-purple-100 text-purple-700' },
                { name: 'Beatriz Costa', initials: 'BC', phone: '(21) 98888-5678', email: 'bia.costa@email.com', date: '12 Out 2023', color: 'bg-pink-100 text-pink-700' },
                { name: 'Carla Souza', initials: 'CS', phone: '(31) 97777-4321', email: 'carla.souza@email.com', date: '05 Out 2023', color: 'bg-blue-100 text-blue-700' },
                { name: 'Daniela Lima', initials: 'DL', phone: '(41) 96666-8765', email: 'dani.lima@email.com', date: '01 Out 2023', color: 'bg-orange-100 text-orange-700' },
                { name: 'Elena Martins', initials: 'EM', phone: '(51) 95555-0987', email: 'elena.martins@email.com', date: '28 Set 2023', color: 'bg-teal-100 text-teal-700' },
              ].map((client, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${client.color}`}>{client.initials}</div>
                      <span className="text-sm font-medium text-slate-900">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{client.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{client.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{client.date}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-500">Mostrando 1 a 5 de 124 resultados</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50">Anterior</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors">Próximo</button>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 bg-primary hover:bg-primary-dark text-white p-4 rounded-full shadow-lg transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Cadastrar Novo Cliente</h3>
                  <p className="text-sm text-slate-500">Preencha as informações para adicionar um novo cliente.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                  <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" placeholder="Ex: Maria Oliveira" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Telefone</label>
                  <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" placeholder="cliente@email.com" />
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancelar</button>
                <button className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm">Salvar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Agenda = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm">
            <button className="p-1.5 hover:bg-slate-50 rounded-l-lg text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
            <button className="p-1.5 hover:bg-slate-50 rounded-r-lg text-slate-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <h2 className="text-lg font-bold text-slate-900 ml-2">Outubro 2023</h2>
          <button className="ml-2 text-xs font-medium text-slate-500 hover:text-primary border border-slate-200 px-2 py-1 rounded bg-white">Hoje</button>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button className="px-3 py-1 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900">Dia</button>
          <button className="px-3 py-1 text-sm font-medium rounded-md bg-white text-slate-900 shadow-sm">Semana</button>
          <button className="px-3 py-1 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900">Mês</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white relative">
        <div className="grid grid-cols-8 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="h-14 border-r border-slate-100 flex items-center justify-center text-xs text-slate-400">GMT-3</div>
          {['SEG 23', 'TER 24', 'QUA 25', 'QUI 26', 'SEX 27', 'SÁB 28', 'DOM 29'].map((day, i) => (
            <div key={i} className={`flex flex-col items-center justify-center py-2 border-r border-slate-100 ${i === 1 ? 'bg-primary/5' : ''}`}>
              <span className={`text-xs font-medium ${i === 1 ? 'text-primary' : 'text-slate-500'}`}>{day.split(' ')[0]}</span>
              <span className={`text-lg font-bold ${i === 1 ? 'text-primary' : 'text-slate-900'}`}>{day.split(' ')[1]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8 relative h-[800px]">
          <div className="border-r border-slate-100 bg-slate-50/50">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-20 border-b border-slate-100 text-xs text-slate-400 p-2 text-right relative">
                <span className="-top-3 relative">{`${(i + 8).toString().padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`border-r border-slate-100 relative ${i === 1 ? 'bg-slate-50/30' : ''}`}>
              {Array.from({ length: 12 }).map((_, j) => (
                <div key={j} className="h-20 border-b border-slate-100"></div>
              ))}
              {i === 0 && (
                <div className="absolute top-[80px] left-0 w-full p-1 z-10">
                  <div className="bg-blue-100 border-l-4 border-blue-500 p-2 rounded text-xs h-[100px] shadow-sm">
                    <p className="font-bold text-slate-800">Limpeza de Pele</p>
                    <p className="text-slate-600 mt-1">Mariana Costa</p>
                    <div className="flex items-center gap-1 mt-2 text-slate-500">
                      <Clock className="w-3 h-3" /> 09:00 - 10:30
                    </div>
                  </div>
                </div>
              )}
              {i === 1 && (
                <div className="absolute top-[160px] left-0 w-full p-1 z-10">
                  <div className="bg-pink-100 border-l-4 border-pink-500 p-2 rounded text-xs h-[80px] shadow-sm ring-2 ring-primary ring-offset-2">
                    <p className="font-bold text-slate-800">Botox Facial</p>
                    <p className="text-slate-600 mt-1">Carla Souza</p>
                    <div className="flex items-center gap-1 mt-1 text-slate-500">
                      <Clock className="w-3 h-3" /> 10:00 - 11:00
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Servicos = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[
          { name: 'Limpeza de Pele Profunda', desc: 'Remoção de impurezas e renovação celular para uma pele radiante.', time: '60 min', price: '150,00', category: 'Facial', img: 'facial' },
          { name: 'Peeling Químico', desc: 'Tratamento avançado para manchas, acne e rejuvenescimento.', time: '45 min', price: '200,00', category: 'Facial', img: 'peeling' },
          { name: 'Drenagem Linfática', desc: 'Massagem suave para reduzir retenção de líquidos e inchaço.', time: '50 min', price: '120,00', category: 'Corporal', img: 'massage' },
          { name: 'Microagulhamento', desc: 'Estimulação intensa de colágeno para cicatrizes e linhas finas.', time: '90 min', price: '350,00', category: 'Facial', img: 'microneedling' },
        ].map((service, i) => (
          <div key={i} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-primary/50 hover:shadow-md">
            <div className="aspect-[4/3] w-full bg-slate-100 bg-cover bg-center" style={{ backgroundImage: `url(https://picsum.photos/seed/${service.img}/400/300)` }}></div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-primary-dark">
                <span className="rounded-full bg-primary/20 px-2 py-0.5">{service.category}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{service.desc}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{service.time}</span>
                </div>
                <span className="text-lg font-bold text-slate-900">R$ {service.price}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Financeiro = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Saldo Total</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">R$ 12.450,00</p>
            <div className="flex items-center gap-1 mt-1 text-emerald-600 text-sm font-medium">
              <TrendingUp className="w-4 h-4" /> <span>+12%</span>
              <span className="text-slate-400 font-normal ml-1">vs mês anterior</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Receitas (Mês)</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">R$ 18.200,00</p>
            <div className="flex items-center gap-1 mt-1 text-emerald-600 text-sm font-medium">
              <TrendingUp className="w-4 h-4" /> <span>+8%</span>
              <span className="text-slate-400 font-normal ml-1">vs mês anterior</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <TrendingUp className="w-5 h-5 rotate-180" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Despesas (Mês)</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">R$ 5.750,00</p>
            <div className="flex items-center gap-1 mt-1 text-rose-600 text-sm font-medium">
              <TrendingUp className="w-4 h-4" /> <span>-3%</span>
              <span className="text-slate-400 font-normal ml-1">vs mês anterior</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Fluxo de Caixa</h3>
        <div className="h-64 flex items-end justify-between gap-4 px-2">
          {[60, 75, 50, 85, 65, 90].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
              <div className="relative w-full flex justify-center items-end gap-1" style={{ height: `${h}%` }}>
                <div className="w-3 bg-emerald-400 rounded-t-sm h-[80%] group-hover:bg-emerald-500 transition-colors"></div>
                <div className="w-3 bg-rose-400 rounded-t-sm h-[40%] group-hover:bg-rose-500 transition-colors"></div>
              </div>
              <span className="text-xs font-medium text-slate-500">{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Configuracoes = () => {
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
              <Camera className="w-8 h-8 text-slate-400" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Logo da Clínica</h3>
            <p className="text-sm text-slate-500">Recomendado: 400x400px, JPG ou PNG.</p>
            <div className="flex gap-3 mt-4">
              <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">Carregar nova</button>
              <button className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-all">Remover</button>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Nome da Clínica</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50" defaultValue="EstéticaFlow Matriz" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Telefone de Contato</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50" placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">E-mail Comercial</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50" defaultValue="contato@esteticaflow.com.br" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <textarea className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} placeholder="Rua, Número, Bairro, Cidade - UF, CEP" />
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
            <button className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancelar</button>
            <button className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all">
              <Save className="w-4 h-4" /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-12"
      >
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary-dark flex items-center justify-center">
            <Scissors className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-black text-primary-dark mb-2">EstéticaFlow</h2>
        <h3 className="text-center text-xl font-bold text-slate-900 mb-2">Bem-vinda de volta</h3>
        <p className="text-center text-sm text-slate-500 mb-10">Entre na sua conta para gerenciar sua clínica</p>
        
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50" placeholder="seu@email.com" type="email" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <div className="relative">
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50" placeholder="Sua senha secreta" type="password" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <EyeOff className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-primary focus:ring-primary" />
              <span className="text-sm text-slate-600">Lembrar-me</span>
            </label>
            <a href="#" className="text-sm font-semibold text-primary-dark hover:text-primary">Esqueci minha senha</a>
          </div>
          <button className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all">
            Entrar
          </button>
        </form>
        
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider text-slate-400"><span className="bg-white px-4">OU</span></div>
        </div>
        
        <button className="w-full flex items-center justify-center gap-3 border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M12.0003 20.45c4.6483 0 8.545-3.2355 9.5936-7.702h-9.5936v-3.798h13.803c.123.637.189 1.303.189 1.99 0 7.363-5.029 12.55-12.046 12.55-6.627 0-12-5.373-12-12s5.373-12 12-12c3.15 0 6.027 1.134 8.283 3.018l-3.328 3.328c-1.077-.999-2.738-1.798-4.955-1.798-4.329 0-7.85 3.52-7.85 7.85s3.521 7.85 7.85 7.85V20.45z" fill="#4285F4" />
          </svg>
          Entrar com Google
        </button>
        
        <p className="text-center text-sm text-slate-500 mt-8">
          Não tem uma conta? <a href="#" className="font-bold text-primary-dark hover:text-primary">Criar conta gratuitamente</a>
        </p>
      </motion.div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'servicos', label: 'Serviços', icon: Scissors },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'clientes': return <Clientes />;
      case 'agenda': return <Agenda />;
      case 'servicos': return <Servicos />;
      case 'financeiro': return <Financeiro />;
      case 'configuracoes': return <Configuracoes />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background-light overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-dark flex items-center justify-center">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">EstéticaFlow</h1>
            <p className="text-xs text-slate-500">Painel Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentPage === item.id 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${currentPage === item.id ? 'text-white' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
            <img 
              src="https://picsum.photos/seed/sarah/100" 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-slate-100"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">Dra. Sarah M.</p>
              <p className="text-xs text-slate-500 truncate">Esteticista Chefe</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {menuItems.find(i => i.id === currentPage)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50 w-64" 
                placeholder="Buscar..." 
              />
            </div>
            <button className="p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-slate-50 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <button className="p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-slate-50">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
