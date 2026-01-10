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
    Ban,
    Undo2,
    Download,

    SearchCode,
    Check,
    Minus,
    Mail,
    Trash2,
    Tag
} from 'lucide-react';
import * as dbService from '../services/database';
import { exportToCSV } from '../utils/export';
import { User as UserType } from '../types';
import { EmptyState } from './EmptyState';
import { UniversalModal, ModalSection } from './UniversalModal';
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownLabel
} from './Dropdown';
import { CustomSelect, CustomMonthPicker, Tooltip } from './UIComponents';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';

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

    const [planFilter, setPlanFilter] = useState<'all' | 'starter' | 'pro' | 'family'>('all');
    const [couponFilter, setCouponFilter] = useState<string>('all');
    const [showAdmins, setShowAdmins] = useState(true);
    const [asaasFilter, setAsaasFilter] = useState<'all' | 'verified' | 'unverified'>('all');
    const [sortOption, setSortOption] = useState<'name' | 'subscription_newest' | 'subscription_oldest' | 'next_billing'>('name');
    // Pagination removed
    const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
    const [userPayments, setUserPayments] = useState<AsaasPayment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [cancelSubscriptionId, setCancelSubscriptionId] = useState<string | null>(null);
    const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);

    const [isFixing, setIsFixing] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'projection'>('list');
    const [coupons, setCoupons] = useState<any[]>([]);

    // ID Search State
    const [showIdSearch, setShowIdSearch] = useState(false);
    const [idSearchTerm, setIdSearchTerm] = useState('');
    const [idSearchResult, setIdSearchResult] = useState<SystemUser | null>(null);
    const [idSearchError, setIdSearchError] = useState<string | null>(null);
    const [isSearchingById, setIsSearchingById] = useState(false);

    // Bulk Actions State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [bulkActionMode, setBulkActionMode] = useState<'none' | 'cancel' | 'email' | 'coupon'>('none');
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);
    // Bulk Email State
    const [bulkEmailSubject, setBulkEmailSubject] = useState('');
    const [bulkEmailBody, setBulkEmailBody] = useState('');
    // Bulk Coupon State
    const [bulkCouponId, setBulkCouponId] = useState('');
    const [bulkCouponMonth, setBulkCouponMonth] = useState(''); // YYYY-MM

    // Load users and coupons
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load users
                const data = await dbService.getAllUsers();
                // Filter only "Real" subscribers (Pro, Family, or with Asaas ID)
                const subUsers = data.filter(u => {
                    const sub = u.subscription;
                    if (!sub) return false;

                    const plan = (sub.plan || 'starter').toLowerCase();
                    const isPaidPlan = plan === 'pro' || plan === 'family';
                    const hasHistory = !!sub.asaasCustomerId;

                    // Include if they are on a paid plan OR have payment history (even if currently Starter/Canceled)
                    return isPaidPlan || hasHistory;
                });

                subUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setUsers(subUsers as SystemUser[]);

                // Load coupons
                const couponsData = await dbService.getCoupons();
                setCoupons(couponsData);
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error('Erro ao carregar dados.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
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

        // Find the user to revoke their plan
        const userToCancel = users.find(u => u.subscription?.asaasSubscriptionId === cancelSubscriptionId);

        try {
            // Cancel subscription on Asaas
            const response = await fetch(`/api/asaas/subscription/${cancelSubscriptionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                // Also revoke the plan in Firestore
                if (userToCancel?.id) {
                    await fetch('/api/admin/revoke-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: userToCancel.id, reason: 'cancel' })
                    });
                }

                toast.success('Assinatura cancelada e plano revogado com sucesso.');
                // Update local state - change both status AND plan
                setUsers(prev => prev.map(u => {
                    if (u.subscription?.asaasSubscriptionId === cancelSubscriptionId) {
                        return {
                            ...u,
                            subscription: {
                                ...u.subscription,
                                status: 'canceled',
                                plan: 'starter',
                                autoRenew: false
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

    const handleRefundPayment = async () => {
        if (!refundPaymentId) return;
        setIsRefunding(true);

        try {
            const response = await fetch(`/api/asaas/payment/${refundPaymentId}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: 'Solicitado pelo cliente (Prazo de 7 dias)'
                })
            });
            const data = await response.json();

            if (data.success) {
                // Also revoke the plan in Firestore for the selected user
                if (selectedUser?.id) {
                    await fetch('/api/admin/revoke-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: selectedUser.id, reason: 'refund' })
                    });

                    // Update local user state
                    setUsers(prev => prev.map(u => {
                        if (u.id === selectedUser.id) {
                            return {
                                ...u,
                                subscription: {
                                    ...u.subscription!,
                                    status: 'refunded',
                                    plan: 'starter',
                                    autoRenew: false
                                }
                            };
                        }
                        return u;
                    }));

                    // Update selected user
                    setSelectedUser(prev => prev ? {
                        ...prev,
                        subscription: {
                            ...prev.subscription!,
                            status: 'refunded',
                            plan: 'starter',
                            autoRenew: false
                        }
                    } : null);
                }

                toast.success('Estorno realizado e plano revogado com sucesso.');
                // Update local payments state
                setUserPayments(prev => prev.map(p =>
                    p.id === refundPaymentId ? { ...p, status: 'REFUNDED' } : p
                ));
            } else {
                toast.error('Erro ao estornar: ' + (data.details || data.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Refund error:', error);
            toast.error('Erro ao processar estorno.');
        } finally {
            setIsRefunding(false);
            setRefundPaymentId(null);
        }
    };

    const isEligibleForRefund = (payment: AsaasPayment) => {
        if (payment.status !== 'CONFIRMED' && payment.status !== 'RECEIVED') return false;

        // Check date (paymentDate preferred, fallback to dateCreated)
        const dateStr = payment.paymentDate || payment.dateCreated;
        if (!dateStr) return false;

        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays <= 7;
    };

    // Search user by ID
    const handleSearchById = async () => {
        if (!idSearchTerm.trim()) {
            setIdSearchError('Digite um ID de usuário.');
            return;
        }

        setIsSearchingById(true);
        setIdSearchError(null);
        setIdSearchResult(null);

        try {
            const userData = await dbService.getUserProfile(idSearchTerm.trim());

            if (userData) {
                setIdSearchResult({ ...userData, id: idSearchTerm.trim() } as SystemUser);
            } else {
                setIdSearchError('Usuário não encontrado com este ID.');
            }
        } catch (error) {
            console.error('Error searching by ID:', error);
            setIdSearchError('Erro ao buscar usuário. Verifique o ID e tente novamente.');
        } finally {
            setIsSearchingById(false);
        }
    };

    // Bulk Action Handlers
    const handleSelectAll = () => {
        if (selectedUserIds.length === filteredUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const executeBulkCancel = async () => {
        setIsProcessingBulk(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            // Filter selected users that are eligible for cancellation
            const usersToCancel = users.filter(u =>
                selectedUserIds.includes(u.id) &&
                u.subscription?.asaasSubscriptionId &&
                u.subscription.status !== 'canceled'
            );

            for (const user of usersToCancel) {
                try {
                    const subId = user.subscription!.asaasSubscriptionId!;
                    // Cancel on Asaas
                    const response = await fetch(`/api/asaas/subscription/${subId}`, {
                        method: 'DELETE'
                    });
                    const data = await response.json();

                    if (data.success) {
                        // Revoke plan locally
                        await fetch('/api/admin/revoke-plan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, reason: 'bulk_cancel' })
                        });
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    console.error(`Failed to cancel user ${user.id}`, err);
                    errorCount++;
                }
            }

            // Update local state
            if (successCount > 0) {
                const canceledIds = usersToCancel.map(u => u.id);
                setUsers(prev => prev.map(u => {
                    if (canceledIds.includes(u.id)) {
                        return {
                            ...u,
                            subscription: {
                                ...u.subscription,
                                status: 'canceled',
                                plan: 'starter',
                                autoRenew: false
                            }
                        };
                    }
                    return u;
                }));
                toast.success(`${successCount} assinaturas canceladas com sucesso.`);
            }

            if (errorCount > 0) {
                toast.error(`Falha ao cancelar ${errorCount} assinaturas.`);
            }

        } catch (error) {
            console.error('Bulk cancel error:', error);
            toast.error('Erro ao processar cancelamento em massa.');
        } finally {
            setIsProcessingBulk(false);
            setBulkActionMode('none');
            setSelectedUserIds([]);
        }
    };

    const executeBulkEmail = async () => {
        if (!bulkEmailSubject.trim() || !bulkEmailBody.trim()) {
            toast.error('Preencha o assunto e a mensagem.');
            return;
        }

        setIsProcessingBulk(true);
        try {
            const selectedUsersList = users.filter(u => selectedUserIds.includes(u.id));
            const recipients = selectedUsersList.map(u => u.email).filter(Boolean);

            const response = await fetch('/api/admin/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    subject: bulkEmailSubject,
                    body: bulkEmailBody,
                    title: bulkEmailSubject // Optional, adds title in email template
                })
            });

            if (!response.ok) throw new Error('Falha no envio');

            toast.success(`Email enviado para ${selectedUserIds.length} usuários.`);
        } catch (error) {
            console.error('Bulk email error:', error);
            toast.error('Erro ao enviar emails.');
        } finally {
            setIsProcessingBulk(false);
            setBulkActionMode('none');
            setSelectedUserIds([]);
            setBulkEmailSubject('');
            setBulkEmailBody('');
        }
    };

    const executeBulkCoupon = async () => {
        if (!bulkCouponId) {
            toast.error('Selecione um cupom.');
            return;
        }

        setIsProcessingBulk(true);
        try {
            // Call API to apply coupons (handles Firestore + Asaas)
            const response = await fetch('/api/admin/apply-coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: selectedUserIds,
                    couponId: bulkCouponId,
                    month: bulkCouponMonth || undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro desconhecido');
            }

            // Update local state
            setUsers(prev => prev.map(u => {
                if (selectedUserIds.includes(u.id)) {
                    return {
                        ...u,
                        subscription: {
                            ...u.subscription,
                            couponUsed: bulkCouponId,
                            couponStartMonth: bulkCouponMonth || undefined
                        }
                    };
                }
                return u;
            }));

            if (data.processed > 0) {
                toast.success(`Cupom aplicado para ${data.processed} usuários.`);
            }
            if (data.errors > 0) {
                toast.error(`Erro ao aplicar para ${data.errors} usuários.`);
            }

        } catch (error: any) {
            console.error('Bulk coupon error:', error);
            toast.error('Erro ao aplicar cupom: ' + (error.message || 'Erro interno'));
        } finally {
            setIsProcessingBulk(false);
            setBulkActionMode('none');
            setSelectedUserIds([]);
            setBulkCouponId('');
            setBulkCouponMonth('');
        }
    };

    const resetIdSearch = () => {
        setShowIdSearch(false);
        setIdSearchTerm('');
        setIdSearchResult(null);
        setIdSearchError(null);
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

            // Plan filter
            const userPlan = user.subscription?.plan || 'starter';
            const matchesPlan = planFilter === 'all' || userPlan === planFilter;

            // Coupon filter
            const userCoupon = user.subscription?.couponUsed || 'none';
            const matchesCoupon = couponFilter === 'all' ||
                (couponFilter === 'none' && !user.subscription?.couponUsed) ||
                userCoupon === couponFilter;

            // Asaas Verification filter
            const hasAsaas = !!user.subscription?.asaasCustomerId || !!user.subscription?.asaasSubscriptionId;
            const matchesAsaas = asaasFilter === 'all' ||
                (asaasFilter === 'verified' && hasAsaas) ||
                (asaasFilter === 'unverified' && !hasAsaas);

            const matchesAdmin = showAdmins ? true : !user.isAdmin;

            return matchesSearch && matchesStatus && matchesPlan && matchesCoupon && matchesAdmin && matchesAsaas;
        }).sort((a, b) => {
            switch (sortOption) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '');
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
                case 'next_billing': {
                    const aDate = a.subscription?.nextBillingDate ? new Date(a.subscription.nextBillingDate).getTime() : 0;
                    const bDate = b.subscription?.nextBillingDate ? new Date(b.subscription.nextBillingDate).getTime() : 0;
                    return aDate - bDate;
                }
                default:
                    return 0;
            }
        });
    }, [users, searchTerm, statusFilter, planFilter, couponFilter, showAdmins, asaasFilter, sortOption]);

    const displayedUsers = filteredUsers;

    // Reset page and selection when filters change
    useEffect(() => {
        // Page reset removed
        setSelectedUserIds([]); // Clear selection on filter change to avoid confusion
    }, [searchTerm, statusFilter, planFilter, couponFilter, showAdmins, asaasFilter, sortOption]);

    // Stats
    const stats = useMemo(() => {
        // Filter users for stats based on admin visibility
        // If showAdmins is FALSE, we exclude admins from these KPIs to show "Real Business Numbers"
        // If showAdmins is TRUE, we include them to reflect the current view
        const statsUsers = showAdmins ? users : users.filter(u => !u.isAdmin);

        const calculateUserMRR = (user: SystemUser) => {
            // Only count active subscriptions for MRR
            if (user.subscription?.status !== 'active') return 0;

            const sub = user.subscription;
            let startDate = sub.startDate ? new Date(sub.startDate) : null;

            // Fallback logic matching calculateProjection
            if (!startDate) {
                if (sub.nextBillingDate) {
                    startDate = new Date(sub.nextBillingDate);
                    startDate.setMonth(startDate.getMonth() - 1);
                } else {
                    startDate = new Date();
                }
            }

            // Calculate current month index (1-based) relative to start
            const today = new Date();
            // Difference in months
            let monthIndex = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1;
            if (monthIndex < 1) monthIndex = 1;

            // Base Price
            let price = 0;
            const isAnnual = sub.billingCycle === 'annual';
            const plan = (sub.plan || 'starter').toLowerCase();

            if (plan === 'family') {
                price = isAnnual ? (749.00 / 12) : 69.90;
            } else if (plan === 'pro') {
                price = isAnnual ? (399.00 / 12) : 35.90;
            }

            // Check for manual first month override
            if (monthIndex === 1 && sub.firstMonthOverridePrice !== undefined) {
                return sub.firstMonthOverridePrice;
            }

            // Apply Coupons
            const coupon = coupons.find(c => c.id === sub.couponUsed);
            if (coupon && price > 0) {
                if (coupon.type === 'progressive') {
                    // Calcular o índice do mês do cupom
                    // Se couponStartMonth está definido, usar ele como referência
                    let couponMonthIndex = monthIndex;

                    const todayMonthIndex = today.getFullYear() * 12 + today.getMonth();

                    if (sub.couponStartMonth) {
                        // couponStartMonth está no formato "YYYY-MM"
                        const [couponYear, couponMonth] = sub.couponStartMonth.split('-').map(Number);
                        const couponStartIndex = couponYear * 12 + (couponMonth - 1);

                        // Se o mês atual é antes do couponStartMonth, não aplica cupom
                        if (todayMonthIndex < couponStartIndex) {
                            couponMonthIndex = -1; // Valor negativo para não encontrar regra
                        } else {
                            // Mês do cupom começa a contar a partir do couponStartMonth
                            couponMonthIndex = (todayMonthIndex - couponStartIndex) + 1;
                        }
                    }

                    // Find the rule for the CURRENT coupon month index
                    const rule = coupon.progressiveDiscounts?.find((d: any) => d.month === couponMonthIndex);
                    // If no rule matches (e.g. we are past the discount period), price remains full
                    // If rule matches, apply discount
                    if (rule) {
                        if (rule.discountType === 'fixed') {
                            price = Math.max(0, price - rule.discount);
                        } else {
                            price = Math.max(0, price * (1 - rule.discount / 100));
                        }
                    }
                } else if (coupon.type === 'percentage') {
                    price = Math.max(0, price * (1 - coupon.value / 100));
                } else if (coupon.type === 'fixed') {
                    price = Math.max(0, price - coupon.value);
                }
            }

            return price;
        };

        return {
            total: statsUsers.length,
            active: statsUsers.filter(u => u.subscription?.status === 'active').length,
            pastDue: statsUsers.filter(u => u.subscription?.status === 'past_due').length,
            mrr: statsUsers.reduce((acc, u) => acc + calculateUserMRR(u), 0)
        };
    }, [users, coupons, showAdmins]);

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
        if (isNaN(date.getTime())) return '-';
        // Usar UTC para evitar problema de timezone (dia anterior)
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Calculate Projection for a User
    const calculateProjection = (user: SystemUser) => {
        const sub = user.subscription;
        if (!sub) return [];

        const planPrice = sub.plan === 'family'
            ? (sub.billingCycle === 'annual' ? 749.00 / 12 : 69.90)
            : (sub.plan === 'pro' ? (sub.billingCycle === 'annual' ? 399.00 / 12 : 35.90) : 0);

        let startDate = sub.startDate ? new Date(sub.startDate) : null;

        // Fallback for old subscriptions
        if (!startDate) {
            // Priority 1: User creation date
            if (user.createdAt) {
                startDate = new Date(user.createdAt);
            }
            // Priority 2: Infer from nextBillingDate IS UNRELIABLE for history
            // If we have an active user without startDate, assume they are "old" enough for the view
            else {
                // Default to well in the past to ensure projection shows up
                startDate = new Date('2024-01-01');
            }
        }

        const coupon = coupons.find(c => c.id === sub.couponUsed);

        const today = new Date();
        // FIXED: View range always starts at Jan 1st of CURRENT YEAR (or allow toggle year later)
        // FIXED: View range starts from DEC previous year to DEC current year (13 months)
        const year = today.getFullYear();
        const viewStart = new Date(year - 1, 11, 1); // Dec 1st Previous Year

        const projections = [];

        // Iterate through 13 months (Dec Prev -> Dec Curr)
        for (let i = 0; i < 13; i++) {
            // Target month in the view
            const targetDate = new Date(viewStart.getFullYear(), viewStart.getMonth() + i, 1);

            // Check if subscription was active during this month
            // If startDate is AFTER this month, user hadn't subscribed yet -> "-"
            // compare year and month
            const subStartMonthIndex = startDate.getFullYear() * 12 + startDate.getMonth();
            const targetMonthIndex = targetDate.getFullYear() * 12 + targetDate.getMonth();

            if (targetMonthIndex < subStartMonthIndex) {
                // Before subscription started
                continue;
            }

            // Calculate "Subscriber Month Index" (1=First Month, 2=Second...)
            const subscriberMonthIndex = (targetMonthIndex - subStartMonthIndex) + 1;

            let finalPrice = planPrice;
            let discountInfo = null;

            // Check for manual first month override
            if (subscriberMonthIndex === 1 && sub.firstMonthOverridePrice !== undefined) {
                finalPrice = sub.firstMonthOverridePrice;
                discountInfo = 'Cupom Primeiro Mês';
            } else if (coupon && finalPrice > 0) {
                if (coupon.type === 'progressive') {
                    // Calcular o índice do mês do cupom
                    // Se couponStartMonth está definido, usar ele como referência
                    // Senão, usar o startDate da assinatura (comportamento antigo)
                    let couponMonthIndex = subscriberMonthIndex;

                    if (sub.couponStartMonth) {
                        // couponStartMonth está no formato "YYYY-MM"
                        const [couponYear, couponMonth] = sub.couponStartMonth.split('-').map(Number);
                        const couponStartIndex = couponYear * 12 + (couponMonth - 1);

                        // Se o mês alvo é antes do couponStartMonth, não aplica cupom
                        if (targetMonthIndex < couponStartIndex) {
                            // Não aplica cupom, mantém preço cheio
                            couponMonthIndex = -1; // Valor negativo para não encontrar regra
                        } else {
                            // Mês do cupom começa a contar a partir do couponStartMonth
                            couponMonthIndex = (targetMonthIndex - couponStartIndex) + 1;
                        }
                    }

                    const rule = coupon.progressiveDiscounts?.find((d: any) => d.month === couponMonthIndex);
                    if (rule) {
                        if (rule.discountType === 'fixed') {
                            finalPrice = Math.max(0, finalPrice - rule.discount);
                            discountInfo = `R$ ${rule.discount.toFixed(2)} (Cupom Mês ${couponMonthIndex})`;
                        } else {
                            finalPrice = Math.max(0, finalPrice * (1 - rule.discount / 100));
                            discountInfo = `${rule.discount}% (Cupom Mês ${couponMonthIndex})`;
                        }
                    } else {
                        // Não há regra para este mês, volta ao preço cheio
                    }
                } else if (coupon.type === 'percentage') {
                    finalPrice = Math.max(0, finalPrice * (1 - coupon.value / 100));
                    discountInfo = `${coupon.value}%`;
                } else if (coupon.type === 'fixed') {
                    finalPrice = Math.max(0, finalPrice - coupon.value);
                    discountInfo = `- ${formatCurrency(coupon.value)}`;
                }
            }

            // Check for cancellation status to stop projection?
            // If status is 'canceled', we should check cancellation date. 
            // For now, if simply 'canceled', maybe we stop projecting from next month?
            // Assuming simple logic: if canceled, only show up to today? 
            // Or maybe better: If canceled, we assume they churned, but maybe they paid for this month?
            // Let's keep showing "history" and future "predictions" only if active?
            // Requested: "quando passa nao sumir".

            // Refined Logic:
            // If status is 'canceled', we need to know WHEN it was canceled. 
            // Without cancellationDate, difficult. We will project until 'today' if canceled?
            // Ideally we show what WAS paid.

            projections.push({
                date: targetDate,
                monthName: targetDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                value: finalPrice,
                discountInfo
            });
        }
        return projections;
    };

    // Get month columns for header (Fixed Jan-Dec of Current Year + Dec Prev)
    const next12Months = useMemo(() => {
        const months = [];
        const today = new Date();
        const year = today.getFullYear();
        const startMonth = new Date(year - 1, 11, 1); // Dec prev year

        for (let i = 0; i < 13; i++) {
            const d = new Date(startMonth);
            d.setMonth(startMonth.getMonth() + i);
            months.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        }
        return months;
    }, []);

    const monthTotals = useMemo(() => {
        if (viewMode !== 'projection') return [];

        const totals = Array(13).fill(0);
        const today = new Date();
        const year = today.getFullYear();
        const startMonth = new Date(year - 1, 11, 1);

        filteredUsers.forEach(user => {
            // Exclude canceled or refunded users from totals
            if (user.subscription?.status === 'canceled' || user.subscription?.status === 'refunded') {
                return;
            }

            const userProjections = calculateProjection(user);

            for (let i = 0; i < 13; i++) {
                const colDate = new Date(startMonth);
                colDate.setMonth(colDate.getMonth() + i);

                const match = userProjections.find(p =>
                    p.date.getMonth() === colDate.getMonth() &&
                    p.date.getFullYear() === colDate.getFullYear()
                );

                if (match) {
                    totals[i] += match.value;
                }
            }
        });

        return totals;
    }, [filteredUsers, viewMode, coupons]);

    const handleExportProjection = () => {
        if (!filteredUsers.length) {
            toast.error('Nenhum dado para exportar.');
            return;
        }

        const today = new Date();
        const year = today.getFullYear();
        const startMonth = new Date(year - 1, 11, 1);

        // Generate dynamic month headers
        const monthHeaders: { key: string, label: string }[] = [];
        for (let i = 0; i < 13; i++) {
            const d = new Date(startMonth);
            d.setMonth(startMonth.getMonth() + i);
            const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            // Key using generic pattern with index to map easily later
            monthHeaders.push({ key: `month_${i}`, label: monthLabel });
        }

        // Define all headers including the requested CPF
        const customHeaders = [
            { key: 'name', label: 'Assinante' },
            { key: 'email', label: 'Email' },
            { key: 'cpf', label: 'CPF' }, // Added CPF as requested
            { key: 'status', label: 'Status' },
            { key: 'plan', label: 'Plano' },
            { key: 'coupon', label: 'Cupom' },
            ...monthHeaders
        ];

        // Map users to data rows
        const exportData = filteredUsers.map(user => {
            const row: any = {
                name: user.name || 'Sem nome',
                email: user.email || '-',
                cpf: user.cpf || '-', // Accessing CPF directly from user object
                status: user.subscription?.status === 'active' ? 'Ativo' :
                    user.subscription?.status === 'canceled' ? 'Cancelado' :
                        user.subscription?.status === 'past_due' ? 'Atrasado' :
                            user.subscription?.status === 'pending_payment' ? 'Pendente' :
                                user.subscription?.status || '-',
                plan: user.subscription?.plan || '-',
                coupon: user.subscription?.couponUsed
                    ? (coupons.find(c => c.id === user.subscription?.couponUsed)?.code || 'CUPOM')
                    : '-'
            };

            // Calculate projections
            // Note: We need to filter out canceled/refunded for accuracy? 
            // The table logic mostly just calculates. The 'totals' logic filters them out.
            // Let's assume export should reflect what's on screen (which includes canceled users but marked red).
            // BUT, let's keep consistency with the 'calculateProjection' visual logic.
            const userProjections = calculateProjection(user);

            for (let i = 0; i < 13; i++) {
                const colDate = new Date(startMonth);
                colDate.setMonth(colDate.getMonth() + i);

                const match = userProjections.find(p =>
                    p.date.getMonth() === colDate.getMonth() &&
                    p.date.getFullYear() === colDate.getFullYear()
                );

                // Format value as currency string for Excel
                row[`month_${i}`] = match ? match.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-';
            }

            return row;
        });

        exportToCSV(exportData, `projecao_assinaturas_${today.toISOString().split('T')[0]}.csv`, customHeaders);
        toast.success('Relatório exportado com sucesso!');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Assinaturas Asaas</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Gerencie assinaturas e visualize projeções com cupons
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* ID Search Button */}
                    <button
                        onClick={() => setShowIdSearch(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white hover:border-[#d97757] rounded-xl transition-all text-sm font-medium"
                        title="Buscar usuário por ID"
                    >
                        <SearchCode size={16} />
                        <span className="hidden sm:inline">Buscar ID</span>
                    </button>

                    {viewMode === 'projection' && (
                        <button
                            onClick={handleExportProjection}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white hover:border-[#d97757] rounded-xl transition-all text-sm font-medium"
                            title="Exportar CSV (Excel)"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                    )}

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-[#30302E] p-1 rounded-xl border border-[#373734]">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors z-10 ${viewMode === 'list' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {viewMode === 'list' && (
                                <motion.div
                                    layoutId="viewMode-pill"
                                    className="absolute inset-0 bg-[#d97757] rounded-lg shadow-sm -z-10"
                                    transition={{ type: "spring", duration: 0.5 }}
                                />
                            )}
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode('projection')}
                            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors z-10 ${viewMode === 'projection' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {viewMode === 'projection' && (
                                <motion.div
                                    layoutId="viewMode-pill"
                                    className="absolute inset-0 bg-[#d97757] rounded-lg shadow-sm -z-10"
                                    transition={{ type: "spring", duration: 0.5 }}
                                />
                            )}
                            Projeção (Cupons)
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Show only in List Mode to save space or adjust for Projection? Keep for now. */}
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

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#30302E] border border-[#373734] text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#d97757] transition-colors placeholder:text-gray-600"
                    />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 ml-auto">
                    {/* Status Filter */}
                    <Dropdown>
                        <DropdownTrigger className="h-full">
                            <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${statusFilter !== 'all' ? 'bg-[#d97757]/10 border-[#d97757]/30 text-[#d97757]' : 'bg-[#30302E] border-[#373734] text-gray-400 hover:text-white'}`}>
                                <Filter size={16} />
                                <span>Status: {statusFilter === 'all' ? 'Todos' : statusFilter}</span>
                                <ChevronDown size={14} />
                            </button>
                        </DropdownTrigger>
                        <DropdownContent>
                            <DropdownLabel>Filtrar por Status</DropdownLabel>
                            <DropdownItem onClick={() => setStatusFilter('all')}>Todos</DropdownItem>
                            <DropdownItem onClick={() => setStatusFilter('active')}>Ativos</DropdownItem>
                            <DropdownItem onClick={() => setStatusFilter('pending')}>Pendentes</DropdownItem>
                            <DropdownItem onClick={() => setStatusFilter('past_due')}>Atrasados</DropdownItem>
                            <DropdownItem onClick={() => setStatusFilter('canceled')}>Cancelados</DropdownItem>
                        </DropdownContent>
                    </Dropdown>



                    {/* Coupon Filter */}
                    <Dropdown>
                        <DropdownTrigger className="h-full">
                            <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${couponFilter !== 'all' ? 'bg-[#d97757]/10 border-[#d97757]/30 text-[#d97757]' : 'bg-[#30302E] border-[#373734] text-gray-400 hover:text-white'}`}>
                                <DollarSign size={16} />
                                <span>Desconto: {couponFilter === 'all' ? 'Todos' : (couponFilter === 'none' ? 'Sem Cupom' : coupons.find(c => c.id === couponFilter)?.code || 'Unknown')}</span>
                                <ChevronDown size={14} />
                            </button>
                        </DropdownTrigger>
                        <DropdownContent className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            <DropdownLabel>Filtrar por Cupom</DropdownLabel>
                            <DropdownItem onClick={() => setCouponFilter('all')}>Todos</DropdownItem>
                            <DropdownItem onClick={() => setCouponFilter('none')}>Sem Cupom</DropdownItem>
                            {coupons.map(coupon => (
                                <DropdownItem key={coupon.id} onClick={() => setCouponFilter(coupon.id)}>
                                    {coupon.code}
                                </DropdownItem>
                            ))}
                        </DropdownContent>
                    </Dropdown>

                    {/* Asaas Verification Filter */}
                    <Dropdown>
                        <DropdownTrigger className="h-full">
                            <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${asaasFilter !== 'all' ? 'bg-[#d97757]/10 border-[#d97757]/30 text-[#d97757]' : 'bg-[#30302E] border-[#373734] text-gray-400 hover:text-white'}`}>
                                <CheckCircle size={16} />
                                <span>Asaas: {asaasFilter === 'all' ? 'Todos' : (asaasFilter === 'verified' ? 'Verificados' : 'Não Verificados')}</span>
                                <ChevronDown size={14} />
                            </button>
                        </DropdownTrigger>
                        <DropdownContent>
                            <DropdownLabel>Filtrar por Asaas</DropdownLabel>
                            <DropdownItem onClick={() => setAsaasFilter('all')}>Todos</DropdownItem>
                            <DropdownItem onClick={() => setAsaasFilter('verified')}>Verificados (Com ID)</DropdownItem>
                            <DropdownItem onClick={() => setAsaasFilter('unverified')}>Não Verificados (Sem ID)</DropdownItem>
                        </DropdownContent>
                    </Dropdown>

                    {/* Show Admins Toggle */}
                    <button
                        onClick={() => setShowAdmins(!showAdmins)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${showAdmins ? 'bg-[#d97757]/10 border-[#d97757]/30 text-[#d97757]' : 'bg-[#30302E] border-[#373734] text-gray-400 hover:text-white'}`}
                        title={showAdmins ? "Ocultar Administradores" : "Mostrar Administradores"}
                    >
                        <Shield size={16} />
                        <span className="hidden sm:inline">Admins</span>
                        {showAdmins && <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]" />}
                    </button>

                    {/* Sort Dropdown */}
                    <Dropdown>
                        <DropdownTrigger className="h-full">
                            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors whitespace-nowrap bg-[#30302E] border-[#373734] text-gray-400 hover:text-white">
                                <Calendar size={16} />
                                <span>
                                    {sortOption === 'name' && 'Nome'}
                                    {sortOption === 'subscription_newest' && 'Assinatura (Recente)'}
                                    {sortOption === 'subscription_oldest' && 'Assinatura (Antigo)'}
                                    {sortOption === 'next_billing' && 'Próx. Cobrança'}
                                </span>
                                <ChevronDown size={14} />
                            </button>
                        </DropdownTrigger>
                        <DropdownContent>
                            <DropdownLabel>Ordenar por</DropdownLabel>
                            <DropdownItem onClick={() => setSortOption('name')}>Nome</DropdownItem>
                            <DropdownItem onClick={() => setSortOption('subscription_newest')}>Assinatura (Recente)</DropdownItem>
                            <DropdownItem onClick={() => setSortOption('subscription_oldest')}>Assinatura (Antigo)</DropdownItem>
                            <DropdownItem onClick={() => setSortOption('next_billing')}>Próx. Cobrança</DropdownItem>
                        </DropdownContent>
                    </Dropdown>

                    {(searchTerm || statusFilter !== 'all' || planFilter !== 'all' || couponFilter !== 'all' || showAdmins) && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setPlanFilter('all');
                                setCouponFilter('all');
                                setAsaasFilter('all');
                                setShowAdmins(true);
                                setSortOption('name');
                            }}
                            className="p-2.5 text-gray-500 hover:text-white hover:bg-[#373734] rounded-xl transition-colors"
                            title="Limpar Filtros"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>




            {/* Users Table */}
            <div className="bg-[#30302E] border border-[#373734] rounded-2xl overflow-hidden relative">

                {/* Bulk Actions Bar - Glued to Top */}
                <AnimatePresence>
                    {selectedUserIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-0 left-0 right-0 z-30 bg-[#30302E] border-b border-[#373734] p-3 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3 pl-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#d97757]/20 text-[#d97757] font-bold text-xs">
                                    {selectedUserIds.length}
                                </span>
                                <span className="text-white font-medium text-sm">
                                    selecionados
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setBulkActionMode('coupon')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3a3a38] border border-[#454542] hover:border-[#d97757]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    <Tag size={13} />
                                    Cupom
                                </button>
                                <button
                                    onClick={() => setBulkActionMode('email')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3a3a38] border border-[#454542] hover:border-[#d97757]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    <Mail size={13} />
                                    Email
                                </button>
                                <button
                                    onClick={() => setBulkActionMode('cancel')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3a3a38] border border-[#454542] hover:border-red-500/50 hover:text-red-400 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={13} />
                                    Cancelar
                                </button>
                                <div className="h-4 w-px bg-gray-700 mx-1" />
                                <button
                                    onClick={() => setSelectedUserIds([])}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    title="Limpar seleção"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                ) : (<>
                    <div className={`overflow-x-auto ${viewMode === 'projection' ? 'custom-scrollbar' : ''}`}>
                        <table className="w-full">
                            <thead className="bg-[#333431] text-xs uppercase tracking-wider text-gray-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 text-left sticky left-0 bg-[#333431] z-20 w-[40px] border-b border-[#373734]">
                                        <button
                                            onClick={handleSelectAll}
                                            className="group flex items-center justify-center"
                                        >
                                            <div className={`
                                                w-5 h-5 rounded-md border transition-all flex items-center justify-center
                                                ${selectedUserIds.length > 0
                                                    ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                                                    : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                                                }
                                            `}>
                                                {selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.length ? (
                                                    <Check size={12} strokeWidth={3} />
                                                ) : selectedUserIds.length > 0 ? (
                                                    <Minus size={12} strokeWidth={3} />
                                                ) : (
                                                    <Check size={12} strokeWidth={3} />
                                                )}
                                            </div>
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left sticky left-[40px] bg-[#333431] z-10 w-[250px]">Assinante</th>

                                    {viewMode === 'list' ? (
                                        <>
                                            <th className="px-4 py-3 text-left">Plano</th>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left">Ciclo</th>
                                            <th className="px-4 py-3 text-left">Datas</th>
                                            <th className="px-4 py-3 text-center">Ações</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left w-[120px]">Plano/Cupom</th>
                                            {/* Projection Columns: Next 13 Months (Dec Prev -> Dec Curr) */}
                                            {(() => {
                                                const today = new Date();
                                                const year = today.getFullYear();
                                                const startMonth = new Date(year - 1, 11, 1);

                                                return Array.from({ length: 13 }).map((_, i) => {
                                                    const d = new Date(startMonth);
                                                    d.setMonth(startMonth.getMonth() + i);
                                                    return (
                                                        <th key={i} className={`px-4 py-3 text-center min-w-[100px] ${i === 0 ? 'bg-black/20 border-r border-[#373734]/50' : ''}`}>
                                                            {d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                        </th>
                                                    );
                                                });
                                            })()}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#373734]">
                                {displayedUsers.map((user) => {
                                    const projections = viewMode === 'projection' ? calculateProjection(user) : [];
                                    const isCanceled = user.subscription?.status === 'canceled' || user.subscription?.status === 'refunded';

                                    return (
                                        <tr key={user.id} className={`transition-colors ${isCanceled ? 'bg-red-500/5 hover:bg-red-500/10' : selectedUserIds.includes(user.id) ? 'bg-[#d97757]/5' : 'hover:bg-[#373734]/30'}`}>
                                            {/* Checkbox Column */}
                                            <td className={`px-4 py-3 sticky left-0 z-20 border-r border-[#373734] ${isCanceled ? 'bg-[#30302E] bg-gradient-to-r from-red-500/10 to-transparent' : 'bg-[#30302E]'}`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectUser(user.id);
                                                    }}
                                                    className="group flex items-center justify-center w-full h-full"
                                                >
                                                    <div className={`
                                                        w-5 h-5 rounded-md border transition-all flex items-center justify-center
                                                        ${selectedUserIds.includes(user.id)
                                                            ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                                                            : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                                                        }
                                                    `}>
                                                        <Check size={12} strokeWidth={3} />
                                                    </div>
                                                </button>
                                            </td>

                                            {/* Fixed User Column */}
                                            <td className={`px-4 py-3 sticky left-[40px] z-10 border-r border-[#373734] ${isCanceled ? 'bg-[#30302E] bg-gradient-to-r from-red-500/10 to-transparent' : 'bg-[#30302E]'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${user.avatarUrl ? 'bg-gray-800' : getAvatarColors(user.name || '').bg} ${user.avatarUrl ? 'text-white' : getAvatarColors(user.name || '').text}`}>
                                                        {user.avatarUrl ? (
                                                            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            getInitials(user.name || 'U')
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-medium text-sm truncate max-w-[150px]">{user.name || 'Sem nome'}</p>
                                                        <p className="text-gray-500 text-xs truncate max-w-[150px]">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {viewMode === 'list' ? (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm text-gray-300 capitalize">{user.subscription?.plan || 'Starter'}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(user.subscription?.status)}
                                                            {user.subscription?.asaasSubscriptionId && (
                                                                <Tooltip content="Verificado no Asaas">
                                                                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                                                                        <Check size={10} strokeWidth={3} />
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-gray-400 text-xs uppercase">
                                                            {user.subscription?.billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-500 w-14">Assinou:</span>
                                                                <span className="text-gray-300 font-mono">{user.subscription?.startDate ? formatDate(user.subscription.startDate) : '-'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-500 w-14">Próx:</span>
                                                                <span className="text-gray-300 font-mono">{formatDate(user.subscription?.nextBillingDate)}</span>
                                                            </div>
                                                        </div>
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
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 border-r border-[#373734]">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(user.subscription?.status)}
                                                            {user.subscription?.asaasSubscriptionId && (
                                                                <Tooltip content="Verificado no Asaas">
                                                                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                                                                        <Check size={10} strokeWidth={3} />
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {/* Plan / Coupon Info */}
                                                    <td className="px-4 py-3 border-r border-[#373734]">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-white capitalize font-bold">{user.subscription?.plan}</span>
                                                            {user.subscription?.couponUsed ? (
                                                                <span className="text-[10px] text-green-400 font-mono">
                                                                    {coupons.find(c => c.id === user.subscription?.couponUsed)?.code || 'CUPOM'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-600">-</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Projection Info */}
                                                    {/* FIXED: Render cols for Dec Prev -> Dec Curr (13 months) */}
                                                    {(() => {
                                                        const today = new Date();
                                                        const year = today.getFullYear();
                                                        const startMonth = new Date(year - 1, 11, 1);

                                                        return Array.from({ length: 13 }).map((_, i) => {
                                                            const colDate = new Date(startMonth);
                                                            colDate.setMonth(startMonth.getMonth() + i);

                                                            // Find projection matching this month/year
                                                            const match = projections.find(p =>
                                                                p.date.getMonth() === colDate.getMonth() &&
                                                                p.date.getFullYear() === colDate.getFullYear()
                                                            );

                                                            return (
                                                                <td key={i} className={`px-4 py-3 text-center border-r border-[#373734]/30 ${i === 0 ? 'bg-black/20' : ''}`}>
                                                                    {match ? (
                                                                        <div className="flex flex-col items-center">
                                                                            <span className={`text-xs font-mono font-medium ${match.value === 0 ? 'text-green-400' : 'text-gray-300'}`}>
                                                                                {match.value === 0 ? 'GRÁTIS' : formatCurrency(match.value)}
                                                                            </span>
                                                                            {match.discountInfo && (
                                                                                <span className="text-[9px] text-emerald-500/70">
                                                                                    {match.discountInfo}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-700 text-[10px]">-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        });
                                                    })()}
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Summary Footer for Projection Mode */}
                            {viewMode === 'projection' && (
                                <tfoot className="bg-[#333431] text-xs font-bold text-white z-20">
                                    <tr>
                                        <td className="px-4 py-3 sticky left-0 bg-[#333431] border-r border-[#373734] z-20 text-center">
                                            -
                                        </td>
                                        <td className="px-4 py-3 sticky left-[40px] bg-[#333431] border-r border-[#373734] z-20 text-right">
                                            TOTAL PREVISTO
                                        </td>
                                        <td className="px-4 py-3 border-r border-[#373734]" />
                                        <td className="px-4 py-3 border-r border-[#373734]" />
                                        {monthTotals.map((total, i) => (
                                            <td key={i} className="px-4 py-3 text-center border-r border-[#373734]/30">
                                                <span className="text-xs text-[#d97757]">
                                                    {formatCurrency(total)}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Pagination Controls */}

                </>
                )}
            </div>

            {/* Detail Modal (Payments) */}
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
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${selectedUser.avatarUrl ? 'bg-gray-800' : getAvatarColors(selectedUser.name || '').bg} ${selectedUser.avatarUrl ? 'text-white' : getAvatarColors(selectedUser.name || '').text}`}>
                                                {selectedUser.avatarUrl ? (
                                                    <img src={selectedUser.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                                                ) : (
                                                    getInitials(selectedUser.name || 'U')
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

                                                            <div className="flex items-center gap-3">
                                                                {isEligibleForRefund(payment) && (
                                                                    <button
                                                                        onClick={() => setRefundPaymentId(payment.id)}
                                                                        className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                                                                        title="Estornar pagamento (dentro de 7 dias)"
                                                                    >
                                                                        <Undo2 size={12} />
                                                                        Estornar
                                                                    </button>
                                                                )}

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
                )
            }

            {/* Cancel Confirmation */}
            {/* Confirmation Bar for Cancel or Refund */}
            {/* Cancel Subscription Modal */}
            <UniversalModal
                isOpen={!!cancelSubscriptionId}
                onClose={() => setCancelSubscriptionId(null)}
                title="Cancelar Assinatura"
                icon={<Ban size={24} />}
                themeColor="#ef4444" // Red
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setCancelSubscriptionId(null)}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Voltar
                        </button>
                        <button
                            onClick={handleCancelSubscription}
                            disabled={isCancelling}
                            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isCancelling ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Cancelando...
                                </>
                            ) : (
                                <>
                                    <X size={16} />
                                    Confirmar Cancelamento
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="text-sm font-bold text-red-400 mb-1">Ação Irreversível</h4>
                                <p className="text-xs text-red-400/80 leading-relaxed">
                                    Ao cancelar a assinatura, o usuário perderá o acesso imediato aos recursos Pro.
                                    A cobrança recorrente no Asaas será interrompida.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </UniversalModal>

            {/* Refund Payment Modal */}
            <UniversalModal
                isOpen={!!refundPaymentId}
                onClose={() => setRefundPaymentId(null)}
                title="Estornar Pagamento"
                icon={<Undo2 size={24} />}
                themeColor="#ef4444" // Red
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setRefundPaymentId(null)}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Voltar
                        </button>
                        <button
                            onClick={handleRefundPayment}
                            disabled={isRefunding}
                            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isRefunding ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Estornando...
                                </>
                            ) : (
                                <>
                                    <Undo2 size={16} />
                                    Confirmar Estorno
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="text-sm font-bold text-red-400 mb-1">Atenção</h4>
                                <p className="text-xs text-red-400/80 leading-relaxed">
                                    Esta ação irá devolver o valor integral do pagamento ao cliente e cancelar a assinatura associada.
                                    O estorno pode levar alguns dias para aparecer na fatura do cliente.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </UniversalModal>

            {/* ID Search Modal */}
            <UniversalModal
                isOpen={showIdSearch}
                onClose={resetIdSearch}
                title="Buscar Usuário por ID"
                icon={<SearchCode size={24} className="text-[#d97757]" />}
                width="max-w-xl"
            >
                <div className="space-y-6">
                    {/* Search Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Cole o ID do usuário (ex: cNMb9aohbsOAQkHoU5SeA8nDZc52)"
                                value={idSearchTerm}
                                onChange={(e) => setIdSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchById()}
                                className="w-full bg-[#2a2a28] border border-[#373734] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#d97757] transition-colors placeholder:text-gray-600 text-sm font-mono"
                            />
                        </div>
                        <button
                            onClick={handleSearchById}
                            disabled={isSearchingById}
                            className="px-4 py-2 bg-[#d97757] hover:bg-[#c56646] text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSearchingById ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            Buscar
                        </button>
                    </div>

                    {/* Error Message */}
                    {idSearchError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle size={16} />
                                {idSearchError}
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {idSearchResult && (
                        <div className="p-4 bg-[#2a2a28] border border-[#373734] rounded-xl space-y-4">
                            {/* User Header */}
                            <div className="flex items-center gap-3 pb-3 border-b border-[#373734]">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getAvatarColors(idSearchResult.name || '').bg} ${getAvatarColors(idSearchResult.name || '').text}`}
                                >
                                    {getInitials(idSearchResult.name || 'U')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold truncate">{idSearchResult.name || 'Sem nome'}</h4>
                                    <p className="text-gray-400 text-sm truncate">{idSearchResult.email || '-'}</p>
                                </div>
                                {idSearchResult.isAdmin && (
                                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs font-bold rounded-full border border-purple-500/20">
                                        ADMIN
                                    </span>
                                )}
                            </div>

                            {/* User ID */}
                            <div className="p-3 bg-[#30302E] rounded-xl">
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">User ID</p>
                                <p className="text-white text-sm font-mono break-all">{idSearchResult.id}</p>
                            </div>

                            {/* Subscription Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-[#30302E] rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Plano</p>
                                    <div className="flex items-center gap-2">
                                        {idSearchResult.subscription?.plan === 'pro' && <Crown size={14} className="text-[#d97757]" />}
                                        {idSearchResult.subscription?.plan === 'family' && <Shield size={14} className="text-purple-400" />}
                                        <span className="text-white font-bold capitalize">
                                            {idSearchResult.subscription?.plan || 'Starter'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3 bg-[#30302E] rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Status</p>
                                    {getStatusBadge(idSearchResult.subscription?.status)}
                                </div>
                            </div>

                            {/* Subscription Details */}
                            {idSearchResult.subscription && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-[#30302E] rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Ciclo</p>
                                            <p className="text-white text-sm">
                                                {idSearchResult.subscription.billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[#30302E] rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Próx. Cobrança</p>
                                            <p className="text-white text-sm">
                                                {formatDate(idSearchResult.subscription.nextBillingDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {idSearchResult.subscription.asaasCustomerId && (
                                        <div className="p-3 bg-[#30302E] rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Asaas Customer ID</p>
                                            <p className="text-white text-sm font-mono break-all">
                                                {idSearchResult.subscription.asaasCustomerId}
                                            </p>
                                        </div>
                                    )}

                                    {idSearchResult.subscription.asaasSubscriptionId && (
                                        <div className="p-3 bg-[#30302E] rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Asaas Subscription ID</p>
                                            <p className="text-white text-sm font-mono break-all">
                                                {idSearchResult.subscription.asaasSubscriptionId}
                                            </p>
                                        </div>
                                    )}

                                    {idSearchResult.subscription.couponUsed && (
                                        <div className="p-3 bg-[#30302E] rounded-xl">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Cupom Usado</p>
                                            <p className="text-white text-sm font-mono">
                                                {idSearchResult.subscription.couponUsed}
                                            </p>
                                        </div>
                                    )}

                                    {/* Revoked/Canceled Info */}
                                    {(idSearchResult.subscription.status === 'canceled' || idSearchResult.subscription.status === 'refunded') && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                                                <div className="text-sm">
                                                    <p className="text-red-400 font-bold mb-1">
                                                        {idSearchResult.subscription.status === 'refunded' ? 'Assinatura Reembolsada' : 'Assinatura Cancelada'}
                                                    </p>
                                                    <p className="text-red-400/80">
                                                        Este usuário NÃO deve ter acesso às funcionalidades Pro.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Quick Actions */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setSelectedUser(idSearchResult);
                                        resetIdSearch();
                                    }}
                                    className="flex-1 px-4 py-2 bg-[#d97757] hover:bg-[#c56646] text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Eye size={16} />
                                    Ver Pagamentos
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </UniversalModal >

            {/* Bulk Action Modals */}

            {/* Bulk Cancel */}
            <UniversalModal
                isOpen={bulkActionMode === 'cancel'}
                onClose={() => setBulkActionMode('none')}
                title={`Cancelar ${selectedUserIds.length} Assinaturas`}
                icon={<Trash2 size={24} />}
                themeColor="#ef4444"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setBulkActionMode('none')}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={executeBulkCancel}
                            disabled={isProcessingBulk}
                            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isProcessingBulk ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Confirmar Cancelamento em Massa
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-gray-300 text-sm">
                        Tem certeza que deseja cancelar a assinatura de <b>{selectedUserIds.length}</b> usuários selecionados?
                        <br /><br />
                        Esta ação cancelará a cobrança no Asaas e revogará os planos imediatamente.
                    </p>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        Ação irreversível. Verifique a seleção antes de continuar.
                    </div>
                </div>
            </UniversalModal>

            {/* Bulk Email */}
            <UniversalModal
                isOpen={bulkActionMode === 'email'}
                onClose={() => setBulkActionMode('none')}
                title={`Enviar Email para ${selectedUserIds.length} Usuários`}
                icon={<Mail size={24} className="text-[#d97757]" />}
                width="max-w-2xl"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setBulkActionMode('none')}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={executeBulkEmail}
                            disabled={isProcessingBulk}
                            className="px-6 py-2 bg-[#d97757] hover:bg-[#c56646] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isProcessingBulk ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            Enviar Email
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assunto</label>
                        <input
                            type="text"
                            value={bulkEmailSubject}
                            onChange={(e) => setBulkEmailSubject(e.target.value)}
                            className="w-full bg-[#2a2a28] border border-[#373734] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#d97757]"
                            placeholder="Assunto do email..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mensagem</label>
                        <textarea
                            value={bulkEmailBody}
                            onChange={(e) => setBulkEmailBody(e.target.value)}
                            rows={6}
                            className="w-full bg-[#2a2a28] border border-[#373734] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#d97757] resize-none"
                            placeholder="Escreva sua mensagem aqui..."
                        />
                    </div>
                </div>
            </UniversalModal>

            {/* Bulk Coupon */}
            <UniversalModal
                isOpen={bulkActionMode === 'coupon'}
                onClose={() => setBulkActionMode('none')}
                title={`Aplicar Cupom em ${selectedUserIds.length} Usuários`}
                icon={<Tag size={24} className="text-[#d97757]" />}
                width="max-w-md"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setBulkActionMode('none')}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={executeBulkCoupon}
                            disabled={isProcessingBulk}
                            className="px-6 py-2 bg-[#d97757] hover:bg-[#c56646] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isProcessingBulk ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                            Aplicar Cupom
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-gray-400 text-sm">
                        Selecione o cupom que será associado às assinaturas selecionadas no banco de dados.
                        Isso pode afetar as projeções financeiras.
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Selecione o Cupom</label>
                        <CustomSelect
                            value={bulkCouponId}
                            onChange={(val) => setBulkCouponId(String(val))}
                            options={[
                                { value: '', label: 'Selecione um cupom...' },
                                ...coupons.map(c => ({ value: c.id, label: `${c.code} (${c.type})` }))
                            ]}
                            placeholder="Selecione um cupom..."
                            className="w-full bg-[#2a2a28] border-[#373734] rounded-xl text-white"
                            portal
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mês de Aplicação (Opcional)</label>
                        <CustomMonthPicker
                            value={bulkCouponMonth}
                            onChange={setBulkCouponMonth}
                            placeholder="Selecione o mês (ex: 2024-05)"
                            portal
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                            Se selecionado, o cupom será associado a este mês específico. Caso contrário, será aplicado de forma geral.
                        </p>
                    </div>
                </div>
            </UniversalModal>
        </div >
    );
};

