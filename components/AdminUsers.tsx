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
    Filter
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

const planTabs: { value: PlanFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'starter', label: 'Starter' },
    { value: 'pro', label: 'Pro' },
    { value: 'family', label: 'Família' },
];

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

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
            const userPlan = user.subscription?.plan || 'starter';
            const matchesPlan = planFilter === 'all' || userPlan === planFilter;

            // Status filter
            const userStatus = user.subscription?.status || 'active';
            const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;

            return matchesSearch && matchesPlan && matchesStatus;
        });
    }, [users, searchTerm, planFilter, statusFilter]);

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        starter: users.filter(u => (u.subscription?.plan || 'starter') === 'starter').length,
        pro: users.filter(u => u.subscription?.plan === 'pro').length,
        family: users.filter(u => u.subscription?.plan === 'family').length,
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
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
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

    const getStatusLabel = (status: StatusFilter) => {
        switch (status) {
            case 'all': return 'Todos Status';
            case 'active': return 'Ativo';
            case 'canceled': return 'Cancelado';
            case 'past_due': return 'Atrasado';
            default: return status;
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
                    <p className="text-xs text-purple-400 uppercase font-bold tracking-wide">Família</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.family} />
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
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#333431] text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Usuário</th>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-left">Plano</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Ciclo</th>
                                    <th className="px-4 py-3 text-left">Próx. Cobrança</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#373734]">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#373734]/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${user.avatarUrl ? 'bg-gray-800' : getAvatarColors(user.name || '').bg} ${user.avatarUrl ? 'text-white' : getAvatarColors(user.name || '').text}`}>
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        getInitials(user.name || 'U')
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium text-sm">{user.name || 'Sem nome'}</span>
                                                    {user.isAdmin && (
                                                        <span className="p-1 rounded bg-amber-500/10 text-amber-500" title="Admin">
                                                            <Shield size={12} />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-400 text-sm">{user.email}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getPlanBadge(user.subscription?.plan)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(user.subscription?.status)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-400 text-xs uppercase">
                                                {user.subscription?.billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-400 text-xs font-mono">
                                                {formatDate(user.subscription?.nextBillingDate)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
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
                )}
            </div>

            {/* Results count */}
            <div className="text-sm text-gray-500 text-center">
                Exibindo {filteredUsers.length} de {users.length} usuários
            </div>

            {/* Detail Modal */}
            {createPortal(
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
            )}

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
        </div>
    );
};
