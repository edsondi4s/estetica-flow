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
    LucideIcon
} from 'lucide-react';

export interface MenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

export const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'fluxos', label: 'Fluxos', icon: Zap },
    { id: 'servicos', label: 'Serviços', icon: Scissors },
    { id: 'profissionais', label: 'Profissionais', icon: UserRound },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
];
