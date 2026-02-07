import React, { useState, useMemo } from 'react';
import { ChevronsUpDown, Sparkles, MoreVertical, RefreshCcw, ArrowRightLeft, CornerUpLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction, ConnectedAccount, FinanceCharges, InvoicePeriods, Invoice, InvoiceItem } from '../types';
import {
  Trash2, Search, Calendar, getCategoryIcon, X, Edit2, Check,
  ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, FileText, DollarSign, Tag, Filter, CreditCard, Copy, TrendingDown, TrendingUp, Settings, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Minus, HelpCircle, AlertTriangle, RotateCcw, Code, Calculator, Loader2
} from './Icons';
import { CustomAutocomplete, CustomDatePicker, CustomSelect, CurrencyInput } from './UIComponents';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { useToasts } from './Toast';
import { UniversalModal } from './UniversalModal';
import { Button } from './Button';


import { EmptyState } from './EmptyState';
import { getInvoiceMonthKey } from '../services/invoiceCalculator';
import {
  calculateFutureLimitImpact,
  getTransactionInvoiceMonthKey,
  isCreditCardPayment,

  buildInvoices,
  generateInvoiceForecast,
  type InvoiceBuildResult,
  calculateInvoicePeriodDates,
  validateClosingDay,
  toMonthKey
} from '../services/invoiceBuilder';
import { exportToCSV } from '../utils/export';
import { useCategoryTranslation } from '../hooks/useCategoryTranslation';
import { getExchangeRateSync, fetchExchangeRates } from '../services/currencyService';


// Mapeamento de meses
const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatMonthKey(monthKey: string): string {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${MONTH_NAMES[monthIndex]}/${year}`;
}

// ============================================================ 
// ============================================================ 
// COMPONENTE: InvoiceTag (Tag Editável de Fatura)
// ============================================================ 
const InvoiceTag = ({ transaction, summary, onUpdate, closingDay }: { transaction: Transaction, summary: any, onUpdate: (t: Transaction) => void, closingDay: number }) => {
  // Safe validation
  if (!summary || !closingDay) return null;

  const effectiveMonthKey = transaction.manualInvoiceMonth || getTransactionInvoiceMonthKey(transaction.date, closingDay);

  const monthKeyToLabel = (k?: string) => {
    if (!k) return '?';
    const [y, m] = k.split('-');
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const monthIndex = parseInt(m) - 1;
    if (monthIndex < 0 || monthIndex > 11) return k;
    return `${months[monthIndex]}`; // Ex: JAN
  };

  // Helper para calcular o próximo monthKey a partir de um monthKey existente
  const getNextMonthKey = (monthKey: string): string => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  };

  const currentLabel = monthKeyToLabel(effectiveMonthKey);
  const isManual = !!transaction.manualInvoiceMonth;

  // Garantir que nextMonthKey tenha um valor válido
  // Se não existir, calcula a partir do currentMonthKey
  const validNextMonthKey = summary.nextMonthKey || getNextMonthKey(summary.currentMonthKey);

  // Opções de destino com identificador único para cada tipo
  // Usamos 'type' como parte do key do React para evitar duplicação
  const allOptions = [
    { type: 'last', key: summary.lastMonthKey, label: `Anterior (${monthKeyToLabel(summary.lastMonthKey)})` },
    { type: 'current', key: summary.currentMonthKey, label: `Atual (${monthKeyToLabel(summary.currentMonthKey)})` },
    { type: 'next', key: validNextMonthKey, label: `Próxima (${monthKeyToLabel(validNextMonthKey)})` }
  ];

  // Filtra opções com keys inválidos ou vazios E remove duplicatas de monthKey
  // Mantemos a ordem de prioridade: last -> current -> next
  const seenMonthKeys = new Set<string>();
  const options = allOptions.filter(opt => {
    if (!opt.key || opt.key.length === 0) return false;
    if (seenMonthKeys.has(opt.key)) return false; // Remove duplicatas
    seenMonthKeys.add(opt.key);
    return true;
  });

  // Handler para update com validação
  const handleMoveToInvoice = (transaction: Transaction, targetKey: string) => {
    if (!targetKey) {
      console.error('[InvoiceTag] Tentativa de mover para key vazio');
      return;
    }
    console.log('[InvoiceTag] Movendo transação:', {
      id: transaction.id,
      description: transaction.description,
      isProjected: (transaction as any).isProjected,
      from: transaction.manualInvoiceMonth || 'auto',
      to: targetKey
    });
    onUpdate({ ...transaction, manualInvoiceMonth: targetKey });
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dropdown>
        <DropdownTrigger className={`
          flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wide border transition-all cursor-pointer
          ${isManual
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
            : 'bg-[#373734]/50 text-gray-400 border-[#373734] hover:text-white hover:border-gray-500'
          }
        `}>
          {isManual && <Edit2 size={8} />}
          {currentLabel}
          <ChevronDown size={10} className="opacity-50" />
        </DropdownTrigger>
        <DropdownContent align="left" className="w-48">
          <div className="px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider border-b border-[#373734] mb-1">
            Mover para fatura...
          </div>
          {options.map(opt => (
            <DropdownItem
              key={`${opt.type}-${opt.key}`}
              onClick={() => handleMoveToInvoice(transaction, opt.key)}
              className={effectiveMonthKey === opt.key ? 'bg-white/5 text-white' : ''}
            >
              <div className="flex items-center justify-between w-full">
                <span>{opt.label}</span>
                {effectiveMonthKey === opt.key && <Check size={12} />}
              </div>
            </DropdownItem>
          ))}
          {isManual && (
            <>
              <div className="h-px bg-[#373734] my-1" />
              <DropdownItem
                onClick={() => onUpdate({ ...transaction, manualInvoiceMonth: null })}
                className="text-red-400 hover:text-red-300"
                icon={X}
              >
                Remover ajuste manual
              </DropdownItem>
            </>
          )}
        </DropdownContent>
      </Dropdown>
    </div>
  );
};


// ============================================================  
// COMPONENTE PRINCIPAL
// ============================================================ 

// ============================================================  
// COMPONENTE PRINCIPAL
// ============================================================ 

interface CreditCardTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Transaction) => void;
  creditCardAccounts?: ConnectedAccount[];
  userId?: string;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
  isManualMode?: boolean;
  onAdd?: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  billTotalsByMonthKey?: Record<string, number>;
  onUpdateAccount?: (accountId: string, updates: Partial<ConnectedAccount>) => Promise<void>;
  onOpenFeedback?: () => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
  isAdmin?: boolean; // Controla visibilidade de recursos de debug (ex: Ver JSON)
}



// Tipo para transações de encargos (IOF, juros, multa)
type ChargeType = 'IOF' | 'INTEREST' | 'LATE_FEE' | 'OTHER';

interface ChargeTransaction extends Transaction {
  isCharge: true;
  chargeType: ChargeType;
}

// Mapeamento de tipos de encargos para descrições em português
const CHARGE_DESCRIPTIONS: Record<ChargeType, string> = {
  IOF: 'IOF - Imposto sobre Operações Financeiras',
  INTEREST: 'Juros de Atraso',
  LATE_FEE: 'Multa por Atraso',
  OTHER: 'Outros Encargos'
};

// ============================================================
// HOOK: useInvoiceBuilder - Sistema moderno de faturas
// Usa o invoiceBuilder.ts para construir faturas profissionais
// ============================================================
const useInvoiceBuilder = (
  card: ConnectedAccount | undefined,
  transactions: Transaction[],
  cardId: string,
  monthOffset: number = 0
) => {
  return useMemo(() => {
    // Log removed

    if (!card) {
      // Log removed
      return null;
    }

    const result = buildInvoices(card, transactions, cardId, monthOffset);

    // Log removed

    const itemsToTransactions = (items: InvoiceItem[]): Transaction[] => {
      return items.map(item => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        date: item.date,
        category: item.category || 'Outros',
        type: item.type,
        status: 'completed' as const,
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
        isProjected: item.isProjected,
        isPayment: item.isPayment,
        manualInvoiceMonth: item.manualInvoiceMonth,
        // Vincular ao cartão selecionado para permitir edição/exclusão
        cardId: cardId,
        accountId: cardId,
        // Dados de moeda para transações internacionais
        currencyCode: item.currencyCode,
        amountOriginal: item.amountOriginal,
        amountInAccountCurrency: item.amountInAccountCurrency,
        pluggyRaw: item.pluggyRaw
      } as any));
    };

    return {
      // Faturas estruturadas (novo formato)
      closedInvoice: result.closedInvoice,
      currentInvoice: result.currentInvoice,
      futureInvoices: result.futureInvoices,

      // Períodos calculados
      periods: result.periods,

      // Totais
      allFutureTotal: result.allFutureTotal,

      // Forecast para visão de longo prazo
      forecast: generateInvoiceForecast(result, 12),

      // Impacto no limite
      limitImpact: calculateFutureLimitImpact(card, result),

      // Dados compatíveis com formato antigo (para transição gradual)
      legacy: {
        closingDay: result.periods.closingDay,
        dueDay: result.periods.dueDay,
        lastInvoice: {
          transactions: itemsToTransactions(result.closedInvoice.items),
          total: result.closedInvoice.total
        },
        currentInvoice: {
          transactions: itemsToTransactions(result.currentInvoice.items),
          total: result.currentInvoice.total
        },
        nextInvoice: {
          transactions: result.futureInvoices[0]
            ? itemsToTransactions(result.futureInvoices[0].items)
            : [],
          total: result.futureInvoices[0]?.total || 0
        },
        lastDueDate: new Date(result.closedInvoice.dueDate),
        currentDueDate: new Date(result.currentInvoice.dueDate),
        nextDueDate: result.futureInvoices[0]
          ? new Date(result.futureInvoices[0].dueDate)
          : new Date(),
        lastMonthKey: result.closedInvoice.referenceMonth,
        currentMonthKey: result.currentInvoice.referenceMonth,
        nextMonthKey: result.periods.nextMonthKey || ''
      }
    };
  }, [card, transactions, cardId, monthOffset]);
};

export const CreditCardTable: React.FC<CreditCardTableProps> = ({
  transactions,
  onDelete,
  onUpdate,
  creditCardAccounts = [],
  userId,
  onSync,
  isSyncing = false,
  isManualMode = false,
  onAdd,
  billTotalsByMonthKey = {},
  onUpdateAccount,
  onOpenFeedback,
  onBulkUpdate,
  isAdmin = false
}) => {
  // Filter hidden accounts
  const visibleCreditCardAccounts = React.useMemo(() =>
    creditCardAccounts.filter(acc => !acc.hidden),
    [creditCardAccounts]
  );

  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Date Range Filters
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Bank/Card Filter
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const singleVisibleCardId = useMemo(
    () => (visibleCreditCardAccounts.length === 1 ? visibleCreditCardAccounts[0].id : null),
    [visibleCreditCardAccounts]
  );

  const isManualModeActive = React.useMemo(() => {
    if (isManualMode && selectedCardId !== 'all') return true;
    const card = visibleCreditCardAccounts.find(acc => acc.id === selectedCardId);
    return card?.connectionMode === 'MANUAL';
  }, [isManualMode, visibleCreditCardAccounts, selectedCardId]);

  // Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cotações de câmbio em tempo real
  const [exchangeRatesLoaded, setExchangeRatesLoaded] = React.useState(false);

  // Carregar cotações ao montar o componente
  React.useEffect(() => {
    fetchExchangeRates().then(() => {
      setExchangeRatesLoaded(true);
      // Log removed
    });
  }, []);

  // Enforce selecting the first visible card on load or if selected card becomes hidden
  React.useEffect(() => {
    const isSelectedVisible = visibleCreditCardAccounts.some(acc => acc.id === selectedCardId);
    if ((selectedCardId === 'all' || !selectedCardId || !isSelectedVisible) && visibleCreditCardAccounts.length > 0) {
      setSelectedCardId(visibleCreditCardAccounts[0].id);
    }
    // If no visible accounts and we have hidden ones, maybe select 'all'? 
    // But better to just let it be (or empty)
  }, [visibleCreditCardAccounts, selectedCardId]);

  // DEBUG: Log das transações e cartões recebidos
  React.useEffect(() => {
    // Log removed
  }, [transactions, creditCardAccounts, selectedCardId]);

  // Invoice Filter (Todas, Última, Atual, Próxima)
  const [selectedInvoice, setSelectedInvoice] = useState<'all' | 'last' | 'current' | 'next'>('current');

  // Month Offset para navegação rotativa entre faturas
  // 0 = mês base (hoje), -1 = um mês para trás, +1 = um mês para frente, etc.
  const [monthOffset, setMonthOffset] = useState(0);

  // Auto-switch to "Histórico" when date filters are used
  React.useEffect(() => {
    if (startDate || endDate) {
      setSelectedInvoice('all');
    }
  }, [startDate, endDate]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Modal para visualizar JSON bruto da transação (debug)
  const [jsonModalData, setJsonModalData] = useState<Transaction | null>(null);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundSourceTransaction, setRefundSourceTransaction] = useState<Transaction | null>(null);
  const [refundTab, setRefundTab] = useState<'total' | 'custom'>('total');
  const [refundCustomAmount, setRefundCustomAmount] = useState<number>(0);



  // Auto-remove duplicates
  const [hasCheckedDuplicates, setHasCheckedDuplicates] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Geral',
    type: 'expense',
    status: 'completed',
    accountType: 'CREDIT_CARD',
    totalInstallments: 1,
    installmentNumber: 1
  });





  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount || !newTransaction.date) {
      toast.warning('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (onAdd && selectedCardId) {
        const totalInstallments = newTransaction.totalInstallments || 1;
        const installmentAmount = totalInstallments > 1 ? ((newTransaction.amount || 0) / totalInstallments) : (newTransaction.amount || 0);

        // Parse date correctly
        const [year, month, day] = (newTransaction.date as string).split('-').map(Number);
        const baseDate = new Date(year, month - 1, day);

        const promises: Promise<void>[] = [];

        for (let i = 0; i < totalInstallments; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(installmentDate.getMonth() + i);
          const installmentDateStr = installmentDate.toISOString().split('T')[0];

          const description = totalInstallments > 1
            ? `${newTransaction.description} ${i + 1}/${totalInstallments}`
            : newTransaction.description;

          const payload: Omit<Transaction, 'id'> = {
            ...newTransaction as Transaction,
            description,
            amount: installmentAmount,
            date: installmentDateStr,
            cardId: selectedCardId,
            accountId: selectedCardId,
            status: 'completed',
            type: 'expense',
            accountType: 'CREDIT_CARD',
            installmentNumber: i + 1,
            totalInstallments: totalInstallments
          };
          promises.push(onAdd(payload));
        }

        await Promise.all(promises);
        toast.success(totalInstallments > 1
          ? `${totalInstallments} parcelas adicionadas com sucesso!`
          : 'Compra adicionada com sucesso!');

        setIsAddModalOpen(false);
        // Reset form
        setNewTransaction({
          description: '',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: 'Geral',
          type: 'expense',
          status: 'completed',
          accountType: 'CREDIT_CARD',
          totalInstallments: 1,
          installmentNumber: 1
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar compra');
    }
  };

  const openRefundModal = (tx: Transaction) => {
    setRefundSourceTransaction(tx);
    setRefundTab('total');
    setRefundCustomAmount(Math.abs(tx.amount));
    setIsRefundModalOpen(true);
  };

  const closeRefundModal = () => {
    setIsRefundModalOpen(false);
    setRefundSourceTransaction(null);
    setRefundTab('total');
    setRefundCustomAmount(0);
  };

  const refundMaxAmount = refundSourceTransaction ? Math.abs(refundSourceTransaction.amount) : 0;
  const refundAmountToCreate = refundTab === 'total' ? refundMaxAmount : refundCustomAmount;

  const handleConfirmRefund = async () => {
    if (!refundSourceTransaction) return;
    if (!onAdd) return;

    if (!refundAmountToCreate || refundAmountToCreate <= 0 || refundAmountToCreate > refundMaxAmount) {
      toast.warning('Informe um valor válido para o estorno');
      return;
    }

    const cardLinkId = refundSourceTransaction.cardId || refundSourceTransaction.accountId || selectedCardId;
    if (!cardLinkId) {
      toast.error('Cartão não identificado para criar o estorno');
      return;
    }

    const srcCurrencyCode = (refundSourceTransaction as any).currencyCode || (refundSourceTransaction as any).pluggyRaw?.currencyCode;
    const srcAmountOriginal = (refundSourceTransaction as any).amountOriginal;

    let amountOriginal: number | undefined = undefined;
    if (srcCurrencyCode && srcCurrencyCode !== 'BRL' && typeof srcAmountOriginal === 'number' && refundMaxAmount > 0) {
      amountOriginal = Math.abs(srcAmountOriginal) * (refundAmountToCreate / refundMaxAmount);
    }

    const payload: any = {
      memberId: refundSourceTransaction.memberId,
      date: refundSourceTransaction.date,
      description: `Estorno - ${refundSourceTransaction.description}`,
      amount: refundAmountToCreate,
      category: refundSourceTransaction.category || 'Geral',
      type: 'income',
      status: 'completed',
      accountId: cardLinkId,
      accountType: 'CREDIT_CARD',
      cardId: cardLinkId,
      currencyCode: srcCurrencyCode,
      amountOriginal,
      manualInvoiceMonth: (refundSourceTransaction as any).manualInvoiceMonth ?? null,
      _syntheticRefund: true,
      refundOfId: refundSourceTransaction.id
    };

    await onAdd(payload);
    toast.success(refundTab === 'total' ? 'Estorno total criado!' : 'Estorno parcial criado!');
    closeRefundModal();
  };

  // Card Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [cardSettings, setCardSettings] = useState<{
    closingDay: number;
    dueDay: number;
    manualBeforeLastClosingDate?: string;
    manualLastClosingDate?: string;
    manualCurrentClosingDate?: string
  }>({ closingDay: 1, dueDay: 10 });

  // Filter Modal State (Mobile)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);



  // Invoice Cards Visibility with Persistence
  const [showInvoiceCards, setShowInvoiceCards] = useState(() => {
    // Default to true (expanded) if no preference saved
    const saved = localStorage.getItem('controlar_show_invoice_cards');
    return saved !== null ? saved === 'true' : true;
  });

  // Save preference whenever it changes
  React.useEffect(() => {
    localStorage.setItem('controlar_show_invoice_cards', String(showInvoiceCards));
  }, [showInvoiceCards]);

  const toast = useToasts();

  // Hook para tradução de categorias
  const { translateCategory, categoryMappings } = useCategoryTranslation(userId);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');





  const enrichWithDueDate = (obj: any) => {
    if (!obj) return obj;
    const computedDue =
      obj.invoiceDueDate ||
      obj.dueDate ||
      obj.nextBillDueDate ||
      obj.currentBillDueDate ||
      obj.invoiceDate ||
      obj.date ||
      null;
    return { ...obj, computedDueDate: computedDue };
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  /**
   * Calcula o valor de uma transação em BRL, convertendo moeda estrangeira em tempo real
   */
  const getTransactionAmountInBRL = (t: Transaction): number => {
    const txCurrencyCode = (t as any).currencyCode
      || (t as any).pluggyRaw?.currencyCode
      || 'BRL';

    if (txCurrencyCode === 'BRL') {
      return Math.abs(t.amount);
    }

    // Transação em moeda estrangeira - converter em tempo real
    const txAmountOriginal = (t as any).amountOriginal
      || Math.abs((t as any).pluggyRaw?.amount || 0)
      || Math.abs(t.amount);

    const exchangeRate = getExchangeRateSync(txCurrencyCode);
    return Math.abs(txAmountOriginal) * exchangeRate;
  };

  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Extract unique years from transactions for the dropdown
  const yearOptions = useMemo(() => {
    const years = new Set<number>(transactions.map(t => {
      if (!t.date) return new Date().getFullYear();
      return parseInt(t.date.split('-')[0]);
    }));
    years.add(new Date().getFullYear());
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return [{ value: 0, label: 'Todos' }, ...sortedYears.map(y => ({ value: y, label: y.toString() }))];
  }, [transactions]);

  // Extract unique categories from transactions
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(t => {
      if (t.category) {
        categories.add(t.category);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  /*
   * Verifica se uma transação é pagamento de fatura
   * IMPORTANTE: Prioridade sobre Reembolso se a descrição for explícita.
   */
  const isCreditCardPayment = (tx: Transaction): boolean => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();

    // 1. Verifica keywords de PAGAMENTO primeiro
    const paymentKeywords = [
      'pagamento de fatura',
      'pagamento fatura',
      'pagamento recebido',
      'credit card payment',
      'pag fatura',
      'pgto fatura',
      'pgto'
    ];

    // Verifica se é explicitamente um pagamento
    const isExplicitPayment = paymentKeywords.some(kw => d.includes(kw) || c.includes(kw) || d === 'pgto');

    if (isExplicitPayment) {
      // Se a descrição diz explicitamente que é pagamento, É PAGAMENTO.
      // Mesmo que tenha 'estorno' no meio (raro) ou categoria 'Reembolso'.
      // Exceção: "Estorno de pagamento"
      if (d.includes('estorno') || d.includes('cancelamento')) {
        return false; // É um estorno de pagamento
      }
      return true;
    }

    // 2. Se não é explicitamente pagamento, verifica se é estorno/reembolso
    // Se for reembolso, não é pagamento
    const refundKeywords = ['estorno', 'reembolso', 'devolução', 'cancelamento', 'refund', 'chargeback', 'cashback'];
    if (refundKeywords.some(kw => d.includes(kw) || c.includes(kw))) {
      return false;
    }

    return false;
  };

  // Basic filtered transactions (used when no card is selected/configured)
  const baseFilteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (!t.date) return false;

        const transactionYear = parseInt(t.date.split('-')[0]);
        const matchesYear = selectedYear === 0 || transactionYear === selectedYear;

        const matchesSearch =
          !searchTerm ||
          (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStartDate = startDate ? t.date >= startDate : true;
        const matchesEndDate = endDate ? t.date <= endDate : true;

        // Bank/Card Filter
        let matchesCard = true;
        if (selectedCardId !== 'all') {
          const targetId = String(selectedCardId);
          const txCardId = t.cardId ? String(t.cardId) : '';
          const txAccountId = t.accountId ? String(t.accountId) : '';
          matchesCard = txCardId === targetId || txAccountId === targetId;

          // If there's only one visible card, include unassigned CC transactions
          if (!matchesCard && !txCardId && !txAccountId && singleVisibleCardId && targetId === singleVisibleCardId) {
            matchesCard = true;
          }
        }

        return matchesYear && matchesSearch && matchesStartDate && matchesEndDate && matchesCard;
      })
      .sort((a, b) => {
        // Para ordenação por data, usar timestamp completo (inclui horário)
        if (sortField === 'date') {
          const aTimestamp = a.timestamp || a.date || '';
          const bTimestamp = b.timestamp || b.date || '';
          if (aTimestamp < bTimestamp) return sortDirection === 'asc' ? -1 : 1;
          if (aTimestamp > bTimestamp) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
        // Para outros campos, ordenação normal
        const aValue: any = (a as any)[sortField];
        const bValue: any = (b as any)[sortField];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, searchTerm, sortField, sortDirection, selectedYear, startDate, endDate, selectedCardId, singleVisibleCardId]);

  // ALL card transactions (without year filter) - for "Histórico Completo" mode
  const allCardTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (!t.date) return false;

        // Bank/Card Filter only (no year filter for complete history)
        let matchesCard = true;
        if (selectedCardId !== 'all') {
          const targetId = String(selectedCardId);
          const txCardId = t.cardId ? String(t.cardId) : '';
          const txAccountId = t.accountId ? String(t.accountId) : '';
          matchesCard = txCardId === targetId || txAccountId === targetId;

          // If there's only one visible card, include unassigned CC transactions
          if (!matchesCard && !txCardId && !txAccountId && singleVisibleCardId && targetId === singleVisibleCardId) {
            matchesCard = true;
          }
        }

        return matchesCard;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
  }, [transactions, selectedCardId, singleVisibleCardId]);

  // Get selected card for invoice calculations
  const selectedCard = useMemo(() => {
    if (selectedCardId === 'all') return creditCardAccounts[0];
    return creditCardAccounts.find(c => c.id === selectedCardId);
  }, [selectedCardId, creditCardAccounts]);

  // ============================================================
  // NOVO SISTEMA DE FATURAS - Usa invoiceBuilder.ts
  // ============================================================
  const invoiceBuilderData = useInvoiceBuilder(selectedCard, transactions, selectedCardId, monthOffset);

  // Calculate invoice summary - AGORA USA O NOVO SISTEMA
  const invoiceSummary = useMemo(() => {
    // DEBUG: Verificar qual sistema está sendo usado
    // Log removed

    // Se temos dados do novo sistema, usa eles
    if (invoiceBuilderData) {
      const { closedInvoice, currentInvoice, futureInvoices, periods, allFutureTotal } = invoiceBuilderData;

      // Log removed

      // Helper para converter string YYYY-MM-DD para Date
      const toDate = (dateStr: string | Date): Date => {
        if (dateStr instanceof Date) return dateStr;
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d || 1, 12, 0, 0);
      };

      // Converte InvoiceItems para formato Transaction
      const itemsToTransactions = (items: InvoiceItem[]): Transaction[] => {
        return items.map(item => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          date: item.date,
          category: item.category || 'Outros',
          type: item.type,
          status: 'completed' as const,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          isProjected: item.isProjected,
          isPayment: item.isPayment,
          // Vincular ao cartão selecionado para permitir edição/exclusão
          cardId: selectedCard?.id,
          accountId: selectedCard?.id,
          // Dados de moeda para transações internacionais
          currencyCode: item.currencyCode,
          amountOriginal: item.amountOriginal,
          amountInAccountCurrency: item.amountInAccountCurrency,
          pluggyRaw: item.pluggyRaw,
          // IMPORTANTE: Preservar o override manual do mês da fatura
          manualInvoiceMonth: item.manualInvoiceMonth
        }));
      };

      const nextInvoice = futureInvoices[0];

      return {
        closingDay: periods.closingDay,
        dueDay: periods.dueDay,
        // Datas de fechamento como Date objects
        beforeLastClosingDate: toDate(periods.beforeLastClosingDate),
        lastClosingDate: toDate(periods.lastClosingDate),
        currentClosingDate: toDate(periods.currentClosingDate),
        nextClosingDate: toDate(periods.nextClosingDate),
        // Datas de início/fim de cada período como Date objects
        lastInvoiceStart: toDate(periods.lastInvoiceStart),
        lastInvoiceEnd: toDate(periods.lastClosingDate),
        currentInvoiceStart: toDate(periods.currentInvoiceStart),
        currentInvoiceEnd: toDate(periods.currentClosingDate),
        nextInvoiceStart: toDate(periods.nextInvoiceStart),
        nextInvoiceEnd: toDate(periods.nextClosingDate),
        // Dados das faturas
        lastInvoice: {
          transactions: itemsToTransactions(closedInvoice.items),
          total: closedInvoice.total
        },
        currentInvoice: {
          transactions: itemsToTransactions(currentInvoice.items),
          total: currentInvoice.total
        },
        nextInvoice: {
          transactions: nextInvoice ? itemsToTransactions(nextInvoice.items) : [],
          total: nextInvoice?.total || 0
        },
        totalUsed: 0,
        usedCreditLimit: selectedCard?.usedCreditLimit || Math.abs(selectedCard?.balance || 0),
        isLastInvoicePaid: closedInvoice.status === 'PAID',
        // Datas de vencimento como Date objects
        lastDueDate: toDate(closedInvoice.dueDate),
        currentDueDate: toDate(currentInvoice.dueDate),
        nextDueDate: nextInvoice ? toDate(nextInvoice.dueDate) : new Date(),
        // Month keys
        lastMonthKey: closedInvoice.referenceMonth,
        currentMonthKey: currentInvoice.referenceMonth,
        nextMonthKey: nextInvoice?.referenceMonth || periods.nextMonthKey,
        allFutureTotal,
        // Dados extras do novo sistema
        forecast: invoiceBuilderData.forecast,
        limitImpact: invoiceBuilderData.limitImpact
      };
    }

    // Fallback para o sistema antigo se não houver dados
    // Log removed
    return {
      lastInvoice: { transactions: [], total: 0 },
      currentInvoice: { transactions: [], total: 0 },
      nextInvoice: { transactions: [], total: 0 },
      lastDueDate: new Date(),
      currentDueDate: new Date(),
      nextDueDate: new Date(),
      lastMonthKey: '',
      currentMonthKey: '',
      nextMonthKey: '',
      allFutureTotal: 0,
      isLastInvoicePaid: false
    };
  }, [invoiceBuilderData, selectedCard, transactions, selectedCardId]);

  // Get transactions from selected invoice
  const invoiceTransactions = useMemo(() => {
    switch (selectedInvoice) {
      case 'all':
        // Retorna TODAS as transações do cartão (sem filtro de ano/período)
        return allCardTransactions;
      case 'last':
        return invoiceSummary.lastInvoice.transactions;
      case 'current':
        return invoiceSummary.currentInvoice.transactions;
      case 'next':
        return invoiceSummary.nextInvoice.transactions;
      default:
        return invoiceSummary.currentInvoice.transactions;
    }
  }, [selectedInvoice, invoiceSummary, allCardTransactions]);

  // Gerar linhas virtuais de encargos (IOF, juros, multa) da fatura selecionada
  const chargeTransactions = useMemo((): ChargeTransaction[] => {
    // Só gera encargos para fatura fechada (última) e quando há cartão selecionado
    if (selectedInvoice !== 'last' || !selectedCard?.currentBill?.financeCharges) {
      return [];
    }

    const charges = selectedCard.currentBill.financeCharges;
    const dueDate = selectedCard.currentBill.dueDate || invoiceSummary.lastDueDate.toISOString().split('T')[0];
    const monthLabel = formatMonthKey(invoiceSummary.lastMonthKey);
    const cardId = selectedCard.id;

    const chargeLines: ChargeTransaction[] = [];

    // IOF
    if (charges.iof && charges.iof > 0) {
      chargeLines.push({
        id: `charge_${cardId}_iof`,
        date: dueDate,
        description: `${CHARGE_DESCRIPTIONS.IOF} - Fatura ${monthLabel}`,
        amount: charges.iof,
        type: 'expense',
        category: 'Encargos Financeiros',
        status: 'completed',
        isCharge: true,
        chargeType: 'IOF'
      });
    }

    // Juros
    if (charges.interest && charges.interest > 0) {
      chargeLines.push({
        id: `charge_${cardId}_interest`,
        date: dueDate,
        description: `${CHARGE_DESCRIPTIONS.INTEREST} - Fatura ${monthLabel}`,
        amount: charges.interest,
        type: 'expense',
        category: 'Encargos Financeiros',
        status: 'completed',
        isCharge: true,
        chargeType: 'INTEREST'
      });
    }

    // Multa por atraso
    if (charges.lateFee && charges.lateFee > 0) {
      chargeLines.push({
        id: `charge_${cardId}_latefee`,
        date: dueDate,
        description: `${CHARGE_DESCRIPTIONS.LATE_FEE} - Fatura ${monthLabel}`,
        amount: charges.lateFee,
        type: 'expense',
        category: 'Encargos Financeiros',
        status: 'completed',
        isCharge: true,
        chargeType: 'LATE_FEE'
      });
    }

    // Outros encargos
    if (charges.otherCharges && charges.otherCharges > 0) {
      chargeLines.push({
        id: `charge_${cardId}_other`,
        date: dueDate,
        description: `${CHARGE_DESCRIPTIONS.OTHER} - Fatura ${monthLabel}`,
        amount: charges.otherCharges,
        type: 'expense',
        category: 'Encargos Financeiros',
        status: 'completed',
        isCharge: true,
        chargeType: 'OTHER'
      });
    }

    return chargeLines;
  }, [selectedInvoice, selectedCard, invoiceSummary]);

  // Calcular status da fatura baseado na API Pluggy e no builder (status local PAID)
  const invoicePaymentInfo = useMemo(() => {
    // Status da API Pluggy: OPEN = aguardando pagamento, CLOSED = paga
    const billStatus = selectedCard?.currentBill?.status;

    // Última fatura: paga se API diz CLOSED ou se o builder marcou PAID (pagamento detectado nas transações)
    const isLastInvoicePaid = billStatus === 'CLOSED' || invoiceSummary.isLastInvoicePaid;

    const parseDateSafe = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const daysDiff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);

    const apiDueDate = parseDateSafe(selectedCard?.currentBill?.dueDate || null);
    const expectedDueDate = invoiceSummary.lastDueDate;
    const dueDateAligned = apiDueDate ? daysDiff(apiDueDate, expectedDueDate) <= 15 : false;

    // Buscar transações de pagamento para mostrar valores pagos (inclui "Pagamento recebido" associado à fatura)
    const lastInvoicePayments = invoiceSummary.lastInvoice.transactions.filter(t => isCreditCardPayment(t));
    const lastInvoicePaidAmount = lastInvoicePayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const apiLastInvoiceTotal = selectedCard?.currentBill?.totalAmount ?? null;
    const calculatedLastInvoiceTotal = invoiceSummary.lastInvoice.total;
    const totalTolerance = Math.max(1, calculatedLastInvoiceTotal * 0.01);
    const totalAligned = apiLastInvoiceTotal !== null
      ? Math.abs(apiLastInvoiceTotal - calculatedLastInvoiceTotal) <= totalTolerance
      : false;
    const shouldPreferApiTotal = apiLastInvoiceTotal !== null && dueDateAligned && totalAligned;
    const lastInvoiceTotal = shouldPreferApiTotal ? apiLastInvoiceTotal : calculatedLastInvoiceTotal;
    const lastInvoiceDivergence = apiLastInvoiceTotal !== null
      ? Math.abs(apiLastInvoiceTotal - calculatedLastInvoiceTotal) > 0.01
      : false;
    const lastInvoiceDueDateToShow = dueDateAligned && apiDueDate ? apiDueDate : expectedDueDate;

    // Verificar se há pagamento na fatura atual
    const currentInvoicePayments = invoiceSummary.currentInvoice.transactions.filter(t => isCreditCardPayment(t));
    const currentInvoicePaidAmount = currentInvoicePayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const currentInvoiceTotal = invoiceSummary.currentInvoice.total;
    const isCurrentInvoicePaid = currentInvoicePaidAmount > 0 && currentInvoicePaidAmount >= currentInvoiceTotal * 0.95;

    return {
      last: {
        isPaid: isLastInvoicePaid,
        paidAmount: lastInvoicePaidAmount,
        total: lastInvoiceTotal,
        calculatedTotal: invoiceSummary.lastInvoice.total,
        hasDivergence: lastInvoiceDivergence,
        dueDateToShow: lastInvoiceDueDateToShow,
        payments: lastInvoicePayments,
        status: billStatus // Adiciona o status original para debug/display
      },
      current: {
        isPaid: isCurrentInvoicePaid,
        paidAmount: currentInvoicePaidAmount,
        total: currentInvoiceTotal,
        payments: currentInvoicePayments
      }
    };
  }, [invoiceSummary, selectedCard]);

  // ============================================================
  // CÁLCULO DE TOTAIS VISUAIS (Para consistência com a tabela)
  // Garante que o valor no card seja igual à soma das transações exibidas
  // Usa conversão de moeda em tempo real para transações internacionais
  // INCLUI detecção de pares compra+estorno que se anulam
  // ============================================================
  const visualTotals = useMemo(() => {
    // Função auxiliar para detectar pares de compra+estorno e calcular total
    const calcTotalWithRefundDetection = (txs: Transaction[]) => {
      // Normaliza descrição para comparação
      const normalizeDesc = (desc: string) => {
        return (desc || '')
          .toLowerCase()
          .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
          .replace(/estorno\s*/gi, '')
          .replace(/reembolso\s*/gi, '')
          .replace(/devolução\s*/gi, '')
          .replace(/cancelamento\s*/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Agrupa transações por valor absoluto e descrição normalizada
      const byAmountAndDesc: Record<string, Transaction[]> = {};
      txs.forEach(t => {
        if (isCreditCardPayment(t)) return; // Ignora pagamentos de fatura
        const normalizedDesc = normalizeDesc(t.description || '');
        const key = `${Math.abs(t.amount).toFixed(2)}-${normalizedDesc}`;
        if (!byAmountAndDesc[key]) byAmountAndDesc[key] = [];
        byAmountAndDesc[key].push(t);
      });

      // Identifica IDs de transações pareadas (compra+estorno)
      const pairedIds = new Set<string>();
      Object.values(byAmountAndDesc).forEach(group => {
        if (group.length >= 2) {
          const sorted = [...group].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          const expenses = sorted.filter(t => t.type === 'expense');
          const incomes = sorted.filter(t => t.type === 'income');

          // Caso 1: Expense + Income
          if (expenses.length > 0 && incomes.length > 0) {
            const usedExpenses = new Set<string>();
            incomes.forEach(income => {
              const match = expenses.find(exp =>
                !usedExpenses.has(exp.id) && Math.abs(exp.amount) === Math.abs(income.amount)
              );
              if (match) {
                pairedIds.add(match.id);
                pairedIds.add(income.id);
                usedExpenses.add(match.id);
              }
            });
          }

          // Caso 2: Duas expenses idênticas (compra + estorno ambos como expense)
          if (expenses.length >= 2 && incomes.length === 0) {
            const usedIds = new Set<string>();
            for (let i = 0; i < expenses.length; i++) {
              if (usedIds.has(expenses[i].id)) continue;
              for (let j = i + 1; j < expenses.length; j++) {
                if (usedIds.has(expenses[j].id)) continue;
                if (Math.abs(expenses[i].amount) === Math.abs(expenses[j].amount)) {
                  pairedIds.add(expenses[i].id);
                  pairedIds.add(expenses[j].id);
                  usedIds.add(expenses[i].id);
                  usedIds.add(expenses[j].id);
                  break;
                }
              }
            }
          }
        }
      });

      // Calcula total excluindo transações pareadas
      return txs.reduce((acc, tx) => {
        if (isCreditCardPayment(tx)) return acc;
        if (pairedIds.has(tx.id)) return acc; // Ignora transações pareadas

        const amt = getTransactionAmountInBRL(tx);

        if (tx.type === 'income') return acc - amt;
        return acc + amt;
      }, 0);
    };

    const lastTotal = calcTotalWithRefundDetection(invoiceSummary.lastInvoice.transactions);
    const charges = selectedCard?.currentBill?.financeCharges?.total || 0;

    return {
      last: lastTotal + charges,
      current: calcTotalWithRefundDetection(invoiceSummary.currentInvoice.transactions),
      next: calcTotalWithRefundDetection(invoiceSummary.nextInvoice.transactions)
    };
  }, [invoiceSummary, selectedCard, exchangeRatesLoaded]);

  // ============================================================
  // TOTAIS PARA CARDS DE FATURA ATUAL E PRÓXIMA
  // Usa a mesma lógica simples do totalAmount da tabela
  // Isso garante que o valor do card seja igual ao TOTAL mostrado na tabela
  // ============================================================
  const cardTotals = useMemo(() => {
    const calcSimpleTotal = (txs: Transaction[]) => {
      return txs.reduce((acc, tx) => {
        if (isCreditCardPayment(tx)) return acc;

        const amt = getTransactionAmountInBRL(tx);

        if (tx.type === 'income') return acc - amt;
        return acc + amt;
      }, 0);
    };

    return {
      current: calcSimpleTotal(invoiceSummary.currentInvoice.transactions),
      next: calcSimpleTotal(invoiceSummary.nextInvoice.transactions)
    };
  }, [invoiceSummary, exchangeRatesLoaded]);

  // Filter invoice transactions with search, date filters and sorting
  const filteredTransactions = useMemo(() => {
    // Use invoice transactions when card is selected and configured
    const sourceTransactions = selectedCard?.closingDay ? invoiceTransactions : baseFilteredTransactions;

    return sourceTransactions
      .filter(t => {
        if (!t.date) return false;

        const matchesSearch =
          !searchTerm ||
          (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStartDate = startDate ? t.date >= startDate : true;
        const matchesEndDate = endDate ? t.date <= endDate : true;

        // Category Filter
        let matchesCategory = true;
        if (selectedCategory !== 'all') {
          matchesCategory = t.category === selectedCategory;
        }

        return matchesSearch && matchesStartDate && matchesEndDate && matchesCategory;
      })
      .sort((a, b) => {
        // Para ordenação por data, usar timestamp completo (inclui horário)
        if (sortField === 'date') {
          const aTimestamp = a.timestamp || a.date || '';
          const bTimestamp = b.timestamp || b.date || '';
          if (aTimestamp < bTimestamp) return sortDirection === 'asc' ? -1 : 1;
          if (aTimestamp > bTimestamp) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
        // Para outros campos, ordenação normal
        const aValue: any = (a as any)[sortField];
        const bValue: any = (b as any)[sortField];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [invoiceTransactions, allCardTransactions, selectedCard, searchTerm, sortField, sortDirection, startDate, endDate, selectedCategory]);

  // Combinar transações filtradas com encargos
  const transactionsWithCharges = useMemo(() => {
    // Adiciona os encargos no início da lista (são cobranças da fatura)
    return [...chargeTransactions, ...filteredTransactions];
  }, [chargeTransactions, filteredTransactions]);

  const { groupedTransactionsWithCharges, linkedRefundsByParentId, resolvedRefundParentById } = useMemo(() => {
    const visibleIds = new Set(transactionsWithCharges.map(t => t.id));
    const byId = new Map<string, Transaction>();
    transactionsWithCharges.forEach(t => byId.set(t.id, t));

    const resolvedParentByRefundId = new Map<string, string>();

    const normalizeForMatch = (desc: string) =>
      (desc || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const stripRefundPrefix = (desc: string) =>
      (desc || '')
        .replace(/^estorno\s*-\s*/i, '')
        .replace(/^estorno\s+/i, '')
        .trim();

    const getDateNumber = (t: Transaction) => {
      const d = t.timestamp || t.date || '';
      const isoDate = d.includes('T') ? d.split('T')[0] : d;
      const [y, m, day] = isoDate.split('-').map(Number);
      if (!y || !m || !day) return 0;
      return y * 10000 + m * 100 + day;
    };

    // PASSO 1: Parear por refundOfId explícito (estornos criados pelo sistema)
    transactionsWithCharges.forEach(t => {
      const refundOfId = (t as any).refundOfId as string | undefined;
      if (refundOfId && visibleIds.has(refundOfId)) {
        resolvedParentByRefundId.set(t.id, refundOfId);
      }
    });

    // PASSO 2: Para estornos com refundOfId mas parent não visível,
    // tentar encontrar pelo nome da transação original
    transactionsWithCharges.forEach(t => {
      if (resolvedParentByRefundId.has(t.id)) return; // já pareado

      const refundOfId = (t as any).refundOfId as string | undefined;
      if (!refundOfId) return; // não tem refundOfId

      // Parent não está visível, tentar encontrar por descrição
      const desc = (t.description || '').trim();
      const baseDesc = stripRefundPrefix(desc);
      if (!baseDesc) return;

      const targetDesc = normalizeForMatch(baseDesc);

      // Buscar transação original pela descrição
      for (const candidate of transactionsWithCharges) {
        if (candidate.id === t.id) continue;
        if ((candidate as any)._syntheticRefund === true) continue;
        const candidateDescLower = (candidate.description || '').toLowerCase();
        if (candidateDescLower.startsWith('estorno -') || candidateDescLower.startsWith('estorno ')) continue;

        const candidateDesc = normalizeForMatch(candidate.description || '');
        if (candidateDesc === targetDesc) {
          resolvedParentByRefundId.set(t.id, candidate.id);
          break;
        }
      }
    });

    // ============================================================
    // DETECÇÃO AUTOMÁTICA DE PARES ESTORNO + COMPRA
    // Detecta transações que:
    // 1. Têm flag _syntheticRefund === true
    // 2. OU começam com "Estorno -" / "Estorno " na descrição
    // 3. E têm tipo 'income' (valor positivo) 
    // ============================================================
    transactionsWithCharges.forEach(t => {
      if (resolvedParentByRefundId.has(t.id)) return;

      const desc = (t.description || '').trim();
      const descLower = desc.toLowerCase();

      // Detecta se é um estorno: flag explícita OU descrição começa com "Estorno"
      const isSyntheticRefund = (t as any)._syntheticRefund === true;
      const startsWithEstorno = descLower.startsWith('estorno -') || descLower.startsWith('estorno ');
      const isRefundByType = t.type === 'income' && (
        descLower.includes('estorno') ||
        descLower.includes('reembolso') ||
        descLower.includes('devolução') ||
        descLower.includes('cancelamento')
      );

      // Se não é estorno de nenhuma forma, pula
      if (!isSyntheticRefund && !startsWithEstorno && !isRefundByType) return;

      const baseDesc = stripRefundPrefix(desc);
      if (!baseDesc) return;

      const targetDesc = normalizeForMatch(baseDesc);
      const targetAmount = Math.abs(t.amount);
      const targetDate = getDateNumber(t);

      // Se for estorno sintético (criado pelo sistema), não exigir valor igual
      const hasExplicitRefundLink = (t as any).refundOfId || (t as any)._syntheticRefund;

      const candidates: Transaction[] = [];
      transactionsWithCharges.forEach(candidate => {
        if (candidate.id === t.id) return;
        if (!visibleIds.has(candidate.id)) return;
        // Candidato não pode ser também um estorno
        const candidateDescLower = (candidate.description || '').toLowerCase();
        if ((candidate as any)._syntheticRefund === true) return;
        if (candidateDescLower.startsWith('estorno -') || candidateDescLower.startsWith('estorno ')) return;
        if (isCreditCardPayment(candidate)) return;

        const candidateDesc = normalizeForMatch(candidate.description || '');
        // Só verificar valor se não for estorno sintético
        if (!hasExplicitRefundLink) {
          const candidateAmount = Math.abs(candidate.amount);
          if (candidateAmount !== targetAmount) return;
        }
        if (candidateDesc !== targetDesc) return;
        candidates.push(candidate);
      });

      if (candidates.length === 0) return;

      candidates.sort((a, b) => {
        const aDiff = Math.abs(getDateNumber(a) - targetDate);
        const bDiff = Math.abs(getDateNumber(b) - targetDate);
        if (aDiff !== bDiff) return aDiff - bDiff;
        return (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || '');
      });

      resolvedParentByRefundId.set(t.id, candidates[0].id);
    });

    const refundsByParentId = new Map<string, Transaction[]>();
    resolvedParentByRefundId.forEach((parentId, refundId) => {
      if (!visibleIds.has(parentId)) return;
      const refundTx = byId.get(refundId);
      if (!refundTx) return;
      const list = refundsByParentId.get(parentId) || [];
      list.push(refundTx);
      refundsByParentId.set(parentId, list);
    });

    refundsByParentId.forEach(refunds => {
      refunds.sort((a, b) => {
        const aTimestamp = a.timestamp || a.date || '';
        const bTimestamp = b.timestamp || b.date || '';
        if (aTimestamp < bTimestamp) return 1;
        if (aTimestamp > bTimestamp) return -1;
        return a.id.localeCompare(b.id);
      });
    });

    const list: Transaction[] = [];
    transactionsWithCharges.forEach(t => {
      const parentId = resolvedParentByRefundId.get(t.id);
      if (parentId && visibleIds.has(parentId)) return;

      list.push(t);
      const linked = refundsByParentId.get(t.id);
      if (linked?.length) {
        linked.forEach(r => list.push(r));
      }
    });

    return {
      groupedTransactionsWithCharges: list,
      linkedRefundsByParentId: refundsByParentId,
      resolvedRefundParentById: resolvedParentByRefundId
    };
  }, [transactionsWithCharges]);

  // Calculate total amount from filtered transactions (incluindo encargos)
  // Usa conversão de moeda em tempo real para transações internacionais
  // INCLUI detecção de pares compra+estorno que se anulam
  const totalAmount = useMemo(() => {
    // Normaliza descrição para comparação
    const normalizeDesc = (desc: string) => {
      return (desc || '')
        .toLowerCase()
        .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
        .replace(/estorno\s*/gi, '')
        .replace(/reembolso\s*/gi, '')
        .replace(/devolução\s*/gi, '')
        .replace(/cancelamento\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Agrupa transações por valor absoluto e descrição normalizada
    const byAmountAndDesc: Record<string, Transaction[]> = {};
    transactionsWithCharges.forEach(t => {
      if (isCreditCardPayment(t)) return;
      const normalizedDesc = normalizeDesc(t.description || '');
      const key = `${Math.abs(t.amount).toFixed(2)}-${normalizedDesc}`;
      if (!byAmountAndDesc[key]) byAmountAndDesc[key] = [];
      byAmountAndDesc[key].push(t);
    });

    // A lógica de paramento de transações (compra vs estorno) foi DESATIVADA a pedido do usuário.
    // "remover a logica que tem tambem para definir isso"

    // Identifica IDs de transações pareadas
    const pairedIds = new Set<string>();

    // LOGICA REMOVIDA: Não tentamos mais adivinhar pares.
    // Apenas passamos reto.

    // Calcula total excluindo transações pareadas
    return transactionsWithCharges.reduce((acc, tx) => {
      if (isCreditCardPayment(tx)) return acc;
      if (pairedIds.has(tx.id)) return acc; // Ignora transações pareadas (estorno+compra)

      const amt = getTransactionAmountInBRL(tx);

      if (tx.type === 'income') return acc - amt;
      return acc + amt;
    }, 0);
  }, [transactionsWithCharges, exchangeRatesLoaded]);

  // ============================================================
  // AUTO-DETECT DUPLICATES (Não remove automaticamente - apenas detecta)
  // Duplicata REAL = mesmo ID original do banco (providerId ou pluggyRaw.id)
  // Transações com mesmo valor/data/descrição NÃO são duplicatas automaticamente
  // (pode ser 2 compras legítimas no mesmo estabelecimento)
  // ============================================================
  const [detectedDuplicates, setDetectedDuplicates] = React.useState<Array<{ original: Transaction, duplicate: Transaction }>>([]);

  React.useEffect(() => {
    if (hasCheckedDuplicates || transactions.length === 0) return;

    // Agrupar por ID ORIGINAL do banco (não pela nossa chave composta)
    // Duplicata real acontece quando a mesma transação do banco foi importada 2x
    const byOriginalId: Record<string, Transaction[]> = {};

    transactions.forEach(t => {
      // Usa providerId ou o ID da transação raw do Pluggy
      const originalId = t.providerId || t.pluggyRaw?.id || null;

      // Só agrupa se tiver um ID original (transações manuais não tem)
      if (originalId) {
        if (!byOriginalId[originalId]) byOriginalId[originalId] = [];
        byOriginalId[originalId].push(t);
      }
    });

    // Encontra duplicatas REAIS (mesmo ID original do banco)
    const realDuplicates: Array<{ original: Transaction, duplicate: Transaction }> = [];

    Object.entries(byOriginalId).forEach(([originalId, group]) => {
      if (group.length > 1) {
        // Ordena por data de criação (mais antiga primeiro) se disponível
        const sorted = [...group].sort((a, b) => {
          const aCreated = (a as any).createdAt || a.date;
          const bCreated = (b as any).createdAt || b.date;
          return aCreated < bCreated ? -1 : 1;
        });

        // Primeiro é o original, os outros são duplicatas
        for (let i = 1; i < sorted.length; i++) {
          realDuplicates.push({
            original: sorted[0],
            duplicate: sorted[i]
          });
        }
      }
    });

    if (realDuplicates.length > 0) {
      console.log(`[CreditCardTable] ⚠️ Detectadas ${realDuplicates.length} possíveis duplicatas (mesmo ID do banco):`,
        realDuplicates.map(d => ({
          originalId: d.original.providerId || d.original.pluggyRaw?.id,
          desc: d.original.description?.slice(0, 30),
          duplicateId: d.duplicate.id
        }))
      );

      // ⚠️ DESATIVADO: Não remover automaticamente para evitar deleção acidental
      // Se precisar limpar duplicatas, faça manualmente ou via re-sync
      // const idsToDelete = realDuplicates.map(d => d.duplicate.id);
      // Promise.all(idsToDelete.map(id => onDelete(id)))...

      setDetectedDuplicates(realDuplicates);
    }

    setHasCheckedDuplicates(true);
  }, [transactions, hasCheckedDuplicates, onDelete, toast]);



  // ============================================================
  // AUTO-FIX: DESATIVADO
  // A correção de estornos agora é feita APENAS no backend durante sincronização
  // Manter este código desativado para evitar alterações incorretas
  // ============================================================
  // React.useEffect(() => {
  //   if (transactions.length === 0) return;
  //
  //   const fixes: string[] = [];
  //   const refundKeywords = [
  //     'estorno', 'reembolso', 'devolucao', 'devolução',
  //     'cancelamento', 'cancelado', 'refund', 'chargeback',
  //     'cashback'
  //   ];
  //
  //   transactions.forEach(t => {
  //     if (t.type === 'expense') {
  //       const desc = (t.description || '').toLowerCase();
  //       const category = (t.category || '').toLowerCase();
  //       const isRefund = refundKeywords.some(kw => desc.includes(kw) || category.includes(kw));
  //       if (isRefund) {
  //         fixes.push(t.id);
  //         onUpdate({ ...t, type: 'income', category: 'Reembolso' });
  //       }
  //     }
  //   });
  //
  //   if (fixes.length > 0) {
  //     toast.success(`${fixes.length} estorno(s) corrigido(s) automaticamente!`);
  //   }
  // }, [transactions, onUpdate]);

  // ============================================================
  // AUTO-DETECT: Transações pareadas (compra + estorno idêntico)
  // Detecta pares de transações com mesmo valor e descrição similar
  // que se anulam (compra + estorno), mesmo quando ambas vêm como expense
  // ============================================================
  const { pairedTransactions, pairedTransactionIds } = React.useMemo(() => {
    const pairs: Array<{ purchase: Transaction, refund: Transaction }> = [];
    const pairedIds = new Set<string>();

    // Normaliza descrição para comparação
    const normalizeDesc = (desc: string) => {
      return (desc || '')
        .toLowerCase()
        .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '') // Remove parcelas (ex: 1/12)
        .replace(/estorno\s*/gi, '')
        .replace(/reembolso\s*/gi, '')
        .replace(/devolução\s*/gi, '')
        .replace(/cancelamento\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Agrupa transações por valor absoluto e descrição normalizada
    const byAmountAndDesc: Record<string, Transaction[]> = {};

    transactions.forEach(t => {
      const normalizedDesc = normalizeDesc(t.description || '');
      const key = `${Math.abs(t.amount).toFixed(2)}-${normalizedDesc}`;
      if (!byAmountAndDesc[key]) byAmountAndDesc[key] = [];
      byAmountAndDesc[key].push(t);
    });

    // Procura pares dentro de cada grupo
    Object.values(byAmountAndDesc).forEach(group => {
      if (group.length >= 2) {
        // Ordena por data para parear corretamente
        const sorted = [...group].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Caso 1: Expense + Income (reembolso explícito)
        const expenses = sorted.filter(t => t.type === 'expense');
        const incomes = sorted.filter(t => t.type === 'income');

        if (expenses.length > 0 && incomes.length > 0) {
          const usedExpenses = new Set<string>();
          const usedIncomes = new Set<string>();

          incomes.forEach(income => {
            if (usedIncomes.has(income.id)) return;

            // Encontra expense não pareada mais próxima em data
            const matchingExpense = expenses.find(exp =>
              !usedExpenses.has(exp.id) &&
              Math.abs(exp.amount) === Math.abs(income.amount)
            );

            if (matchingExpense) {
              pairs.push({ purchase: matchingExpense, refund: income });
              pairedIds.add(matchingExpense.id);
              pairedIds.add(income.id);
              usedExpenses.add(matchingExpense.id);
              usedIncomes.add(income.id);
            }
          });
        }

        // Caso 2: Duas expenses idênticas (compra + estorno ambos como expense)
        // Isso acontece quando o banco envia ambos como valor negativo
        if (expenses.length >= 2 && incomes.length === 0) {
          // Verifica se temos pares exatos (mesmo valor, mesma descrição)
          const usedIds = new Set<string>();

          for (let i = 0; i < expenses.length; i++) {
            if (usedIds.has(expenses[i].id)) continue;

            for (let j = i + 1; j < expenses.length; j++) {
              if (usedIds.has(expenses[j].id)) continue;

              // Mesmo valor absoluto = provável par compra/estorno
              if (Math.abs(expenses[i].amount) === Math.abs(expenses[j].amount)) {
                // O mais antigo é a compra, o mais novo é o estorno
                const purchase = expenses[i];
                const refund = expenses[j];

                pairs.push({ purchase, refund });
                pairedIds.add(purchase.id);
                pairedIds.add(refund.id);
                usedIds.add(purchase.id);
                usedIds.add(refund.id);
                break; // Cada transação só pode ter um par
              }
            }
          }
        }
      }
    });

    // LOGICA REMOVIDA
    return {
      pairedTransactions: [],
      pairedTransactionIds: new Set<string>()
    };
  }, [transactions]);

  // Log pares detectados para debug
  React.useEffect(() => {
    if (pairedTransactions.length > 0) {
      console.log(`[CreditCardTable] 🔄 Detectados ${pairedTransactions.length} pares compra+estorno (zerados no total):`,
        pairedTransactions.map(p => ({
          purchase: { id: p.purchase.id, desc: p.purchase.description?.slice(0, 30), amount: p.purchase.amount, date: p.purchase.date },
          refund: { id: p.refund.id, desc: p.refund.description?.slice(0, 30), amount: p.refund.amount, date: p.refund.date }
        }))
      );
    }
  }, [pairedTransactions]);

  const handleEditClick = (transaction: Transaction) => {
    // Garantir que accountType está definido como CREDIT_CARD
    setEditTransaction({
      ...transaction,
      accountType: transaction.accountType || 'CREDIT_CARD'
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editTransaction) return;

    if (!editTransaction.description || editTransaction.amount <= 0) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    onUpdate(editTransaction);
    toast.success("Lançamento atualizado com sucesso!");
    setIsEditModalOpen(false);
    setEditTransaction(null);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setEditTransaction(null);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportCountdown, setExportCountdown] = useState(3);

  const handleExport = () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportCountdown(3);

    // Iniciar contagem regressiva
    const timer = setInterval(() => {
      setExportCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Executar o download após o countdown
          const dateStr = new Date().toISOString().split('T')[0];
          exportToCSV(filteredTransactions, `fatura_cartao_${dateStr}.csv`);

          // Pequeno delay para resetar o botão
          setTimeout(() => {
            setIsExporting(false);
            setExportCountdown(3);
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };



  // Usar categorias do mapeamento Pluggy ao invés de hardcoded
  const CATEGORIES = useMemo(() => {
    return categoryMappings.map(cat => cat.displayName);
  }, [categoryMappings]);


  // Handlers for Bulk Actions
  const handleSelectAll = () => {
    // Select all visible transactions (using filteredTransactions as source of truth)
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleSelectOne = (id: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkSubmit = () => {
    if (onBulkUpdate && bulkCategory) {
      // Filtrar transações projetadas (não existem no banco de dados)
      const realTransactionIds = selectedIds.filter(id =>
        !id.startsWith('proj_') && !id.startsWith('charge_')
      );

      if (realTransactionIds.length === 0) {
        toast.error("Nenhuma transação real selecionada. Transações projetadas não podem ser atualizadas.");
        return;
      }

      onBulkUpdate(realTransactionIds, { category: bulkCategory });
      setSelectedIds([]);
      setBulkCategory('');
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">Fatura do Cartão</h2>

              <div className="relative ml-2 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1c1917] border border-amber-500/20 text-[10px] sm:text-xs text-amber-500 leading-tight">
                {/* Arrow Pointer */}
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rotate-45 border-l border-b border-amber-500/20 bg-[#1c1917]"></div>

                <AlertCircle size={14} className="shrink-0 relative z-10" />
                <span className="relative z-10">
                  <strong>Sincronização Manual:</strong> As faturas não atualizam sozinhas. Vá em <strong className="text-amber-400">Gestão de Contas</strong> e clique em <strong className="text-amber-400">Sincronizar</strong> no card do banco.
                </span>
              </div>
              {/* Mobile version (compact) */}
              <div className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-500">
                <AlertCircle size={12} />
                <span>Sincronização Manual</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">{filteredTransactions.length} lançamentos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="export-btn"
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all rounded-lg
              ${isExporting
                ? 'bg-blue-500/10 text-blue-400 cursor-not-allowed'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            title="Exportar para Excel"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span className="hidden sm:inline">Baixando em {exportCountdown}...</span>
              </>
            ) : (
              <>
                <FileText size={18} />
                <span className="hidden sm:inline">Exportar</span>
              </>
            )}
          </button>





          {((isManualMode || selectedCard?.connectionMode === 'MANUAL') && onAdd) && (
            <button
              onClick={() => {
                setNewTransaction({
                  description: '',
                  amount: 0,
                  date: new Date().toISOString().split('T')[0],
                  category: '',
                  type: 'expense',
                  status: 'pending',
                  accountType: 'CREDIT_CARD',
                  accountId: selectedCard?.id || creditCardAccounts[0]?.id || undefined,
                  totalInstallments: 1,
                  installmentNumber: 1
                });
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white text-sm rounded-lg font-semibold transition-all shadow-md shadow-[#d97757]/20"
            >
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Lançar Compra</span>
            </button>
          )}

        </div>
      </div>



      {/* Invoice Summary Cards */}
      {creditCardAccounts.length > 0 && (
        <div className="mb-6">
          {/* Cards Selector - Smooth Tabs with Motion */}
          <div className="mb-8">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar p-1">
              {visibleCreditCardAccounts.map((card, index) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 outline-none ${isSelected ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-[#232322] border border-[#373734] rounded-full shadow-sm"
                        transition={{ type: "spring", stiffness: 250, damping: 25 }}
                      />
                    )}
                    {/* Logo do banco ou ícone genérico */}
                    {card.connector?.imageUrl ? (
                      <img
                        src={card.connector.imageUrl}
                        alt=""
                        className="relative z-10 w-4 h-4 rounded-full object-contain bg-white p-0.5"
                      />
                    ) : (
                      <div className={`relative z-10 flex items-center justify-center p-0.5 rounded-full transition-all ${isSelected ? 'text-[#d97757]' : 'text-gray-600'}`}>
                        <CreditCard size={12} className="" />
                      </div>
                    )}
                    <span className="relative z-10 truncate max-w-[100px] tracking-wide">
                      {card.name || card.institution || 'Cartão'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Card Details */}
          {selectedCard && (
            <>
              {/* Check if card needs configuration */}
              {!selectedCard.closingDay ? (
                <div className="relative overflow-hidden bg-[#232322] border border-[#373734] rounded-2xl p-8 sm:p-12 text-center group transition-all hover:border-[#d97757]/30">
                  <div className="absolute top-0 right-0 p-32 bg-[#d97757]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#d97757]/20 to-[#d97757]/5 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-[#d97757]/20 shadow-lg shadow-[#d97757]/10 group-hover:scale-105 transition-transform duration-300">
                      <Settings size={32} className="text-[#d97757]" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-3">
                      Configure o cartão <span className="text-[#d97757]">{selectedCard.name || selectedCard.institution}</span>
                    </h3>

                    <p className="text-gray-400 mb-8 leading-relaxed text-sm sm:text-base">
                      Para visualização correta das faturas e melhor controle financeiro, precisamos que defina os dias de fechamento e vencimento deste cartão.
                    </p>

                    <div className="flex flex-wrap justify-center gap-3 mb-8">
                      <div className="px-4 py-2 bg-[#1a1a19] rounded-lg border border-[#373734] flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></div>
                        Controle de vencimentos
                      </div>
                      <div className="px-4 py-2 bg-[#1a1a19] rounded-lg border border-[#373734] flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Previsão de gastos
                      </div>
                    </div>

                    {onUpdateAccount && (
                      <Button
                        onClick={() => {
                          setCardSettings({
                            closingDay: selectedCard.closingDay || 10,
                            dueDay: selectedCard.dueDay || 20,
                            manualBeforeLastClosingDate: selectedCard.manualBeforeLastClosingDate,
                            manualLastClosingDate: selectedCard.manualLastClosingDate,
                            manualCurrentClosingDate: selectedCard.manualCurrentClosingDate
                          });
                          setIsSettingsModalOpen(true);
                        }}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto font-bold text-sm shadow-lg shadow-[#d97757]/25 hover:shadow-[#d97757]/40 hover:-translate-y-0.5"
                      >
                        <Settings size={18} strokeWidth={2.5} />
                        Configurar Cartão Agora
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Card Header with Settings */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Logo do banco ou ícone genérico */}
                      {selectedCard.connector?.imageUrl ? (
                        <img
                          src={selectedCard.connector.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-contain bg-white p-1"
                        />
                      ) : (
                        <div className="p-2.5 bg-[#d97757]/40 rounded-full shadow-lg shadow-[#d97757]/10">
                          <CreditCard size={20} className="text-white" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white max-w-[150px] truncate sm:max-w-none">
                            {selectedCard.name || selectedCard.institution || 'Cartão'}
                          </h3>
                          {isAdmin && (
                            <button
                              onClick={() => setShowInvoiceCards(!showInvoiceCards)}
                              className="p-1 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                              title={showInvoiceCards ? "Recolher cartões" : "Expandir cartões"}
                            >
                              {showInvoiceCards ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Fecha dia {invoiceSummary.closingDay} • Vence dia {invoiceSummary.dueDay}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">

                      {onUpdateAccount && (
                        <button
                          onClick={() => {
                            setCardSettings({
                              closingDay: selectedCard.closingDay || 10,
                              dueDay: selectedCard.dueDay || 20,
                              manualBeforeLastClosingDate: selectedCard.manualBeforeLastClosingDate,
                              manualLastClosingDate: selectedCard.manualLastClosingDate,
                              manualCurrentClosingDate: selectedCard.manualCurrentClosingDate
                            });
                            setIsSettingsModalOpen(true);
                          }}
                          className="p-2.5 bg-[#232322] hover:bg-[#2a2a28] border border-[#373734] rounded-xl text-gray-400 hover:text-white transition-all"
                          title="Configurar cartão"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                    </div>
                  </div>



                  {/* Invoice Cards Grid - with Animation */}
                  <AnimatePresence>
                    {showInvoiceCards && isAdmin && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6">
                          {/* HISTÓRICO (TODAS) */}
                          <button
                            onClick={() => setSelectedInvoice('all')}
                            className={`bg-[#232322] rounded-xl p-3 flex flex-col justify-between h-full transition-all text-left w-full ${selectedInvoice === 'all'
                              ? 'border-2 border-[#d97757] ring-2 ring-[#d97757]/20'
                              : 'border border-[#373734] hover:border-gray-600 opacity-60 hover:opacity-100'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1 w-full">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                Histórico
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide bg-gray-500/10 text-gray-400">
                                TODAS
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5 w-full">

                              <span className="text-[10px] text-gray-500">
                                Todas as transações
                              </span>
                              <span className="text-[9px] text-gray-600">
                                {baseFilteredTransactions.length} lançamentos no total
                              </span>
                            </div>
                          </button>

                          {/* ÚLTIMA FATURA (FECHADA) */}
                          <button
                            onClick={() => setSelectedInvoice('last')}
                            className={`bg-[#232322] rounded-xl p-3 flex flex-col justify-between h-full transition-all text-left w-full ${selectedInvoice === 'last'
                              ? 'border-2 border-[#d97757] ring-2 ring-[#d97757]/20'
                              : 'border border-[#373734] hover:border-gray-600 opacity-60 hover:opacity-100'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1 w-full">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                Última Fatura
                              </span>
                              <div className="flex items-center gap-1">
                                {invoicePaymentInfo.last.isPaid ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                    <Check size={10} /> PAGA
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400">
                                    FECHADA
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-0.5 w-full">
                              {invoicePaymentInfo.last.isPaid ? (
                                <div className="flex flex-col">
                                  <span className={`text-xl font-bold font-mono tracking-tight line-through opacity-50 ${selectedInvoice === 'last' ? 'text-[#d97757]' : 'text-white'}`}>
                                    {formatCurrency(invoicePaymentInfo.last.total)}
                                  </span>
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={12} /> Pago: {formatCurrency(invoicePaymentInfo.last.paidAmount)}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xl font-bold font-mono tracking-tight ${selectedInvoice === 'last' ? 'text-[#d97757]' : 'text-white'}`}>
                                    {formatCurrency(invoicePaymentInfo.last.total)}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] text-gray-500">
                                {invoiceSummary.lastInvoiceStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {invoiceSummary.lastInvoiceEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="text-[9px] text-gray-600">
                                Venceu {invoicePaymentInfo.last.dueDateToShow.toLocaleDateString('pt-BR')} • {invoiceSummary.lastInvoice.transactions.length} lançamentos
                              </span>
                              {/* Encargos Financeiros (IOF, Juros, Multa, Outros) - exibido quando disponível via API Pluggy */}
                              {selectedCard.currentBill?.financeCharges && (
                                (selectedCard.currentBill.financeCharges.iof > 0 ||
                                  selectedCard.currentBill.financeCharges.interest > 0 ||
                                  selectedCard.currentBill.financeCharges.lateFee > 0 ||
                                  (selectedCard.currentBill.financeCharges.otherCharges || 0) > 0) && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <div className="flex items-center gap-1 mb-1">
                                      <AlertCircle size={10} className="text-red-400" />
                                      <span className="text-[8px] text-red-400 font-semibold uppercase">Encargos</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {selectedCard.currentBill.financeCharges.iof > 0 && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                                          IOF: {formatCurrency(selectedCard.currentBill.financeCharges.iof)}
                                        </span>
                                      )}
                                      {selectedCard.currentBill.financeCharges.interest > 0 && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                                          Juros: {formatCurrency(selectedCard.currentBill.financeCharges.interest)}
                                        </span>
                                      )}
                                      {selectedCard.currentBill.financeCharges.lateFee > 0 && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-medium">
                                          Multa: {formatCurrency(selectedCard.currentBill.financeCharges.lateFee)}
                                        </span>
                                      )}
                                      {(selectedCard.currentBill.financeCharges.otherCharges || 0) > 0 && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                                          Outros: {formatCurrency(selectedCard.currentBill.financeCharges.otherCharges || 0)}
                                        </span>
                                      )}
                                    </div>
                                    {(selectedCard.currentBill.financeCharges.total || 0) > 0 && (
                                      <div className="mt-1 pt-1 border-t border-red-500/10 text-[9px] text-red-400 font-bold">
                                        Total Encargos: {formatCurrency(selectedCard.currentBill.financeCharges.total || 0)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </button>

                          {/* FATURA ATUAL (ABERTA) */}
                          <button
                            onClick={() => setSelectedInvoice('current')}
                            className={`bg-[#232322] rounded-xl p-3 flex flex-col justify-between h-full transition-all text-left w-full ${selectedInvoice === 'current'
                              ? 'border-2 border-[#d97757] ring-2 ring-[#d97757]/20'
                              : 'border border-[#373734] hover:border-gray-600 opacity-60 hover:opacity-100'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1 w-full">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                Fatura Atual
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400">
                                ABERTA
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5 w-full">
                              <span className={`text-xl font-bold font-mono tracking-tight ${selectedInvoice === 'current' ? 'text-[#d97757]' : 'text-white'}`}>
                                {formatCurrency(cardTotals.current)}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {invoiceSummary.currentInvoiceStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {invoiceSummary.currentInvoiceEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="text-[9px] text-gray-600">
                                Vence {invoiceSummary.currentDueDate.toLocaleDateString('pt-BR')} • {invoiceSummary.currentInvoice.transactions.length} lançamentos
                              </span>
                            </div>
                          </button>

                          {/* PRÓXIMA FATURA (FUTURA) */}
                          <button
                            onClick={() => setSelectedInvoice('next')}
                            className={`bg-[#232322] rounded-xl p-3 flex flex-col justify-between h-full transition-all text-left w-full ${selectedInvoice === 'next'
                              ? 'border-2 border-[#d97757] ring-2 ring-[#d97757]/20'
                              : 'border border-[#373734] hover:border-gray-600 opacity-60 hover:opacity-100'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1 w-full">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                                Próxima Fatura
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wide">
                                FUTURA
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5 w-full">
                              <span className={`text-xl font-bold font-mono tracking-tight ${selectedInvoice === 'next' ? 'text-blue-400' : 'text-white'}`}>
                                {formatCurrency(cardTotals.next)}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {invoiceSummary.nextInvoiceStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {invoiceSummary.nextInvoiceEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="text-[10px] text-blue-400 font-bold">
                                Total Futuro: {formatCurrency(invoiceSummary.allFutureTotal)}
                              </span>
                              <span className="text-[9px] text-gray-600">
                                Vence em {invoiceSummary.nextDueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {invoiceSummary.nextInvoice.transactions.length} lançamentos
                              </span>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

            </>
          )}


          {/* Only show filters and table if card is configured */}
          {
            (!selectedCard || selectedCard.closingDay) && (
              <>
                {/* Filters Row */}
                <div className="flex flex-wrap gap-3 items-center mb-4">
                  {/* Search - Left and Full Width on Mobile */}
                  <div className="relative w-full sm:w-72 group order-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors z-10" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      className="w-full h-11 pl-11 pr-12 sm:pr-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {/* Mobile Filter Button (Inside Input) */}
                    <button
                      onClick={() => setIsFilterModalOpen(true)}
                      className="absolute right-1 top-1 bottom-1 w-10 flex sm:hidden items-center justify-center text-gray-400 hover:text-[#d97757] hover:bg-white/5 rounded-lg transition-all z-10"
                    >
                      <Filter size={18} />
                    </button>
                  </div>

                  {/* Spacer - hidden on mobile */}
                  <div className="hidden sm:block flex-1 order-2" />

                  {/* Desktop Filters - Hidden on Mobile */}
                  <div className="hidden sm:flex items-center gap-3 order-3">

                    {/* Category Filter Dropdown */}
                    <div className="relative z-50 w-full sm:w-auto">
                      <Dropdown>
                        <DropdownTrigger className="h-11 px-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-all font-medium justify-between w-full sm:min-w-[180px]">
                          <div className="flex items-center gap-2 truncate">
                            <Tag size={16} className="text-[#d97757] flex-shrink-0" />
                            <span className="truncate">{selectedCategory === 'all' ? 'Todas as Categorias' : translateCategory(selectedCategory)}</span>
                          </div>
                          <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
                        </DropdownTrigger>
                        <DropdownContent className="w-64 max-h-80 overflow-y-auto custom-scrollbar" align="left">
                          <DropdownItem
                            onClick={() => setSelectedCategory('all')}
                            icon={Tag}
                            className={selectedCategory === 'all' ? 'bg-white/5 text-white' : ''}
                          >
                            Todas as Categorias
                          </DropdownItem>
                          {availableCategories.map(cat => (
                            <DropdownItem
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              icon={Tag}
                              className={selectedCategory === cat ? 'bg-white/5 text-white' : ''}
                            >
                              {translateCategory(cat)}
                            </DropdownItem>
                          ))}
                        </DropdownContent>
                      </Dropdown>
                    </div>

                    {/* Start Date */}
                    <div className="w-36">
                      <CustomDatePicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="Início"
                        dropdownMode="fixed"
                      />
                    </div>

                    {/* End Date */}
                    <div className="w-36">
                      <CustomDatePicker
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="Fim"
                        dropdownMode="fixed"
                      />
                    </div>

                    {/* Year Selector */}
                    <div className="w-28">
                      <CustomSelect
                        value={selectedYear}
                        onChange={(val) => setSelectedYear(Number(val))}
                        options={yearOptions}
                        placeholder="Ano"
                        className="h-11 bg-[#232322] border-[#373734] rounded-xl text-sm w-full"
                        portal
                      />
                    </div>

                    {/* Reset Button */}
                    {(startDate || endDate || (selectedYear !== 0 && selectedYear !== new Date().getFullYear()) || selectedCategory !== 'all') && (
                      <button
                        onClick={() => { setStartDate(''); setEndDate(''); setSelectedYear(new Date().getFullYear()); setSelectedCategory('all'); }}
                        className="h-11 px-4 w-auto flex items-center justify-center gap-2 rounded-xl bg-[#232322] text-gray-400 hover:text-white hover:bg-[#2a2a28] border border-[#373734] transition-all text-xs font-bold uppercase tracking-wider"
                      >
                        <X size={14} /> Limpar
                      </button>
                    )}
                  </div>


                </div>

                {/* Table Card */}
                <div className="bg-[#232322] border border-[#373734] rounded-xl flex flex-col flex-1 overflow-hidden relative">

                  {/* Refund Hint Banner */}
                  <div className="bg-blue-500/5 border-b border-blue-500/10 px-4 py-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-blue-300/80">
                      <HelpCircle size={14} className="shrink-0 text-blue-400" />
                      <span>
                        <strong className="text-blue-400">Dica:</strong> Para estornar uma transação, clique no ícone <span className="inline-flex items-center justify-center w-4 h-4 bg-white/10 rounded mx-0.5"><RotateCcw size={10} /></span> na coluna de ações.
                      </span>
                    </div>
                    {/* Optional: Add a close button here if needed, but keeping it persistent for visibility as requested */}
                  </div>
                  <AnimatePresence>
                    {selectedIds.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        data-tour="bulk-action-bar"
                        className="absolute top-0 left-0 right-0 z-20 bg-[#232322] border-b border-[#373734] p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 pl-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#d97757]/20 text-[#d97757] font-bold text-xs">
                            {selectedIds.length}
                          </span>
                          <span className="text-white font-medium text-sm">
                            selecionados
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Dropdown>
                            <DropdownTrigger className="flex items-center gap-2 px-3 py-1.5 bg-[#3a3a38] border border-[#454542] hover:border-[#d97757]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                              <Tag size={13} />
                              {bulkCategory ? translateCategory(bulkCategory) : "Alterar Categoria"}
                            </DropdownTrigger>
                            <DropdownContent className="w-56 max-h-60 overflow-y-auto custom-scrollbar" align="right">
                              <DropdownItem
                                onClick={() => setBulkCategory('')}
                                icon={Tag}
                                className="bg-transparent text-gray-400"
                              >
                                Limpar Seleção
                              </DropdownItem>
                              {categoryMappings.length > 0 ? categoryMappings.map((cat) => (
                                <DropdownItem
                                  key={cat.originalKey}
                                  onClick={() => setBulkCategory(cat.originalKey)}
                                  icon={Tag}
                                  className={bulkCategory === cat.originalKey ? 'bg-white/5 text-white' : ''}
                                >
                                  {cat.displayName || cat.originalKey}
                                </DropdownItem>
                              )) : CATEGORIES.map((cat) => (
                                <DropdownItem
                                  key={cat}
                                  onClick={() => setBulkCategory(cat)}
                                  icon={Tag}
                                  className={bulkCategory === cat ? 'bg-white/5 text-white' : ''}
                                >
                                  {translateCategory(cat)}
                                </DropdownItem>
                              ))}
                            </DropdownContent>
                          </Dropdown>

                          <button
                            onClick={handleBulkSubmit}
                            disabled={!bulkCategory}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#d97757] hover:bg-[#c56646] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check size={13} />
                            Aplicar
                          </button>

                          <div className="h-4 w-px bg-gray-700 mx-1" />
                          <button
                            onClick={() => setSelectedIds([])}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Limpar seleção"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>



                  {/* Responsive Table Grid */}
                  <div className="overflow-auto flex-1 custom-scrollbar z-0 pb-20 sm:pb-0">
                    <table className="min-w-[1000px] w-full border-collapse text-sm text-left h-full">
                      <thead className="bg-[#333432] sticky top-0 z-10 text-xs font-bold text-gray-400 uppercase tracking-wider shadow-sm">
                        <tr>
                          <th className="px-4 py-4 border-b border-r border-[#373734] w-12 text-center align-middle">
                            <div className="flex items-center justify-center h-full">
                              <button
                                onClick={handleSelectAll}
                                className="group flex items-center justify-center w-full h-full"
                              >
                                <div className={`
                                  w-5 h-5 rounded-md border transition-all flex items-center justify-center
                                  ${selectedIds.length > 0
                                    ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                                    : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                                  }
                                `}>
                                  {filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length ? (
                                    <Check size={12} strokeWidth={3} />
                                  ) : selectedIds.length > 0 ? (
                                    <Minus size={12} strokeWidth={3} />
                                  ) : (
                                    <Check size={12} strokeWidth={3} />
                                  )}
                                </div>
                              </button>
                            </div>
                          </th>
                          <th className="px-6 py-4 border-b border-r border-[#373734] w-40">
                            <Dropdown>
                              <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                                Data {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </DropdownTrigger>
                              <DropdownContent align="left" width="w-48">
                                <DropdownItem
                                  onClick={() => { setSortField('date'); setSortDirection('asc'); }}
                                  icon={ArrowUpCircle}
                                  className={sortField === 'date' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Crescente
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => { setSortField('date'); setSortDirection('desc'); }}
                                  icon={ArrowDownCircle}
                                  className={sortField === 'date' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Decrescente
                                </DropdownItem>
                              </DropdownContent>
                            </Dropdown>
                          </th>
                          <th className="px-6 py-4 border-b border-r border-[#373734] w-32 text-center">
                            <span className="flex items-center justify-center gap-2 text-gray-400">
                              Fatura
                            </span>
                          </th>

                          <th className="px-6 py-4 border-b border-r border-[#373734]">
                            <Dropdown>
                              <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                                Descrição {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </DropdownTrigger>
                              <DropdownContent align="left" width="w-48">
                                <DropdownItem
                                  onClick={() => { setSortField('description'); setSortDirection('asc'); }}
                                  icon={ArrowUpCircle}
                                  className={sortField === 'description' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                                >
                                  A-Z
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => { setSortField('description'); setSortDirection('desc'); }}
                                  icon={ArrowDownCircle}
                                  className={sortField === 'description' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Z-A
                                </DropdownItem>
                              </DropdownContent>
                            </Dropdown>
                          </th>
                          <th className="px-6 py-4 border-b border-r border-[#373734] w-48">
                            <Dropdown>
                              <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                                Categoria {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </DropdownTrigger>
                              <DropdownContent align="left" width="w-48">
                                <DropdownItem
                                  onClick={() => { setSortField('category'); setSortDirection('asc'); }}
                                  icon={ArrowUpCircle}
                                  className={sortField === 'category' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                                >
                                  A-Z
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => { setSortField('category'); setSortDirection('desc'); }}
                                  icon={ArrowDownCircle}
                                  className={sortField === 'category' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Z-A
                                </DropdownItem>
                              </DropdownContent>
                            </Dropdown>
                          </th>
                          <th className="px-6 py-4 border-b border-r border-[#373734] w-40">
                            <Dropdown>
                              <DropdownTrigger className="flex items-center justify-end gap-2 hover:text-white transition-colors cursor-pointer w-full text-right">
                                Valor {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                              </DropdownTrigger>
                              <DropdownContent align="right" width="w-48">
                                <DropdownItem
                                  onClick={() => { setSortField('amount'); setSortDirection('asc'); }}
                                  icon={ArrowUpCircle}
                                  className={sortField === 'amount' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Menor Valor
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => { setSortField('amount'); setSortDirection('desc'); }}
                                  icon={ArrowDownCircle}
                                  className={sortField === 'amount' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                                >
                                  Maior Valor
                                </DropdownItem>
                              </DropdownContent>
                            </Dropdown>
                          </th>

                          <th className="px-6 py-4 border-b border-r border-[#373734] w-32 text-center">Status</th>
                          <th className="px-6 py-4 border-b border-[#373734] w-16 text-center">Ações</th>
                        </tr>
                      </thead>

                      <motion.tbody
                        key={selectedCardId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className=""
                      >
                        {groupedTransactionsWithCharges.map((t, index) => {
                          const isCharge = (t as any).isCharge === true;
                          const isPayment = (t as any).isPayment === true;
                          // Detecta descLower primeiro para usar na detecção de estorno
                          const descLower = (t.description || '').toLowerCase();
                          // Detecta estorno: flag OU descrição que começa com "Estorno -"
                          const isSyntheticRefund = (t as any)._syntheticRefund === true ||
                            descLower.startsWith('estorno -') ||
                            descLower.startsWith('estorno ');
                          // const refundAppliedAmount = removed
                          const hasAppliedRefund = false;
                          const resolvedRefundOfId = resolvedRefundParentById.get(t.id);
                          const isLinkedRefund = !!resolvedRefundOfId;
                          const hasLinkedRefund = linkedRefundsByParentId.has(t.id);
                          const isLate = (t as any).isLate === true;
                          const daysLate = (t as any).daysLate || 0;
                          const isAdjustment = (t as any).isAdjustment === true;
                          const isProjected = (t as any).isProjected === true;
                          const canDelete = !isAdjustment && !isCharge && !isProjected && !isSyntheticRefund;

                          // Detecta se PODE ser reembolso (para sugerir ao usuário)
                          const mightBeRefund = false; // logic removed

                          // Detecta se a transação faz parte de um par compra+estorno (zerando o total)
                          const isPaired = pairedTransactionIds.has(t.id);

                          // Detectar transação de IOF (imposto sobre compra internacional)
                          // Reusa descLower já declarado acima
                          const isIOF = (t as any).isIOF === true ||
                            descLower.includes('iof') ||
                            descLower.includes('imposto') ||
                            (descLower.includes('tax') && descLower.includes('internacional'));

                          // Extrair dados de moeda (direto ou do pluggyRaw para transações antigas)
                          const txCurrencyCode = (t as any).currencyCode
                            || (t as any).pluggyRaw?.currencyCode
                            || 'BRL';
                          // Valor original em moeda estrangeira (ex: 20 USD)
                          // Pega do campo direto, ou do pluggyRaw (com Math.abs pois pode ser negativo)
                          const txAmountOriginal = (t as any).amountOriginal
                            || Math.abs((t as any).pluggyRaw?.amount || 0)
                            || Math.abs(t.amount);
                          const isInternational = txCurrencyCode && txCurrencyCode !== 'BRL';

                          // Para transações internacionais, SEMPRE converter em tempo real
                          // Isso garante valor correto mesmo para transações antigas
                          let displayAmount: number;
                          if (isInternational) {
                            // Converter em tempo real usando API de câmbio
                            const exchangeRate = getExchangeRateSync(txCurrencyCode);
                            displayAmount = Math.abs(txAmountOriginal) * exchangeRate;
                          } else {
                            displayAmount = Math.abs(t.amount);
                          }

                          // Determina se faz parte de um par estornado (amarelo vibrante)
                          const isRefundPair = hasLinkedRefund || isLinkedRefund || isSyntheticRefund;
                          // Verifica se é a última transação do grupo de estorno (para colocar borda inferior)
                          const isLastInRefundGroup = isLinkedRefund && !linkedRefundsByParentId.has(t.id);

                          return (
                            <tr
                              key={t.id}
                              className={`transition-colors group ${(hasLinkedRefund && !isLastInRefundGroup) ? 'border-b-0' : 'border-b'} border-[#373734] ${isAdjustment
                                ? 'bg-purple-500/5 hover:bg-purple-500/10'
                                : isCharge
                                  ? 'bg-red-500/5 hover:bg-red-500/10'
                                  : isPayment
                                    ? isLate
                                      ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                      : 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                    : 'hover:bg-[#373734]/30'
                                }`}
                            >
                              <td className={`px-4 py-4 border-r border-[#373734] text-center align-middle ${(hasLinkedRefund && !isLastInRefundGroup) ? '' : 'border-b'}`}>
                                <div className="flex items-center justify-center h-full">
                                  {isSyntheticRefund ? null : (
                                    <button
                                      onClick={(e) => handleSelectOne(t.id, e)}
                                      className="group flex items-center justify-center w-full h-full"
                                    >
                                      <div
                                        data-tour={index === 0 ? "row-checkbox-0" : undefined}
                                        className={`
                                      w-5 h-5 rounded-md border transition-all flex items-center justify-center
                                      ${selectedIds.includes(t.id)
                                            ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                                            : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                                          }
                                    `}>
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap font-mono text-xs border-r border-[#373734] text-gray-400 ${(hasLinkedRefund && !isLastInRefundGroup) ? '' : 'border-b'}`}>
                                {formatDate(t.date)}
                              </td>
                              <td className={`px-6 py-4 border-r border-[#373734] ${(hasLinkedRefund && !isLastInRefundGroup) ? '' : 'border-b'}`}>
                                <div className="flex items-center justify-center">
                                  <InvoiceTag
                                    transaction={t}
                                    summary={invoiceSummary}
                                    onUpdate={onUpdate}
                                    closingDay={invoiceSummary.closingDay}
                                  />
                                </div>
                              </td>

                              <td className={`px-6 py-4 font-medium border-r border-[#373734] text-gray-200 ${(hasLinkedRefund && !isLastInRefundGroup) ? '' : 'border-b'}`}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isAdjustment && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 shrink-0">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                      </svg>
                                    )}
                                    {isLinkedRefund && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
                                    )}
                                    {isCharge && (
                                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                                    )}
                                    {isPayment && (
                                      <Check size={14} className={isLate ? 'text-amber-400 shrink-0' : 'text-emerald-400 shrink-0'} />
                                    )}
                                    <span className={`${isAdjustment ? 'text-purple-300' : isCharge ? 'text-red-300' : isPayment ? (isLate ? 'text-amber-300' : 'text-emerald-300') : ''} ${isLinkedRefund ? 'pl-6' : ''}`}>
                                      {t.description}
                                    </span>
                                    {isAdjustment && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                        title="Lançamentos que ainda não apareceram na sincronização. Este valor completa a fatura baseado no limite usado do cartão."
                                      >
                                        Ajuste
                                      </span>
                                    )}
                                    {hasAppliedRefund && (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-medium tracking-wide bg-yellow-500/15 text-yellow-400/80 border border-yellow-500/25">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
                                          Reembolso
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdate({ id: t.id, _refundAmount: null } as any);
                                            toast.success('Reembolso removido!');
                                          }}
                                          className="inline-flex items-center justify-center p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                          title="Remover reembolso"
                                        >
                                          <X size={12} />
                                        </button>
                                      </span>
                                    )}

                                    {isSyntheticRefund && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-medium tracking-wide bg-yellow-500/15 text-yellow-400/80 border border-yellow-500/25">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
                                        Estorno
                                      </span>
                                    )}
                                    {/* Badge clicável para sugerir estorno (Mesmo em projetadas) */}
                                    {mightBeRefund && (
                                      <button
                                        onClick={() => {
                                          onUpdate({ id: t.id, _refundAmount: Math.abs(t.amount) } as any);
                                          toast.success("Reembolso aplicado!");
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer animate-pulse"
                                        title="O sistema detectou que isso pode ser um estorno. Clique para confirmar."
                                      >
                                        <CornerUpLeft size={10} /> Confirmar Estorno?
                                      </button>
                                    )}
                                    {isCharge && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-red-500/10 text-red-400 border border-red-500/20"
                                        title="Encargo financeiro cobrado pelo banco"
                                      >
                                        Encargo
                                      </span>
                                    )}
                                    {isPayment && !isLate && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        title="Pagamento da fatura realizado no prazo"
                                      >
                                        <Check size={10} /> Pago no prazo
                                      </span>
                                    )}
                                    {isPayment && isLate && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        title={`Pagamento com ${daysLate} dia(s) de atraso - pode haver encargos do banco`}
                                      >
                                        <AlertCircle size={10} /> {daysLate} dia{daysLate > 1 ? 's' : ''} atrasado
                                      </span>
                                    )}
                                    {(t as any).isEstimated && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        title="Valor estimado baseado na parcela anterior. Aguardando confirmação da fatura real."
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10" />
                                          <path d="M12 16v-4" />
                                          <path d="M12 8h.01" />
                                        </svg>
                                        Estimado
                                      </span>
                                    )}
                                    {isIOF && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                        title="IOF - Imposto sobre Operações Financeiras para compras internacionais"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" />
                                          <path d="M12 6v6l4 2" />
                                        </svg>
                                        IOF
                                      </span>
                                    )}
                                    {isPaired && (
                                      null
                                    )}
                                  </div>
                                  {(t as any).totalInstallments > 1 && (
                                    <span className="text-[10px] text-gray-500 font-mono">
                                      Parcela {(t as any).installmentNumber || 1}/{(t as any).totalInstallments}
                                    </span>
                                  )}
                                  {isPayment && isLate && (
                                    <span className="text-[9px] text-amber-500 font-medium">
                                      Possíveis encargos de juros/multa serão cobrados pelo banco
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 border-r border-[#373734] text-gray-400">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg border ${isAdjustment ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : isCharge ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : isPayment ? (isLate ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                                        : 'bg-[#1a1a19] text-gray-500 border-[#373734]'
                                    }`}>
                                    {isAdjustment ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                      </svg>
                                    ) : isCharge ? <AlertCircle size={14} /> : isPayment ? <CreditCard size={14} /> : getCategoryIcon(translateCategory(t.category), 14)}
                                  </div>
                                  <span className={`text-xs ${isAdjustment ? 'text-purple-400' : isCharge ? 'text-red-400' : isPayment ? (isLate ? 'text-amber-400' : 'text-emerald-400') : ''}`}>
                                    {isAdjustment ? 'Ajuste Automático' : isCharge ? 'Encargos Financeiros' : isPayment ? 'Pagamento Fatura' : translateCategory(t.category)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right border-r border-[#373734]">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className={`font-bold font-mono ${isAdjustment ? 'text-purple-400'
                                    : isCharge ? 'text-red-400'
                                      : isPayment ? (isLate ? 'text-amber-400' : 'text-emerald-400')
                                        : t.type === 'income' ? 'text-emerald-400' : 'text-gray-200'
                                    }`}>
                                    {(t.type === 'income' ? '+' : '-')} {formatCurrency(displayAmount)}
                                  </span>
                                  {/* Sinalizador de moeda estrangeira (USD, EUR, etc.) */}
                                  {isInternational && (
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        title={`Cobrança internacional em ${txCurrencyCode}. Valor original: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: txCurrencyCode || 'USD' }).format(Math.abs(txAmountOriginal))}`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                          <path d="M19 5a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3zm-7 4a3 3 0 0 0 -2.996 2.85l-.004 .15a3 3 0 1 0 3 -3m6.01 2h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2m-12 0h-.01a1 1 0 1 0 .01 2a1 1 0 0 0 0 -2" />
                                        </svg>
                                        {txCurrencyCode}
                                        <span className="text-blue-300 font-mono">
                                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: txCurrencyCode || 'USD' }).format(Math.abs(txAmountOriginal))}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 text-center border-r border-[#373734]">
                                {isAdjustment ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-purple-500/15 text-purple-400">
                                    Estimado
                                  </span>
                                ) : isCharge ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-red-500/15 text-red-400">
                                    Cobrado
                                  </span>
                                ) : isPayment ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${isLate ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                                    }`}>
                                    {isLate ? 'Atrasado' : 'No prazo'}
                                  </span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${t.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-400'
                                    }`}>
                                    {t.status === 'completed' ? 'Pago' : 'Pendente'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {!!onAdd && !isAdjustment && !isCharge && !isPayment && !isProjected && !isSyntheticRefund && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openRefundModal(t);
                                      }}
                                      disabled={isPaired || hasLinkedRefund}
                                      className="p-2 rounded-xl text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                      title={hasLinkedRefund ? "Transação já estornada" : "Estornar"}
                                    >
                                      <RotateCcw size={16} />
                                    </button>
                                  )}
                                  {/* Ações Diretas para Cartão Manual (Editar/Excluir) */}
                                  {(isManualMode || creditCardAccounts.find(c => c.id === (t.cardId || t.accountId))?.connectionMode === 'MANUAL') && !isAdjustment && !isCharge && !isPayment && !isProjected && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditTransaction(t);
                                          setIsEditModalOpen(true);
                                        }}
                                        className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#373734] transition-colors"
                                        title="Editar"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                    </>
                                  )}



                                  {/* Botão Ver JSON (Debug - Apenas Admin) */}
                                  {isAdmin && (
                                    <button
                                      onClick={() => setJsonModalData(t)}
                                      className="p-2 rounded-xl text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors opacity-50 hover:opacity-100"
                                      title="Ver dados brutos (JSON)"
                                    >
                                      <Code size={16} />
                                    </button>
                                  )}
                                  {/* Botão Excluir (Usuários também) */}
                                  {canDelete && (
                                    <button
                                      onClick={() => setDeleteId(t.id)}
                                      className={`p-2 rounded-xl transition-colors ${isAdmin ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-50 hover:opacity-100' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'}`}
                                      title={isAdmin ? 'Excluir transação (Admin)' : 'Excluir'}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {transactionsWithCharges.length === 0 && (
                          <tr className="h-full">
                            <td colSpan={8} className="p-4 h-full">
                              <EmptyState
                                title="Nenhum lançamento de cartão encontrado"
                                description="Seus gastos com cartão aparecerão aqui."
                                className="!border-0 !bg-transparent !shadow-none"
                                minHeight="h-full"
                              />
                            </td>
                          </tr>
                        )}
                      </motion.tbody>
                    </table>
                  </div>



                  {/* Footer Summary */}
                  <div className="bg-[#333432] border-t border-[#373734] px-6 py-3 text-xs text-gray-400 flex flex-col sm:flex-row justify-between gap-3 font-medium uppercase tracking-wide">
                    <div className="flex items-center gap-4">
                      <span className="text-[#d97757]">
                        {selectedInvoice === 'all' ? 'Histórico Completo' : selectedInvoice === 'last' ? 'Última Fatura' : selectedInvoice === 'current' ? 'Fatura Atual' : 'Próxima Fatura'}
                      </span>
                      <span>• {transactionsWithCharges.length} lançamentos</span>
                      {chargeTransactions.length > 0 && (
                        <span className="text-red-400">({chargeTransactions.length} encargo{chargeTransactions.length > 1 ? 's' : ''})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Total:</span>
                      <span className="font-mono font-bold text-sm text-[#d97757]">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )
          }



          {/* Delete Confirmation */}
          <ConfirmationBar
            isOpen={!!deleteId}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => {
              if (deleteId) {
                onDelete(deleteId);
                setDeleteId(null);
              }
            }}
            label="Remover Transação?"
            confirmText="Sim, excluir"
            cancelText="Cancelar"
            isDestructive={true}
          />

          {/* Edit Transaction Modal */}
          {
            editTransaction && (
              <UniversalModal
                isOpen={isEditModalOpen}
                onClose={handleCloseEdit}
                title="Editar Lançamento"
                icon={<Edit2 size={18} />}
                themeColor={editTransaction.type === 'income' ? '#10b981' : '#d97757'}
                footer={
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={handleSaveEdit}
                    >
                      Salvar
                    </Button>
                  </div>
                }
              >
                <div className="space-y-5">


                  {/* Descrição */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                      <input
                        type="text"
                        value={editTransaction.description}
                        onChange={(e) => setEditTransaction({ ...editTransaction, description: e.target.value })}
                        className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                        placeholder="Ex: Compra Online"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Valor */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editTransaction.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(editTransaction.amount) : ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            const numberValue = Number(value) / 100;
                            setEditTransaction({ ...editTransaction, amount: numberValue });
                          }}
                          className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                          placeholder="R$ 0,00"
                        />
                        <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                      </div>
                    </div>

                    {/* Data */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
                      <CustomDatePicker
                        value={editTransaction.date || ''}
                        onChange={(val) => setEditTransaction({ ...editTransaction, date: val })}
                        useNativeOnMobile={true}
                      />
                    </div>
                  </div>

                  {/* Categoria e Parcelas */}
                  {isManualMode && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                        <CustomAutocomplete
                          value={editTransaction.category || ''}
                          onChange={(val) => setEditTransaction({ ...editTransaction, category: val })}
                          options={CATEGORIES}
                          icon={<Tag size={16} />}
                          placeholder="Selecione ou digite..."
                          portal={true}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between h-[17px] mb-1.5">
                          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Parcelado?</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editTransaction.totalInstallments || 1) > 1}
                              onChange={(e) => setEditTransaction({
                                ...editTransaction,
                                totalInstallments: e.target.checked ? 2 : 1
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#d97757]"></div>
                          </label>
                        </div>
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${(editTransaction.totalInstallments || 1) > 1 ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
                            }`}
                        >
                          <div className="relative">
                            <input
                              type="number"
                              min="2"
                              max="99"
                              value={editTransaction.totalInstallments || 2}
                              onChange={(e) => setEditTransaction({ ...editTransaction, totalInstallments: parseInt(e.target.value) || 2 })}
                              className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-4 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Toggle com Smooth - Apenas Modo Manual */}
                  {isManualMode && (
                    <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
                      <div className="flex items-center gap-2.5">
                        {editTransaction.status === 'completed'
                          ? <Check size={16} className="text-emerald-500" />
                          : <AlertCircle size={16} className="text-amber-500" />
                        }
                        <div>
                          <span className="block text-sm font-medium text-gray-300">Status</span>
                          <span className="block text-[10px] text-gray-500">
                            {editTransaction.status === 'completed' ? 'Pago / Recebido' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 w-48">
                        <div
                          className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out
                            ${editTransaction.status === 'pending' ? 'left-0.5 bg-amber-500/20' : 'left-1/2 bg-emerald-500/20'}
                          `}
                        />
                        <button
                          type="button"
                          onClick={() => setEditTransaction({ ...editTransaction, status: 'pending' })}
                          className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                          PENDENTE
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTransaction({ ...editTransaction, status: 'completed' })}
                          className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                          PAGO
                        </button>
                      </div>
                    </div>
                  )}


                </div>
              </UniversalModal>
            )
          }



          {/* Card Settings Modal */}
          <UniversalModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            title={`Configuração do ${selectedCard?.name || selectedCard?.institution || "Cartão"}`}
            icon={<Settings size={18} />}
            themeColor="#d97757"
            banner={
              <div className="bg-blue-500/10 border-b border-blue-500/10 px-6 py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-blue-300/80">
                  <AlertCircle size={14} className="text-blue-400 shrink-0" />
                  <span>
                    <strong className="text-blue-400 font-semibold">Funcionalidade em Beta:</strong> Pode haver inconsistências ao alterar as datas manualmente.
                  </span>
                </div>
                <a href="#" className="text-[10px] font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap flex items-center gap-1 transition-colors">
                  Reportar problema <ChevronRight size={10} />
                </a>
              </div>
            }
            footer={
              <div className="flex gap-3">
                <Button
                  variant="dark"
                  size="lg"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 text-gray-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={async () => {
                    if (selectedCard && onUpdateAccount) {
                      await onUpdateAccount(selectedCard.id, {
                        closingDay: cardSettings.closingDay,
                        dueDay: cardSettings.dueDay,
                        manualBeforeLastClosingDate: cardSettings.manualBeforeLastClosingDate,
                        manualLastClosingDate: cardSettings.manualLastClosingDate,
                        manualCurrentClosingDate: cardSettings.manualCurrentClosingDate
                      });
                      toast.success("Configurações do cartão atualizadas!");
                      setIsSettingsModalOpen(false);
                    }
                  }}
                  className="flex-[2]"
                >
                  Salvar
                </Button>
              </div>
            }
          >
            <div className="space-y-5">
              <div className="space-y-4">


                <div className="p-3 bg-gray-900/50 rounded-xl border border-gray-800/60">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">
                        Fechamento Fatura Retrasada (Define início da Anterior)
                      </label>
                      <CustomDatePicker
                        value={cardSettings.manualBeforeLastClosingDate || ''}
                        onChange={(val) => setCardSettings({ ...cardSettings, manualBeforeLastClosingDate: val })}
                        placeholder="Data de fechamento"
                        dropdownMode="fixed"
                        useNativeOnMobile={true}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">
                          Fechamento Fatura Anterior
                        </label>
                        <CustomDatePicker
                          value={cardSettings.manualLastClosingDate || ''}
                          onChange={(val) => setCardSettings({ ...cardSettings, manualLastClosingDate: val })}
                          placeholder="Data de fechamento"
                          dropdownMode="fixed"
                          useNativeOnMobile={true}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">
                          Fechamento Fatura Atual
                        </label>
                        <CustomDatePicker
                          value={cardSettings.manualCurrentClosingDate || ''}
                          onChange={(val) => setCardSettings({ ...cardSettings, manualCurrentClosingDate: val })}
                          placeholder="Data de fechamento"
                          dropdownMode="fixed"
                          useNativeOnMobile={true}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    Preencher as datas específicas sobrescreve o cálculo automático.
                  </p>
                </div>
              </div>
            </div>
          </UniversalModal>

          <UniversalModal
            isOpen={isRefundModalOpen}
            onClose={closeRefundModal}
            title="Estornar Transação"
            icon={<RotateCcw size={18} />}
            themeColor="#10b981"
            footer={
              <div className="flex w-full">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleConfirmRefund}
                  disabled={!refundSourceTransaction || refundAmountToCreate <= 0 || refundAmountToCreate > refundMaxAmount}
                >
                  Confirmar Estorno
                </Button>
              </div>
            }
          >
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-gray-900/40 border border-gray-800/60">
                <div className="text-xs text-gray-400">Transação</div>
                <div className="text-sm text-white font-semibold mt-1">{refundSourceTransaction?.description || '-'}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                  <span>{refundSourceTransaction ? formatDate(refundSourceTransaction.date) : '-'}</span>
                  <span className="font-mono">{refundSourceTransaction ? formatCurrency(Math.abs(refundSourceTransaction.amount)) : '-'}</span>
                </div>
              </div>

              <div className="bg-gray-900/30 border border-gray-800/60 rounded-2xl p-1 flex gap-1 relative overflow-hidden">
                <motion.div
                  className="absolute top-1 bottom-1 w-1/2 rounded-xl bg-emerald-500/15 border border-emerald-500/20"
                  animate={{ left: refundTab === 'total' ? '0%' : '50%' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setRefundTab('total');
                    setRefundCustomAmount(refundMaxAmount);
                  }}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors relative z-10 ${refundTab === 'total'
                    ? 'text-emerald-300'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  Valor Total
                </button>
                <button
                  type="button"
                  onClick={() => setRefundTab('custom')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors relative z-10 ${refundTab === 'custom'
                    ? 'text-emerald-300'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  Valor Personalizado
                </button>
              </div>

              {refundTab === 'custom' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor do estorno (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <CurrencyInput
                      value={refundCustomAmount}
                      onValueChange={(val) => setRefundCustomAmount(val)}
                      placeholder="0,00"
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                    />
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Máximo: <span className="font-mono">{formatCurrency(refundMaxAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </UniversalModal>

          {/* Add Manual Transaction Modal */}
          <UniversalModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            title="Lançar Compra Manual"
            icon={<CreditCard size={18} />}
            themeColor="#d97757"
            footer={
              <div className="flex gap-3 w-full">
                <Button variant="primary" size="lg" className="w-full" onClick={handleAddTransaction}>Adicionar</Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <input
                    type="text"
                    value={newTransaction.description || ''}
                    onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="Ex: Almoço, Netflix..."
                    className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newTransaction.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(newTransaction.amount) : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const numberValue = Number(value) / 100;
                        setNewTransaction({ ...newTransaction, amount: numberValue });
                      }}
                      placeholder="R$ 0,00"
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                    />
                    <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
                  <CustomDatePicker
                    value={newTransaction.date || ''}
                    onChange={val => setNewTransaction({ ...newTransaction, date: val })}
                    placeholder="Data da compra"
                    dropdownMode="fixed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                  <CustomSelect
                    value={newTransaction.category || 'Outros'}
                    onChange={val => setNewTransaction({ ...newTransaction, category: val })}
                    options={availableCategories.map(cat => ({ value: cat, label: translateCategory(cat) }))}
                    placeholder="Selecione"
                    portal={true}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between h-[17px] mb-1.5">
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Parcelado?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(newTransaction.totalInstallments || 1) > 1}
                      onChange={(e) => setNewTransaction({
                        ...newTransaction,
                        totalInstallments: e.target.checked ? 2 : 1
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#d97757]"></div>
                  </label>
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${(newTransaction.totalInstallments || 1) > 1 ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
                    }`}
                >
                  <div className="relative">
                    <input
                      type="number"
                      min="2"
                      max="99"
                      value={newTransaction.totalInstallments || 2}
                      onChange={(e) => setNewTransaction({ ...newTransaction, totalInstallments: parseInt(e.target.value) || 2 })}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-4 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                  </div>
                </div>
              </div>
            </div>
          </UniversalModal>



          {/* Mobile Filters Modal */}
          <UniversalModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Filtrar Faturas"
            icon={<Filter size={18} />}
            themeColor="#d97757"
            footer={
              <div className="flex gap-3">
                <Button
                  variant="dark"
                  size="lg"
                  className="flex-1 text-gray-400 hover:text-white"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedYear(new Date().getFullYear());
                    setSelectedCategory('all');
                    setIsFilterModalOpen(false);
                  }}
                >
                  <X size={16} className="mr-2" />
                  Limpar
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-[2]"
                  onClick={() => setIsFilterModalOpen(false)}
                >
                  <Check size={16} className="mr-2" />
                  Ver Resultados
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                <CustomSelect
                  value={selectedCategory}
                  onChange={(val) => setSelectedCategory(val)}
                  options={[
                    { value: 'all', label: 'Todas as Categorias' },
                    ...availableCategories.map(cat => ({ value: cat, label: translateCategory(cat) }))
                  ]}
                  placeholder="Todas as Categorias"
                />
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Início</label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Início"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fim</label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Fim"
                  />
                </div>
              </div>

              {/* Year Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ano</label>
                <CustomSelect
                  value={selectedYear}
                  onChange={(val) => setSelectedYear(Number(val))}
                  options={yearOptions}
                  placeholder="Selecione o Ano"
                />
              </div>
            </div>
          </UniversalModal>

          {/* Modal de visualização do JSON bruto da transação */}
          <UniversalModal
            isOpen={!!jsonModalData}
            onClose={() => setJsonModalData(null)}
            title="Dados Brutos da Transação"
            width="max-w-3xl"
          >
            {jsonModalData && (
              <div className="space-y-4">
                {/* Header com descrição */}
                <div className="flex items-center gap-3 p-3 bg-[#1a1a19] rounded-lg border border-[#373734]">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Code size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{jsonModalData.description}</p>
                    <p className="text-xs text-gray-500">
                      {jsonModalData.date} • {jsonModalData.id}
                    </p>
                  </div>
                </div>

                {/* Seção específica: creditCardMetadata (parcelamento) */}
                {(jsonModalData as any).pluggyRaw?.creditCardMetadata && (
                  <div className="p-4 bg-[#1a1a19] rounded-lg border border-cyan-500/30">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                      Credit Card Metadata (Parcelamento)
                    </h4>
                    <pre className="text-sm text-cyan-300 font-mono whitespace-pre-wrap break-all bg-[#0d0d0c] p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify((jsonModalData as any).pluggyRaw.creditCardMetadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Dados processados pelo sistema */}
                <div className="p-4 bg-[#1a1a19] rounded-lg border border-[#373734]">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                    Dados Processados (Sistema)
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Parcela:</span>
                      <span className="text-white font-mono">
                        {(jsonModalData as any).installmentNumber || 1} / {(jsonModalData as any).totalInstallments || 1}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <span className={`font-medium ${jsonModalData.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {jsonModalData.type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Categoria:</span>
                      <span className="text-white">{jsonModalData.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Moeda:</span>
                      <span className="text-white font-mono">{(jsonModalData as any).currencyCode || 'BRL'}</span>
                    </div>
                  </div>
                </div>

                {/* JSON completo do pluggyRaw */}
                <div className="p-4 bg-[#1a1a19] rounded-lg border border-[#373734]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      JSON Completo (pluggyRaw)
                    </h4>
                    <button
                      onClick={() => {
                        const text = JSON.stringify((jsonModalData as any).pluggyRaw || jsonModalData, null, 2);
                        navigator.clipboard.writeText(text);
                        toast.success('JSON copiado!');
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    >
                      <Copy size={12} />
                      Copiar
                    </button>
                  </div>
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-[#0d0d0c] p-3 rounded-lg overflow-auto max-h-80">
                    {JSON.stringify((jsonModalData as any).pluggyRaw || jsonModalData, null, 2)}
                  </pre>
                </div>

                {/* Botão fechar */}
                <div className="flex justify-end pt-2">
                  <Button variant="secondary" onClick={() => setJsonModalData(null)}>
                    <X size={16} className="mr-2" />
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </UniversalModal>




        </div >
      )
      }
    </div >
  );
};

export default CreditCardTable;
