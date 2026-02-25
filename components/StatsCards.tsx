import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Sparkles, Building, Settings, Check, CreditCard, ChevronLeft, ChevronRight, Lock, Ticket } from './Icons';
import { DashboardStats, Transaction, ConnectedAccount } from '../types';
import { buildInvoices } from '../services/invoiceBuilder';
import { getEffectiveInvoiceMonth } from '../utils/transactionUtils';
import NumberFlow from '@number-flow/react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';
import { Tooltip } from './UIComponents';

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
  accountBalances?: {
    checking: number;
    checkingAccounts?: ConnectedAccount[];
    credit: {
      used: number;
      available: number;
      limit: number;
      accounts?: ConnectedAccount[];
    };
  };
  creditCardTransactions?: Transaction[];
  dashboardDate?: string; // YYYY-MM
  toggles?: {
    includeChecking: boolean;
    setIncludeChecking: (v: boolean) => void;
    includeCredit: boolean;
    setIncludeCredit: (v: boolean) => void;
    creditCardUseTotalLimit?: boolean;
    setCreditCardUseTotalLimit?: (v: boolean) => void;
    creditCardUseFullLimit?: boolean;
    setCreditCardUseFullLimit?: (v: boolean) => void;
    includeOpenFinance?: boolean;
    setIncludeOpenFinance?: (v: boolean) => void;
    enabledCreditCardIds?: string[];
    setEnabledCreditCardIds?: (ids: string[]) => void;
    cardInvoiceTypes?: Record<string, 'last' | 'current' | 'next' | 'used_total'>;
    setCardInvoiceTypes?: (types: Record<string, 'last' | 'current' | 'next' | 'used_total'>) => void;
  };
  cardInvoiceType?: Record<string, 'last' | 'current' | 'next' | 'used_total'>;
  setCardInvoiceType?: (types: Record<string, 'last' | 'current' | 'next' | 'used_total'>) => void;

  isProMode?: boolean;
  onActivateProMode?: () => void;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgradeClick?: () => void;
  hideCards?: boolean;
  labels?: {
    balance?: string;
    income?: string;
    expense?: string;
    savings?: string;
  };
  onPromoClick?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  isLoading = false,
  accountBalances,
  toggles,
  creditCardTransactions = [],
  dashboardDate,
  cardInvoiceType: propCardInvoiceType, // Alias to avoid conflict if both passed
  setCardInvoiceType: propSetCardInvoiceType,

  isProMode = true,
  onActivateProMode,
  userPlan = 'starter',
  onUpgradeClick,
  hideCards = false,
  labels,
  onPromoClick
}) => {
  // Helper function to detect credit card payment transactions
  const isCreditCardPayment = useCallback((description: string, category?: string): boolean => {
    const desc = description.toUpperCase();
    const cat = (category || '').toUpperCase();

    return (
      desc.includes('PAGAMENTO FATURA') ||
      desc.includes('PAG FATURA') ||
      desc.includes('PGTO FATURA') ||
      desc.includes('PGTO CARTAO') ||
      desc.includes('PAGTO CARTAO') ||
      desc.includes('CREDIT CARD PAYMENT') ||
      desc.includes('CARTAO DE CREDITO') ||
      desc.includes('FATURA CARTAO') ||
      desc.includes('DEBITO AUT. FATURA') ||
      desc.includes('DEBITO AUTOMATICO FATURA') ||
      desc.includes('PGTO TITULO BANCO') ||
      // Novos padrões para bancos digitais (Inter, Nubank, C6, etc.)
      (desc.includes('PAGAMENTO') && desc.includes('FATURA')) ||
      (desc.includes('PAGAMENTO EFETUADO') && desc.includes('FATURA')) ||
      (desc.includes('PAGAMENTO EFETUADO') && desc.includes('CARTAO')) ||
      (desc.includes('PAG') && desc.includes('FATURA') && desc.includes('CARTAO')) ||
      desc.includes('FATURA INTER') ||
      desc.includes('FATURA NUBANK') ||
      desc.includes('FATURA C6') ||
      desc.includes('FATURA ITAU') ||
      desc.includes('FATURA BRADESCO') ||
      desc.includes('FATURA SANTANDER') ||
      desc.includes('FATURA BB') ||
      desc.includes('FATURA CAIXA') ||
      cat.includes('FATURA') ||
      cat.includes('CARTÃO')
    );
  }, []);

  // Use enabledCreditCardIds from toggles (Synced with App.tsx)
  const cardsIncludedInExpenses = useMemo(() => {
    return new Set(toggles?.enabledCreditCardIds || []);
  }, [toggles?.enabledCreditCardIds]);

  const checkingAccounts = (accountBalances?.checkingAccounts || []).filter(acc => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();
    const name = (acc.name || '').toUpperCase();

    // Filter out Savings accounts based on multiple criteria
    const isSavings =
      type === 'SAVINGS' ||
      type === 'SAVINGS_ACCOUNT' ||
      subtype === 'SAVINGS' ||
      subtype === 'SAVINGS_ACCOUNT' ||
      name.includes('POUPANCA') ||
      name.includes('POUPANCA');

    return !isSavings;
  });

  // Initialize or fallback to the first account if selection is invalid or null
  // Initialize or fallback to all accounts if selection is invalid or null
  const [selectedCheckingAccountIds, setSelectedCheckingAccountIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finances_selected_checking_accounts');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
      }
      // Migration: Check for legacy single selection
      const legacy = localStorage.getItem('finances_selected_checking_account');
      if (legacy) return [legacy];
    }
    return []; // Empty means ALL
  });

  // Ensure we always have valid selections and initialize with all accounts selected by default
  useEffect(() => {
    if (checkingAccounts.length > 0) {
      const allAccountIds = checkingAccounts.map(acc => acc.id);

      // If no accounts selected yet (first load or empty), select ALL accounts by default
      if (selectedCheckingAccountIds.length === 0) {
        setSelectedCheckingAccountIds(allAccountIds);
      } else {
        // Filter out removed accounts (accounts that no longer exist)
        const validIds = selectedCheckingAccountIds.filter(id => checkingAccounts.some(acc => acc.id === id));
        if (validIds.length !== selectedCheckingAccountIds.length) {
          setSelectedCheckingAccountIds(validIds.length > 0 ? validIds : allAccountIds);
        }
      }
    }
  }, [checkingAccounts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finances_selected_checking_accounts', JSON.stringify(selectedCheckingAccountIds));
      // Cleanup legacy
      localStorage.removeItem('finances_selected_checking_account');
    }
  }, [selectedCheckingAccountIds]);

  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Track which invoice type each card uses for expenses (current or next)
  // Format: { cardId: 'current' | 'next' | 'used_total' }
  const [localCardInvoiceType, setLocalCardInvoiceType] = useState<Record<string, 'last' | 'current' | 'next' | 'used_total'>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finances_card_invoice_types');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
      }
    }
    return {};
  });

  const cardInvoiceType = propCardInvoiceType || toggles?.cardInvoiceTypes || localCardInvoiceType;
  const setCardInvoiceType = propSetCardInvoiceType || toggles?.setCardInvoiceTypes || setLocalCardInvoiceType;

  useEffect(() => {
    if (!toggles?.cardInvoiceTypes && typeof window !== 'undefined') {
      localStorage.setItem('finances_card_invoice_types', JSON.stringify(localCardInvoiceType));
    }
  }, [localCardInvoiceType, toggles?.cardInvoiceTypes]);

  // Calculate credit card invoice for the filtered month
  // This calculates the total expenses on credit cards for the displayed period
  const creditCardInvoice = useMemo(() => {
    if (!dashboardDate || creditCardTransactions.length === 0) {
      // If no month filter or no transactions, show total from accountBalances
      return accountBalances?.credit?.used || 0;
    }

    // Filter transactions that belong to the selected month's INVOICE
    // Only count expenses (positive amounts or expense type transactions)
    const monthTransactions = creditCardTransactions.filter(tx => {
      // Use helper for override detection and priority logic (manualInvoiceMonth > invoiceMonthKey)
      const effectiveKey = getEffectiveInvoiceMonth(tx);
      if (effectiveKey) {
        return effectiveKey === dashboardDate;
      }

      // PRIMARY: Check if invoiceDate matches the dashboard month (YYYY-MM)
      // invoiceDate format is YYYY-MM-01, so we compare the first 7 chars
      const txInvoiceMonth = (tx as any).invoiceDate?.slice(0, 7);
      if (txInvoiceMonth) return txInvoiceMonth === dashboardDate;

      // FALLBACK: If no invoiceDate, use transaction date (for manual transactions)
      return tx.date && tx.date.startsWith(dashboardDate);
    });

    // Sum up the amounts
    // Convention: expenses are positive amounts with type 'expense'
    const total = monthTransactions.reduce((sum, tx) => {
      // Ignore payment transactions to prevent double counting or incorrect invoice inflation
      if (isCreditCardPayment(tx.description || '', tx.category)) {
        return sum;
      }

      // For credit card transactions, expenses increase the invoice
      if (tx.type === 'expense') {
        return sum + Math.abs(tx.amount);
      }
      // Payments/credits decrease the invoice (these would be type 'income' on credit cards)
      if (tx.type === 'income') {
        return sum - Math.abs(tx.amount);
      }
      return sum;
    }, 0);

    return Math.max(0, total); // Invoice can't be negative
  }, [creditCardTransactions, dashboardDate, accountBalances?.credit?.used]);

  // Get credit card accounts for display
  const creditAccounts = accountBalances?.credit?.accounts || [];
  const creditLimit = accountBalances?.credit?.limit || 0;
  const creditAvailable = accountBalances?.credit?.available || 0;

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const isCurrentMonthView = !dashboardDate || dashboardDate === currentMonthKey;

  type InvoiceMode = 'due_current' | 'due_next' | 'used_total';
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finances_invoice_mode');
      if (stored === 'due_current' || stored === 'due_next' || stored === 'used_total') return stored;
    }
    return 'due_current';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finances_invoice_mode', invoiceMode);
    }
  }, [invoiceMode]);

  const getBillAmounts = useCallback((card: ConnectedAccount) => {
    const bills = card.bills || [];

    // 1. Prioritize the pre-calculated currentBill from the object (most reliable from backend)
    // We cast it to ProviderBill-like shape to satisfy local types if needed, or just use it.
    // However, card.currentBill lacks 'id' compared to ProviderBill.
    let currentBill: any = card.currentBill || null;

    // 2. Fallback: Search in bills array
    if (!currentBill && bills.length > 0) {
      const today = new Date();
      const sortedBills = [...bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      // Prioriza fatura OPEN; senão, a próxima com dueDate futuro; fallback última conhecida
      const openBill = sortedBills.find(b => b.state === 'OPEN');
      const futureBill = sortedBills.find(b => new Date(b.dueDate) >= today);
      currentBill = openBill || futureBill || sortedBills[sortedBills.length - 1] || null;
    }

    // 3. Find Next Bill relative to Current Bill
    let nextBill = null;
    if (bills.length > 0 && currentBill) {
      const sortedBills = [...bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      // Attempt to find index of currentBill in the full list
      // Match by ID (if available) or Due Date
      const currentIndex = sortedBills.findIndex(b =>
        (b.id && currentBill.id && b.id === currentBill.id) ||
        (b.dueDate === currentBill.dueDate)
      );

      if (currentIndex >= 0 && currentIndex < sortedBills.length - 1) {
        nextBill = sortedBills[currentIndex + 1];
      }
    }

    const currentAmount = currentBill ? Math.abs(currentBill.totalAmount || 0) : null;
    const nextAmount = nextBill ? Math.abs(nextBill.totalAmount || 0) : null;

    return { currentBill, nextBill, currentAmount, nextAmount };
  }, []);

  const resolveConnectedInvoice = useCallback((card: ConnectedAccount) => {
    const hasBalance = card.balance !== undefined && card.balance !== null;
    const normalizedBalance = hasBalance ? Math.abs(card.balance as number) : null;

    if (normalizedBalance !== null && normalizedBalance > 0) {
      return normalizedBalance;
    }

    if (card.bills && card.bills.length > 0) {
      const today = new Date();
      const sortedByDue = [...card.bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const futureBill = sortedByDue.find(bill => new Date(bill.dueDate) > today);
      const targetBill = futureBill || sortedByDue[sortedByDue.length - 1];
      if (targetBill) {
        const billAmount = Math.abs(targetBill.totalAmount || 0);
        if (billAmount > 0) return billAmount;
      }
    }

    if (normalizedBalance !== null) return normalizedBalance;
    return null;
  }, []);

  const getInvoiceByMode = useCallback((card: ConnectedAccount, transactionsForCard: Transaction[]) => {
    const bills = card.bills || [];

    // Logic extraction for current bill (consistent with getBillAmounts)
    let currentBill: any = card.currentBill || null;
    if (!currentBill && bills.length > 0) {
      const today = new Date();
      const sortedBills = [...bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      currentBill = sortedBills.find(b => {
        const dueDate = new Date(b.dueDate);
        return dueDate >= today || b.state === 'OPEN';
      }) || sortedBills.find(b => b.state === 'OPEN');
    }

    let nextBill = null;
    if (bills.length > 0 && currentBill) {
      const sortedBills = [...bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const idx = sortedBills.findIndex(b =>
        (b.id && currentBill.id && b.id === currentBill.id) ||
        (b.dueDate === currentBill.dueDate)
      );
      if (idx >= 0 && idx < sortedBills.length - 1) {
        nextBill = sortedBills[idx + 1];
      }
    }

    if (invoiceMode === 'due_current' && currentBill) {
      const amount = Math.abs(currentBill.totalAmount || 0);
      return amount; // Trust the bill amount, even if 0, unless we want to fallback? Usually bill amount is authoritative.
      // If amount is 0, maybe check transactions? But if a bill exists, 0 means 0 due.
    }

    if (invoiceMode === 'due_next' && nextBill) {
      const amount = Math.abs(nextBill.totalAmount || 0);
      if (amount > 0) return amount;
    }

    // Fallback if no bill found or mode mismatch (though due_current should have been caught)
    const openBill = bills.find(b => b.state === 'OPEN');
    if (openBill && Math.abs(openBill.totalAmount || 0) > 0) {
      return Math.abs(openBill.totalAmount);
    }

    const connectedInvoice = resolveConnectedInvoice(card);
    if (connectedInvoice !== null) return connectedInvoice;

    if (transactionsForCard.length > 0) {
      const txSum = transactionsForCard.reduce((sum, tx) => {
        if ((tx as any).ignored) return sum;
        if (isCreditCardPayment(tx.description || '', tx.category)) return sum;
        if (tx.type === 'expense') return sum + Math.abs(tx.amount);
        if (tx.type === 'income') return sum - Math.abs(tx.amount);
        return sum;
      }, 0);
      return Math.max(0, txSum);
    }

    return 0;
  }, [invoiceMode, resolveConnectedInvoice]);

  // Calculate invoice per individual card - matches transactions to cards and filters by month
  const cardInvoices = useMemo(() => {
    const uniqueAccountIds = [...new Set(creditCardTransactions.map(tx => tx.accountId || tx.cardId).filter(Boolean))];

    const resolveTxMonthKey = (tx: Transaction) => {
      const effectiveMonth = getEffectiveInvoiceMonth(tx);
      if (effectiveMonth) return effectiveMonth;

      if (tx.invoiceDueDate) return tx.invoiceDueDate.slice(0, 7);
      if (tx.dueDate) return tx.dueDate.slice(0, 7);
      if (tx.invoiceDate) return tx.invoiceDate.slice(0, 7);
      if (tx.date) return tx.date.slice(0, 7);
      return '';
    };

    // Helper to find bill for a specific month from card's bills list
    const getBillForMonth = (card: ConnectedAccount, targetMonth: string) => {
      const bills = card.bills || [];
      if (bills.length === 0) return null;

      // Find bill whose dueDate month matches the target month
      const matchingBill = bills.find(bill => {
        const billMonth = bill.dueDate?.slice(0, 7);
        return billMonth === targetMonth;
      });

      return matchingBill || null;
    };

    return creditAccounts.map((card, cardIndex) => {
      const isConnectedCard = card.connectionMode !== 'MANUAL';

      let cardTransactions = creditCardTransactions.filter(tx => {
        const txAccountId = tx.accountId || tx.cardId;
        return txAccountId === card.id;
      });

      // If we only have one card, include unassigned CC transactions as well
      if (creditAccounts.length === 1) {
        const unassigned = creditCardTransactions.filter(tx => !tx.accountId && !tx.cardId);
        if (unassigned.length > 0) {
          cardTransactions = cardTransactions.concat(unassigned);
        }
      }

      if (cardTransactions.length === 0) {
        if (uniqueAccountIds.length === creditAccounts.length && uniqueAccountIds.length > 0) {
          const sortedAccountIds = [...uniqueAccountIds].sort();
          const targetAccountId = sortedAccountIds[cardIndex];
          cardTransactions = creditCardTransactions.filter(tx => tx.accountId === targetAccountId);
        }

        if (cardTransactions.length === 0 && creditAccounts.length === 1) {
          cardTransactions = creditCardTransactions;
        }
      }

      let filteredTransactions = cardTransactions;
      if (dashboardDate) {
        filteredTransactions = cardTransactions.filter(tx => {
          const key = getEffectiveInvoiceMonth(tx)
            || tx.invoiceDueDate?.slice(0, 7)
            || tx.dueDate?.slice(0, 7)
            || tx.invoiceDate?.slice(0, 7)
            || tx.date?.slice(0, 7);
          return key && key.startsWith(dashboardDate);
        });
      }

      // Soma mensal apenas deste cartao (invoiceDueDate > dueDate > invoiceDate > date)
      const cardMonthSums = new Map<string, number>();
      cardTransactions.forEach((tx) => {
        if ((tx as any).ignored) return;

        const key = getEffectiveInvoiceMonth(tx)
          || tx.invoiceDueDate?.slice(0, 7)
          || tx.dueDate?.slice(0, 7)
          || tx.invoiceDate?.slice(0, 7)
          || tx.date?.slice(0, 7);

        if (!key) return;
        // FIX: Only treat as payment/credit if it is explicitly Income OR has isRefund flag.
        // NÃO usa detecção automática por categoria 'Reembolso'.
        const isPayment = (tx.type === 'income') || (tx as any).isRefund === true;
        const delta = Math.abs(tx.amount || 0) * (isPayment ? -1 : 1);
        cardMonthSums.set(key, (cardMonthSums.get(key) || 0) + delta);
      });

      const sortedMonthKeys = Array.from(cardMonthSums.keys()).sort();

      // When dashboardDate is set, try to find the bill for that specific month
      let selectedMonthBill: any = null;
      let selectedMonthAmount: number | null = null;

      if (dashboardDate) {
        selectedMonthBill = getBillForMonth(card, dashboardDate);
        if (selectedMonthBill) {
          selectedMonthAmount = Math.abs(selectedMonthBill.totalAmount || 0);
        }
      }

      const { currentBill, nextBill, currentAmount, nextAmount } = getBillAmounts(card);
      const deriveNextDueDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
      };

      // Calculate invoice value based on context (filtered month vs current)
      let invoiceValue = 0;

      // When a specific month is selected (dashboardDate):
      // 1. Calculate from transactions (respecting manual overrides)
      // 2. Fallback to API bill amount only if needed
      if (dashboardDate) {
        // Calculate from filteredTransactions which handles manualInvoiceMonth logic correctly
        const txSum = filteredTransactions.reduce((sum, tx) => {
          if ((tx as any).ignored) return sum;
          if (isCreditCardPayment(tx.description || '', tx.category)) return sum;
          if (tx.type === 'expense') return sum + Math.abs(tx.amount);
          if (tx.type === 'income') return sum - Math.abs(tx.amount);
          return sum;
        }, 0);

        invoiceValue = Math.max(0, txSum);

        // Fallback: Use API bill amount if transaction sum is 0 but we have a bill
        if (invoiceValue === 0 && selectedMonthAmount !== null && selectedMonthAmount > 0) {
          invoiceValue = selectedMonthAmount;
        }
      } else if (currentAmount !== null || nextAmount !== null) {
        // No specific month filter, use current/next bill logic
        if (invoiceMode === 'used_total') {
          invoiceValue = getInvoiceByMode(card, filteredTransactions);
        } else if (invoiceMode === 'due_next') {
          invoiceValue = (nextAmount ?? currentAmount ?? 0);
        } else {
          // default: due_current
          invoiceValue = (currentAmount ?? nextAmount ?? 0);
        }
      } else {
        invoiceValue = getInvoiceByMode(card, filteredTransactions);
      }
      invoiceValue = Math.max(0, invoiceValue);

      const currentMonthKeyFromBill = currentBill?.dueDate?.slice(0, 7);
      const nextMonthKeyFromBill = nextBill?.dueDate?.slice(0, 7);

      // Se não há bill futura, pegue o próximo mês com transações projetadas
      let currentMonthKey = dashboardDate || currentMonthKeyFromBill;
      if (!currentMonthKey) {
        const todayKey = new Date().toISOString().slice(0, 7);
        currentMonthKey = sortedMonthKeys.find(k => k >= todayKey) || sortedMonthKeys[0];
      }

      const incrementMonthKey = (key?: string | null) => {
        if (!key) return null;
        const [y, m] = key.split('-').map(Number);
        if (!y || !m) return null;
        const d = new Date(y, m - 1, 1);
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      let nextMonthKey = nextMonthKeyFromBill;
      if (!nextMonthKey && currentMonthKey) {
        nextMonthKey = sortedMonthKeys.find(k => k > currentMonthKey) || incrementMonthKey(currentMonthKey);
      }

      // ============================================================
      // USA O INVOICEBUILDER para calcular faturas corretamente
      // Isso garante consistência com a view de Fatura do Cartão
      // ============================================================
      let currentInvoiceValue: number;
      let nextInvoiceValue: number;
      let lastInvoiceValue: number;

      try {
        // Chama buildInvoices para obter valores precisos
        const invoiceResult = buildInvoices(card, cardTransactions, card.id);

        if (dashboardDate) {
          // When dashboardDate is active, use invoiceBuilder result
          // because it correctly handles manualInvoiceMonth logic
          currentInvoiceValue = Math.max(0, invoiceResult.currentInvoice.total);
        } else {
          // Fatura Atual = currentInvoice.total do invoiceBuilder
          currentInvoiceValue = Math.max(0, invoiceResult.currentInvoice.total);
        }

        // Próxima Fatura = primeira fatura futura ou 0
        nextInvoiceValue = invoiceResult.futureInvoices.length > 0
          ? Math.max(0, invoiceResult.futureInvoices[0].total)
          : 0;

        const sortedBills = [...(card.bills || [])].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const lastClosedBill = sortedBills.reverse().find(b => b.state === 'CLOSED');
        
        if (lastClosedBill && lastClosedBill.totalAmount !== undefined && lastClosedBill.totalAmount !== null) {
          lastInvoiceValue = Math.max(0, Math.abs(lastClosedBill.totalAmount));
        } else {
          lastInvoiceValue = Math.max(0, Math.abs(invoiceResult.closedInvoice.total || 0));
        }

      } catch (e) {
        // Fallback para cálculo antigo se buildInvoices falhar
        console.warn('[StatsCards] buildInvoices falhou, usando fallback:', e);

        if (dashboardDate && selectedMonthAmount !== null && selectedMonthAmount > 0) {
          currentInvoiceValue = selectedMonthAmount;
        } else if (dashboardDate) {
          currentInvoiceValue = invoiceValue;
        } else {
          currentInvoiceValue = Math.max(0, currentAmount !== null
            ? currentAmount
            : (cardMonthSums.get(currentMonthKey || '') || invoiceValue));
        }

        nextInvoiceValue = Math.max(0, nextAmount !== null
          ? nextAmount
          : (cardMonthSums.get(nextMonthKey || '') || 0));

        lastInvoiceValue = Math.max(0, Math.abs(card.currentBill?.totalAmount || 0)); // Fallback
      }

      // Calculate used limit correctly from Pluggy data:
      // Priority 1: usedCreditLimit (direct from Pluggy)
      // Priority 2: creditLimit - availableCreditLimit (calculated)
      // Priority 3: balance (for Open Finance, balance IS the used limit)
      // Priority 4: invoice value as fallback
      let usedTotal = 0;

      // First, try to get creditLimit and availableCreditLimit from the card
      const hasValidCreditLimit = card.creditLimit !== undefined && card.creditLimit !== null && card.creditLimit > 0;
      const hasValidAvailableLimit = card.availableCreditLimit !== undefined && card.availableCreditLimit !== null;
      const hasValidUsedLimit = card.usedCreditLimit !== undefined && card.usedCreditLimit !== null && card.usedCreditLimit >= 0;

      if (hasValidUsedLimit) {
        // Priority 1: Direct usedCreditLimit from Pluggy API
        usedTotal = card.usedCreditLimit;
      } else if (hasValidCreditLimit && hasValidAvailableLimit) {
        // Priority 2: Calculate used = creditLimit - availableCreditLimit
        usedTotal = Math.max(0, card.creditLimit - card.availableCreditLimit);
      } else if (card.balance !== undefined && card.balance !== null && Math.abs(card.balance) > 0) {
        // Priority 3: Use balance (for Open Finance connectors, balance = used limit)
        usedTotal = Math.abs(card.balance);
      } else {
        // Priority 4: Use invoice value as last resort
        usedTotal = currentInvoiceValue;
      }

      // Use manual limit if set, otherwise fall back to API limit
      let cardLimit = card.manualCreditLimit || card.creditLimit || 0;
      let cardAvailable = card.availableCreditLimit || 0;

      // Improve Limit Calculation if missing
      if (cardLimit === 0) {
        // Check if we have availableCreditLimit - can estimate limit
        if (hasValidAvailableLimit && usedTotal > 0) {
          // Estimate: limit = available + used
          cardLimit = cardAvailable + usedTotal;
        } else if (creditLimit > 0 && creditAccounts.length > 1) {
          // Fallback 1: Proportional distribution of total limit (Only if multiple cards)
          const totalBalance = creditAccounts.reduce((sum, c) => sum + Math.abs(c.balance || 0), 0);
          const cardProportion = totalBalance > 0 ? Math.abs(card.balance || 0) / totalBalance : 1 / creditAccounts.length;
          cardLimit = creditLimit * cardProportion;
        } else if (creditLimit > 0 && creditAccounts.length === 1) {
          cardLimit = creditLimit;
        }
      }

      // If we still don't have limit but have available, try to estimate
      if (cardLimit === 0 && cardAvailable > 0) {
        cardLimit = cardAvailable + usedTotal;
      }

      if (cardLimit > 0) {
        // Use API available limit if present, otherwise estimate
        if (hasValidAvailableLimit) {
          cardAvailable = card.availableCreditLimit;
        } else {
          cardAvailable = Math.max(0, cardLimit - usedTotal);
        }
      }

      const payableAmount = invoiceValue;

      // Build future month list (current + next months)
      const futureMonthKeys: string[] = [];
      const pushUnique = (key?: string | null) => {
        if (!key) return;
        if (!futureMonthKeys.includes(key)) futureMonthKeys.push(key);
      };
      pushUnique(currentMonthKey);
      pushUnique(nextMonthKey);
      pushUnique(incrementMonthKey(nextMonthKey || currentMonthKey) || undefined);
      pushUnique(incrementMonthKey(incrementMonthKey(nextMonthKey || currentMonthKey) || undefined) || undefined);

      const futureInvoices = futureMonthKeys.map((key, idx) => {
        let amount = Math.max(0, cardMonthSums.get(key) || 0);
        if (idx === 0) amount = currentInvoiceValue;
        if (idx === 1) amount = nextInvoiceValue || amount;
        const dueDate =
          idx === 0 ? (currentBill?.dueDate) :
            idx === 1 ? (nextBill?.dueDate || deriveNextDueDate(currentBill?.dueDate)) :
              null;
        return { monthKey: key, amount, dueDate };
      });

      return {
        cardId: card.id,
        invoice: invoiceValue,
        usedTotal,
        payable: payableAmount,
        limit: cardLimit,
        available: cardAvailable,
        lastInvoice: lastInvoiceValue,
        currentInvoice: currentInvoiceValue,
        nextInvoice: nextInvoiceValue,
        currentBillDueDate: currentBill?.dueDate,
        nextBillDueDate: nextBill?.dueDate || deriveNextDueDate(currentBill?.dueDate),
        futureInvoices
      };
    });
  }, [creditAccounts, creditCardTransactions, dashboardDate, creditLimit, getInvoiceByMode, getBillAmounts, invoiceMode, resolveConnectedInvoice]);

  // Total that will be added to expenses based on selected invoice type per card
  const selectedCardInvoiceTotal = useMemo(() => {
    return cardInvoices.reduce((sum, cardInvoice, idx) => {
      const card = creditAccounts[idx];
      if (!card || !cardsIncludedInExpenses.has(card.id)) return sum;

      const selectedType = cardInvoiceType[card.id] || 'current';
      const currentValue = cardInvoice?.currentInvoice ?? cardInvoice?.payable ?? cardInvoice?.invoice ?? 0;
      const nextValue = cardInvoice?.nextInvoice ?? 0;

      let chosenValue = currentValue;
      if (selectedType === 'next') chosenValue = nextValue;
      else if (selectedType === 'last') chosenValue = cardInvoice?.lastInvoice ?? 0;
      else if (selectedType === 'used_total') chosenValue = cardInvoice?.usedTotal ?? 0;

      return sum + chosenValue;
    }, 0);
  }, [cardInvoices, cardInvoiceType, cardsIncludedInExpenses, creditAccounts]);

  // Sort cards by value (highest to lowest) to ensure the most important ones are seen first
  const sortedCards = useMemo(() => {
    if (!creditAccounts.length) return [];

    // Combine card with its calculated invoice data
    const combined = creditAccounts.map((card, index) => ({
      card,
      invoiceData: cardInvoices[index] || {
        invoice: 0, limit: 0, available: 0,
        cardId: card.id, usedTotal: 0, payable: 0,
        currentInvoice: 0, nextInvoice: 0, lastInvoice: 0, futureInvoices: []
      }
    }));

    return combined.sort((a, b) => {
      // Determine value to sort by based on current view settings
      const getVal = (item: typeof combined[0]) => {
        const invoice = item.invoiceData;
        if (!invoice) return 0;

        const type = cardInvoiceType[item.card.id] || 'current';
        if (type === 'used_total') return invoice.usedTotal;
        if (type === 'next') return invoice.nextInvoice;
        if (type === 'last') return invoice.lastInvoice;
        // Default: current
        return invoice.currentInvoice ?? invoice.payable ?? invoice.invoice ?? 0;
      };

      return getVal(b) - getVal(a);
    });
  }, [creditAccounts, cardInvoices, cardInvoiceType]);

  // Navigation functions for credit card carousel
  const goToNextCard = () => {
    if (sortedCards.length > 0) {
      setActiveCardIndex(prev => (prev + 1) % sortedCards.length);
    }
  };

  const goToPrevCard = () => {
    if (sortedCards.length > 0) {
      setActiveCardIndex(prev => (prev - 1 + sortedCards.length) % sortedCards.length);
    }
  };

  // Get current card data from SORTED list
  const currentCardEntry = sortedCards[activeCardIndex];
  const currentCard = currentCardEntry?.card;
  const currentCardInvoice = currentCardEntry?.invoiceData || {
    invoice: 0, limit: 0, available: 0,
    cardId: '', usedTotal: 0, payable: 0, currentInvoice: 0, nextInvoice: 0, futureInvoices: []
  };

  // Drag state for card carousel
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Handle drag end to switch cards
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 50; // Minimum drag distance to trigger card change

    if (info.offset.x < -threshold) {
      // Swiped left - go to next card
      goToNextCard();
    } else if (info.offset.x > threshold) {
      // Swiped right - go to previous card
      goToPrevCard();
    }
  };

  // Calculate displayed checking balance based on selection
  const displayedCheckingBalance = useMemo(() => {
    // Sum only the selected accounts (if none selected, return 0)
    if (selectedCheckingAccountIds.length === 0) {
      return 0;
    }
    return checkingAccounts
      .filter(acc => selectedCheckingAccountIds.includes(acc.id))
      .reduce((sum, acc) => sum + (acc.balance ?? 0), 0);
  }, [selectedCheckingAccountIds, checkingAccounts]);

  // Label logic
  const checkingLabel = useMemo(() => {
    if (selectedCheckingAccountIds.length === 0) return 'Saldo em Conta';
    if (selectedCheckingAccountIds.length === 1) {
      const acc = checkingAccounts.find(a => a.id === selectedCheckingAccountIds[0]);
      return acc?.institution || acc?.name || 'Conta';
    }
    // If all accounts are selected, show "Saldo em Conta"
    if (selectedCheckingAccountIds.length === checkingAccounts.length) {
      return 'Saldo em Conta';
    }
    return `Contas Selecionadas (${selectedCheckingAccountIds.length})`;
  }, [selectedCheckingAccountIds, checkingAccounts]);

  // Calculate adjusted Total Income based on selected checking account
  // When "Incluir no Saldo" is enabled, add checking balance to income
  const adjustedTotalIncome = useMemo(() => {
    if (toggles?.includeChecking && displayedCheckingBalance > 0) {
      return stats.totalIncome + displayedCheckingBalance;
    }
    return stats.totalIncome;
  }, [stats.totalIncome, toggles?.includeChecking, displayedCheckingBalance]);

  // Calculate adjusted Total Expense: Remove the static CC expense from App.tsx and add the dynamic one selected here
  const adjustedTotalExpense = useMemo(() => {
    // Subtract the CC expense that App.tsx already added, so we don't double count
    const baseExpense = stats.totalExpense - (stats.creditCardSpending || 0);
    return baseExpense + selectedCardInvoiceTotal;
  }, [stats.totalExpense, stats.creditCardSpending, selectedCardInvoiceTotal]);

  // Calculate adjusted Total Balance: simply Income - Expenses
  const adjustedTotalBalance = useMemo(() => {
    return adjustedTotalIncome - adjustedTotalExpense;
  }, [adjustedTotalIncome, adjustedTotalExpense]);

  // Helper to translate account type/subtype to Portuguese
  const getAccountTypeLabel = (acc: ConnectedAccount) => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();

    // Se o type for CHECKING, +® conta corrente
    if (type === 'CHECKING') return 'Conta Corrente';

    if (subtype === 'CHECKING_ACCOUNT' || subtype === 'CHECKING') return 'Conta Corrente';
    if (subtype === 'SALARY_ACCOUNT' || subtype === 'SALARY') return 'Conta Salario';
    if (subtype === 'PAYMENT_ACCOUNT' || subtype === 'PAYMENT') return 'Conta de Pagamento';
    if (subtype === 'SAVINGS_ACCOUNT' || subtype === 'SAVINGS') return 'Poupan+ºa';
    if (subtype === 'INDIVIDUAL') return 'Conta Corrente';

    // Fallback: mostra o subtype ou type
    return subtype || type || 'Conta Corrente';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
            <div className="space-y-3 w-full">
              <div className="h-3 bg-gray-800 rounded w-1/3"></div>
              <div className="h-8 bg-gray-800 rounded w-2/3"></div>
            </div>
            <div className="h-10 w-10 bg-gray-800 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6 animate-fade-in">


      {/* Account Balances & Toggles Row */}
      {!hideCards && accountBalances && toggles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Checking Account */}
          <div className={`relative p-4 rounded-xl shadow-sm border transition-all duration-200 h-[120px] flex flex-col justify-between ${toggles.includeChecking ? 'bg-[#30302E] border-gray-800' : 'bg-[#30302E]/50 border-gray-800/50'}`}>
            {/* Past month overlay removed: balance stays visible for any month */}
            {/* Blur overlay for Manual Mode */}
            {!isProMode && userPlan === 'starter' && (
              <div
                onClick={userPlan === 'starter' ? onUpgradeClick : onActivateProMode}
                className="absolute inset-0 z-20 bg-[#30302E]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center cursor-pointer group transition-all hover:bg-[#30302E]/70"
              >
                <div className="p-3 bg-[#d97757]/20 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                  {userPlan === 'starter' ? <Lock size={24} className="text-[#d97757]" /> : <Building size={24} className="text-[#d97757]" />}
                </div>
                <p className="text-sm font-bold text-white">Modo Auto</p>
                {userPlan === 'starter' ? (
                  <span className="mt-2 text-xs text-amber-500 font-medium">
                    Funcionalidade Pro
                  </span>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Ative para ver saldo automatico</p>
                )}
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className={`flex items-center gap-3 ${!toggles.includeChecking ? 'opacity-50' : ''}`}>
                <div className="p-2.5 bg-emerald-900/20 rounded-lg text-emerald-400">
                  <Building size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-400 font-medium">
                      {checkingLabel}
                    </p>
                    {checkingAccounts.length > 0 && selectedCheckingAccountIds.length === checkingAccounts.length && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                        Todas ({checkingAccounts.length})
                      </span>
                    )}
                    {selectedCheckingAccountIds.length > 0 && selectedCheckingAccountIds.length < checkingAccounts.length && (
                      <span className="text-[10px] text-emerald-500 bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                        {selectedCheckingAccountIds.length} de {checkingAccounts.length}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white mt-0.5">
                    <NumberFlow
                      value={displayedCheckingBalance}
                      format={{ style: 'currency', currency: 'BRL' }}
                      locales="pt-BR"
                    />
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Dropdown>
                  <Tooltip content="Contas Correntes">
                    <DropdownTrigger id="dashboard-checking-settings" className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors data-[state=open]:bg-gray-800 data-[state=open]:text-white">
                      <Settings size={16} />
                    </DropdownTrigger>
                  </Tooltip>

                  <DropdownContent width="w-72" align="right" portal>
                    <DropdownLabel>Contas Correntes</DropdownLabel>

                    {/* Toggle include in balance */}
                    <div
                      onClick={() => toggles.setIncludeChecking(!toggles.includeChecking)}
                      className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group mx-1 my-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-emerald-900/30 text-emerald-400">
                          <Wallet size={14} />
                        </div>
                        <span className="text-sm text-gray-300 group-hover:text-white">Incluir no Saldo</span>
                      </div>
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${toggles.includeChecking ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.includeChecking ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </div>

                    <DropdownSeparator />

                    <DropdownLabel>Suas Contas</DropdownLabel>

                    {checkingAccounts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhuma conta conectada</div>
                    ) : (
                      <div className="p-1 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {checkingAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            onClick={() => {
                              setSelectedCheckingAccountIds(prev => {
                                if (prev.includes(acc.id)) {
                                  return prev.filter(id => id !== acc.id);
                                } else {
                                  return [...prev, acc.id];
                                }
                              });
                            }}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedCheckingAccountIds.includes(acc.id)
                              ? 'bg-emerald-900/30 border border-emerald-500/30'
                              : 'bg-transparent hover:bg-gray-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex-shrink-0">
                                {acc.connector?.imageUrl ? (
                                  <img
                                    src={acc.connector.imageUrl}
                                    alt=""
                                    className="w-5 h-5 rounded object-contain"
                                  />
                                ) : (
                                  <div className="p-1.5 rounded bg-emerald-900/30 text-emerald-400">
                                    <Building size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{acc.institution || acc.name || 'Conta'}</p>
                                <p className="text-[10px] text-gray-500 truncate">{getAccountTypeLabel(acc)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold font-mono flex-shrink-0 ${(acc.balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(acc.balance ?? 0)}
                              </p>
                              {selectedCheckingAccountIds.includes(acc.id) && (
                                <Check size={14} className="text-emerald-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DropdownContent>
                </Dropdown>
              </div>
            </div>
          </div>

          {/* Credit Card Carousel - Improved Fluid Stack */}
          <div
            ref={constraintsRef}
            className="relative h-[120px] perspective-[1000px]"
          >
            {/* Blur overlay for Manual Mode */}
            {!isProMode && userPlan === 'starter' && (
              <div
                onClick={userPlan === 'starter' ? onUpgradeClick : onActivateProMode}
                className="absolute inset-0 z-20 bg-[#30302E]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center cursor-pointer group transition-all hover:bg-[#30302E]/70"
              >
                <div className="p-3 bg-[#d97757]/20 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                  {userPlan === 'starter' ? <Lock size={24} className="text-[#d97757]" /> : <CreditCard size={24} className="text-[#d97757]" />}
                </div>
                <p className="text-sm font-bold text-white">Modo Auto</p>
                {userPlan === 'starter' ? (
                  <span className="mt-2 text-xs text-amber-500 font-medium">
                    Funcionalidade Pro
                  </span>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Ative para ver cartoes conectados</p>
                )}
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {sortedCards.length > 0 ? (
                sortedCards.map((entry, index) => {
                  const { card, invoiceData: cardInvoice } = entry;

                  // We only render the active card and the next 2 cards for the stack effect
                  // But to make it truly fluid with AnimatePresence, we can render them all 
                  // and control visibility via variants, OR simpler:
                  // Render the stack conceptually.

                  // Actually, to get the "popLayout" working for the active card replacement,
                  // we should structure it as:
                  // 1. Background Stack (Static items animating to new positions)
                  // 2. Active Card (The one draggable)

                  // Let's use the approach where we map all cards but style them based on offset
                  const offset = (index - activeCardIndex + sortedCards.length) % sortedCards.length;

                  // We only want to render the top 3 cards visually to avoid DOM clutter and z-fighting
                  // But we need to render the "exiting" card too.
                  // Since we are mapping ALL cards, we can just control opacity/z-index.

                  if (offset > 2 && offset !== sortedCards.length - 1) {
                    // Hide cards that are deep in the stack, unless it's the one that might be "previous" (for reverse anims)
                    // For simplicity in this specific requested flow "swiping", we focus on the forward stack.
                    return null;
                  }

                  const currentInvoiceValue = cardInvoice?.currentInvoice ?? cardInvoice?.payable ?? cardInvoice?.invoice ?? 0;
                  const nextInvoiceValue = cardInvoice?.nextInvoice ?? 0;
                  const lastInvoiceValue = cardInvoice?.lastInvoice ?? 0;
                  const formatDueDate = (dateStr?: string) => {
                    if (!dateStr) return '--/--/----';
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return '--/--/----';
                    return d.toLocaleDateString('pt-BR');
                  };
                  const isCurrent = offset === 0;
                  const isNext = offset === 1;
                  const isNextNext = offset === 2;

                  // Dynamic z-index
                  const zIndex = sortedCards.length - offset;

                  const selectedType = cardInvoiceType[card.id] || 'current';

                  const displayValue = selectedType === 'used_total'
                    ? (cardInvoice?.usedTotal ?? 0)
                    : selectedType === 'next'
                      ? (cardInvoice?.nextInvoice ?? 0)
                      : selectedType === 'last'
                        ? (cardInvoice?.lastInvoice ?? 0)
                        : (cardInvoice?.currentInvoice ?? cardInvoice?.payable ?? cardInvoice?.invoice ?? 0);

                  // Format month name for display
                  const getMonthLabel = () => {
                    if (selectedType === 'used_total') return 'total usado';
                    if (selectedType === 'next') return 'próxima fatura';
                    if (selectedType === 'last') return 'última fatura';
                    if (dashboardDate) {
                      const [year, month] = dashboardDate.split('-').map(Number);
                      const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                      return `fatura ${monthNames[month - 1]}/${year}`;
                    }
                    return 'fatura atual';
                  };
                  const displayLabel = getMonthLabel();

                  return (
                    <motion.div
                      key={card.id}
                      layoutId={isCurrent ? undefined : `card-${card.id}`} // Only layout animate background cards
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1 : 1 - (offset * 0.05),
                        y: isCurrent ? 0 : offset * 10, // Stack effect downwards
                        z: isCurrent ? 0 : -offset, // slight depth
                        opacity: isCurrent ? 1 : 1 - (offset * 0.2),
                        zIndex: zIndex,
                        x: 0
                      }}
                      // Only the current card gets the drag/swipe logic
                      drag={isCurrent && sortedCards.length > 1 ? "x" : false}
                      dragConstraints={{ left: 0, right: 0 }} // We want it to snap back or fly away
                      dragElastic={0.2}
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={(e, { offset: swipeOffset, velocity }) => {
                        setIsDragging(false);
                        if (!isCurrent) return;
                        const swipeThreshold = 100;
                        if (swipeOffset.x < -swipeThreshold || velocity.x < -500) {
                          // Swipe Left -> Next Card
                          goToNextCard();
                        } else if (swipeOffset.x > swipeThreshold || velocity.x > 500) {
                          // Swipe Right -> Prev Card
                          goToPrevCard();
                        }
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30
                      }}
                      className={`absolute inset-0 p-4 rounded-xl border flex flex-col justify-between h-[120px] shadow-lg ${isCurrent
                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 cursor-grab active:cursor-grabbing'
                        : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700/50 pointer-events-none'
                        }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        boxShadow: isCurrent
                          ? '0 8px 30px -10px rgba(0, 0, 0, 0.5)'
                          : '0 4px 15px -5px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      {/* Card Content */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {card.connector?.imageUrl ? (
                            <img
                              src={card.connector.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-contain"
                            />
                          ) : (
                            <div className={`p-2.5 rounded-lg ${isCurrent ? 'bg-[#D97757]/10 text-[#D97757]' : 'bg-gray-700/20 text-gray-500'}`}>
                              <CreditCard size={20} />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium truncate max-w-[120px] ${isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>
                                {card.institution || card.name || 'Cartao'}
                              </p>
                              {isCurrent && sortedCards.length > 1 && (
                                <span className="text-[10px] text-[#D97757] bg-[#D97757]/10 px-1.5 py-0.5 rounded font-mono border border-[#D97757]/20">
                                  {index + 1}/{sortedCards.length}
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className={`text-2xl font-bold mt-0.5 ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                <NumberFlow
                                  value={Math.abs(displayValue)}
                                  format={{ style: 'currency', currency: 'BRL' }}
                                  locales="pt-BR"
                                />
                              </p>
                              {isCurrent && (
                                <span className="text-xs text-gray-500 font-medium">
                                  {displayLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <div className="mt-2 space-y-1 text-xs">


                          </div>
                        )}
                        {/* Settings button and Swipe Hint (only on current) */}
                        {isCurrent && (
                          <div className="flex items-center gap-2">
                            {/* Settings Button */}
                            <Dropdown>
                              <Tooltip content="Configurações dos Cartões">
                                <DropdownTrigger asChild>
                                  <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                                    className={`p-1.5 rounded-lg transition-colors ${cardsIncludedInExpenses.size > 0
                                      ? 'bg-[#D97757]/20 text-[#D97757]'
                                      : 'bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-[#D97757]'
                                      }`}
                                  >
                                    <Settings size={14} />
                                  </motion.button>
                                </DropdownTrigger>
                              </Tooltip>

                              <DropdownContent width="w-[90vw] sm:w-[400px]" align="right" className="max-h-[400px] overflow-y-auto custom-scrollbar max-sm:!left-1/2 max-sm:!-translate-x-1/2" portal>
                                <DropdownLabel>Configurações dos Cartões</DropdownLabel>
                                <div className="px-3 py-2 space-y-3">
                                  {sortedCards.map((entry, index) => {
                                    const { card, invoiceData: cardInvoice } = entry;
                                    const isEnabled = cardsIncludedInExpenses.has(card.id);
                                    const selectedType = cardInvoiceType[card.id] || 'current';

                                    const toggleCard = () => {
                                      const newSet = new Set(cardsIncludedInExpenses);
                                      if (isEnabled) newSet.delete(card.id);
                                      else newSet.add(card.id);

                                      if (toggles?.setEnabledCreditCardIds) {
                                        toggles.setEnabledCreditCardIds(Array.from(newSet));
                                      }
                                    };

                                    const setMode = (mode: 'last' | 'current' | 'next' | 'used_total') => {
                                      if (setCardInvoiceType) {
                                        setCardInvoiceType({ ...cardInvoiceType, [card.id]: mode });
                                      }
                                    };

                                    const currentVal = cardInvoice?.currentInvoice ?? cardInvoice?.payable ?? cardInvoice?.invoice ?? 0;
                                    const lastVal = cardInvoice?.lastInvoice ?? 0;
                                    const usedVal = cardInvoice?.usedTotal ?? 0;

                                    return (
                                      <div
                                        key={`expense-${card.id}`}
                                        className={`rounded-xl border transition-all overflow-hidden ${isEnabled ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-900/20 border-gray-800'}`}
                                      >
                                        {/* Header - Enable/Disable Card */}
                                        <div
                                          onClick={(e) => { e.stopPropagation(); toggleCard(); }}
                                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            {card.connector?.imageUrl ? (
                                              <img
                                                src={card.connector.imageUrl}
                                                alt=""
                                                className="w-8 h-8 rounded-lg object-contain"
                                              />
                                            ) : (
                                              <div className={`w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center shadow-inner ${isEnabled ? 'text-[#D97757]' : 'text-gray-600'}`}>
                                                <Building size={14} />
                                              </div>
                                            )}
                                            <span className={`text-sm font-medium ${isEnabled ? 'text-gray-200' : 'text-gray-500'}`}>
                                              {card.institution || card.name || 'Cartão'}
                                            </span>
                                          </div>                                                                                                                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${isEnabled ? 'bg-[#D97757] border-[#D97757] text-white shadow-lg shadow-[#D97757]/20' : 'bg-gray-800 border-gray-700 text-transparent hover:border-gray-600'}`}>
                                            <Check size={12} strokeWidth={4} />
                                          </div>                                                                        </div>

                                        <div className={`transition-all duration-300 ${isEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                                          {/* Check if viewing a past month (not current) */}
                                          {(() => {
                                            return (
                                              <div className="px-3 pb-3 pt-0 grid grid-cols-3 gap-2">
                                                {/* Última Fatura */}
                                                <div
                                                  onClick={(e) => { e.stopPropagation(); setMode('last'); }}
                                                  className={`cursor-pointer rounded-lg p-2 border transition-all flex flex-col gap-1 ${selectedType === 'last'
                                                    ? 'bg-purple-500/10 border-blue-500/30 shadow-inner'
                                                    : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}
                                                >
                                                  <span className={`text-[10px] font-bold uppercase tracking-wide ${selectedType === 'last' ? 'text-purple-400' : 'text-gray-500'}`}>
                                                    Última
                                                  </span>
                                                  <span className={`text-[11px] tracking-tight font-mono font-bold ${selectedType === 'last' ? 'text-white' : 'text-gray-400'}`}>
                                                    {formatCurrency(lastVal)}
                                                  </span>
                                                </div>

                                                {/* Fatura Atual */}
                                                <div
                                                  onClick={(e) => { e.stopPropagation(); setMode('current'); }}
                                                  className={`cursor-pointer rounded-lg p-2 border transition-all flex flex-col gap-1 ${selectedType === 'current'
                                                    ? 'bg-[#D97757]/10 border-[#D97757]/30 shadow-inner'
                                                    : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}
                                                >
                                                  <span className={`text-[10px] font-bold uppercase tracking-wide ${selectedType === 'current' ? 'text-[#D97757]' : 'text-gray-500'}`}>
                                                    Atual
                                                  </span>
                                                  <span className={`text-[11px] tracking-tight font-mono font-bold ${selectedType === 'current' ? 'text-white' : 'text-gray-400'}`}>
                                                    {formatCurrency(currentVal)}
                                                  </span>
                                                </div>

                                                {/* Total Usado */}
                                                <div
                                                  onClick={(e) => { e.stopPropagation(); setMode('used_total'); }}
                                                  className={`cursor-pointer rounded-lg p-2 border transition-all flex flex-col gap-1 ${selectedType === 'used_total'
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-inner'
                                                    : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}
                                                >
                                                  <span className={`text-[10px] font-bold uppercase tracking-wide ${selectedType === 'used_total' ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                    Usado
                                                  </span>
                                                  <span className={`text-[11px] tracking-tight font-mono font-bold ${selectedType === 'used_total' ? 'text-white' : 'text-gray-400'}`}>
                                                    {formatCurrency(usedVal)}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </DropdownContent>                             </Dropdown>

                            {/* Swipe Hint */}
                            {sortedCards.length > 1 && !isDragging && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-0.5 text-gray-500"
                              >
                                <ChevronLeft size={14} className="text-gray-600" />
                                <ChevronRight size={14} className="text-gray-600" />
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full">
                        {/* Progress bar track - always visible */}
                        <div className={`w-full rounded-full h-2.5 mb-2 overflow-hidden ${isCurrent ? 'bg-gray-700' : 'bg-gray-800/40'}`}>
                          {(() => {
                            // Use the card's calculated limit (may be proportional)
                            const limit = cardInvoice.limit || 0;
                            // Use absolute value as extra safety for progress bar, based on selected view
                            const invoice = Math.abs(displayValue || 0);

                            // Calculate percentage width
                            let widthPercentage = 0;
                            if (limit > 0) {
                              widthPercentage = Math.min((invoice / limit) * 100, 100);
                              // Ensure a minimal visibility slice if there's any invoice
                              if (invoice > 0 && widthPercentage < 3) widthPercentage = 3;
                            } else if (invoice > 0) {
                              // Fallback if no limit is known but there is an invoice
                              widthPercentage = 100;
                            }

                            // Calculate color based on ratio (if limit exists)
                            let colorClass = 'from-orange-500 to-orange-400';
                            if (limit > 0) {
                              const ratio = invoice / limit;
                              if (ratio > 0.8) colorClass = 'from-red-600 to-red-400';
                              else if (ratio > 0.5) colorClass = 'from-yellow-500 to-yellow-400';
                            } else if (invoice > 0) {
                              // No limit but has invoice - use a neutral or caution color
                              colorClass = 'from-blue-500 to-blue-400';
                            }

                            return (
                              <motion.div
                                className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercentage}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                style={{
                                  opacity: isCurrent ? 1 : 0.5,
                                  minWidth: invoice > 0 ? '8px' : '0px' // Garantir visibilidade minima
                                }}
                              />
                            );
                          })()}
                        </div>
                        {isCurrent && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-medium">
                              Limite: {formatCurrency(cardInvoice.limit || 0)}
                            </span>
                            {/* Dot indicators */}
                            {sortedCards.length > 1 && (
                              <div className="flex gap-1.5">
                                {sortedCards.map((_, idx) => (
                                  <motion.div
                                    key={idx}
                                    animate={{
                                      width: idx === activeCardIndex ? 16 : 6,
                                      backgroundColor: idx === activeCardIndex ? '#fb923c' : '#4b5563'
                                    }}
                                    className="h-1.5 rounded-full"
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-gray-500">
                              Usado: {formatCurrency((cardInvoice.limit && cardInvoice.limit > 0) ? (cardInvoice.limit - (cardInvoice.available || 0)) : (cardInvoice.usedTotal || 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                /* Empty State (Same as before) */
                <div className="absolute inset-0 p-4 rounded-xl shadow-sm border bg-[#30302E]/50 border-gray-800/50 flex flex-col justify-between h-[120px]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="p-2.5 bg-orange-900/20 rounded-lg text-orange-400">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 font-medium">Cartao de Credito</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-bold text-white mt-0.5">
                            <NumberFlow
                              value={creditCardInvoice}
                              format={{ style: 'currency', currency: 'BRL' }}
                              locales="pt-BR"
                            />
                          </p>
                          <span className="text-xs text-gray-500 font-medium">
                            {dashboardDate
                              ? (() => {
                                const [year, month] = dashboardDate.split('-').map(Number);
                                const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                                return `fatura ${monthNames[month - 1]}/${year}`;
                              })()
                              : 'fatura atual'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full opacity-50">
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{
                          width: creditLimit > 0
                            ? `${Math.min((creditCardInvoice / creditLimit) * 100, 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-400 font-medium">
                        Disp: {formatCurrency(creditAvailable)}
                      </span>
                      <span className="text-gray-500">
                        Lim: {formatCurrency(creditLimit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">{labels?.income || 'Receitas'}</p>
            <p className="text-2xl font-bold mt-1 text-green-400">
              <NumberFlow
                value={adjustedTotalIncome}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
          </div>
          <div className="p-3 bg-green-900/20 rounded-lg text-green-400">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between relative">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400 font-medium">{labels?.expense || 'Despesas'}</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-400">
              <NumberFlow
                value={adjustedTotalExpense}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
          </div>
          <div className="p-3 bg-red-900/20 rounded-lg text-red-400">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">{labels?.balance || 'Saldo Total'}</p>
            <p className={`text-2xl font-bold mt-1 ${adjustedTotalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              <NumberFlow
                value={adjustedTotalBalance}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
          </div>
          <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400">
            <Wallet size={24} />
          </div>
        </div>
      </div>
    </div >
  );
};

