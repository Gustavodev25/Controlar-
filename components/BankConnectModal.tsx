import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PluggyConnect } from 'react-pluggy-connect';
import { X, Loader2, Building, CheckCircle, AlertCircle, ShieldCheck, Info, Zap } from './Icons';
import { ConnectedAccount, ProviderBill, Transaction } from '../types';
import * as dbService from '../services/database';
import type { CreditCardTransaction } from '../services/database';
import { translatePluggyCategory } from '../services/openFinanceService';

interface BankConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    onSuccess?: (accounts: ConnectedAccount[]) => void;
    forceSyncItemId?: string | null;
}

const API_BASE = '/api';

const pad2 = (val: number) => String(val).padStart(2, '0');

const toDateOnly = (value?: string | null) => {
    if (!value) return null;
    return value.split('T')[0];
};

const parseDay = (value?: string | null) => {
    if (!value) return null;
    const [, , dayStr] = value.split('T')[0].split('-');
    const day = parseInt(dayStr, 10);
    return Number.isFinite(day) ? day : null;
};

const addMonthsUTC = (dateStr: string, months: number) => {
    const iso = toDateOnly(dateStr);
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCMonth(dt.getUTCMonth() + months);
    return dt.toISOString().split('T')[0];
};

const computeInvoiceMonthKey = (dateStr: string | null, closingDay?: number | null, dueDay?: number | null) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;

    let month = m;
    let year = y;

    if (closingDay && d > closingDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }

    // Adjust for due date falling in the next month relative to closing
    if (closingDay && dueDay && dueDay < closingDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }

    return `${year}-${pad2(month)}`;
};

const buildDueDateFromMonth = (monthKey: string | null, dueDay?: number | null) => {
    if (!monthKey || !dueDay) return null;
    const [y, m] = monthKey.split('-');
    if (!y || !m) return null;
    return `${y}-${m}-${pad2(dueDay)}`;
};

const mapBills = (raw: any[] = []): ProviderBill[] => {
    return raw
        .map((bill) => {
            const dueDate = bill.dueDate || bill.balanceDueDate;
            if (!dueDate) return null;
            return {
                id: bill.id,
                dueDate,
                totalAmount: bill.totalAmount ?? 0,
                totalAmountCurrencyCode: bill.totalAmountCurrencyCode ?? null,
                minimumPaymentAmount: bill.minimumPaymentAmount ?? null,
                allowsInstallments: bill.allowsInstallments ?? null,
                financeCharges: bill.financeCharges ?? null,
                balanceCloseDate: bill.balanceCloseDate ?? null,
                state: bill.state ?? null,
                paidAmount: bill.paidAmount ?? null
            } as ProviderBill;
        })
        .filter(Boolean) as ProviderBill[];
};

export const BankConnectModal: React.FC<BankConnectModalProps> = ({
    isOpen,
    onClose,
    userId,
    onSuccess,
    forceSyncItemId
}) => {
    // UI States
    const [view, setView] = useState<'connect' | 'manage'>('connect');
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Data States
    const [connectToken, setConnectToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');

    const [existingItems, setExistingItems] = useState<any[]>([]);
    const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null);
    const [showPluggyWidget, setShowPluggyWidget] = useState(false);

    const normalizeAccount = useCallback((account: any, bills: ProviderBill[]): ConnectedAccount => {
        const creditData = account.creditData || {};

        // Helper to extract account number from various sources
        const getAccountNumber = () => {
            // Priority 1: explicit number field
            if (account.number) return account.number;
            // Priority 2: bankData fields
            if (account.bankData?.number) return account.bankData.number;
            if (account.bankData?.transferNumber) return account.bankData.transferNumber;
            // Priority 3: Extract from name if it looks like an account number (e.g., "123/4567-8" or "12345678")
            if (account.name && (/^\d{3}\/\d{4}\//.test(account.name) || /^\d+[-\/]/.test(account.name) || /^\d{6,}$/.test(account.name))) {
                return account.name;
            }
            return null;
        };

        // Helper to determine the best display name for the account (avoid raw account numbers)
        const getAccountDisplayName = () => {
            // Priority: marketingName > name (if not a number format) > brand > subtype > generic
            if (account.marketingName) return account.marketingName;
            if (account.name && !/^\d{3}\/\d{4}\//.test(account.name) && !/^\d+[-\/]/.test(account.name) && !/^\d{6,}$/.test(account.name)) {
                return account.name;
            }
            if (creditData.brand) return creditData.brand;
            if (account.subtype) return account.subtype;
            if (account.type === 'CREDIT_CARD' || account.type === 'CREDIT') return 'Cartão de Crédito';
            if (account.type === 'BANK' || account.type === 'CHECKING') return 'Conta Corrente';
            if (account.type === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT' || account.subtype === 'SAVINGS') return 'Poupança';
            return 'Conta';
        };

        // Helper to determine the best display name for the institution
        const getInstitutionName = () => {
            // Priority 1: connector name (most reliable)
            if (account.connector?.name) return account.connector.name;
            // Priority 2: institution name from parent item
            if (account.item?.connector?.name) return account.item.connector.name;
            // Priority 3: bankData organization name
            if (account.bankData?.organizationName) return account.bankData.organizationName;
            // Priority 4: Use marketing name if it looks like a bank name
            if (account.marketingName && !/^\d/.test(account.marketingName)) return account.marketingName;
            // Fallback
            return 'Banco';
        };

        return {
            id: account.id,
            itemId: account.itemId,
            name: getAccountDisplayName(),
            type: account.type ?? null,
            subtype: account.subtype ?? null,
            institution: getInstitutionName(),
            balance: account.balance ?? 0,
            currency: account.currencyCode ?? null,
            lastUpdated: new Date().toISOString(),
            connectionMode: 'AUTO',
            creditLimit: creditData.creditLimit ?? null,
            availableCreditLimit: creditData.availableCreditLimit ?? null,
            brand: creditData.brand ?? null,
            balanceCloseDate: creditData.balanceCloseDate ?? null,
            balanceDueDate: creditData.balanceDueDate ?? null,
            minimumPayment: creditData.minimumPayment ?? null,
            bills,
            accountNumber: getAccountNumber()
        };
    }, []);

    const mapBankTransaction = useCallback((tx: any, account: ConnectedAccount): Omit<Transaction, 'id'> | null => {
        const date = toDateOnly(tx?.date);
        if (!date) return null;

        const rawAmount = Number(tx?.amount || 0);
        const amount = Math.abs(rawAmount);
        const pluggyType = (tx?.type || '').toUpperCase();
        const isIncome = pluggyType === 'CREDIT' || rawAmount > 0;
        const status = (tx?.status || '').toUpperCase() === 'PENDING' ? 'pending' : 'completed';

        return {
            description: tx?.description || 'Movimentacao',
            amount,
            date,
            category: translatePluggyCategory(tx?.category),
            type: isIncome ? 'income' : 'expense',
            status,
            importSource: 'pluggy',
            providerId: tx?.id,
            providerItemId: account.itemId,
            accountId: account.id,
            accountType: account.subtype || account.type,
            pluggyRaw: tx
        };
    }, []);

    const buildCardTransaction = useCallback(
        (
            tx: any,
            account: ConnectedAccount,
            billsMap: Map<string, ProviderBill>,
            closingDay: number | null,
            dueDay: number | null,
            isProjected: boolean = false,
            overrideInstallment?: number,
            overrideTotal?: number,
            providerIdOverride?: string,
            projectedAmountOverride?: number
        ): Omit<CreditCardTransaction, 'id'> | null => {
            const meta = tx?.creditCardMetadata || {};
            const purchaseDate = toDateOnly(meta.purchaseDate || tx?.date);
            const postDate = toDateOnly(tx?.date || purchaseDate);
            const anchorDate = postDate || purchaseDate;
            if (!anchorDate) return null;

            const rawAmount = Number(projectedAmountOverride ?? tx?.amount ?? 0);
            const totalInstallments = overrideTotal ?? meta.totalInstallments;
            const installmentNumber = overrideInstallment ?? meta.installmentNumber;

            const billId = meta.billId || null;
            const bill = billId ? billsMap.get(billId) : undefined;

            let invoiceMonthKey = bill?.dueDate ? bill.dueDate.slice(0, 7) : computeInvoiceMonthKey(anchorDate, closingDay, dueDay);
            let invoiceSource = bill?.dueDate ? 'pluggy_billId' : 'pluggy_close_rule';

            let invoiceDueDate = bill?.dueDate || buildDueDateFromMonth(invoiceMonthKey, dueDay) || undefined;
            if (!invoiceMonthKey && invoiceDueDate) {
                invoiceMonthKey = invoiceDueDate.slice(0, 7);
            }

            const amount = Math.abs(totalInstallments && meta.totalAmount
                ? (meta.totalAmount / totalInstallments)
                : rawAmount);
            const type = rawAmount >= 0 ? 'expense' : 'income';
            const status = isProjected
                ? 'pending'
                : (tx?.status || '').toUpperCase() === 'PENDING'
                    ? 'pending'
                    : 'completed';

            return {
                date: postDate,
                description: tx?.description || 'Lancamento Cartao',
                amount,
                category: translatePluggyCategory(tx?.category),
                type,
                status,
                cardId: account.id,
                cardName: account.name,
                installmentNumber: installmentNumber || undefined,
                totalInstallments: totalInstallments || undefined,
                importSource: 'pluggy',
                providerId: providerIdOverride || tx?.id,
                providerItemId: account.itemId,
                invoiceDate: invoiceMonthKey ? `${invoiceMonthKey}-01` : undefined,
                invoiceDueDate: invoiceDueDate || undefined,
                invoiceMonthKey: invoiceMonthKey || undefined,
                pluggyBillId: billId,
                invoiceSource,
                pluggyRaw: tx,
                isProjected
            };
        },
        []
    );

    const generateProjectedInstallments = useCallback(
        async (
            tx: any,
            account: ConnectedAccount,
            billsMap: Map<string, ProviderBill>,
            closingDay: number | null,
            dueDay: number | null
        ) => {
            if (!userId) return 0;
            const meta = tx?.creditCardMetadata || {};
            const totalInstallments = meta.totalInstallments;
            const currentInstallment = meta.installmentNumber || 1;
            const purchaseDate = toDateOnly(meta.purchaseDate || tx?.date);

            if (!totalInstallments || totalInstallments <= currentInstallment) return 0;

            let projectedCount = 0;
            for (let i = currentInstallment + 1; i <= totalInstallments; i++) {
                const providerId = `${tx?.id || account.id}_installment_${i}`;
                const projectedDate = purchaseDate ? addMonthsUTC(purchaseDate, i - 1) : null;
                const projectedTx = buildCardTransaction(
                    {
                        ...tx,
                        date: projectedDate || tx?.date,
                        creditCardMetadata: {
                            ...meta,
                            installmentNumber: i,
                            totalInstallments,
                            billId: null // Clear billId for future installments so they don't get stuck in the current invoice
                        }
                    },
                    account,
                    billsMap,
                    closingDay,
                    dueDay,
                    true,
                    i,
                    totalInstallments,
                    providerId
                );

                if (projectedTx) {
                    await dbService.upsertCreditCardTransaction(userId, projectedTx);
                    projectedCount++;
                }
            }

            return projectedCount;
        },
        [buildCardTransaction, userId]
    );

    const syncBankTransactions = useCallback(
        async (account: ConnectedAccount, txs: any[]) => {
            if (!userId) return 0;
            let count = 0;

            for (const tx of txs || []) {
                const mapped = mapBankTransaction(tx, account);
                if (!mapped) continue;
                await dbService.upsertImportedTransaction(userId, mapped, tx?.id);
                count++;
            }

            return count;
        },
        [mapBankTransaction, userId]
    );

    const syncCreditCardTransactions = useCallback(
        async (account: ConnectedAccount, txs: any[], bills: ProviderBill[]) => {
            if (!userId) return { saved: 0, projected: 0 };

            const billsMap = new Map<string, ProviderBill>();
            bills.forEach((bill) => billsMap.set(bill.id, bill));

            const closingDay = parseDay(account.balanceCloseDate);
            const dueDay = parseDay(account.balanceDueDate);

            let saved = 0;
            let projected = 0;

            for (const tx of txs || []) {
                const mapped = buildCardTransaction(tx, account, billsMap, closingDay, dueDay, false);
                if (mapped) {
                    await dbService.upsertCreditCardTransaction(userId, mapped);
                    saved++;
                }

                projected += await generateProjectedInstallments(tx, account, billsMap, closingDay, dueDay);
            }

            return { saved, projected };
        },
        [buildCardTransaction, generateProjectedInstallments, userId]
    );

    const runFullSync = useCallback(
        async (itemId: string) => {
            if (!userId) return [];

            setSyncStatus('syncing');
            setSyncMessage('Sincronizando contas e transacoes...');

            const response = await fetch(`${API_BASE}/pluggy/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, monthsBack: 2, monthsForward: 4 })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao sincronizar dados do Pluggy.');
            }

            const syncedAccounts: ConnectedAccount[] = [];
            let bankCount = 0;
            let cardCount = 0;
            let projectedCount = 0;

            for (const entry of data.accounts || []) {
                if (!entry?.account) continue;
                const bills = mapBills(entry.bills || []);
                const account = normalizeAccount(entry.account, bills);
                await dbService.addConnectedAccount(userId, account);
                syncedAccounts.push(account);

                const type = (account.type || '').toUpperCase();
                const subtype = (account.subtype || '').toUpperCase();
                const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT');

                if (isCredit) {
                    const { saved, projected } = await syncCreditCardTransactions(account, entry.transactions || [], bills);
                    cardCount += saved;
                    projectedCount += projected;
                } else {
                    bankCount += await syncBankTransactions(account, entry.transactions || []);
                }
            }

            setSyncStatus('success');
            const summary = projectedCount > 0
                ? `Sincronizamos ${bankCount} movimentacoes e ${cardCount} lancamentos de cartao (+${projectedCount} parcelas futuras).`
                : `Sincronizamos ${bankCount} movimentacoes e ${cardCount} lancamentos de cartao.`;
            setSyncMessage(summary);

            return syncedAccounts;
        },
        [normalizeAccount, syncBankTransactions, syncCreditCardTransactions, userId]
    );

    // Animation effect (igual Reminders modal)
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            setIsVisible(true);
            setView('connect'); // Reset view on open
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
            // Fetch token when modal opens
            if (userId) {
                if (forceSyncItemId) {
                    setShowPluggyWidget(false);
                    setError(null);
                    setConnectToken(null);

                    (async () => {
                        try {
                            const synced = await runFullSync(forceSyncItemId);
                            if (onSuccess) onSuccess(synced);
                            setTimeout(() => onClose(), 1500);
                        } catch (err: any) {
                            console.error('Error syncing Pluggy item:', err);
                            setSyncStatus('error');
                            setSyncMessage(err?.message || 'Erro ao sincronizar transações.');
                        }
                    })();
                } else {
                    fetchConnectToken();
                }
            }
        } else {
            setIsAnimating(false);
            timeoutId = setTimeout(() => {
                setIsVisible(false);
                // Reset states after animation
                setConnectToken(null);
                setError(null);
                setSyncStatus('idle');
                setSyncMessage('');
                setExistingItems([]);
                setShowPluggyWidget(false);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen, userId]);

    const fetchExistingItems = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setSyncStatus('idle');
        setSyncMessage('');
        try {
            const response = await fetch(`${API_BASE}/pluggy/items?userId=${userId}`);
            const data = await response.json();
            if (response.ok) {
                // API returns { success: true, items: [...] }
                setExistingItems(data.items || data.results || []);
                setView('manage');
                setError(null);
            } else {
                console.error('Failed to fetch items:', data);
                if (response.status === 401 || response.status === 403) {
                    setError('Sessão Pluggy expirada. Clique em conectar novamente.');
                    setView('connect');
                    setConnectToken(null);
                } else {
                    // Fallback if fetch fails
                    setError('Não foi possível carregar as conexões existentes.');
                }
            }
        } catch (err) {
            console.error('Error fetching items:', err);
            setError('Erro ao carregar conexões.');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const handleDeleteRemoteItem = async (itemId: string) => {
        if (!userId) return;
        setIsDeletingItem(itemId);
        try {
            // Correct endpoint: DELETE /api/pluggy/item/:itemId
            const response = await fetch(`${API_BASE}/pluggy/item/${itemId}?userId=${userId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setExistingItems(prev => {
                    const next = prev.filter(i => i.id !== itemId);
                    if (next.length === 0) {
                        // If no items left, go back to connect
                        fetchConnectToken();
                        setView('connect');
                    }
                    return next;
                });
            } else {
                console.error('Failed to delete item');
            }
        } catch (err) {
            console.error('Error deleting item:', err);
        } finally {
            setIsDeletingItem(null);
        }
    };

    const fetchConnectToken = async () => {
        setIsLoading(true);
        setError(null);
        setSyncStatus('idle'); // Reset sync status

        try {
            const response = await fetch(`${API_BASE}/pluggy/create-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar token');
            }

            setConnectToken(data.accessToken);
            if (Array.isArray(data.existingItems)) {
                setExistingItems(data.existingItems);
                if (data.existingItems.length > 0) {
                    setView('manage');
                    setError('Você já tem este banco conectado. Gerencie ou remova a conexão abaixo.');
                }
            }
        } catch (err: any) {
            console.error('Error fetching connect token:', err);
            setError(err.message || 'Erro ao conectar com o serviço. Verifique se o servidor está rodando.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccess = useCallback(async (data: { item: { id: string } }) => {
        console.log('Pluggy connection success, item:', data.item?.id);
        setShowPluggyWidget(false);

        if (!userId) {
            setSyncStatus('error');
            setSyncMessage('Usuario nao identificado para salvar as transacoes.');
            return;
        }

        try {
            setSyncStatus('syncing');
            setSyncMessage('Conexao autenticada. Sincronizando transacoes...');

            const synced = await runFullSync(data.item?.id);
            await fetchExistingItems();

            if (onSuccess) onSuccess(synced);

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error('Error syncing after connect:', err);
            setError(err?.message || 'Erro ao sincronizar transacoes.');
            setSyncStatus('error');
        }
    }, [fetchExistingItems, onClose, onSuccess, runFullSync, userId]);



    const handleError = useCallback((error: { message?: string; code?: string; data?: any }) => {
        setShowPluggyWidget(false);
        const errorCode = error.message || error.code || '';
        const errorDataMessage = typeof error.data === 'string' ? error.data : error.data?.message || '';
        const duplicateError =
            errorCode === 'ITEM_USER_ALREADY_EXISTS' ||
            errorCode === 'ITEM_ALREADY_EXISTS' ||
            /existing item/i.test(errorCode) ||
            /existing item/i.test(errorDataMessage);

        // Handle expected duplicate-item errors by redirecting user to manage view
        if (duplicateError) {
            console.log('Pluggy: User attempted to add an existing item.');
            setError('Este banco já está conectado. Você pode gerenciar ou remover a conexão existente.');
            setSyncStatus('idle');
            setSyncMessage('');
            fetchExistingItems();
            return;
        }

        console.error('Pluggy connection error (full):', JSON.stringify(error, null, 2));

        // Handle specific Pluggy errors with user-friendly messages
        let errorMessage = 'Erro na conexão';

        if (errorCode === 'ITEM_LOGIN_ALREADY_QUEUED') {
            errorMessage = 'Uma conexão já está em andamento. Aguarde alguns segundos e tente novamente.';
        } else if (errorCode === 'ITEM_LOGIN_TIMEOUT') {
            errorMessage = 'O tempo de conexão expirou. Tente novamente.';
        } else if (errorCode === 'ITEM_CREDENTIALS_INVALID' || errorCode === 'INVALID_CREDENTIALS') {
            errorMessage = 'Credenciais bancárias inválidas. Verifique seus dados.';
        } else if (errorCode === 'SITE_NOT_SUPPORTED') {
            errorMessage = 'Este banco não está disponível no momento.';
        } else if (errorCode === 'ACCOUNT_LOCKED') {
            errorMessage = 'Sua conta está bloqueada. Verifique junto ao banco.';
        } else if (error.data?.message) {
            errorMessage = error.data.message;
        } else if (errorCode) {
            errorMessage = `Erro: ${errorCode}`;
        }

        setError(errorMessage);
        setSyncStatus('error');
    }, [fetchExistingItems]);


    if (!isVisible) return null;

    return <>
        {createPortal(
            <div className={`
      fixed inset-0 z-[9999] flex items-center justify-center p-4
      transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
      ${showPluggyWidget ? 'hidden' : ''}
      ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
    `}>
                <div className={`
        bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 
        flex flex-col max-h-[90vh] relative 
        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
      `}>

                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                    {/* Header */}
                    <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-[#d97757]/10 rounded-xl border border-[#d97757]/20">
                                <Building size={20} className="text-[#d97757]" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">
                                    {forceSyncItemId ? 'Sincronizar Banco' : view === 'manage' ? 'Gerenciar Conexões' : 'Conectar Banco'}
                                </h3>
                                <p className="text-xs text-gray-500">Open Finance - Pluggy</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative z-10 p-5 overflow-y-auto custom-scrollbar">

                        {/* View: MANAGE Existing Connections */}
                        {view === 'manage' && (
                            <div className="space-y-4 animate-fade-in">
                                <p className="text-sm text-gray-400 text-center mb-2">
                                    Identificamos conexões ativas na sua conta Pluggy. Você pode removê-las para conectar novamente.
                                </p>

                                {isLoading ? (
                                    <p className="text-center text-gray-500 py-8">Carregando conexões...</p>
                                ) : existingItems.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">Nenhuma conexão encontrada.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {existingItems.map((item) => (
                                            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {item.connector && (
                                                        <div className="w-10 h-10 rounded-full bg-white p-1 overflow-hidden">
                                                            <img src={item.connector.imageUrl} alt={item.connector.name} className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">{item.connector?.name || 'Banco Desconhecido'}</h4>
                                                        <p className="text-[10px] text-gray-500">Status: {item.status}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteRemoteItem(item.id)}
                                                    disabled={isDeletingItem === item.id}
                                                    className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors"
                                                >
                                                    {isDeletingItem === item.id ? 'Removendo...' : 'Desconectar'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="pt-4 flex justify-center">
                                    <button
                                        onClick={() => {
                                            setView('connect');
                                            fetchConnectToken();
                                        }}
                                        className="text-sm text-gray-400 hover:text-white underline"
                                    >
                                        Voltar para conexão
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* View: CONNECT (Default) */}
                        {view === 'connect' && (
                            <>
                                {/* Loading State */}
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                        <div className="p-4 bg-[#d97757]/10 rounded-full">
                                            <Loader2 className="animate-spin text-[#d97757]" size={32} />
                                        </div>
                                        <p className="text-gray-400 text-sm">Preparando conexão segura...</p>
                                    </div>
                                )}

                                {/* Error State */}
                                {error && !isLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                                            <AlertCircle className="text-red-500" size={32} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-medium mb-1">Erro na conexão</p>
                                            <p className="text-gray-400 text-sm max-w-xs">{error}</p>
                                        </div>

                                        <div className="flex flex-col gap-2 mt-4 w-full max-w-[200px]">
                                            {error.includes('já está conectado') ? (
                                                <>
                                                    <button
                                                        onClick={fetchExistingItems}
                                                        className="w-full px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20"
                                                    >
                                                        Gerenciar Conexões
                                                    </button>
                                                    <button
                                                        onClick={onClose}
                                                        className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                                    >
                                                        Fechar
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={fetchConnectToken}
                                                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                                >
                                                    Tentar novamente
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Sync Status */}
                                {syncStatus !== 'idle' && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                        {syncStatus === 'syncing' && (
                                            <>
                                                <div className="p-4 bg-[#d97757]/10 rounded-full">
                                                    <Loader2 className="animate-spin text-[#d97757]" size={32} />
                                                </div>
                                                <p className="text-gray-400 text-sm">{syncMessage}</p>
                                            </>
                                        )}
                                        {syncStatus === 'success' && (
                                            <>
                                                <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                                    <CheckCircle className="text-emerald-500" size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-white font-medium mb-1">Sincronização concluída!</p>
                                                    <p className="text-gray-400 text-sm">{syncMessage}</p>
                                                </div>
                                            </>
                                        )}
                                        {syncStatus === 'error' && (
                                            <>
                                                <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                                                    <AlertCircle className="text-red-500" size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-white font-medium mb-1">Erro na sincronização</p>
                                                    <p className="text-gray-400 text-sm">{syncMessage}</p>
                                                </div>
                                                <button
                                                    onClick={onClose}
                                                    className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                                >
                                                    Fechar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Pluggy Widget Trigger */}
                                {connectToken && !isLoading && !error && syncStatus === 'idle' && (
                                    <div className="flex flex-col gap-6 animate-fade-in">
                                        {/* Segurança */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={18} className="text-emerald-500" />
                                                <h4 className="text-sm font-bold text-white">Segurança dos seus dados</h4>
                                            </div>
                                            <ul className="text-xs text-gray-400 space-y-2 ml-6">
                                                <li>Seus dados são criptografados e protegidos</li>
                                                <li>Não armazenamos senhas bancárias</li>
                                                <li>Conexão regulamentada pelo Banco Central</li>
                                                <li>Você pode revogar o acesso a qualquer momento</li>
                                            </ul>
                                        </div>

                                        <div className="border-t border-gray-800/50" />

                                        {/* Sobre a Pluggy */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Zap size={18} className="text-[#d97757]" />
                                                <h4 className="text-sm font-bold text-white">Sobre a Pluggy</h4>
                                            </div>
                                            <p className="text-xs text-gray-400 ml-6 leading-relaxed">
                                                Plataforma certificada pelo Open Finance Brasil. Seus dados são acessados apenas para leitura, sem possibilidade de movimentações.
                                            </p>
                                        </div>

                                        <div className="border-t border-gray-800/50" />

                                        {/* Instruções */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Info size={18} className="text-blue-400" />
                                                <h4 className="text-sm font-bold text-white">Como funciona</h4>
                                            </div>
                                            <ol className="text-xs text-gray-400 space-y-2 ml-6">
                                                <li><span className="text-gray-500 font-medium">1.</span> Clique em "Conectar Banco" abaixo</li>
                                                <li><span className="text-gray-500 font-medium">2.</span> Selecione seu banco na lista</li>
                                                <li><span className="text-gray-500 font-medium">3.</span> Faça login com suas credenciais</li>
                                                <li><span className="text-gray-500 font-medium">4.</span> Autorize o compartilhamento</li>
                                            </ol>
                                        </div>

                                        {/* Botão */}
                                        <button
                                            onClick={() => setShowPluggyWidget(true)}
                                            className="w-full mt-2 px-6 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20"
                                        >
                                            Conectar Banco
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {view === 'connect' && !isLoading && !error && syncStatus === 'idle' && !showPluggyWidget && (
                        <div className="px-5 py-4 border-t border-gray-800/50 relative z-10">
                            <p className="text-[11px] text-gray-500 text-center">
                                Sua conexão é segura e criptografada. Seus dados são protegidos pelo Open Finance Brasil.
                            </p>
                        </div>
                    )}
                </div>
            </div>,
            document.body
        )}
        {/* Pluggy Widget - rendered in separate portal outside modal with full screen backdrop */}
        {showPluggyWidget && connectToken && createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <PluggyConnect
                    connectToken={connectToken}
                    includeSandbox={false}
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onClose={() => setShowPluggyWidget(false)}
                />
            </div>,
            document.body
        )}
    </>;
};
