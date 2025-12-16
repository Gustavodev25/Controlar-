import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    User,
    Crown,
    Shield,
    X,
    Eye,
    CheckCircle,
    AlertCircle,
    Filter,
    ChevronDown,
    CreditCard,
    Calendar,
    DollarSign,
    ExternalLink,
    Loader2,
    Ban
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
    DropdownLabel
} from './Dropdown';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';

// Extended User interface with id
interface SystemUser extends UserType {
    id: string;
}

interface AsaasPayment {
    id: string;
    customer: string;
    dateCreated: string;
    dueDate: string;
    paymentDate?: string;
    value: number;
    netValue: number;
    originalValue?: number;
    interestValue?: number;
    discount?: {
        value: number;
        type: 'PERCENTAGE' | 'FIXED';
    };
    billingType: string;
    status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
    description?: string;
    invoiceUrl?: string;
    creditCard?: {
        creditCardBrand: string;
        creditCardNumber: string;
    };
}

type StatusFilter = 'all' | 'active' | 'canceled' | 'past_due' | 'pending';

export const AdminSubscriptions: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
    const [userPayments, setUserPayments] = useState<AsaasPayment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [cancelSubscriptionId, setCancelSubscriptionId] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    // Load users
    useEffect(() => {
        const loadUsers = async () => {
            setIsLoading(true);
            try {
                const data = await dbService.getAllUsers();
                // Filter only users with subscription info or Asaas ID
                const subUsers = data.filter(u => u.subscription || u.subscription?.asaasCustomerId);
                subUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setUsers(subUsers as SystemUser[]);
            } catch (error) {
                console.error('Error loading users:', error);
                toast.error('Erro ao carregar usuários.');
            } finally {
                setIsLoading(false);
            }
        };
        loadUsers();
    }, []);

    // Load payments when user is selected
    useEffect(() => {
        if (!selectedUser?.subscription?.asaasCustomerId) {
            setUserPayments([]);
            return;
        }

        const loadPayments = async () => {
            setIsLoadingPayments(true);
            try {
                // Fetch recent payments for this customer
                const response = await fetch(`/api/asaas/payments?customer=${selectedUser.subscription?.asaasCustomerId}&limit=20`);
                const data = await response.json();
                
                if (data.success && data.data) {
                    setUserPayments(data.data);
                } else {
                    setUserPayments([]);
                }
            } catch (error) {
                console.error('Error loading payments:', error);
                toast.error('Erro ao carregar pagamentos do Asaas.');
            } finally {
                setIsLoadingPayments(false);
            }
        };

        loadPayments();
    }, [selectedUser]);

    const handleCancelSubscription = async () => {
        if (!cancelSubscriptionId) return;
        setIsCancelling(true);

        try {
            // Find user to get the full subscription ID if needed, 
            // but we likely stored the asaasSubscriptionId in the cancelSubscriptionId state
            // wait, we need the Asaas ID.
            // Let's assume cancelSubscriptionId IS the Asaas Subscription ID.
            
            const response = await fetch(`/api/asaas/subscription/${cancelSubscriptionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                toast.success('Assinatura cancelada no Asaas com sucesso.');
                // Update local state
                setUsers(prev => prev.map(u => {
                    if (u.subscription?.asaasSubscriptionId === cancelSubscriptionId) {
                        return {
                            ...u,
                            subscription: {
                                ...u.subscription,
                                status: 'canceled'
                            }
                        };
                    }
                    return u;
                }));
            } else {
                toast.error('Erro ao cancelar assinatura: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Cancel error:', error);
            toast.error('Erro ao processar cancelamento.');
        } finally {
            setIsCancelling(false);
            setCancelSubscriptionId(null);
        }
    };

    // Filter users
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (user.name || '').toLowerCase().includes(searchLower) ||
                (user.email || '').toLowerCase().includes(searchLower);

            // Status filter
            const userStatus = user.subscription?.status || 'active';
            const matchesStatus = statusFilter === 'all' || 
                                 (statusFilter === 'active' && userStatus === 'active') ||
                                 (statusFilter === 'canceled' && userStatus === 'canceled') ||
                                 (statusFilter === 'past_due' && userStatus === 'past_due') ||
                                 (statusFilter === 'pending' && userStatus === 'pending_payment');

            return matchesSearch && matchesStatus;
        });
    }, [users, searchTerm, statusFilter]);

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.subscription?.status === 'active').length,
        pastDue: users.filter(u => u.subscription?.status === 'past_due').length,
        mrr: users.reduce((acc, u) => {
            if (u.subscription?.status !== 'active') return acc;
            const planValue = u.subscription?.plan === 'family' ? 49.90 : 
                            u.subscription?.plan === 'pro' ? 29.90 : 0;
            return acc + planValue;
        }, 0)
    }), [users]);

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
            case 'pending_payment':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        <Loader2 size={10} className="animate-spin" />
                        Pendente
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

    const getPaymentStatusBadge = (status: string) => {
        switch (status) {
            case 'CONFIRMED':
            case 'RECEIVED':
            case 'RECEIVED_IN_CASH':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Pago</span>;
            case 'PENDING':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20">Pendente</span>;
            case 'OVERDUE':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">Atrasado</span>;
            case 'REFUNDED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-400 text-xs font-medium border border-gray-500/20">Estornado</span>;
            default:
                return <span className="text-gray-400 text-xs">{status}</span>;
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Assinaturas Asaas</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Gerencie assinaturas e visualize faturas dos usuários
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Assinantes</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        <NumberFlow value={stats.total} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-emerald-400 uppercase font-bold tracking-wide">Ativos</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        <NumberFlow value={stats.active} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-red-400 uppercase font-bold tracking-wide">Atrasados</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        <NumberFlow value={stats.pastDue} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-[#d97757] uppercase font-bold tracking-wide">MRR Estimado</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        <NumberFlow value={stats.mrr} format={{ style: 'currency', currency: 'BRL' }} />
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar assinante..."
                        className="w-full pl-10 pr-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                    />
                </div>

                <Dropdown>
                    <DropdownTrigger className="w-full sm:w-auto">
                        <div className="flex items-center justify-between w-full sm:w-48 px-4 py-3 bg-[#30302E] border border-[#373734] rounded-xl text-white hover:border-gray-600 transition-colors">
                            <div className="flex items-center gap-2">
                                <Filter size={16} className="text-gray-500" />
                                <span className="text-sm">
                                    {statusFilter === 'all' ? 'Todos Status' : 
                                     statusFilter === 'active' ? 'Ativos' :
                                     statusFilter === 'pending' ? 'Pendentes' :
                                     statusFilter === 'past_due' ? 'Atrasados' : 'Cancelados'}
                                </span>
                            </div>
                            <ChevronDown size={16} className="text-gray-500" />
                        </div>
                    </DropdownTrigger>
                    <DropdownContent align="right" width="w-48">
                        <DropdownLabel>Filtrar por Status</DropdownLabel>
                        <DropdownItem onClick={() => setStatusFilter('all')}>Todos</DropdownItem>
                        <DropdownItem onClick={() => setStatusFilter('active')} icon={CheckCircle}>Ativos</DropdownItem>
                        <DropdownItem onClick={() => setStatusFilter('pending')} icon={Loader2}>Pendentes</DropdownItem>
                        <DropdownItem onClick={() => setStatusFilter('past_due')} icon={AlertCircle}>Atrasados</DropdownItem>
                        <DropdownItem onClick={() => setStatusFilter('canceled')} icon={X}>Cancelados</DropdownItem>
                    </DropdownContent>
                </Dropdown>
            </div>

            {/* Users Table */}
            <div className="bg-[#30302E] border border-[#373734] rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-[#d97757]" size={32} />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <EmptyState
                        title="Nenhum assinante encontrado"
                        description="Nenhum usuário com assinatura foi encontrado com os filtros atuais."
                        minHeight="min-h-[300px]"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#333431] text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Assinante</th>
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
                                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <User size={14} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium text-sm">{user.name || 'Sem nome'}</p>
                                                    <p className="text-gray-500 text-xs">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-300 capitalize">{user.subscription?.plan || 'Starter'}</span>
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
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedUser(user)}
                                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                                    title="Ver Faturas"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                
                                                {/* Cancel Button */}
                                                {(user.subscription?.status === 'active' || user.subscription?.status === 'pending_payment' || user.subscription?.status === 'past_due') && 
                                                  user.subscription.asaasSubscriptionId && (
                                                    <button
                                                        onClick={() => setCancelSubscriptionId(user.subscription!.asaasSubscriptionId!)}
                                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Cancelar Assinatura Asaas"
                                                    >
                                                        <Ban size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal (Payments) */}
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
                                className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh] relative"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                                <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-[#d97757]/10 text-[#d97757]">
                                            <CreditCard size={16} />
                                        </div>
                                        Faturas e Pagamentos
                                    </h3>
                                    <button
                                        onClick={() => setSelectedUser(null)}
                                        className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto custom-scrollbar relative z-10 flex-1">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                                            {selectedUser.avatarUrl ? (
                                                <img src={selectedUser.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                                            ) : (
                                                <User size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-white">{selectedUser.name}</p>
                                            <p className="text-sm text-gray-400 flex items-center gap-2">
                                                ID Asaas: <span className="font-mono text-xs text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">{selectedUser.subscription?.asaasCustomerId || 'N/A'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {isLoadingPayments ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="animate-spin text-[#d97757]" size={24} />
                                        </div>
                                    ) : userPayments.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <p>Nenhuma fatura encontrada para este usuário.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {userPayments.map((payment) => (
                                                <div key={payment.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <p className="text-sm font-medium text-white">
                                                                {payment.description || 'Assinatura Controlar+'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                                                                #{payment.id}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-bold text-white">
                                                                {formatCurrency(payment.value)}
                                                            </p>
                                                            {/* Show original value if different */}
                                                            {payment.originalValue && payment.originalValue !== payment.value && (
                                                                <p className="text-xs text-gray-500 line-through">
                                                                    {formatCurrency(payment.originalValue)}
                                                                </p>
                                                            )}
                                                            <div className="mt-1">
                                                                {getPaymentStatusBadge(payment.status)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Discount Info */}
                                                    {payment.discount && payment.discount.value > 0 && (
                                                        <div className="bg-green-500/5 border border-green-500/10 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1.5">
                                                            <span className="text-[10px] text-green-500 font-medium">
                                                                Desconto aplicado: 
                                                                {payment.discount.type === 'PERCENTAGE' 
                                                                    ? ` ${payment.discount.value}%` 
                                                                    : ` R$ ${payment.discount.value.toFixed(2)}`}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between pt-3 border-t border-gray-800 mt-2 text-xs text-gray-400">
                                                        <div className="flex gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar size={12} />
                                                                <span>Venc: {formatDate(payment.dueDate)}</span>
                                                            </div>
                                                            {payment.paymentDate && (
                                                                <div className="flex items-center gap-1.5 text-emerald-400/70">
                                                                    <CheckCircle size={12} />
                                                                    <span>Pago: {formatDate(payment.paymentDate)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {payment.invoiceUrl && (
                                                            <a 
                                                                href={payment.invoiceUrl} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1 text-[#d97757] hover:underline"
                                                            >
                                                                Fatura <ExternalLink size={10} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
            
            {/* Cancel Confirmation */}
            <ConfirmationBar
                isOpen={!!cancelSubscriptionId}
                onCancel={() => setCancelSubscriptionId(null)}
                onConfirm={handleCancelSubscription}
                label="Tem certeza que deseja cancelar a assinatura?"
                description="Isso interromperá cobranças futuras. Faturas já geradas podem permanecer pendentes."
                confirmText={isCancelling ? "Cancelando..." : "Sim, Cancelar Assinatura"}
                cancelText="Voltar"
                isDestructive={true}
            />
        </div>
    );
};

