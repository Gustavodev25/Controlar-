import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    User,
    Mail,
    Crown,
    Shield,
    X,
    Trash2,
    Eye,
    Calendar,
    CreditCard,
    CheckCircle,
    AlertCircle,
    Users as UsersIcon,
    ChevronDown,
    Filter,
    Clock,
    ArrowUpDown
} from 'lucide-react';
import * as dbService from '../services/database';
import { User as UserType } from '../types';
import { EmptyState } from './EmptyState';
import { ConfirmationBar } from './ConfirmationBar';
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownLabel,
    DropdownSeparator
} from './Dropdown';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';

// Extended User interface with id
interface SystemUser extends UserType {
    id: string;
}

type PlanFilter = 'all' | 'starter' | 'pro' | 'family';
type StatusFilter = 'all' | 'active' | 'canceled' | 'past_due';
type RoleFilter = 'all' | 'admin' | 'user';
type SortOption = 'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'last_active' | 'most_active_days' | 'least_active_days' | 'subscription_newest' | 'subscription_oldest';

const planTabs: { value: PlanFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'starter', label: 'Starter' },
    { value: 'pro', label: 'Pro' },
];

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [adminToggleId, setAdminToggleId] = useState<string | null>(null);

    // Load users
    useEffect(() => {
        const loadUsers = async () => {
            setIsLoading(true);
            try {
                const data = await dbService.getAllUsers();
                // Sort by creation date or name
                data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setUsers(data as SystemUser[]);
            } catch (error) {
                console.error('Error loading users:', error);
                toast.error('Erro ao carregar usuários.');
            } finally {
                setIsLoading(false);
            }
        };
        loadUsers();
    }, []);

    // Filter users
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (user.name || '').toLowerCase().includes(searchLower) ||
                (user.email || '').toLowerCase().includes(searchLower);

            // Plan filter
            const userPlan = (user.subscription?.plan || 'starter').toLowerCase();
            const matchesPlan = planFilter === 'all' || userPlan === planFilter.toLowerCase();

            // Status filter
            const userStatus = user.subscription?.status || 'active';
            const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;

            // Role filter
            const matchesRole = roleFilter === 'all' ||
                (roleFilter === 'admin' && user.isAdmin) ||
                (roleFilter === 'user' && !user.isAdmin);

            return matchesSearch && matchesPlan && matchesStatus && matchesRole;
        }).sort((a, b) => {
            switch (sortOption) {
                case 'name_asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name_desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'newest':
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                case 'oldest':
                    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                case 'last_active':
                    const lastLoginA = a.connectionLogs?.[0]?.timestamp ? new Date(a.connectionLogs[0].timestamp).getTime() : 0;
                    const lastLoginB = b.connectionLogs?.[0]?.timestamp ? new Date(b.connectionLogs[0].timestamp).getTime() : 0;
                    return lastLoginB - lastLoginA;
                case 'most_active_days': {
                    const getActiveDays = (u: SystemUser) => {
                        if (!u.createdAt) return 0;
                        const today = new Date();
                        const createdDate = new Date(u.createdAt);
                        if (isNaN(createdDate.getTime())) return 0;
                        const diffTime = today.getTime() - createdDate.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return Math.max(0, diffDays);
                    };
                    return getActiveDays(b) - getActiveDays(a);
                }
                case 'least_active_days': {
                    const getActiveDays = (u: SystemUser) => {
                        if (!u.createdAt) return 0;
                        const today = new Date();
                        const createdDate = new Date(u.createdAt);
                        if (isNaN(createdDate.getTime())) return 0;
                        const diffTime = today.getTime() - createdDate.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return Math.max(0, diffDays);
                    };
                    return getActiveDays(a) - getActiveDays(b);
                }
                case 'subscription_newest': {
                    const aDate = a.subscription?.startDate ? new Date(a.subscription.startDate).getTime() : 0;
                    const bDate = b.subscription?.startDate ? new Date(b.subscription.startDate).getTime() : 0;
                    return bDate - aDate;
                }
                case 'subscription_oldest': {
                    const aDate = a.subscription?.startDate ? new Date(a.subscription.startDate).getTime() : 0;
                    const bDate = b.subscription?.startDate ? new Date(b.subscription.startDate).getTime() : 0;
                    return aDate - bDate;
                }
                default:
                    return 0;
            }
        });
    }, [users, searchTerm, planFilter, statusFilter, roleFilter, sortOption]);

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, planFilter, statusFilter, roleFilter, sortOption]);

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        starter: users.filter(u => (u.subscription?.plan || 'starter').toLowerCase() === 'starter').length,
        pro: users.filter(u => (u.subscription?.plan || '').toLowerCase() === 'pro').length,
        family: users.filter(u => (u.subscription?.plan || '').toLowerCase() === 'family').length,
        admins: users.filter(u => u.isAdmin).length,
    }), [users]);

    const getPlanBadge = (plan: string | undefined) => {
        switch (plan) {
            case 'pro':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#d97757]/10 text-[#d97757] border border-[#d97757]/20">
                        <Crown size={10} />
                        Pro
                    </span>
                );
            case 'family':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <UsersIcon size={10} />
                        Família
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        Starter
                    </span>
                );
        }
    };

    const getStatusBadge = (status: string | undefined) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={10} />
                        Ativo
                    </span>
                );
            case 'canceled':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <X size={10} />
                        Cancelado
                    </span>
                );
            case 'past_due':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertCircle size={10} />
                        Atrasado
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        -
                    </span>
                );
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        // Usar UTC para evitar problema de timezone (dia anterior)
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    };

    const getAge = (birthDate?: string) => {
        if (!birthDate) return '-';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} anos`;
    };

    const getLastLogin = (user: SystemUser) => {
        const logs = user.connectionLogs;
        if (!logs || logs.length === 0) return { text: 'Nunca', relative: 'Nunca acessou', isRecent: false, status: 'never' as const };
        // logs are typically sorted with latest first
        const lastLog = logs[0];
        if (!lastLog || !lastLog.timestamp) return { text: 'Nunca', relative: 'Nunca acessou', isRecent: false, status: 'never' as const };

        const date = new Date(lastLog.timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let relative: string;
        let status: 'online' | 'recent' | 'today' | 'week' | 'month' | 'old' | 'never';

        if (diffMinutes < 5) {
            relative = 'Online agora';
            status = 'online';
        } else if (diffMinutes < 60) {
            relative = `Há ${diffMinutes} min`;
            status = 'recent';
        } else if (diffHours < 24) {
            relative = `Há ${diffHours}h`;
            status = 'today';
        } else if (diffDays === 1) {
            relative = 'Ontem';
            status = 'week';
        } else if (diffDays < 7) {
            relative = `Há ${diffDays} dias`;
            status = 'week';
        } else if (diffDays < 30) {
            relative = `Há ${Math.floor(diffDays / 7)} sem`;
            status = 'month';
        } else if (diffDays < 365) {
            relative = `Há ${Math.floor(diffDays / 30)} mês${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
            status = 'old';
        } else {
            relative = `Há ${Math.floor(diffDays / 365)} ano${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
            status = 'old';
        }

        const text = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return { text, relative, isRecent: diffDays < 7, status };
    };

    // Calculate Active Days = Today (last active day) - First day in system (createdAt)
    const getActiveDaysCount = (user: SystemUser) => {
        if (!user.createdAt) return 0;

        const today = new Date();
        const createdDate = new Date(user.createdAt);

        if (isNaN(createdDate.getTime())) return 0;

        const diffTime = today.getTime() - createdDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    const getTimeSinceCreation = (createdAt?: string) => {
        if (!createdAt) return '-';
        const created = new Date(createdAt);
        if (isNaN(created.getTime())) return '-';

        const now = new Date();
        const diffTime = Math.abs(now.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return '1 dia';
        if (diffDays < 7) return `${diffDays} dias`;
        if (diffDays < 14) return '1 semana';
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`;
        if (diffDays < 60) return '1 mês';
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
        return `${Math.floor(diffDays / 365)} anos`;
    };

    // Format active days as weeks/months/years
    const formatActiveDays = (days: number) => {
        if (days === 0) return 'Hoje';
        if (days === 1) return '1 dia';
        if (days < 7) return `${days} dias`;
        if (days < 14) return '1 semana';
        if (days < 30) return `${Math.floor(days / 7)} semanas`;
        if (days < 60) return '1 mês';
        if (days < 365) return `${Math.floor(days / 30)} meses`;
        return `${Math.floor(days / 365)} anos`;
    };

    const renderActiveDays = (user: SystemUser) => {
        const uniqueDays = getActiveDaysCount(user);
        const memberDays = user.createdAt
            ? Math.max(1, Math.ceil((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
            : 1;
        const engagementRate = Math.min(100, Math.round((uniqueDays / memberDays) * 100));

        // Determine engagement level
        let engagementColor: string;
        let engagementBg: string;
        let engagementLabel: string;

        if (uniqueDays === 0) {
            engagementColor = 'text-gray-500';
            engagementBg = 'bg-gray-500/10';
            engagementLabel = 'Inativo';
        } else if (engagementRate >= 70) {
            engagementColor = 'text-emerald-400';
            engagementBg = 'bg-emerald-500/10';
            engagementLabel = 'Alto';
        } else if (engagementRate >= 30) {
            engagementColor = 'text-amber-400';
            engagementBg = 'bg-amber-500/10';
            engagementLabel = 'Médio';
        } else {
            engagementColor = 'text-orange-400';
            engagementBg = 'bg-orange-500/10';
            engagementLabel = 'Baixo';
        }

        return (
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{uniqueDays}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${engagementBg} ${engagementColor}`}>
                        {engagementLabel}
                    </span>
                </div>
                <span className="text-gray-500 text-[11px]">
                    {engagementRate}% de {memberDays}d
                </span>
            </div>
        );
    };

    const renderLastAccess = (user: SystemUser) => {
        const lastLogin = getLastLogin(user);

        // Status-based styling
        let statusColor: string;
        let statusBg: string;
        let showPing = false;

        switch (lastLogin.status) {
            case 'online':
                statusColor = 'text-emerald-400';
                statusBg = 'bg-emerald-500';
                showPing = true;
                break;
            case 'recent':
                statusColor = 'text-emerald-400';
                statusBg = 'bg-emerald-500';
                break;
            case 'today':
                statusColor = 'text-blue-400';
                statusBg = 'bg-blue-500';
                break;
            case 'week':
                statusColor = 'text-amber-400';
                statusBg = 'bg-amber-500';
                break;
            case 'month':
                statusColor = 'text-orange-400';
                statusBg = 'bg-orange-500';
                break;
            case 'old':
                statusColor = 'text-red-400';
                statusBg = 'bg-red-500';
                break;
            default:
                statusColor = 'text-gray-500';
                statusBg = 'bg-gray-500';
        }

        return (
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    {showPing && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusBg} opacity-75`}></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${statusBg}`}></span>
                </span>
                <div className="flex flex-col">
                    <span className={`text-sm font-medium ${statusColor}`}>{lastLogin.relative}</span>
                    {lastLogin.status !== 'never' && lastLogin.status !== 'online' && (
                        <span className="text-gray-500 text-[11px]">{lastLogin.text}</span>
                    )}
                </div>
            </div>
        );
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await dbService.deleteUserAccount(deleteId);
            setUsers(prev => prev.filter(u => u.id !== deleteId));
            toast.success('Usuário removido com sucesso.');
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Erro ao remover usuário.');
        } finally {
            setDeleteId(null);
        }
    };

    const handleToggleAdmin = async () => {
        if (!adminToggleId) return;
        try {
            const user = users.find(u => u.id === adminToggleId);
            if (!user) return;

            const newStatus = !user.isAdmin;
            await dbService.setAdminStatus(user.id, newStatus);

            setUsers(prev => prev.map(u =>
                u.id === adminToggleId ? { ...u, isAdmin: newStatus } : u
            ));

            toast.success(`Usuário ${newStatus ? 'promovido a Admin' : 'removido de Admin'} com sucesso.`);
        } catch (error) {
            console.error('Error toggling admin status:', error);
            toast.error('Erro ao alterar status de admin.');
        } finally {
            setAdminToggleId(null);
        }
    };

    const getRoleLabel = (role: RoleFilter) => {
        switch (role) {
            case 'all': return 'Todos Tipos';
            case 'admin': return 'Admins';
            case 'user': return 'Usuários';
            default: return role;
        }
    };

    const getStatusLabel = (status: StatusFilter) => {
        switch (status) {
            case 'all': return 'Todos Status';
            case 'active': return 'Ativo';
            case 'canceled': return 'Cancelado';
            case 'past_due': return 'Atrasado';
            default: return status;
        }
    };

    const getSortLabel = (sort: SortOption) => {
        switch (sort) {
            case 'name_asc': return 'Nome (A-Z)';
            case 'name_desc': return 'Nome (Z-A)';
            case 'newest': return 'Mais Recentes';
            case 'oldest': return 'Mais Antigos';
            case 'last_active': return 'Último Acesso';
            case 'most_active_days': return 'Mais Dias Ativos';
            case 'least_active_days': return 'Menos Dias Ativos';
            case 'subscription_newest': return 'Assinatura (Recente)';
            case 'subscription_oldest': return 'Assinatura (Antigo)';
            default: return sort;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Usuários</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Gerencie os usuários cadastrados no sistema
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Total</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.total} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Starter</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.starter} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-[#d97757] uppercase font-bold tracking-wide">Pro</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.pro} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-amber-500 uppercase font-bold tracking-wide">Admins</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.admins} />
                    </p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome ou email..."
                        className="w-full pl-10 pr-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                    />
                </div>

                {/* Filters Group */}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    {/* Status Filter */}
                    <Dropdown>
                        <DropdownTrigger className="w-full sm:w-auto">
                            <div className="flex items-center justify-between w-full sm:w-48 px-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white hover:border-gray-600 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-gray-500" />
                                    <span className="text-sm">{getStatusLabel(statusFilter)}</span>
                                </div>
                                <ChevronDown size={16} className="text-gray-500" />
                            </div>
                        </DropdownTrigger>
                        <DropdownContent align="right" width="w-48">
                            <DropdownLabel>Filtrar por Status</DropdownLabel>
                            <DropdownItem
                                onClick={() => setStatusFilter('all')}
                                className={statusFilter === 'all' ? 'bg-white/5' : ''}
                            >
                                Todos
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setStatusFilter('active')}
                                icon={CheckCircle}
                                className={statusFilter === 'active' ? 'bg-white/5' : ''}
                            >
                                Ativo
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setStatusFilter('canceled')}
                                icon={X}
                                className={statusFilter === 'canceled' ? 'bg-white/5' : ''}
                            >
                                Cancelado
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setStatusFilter('past_due')}
                                icon={AlertCircle}
                                className={statusFilter === 'past_due' ? 'bg-white/5' : ''}
                            >
                                Atrasado
                            </DropdownItem>
                        </DropdownContent>
                    </Dropdown>

                    {/* Role Filter */}
                    <Dropdown>
                        <DropdownTrigger className="w-full sm:w-auto">
                            <div className="flex items-center justify-between w-full sm:w-48 px-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white hover:border-gray-600 transition-colors">
                                <div className="flex items-center gap-2">
                                    <UsersIcon size={16} className="text-gray-500" />
                                    <span className="text-sm">{getRoleLabel(roleFilter)}</span>
                                </div>
                                <ChevronDown size={16} className="text-gray-500" />
                            </div>
                        </DropdownTrigger>
                        <DropdownContent align="right" width="w-48">
                            <DropdownLabel>Filtrar por Tipo</DropdownLabel>
                            <DropdownItem
                                onClick={() => setRoleFilter('all')}
                                className={roleFilter === 'all' ? 'bg-white/5' : ''}
                            >
                                Todos
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setRoleFilter('admin')}
                                icon={Shield}
                                className={roleFilter === 'admin' ? 'bg-white/5' : ''}
                            >
                                Admins
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setRoleFilter('user')}
                                icon={User}
                                className={roleFilter === 'user' ? 'bg-white/5' : ''}
                            >
                                Usuários
                            </DropdownItem>
                        </DropdownContent>
                    </Dropdown>

                    {/* Sort Dropdown */}
                    <Dropdown>
                        <DropdownTrigger className="w-full sm:w-auto">
                            <div className="flex items-center justify-between w-full sm:w-48 px-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white hover:border-gray-600 transition-colors">
                                <div className="flex items-center gap-2">
                                    <ArrowUpDown size={16} className="text-gray-500" />
                                    <span className="text-sm">{getSortLabel(sortOption)}</span>
                                </div>
                                <ChevronDown size={16} className="text-gray-500" />
                            </div>
                        </DropdownTrigger>
                        <DropdownContent align="right" width="w-48">
                            <DropdownLabel>Ordenar por</DropdownLabel>
                            <DropdownItem
                                onClick={() => setSortOption('newest')}
                                icon={Calendar}
                                className={sortOption === 'newest' ? 'bg-white/5' : ''}
                            >
                                Mais Recentes
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('oldest')}
                                icon={Calendar}
                                className={sortOption === 'oldest' ? 'bg-white/5' : ''}
                            >
                                Mais Antigos
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('last_active')}
                                icon={Clock}
                                className={sortOption === 'last_active' ? 'bg-white/5' : ''}
                            >
                                Último Acesso
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('most_active_days')}
                                icon={Calendar}
                                className={sortOption === 'most_active_days' ? 'bg-white/5' : ''}
                            >
                                Mais Dias Ativos
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('least_active_days')}
                                icon={Calendar}
                                className={sortOption === 'least_active_days' ? 'bg-white/5' : ''}
                            >
                                Menos Dias Ativos
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem
                                onClick={() => setSortOption('name_asc')}
                                className={sortOption === 'name_asc' ? 'bg-white/5' : ''}
                            >
                                Nome (A-Z)
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('name_desc')}
                                className={sortOption === 'name_desc' ? 'bg-white/5' : ''}
                            >
                                Nome (Z-A)
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem
                                onClick={() => setSortOption('subscription_newest')}
                                icon={CreditCard}
                                className={sortOption === 'subscription_newest' ? 'bg-white/5' : ''}
                            >
                                Assinatura (Recente)
                            </DropdownItem>
                            <DropdownItem
                                onClick={() => setSortOption('subscription_oldest')}
                                icon={CreditCard}
                                className={sortOption === 'subscription_oldest' ? 'bg-white/5' : ''}
                            >
                                Assinatura (Antigo)
                            </DropdownItem>
                        </DropdownContent>
                    </Dropdown>
                </div>
            </div>

            {/* Plan Tabs */}
            <div className="relative">
                <div className="inline-flex bg-[#333431] rounded-2xl p-1.5 border border-[#373734]">
                    {planTabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => setPlanFilter(tab.value)}
                            className="relative py-2 px-4 text-sm font-medium transition-colors duration-200 z-10"
                        >
                            <span className={planFilter === tab.value ? 'text-white' : 'text-gray-500 hover:text-gray-300'}>
                                {tab.label}
                            </span>
                            {planFilter === tab.value && (
                                <motion.div
                                    layoutId="activePlanTab"
                                    className="absolute inset-0 bg-[#d97757] rounded-xl shadow-lg shadow-[#d97757]/20"
                                    style={{ zIndex: -1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#30302E] border border-[#373734] rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <EmptyState
                        title="Nenhum usuário encontrado"
                        description="Os usuários cadastrados aparecerão aqui."
                        minHeight="min-h-[300px]"
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <table className="w-full">
                                <thead className="bg-[#333431] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-3 py-3 text-left">Usuário</th>
                                        <th className="px-3 py-3 text-left">Email</th>
                                        <th className="px-3 py-3 text-left">Idade</th>
                                        <th className="px-3 py-3 text-left">Plano</th>
                                        <th className="px-3 py-3 text-left">Status</th>
                                        <th className="px-3 py-3 text-left">Ciclo</th>
                                        <th className="px-3 py-3 text-left">Atividade</th>
                                        <th className="px-3 py-3 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#373734]">
                                    {paginatedUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-[#373734]/30 transition-colors">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${user.avatarUrl ? 'bg-gray-800' : getAvatarColors(user.name || '').bg} ${user.avatarUrl ? 'text-white' : getAvatarColors(user.name || '').text}`}>
                                                        {user.avatarUrl ? (
                                                            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            getInitials(user.name || 'U')
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium text-sm block truncate max-w-[120px]" title={user.name}>{user.name || 'Sem nome'}</span>
                                                        {user.isAdmin && (
                                                            <span className="p-1 rounded bg-amber-500/10 text-amber-500" title="Admin">
                                                                <Shield size={12} />
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="text-gray-400 text-sm block truncate max-w-[150px]" title={user.email}>{user.email}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="text-gray-400 text-sm">{getAge(user.birthDate)}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                {getPlanBadge(user.subscription?.plan)}
                                            </td>
                                            <td className="px-3 py-3">
                                                {getStatusBadge(user.subscription?.status)}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="text-gray-400 text-xs uppercase">
                                                    {user.subscription?.billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-0.5 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 w-16">Membro:</span>
                                                        <span className="text-white">{getTimeSinceCreation(user.createdAt)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 w-16">Ativos:</span>
                                                        <span className="text-white">{getActiveDaysCount(user)} dias</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 w-16">Assinou:</span>
                                                        <span className="text-gray-300 font-mono">{user.subscription?.startDate ? formatDate(user.subscription.startDate) : '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 w-16">Acesso:</span>
                                                        <span className={`${getLastLogin(user).status === 'online' ? 'text-emerald-400' : getLastLogin(user).status === 'recent' ? 'text-emerald-400' : 'text-gray-400'}`}>{getLastLogin(user).relative}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 w-16">Próx:</span>
                                                        <span className="text-gray-300 font-mono">{formatDate(user.subscription?.nextBillingDate)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setAdminToggleId(user.id)}
                                                        className={`p-2 rounded-lg transition-colors ${user.isAdmin ? 'text-[#d97757] hover:bg-[#d97757]/10' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                                                        title={user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                                                    >
                                                        <Shield size={16} className={user.isAdmin ? "fill-current" : ""} />
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedUser(user)}
                                                        className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                                        title="Visualizar"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteId(user.id)}
                                                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-[#373734] bg-[#333431]">
                                <div className="text-sm text-gray-400">
                                    Mostrando <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> de <span className="text-white font-medium">{filteredUsers.length}</span> resultados
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 px-2 rounded-lg text-xs font-medium bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-6 h-6 rounded-lg text-xs font-medium transition-colors ${currentPage === page ? 'bg-[#d97757] text-white' : 'bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white'}`}
                                        >
                                            {page}
                                        </button>
                                    )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="p-1 px-2 rounded-lg text-xs font-medium bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Results count */}
            <div className="text-sm text-gray-500 text-center">
                Exibindo {filteredUsers.length} de {users.length} usuários
            </div>

            {/* Detail Modal */}
            {
                createPortal(
                    <AnimatePresence>
                        {selectedUser && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
                                onClick={() => setSelectedUser(null)}
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col max-h-[90vh] relative"
                                >
                                    {/* Background Glow */}
                                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                                    {/* Header */}
                                    <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                                        <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-[#d97757]/10 text-[#d97757]">
                                                <User size={16} />
                                            </div>
                                            Detalhes do Usuário
                                        </h3>
                                        <button
                                            onClick={() => setSelectedUser(null)}
                                            className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 animate-fade-in relative z-10">
                                        {/* User Avatar & Name */}
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-md ${selectedUser.avatarUrl ? 'bg-gray-800' : getAvatarColors(selectedUser.name || '').bg} ${selectedUser.avatarUrl ? 'text-white' : getAvatarColors(selectedUser.name || '').text}`}>
                                                {selectedUser.avatarUrl ? (
                                                    <img src={selectedUser.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                                                ) : (
                                                    getInitials(selectedUser.name || 'U')
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-lg font-bold text-white">{selectedUser.name || 'Sem nome'}</p>
                                                    {selectedUser.isAdmin && (
                                                        <span className="p-1 rounded bg-amber-500/10 text-amber-500" title="Admin">
                                                            <Shield size={14} />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-400">{selectedUser.email}</p>
                                            </div>
                                        </div>

                                        {/* User Info */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Informações da Conta</label>
                                            <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">ID</span>
                                                    <span className="text-xs text-gray-300 font-mono">{selectedUser.id}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">CPF</span>
                                                    <span className="text-sm text-gray-300">{selectedUser.cpf || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Telefone</span>
                                                    <span className="text-sm text-gray-300">{selectedUser.phone || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Nascimento</span>
                                                    <span className="text-sm text-gray-300">{formatDate(selectedUser.birthDate)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">2FA</span>
                                                    <span className={`text-sm ${selectedUser.twoFactorEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                        {selectedUser.twoFactorEnabled ? 'Ativado' : 'Desativado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Subscription Info */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Assinatura</label>
                                            <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Plano</span>
                                                    {getPlanBadge(selectedUser.subscription?.plan)}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Status</span>
                                                    {getStatusBadge(selectedUser.subscription?.status)}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Ciclo</span>
                                                    <span className="text-sm text-gray-300">
                                                        {selectedUser.subscription?.billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase">Próx. Cobrança</span>
                                                    <span className="text-sm text-gray-300 font-mono">
                                                        {formatDate(selectedUser.subscription?.nextBillingDate)}
                                                    </span>
                                                </div>
                                                {selectedUser.subscription?.asaasCustomerId && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-500 uppercase">Asaas ID</span>
                                                        <span className="text-xs text-gray-400 font-mono">
                                                            {selectedUser.subscription.asaasCustomerId}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Activity Info */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Atividade</label>
                                            <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 space-y-3">
                                                {(() => {
                                                    const uniqueDays = getActiveDaysCount(selectedUser);
                                                    const memberDays = selectedUser.createdAt
                                                        ? Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedUser.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
                                                        : 1;
                                                    const engagementRate = Math.min(100, Math.round((uniqueDays / memberDays) * 100));
                                                    const lastLogin = getLastLogin(selectedUser);

                                                    let engagementColor: string;
                                                    if (engagementRate >= 70) {
                                                        engagementColor = 'text-emerald-400';
                                                    } else if (engagementRate >= 30) {
                                                        engagementColor = 'text-amber-400';
                                                    } else if (uniqueDays > 0) {
                                                        engagementColor = 'text-orange-400';
                                                    } else {
                                                        engagementColor = 'text-gray-500';
                                                    }

                                                    let statusColor: string;
                                                    switch (lastLogin.status) {
                                                        case 'online':
                                                        case 'recent':
                                                            statusColor = 'text-emerald-400';
                                                            break;
                                                        case 'today':
                                                            statusColor = 'text-blue-400';
                                                            break;
                                                        case 'week':
                                                            statusColor = 'text-amber-400';
                                                            break;
                                                        case 'month':
                                                            statusColor = 'text-orange-400';
                                                            break;
                                                        case 'old':
                                                            statusColor = 'text-red-400';
                                                            break;
                                                        default:
                                                            statusColor = 'text-gray-500';
                                                    }

                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 uppercase">Tempo Ativo</span>
                                                                <span className={`text-sm font-medium ${engagementColor}`}>
                                                                    {formatActiveDays(uniqueDays)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 uppercase">Membro Desde</span>
                                                                <span className="text-sm text-gray-300">
                                                                    {formatDate(selectedUser.createdAt)} ({memberDays} dias)
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 uppercase">Último Acesso</span>
                                                                <div className="flex items-center gap-2">
                                                                    {lastLogin.status === 'online' && (
                                                                        <span className="relative flex h-2 w-2">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-sm font-medium ${statusColor}`}>
                                                                        {lastLogin.relative}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 uppercase">Total de Logins</span>
                                                                <span className="text-sm text-gray-300">
                                                                    {selectedUser.connectionLogs?.length || 0}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        {selectedUser.address && (
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Endereço</label>
                                                <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4">
                                                    <p className="text-sm text-gray-300">
                                                        {selectedUser.address.street}, {selectedUser.address.number}
                                                        {selectedUser.address.complement && ` - ${selectedUser.address.complement}`}
                                                    </p>
                                                    <p className="text-sm text-gray-400">
                                                        {selectedUser.address.neighborhood} - {selectedUser.address.city}/{selectedUser.address.state}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">CEP: {selectedUser.address.cep}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Family Group */}
                                        {selectedUser.familyGroupId && (
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Grupo Familiar</label>
                                                <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-500 uppercase">ID do Grupo</span>
                                                        <span className="text-xs text-gray-300 font-mono">{selectedUser.familyGroupId}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-500 uppercase">Papel</span>
                                                        <span className={`text-sm ${selectedUser.familyRole === 'owner' ? 'text-[#d97757]' : 'text-gray-300'}`}>
                                                            {selectedUser.familyRole === 'owner' ? 'Proprietário' : 'Membro'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )
            }

            {/* Delete Confirmation */}
            <ConfirmationBar
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                label="Excluir Usuário?"
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
            />

            {/* Admin Toggle Confirmation */}
            <ConfirmationBar
                isOpen={!!adminToggleId}
                onCancel={() => setAdminToggleId(null)}
                onConfirm={handleToggleAdmin}
                label={users.find(u => u.id === adminToggleId)?.isAdmin
                    ? "Remover privilégios de Admin?"
                    : "Promover a Admin?"}
                confirmText="Confirmar"
                cancelText="Cancelar"
                isDestructive={false}
            />
        </div >
    );
};
