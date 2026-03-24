import {
    LayoutDashboard,
    Calendar,
    Users,
    Scissors,
    DollarSign,
    Settings,
    UserRound,
    MessageSquare,
    Zap,
    Cpu,
    Bot,
    Megaphone,
    LucideIcon
} from 'lucide-react';

export interface MenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
    description?: string;
}

export const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, description: 'Visão Geral da Clínica' },
    { id: 'agenda', label: 'Agenda', icon: Calendar, description: 'Organize seus agendamentos' },
    { id: 'clientes', label: 'Clientes', icon: Users, description: 'Gestão de carteira e perfis' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, description: 'Central de atendimento em tempo real' },
    { id: 'fluxos', label: 'Fluxos', icon: Zap, description: 'Automação de jornada de mensagens' },
    { id: 'agentes_ia', label: 'Agentes de IA', icon: Bot, description: 'Gestão de assistentes virtuais e automação livre' },
    { id: 'servicos', label: 'Serviços', icon: Scissors, description: 'Especialidades e procedimentos' },
    { id: 'profissionais', label: 'Profissionais', icon: UserRound, description: 'Membros da equipe' },
    { id: 'marketing', label: 'Marketing', icon: Megaphone, description: 'Campanhas e promoções para clientes' },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, description: 'Receitas, despesas e relatórios' },
    { id: 'configuracoes', label: 'Configurações', icon: Settings, description: 'Regras de negócio e ajustes globais' },
];
