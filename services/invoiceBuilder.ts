/**
 * Invoice Builder - Sistema de construção de faturas de cartão de crédito
 *
 * A API da Pluggy NÃO entrega "fatura pronta" como um banco mostra no app.
 * Ela entrega transações + metadados do cartão.
 * Quem monta fatura atual, fechada e futura é ESTE MÓDULO.
 *
 * Conceito base:
 * - Fatura fecha todo mês no billingDay (closingDay)
 * - Tudo que cair entre dois fechamentos pertence à mesma fatura
 * - Parcelas futuras são projetadas automaticamente
 */

import {
  Transaction,
  ConnectedAccount,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceForecast,
  InstallmentSeries,
  FinanceCharges,
  InvoicePeriods,
  PurchaseWithInstallments,
  Installment
} from '../types';

import {
  processTransactionsToInstallments,
  getInstallmentsForMonth,
  installmentToInvoiceItem,
  generateInstallmentForecast as generateInstForecast,
  calculateFutureCommitment,
  isInstallmentTransaction,
  extractInstallmentInfo
} from './installmentService';

import {
  adjustClosingDate,
  adjustDueDate,
  isBusinessDay
} from '../utils/dateUtils';

import {
  toCents,
  fromCents,
  sumMoney
} from '../utils/moneyUtils';

import { auditLogger } from '../utils/auditLogger';

import { calculateLateCharges } from './financeService';

// ============================================================
// HELPERS - Funções utilitárias
// ============================================================

/**
 * Valida e normaliza o dia de fechamento (1-28)
 */
export const validateClosingDay = (day: number | null | undefined): number => {
  if (!day || typeof day !== 'number') return 10; // Default
  return Math.max(1, Math.min(28, day));
};

/**
 * Converte string YYYY-MM-DD ou ISO para Date
 * IMPORTANTE: Cria data ao meio-dia local para evitar problemas de timezone
 */
export const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // Trata datas em formato ISO (com 'T')
  if (dateStr.includes('T')) {
    const isoDate = new Date(dateStr);
    return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate(), 12, 0, 0);
  }
  const rawParts = dateStr.split(/[-/]/);
  if (rawParts.length >= 3) {
    const [p0, p1, p2] = rawParts;
    const n0 = Number(p0);
    const n1 = Number(p1);
    const n2 = Number(p2);

    if (!Number.isNaN(n0) && !Number.isNaN(n1) && !Number.isNaN(n2)) {
      let y: number;
      let m: number;
      let d: number;

      if (p0.length === 4 || n0 > 31) {
        // YYYY-MM-DD (ou YYYY/MM/DD)
        y = n0;
        m = n1;
        d = n2;
      } else if (p2.length === 4 || n2 > 31) {
        // DD/MM/YYYY (ou DD-MM-YYYY)
        d = n0;
        m = n1;
        y = n2;
      } else {
        // Fallback: assume YYYY-MM-DD
        y = n0;
        m = n1;
        d = n2;
      }

      return new Date(y, m - 1, d || 1, 12, 0, 0);
    }
  }

  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  }
  return new Date();
};

/**
 * Converte Date para string YYYY-MM-DD
 * IMPORTANTE: Usa método local para evitar conversão UTC que pode mudar a data
 */
export const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Cria monthKey (YYYY-MM) a partir de uma data
 */
export const toMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Cria data de fechamento segura (evita problemas com meses curtos)
 * E ajusta para dia útil anterior se necessário.
 */
const getClosingDate = (year: number, month: number, day: number): Date => {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  const closingDate = new Date(year, month, safeDay, 23, 59, 59);
  return adjustClosingDate(closingDate);
};

/**
 * Normaliza descrição para agrupar parcelas da mesma compra
 */
const normalizeDescription = (desc: string): string => {
  return (desc || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')  // Remove "1/10" no final
    .replace(/\s*\d+\/\d+\s*/g, '')          // Remove "1/10" no meio
    .replace(/\s*parcela\s*\d+\s*/gi, '')    // Remove "parcela 1"
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extrai número de parcela da descrição (ex: "COMPRA 3/10")
 */
const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
  const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
  }
  return null;
};

/**
 * Verifica se uma transação é pagamento de fatura
 * 
 * REGRA CRÍTICA:
 * 1. Um pagamento de fatura é SEMPRE um crédito (income) para o cartão.
 * 2. Se a transação for uma despesa (expense/valor negativo), NUNCA é pagamento.
 * 3. Muitos bancos usam "PGTO" como prefixo de compras (ex: "PGTO LOJA").
 */
export const isCreditCardPayment = (tx: Transaction): boolean => {
  // 1. Se for despesa (valor negativo na API ou tipo expense), não é pagamento de fatura
  const isExpense = tx.type === 'expense' || (tx.amount < 0 && !tx.type);
  if (isExpense) return false;

  const d = (tx.description || '').toLowerCase();
  const c = (tx.category || '').toLowerCase();

  // 2. Keywords específicas que indicam pagamento de fatura (crédito na conta)
  const paymentKeywords = [
    'pagamento de fatura',
    'pagamento fatura',
    'pagamento recebido',
    'credit card payment',
    'pagamento efetuado',
    'pagamento enviado',
    'recebemos seu pagamento'
  ];

  const isExplicitPayment = paymentKeywords.some(kw => d.includes(kw) || c.includes(kw));

  // 3. Casos curtos como "PGTO" ou "PAGTO" só são pagamentos se forem a descrição exata
  // ou se a categoria for explicitamente de pagamento.
  const isShortPayment = (d === 'pgto' || d === 'pagto' || d === 'pagamento');
  const isPaymentCategory = c.includes('credit card payment') || c === 'pagamento de fatura';

  return isExplicitPayment || isShortPayment || isPaymentCategory;
};

export const isTransactionRefund = (tx: Transaction): boolean => {
  if ((tx as any)._syntheticRefund === true || !!(tx as any).refundOfId) {
    return true;
  }

  const desc = (tx.description || '').toLowerCase();
  const category = (tx.category || '').toLowerCase();
  const refundKeywords = [
    'estorno',
    'reembolso',
    'devolucao',
    'devolução',
    'chargeback',
    'refund',
    'cancelamento'
  ];

  return refundKeywords.some(kw => desc.includes(kw) || category.includes(kw));
};




// ============================================================
// CÁLCULO DE PERÍODOS
// ============================================================

export interface InvoicePeriodDates {
  closingDay: number;
  dueDay: number;

  // Datas de fechamento
  beforeLastClosingDate: Date;
  lastClosingDate: Date;
  currentClosingDate: Date;
  nextClosingDate: Date;

  // Datas de início de cada período
  lastInvoiceStart: Date;
  currentInvoiceStart: Date;
  nextInvoiceStart: Date;

  // Datas de vencimento
  lastDueDate: Date;
  currentDueDate: Date;
  nextDueDate: Date;

  // Month keys
  lastMonthKey: string;
  currentMonthKey: string;
  nextMonthKey: string;
}

/**
 * Calcula todas as datas relevantes para faturas de um cartão
 * @param monthOffset - Offset de meses: 0 = mês atual, -1 = mês anterior, +1 = próximo mês
 */
export const calculateInvoicePeriodDates = (
  closingDayRaw: number | null | undefined,
  dueDayRaw: number | null | undefined,
  today: Date = new Date(),
  monthOffset: number = 0,
  card: ConnectedAccount | null = null
): InvoicePeriodDates => {
  let closingDay = validateClosingDay(closingDayRaw);
  let dueDay = dueDayRaw || closingDay + 10;

  // Aplicar o offset de meses à data de referência
  const referenceDate = new Date(today);
  if (monthOffset !== 0) {
    referenceDate.setMonth(referenceDate.getMonth() + monthOffset);
  }
  const todayWithOffset = referenceDate;

  let currentClosingDate: Date | null = null;

  // ============================================================
  // LÓGICA SMART (Portada do App Mobile)
  // ============================================================

  // PRIORIDADE 0: Usar periodStart e periodEnd do currentBill se disponíveis (Dados REAIS do Banco)
  if (card?.currentBill?.periodStart && card?.currentBill?.periodEnd) {
    const periodEnd = parseDate(card.currentBill.periodEnd);
    // periodStart não é estritamente necessário para calcular datas futuras, apenas closingDay importa

    closingDay = periodEnd.getDate(); // Atualiza closingDay real

    if (card.currentBill.dueDate) {
      dueDay = parseDate(card.currentBill.dueDate).getDate();
    } else {
      dueDay = Math.min(closingDay + 10, 28);
    }

    currentClosingDate = new Date(periodEnd);
  }
  // PRIORIDADE 1: Usar currentBill.dueDate (Dados REAIS da Fatura)
  else if (card?.currentBill?.dueDate) {
    const billDueDate = parseDate(card.currentBill.dueDate);
    dueDay = billDueDate.getDate();

    // Tentar deduzir closingDay
    if (card.currentBill.closeDate) {
      closingDay = parseDate(card.currentBill.closeDate).getDate();
    } else if (card.balanceCloseDate) {
      closingDay = parseDate(card.balanceCloseDate).getDate();
    } else {
      // Estima 10 dias antes
      closingDay = Math.max(1, dueDay - 10);
    }

    if (card.currentBill.closeDate) {
      currentClosingDate = parseDate(card.currentBill.closeDate);
    } else if (card.balanceCloseDate) {
      currentClosingDate = parseDate(card.balanceCloseDate);
    } else {
      currentClosingDate = new Date(billDueDate);
      currentClosingDate.setDate(currentClosingDate.getDate() - 10);
    }
  }
  // PRIORIDADE 2: Usar balanceCloseDate (Dado real do Pluggy)
  else if (card?.balanceCloseDate) {
    const pluggyCloseDate = parseDate(card.balanceCloseDate);
    closingDay = pluggyCloseDate.getDate();

    if (card.balanceDueDate) {
      dueDay = parseDate(card.balanceDueDate).getDate();
    } else {
      dueDay = Math.min(closingDay + 10, 28);
    }

    currentClosingDate = new Date(pluggyCloseDate);
  }

  // 3. Rotação Automática ou Fallback
  if (currentClosingDate) {
    // Adicionar um período de carência (7 dias) para a rotação automática
    const rotationThreshold = new Date(todayWithOffset);
    rotationThreshold.setDate(rotationThreshold.getDate() - 7);

    // Se temos uma data base, rotacionamos se ela já passou para achar a "atual" relativa a hoje (com offset)
    while (rotationThreshold > currentClosingDate) {
      currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
      currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
    }
  } else {
    // Fallback: Cálculo puramente matemático baseado no dia
    const closingThisMonth = getClosingDate(todayWithOffset.getFullYear(), todayWithOffset.getMonth(), closingDay);

    if (todayWithOffset <= closingThisMonth) {
      currentClosingDate = closingThisMonth;
    } else {
      const nextMonth = todayWithOffset.getMonth() === 11 ? 0 : todayWithOffset.getMonth() + 1;
      const nextYear = todayWithOffset.getMonth() === 11 ? todayWithOffset.getFullYear() + 1 : todayWithOffset.getFullYear();
      currentClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
    }
  }

  // ============================================================
  // CÁLCULO DE DATAS DERIVADAS
  // ============================================================

  // ÚLTIMA fatura (um mês antes da atual)
  const lastClosingMonth = currentClosingDate.getMonth() === 0 ? 11 : currentClosingDate.getMonth() - 1;
  const lastClosingYear = currentClosingDate.getMonth() === 0 ? currentClosingDate.getFullYear() - 1 : currentClosingDate.getFullYear();
  const lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

  // ANTES DA ÚLTIMA (dois meses antes da atual)
  const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
  const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
  const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

  // PRÓXIMA fatura (um mês após a atual)
  const nextClosingMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
  const nextClosingYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
  const nextClosingDate = getClosingDate(nextClosingYear, nextClosingMonth, closingDay);

  // Datas de INÍCIO de cada período (dia após fechamento anterior)
  const lastInvoiceStart = new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000);
  const currentInvoiceStart = new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000);
  const nextInvoiceStart = new Date(currentClosingDate.getTime() + 24 * 60 * 60 * 1000);

  // Datas de VENCIMENTO
  const safeDueDay = dueDay; // Já validado/ajustado acima

  const calculateDueDate = (closingDate: Date): Date => {
    let targetMonth = closingDate.getMonth();
    let targetYear = closingDate.getFullYear();

    // Se dueDay <= closingDay, o vencimento é no mês seguinte
    // Se dueDay > closingDay, o vencimento é no mesmo mês
    if (safeDueDay <= closingDay) {
      targetMonth = targetMonth === 11 ? 0 : targetMonth + 1;
      targetYear = targetMonth === 0 ? targetYear + 1 : targetYear;
    }

    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dueDate = new Date(targetYear, targetMonth, Math.min(safeDueDay, lastDayOfTargetMonth));
    return adjustDueDate(dueDate);
  };

  const lastDueDate = calculateDueDate(lastClosingDate);
  const currentDueDate = calculateDueDate(currentClosingDate);
  const nextDueDate = calculateDueDate(nextClosingDate);

  return {
    closingDay,
    dueDay: safeDueDay,
    beforeLastClosingDate,
    lastClosingDate,
    currentClosingDate,
    nextClosingDate,
    lastInvoiceStart,
    currentInvoiceStart,
    nextInvoiceStart,
    lastDueDate,
    currentDueDate,
    nextDueDate,
    // MonthKeys são baseados no mês do FECHAMENTO
    lastMonthKey: toMonthKey(lastClosingDate),
    currentMonthKey: toMonthKey(currentClosingDate),
    nextMonthKey: toMonthKey(nextClosingDate)
  };
};

/**
 * Calcula o monthKey da fatura para uma transação
 * Regra: Se dia da transação > closingDay → pertence ao MÊS SEGUINTE
 */
export const getTransactionInvoiceMonthKey = (txDate: string, closingDay: number): string => {
  const validClosingDay = validateClosingDay(closingDay);
  const date = parseDate(txDate);

  if (date.getDate() > validClosingDay) {
    date.setMonth(date.getMonth() + 1);
  }

  return toMonthKey(date);
};

// ============================================================
// PROCESSAMENTO DE PARCELAS
// ============================================================

interface ProcessedInstallment {
  series: InstallmentSeries[];
  nonInstallmentTxs: Transaction[];
}

/**
 * Processa e agrupa transações parceladas
 */
export const processInstallments = (
  transactions: Transaction[],
  cardId: string
): ProcessedInstallment => {
  const installmentMap: Record<string, { firstInstDate: Date; transactions: Transaction[] }> = {};
  const nonInstallmentTxs: Transaction[] = [];

  transactions.forEach(tx => {
    if (!tx.date) return;
    if (isCreditCardPayment(tx)) return; // Ignora pagamentos

    // Filtra por cartão
    const txCardId = tx.cardId || tx.accountId || '';
    if (cardId !== 'all' && txCardId !== cardId) return;

    const installmentNumber = tx.installmentNumber || 1;
    const totalInstallments = tx.totalInstallments || 0;

    if (totalInstallments > 1) {
      const normalizedDesc = normalizeDescription(tx.description || '');
      const seriesKey = `${txCardId}-${normalizedDesc}-${totalInstallments}`;

      if (!installmentMap[seriesKey]) {
        installmentMap[seriesKey] = { firstInstDate: new Date(9999, 0, 1), transactions: [] };
      }

      const txWithInstallment = {
        ...tx,
        installmentNumber,
        totalInstallments
      };
      installmentMap[seriesKey].transactions.push(txWithInstallment);

      const txDate = parseDate(tx.date);

      if (installmentNumber === 1) {
        installmentMap[seriesKey].firstInstDate = txDate;
      } else if (installmentMap[seriesKey].firstInstDate.getFullYear() === 9999) {
        const firstInstDate = new Date(txDate);
        firstInstDate.setMonth(firstInstDate.getMonth() - (installmentNumber - 1));
        installmentMap[seriesKey].firstInstDate = firstInstDate;
      }
    } else {
      nonInstallmentTxs.push(tx);
    }
  });

  // Converte para InstallmentSeries
  const series: InstallmentSeries[] = Object.entries(installmentMap).map(([seriesKey, data]) => {
    const baseTx = data.transactions[0];
    const totalInstallments = baseTx.totalInstallments || 1;
    const paidInstallments = data.transactions.length;
    const installmentAmount = -Math.abs(baseTx.amount);

    // Calcula data da última parcela
    const lastInstDate = new Date(data.firstInstDate);
    lastInstDate.setMonth(lastInstDate.getMonth() + totalInstallments - 1);

    return {
      seriesKey,
      description: normalizeDescription(baseTx.description || ''),
      originalAmount: installmentAmount * totalInstallments,
      installmentAmount,
      totalInstallments,
      paidInstallments,
      remainingInstallments: totalInstallments - paidInstallments,
      firstInstallmentDate: toDateStr(data.firstInstDate),
      lastInstallmentDate: toDateStr(lastInstDate),
      cardId: baseTx.cardId || baseTx.accountId || '',
      items: data.transactions.map(tx => transactionToInvoiceItem(tx))
    };
  });

  return { series, nonInstallmentTxs };
};

// ============================================================
// CONVERSÃO DE TRANSAÇÕES PARA INVOICE ITEMS
// ============================================================

/**
 * Converte uma Transaction para InvoiceItem
 * 
 * REGRA IMPORTANTE:
 * - Pagamentos de fatura: NÃO afetam o total (são apenas informativos)
 * - Reembolsos/estornos: REDUZEM o total (são créditos reais)
 * - Despesas normais: AUMENTAM o total
 */
export const transactionToInvoiceItem = (tx: Transaction, isProjected = false): InvoiceItem => {
  const isPayment = isCreditCardPayment(tx);
  // FIX: rely only on explicit flags or helper detection, not just negative amount
  // FIX: rely only on explicit flags or logic related to invoices, not refunds
  // const isRefund = removed;

  // Determina tipo e sinal baseado na natureza da transação
  // Pagamentos: marcados como income, mas com flag especial
  // Despesas: expense normal
  let fixedType: 'income' | 'expense' = tx.type === 'income' ? 'income' : 'expense';
  let amount = fixedType === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount);

  if (isPayment) {
    // Pagamento de fatura: positivo mas NÃO conta no total
    fixedType = 'income';
    amount = Math.abs(tx.amount);
  }

  const { totalInstallments, installmentNumber } = extractInstallmentInfo(tx);
  const hasInstallments = totalInstallments > 1;

  return {
    id: tx.id,
    transactionId: tx.id,
    description: tx.description,
    amount,
    date: tx.date,
    category: tx.category,
    type: fixedType,
    installmentNumber: hasInstallments ? installmentNumber : undefined,
    totalInstallments: hasInstallments ? totalInstallments : undefined,
    isProjected,
    isPayment, // Flag para identificar pagamentos (não devem afetar total)
    // isRefund removed
    // Dados de moeda para transações internacionais
    currencyCode: tx.currencyCode,
    amountOriginal: tx.amountOriginal,
    amountInAccountCurrency: tx.amountInAccountCurrency,
    pluggyRaw: tx.pluggyRaw,
    manualInvoiceMonth: tx.manualInvoiceMonth
  };
};

/**
 * Cria um InvoiceItem projetado para parcela futura
 */
export const createProjectedInstallment = (
  baseTx: Transaction,
  installmentNumber: number,
  installmentDate: Date
): InvoiceItem => {
  return {
    id: `proj_${baseTx.id}_${installmentNumber}`,
    transactionId: baseTx.id,
    description: baseTx.description,
    amount: -Math.abs(baseTx.amount),
    date: toDateStr(installmentDate),
    category: baseTx.category,
    type: baseTx.type,
    installmentNumber,
    totalInstallments: baseTx.totalInstallments,
    originalDate: baseTx.date,
    originalAmount: Math.abs(baseTx.amount) * (baseTx.totalInstallments || 1),
    isProjected: true
  };
};

// ============================================================
// CONSTRUÇÃO DE FATURAS
// ============================================================

export interface InvoiceBuildResult {
  closedInvoice: Invoice;     // Última fatura (fechada)
  currentInvoice: Invoice;    // Fatura atual (em aberto)
  futureInvoices: Invoice[];  // Faturas futuras (parcelas projetadas)
  allFutureTotal: number;     // Total comprometido futuro
  periods: InvoicePeriodDates;
}

/**
 * Determina o status de uma fatura
 */
const determineInvoiceStatus = (
  isClosedInvoice: boolean,
  dueDate: Date,
  paidAmount: number,
  total: number,
  billStatus?: string
): InvoiceStatus => {
  const today = new Date();

  if (isClosedInvoice) {
    // Fatura fechada
    if (billStatus === 'CLOSED' || (paidAmount > 0 && paidAmount >= total * 0.95)) {
      return 'PAID';
    }
    if (dueDate < today) {
      return 'OVERDUE';
    }
    return 'CLOSED';
  }

  return 'OPEN';
};

/**
 * Constrói todas as faturas de um cartão
 *
 * Este é o método principal que implementa toda a lógica de faturas.
 *
 * PRIORIDADE de datas:
 * 1. Datas manuais (manualLastClosingDate / manualCurrentClosingDate) - usuário define
 * 2. invoicePeriods do backend (calculado no sync)
 * 3. Cálculo automático baseado no closingDay
 * 
 * @param monthOffset - Offset de meses para navegação rotativa (0 = hoje, -1 = mês anterior, +1 = próximo)
 */
export const buildInvoices = (
  card: ConnectedAccount | undefined,
  transactions: Transaction[],
  cardId: string = 'all',
  monthOffset: number = 0,
  today: Date = new Date()
): InvoiceBuildResult => {

  // IMPORTANTE: NÃO usar invoicePeriods do backend - sempre calcular localmente
  // Isso garante que a lógica correta seja usada (o backend pode ter dados antigos)
  // O closingDay ainda é pego do backend, mas os períodos são calculados aqui
  const closingDay = card?.invoicePeriods?.closingDay || card?.closingDay || 10;
  const dueDay = card?.invoicePeriods?.dueDay || card?.dueDay || closingDay + 10;

  // ========================================
  // PRIORIDADE 1: Datas manuais definidas pelo usuário
  // ========================================
  let periods: InvoicePeriodDates;

  const hasManualCurrent = !!card?.manualCurrentClosingDate;
  const hasManualLast = !!card?.manualLastClosingDate;

  if (hasManualCurrent || hasManualLast) {
    // Parse das datas manuais (com fallbacks se faltarem)
    let currentClosingDate: Date;
    let lastClosingDate: Date;

    if (hasManualCurrent) {
      currentClosingDate = parseDate(card!.manualCurrentClosingDate!);
      if (hasManualLast) {
        lastClosingDate = parseDate(card!.manualLastClosingDate!);
      } else {
        lastClosingDate = new Date(currentClosingDate);
        lastClosingDate.setMonth(lastClosingDate.getMonth() - 1);
      }
    } else {
      // Se só houver a última data manual, inferimos a atual a partir dela
      lastClosingDate = parseDate(card!.manualLastClosingDate!);
      const manualClosingDayFromLast = lastClosingDate.getDate();
      currentClosingDate = new Date(lastClosingDate);
      currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
      const lastDayOfMonth = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 1, 0).getDate();
      currentClosingDate.setDate(Math.min(manualClosingDayFromLast, lastDayOfMonth));
      currentClosingDate = adjustClosingDate(currentClosingDate);
    }

    // IMPORTANTE: Extrair o dia de fechamento da data manual
    const manualClosingDay = hasManualCurrent ? currentClosingDate.getDate() : lastClosingDate.getDate();

    // ========================================
    // CORREÇÃO: Avançar datas automaticamente se estiverem desatualizadas
    // Se a data de fechamento atual (currentClosingDate) já passou,
    // precisamos avançar os períodos para refletir a realidade.
    // Usamos o hoje ajustado pelo monthOffset para permitir navegação.
    // ========================================
    const referenceDate = new Date(today);
    if (monthOffset !== 0) {
      referenceDate.setMonth(referenceDate.getMonth() + monthOffset);
    }

    // Adicionamos uma carência de 7 dias para a rotação.
    // Isso permite que uma fatura que fechou há poucos dias ainda seja vista como "Atual"
    // (útil para conferência final e pagamentos).
    const rotationThreshold = new Date(referenceDate);
    rotationThreshold.setDate(rotationThreshold.getDate() - 7);

    const rotationThresholdNum = rotationThreshold.getFullYear() * 10000 + (rotationThreshold.getMonth() + 1) * 100 + rotationThreshold.getDate();
    let currentClosingNum = currentClosingDate.getFullYear() * 10000 + (currentClosingDate.getMonth() + 1) * 100 + currentClosingDate.getDate();

    let advancedMonths = 0;
    while (rotationThresholdNum >= currentClosingNum && advancedMonths < 12) {
      // Avançar um mês
      lastClosingDate = new Date(currentClosingDate);
      currentClosingDate = new Date(currentClosingDate);
      currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);

      // Ajustar dia para meses curtos e aplicar regra de dia útil
      const lastDayOfMonth = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 1, 0).getDate();
      const safeDay = Math.min(manualClosingDay, lastDayOfMonth);
      currentClosingDate.setDate(safeDay);
      currentClosingDate = adjustClosingDate(currentClosingDate);

      currentClosingNum = currentClosingDate.getFullYear() * 10000 + (currentClosingDate.getMonth() + 1) * 100 + currentClosingDate.getDate();
      advancedMonths++;
    }

    if (advancedMonths > 0) {
      // Log removed
    } else {
      // Log removed
    }

    // Inferir próximo fechamento (current + 1 mês, mantendo o dia)
    const nextClosingDate = new Date(currentClosingDate);
    nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);

    // Calcular fechamento anterior ao último (retrasada)
    // Se existir manualBeforeLastClosingDate E não houve avanço de meses, usa ela.
    // Se houve avanço, a data manual tornou-se obsoleta para o novo ciclo.
    let beforeLastClosingDate: Date;
    if (card?.manualBeforeLastClosingDate && advancedMonths === 0) {
      beforeLastClosingDate = parseDate(card.manualBeforeLastClosingDate);
    } else {
      beforeLastClosingDate = new Date(lastClosingDate);
      beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);

      // Se houver manualClosingDay, garantir que o dia seja respeitado na inferência
      const lastDayOfMonth = new Date(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth() + 1, 0).getDate();
      beforeLastClosingDate.setDate(Math.min(manualClosingDay, lastDayOfMonth));
      beforeLastClosingDate = adjustClosingDate(beforeLastClosingDate);
    }

    // Calcular inícios dos períodos (dia seguinte ao fechamento anterior)
    const lastInvoiceStart = new Date(beforeLastClosingDate);
    lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

    const currentInvoiceStart = new Date(lastClosingDate);
    currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);

    const nextInvoiceStart = new Date(currentClosingDate);
    nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

    // Calcular datas de vencimento
    const calculateDueDateManual = (closingDate: Date): Date => {
      const dueDateCalc = new Date(closingDate);
      dueDateCalc.setMonth(dueDateCalc.getMonth() + 1);
      dueDateCalc.setDate(Math.min(dueDay, 28));
      return adjustDueDate(dueDateCalc);
    };

    periods = {
      closingDay: manualClosingDay, // USA O DIA EXTRAÍDO DA DATA MANUAL!
      dueDay,
      beforeLastClosingDate,
      lastClosingDate,
      currentClosingDate,
      nextClosingDate,
      lastInvoiceStart,
      currentInvoiceStart,
      nextInvoiceStart,
      lastDueDate: calculateDueDateManual(lastClosingDate),
      currentDueDate: calculateDueDateManual(currentClosingDate),
      nextDueDate: calculateDueDateManual(nextClosingDate),
      lastMonthKey: toMonthKey(lastClosingDate),
      currentMonthKey: toMonthKey(currentClosingDate),
      nextMonthKey: toMonthKey(nextClosingDate)
    };

    // Log removed
  } else {
    // ========================================
    // PRIORIDADE 2: Cálculo automático (SEMPRE recalcula)
    // ========================================
    // Log removed
    periods = calculateInvoicePeriodDates(closingDay, dueDay, today, monthOffset, card || null);
  }

  // Filtra transações do cartão
  const cardTransactions = cardId === 'all'
    ? transactions
    : transactions.filter(t => {
      const txCardId = t.cardId ? String(t.cardId) : '';
      const txAccountId = t.accountId ? String(t.accountId) : '';
      return txCardId === cardId || txAccountId === cardId;
    });

  // DEBUG: Mostrar datas das transações do cartão
  const sortedDates = cardTransactions.map(t => t.date).sort();
  const lastPeriodDates = sortedDates.filter(d => d >= '2025-11-24' && d <= '2025-12-23');
  // Log removed

  // Separa pagamentos das demais transações
  const paymentTxs = cardTransactions.filter(isCreditCardPayment);
  const nonPaymentTxs = cardTransactions.filter(t => !isCreditCardPayment(t));

  // ============================================================
  // NOVO SISTEMA DE PARCELAS - Usa installmentService.ts
  // Processa transações parceladas de forma robusta e independente
  // ============================================================
  const purchasesWithInstallments = processTransactionsToInstallments(
    nonPaymentTxs,
    periods.closingDay,
    periods.dueDay
  );

  // Log removed

  // Separa transações simples (não parceladas)
  const processedTxIds = new Set<string>();
  purchasesWithInstallments.forEach(({ installments }) => {
    installments.forEach(inst => {
      if (inst.transactionId) {
        processedTxIds.add(inst.transactionId);
      }
    });
  });

  const simpleTxs = nonPaymentTxs.filter(tx =>
    !isInstallmentTransaction(tx) && !processedTxIds.has(tx.id)
  );

  // Inicializa containers para cada fatura
  const closedItems: InvoiceItem[] = [];
  const currentItems: InvoiceItem[] = [];
  const futureItemsByMonth: Record<string, InvoiceItem[]> = {};

  // TOTAIS LÍQUIDOS em centavos (despesas - créditos/reembolsos, sem subtrair pagamentos)
  let closedTotalCents = 0;
  let currentTotalCents = 0;
  let allFutureTotalCents = 0;

  // Helper para comparação de datas (numero YYYYMMDD)
  const dateToNumber = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  const lastStartNum = dateToNumber(periods.lastInvoiceStart);
  const lastEndNum = dateToNumber(periods.lastClosingDate);
  const currentStartNum = dateToNumber(periods.currentInvoiceStart);
  const currentEndNum = dateToNumber(periods.currentClosingDate);

  // DEBUG: Log dos períodos calculados
  // Log removed

  // ============================================================
  // 1. Processa transações simples (não parceladas) por DATA
  // ============================================================

  // DEBUG: Mostrar amostra de transações simples e seus períodos
  const txDatesSample = simpleTxs.slice(0, 10).map(tx => {
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    return {
      date: tx.date,
      dateNum: txDateNum,
      desc: tx.description?.slice(0, 30),
      inLastPeriod: txDateNum >= lastStartNum && txDateNum <= lastEndNum,
      inCurrentPeriod: txDateNum >= currentStartNum && txDateNum <= currentEndNum,
      inFuture: txDateNum > currentEndNum,
      inPast: txDateNum < lastStartNum
    };
  });
  // Log removed

  // DEBUG: Contar quantas transações caem em cada período
  let inLastCount = 0, inCurrentCount = 0, inFutureCount = 0, inPastCount = 0;
  simpleTxs.forEach(tx => {
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    if (txDateNum >= lastStartNum && txDateNum <= lastEndNum) inLastCount++;
    else if (txDateNum >= currentStartNum && txDateNum <= currentEndNum) inCurrentCount++;
    else if (txDateNum > currentEndNum) inFutureCount++;
    else inPastCount++;
  });
  // Log removed

  simpleTxs.forEach(tx => {
    if (!tx.date) return;

    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    const item = transactionToInvoiceItem(tx);

    // ========================================
    // CÁLCULO DO TOTAL - REGRA IMPORTANTE:
    // - Pagamentos de fatura (isPayment): NÃO afetam o total!
    //   Eles são apenas informativos - mostram que a fatura anterior foi paga
    // - Despesas normais: AUMENTAM o total
    // ========================================
    const amtCents = item.isPayment ? 0 : toCents(item.amount);

    // ========================================
    // LÓGICA DE OVERRIDE MANUAL
    // ========================================
    if (tx.manualInvoiceMonth) {
      const manualKey = tx.manualInvoiceMonth;

      // Lógica de alocação baseada no manualKey:
      if (manualKey > periods.currentMonthKey) {
        // Vai para fatura futura
        // Vai para fatura futura
        if (!futureItemsByMonth[manualKey]) {
          futureItemsByMonth[manualKey] = [];
        }
        futureItemsByMonth[manualKey].push(item);
        allFutureTotalCents += amtCents;
      } else if (manualKey === periods.currentMonthKey) {
        // Vai para fatura atual
        currentItems.push(item);
        currentTotalCents += amtCents;
      } else {
        // Vai para fatura fechada (qualquer mês <= lastMonthKey)
        closedItems.push(item);
        closedTotalCents += amtCents;
      }

      return; // PULA a lógica de data automática
    }

    if (txDateNum >= lastStartNum && txDateNum <= lastEndNum) {
      closedItems.push(item);
      closedTotalCents += amtCents;
    } else if (txDateNum >= currentStartNum && txDateNum <= currentEndNum) {
      currentItems.push(item);
      currentTotalCents += amtCents;
    } else if (txDateNum > currentEndNum) {
      const monthKey = toMonthKey(txDate);
      if (!futureItemsByMonth[monthKey]) {
        futureItemsByMonth[monthKey] = [];
      }
      futureItemsByMonth[monthKey].push(item);
      allFutureTotalCents += amtCents;
    }
  });

  // ============================================================
  // 2. Processa parcelas por REFERENCE MONTH (não por data!)
  // Cada parcela já sabe em qual fatura deve cair
  // ============================================================

  // DEBUG: Mostrar todas as parcelas e seus referenceMonths
  purchasesWithInstallments.forEach(({ purchase, installments }) => {
    // Log removed
  });

  purchasesWithInstallments.forEach(({ purchase, installments }) => {
    installments.forEach(inst => {
      const item = installmentToInvoiceItem(inst);

      // Parcelas são tipicamente despesas (negativas), mas se for income, mantém positivo
      const amtCents = toCents(item.isPayment ? 0 : item.amount);

      // Aloca baseado no referenceMonth da parcela (calculado corretamente pelo installmentService)
      if (inst.referenceMonth === periods.lastMonthKey) {
        closedItems.push(item);
        closedTotalCents += amtCents;
      } else if (inst.referenceMonth === periods.currentMonthKey) {
        currentItems.push(item);
        currentTotalCents += amtCents;
      } else if (inst.referenceMonth > periods.currentMonthKey) {
        // Parcela futura
        if (!futureItemsByMonth[inst.referenceMonth]) {
          futureItemsByMonth[inst.referenceMonth] = [];
        }
        futureItemsByMonth[inst.referenceMonth].push(item);
        allFutureTotalCents += amtCents;
      }
      // Parcelas de meses anteriores são ignoradas (já foram pagas)
    });
  });

  // DEBUG: Mostrar totais após alocação de parcelas
  // Log removed

  // ============================================================
  // 3. Processa pagamentos (associa à fatura que está sendo quitada)
  // ============================================================
  // REGRA: Um pagamento feito durante o período da fatura ATUAL
  // está quitando a fatura FECHADA (anterior).
  // Pagamentos feitos durante o período da fatura FECHADA
  // estavam quitando a fatura ANTES DA FECHADA (duas atrás).
  // 
  // Para cada fatura, mostramos apenas o pagamento que a quita.
  // ============================================================

  // Encontrar o pagamento mais adequado para a fatura FECHADA
  // (pagamento feito durante o período da fatura ATUAL que quita a FECHADA)
  const paymentForClosedInvoice = paymentTxs.find(tx => {
    if (!tx.date) return false;
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    // Pagamento feito no período ATUAL quita a fatura FECHADA
    return txDateNum >= currentStartNum && txDateNum <= currentEndNum;
  });

  // Se não encontrou pagamento no período atual, busca pagamento
  // feito logo após o fechamento da fatura FECHADA (até o vencimento)
  const paymentForClosedInvoiceAlt = !paymentForClosedInvoice ? paymentTxs.find(tx => {
    if (!tx.date) return false;
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    const lastDueDateNum = dateToNumber(periods.lastDueDate);
    // Pagamento feito após fechamento e até o vencimento da fatura FECHADA
    return txDateNum > lastEndNum && txDateNum <= lastDueDateNum;
  }) : null;

  const effectivePaymentForClosed = paymentForClosedInvoice || paymentForClosedInvoiceAlt;

  if (effectivePaymentForClosed) {
    const item: InvoiceItem = {
      ...transactionToInvoiceItem(effectivePaymentForClosed),
      isPayment: true
    };
    closedItems.push(item);
  }

  // Para a fatura ATUAL (ainda em aberto), pagamentos serão mostrados
  // apenas quando ela fechar e virar "fechada" no próximo ciclo

  // Pega valor da última fatura da API se disponível
  const billTotalFromAPI = card?.currentBill?.totalAmount;
  const billStatus = card?.currentBill?.status;
  const paidAmount = card?.currentBill?.paidAmount || 0;

  // ============================================================
  // DEFINIÇÃO DOS TOTAIS
  // ============================================================
  // REGRA DE OURO: Fatura = Soma de Transações do Período
  // Não usamos usedCreditLimit ou balance pois são dados instáveis na API Pluggy.
  // ============================================================

  // Totais já calculados anteriormente pela soma dos itens (em centavos)

  // Log removed

  // Constrói Invoice da fatura fechada
  const closedInvoiceStatus = determineInvoiceStatus(true, periods.lastDueDate, paidAmount, billTotalFromAPI || fromCents(closedTotalCents), billStatus);

  let closedTotalFinalCents = closedTotalCents;
  let financeCharges: FinanceCharges | undefined = card?.currentBill?.financeCharges;

  // Se a fatura estiver atrasada, calcula juros e multas autônomos
  if (closedInvoiceStatus === 'OVERDUE') {
    const overdueAmount = Math.max(0, -fromCents(closedTotalCents));
    const charges = calculateLateCharges(overdueAmount, periods.lastDueDate, today);

    if (charges.totalCharges > 0) {
      closedTotalFinalCents -= toCents(charges.totalCharges); // Reduz o total líquido (aumenta o valor a pagar)

      financeCharges = {
        iof: 0,
        interest: 0,
        lateFee: 0,
        ...(financeCharges || {}),
        total: (financeCharges?.total || 0) + charges.totalCharges,
        // Adiciona detalhes da auditoria
        details: [
          ...(financeCharges?.details || []),
          { type: 'Juros e Multas (Auto)', amount: charges.totalCharges, date: toDateStr(today) }
        ]
      };

      auditLogger.log('LATE_CHARGES_APPLIED', {
        overdueAmount,
        daysOverdue: charges.daysOverdue,
        dueDate: periods.lastDueDate
      }, charges);
    }
  }

  const closedInvoice: Invoice = {
    id: `${cardId}_${periods.lastMonthKey}`,
    creditCardId: cardId,
    referenceMonth: periods.lastMonthKey,
    status: closedInvoiceStatus,
    billingDate: toDateStr(periods.lastClosingDate),
    dueDate: toDateStr(periods.lastDueDate),
    periodStart: toDateStr(periods.lastInvoiceStart),
    periodEnd: toDateStr(periods.lastClosingDate),
    total: Math.max(0, -fromCents(closedTotalFinalCents)), // TOTAL LÍQUIDO - inverte sinal pois despesas agora são negativas
    totalExpenses: fromCents(closedItems.filter(i => i.type === 'expense').reduce((s, i) => s + toCents(i.amount), 0)),
    totalIncomes: fromCents(closedItems.filter(i => i.type === 'income').reduce((s, i) => s + toCents(i.amount), 0)),
    minimumPayment: card?.currentBill?.minimumPaymentAmount,
    paidAmount,
    financeCharges,
    items: closedItems.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.id.localeCompare(b.id);
    })
  };

  // Constrói Invoice da fatura atual (SOMA PURA)
  const currentInvoice: Invoice = {
    id: `${cardId}_${periods.currentMonthKey}`,
    creditCardId: cardId,
    referenceMonth: periods.currentMonthKey,
    status: 'OPEN',
    billingDate: toDateStr(periods.currentClosingDate),
    dueDate: toDateStr(periods.currentDueDate),
    periodStart: toDateStr(periods.currentInvoiceStart),
    periodEnd: toDateStr(periods.currentClosingDate),
    total: Math.max(0, -fromCents(currentTotalCents)), // TOTAL LÍQUIDO - inverte sinal pois despesas agora são negativas
    totalExpenses: fromCents(currentItems.filter(i => i.type === 'expense').reduce((s, i) => s + toCents(i.amount), 0)),
    totalIncomes: fromCents(currentItems.filter(i => i.type === 'income').reduce((s, i) => s + toCents(i.amount), 0)),
    projectedInstallments: currentItems.filter(i => i.isProjected).length,
    items: currentItems.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.id.localeCompare(b.id);
    }),
    usedLimitBasedCalculation: false
  } as Invoice & { usedLimitBasedCalculation?: boolean };

  // Constrói faturas futuras
  const futureInvoices: Invoice[] = Object.entries(futureItemsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, items]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const billingDate = getClosingDate(year, month - 1, closingDay);
      const dueDate = new Date(billingDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(Math.min(dueDay, 28));
      const adjustedDueDate = adjustDueDate(dueDate);

      const totalCents = items.reduce((s, i) => s + toCents(i.amount), 0);
      const totalToPay = Math.max(0, -fromCents(totalCents));

      return {
        id: `${cardId}_${monthKey}`,
        creditCardId: cardId,
        referenceMonth: monthKey,
        status: 'FUTURE' as InvoiceStatus,
        billingDate: toDateStr(billingDate),
        dueDate: toDateStr(adjustedDueDate),
        periodStart: toDateStr(new Date(billingDate.getTime() - 30 * 24 * 60 * 60 * 1000)),
        periodEnd: toDateStr(billingDate),
        total: totalToPay,
        totalExpenses: fromCents(items.filter(i => i.type === 'expense').reduce((s, i) => s + toCents(i.amount), 0)),
        totalIncomes: fromCents(items.filter(i => i.type === 'income').reduce((s, i) => s + toCents(i.amount), 0)),
        projectedInstallments: items.filter(i => i.isProjected).length,
        items: items.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return a.id.localeCompare(b.id);
        })
      };
    });

  const result = {
    closedInvoice,
    currentInvoice,
    futureInvoices,
    allFutureTotal: fromCents(allFutureTotalCents),
    periods
  };

  auditLogger.log('BUILD_INVOICES_RESULT', {
    cardId,
    monthOffset,
    transactionCount: cardTransactions.length
  }, {
    closedTotal: closedInvoice.total,
    currentTotal: currentInvoice.total,
    futureInvoicesCount: futureInvoices.length,
    allFutureTotal: result.allFutureTotal
  });

  return result;
};

// ============================================================
// FUNÇÕES DE FORECAST (Visão de longo prazo)
// ============================================================

/**
 * Gera previsão de faturas para os próximos N meses
 */
export const generateInvoiceForecast = (
  buildResult: InvoiceBuildResult,
  monthsAhead: number = 12
): InvoiceForecast[] => {
  const forecasts: InvoiceForecast[] = [];
  const today = new Date();

  // Adiciona fatura atual
  forecasts.push({
    monthKey: buildResult.currentInvoice.referenceMonth,
    total: buildResult.currentInvoice.total,
    installmentsCount: buildResult.currentInvoice.items.filter(i => i.totalInstallments && i.totalInstallments > 1).length,
    newPurchasesCount: buildResult.currentInvoice.items.filter(i => !i.totalInstallments || i.totalInstallments === 1).length,
    items: buildResult.currentInvoice.items
  });

  // Adiciona faturas futuras
  buildResult.futureInvoices.forEach(inv => {
    forecasts.push({
      monthKey: inv.referenceMonth,
      total: inv.total,
      installmentsCount: inv.items.filter(i => i.totalInstallments && i.totalInstallments > 1).length,
      newPurchasesCount: inv.items.filter(i => !i.totalInstallments || i.totalInstallments === 1).length,
      items: inv.items
    });
  });

  // Preenche meses vazios
  for (let i = 0; i < monthsAhead; i++) {
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + i);
    const monthKey = toMonthKey(futureDate);

    if (!forecasts.find(f => f.monthKey === monthKey)) {
      forecasts.push({
        monthKey,
        total: 0,
        installmentsCount: 0,
        newPurchasesCount: 0,
        items: []
      });
    }
  }

  return forecasts.sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(0, monthsAhead);
};

/**
 * Calcula o impacto no limite futuro
 */
export const calculateFutureLimitImpact = (
  card: ConnectedAccount | undefined,
  buildResult: InvoiceBuildResult
): { available: number; committed: number; afterClosed: number } => {
  const creditLimit = card?.creditLimit || card?.manualCreditLimit || 0;
  const usedLimit = card?.usedCreditLimit || Math.abs(card?.balance || 0);

  return {
    available: creditLimit - usedLimit,
    committed: buildResult.allFutureTotal,
    afterClosed: creditLimit - buildResult.currentInvoice.total - buildResult.allFutureTotal
  };
};

// ============================================================
// EXPORTS AUXILIARES
// ============================================================

/**
 * Formata monthKey para exibição (ex: "JAN/2025")
 */
export const formatMonthKey = (monthKey: string): string => {
  if (!monthKey) return '';
  const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const [year, month] = monthKey.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${MONTH_NAMES[monthIndex]}/${year}`;
};

/**
 * Formata valor como moeda BRL
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};
