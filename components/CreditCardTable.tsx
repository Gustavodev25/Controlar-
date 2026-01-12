import React, { useState, useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction, ConnectedAccount, FinanceCharges, InvoicePeriods, Invoice, InvoiceItem } from '../types';
import {
  Trash2, Search, Calendar, getCategoryIcon, X, Edit2, Check,
  ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, FileText, DollarSign, Tag, Filter, CreditCard, Copy, TrendingDown, TrendingUp, Settings, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Minus, HelpCircle, AlertTriangle
} from './Icons';
import { CustomAutocomplete, CustomDatePicker, CustomSelect } from './UIComponents';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { useToasts } from './Toast';
import { UniversalModal } from './UniversalModal';
import { Button } from './Button';


import { EmptyState } from './EmptyState';
import { getInvoiceMonthKey } from '../services/invoiceCalculator';
import {
  buildInvoices,
  formatMonthKey as formatMonthKeyBuilder,
  formatCurrency as formatCurrencyBuilder,
  isCreditCardPayment as isCreditCardPaymentBuilder,
  generateInvoiceForecast,
  calculateFutureLimitImpact,
  type InvoiceBuildResult
} from '../services/invoiceBuilder';
import { exportToCSV } from '../utils/export';
import { useCategoryTranslation } from '../hooks/useCategoryTranslation';

// ============================================================ 
// Helper: Calculate Invoice Logic (Extracted for Preview)
// ============================================================ 

// Mapeamento de meses
const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatMonthKey(monthKey: string): string {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${MONTH_NAMES[monthIndex]}/${year}`;
}

const calculateInvoiceSummary = (
  card: ConnectedAccount | undefined,
  transactions: Transaction[],
  selectedCardId: string
) => {
  const today = new Date();

  // ========================================
  // USAR DADOS DO BACKEND (invoicePeriods) SE DISPONÍVEIS
  // Fonte única de verdade - evita recálculo no frontend
  // ========================================
  const invoicePeriods = card?.invoicePeriods;
  const closingDay = invoicePeriods?.closingDay || card?.closingDay || 10;

  // Helper para converter string YYYY-MM-DD para Date
  const parseDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59);
  };

  // Helper para criar data de fechamento (fallback se não tiver invoicePeriods)
  const getClosingDate = (year: number, month: number, day: number): Date => {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayOfMonth);
    return new Date(year, month, safeDay, 23, 59, 59);
  };

  let currentClosingDate: Date;
  let lastClosingDate: Date;
  let nextClosingDate: Date;
  let beforeLastClosingDate: Date;

  // ========================================
  // PRIORIDADE 1: Usar invoicePeriods do backend
  // ========================================
  if (invoicePeriods) {
    console.log('[FRONTEND] Usando invoicePeriods do backend:', {
      cardName: card?.name || card?.institution,
      closingDay: invoicePeriods.closingDay,
      calculatedAt: invoicePeriods.calculatedAt
    });

    beforeLastClosingDate = parseDate(invoicePeriods.beforeLastClosingDate);
    lastClosingDate = parseDate(invoicePeriods.lastClosingDate);
    currentClosingDate = parseDate(invoicePeriods.currentClosingDate);
    nextClosingDate = parseDate(invoicePeriods.nextClosingDate);

    // ========================================
    // PRIORIDADE 2: Modo manual (datas específicas definidas pelo usuário)
    // ========================================
  } else if (card?.manualLastClosingDate && card?.manualCurrentClosingDate) {
    console.log('[FRONTEND] Usando modo MANUAL (datas específicas)');

    const [ly, lm, ld] = card.manualLastClosingDate.split('-').map(Number);
    lastClosingDate = new Date(ly, lm - 1, ld, 23, 59, 59);

    const [cy, cm, cd] = card.manualCurrentClosingDate.split('-').map(Number);
    currentClosingDate = new Date(cy, cm - 1, cd, 23, 59, 59);

    // Inferir Próxima (Current + 1 mês)
    nextClosingDate = new Date(currentClosingDate);
    nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
    const nextMonthLastDay = new Date(nextClosingDate.getFullYear(), nextClosingDate.getMonth() + 1, 0).getDate();
    if (currentClosingDate.getDate() > nextMonthLastDay) {
      nextClosingDate.setDate(nextMonthLastDay);
    }

    // Inferir Anterior à Última (Last - 1 mês)
    beforeLastClosingDate = new Date(lastClosingDate);
    beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);
    const prevMonthLastDay = new Date(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth() + 1, 0).getDate();
    if (lastClosingDate.getDate() > prevMonthLastDay) {
      beforeLastClosingDate.setDate(prevMonthLastDay);
    }

    // ========================================
    // PRIORIDADE 3: Cálculo automático (fallback - compatibilidade)
    // ========================================
  } else {
    console.log('[FRONTEND] Usando cálculo AUTOMÁTICO (fallback):', { closingDay });

    if (today.getDate() <= closingDay) {
      currentClosingDate = getClosingDate(today.getFullYear(), today.getMonth(), closingDay);
    } else {
      const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
      const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
      currentClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
    }

    const lastClosingMonth = currentClosingDate.getMonth() === 0 ? 11 : currentClosingDate.getMonth() - 1;
    const lastClosingYear = currentClosingDate.getMonth() === 0 ? currentClosingDate.getFullYear() - 1 : currentClosingDate.getFullYear();
    lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

    const nextClosingMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
    const nextClosingYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
    nextClosingDate = getClosingDate(nextClosingYear, nextClosingMonth, closingDay);

    const beforeLastClosingMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
    const beforeLastClosingYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
    beforeLastClosingDate = getClosingDate(beforeLastClosingYear, beforeLastClosingMonth, closingDay);
  }

  const cardTransactions = selectedCardId === 'all'
    ? transactions
    : transactions.filter(t => {
      const txCardId = t.cardId ? String(t.cardId) : '';
      const txAccountId = t.accountId ? String(t.accountId) : '';
      return txCardId === selectedCardId || txAccountId === selectedCardId;
    });

  const lastInvoiceStart = new Date(beforeLastClosingDate);
  lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);
  lastInvoiceStart.setHours(0, 0, 0, 0);

  const currentInvoiceStart = new Date(lastClosingDate);
  currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);
  currentInvoiceStart.setHours(0, 0, 0, 0);

  const nextInvoiceStart = new Date(currentClosingDate);
  nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);
  nextInvoiceStart.setHours(0, 0, 0, 0);

  // DEBUG: Mostrar períodos de fatura calculados
  console.log('[PERIODOS DEBUG]', {
    cardName: card?.name || card?.institution,
    closingDay,
    lastInvoice: {
      start: lastInvoiceStart.toLocaleDateString('pt-BR'),
      end: lastClosingDate.toLocaleDateString('pt-BR')
    },
    currentInvoice: {
      start: currentInvoiceStart.toLocaleDateString('pt-BR'),
      end: currentClosingDate.toLocaleDateString('pt-BR')
    },
    nextInvoice: {
      start: nextInvoiceStart.toLocaleDateString('pt-BR'),
      end: nextClosingDate.toLocaleDateString('pt-BR')
    },
    totalTransactions: cardTransactions.length,
    sampleTxDates: cardTransactions.slice(0, 5).map(t => t.date)
  });

  let lastInvoiceTotal = 0;
  let currentInvoiceTotal = 0;
  let nextInvoiceTotal = 0;
  let allFutureTotal = 0;
  const lastInvoiceTransactions: Transaction[] = [];
  const currentInvoiceTransactions: Transaction[] = [];
  const nextInvoiceTransactions: Transaction[] = [];
  let totalUsed = 0;

  const installmentSeries: Record<string, { firstInstDate: Date; transactions: Transaction[] }> = {};
  const nonInstallmentTxs: Transaction[] = [];
  const processedInstallmentIds = new Set<string>();

  const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
    const match = desc.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      return { current: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
  };

  const normalizeDescription = (desc: string) => {
    return desc
      .trim()
      .toLowerCase()
      .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
      .replace(/\s*\d+\/\d+\s*/g, '')
      .replace(/\s*parcela\s*\d+\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isTxCreditCardPayment = (tx: Transaction) => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();
    return (
      c.includes('credit card payment') ||
      c === 'pagamento de fatura' ||
      d.includes('pagamento de fatura') ||
      d.includes('pagamento fatura') ||
      d.includes('pagamento recebido') ||
      d.includes('credit card payment') ||
      d.includes('pag fatura') ||
      d.includes('pgto fatura') ||
      d === 'pgto' ||
      (tx.type === 'income' && tx.accountType === 'CREDIT_CARD')
    );
  };

  const paymentTransactions: Transaction[] = [];

  cardTransactions.forEach(tx => {
    if (!tx.date) return;

    if (isTxCreditCardPayment(tx)) {
      paymentTransactions.push(tx);
      return;
    }

    const descInstallment = extractInstallmentFromDesc(tx.description || '');
    // Se não tiver número da parcela, assume que é a 1ª (para projeção correta)
    const installmentNumber = tx.installmentNumber || descInstallment?.current || 1;
    // Compatibilidade: dados antigos usam 'installments', novos usam 'totalInstallments'
    const totalInstallments = tx.totalInstallments || (tx as any).installments || descInstallment?.total || 0;

    if (totalInstallments > 1) {
      const normalizedDesc = normalizeDescription(tx.description || '');
      const cardIdentifier = tx.cardId || tx.accountId || 'unknown';
      const seriesKey = `${cardIdentifier}-${normalizedDesc}-${totalInstallments}`;

      if (!installmentSeries[seriesKey]) {
        installmentSeries[seriesKey] = { firstInstDate: new Date(9999, 0, 1), transactions: [] };
      }

      const txWithInstallment = {
        ...tx,
        installmentNumber: installmentNumber,
        totalInstallments: totalInstallments
      };
      installmentSeries[seriesKey].transactions.push(txWithInstallment);

      const [ty, tm, td] = (tx.date || '').split('-').map(Number);
      const txDate = new Date(ty, tm - 1, td, 12, 0, 0);

      if (installmentNumber === 1) {
        installmentSeries[seriesKey].firstInstDate = txDate;
      } else if (installmentSeries[seriesKey].firstInstDate.getFullYear() === 9999) {
        const firstInstDate = new Date(txDate);
        firstInstDate.setMonth(firstInstDate.getMonth() - (installmentNumber - 1));
        installmentSeries[seriesKey].firstInstDate = firstInstDate;
      }
    } else {
      nonInstallmentTxs.push(tx);
    }
  });

  nonInstallmentTxs.forEach(tx => {
    const amt = Math.abs(Number(tx.amount) || 0);
    // TOTAL BRUTO: apenas despesas, income não subtrai
    const grossAmt = tx.type === 'expense' ? amt : 0;

    const [ty, tm, td] = (tx.date || '').split('-').map(Number);
    const txDate = new Date(ty, tm - 1, td, 12, 0, 0);

    totalUsed += grossAmt;

    if (txDate >= lastInvoiceStart && txDate <= lastClosingDate) {
      lastInvoiceTotal += grossAmt;
      lastInvoiceTransactions.push(tx);
    } else if (txDate >= currentInvoiceStart && txDate <= currentClosingDate) {
      currentInvoiceTotal += grossAmt;
      currentInvoiceTransactions.push(tx);
    } else if (txDate >= nextInvoiceStart && txDate <= nextClosingDate) {
      nextInvoiceTotal += grossAmt;
      nextInvoiceTransactions.push(tx);
    }

    // Calcular Total Futuro (Tudo após a fatura atual)
    if (txDate > currentClosingDate) {
      allFutureTotal += grossAmt;
    }
  });

  const dateToNumber = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
  const lastInvoiceStartNum = dateToNumber(lastInvoiceStart);
  const lastClosingDateNum = dateToNumber(lastClosingDate);
  const currentInvoiceStartNum = dateToNumber(currentInvoiceStart);
  const currentClosingDateNum = dateToNumber(currentClosingDate);
  const nextInvoiceStartNum = dateToNumber(nextInvoiceStart);
  const nextClosingDateNum = dateToNumber(nextClosingDate);

  // DEBUG: Log parcelas detectadas
  console.log('[PARCELAS DEBUG]', {
    cardName: card?.name || card?.institution,
    totalSeries: Object.keys(installmentSeries).length,
    series: Object.entries(installmentSeries).map(([key, s]) => ({
      key,
      totalInst: s.transactions[0]?.totalInstallments || (s.transactions[0] as any)?.installments || 1,
      firstInstDate: s.firstInstDate.toLocaleDateString('pt-BR'),
      txCount: s.transactions.length,
      desc: s.transactions[0]?.description?.slice(0, 30)
    }))
  });

  Object.values(installmentSeries).forEach(series => {
    const { firstInstDate, transactions } = series;
    // Compatibilidade: dados antigos usam 'installments', novos usam 'totalInstallments'
    const totalInst = transactions[0]?.totalInstallments || (transactions[0] as any)?.installments || 1;
    const amt = Math.abs(Number(transactions[0]?.amount) || 0);
    // TOTAL BRUTO: parcelas são sempre despesas (valor absoluto)
    const grossAmt = amt;

    for (let instNum = 1; instNum <= totalInst; instNum++) {
      const instDate = new Date(firstInstDate);
      instDate.setMonth(instDate.getMonth() + (instNum - 1));
      const instDateNum = dateToNumber(instDate);

      const existingTx = transactions.find(tx => (tx.installmentNumber || 1) === instNum);

      let txToAdd: Transaction;
      if (existingTx) {
        txToAdd = existingTx;
        processedInstallmentIds.add(existingTx.id);
      } else {
        const baseTx = transactions[0];
        txToAdd = {
          ...baseTx,
          id: `proj_${baseTx.id}_${instNum}`,
          date: instDate.toISOString().split('T')[0],
          installmentNumber: instNum,
          isProjected: true
        };
      }

      totalUsed += grossAmt;

      if (instDateNum >= lastInvoiceStartNum && instDateNum <= lastClosingDateNum) {
        lastInvoiceTotal += grossAmt;
        lastInvoiceTransactions.push(txToAdd);
      } else if (instDateNum >= currentInvoiceStartNum && instDateNum <= currentClosingDateNum) {
        currentInvoiceTotal += grossAmt;
        currentInvoiceTransactions.push(txToAdd);
      } else if (instDateNum >= nextInvoiceStartNum && instDateNum <= nextClosingDateNum) {
        nextInvoiceTotal += grossAmt;
        nextInvoiceTransactions.push(txToAdd);
      }

      // Calcular Total Futuro (Tudo após a fatura atual)
      if (instDate > currentClosingDate) {
        allFutureTotal += grossAmt;
      }
    }
  });

  // Usar dueDay do backend se disponível
  const dueDayFromPluggy = invoicePeriods?.dueDay ||
    (card?.currentBill?.dueDate ? new Date(card.currentBill.dueDate).getDate() : null) ||
    card?.dueDay || 10;

  // Usar due dates do backend se disponíveis, senão calcular
  let lastDueDate: Date;
  let currentDueDate: Date;
  let nextDueDateCalc: Date;

  if (invoicePeriods?.lastInvoice?.dueDate) {
    lastDueDate = parseDate(invoicePeriods.lastInvoice.dueDate);
    currentDueDate = parseDate(invoicePeriods.currentInvoice.dueDate);
    nextDueDateCalc = parseDate(invoicePeriods.nextInvoice.dueDate);
  } else {
    const lastDueMonth = lastClosingDate.getMonth() === 11 ? 0 : lastClosingDate.getMonth() + 1;
    const lastDueYear = lastClosingDate.getMonth() === 11 ? lastClosingDate.getFullYear() + 1 : lastClosingDate.getFullYear();
    lastDueDate = new Date(lastDueYear, lastDueMonth, dueDayFromPluggy);

    const currentDueMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
    const currentDueYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
    currentDueDate = new Date(currentDueYear, currentDueMonth, dueDayFromPluggy);

    const nextDueMonth = nextClosingDate.getMonth() === 11 ? 0 : nextClosingDate.getMonth() + 1;
    const nextDueYear = nextClosingDate.getMonth() === 11 ? nextClosingDate.getFullYear() + 1 : nextClosingDate.getFullYear();
    nextDueDateCalc = new Date(nextDueYear, nextDueMonth, dueDayFromPluggy);
  }

  // Usar monthKeys do backend se disponíveis
  const lastMonthKey = invoicePeriods?.lastInvoice?.monthKey ||
    `${lastClosingDate.getFullYear()}-${String(lastClosingDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthKey = invoicePeriods?.currentInvoice?.monthKey ||
    `${currentClosingDate.getFullYear()}-${String(currentClosingDate.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthKey = invoicePeriods?.nextInvoice?.monthKey ||
    `${nextClosingDate.getFullYear()}-${String(nextClosingDate.getMonth() + 1).padStart(2, '0')}`;

  // ============================================================
  // Processa pagamentos (associa à fatura que está sendo quitada)
  // ============================================================
  // REGRA: Um pagamento feito durante o período da fatura ATUAL
  // está quitando a fatura FECHADA (anterior).
  // Para cada fatura, mostramos apenas o pagamento que a quita.
  // ============================================================

  // Encontrar o pagamento que quita a fatura FECHADA
  // (pagamento feito durante o período da fatura ATUAL)
  const paymentForClosedInvoice = paymentTransactions.find(tx => {
    if (!tx.date) return false;
    const [py, pm, pd] = (tx.date || '').split('-').map(Number);
    const paymentDate = new Date(py, pm - 1, pd);
    const paymentDateNum = paymentDate.getFullYear() * 10000 + (paymentDate.getMonth() + 1) * 100 + paymentDate.getDate();
    const currentStartNum = currentInvoiceStart.getFullYear() * 10000 + (currentInvoiceStart.getMonth() + 1) * 100 + currentInvoiceStart.getDate();
    const currentEndNum = currentClosingDate.getFullYear() * 10000 + (currentClosingDate.getMonth() + 1) * 100 + currentClosingDate.getDate();
    return paymentDateNum >= currentStartNum && paymentDateNum <= currentEndNum;
  });

  if (paymentForClosedInvoice) {
    // NÃO subtraimos o pagamento do total - mostramos apenas para referência
    // lastInvoiceTotal permanece como total BRUTO da fatura

    const [py, pm, pd] = (paymentForClosedInvoice.date || '').split('-').map(Number);
    const paymentDate = new Date(py, pm - 1, pd);
    const daysLate = Math.floor((paymentDate.getTime() - lastDueDate.getTime()) / (1000 * 60 * 60 * 24));

    lastInvoiceTransactions.push({
      ...paymentForClosedInvoice,
      isPayment: true,
      daysLate: daysLate > 0 ? daysLate : 0,
      isLate: daysLate > 0
    } as Transaction);
  }

  // ========================================
  // CÁLCULO DA FATURA ATUAL (SOMA PURA)
  // ========================================
  // Regra antiga removida: Fatura Atual = Limite Usado - Total Futuro - (Última Fatura se não paga)
  // Nova Regra: Fatura Atual = Soma das transações do período

  const usedCreditLimit = card?.usedCreditLimit || Math.abs(card?.balance || 0);
  const isLastInvoicePaid = card?.currentBill?.status === 'CLOSED';

  // Valor da última fatura (usa API se disponível, senão usa calculado)
  // Mantemos isso apenas para saber se foi paga ou não, mas não afeta a fatura atual
  const lastInvoiceValue = card?.currentBill?.totalAmount || lastInvoiceTotal;

  // Se não detectamos parcelas nas transações, usar as bills com state='FUTURE' para allFutureTotal
  // Isso é útil apenas para exibição do "Total Futuro", não afeta a fatura atual
  let finalAllFutureTotal = allFutureTotal;

  if (allFutureTotal === 0 && card?.bills && card.bills.length > 0) {
    const futureBillsTotal = card.bills
      .filter(bill => {
        if (bill.state === 'FUTURE') return true;
        if (bill.dueDate) {
          const billDue = new Date(bill.dueDate);
          return billDue > currentDueDate;
        }
        return false;
      })
      .reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);

    if (futureBillsTotal > 0) {
      finalAllFutureTotal = futureBillsTotal;
    }
  }

  // DEBUG SIMPLIFICADO
  console.log('[DEBUG] CÁLCULO DE FATURAS (FALLBACK) - SOMA DE TRANSAÇÕES', {
    lastInvoiceTotal,
    currentInvoiceTotal,
    nextInvoiceTotal,
    allFutureTotal,
    finalAllFutureTotal
  });

  return {
    closingDay,
    dueDay: dueDayFromPluggy,
    beforeLastClosingDate,
    lastClosingDate,
    currentClosingDate,
    nextClosingDate,
    lastInvoiceStart,
    lastInvoiceEnd: lastClosingDate,
    currentInvoiceStart,
    currentInvoiceEnd: currentClosingDate,
    nextInvoiceStart,
    nextInvoiceEnd: nextClosingDate,
    lastInvoice: { transactions: lastInvoiceTransactions, total: lastInvoiceTotal },
    currentInvoice: { transactions: currentInvoiceTransactions, total: currentInvoiceTotal }, // SOMA PURA
    nextInvoice: { transactions: nextInvoiceTransactions, total: nextInvoiceTotal },
    totalUsed,
    usedCreditLimit,
    isLastInvoicePaid,
    lastDueDate,
    currentDueDate,
    nextDueDate: nextDueDateCalc,
    lastMonthKey,
    currentMonthKey,
    nextMonthKey,
    allFutureTotal: finalAllFutureTotal
  };
};

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
    console.log('[DEBUG] useInvoiceBuilder chamado:', {
      hasCard: !!card,
      cardId,
      cardName: card?.name || card?.institution,
      transactionsCount: transactions.length,
      monthOffset
    });

    if (!card) {
      console.log('[DEBUG] useInvoiceBuilder retornando null - card undefined');
      return null;
    }

    const result = buildInvoices(card, transactions, cardId, monthOffset);

    console.log('[DEBUG] useInvoiceBuilder resultado:', {
      closedInvoiceTotal: result.closedInvoice.total,
      currentInvoiceTotal: result.currentInvoice.total,
      futureInvoicesCount: result.futureInvoices.length,
      allFutureTotal: result.allFutureTotal
    });

    // Converte InvoiceItems para formato Transaction para compatibilidade
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
        pluggyRaw: item.pluggyRaw
      }));
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
        nextMonthKey: result.futureInvoices[0]?.referenceMonth || ''
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
  onBulkUpdate
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

  const isManualModeActive = React.useMemo(() => {
    if (isManualMode && selectedCardId !== 'all') return true;
    const card = visibleCreditCardAccounts.find(acc => acc.id === selectedCardId);
    return card?.connectionMode === 'MANUAL';
  }, [isManualMode, visibleCreditCardAccounts, selectedCardId]);

  // Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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
    console.log('[DEBUG CreditCardTable]', {
      transactionsReceived: transactions.length,
      creditCardAccountsCount: creditCardAccounts.length,
      creditCardAccountsIds: creditCardAccounts.map(c => ({ id: c.id, name: c.name || c.institution })),
      selectedCardId,
      sampleTransactions: transactions.slice(0, 3).map(tx => ({ id: tx.id, date: tx.date, desc: tx.description?.slice(0, 30), accountId: tx.accountId, cardId: tx.cardId }))
    });
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

  // Card Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [cardSettings, setCardSettings] = useState<{ closingDay: number; manualLastClosingDate?: string; manualCurrentClosingDate?: string }>({ closingDay: 1 });

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

  const isCreditCardPayment = (tx: Transaction) => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();

    // categoria do Pluggy + descrições comuns de pagamento de fatura
    return (
      c.includes('credit card payment') ||
      c === 'pagamento de fatura' ||
      d.includes('pagamento de fatura') ||
      d.includes('pagamento fatura') ||
      d.includes('pagamento recebido') ||
      d.includes('credit card payment') ||
      d.includes('pag fatura') ||
      d.includes('pgto fatura') ||
      d === 'pgto' ||
      // Transações do tipo income em cartão de crédito geralmente são pagamentos
      (tx.type === 'income' && tx.accountType === 'CREDIT_CARD')
    );
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
        }

        return matchesYear && matchesSearch && matchesStartDate && matchesEndDate && matchesCard;
      })
      .sort((a, b) => {
        const aValue: any = (a as any)[sortField];
        const bValue: any = (b as any)[sortField];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, searchTerm, sortField, sortDirection, selectedYear, startDate, endDate, selectedCardId]);

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
        }

        return matchesCard;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
  }, [transactions, selectedCardId]);

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
    console.log('[DEBUG] invoiceSummary - Sistema escolhido:', {
      temInvoiceBuilderData: !!invoiceBuilderData,
      selectedCardId,
      selectedCardName: selectedCard?.name || selectedCard?.institution,
      transactionsCount: transactions.length
    });

    // Se temos dados do novo sistema, usa eles
    if (invoiceBuilderData) {
      const { closedInvoice, currentInvoice, futureInvoices, periods, allFutureTotal } = invoiceBuilderData;

      console.log('[DEBUG] USANDO INVOICEBUILDER:', {
        closedInvoiceTotal: closedInvoice.total,
        currentInvoiceTotal: currentInvoice.total,
        futureInvoicesCount: futureInvoices.length,
        allFutureTotal,
        closingDay: periods.closingDay
      });

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
          pluggyRaw: item.pluggyRaw
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
        nextMonthKey: nextInvoice?.referenceMonth || '',
        allFutureTotal,
        // Dados extras do novo sistema
        forecast: invoiceBuilderData.forecast,
        limitImpact: invoiceBuilderData.limitImpact
      };
    }

    // Fallback para o sistema antigo se não houver dados
    console.log('[DEBUG] USANDO FALLBACK calculateInvoiceSummary - invoiceBuilderData é null');
    return calculateInvoiceSummary(selectedCard, transactions, selectedCardId);
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

  // Calcular status da fatura baseado na API Pluggy
  const invoicePaymentInfo = useMemo(() => {
    // Status da API Pluggy: OPEN = aguardando pagamento, CLOSED = paga
    const billStatus = selectedCard?.currentBill?.status;

    // Última fatura: usa o status da API Pluggy (currentBill é a última fatura fechada)
    // CLOSED = paga, qualquer outro valor (OPEN, undefined) = não paga
    const isLastInvoicePaid = billStatus === 'CLOSED';

    // Buscar transações de pagamento para mostrar valores pagos (se houver pagamento parcial)
    const lastInvoicePayments = invoiceSummary.lastInvoice.transactions.filter(t => isCreditCardPayment(t));
    const lastInvoicePaidAmount = lastInvoicePayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const lastInvoiceTotal = selectedCard?.currentBill?.totalAmount || invoiceSummary.lastInvoice.total;

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
  // ============================================================
  const visualTotals = useMemo(() => {
    const calcTotal = (txs: Transaction[]) => txs.reduce((acc, tx) => {
      // Usa isCreditCardPaymentBuilder para garantir consistência
      if (isCreditCardPaymentBuilder(tx)) return acc;
      const amt = Math.abs(Number(tx.amount) || 0);
      return tx.type === 'income' ? acc - amt : acc + amt;
    }, 0);

    const lastTotal = calcTotal(invoiceSummary.lastInvoice.transactions);
    // Adicionar encargos ao total visual da última fatura se houver
    const charges = selectedCard?.currentBill?.financeCharges?.total || 0;

    return {
      last: lastTotal + charges,
      current: calcTotal(invoiceSummary.currentInvoice.transactions),
      next: calcTotal(invoiceSummary.nextInvoice.transactions)
    };
  }, [invoiceSummary, selectedCard]);

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

  // Calculate total amount from filtered transactions (incluindo encargos)
  const totalAmount = useMemo(() => {
    return transactionsWithCharges.reduce((acc, tx) => {
      if (isCreditCardPayment(tx)) return acc;
      const amt = Math.abs(Number((tx as any).amount) || 0);
      if (tx.type === 'income') return acc - amt;
      return acc + amt;
    }, 0);
  }, [transactionsWithCharges]);

  // Auto-remove duplicates when transactions load
  React.useEffect(() => {
    if (hasCheckedDuplicates || transactions.length === 0) return;

    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const key = `${t.date}-${Math.abs(t.amount)}-${(t.description || '').trim().toLowerCase()}-${t.type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const duplicates = Object.values(groups).filter(g => g.length > 1);

    if (duplicates.length > 0) {
      const idsToDelete: string[] = [];
      duplicates.forEach(group => {
        for (let i = 1; i < group.length; i++) {
          idsToDelete.push(group[i].id);
        }
      });

      // Delete duplicates silently
      Promise.all(idsToDelete.map(id => onDelete(id)))
        .then(() => {
          toast.success(`${idsToDelete.length} duplicatas removidas automaticamente!`);
        })
        .catch(() => { });
    }

    setHasCheckedDuplicates(true);
  }, [transactions, hasCheckedDuplicates, onDelete, toast]);

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

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(filteredTransactions, `fatura_cartao_${dateStr}.csv`);
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
        <div>
          <h2 className="text-2xl font-bold text-white">Fatura do Cartão</h2>
          <p className="text-sm text-gray-400 mt-1">{filteredTransactions.length} lançamentos</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="export-btn"

            onClick={handleExport}
            className="flex items-center gap-2 px-2 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            title="Exportar para Excel"
          >
            <FileText size={18} />
            <span className="hidden sm:inline">Exportar</span>
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
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar p-1">
              {visibleCreditCardAccounts.map((card, index) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 outline-none ${isSelected ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-[#232322] border border-[#373734] rounded-xl shadow-lg"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    {/* Logo do banco ou ícone genérico */}
                    {card.connector?.imageUrl ? (
                      <img
                        src={card.connector.imageUrl}
                        alt=""
                        className="relative z-10 w-5 h-5 rounded object-contain"
                      />
                    ) : (
                      <div className={`relative z-10 flex items-center justify-center p-1 rounded-md transition-all ${isSelected ? 'bg-[#d97757]/40 text-white shadow-md shadow-[#d97757]/10 mr-1' : 'bg-[#373734]/50 text-gray-500'}`}>
                        <CreditCard size={12} className="" />
                      </div>
                    )}
                    <span className="relative z-10 truncate max-w-[120px]">
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
                          className="w-10 h-10 rounded-xl object-contain"
                        />
                      ) : (
                        <div className="p-2.5 bg-[#d97757]/40 rounded-xl shadow-lg shadow-[#d97757]/10">
                          <CreditCard size={20} className="text-white" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{selectedCard.name || selectedCard.institution || 'Cartão'}</h3>
                          <button
                            onClick={() => setShowInvoiceCards(!showInvoiceCards)}
                            className="p-1 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                            title={showInvoiceCards ? "Recolher cartões" : "Expandir cartões"}
                          >
                            {showInvoiceCards ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Fecha dia {invoiceSummary.closingDay} • Vence dia {invoiceSummary.dueDay}
                        </p>
                      </div>
                    </div>

                    {/* Beta Disclaimer - Center */}
                    <div className="hidden md:flex flex-1 justify-start mx-4">
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-1.5 flex items-center gap-2 max-w-xl">
                        <AlertCircle size={14} className="text-blue-400 shrink-0" />
                        <div className="text-[10px] text-gray-400 leading-tight flex items-center gap-2">
                          <span>
                            <span className="text-blue-400 font-bold">Funcionalidade em Beta:</span> O cálculo de faturas está em fase de testes e pode apresentar divergências.
                          </span>
                          {onOpenFeedback && (
                            <button
                              onClick={onOpenFeedback}
                              className="text-gray-300 hover:text-white underline decoration-gray-600 hover:decoration-white underline-offset-2 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                            >
                              Reportar problema
                              <ChevronRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">

                      {onUpdateAccount && (
                        <button
                          onClick={() => {
                            setCardSettings({
                              closingDay: selectedCard.closingDay || 10,
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
                    {showInvoiceCards && (
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
                                    {formatCurrency(visualTotals.last)}
                                  </span>
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={12} /> Pago: {formatCurrency(invoicePaymentInfo.last.paidAmount)}
                                  </span>
                                </div>
                              ) : (
                                <span className={`text-xl font-bold font-mono tracking-tight ${selectedInvoice === 'last' ? 'text-[#d97757]' : 'text-white'}`}>
                                  {formatCurrency(visualTotals.last)}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500">
                                {invoiceSummary.lastInvoiceStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {invoiceSummary.lastInvoiceEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="text-[9px] text-gray-600">
                                Venceu {selectedCard.currentBill?.dueDate
                                  ? new Date(selectedCard.currentBill.dueDate).toLocaleDateString('pt-BR')
                                  : invoiceSummary.lastDueDate.toLocaleDateString('pt-BR')} • {invoiceSummary.lastInvoice.transactions.length} lançamentos
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
                                {formatCurrency(visualTotals.current)}
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
                                {formatCurrency(visualTotals.next)}
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
                          <th className="px-4 py-4 border-b border-r border-[#373734] w-12 text-center first:rounded-tl-xl align-middle">
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
                          {isManualModeActive && (
                            <th className="px-6 py-4 border-b border-[#373734] w-28 text-center last:rounded-tr-xl">Ações</th>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#373734]">
                        {transactionsWithCharges.map((t, index) => {
                          const isCharge = (t as any).isCharge === true;
                          const isPayment = (t as any).isPayment === true;
                          const isLate = (t as any).isLate === true;
                          const daysLate = (t as any).daysLate || 0;
                          const isAdjustment = (t as any).isAdjustment === true;
                          return (
                            <tr
                              key={t.id}
                              className={`transition-colors group border-b border-[#373734] ${isAdjustment
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
                              <td className="px-4 py-4 border-b border-r border-[#373734] text-center align-middle">
                                <div className="flex items-center justify-center h-full">
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
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs border-r border-[#373734]">
                                {formatDate(t.date)}
                              </td>
                              <td className="px-6 py-4 text-gray-200 font-medium border-r border-[#373734]">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isAdjustment && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 shrink-0">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                      </svg>
                                    )}
                                    {isCharge && (
                                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                                    )}
                                    {isPayment && (
                                      <Check size={14} className={isLate ? 'text-amber-400 shrink-0' : 'text-emerald-400 shrink-0'} />
                                    )}
                                    <span className={isAdjustment ? 'text-purple-300' : isCharge ? 'text-red-300' : isPayment ? (isLate ? 'text-amber-300' : 'text-emerald-300') : ''}>{t.description}</span>
                                    {isAdjustment && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                        title="Lançamentos que ainda não apareceram na sincronização. Este valor completa a fatura baseado no limite usado do cartão."
                                      >
                                        Ajuste
                                      </span>
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
                              <td className="px-6 py-4 text-gray-400 border-r border-[#373734]">
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
                                <span className={`font-bold font-mono ${isAdjustment ? 'text-purple-400'
                                  : isCharge ? 'text-red-400'
                                    : isPayment ? (isLate ? 'text-amber-400' : 'text-emerald-400')
                                      : t.type === 'income' ? 'text-emerald-400' : 'text-gray-200'
                                  }`}>
                                  {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                                </span>
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
                              {isManualModeActive && (
                                <td className="px-6 py-4 text-center">
                                  {!isCharge && !isPayment && !isAdjustment && (
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => handleEditClick(t)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-[#373734] rounded-xl transition-colors"
                                        title="Editar"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteId(t.id)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                        title="Excluir"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {transactionsWithCharges.length === 0 && (
                          <tr className="h-full">
                            <td colSpan={isManualModeActive ? 7 : 6} className="p-4 h-full">
                              <EmptyState
                                title="Nenhum lançamento de cartão encontrado"
                                description="Seus gastos com cartão aparecerão aqui."
                                className="!border-0 !bg-transparent !shadow-none"
                                minHeight="h-full"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
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
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-500">Atenção na Configuração</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Alterar o dia de fechamento pode reorganizar suas faturas passadas. Para maior precisão, recomendamos usar a sincronização automática se disponível.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">

              </div>

              <div className="space-y-4">


                <div className="p-3 bg-gray-900/50 rounded-xl border border-gray-800/60">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">
                        Fechamento Última Fatura
                      </label>
                      <CustomDatePicker
                        value={cardSettings.manualLastClosingDate || ''}
                        onChange={(val) => setCardSettings({ ...cardSettings, manualLastClosingDate: val })}
                        placeholder="Data de fechamento"
                        dropdownMode="fixed"
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
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    Preencher estas datas sobrescreve o cálculo automático pelo Dia do Fechamento.
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-[#1a1a19] rounded-xl border border-[#373734]">
                <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Prévia de Ciclos</p>

                {cardSettings.manualLastClosingDate && cardSettings.manualCurrentClosingDate ? (() => {
                  // Calculate real preview with simplified method (calling the main calculator with override)
                  const previewSummary = calculateInvoiceSummary({
                    ...selectedCard,
                    ...cardSettings
                  } as any, transactions, selectedCardId);

                  const currentStart = previewSummary.currentInvoiceStart;
                  const currentClosing = previewSummary.currentInvoiceEnd;
                  const nextStart = previewSummary.nextInvoiceStart;
                  const nextClosing = previewSummary.nextInvoiceEnd;

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Fatura Atual */}
                      <div style={{ backgroundColor: '#30302E' }} className="border border-blue-500/20 rounded-lg p-3 relative overflow-hidden">
                        <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Fatura Atual</p>
                        <p className="text-lg font-bold text-white font-mono leading-none mb-2">
                          {formatCurrency(previewSummary.currentInvoice.total)}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {currentStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até {currentClosing.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-1">
                          Fecha em {formatDate(cardSettings.manualCurrentClosingDate)}
                        </p>
                      </div>

                      {/* Próxima Fatura */}
                      <div style={{ backgroundColor: '#30302E' }} className="border border-[#d97757]/30 rounded-lg p-3 relative overflow-hidden">
                        <p className="text-[10px] text-[#d97757] font-bold uppercase mb-1">Próxima Fatura</p>
                        <p className="text-lg font-bold text-white font-mono leading-none mb-2">
                          {formatCurrency(previewSummary.nextInvoice.total)}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {nextStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até {nextClosing.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </p>
                        {/* Exibindo Total Futuro para conferência */}
                        <p className="text-[10px] text-gray-300 font-mono mt-2 pt-2 border-t border-white/10">
                          <span className="text-[#d97757]">Total Futuro:</span> {formatCurrency(previewSummary.allFutureTotal)}
                        </p>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-xs text-gray-500 italic text-center py-2">
                    Selecione as datas acima para visualizar os ciclos das faturas.
                  </div>
                )}
              </div>
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

        </div >
      )}
    </div >
  );
};

export default CreditCardTable;
