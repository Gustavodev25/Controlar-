import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PluggyConnect } from 'react-pluggy-connect';
import { X, ShieldCheck, Zap, Info, Loader2, AlertCircle, CheckCircle, Building, Link, RefreshCw } from 'lucide-react';
import { ConnectedAccount, ProviderBill, Transaction } from '../types';
import * as dbService from '../services/database';
import type { CreditCardTransaction } from '../services/database';
import { translatePluggyCategory } from '../services/openFinanceService';
import { saveSyncProgress, clearSyncProgress } from '../utils/syncProgress';

interface BankConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    onSuccess?: (accounts: ConnectedAccount[]) => void;
    forceSyncItemId?: string | null;
    // Credit system props
    dailyCredits?: { date: string; count: number };
    maxCreditsPerDay?: number;
    userPlan?: string;
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
    forceSyncItemId,
    dailyCredits,
    maxCreditsPerDay = 3,
    userPlan = 'pro'
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

    // Credit verification
    const todayDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const isNewConnection = !forceSyncItemId; // true = connecting new bank, false = syncing existing

    // NOTE: When dailyCredits is undefined, it means the user has NEVER used credits before
    // (the field doesn't exist in Firebase yet). This is NOT "loading" state.
    // In this case, the user has all credits available (count = 0).
    const effectiveCredits = dailyCredits || { date: '', count: 0 };

    // If date is today, use the count. If date is different (yesterday or empty), credits reset to 0.
    const creditsUsedToday = (effectiveCredits.date === todayDateStr) ? effectiveCredits.count : 0;

    // hasCredit logic:
    // - Starter plan: always false (no credits)
    // - Otherwise: check if credits used today < max
    // NOTE: Both new connections AND syncs consume credits
    // NOTE: undefined dailyCredits means user never used credits = has all credits available
    const hasCredit = userPlan === 'starter'
        ? false
        : (creditsUsedToday < maxCreditsPerDay);

    // For UI purposes - we consider credits "loaded" if we have a userId
    const isCreditsLoaded = !!userId;

    const normalizeAccount = useCallback((account: any, bills: ProviderBill[]): ConnectedAccount => {
        const creditData = account.creditData || {};
        const bankData = account.bankData || {};

        // Helper to extract account number from various sources
        const getAccountNumber = () => {
            // Priority 1: bankData fields from server
            if (bankData.accountNumber) return bankData.accountNumber;
            if (bankData.number) return bankData.number;
            if (bankData.transferNumber) return bankData.transferNumber;
            // Priority 2: explicit number field
            if (account.number) return account.number;
            // Priority 3: Extract from name if it looks like an account number (e.g., "123/4567-8" or "12345678")
            if (account.name && (/^\d{3}\/\d{4}\//.test(account.name) || /^\d+[-\/]/.test(account.name) || /^\d{6,}$/.test(account.name))) {
                return account.name;
            }
            return null;
        };

        // Helper to determine the best display name for the account (avoid raw account numbers)
        const getAccountDisplayName = () => {
            const type = (account.type || '').toUpperCase();
            const subtype = (account.subtype || '').toUpperCase();
            const isCredit = account.isCredit || type.includes('CREDIT') || subtype.includes('CREDIT');

            // Special handling for credit cards - prioritize brand
            if (isCredit) {
                const brand = creditData.brand;
                const cardName = account.marketingName || account.name;
                const isValidCardName = cardName && !/^\d/.test(cardName); // Not starting with a number

                if (brand && isValidCardName) {
                    // If cardName already includes brand, use it as-is
                    if (cardName.toLowerCase().includes(brand.toLowerCase())) {
                        return cardName;
                    }
                    return `${brand} ${cardName}`;
                } else if (brand) {
                    return brand;
                } else if (isValidCardName) {
                    return cardName;
                }
                return 'Cartão de Crédito';
            }

            // For non-credit accounts, use original logic
            // Priority 0: Use accountTypeName from server if available
            if (account.accountTypeName && account.accountTypeName !== 'Conta') {
                return account.name || account.marketingName || account.accountTypeName;
            }
            // Priority 1: marketingName
            if (account.marketingName) return account.marketingName;
            // Priority 2: name (if not a number format)
            if (account.name && !/^\d{3}\/\d{4}\//.test(account.name) && !/^\d+[-\/]/.test(account.name) && !/^\d{6,}$/.test(account.name)) {
                return account.name;
            }
            // Priority 3: Use server-provided type flags
            if (account.isSavings) return 'Poupança';
            if (account.isChecking) return 'Conta Corrente';
            // Priority 4: Infer from type/subtype
            if (account.subtype) return account.subtype;
            if (type.includes('SAVINGS') || subtype.includes('SAVINGS')) return 'Poupança';
            if (type === 'BANK' || type.includes('CHECKING') || subtype.includes('CHECKING')) return 'Conta Corrente';
            return 'Conta';
        };

        // Helper to determine the best display name for the institution
        const getInstitutionName = () => {
            // Priority 1: connector name (most reliable)
            if (account.connector?.name) return account.connector.name;
            // Priority 2: institution name from parent item
            if (account.item?.connector?.name) return account.item.connector.name;
            // Priority 3: bankData organization name
            if (bankData.organizationName) return bankData.organizationName;
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
            accountTypeName: account.accountTypeName ?? null, // 'Conta Corrente', 'Poupança', 'Cartão de Crédito'
            isCredit: account.isCredit ?? false,
            isSavings: account.isSavings ?? false,
            isChecking: account.isChecking ?? false,
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
            accountNumber: getAccountNumber(),
            // Bank data
            bankNumber: bankData.bankNumber ?? null,
            branchNumber: bankData.branchNumber ?? null,
            transferNumber: bankData.transferNumber ?? null
        };
    }, []);

    // --- Client-Side Sync Logic Removed (Moved to Server) ---
    // mapBankTransaction, buildCardTransaction, generateProjectedInstallments, 
    // syncBankTransactions, syncCreditCardTransactions were removed 
    // to prevent client-side permission errors. 
    // The server now handles all transaction saving/updates.


    const runFullSync = useCallback(
        async (itemId: string) => {
            if (!userId) return [];

            setSyncStatus('syncing');
            setSyncMessage('Sincronizando contas e transações (Servidor)...');
            clearSyncProgress();

            // Show initial progress
            saveSyncProgress({
                step: 'Processando no servidor...',
                current: 0,
                total: 100,
                startedAt: Date.now()
            });

            console.log('[BankConnectModal] Starting sync for itemId:', itemId);

            // Call the robust server-side sync (formerly Legacy, now Modern)
            const response = await fetch(`${API_BASE}/pluggy/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, userId })
            });

            const data = await response.json();
            console.log('[BankConnectModal] Sync response:', data);

            if (!response.ok) {
                saveSyncProgress({
                    step: 'Erro na conexão',
                    error: data.error || 'Erro ao sincronizar',
                    current: 0,
                    total: 1,
                    isComplete: true,
                    startedAt: Date.now()
                });
                throw new Error(data.error || 'Erro ao sincronizar dados do Pluggy.');
            }

            const accountsRaw = data.accounts || [];
            const syncedAccounts: ConnectedAccount[] = [];

            // We just map the accounts for UI update. The Server ALREADY saved everything (accounts + txs).
            for (const entry of accountsRaw) {
                if (!entry?.account) continue;
                // Helper to map robustly
                const bills = mapBills(entry.bills || []); // likely empty from server now, but that's fine
                const account = normalizeAccount(entry.account, bills);
                syncedAccounts.push(account);
            }

            // Build summary message with account types
            const summary = data.summary;
            let summaryParts = [`${syncedAccounts.length} contas processadas`];
            if (summary) {
                const parts = [];
                if (summary.checking > 0) parts.push(`${summary.checking} Conta${summary.checking > 1 ? 's' : ''} Corrente${summary.checking > 1 ? 's' : ''}`);
                if (summary.savings > 0) parts.push(`${summary.savings} Poupança${summary.savings > 1 ? 's' : ''}`);
                if (summary.credit > 0) parts.push(`${summary.credit} Cartão${summary.credit > 1 ? 'ões' : ''}`);
                if (parts.length > 0) {
                    summaryParts = [`Sincronização concluída! ${parts.join(', ')}`];
                }
            }

            setSyncStatus('success');
            const summaryMessage = summaryParts.join('. ');
            setSyncMessage(summaryMessage);

            // Show completion progress
            saveSyncProgress({
                step: summaryMessage,
                current: 100,
                total: 100,
                isComplete: true,
                startedAt: Date.now()
            });

            console.log('[BankConnectModal] Sync complete (Server-Side). Accounts:', syncedAccounts.length);
            setTimeout(() => clearSyncProgress(), 5000);

            return syncedAccounts;
        },
        [normalizeAccount, userId]
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
                            setSyncStatus('syncing');
                            setSyncMessage('Solicitando atualização ao banco...');

                            // Use new Trigger Sync flow
                            const response = await fetch(`${API_BASE}/pluggy/trigger-sync`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ itemId: forceSyncItemId, userId })
                            });

                            if (!response.ok) {
                                const data = await response.json();
                                throw new Error(data.error || 'Falha ao solicitar atualização');
                            }

                            setSyncStatus('success');
                            setSyncMessage('Atualização solicitada! O processo continuará em segundo plano.');

                            setTimeout(() => onClose(), 2000);
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
            // First try to fetch from Pluggy Remote API
            const response = await fetch(`${API_BASE}/pluggy/items?userId=${encodeURIComponent(userId)}`);
            const data = await response.json();

            if (response.ok) {
                // API returns { success: true, items: [...] }
                setExistingItems(data.items || data.results || []);
                setView('manage');
                setError(null);
            } else {
                console.error('Failed to fetch items remotely:', data);
                if (response.status === 401 || response.status === 403) {
                    // Fallback to Local DB items if Remote fails due to auth/permission
                    console.warn('Pluggy Remote Auth failed. Falling back to Local DB items.');

                    try {
                        const localResp = await fetch(`${API_BASE}/pluggy/db-items/${encodeURIComponent(userId)}`);
                        const localData = await localResp.json();
                        if (localResp.ok && localData.items) {
                            setExistingItems(localData.items);
                            setView('manage');
                            // Show a non-blocking toast or message?
                            // For now, just set error null so UI shows list
                            setError(null);
                        } else {
                            setError('Não foi possível carregar as conexões (Remoto e Local falharam).');
                        }
                    } catch (localErr) {
                        console.error('Error fetching local items:', localErr);
                        setError('Erro ao carregar conexões locais.');
                    }
                } else {
                    setError('Não foi possível carregar as conexões existentes.');
                }
            }
        } catch (err) {
            console.error('Error fetching items:', err);
            // Try fallback even on network error? Maybe.
            try {
                const localResp = await fetch(`${API_BASE}/pluggy/db-items/${encodeURIComponent(userId)}`);
                const localData = await localResp.json();
                if (localResp.ok && localData.items) {
                    setExistingItems(localData.items);
                    setView('manage');
                    setError(null);
                } else {
                    setError('Erro ao carregar conexões.');
                }
            } catch (localErr) {
                setError('Erro ao carregar conexões.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const handleDeleteRemoteItem = async (itemId: string) => {
        if (!userId) return;
        setIsDeletingItem(itemId);
        try {
            // Correct endpoint: DELETE /api/pluggy/item/:itemId
            const response = await fetch(`${API_BASE}/pluggy/item/${itemId}?userId=${encodeURIComponent(userId)}`, {
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
                // Even if remote delete fails (e.g. 401?), we might want to remove from local view?
                // But let's assume delete works.
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

        // Consume credit for BOTH new connections AND re-syncs
        // Every Pluggy operation consumes 1 daily credit
        try {
            const operationType = isNewConnection ? 'NEW connection' : 're-sync';
            console.log(`[BankConnectModal] Consuming daily credit for ${operationType}...`);
            await dbService.incrementDailyConnectionCredits(userId);
            console.log('[BankConnectModal] Daily credit consumed successfully. Credits used today:', creditsUsedToday + 1);
        } catch (creditErr) {
            console.error('[BankConnectModal] Failed to consume credit:', creditErr);
            // We do not block the flow here, but we log it.
        }

        try {
            setSyncStatus('syncing');
            setSyncMessage('Conexao autenticada. Sincronizando transacoes...');

            const synced = await runFullSync(data.item?.id);
            await fetchExistingItems();

            console.log('[BankConnectModal] Calling onSuccess with synced data:', synced);
            // Note: handleBankConnected in ConnectedAccounts no longer needs to increment credits
            if (onSuccess) onSuccess(synced);

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error('Error syncing after connect:', err);
            setError(err?.message || 'Erro ao sincronizar transacoes.');
            setSyncStatus('error');
        }
    }, [fetchExistingItems, onClose, onSuccess, runFullSync, userId, creditsUsedToday, isNewConnection]);



    const handleError = useCallback((error: { message?: string; code?: string; data?: any }) => {
        setShowPluggyWidget(false);
        const errorCode = error.message || error.code || '';
        const errorDataMessage = typeof error.data === 'string' ? error.data : error.data?.message || '';
        const duplicateError =
            errorCode === 'ITEM_USER_ALREADY_EXISTS' ||
            errorCode === 'ITEM_ALREADY_EXISTS' ||
            /existing item/i.test(errorCode) ||
            /existing item/i.test(errorDataMessage);

        // Check if we can extract the existing Item ID from the error
        let existingItemId = error.data?.item?.id;

        // Handle expected duplicate-item errors by redirecting user to manage view
        if (duplicateError) {
            console.log('Pluggy: User attempted to add an existing item.', existingItemId ? `ID: ${existingItemId}` : 'No ID found');

            // Force view to manage immediately
            setView('manage');
            setError('Este banco já está conectado. Você pode gerenciar ou remover a conexão existente.');
            setSyncStatus('idle');
            setSyncMessage('');

            // If we have the ID, ensure it is in the list even if fetch fails
            if (existingItemId) {
                // Add a temporary "orphan" item to the list so user can delete it
                setExistingItems(prev => {
                    if (prev.find(i => i.id === existingItemId)) return prev;
                    return [...prev, {
                        id: existingItemId,
                        connector: { name: 'Banco Conectado (Detectado)', imageUrl: null },
                        status: 'ORPHAN (Aguardando Ação)'
                    }];
                });
            }

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
                                    Gerencie suas conexões bancárias ativas.
                                </p>

                                {isLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="animate-spin text-[#d97757]" size={24} />
                                    </div>
                                ) : existingItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                                        <p className="text-gray-500">
                                            Nenhuma conexão encontrada no momento.
                                        </p>
                                        <p className="text-xs text-gray-600 max-w-[250px]">
                                            Se você já conectou um banco, ele deve aparecer aqui.
                                            Tente recarregar para buscar diretamente do servidor.
                                        </p>
                                        <button
                                            onClick={fetchExistingItems}
                                            className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors border border-gray-700"
                                        >
                                            <RefreshCw size={14} />
                                            Buscar Conexões na Nuvem
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {existingItems.map((item) => (
                                            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {item.connector && (
                                                        <div className="w-10 h-10 rounded-full bg-white p-1 overflow-hidden flex items-center justify-center">
                                                            {item.connector.imageUrl ?
                                                                <img src={item.connector.imageUrl} alt={item.connector.name} className="w-full h-full object-contain" />
                                                                : <Building size={20} className="text-gray-400" />
                                                            }
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
                                            onClick={() => {
                                                // Double-check credit before opening widget
                                                if (!hasCredit) {
                                                    if (!isCreditsLoaded) {
                                                        setError('Aguarde o carregamento das informações de crédito.');
                                                    } else {
                                                        setError(`Limite de ${maxCreditsPerDay} créditos diários atingido. Seus créditos serão renovados à meia-noite.`);
                                                    }
                                                    return;
                                                }
                                                setShowPluggyWidget(true);
                                            }}
                                            disabled={!hasCredit}
                                            className={`w-full mt-2 px-6 py-3 rounded-xl transition-colors text-sm font-bold shadow-lg ${!hasCredit
                                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                : 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-[#d97757]/20'
                                                }`}
                                        >
                                            {!isCreditsLoaded
                                                ? 'Carregando...'
                                                : !hasCredit
                                                    ? 'Sem créditos disponíveis'
                                                    : isNewConnection
                                                        ? 'Conectar Banco'
                                                        : 'Sincronizar Banco'}
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
